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
    dd = (eq / eq.cummax() - 1).min() if len(eq) else 0.0
    daily = eq.resample("1D").last().dropna().pct_change().dropna()
    sharpe = daily.mean() / daily.std() * np.sqrt(252) if daily.std() > 0 else 0.0
    years = max((eq.index[-1] - eq.index[0]).days / 365.25, 1e-9) if len(eq) > 1 else 1e-9
    final = eq.iloc[-1] if len(eq) else res.initial_equity
    cagr = (final / res.initial_equity) ** (1 / years) - 1 if final > 0 else -1.0
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
