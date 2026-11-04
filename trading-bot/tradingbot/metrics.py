"""Performance metrics and the client acceptance criteria."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .backtest import BacktestResult

# Acceptance gates agreed for the demo prototype (per strategy, after costs).
ACCEPTANCE = {"profit_factor": 1.3, "max_drawdown": 0.15, "min_trades": 100}


def compute(res: BacktestResult) -> dict:
    eq = res.equity
    pnls = np.array([t.pnl for t in res.trades])
    wins, losses = pnls[pnls > 0], pnls[pnls < 0]
    gross_loss = -losses.sum()
    pf = wins.sum() / gross_loss if gross_loss > 0 else (np.inf if len(wins) else 0.0)
    # Drawdown is measured from the starting equity too, so an immediate loss counts.
    peak = np.maximum.accumulate(np.concatenate([[res.initial_equity], eq.to_numpy(float)]))[1:] if len(eq) else []
    dd = float((eq.to_numpy(float) / peak - 1).min()) if len(eq) else 0.0
    dd = min(dd, 0.0)
    daily_eq = eq.resample("1D").last().dropna()
    daily = daily_eq.pct_change().dropna()
    span_years = (eq.index[-1] - eq.index[0]).total_seconds() / (365.25 * 86400) if len(eq) > 1 else 0.0
    # Annualise by observed trading days per year (~252 for FX/indices, ~365 for crypto).
    periods = len(daily) / span_years if span_years > 0 else 252
    sharpe = daily.mean() / daily.std() * np.sqrt(periods) if len(daily) > 1 and daily.std() > 0 else 0.0
    final = eq.iloc[-1] if len(eq) else res.initial_equity
    if span_years < 30 / 365.25:
        cagr = np.nan  # annualising less than a month of data is meaningless
    else:
        cagr = (final / res.initial_equity) ** (1 / span_years) - 1 if final > 0 else -1.0
    return {
        "symbol": res.symbol,
        "strategy": res.strategy,
        "trades": len(pnls),
        "net_pnl": float(pnls.sum()),
        "return_pct": float((final / res.initial_equity - 1) * 100),
        "cagr_pct": float(cagr * 100),
        "max_dd_pct": float(-dd * 100),
        "profit_factor": float(pf),
        "win_rate_pct": float(len(wins) / len(pnls) * 100) if len(pnls) else 0.0,
        "avg_r": float(np.mean([t.r_multiple for t in res.trades])) if res.trades else 0.0,
        "sharpe": float(sharpe),
        "days_blocked": sum("daily loss" in e for e in res.risk_events),
        "halted": any("halted" in e for e in res.risk_events),
    }


def acceptance(m: dict) -> dict[str, bool]:
    return {
        f"profit_factor>{ACCEPTANCE['profit_factor']}": m["profit_factor"] > ACCEPTANCE["profit_factor"],
        f"max_dd<{ACCEPTANCE['max_drawdown']:.0%}": m["max_dd_pct"] < ACCEPTANCE["max_drawdown"] * 100,
        f"trades>={ACCEPTANCE['min_trades']}": m["trades"] >= ACCEPTANCE["min_trades"],
    }


def format_table(rows: list[dict]) -> str:
    if not rows:
        return "(no results)"
    df = pd.DataFrame(rows)
    cols = ["symbol", "strategy", "segment", "trades", "return_pct", "max_dd_pct",
            "profit_factor", "win_rate_pct", "avg_r", "sharpe", "folds", "pos_folds_pct",
            "plateau", "neighbour", "accepted"]
    return df[[c for c in cols if c in df.columns]].round(2).to_string(index=False)


def bootstrap_pf(pnls, n: int = 2000, seed: int = 0, ci: float = 0.95) -> tuple[float, float]:
    """Bootstrap confidence interval for the profit factor by resampling trades with
    replacement. Ignores serial correlation between trades, so it is if anything too narrow."""
    pnls = np.asarray(pnls, float)
    if len(pnls) < 10:
        return float("nan"), float("nan")
    rng = np.random.default_rng(seed)
    samples = pnls[rng.integers(0, len(pnls), size=(n, len(pnls)))]
    gains = np.where(samples > 0, samples, 0).sum(axis=1)
    losses = -np.where(samples < 0, samples, 0).sum(axis=1)
    pf = np.where(losses > 0, gains / np.where(losses > 0, losses, 1), np.inf)
    lo, hi = np.quantile(pf, [(1 - ci) / 2, 1 - (1 - ci) / 2])
    return float(lo), float(hi)
