"""Walk-forward optimisation.

The history is cut into consecutive folds of `train` bars followed by `test` bars,
rolling forward by `test` each time. For each fold, every parameter combination is
backtested on the training window and the best one by `score` is then traded,
unchanged, on the following test window. Only the stitched test windows count as
evidence: each test result uses parameters chosen without seeing that data.

Robustness diagnostics per fold:
  plateau    share of grid combos with PF > 1 on the training window (higher = the
             edge isn't confined to one lucky parameter set)
  neighbour  median training score of the chosen combo's grid neighbours divided by
             its own score (near 1 = a smooth peak; near 0 = an isolated spike)
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import metrics
from .backtest import BacktestResult, Trade, run_backtest
from .instruments import Instrument
from .risk import RiskConfig
from .strategies import STRATEGIES

# Deliberately small, coarse grids: fewer combos = less room to curve-fit.
GRIDS: dict[str, dict[str, list]] = {
    "trend": {"entry_n": [20, 55, 100], "exit_n": [10, 20, 40], "stop_atr": [2.0, 3.0]},
    "meanrev": {"bb_k": [1.5, 2.0, 2.5], "rsi_low": [10.0, 20.0], "target_atr": [2.0, 3.0]},
    "momentum": {"fast": [10, 20, 50], "slow": [100, 200], "chandelier_atr": [2.5, 3.5]},
}


def select_params(
    bars: pd.DataFrame,
    tr: slice,
    inst: Instrument,
    signals: list[pd.DataFrame],
    combos: list[dict],
    grid: dict[str, list],
    risk: RiskConfig | None = None,
    equity: float = 100_000.0,
    min_train_trades: int = 15,
    usd_quote_rate: float | None = None,
    funding: pd.Series | None = None,
    financing: bool = True,
) -> dict:
    """Backtest every combo on the training window; pick the best by score.
    Shared by the walk-forward and the paper trader's periodic refit."""
    ms = [
        metrics.compute(run_backtest(bars.iloc[tr], s.iloc[tr], inst, equity, risk,
                                     usd_quote_rate=usd_quote_rate, funding=funding,
                                     financing=financing))
        for s in signals
    ]
    scores = np.array([score(m, min_train_trades) for m in ms])
    plateau = float(np.mean([m["profit_factor"] > 1 and m["trades"] >= min_train_trades for m in ms]))
    best = int(np.argmax(scores))
    return {
        "best": best if np.isfinite(scores[best]) else None,
        "params": combos[best] if np.isfinite(scores[best]) else None,
        "score": float(scores[best]),
        "scores": scores,
        "plateau": plateau,
    }


def strategy_signals(strategy: str, combos: list[dict], bars: pd.DataFrame, long_only: bool) -> list[pd.DataFrame]:
    cls = STRATEGIES[strategy]
    out = []
    for c in combos:
        s = cls(**c).generate(bars)
        if long_only:
            s.loc[s["entry"] < 0, "entry"] = 0
        out.append(s)
    return out


def resample(bars: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Aggregate OHLCV to a coarser timeframe (e.g. '4h', '1D')."""
    out = bars.resample(rule, label="left", closed="left").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    )
    return out.dropna()


def score(m: dict, min_trades: int) -> float:
    """Return over max drawdown; -inf if too few trades to judge."""
    if m["trades"] < min_trades:
        return -np.inf
    return m["return_pct"] / max(m["max_dd_pct"], 1.0)


def _grid(grid: dict[str, list]) -> list[dict]:
    keys = list(grid)
    return [dict(zip(keys, vals)) for vals in itertools.product(*grid.values())]


def _neighbour_ratio(combos: list[dict], scores: np.ndarray, best: int, grid: dict) -> float:
    if not np.isfinite(scores[best]) or scores[best] <= 0:
        return 0.0
    idx = {k: {v: i for i, v in enumerate(vals)} for k, vals in grid.items()}
    b = combos[best]
    neigh = [
        scores[j] for j, c in enumerate(combos)
        if j != best and sum(abs(idx[k][c[k]] - idx[k][b[k]]) for k in grid) == 1
    ]
    neigh = [s if np.isfinite(s) else 0.0 for s in neigh]
    return float(np.median(neigh) / scores[best]) if neigh else 0.0


@dataclass
class Fold:
    train_start: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    params: dict
    train_score: float
    plateau: float
    neighbour: float
    test_return_pct: float
    test_trades: int


@dataclass
class WalkForwardResult:
    symbol: str
    strategy: str
    folds: list[Fold]
    oos: BacktestResult

    def folds_frame(self) -> pd.DataFrame:
        return pd.DataFrame([f.__dict__ for f in self.folds])


def walk_forward(
    bars: pd.DataFrame,
    inst: Instrument,
    strategy: str,
    train: int,
    test: int,
    grid: dict[str, list] | None = None,
    risk: RiskConfig | None = None,
    equity: float = 100_000.0,
    long_only: bool = False,
    min_train_trades: int = 15,
    usd_quote_rate: float | None = None,
    funding: pd.Series | None = None,
    financing: bool = True,
) -> WalkForwardResult:
    grid = grid or GRIDS[strategy]
    combos = _grid(grid)
    # Indicators are causal, so signals over the full history equal signals computed
    # fold by fold - generate once per combo.
    signals = strategy_signals(strategy, combos, bars, long_only)

    folds: list[Fold] = []
    oos_trades: list[Trade] = []
    oos_equity: list[pd.Series] = []
    cur_equity = equity
    start = 0
    while start + train + test <= len(bars):
        tr, te = slice(start, start + train), slice(start + train, start + train + test)
        sel = select_params(bars, tr, inst, signals, combos, grid, risk, equity, min_train_trades,
                            usd_quote_rate, funding, financing)
        best, plateau = sel["best"], sel["plateau"]
        if best is None:
            # Nothing tradable in training: sit this fold out (flat equity).
            flat = pd.Series(cur_equity, index=bars.index[te], name="equity")
            oos_equity.append(flat)
            folds.append(Fold(bars.index[tr][0], bars.index[te][0], bars.index[te][-1], {},
                              -np.inf, plateau, 0.0, 0.0, 0))
            start += test
            continue
        scores = sel["scores"]
        res = run_backtest(bars.iloc[te], signals[best].iloc[te], inst, cur_equity, risk,
                           usd_quote_rate=usd_quote_rate, strategy_name=strategy,
                           funding=funding, financing=financing)
        oos_trades.extend(res.trades)
        oos_equity.append(res.equity)
        folds.append(Fold(
            bars.index[tr][0], bars.index[te][0], bars.index[te][-1], combos[best],
            float(scores[best]), plateau,
            _neighbour_ratio(combos, scores, best, grid),
            float((res.equity.iloc[-1] / cur_equity - 1) * 100), len(res.trades),
        ))
        cur_equity = float(res.equity.iloc[-1])
        start += test

    eq = pd.concat(oos_equity) if oos_equity else pd.Series(dtype=float, name="equity")
    oos = BacktestResult(inst.symbol, strategy, oos_trades, eq, equity)
    return WalkForwardResult(inst.symbol, strategy, folds, oos)


def stitched_signals(bars: pd.DataFrame, wf: WalkForwardResult, long_only: bool = False) -> pd.DataFrame:
    """Out-of-sample signal series: each test window uses the params chosen on the
    preceding training window. Folds with no tradable params only emit exits."""
    cls = STRATEGIES[wf.strategy]
    cache: dict[tuple, pd.DataFrame] = {}
    parts = []
    for f in wf.folds:
        window = bars.loc[f.test_start:f.test_end]
        if f.params:
            key = tuple(sorted(f.params.items()))
            if key not in cache:
                s = cls(**f.params).generate(bars)
                if long_only:
                    s.loc[s["entry"] < 0, "entry"] = 0
                cache[key] = s
            parts.append(cache[key].loc[window.index])
        else:
            s = cls.empty_signals(window.index)
            s["exit_long"] = s["exit_short"] = True
            parts.append(s)
    return pd.concat(parts) if parts else cls.empty_signals(bars.index[:0])


def bars_per_day(bars: pd.DataFrame) -> float:
    days = (bars.index[-1] - bars.index[0]).total_seconds() / 86400
    return len(bars) / max(days, 1.0)
