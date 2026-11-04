"""Bar-by-bar backtester for one instrument / one strategy.

Execution model (deliberately conservative):
  * signals from bar i's close are filled at bar i+1's open
  * buys pay half the spread + slippage, sells receive half the spread - slippage
  * stops/targets are checked against each bar's high/low; if both are touched in
    the same bar the stop is assumed to fill first; gaps through a stop fill at the open
  * commissions charged on entry and exit
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .instruments import Instrument
from .risk import RiskConfig, RiskManager, position_size


@dataclass
class Trade:
    symbol: str
    direction: int
    qty: float
    entry_time: pd.Timestamp
    entry_price: float
    stop: float
    target: float
    risk_usd: float
    exit_time: pd.Timestamp | None = None
    exit_price: float | None = None
    pnl: float = 0.0
    exit_reason: str = ""

    @property
    def r_multiple(self) -> float:
        return self.pnl / self.risk_usd if self.risk_usd else 0.0


@dataclass
class BacktestResult:
    symbol: str
    strategy: str
    trades: list[Trade]
    equity: pd.Series
    initial_equity: float
    risk_events: list[str] = field(default_factory=list)

    def trades_frame(self) -> pd.DataFrame:
        return pd.DataFrame([{**t.__dict__, "r_multiple": t.r_multiple} for t in self.trades])


def _quote_to_usd(inst: Instrument, price: float, fx: float | None) -> float:
    if inst.quote_ccy == "USD":
        return 1.0
    if inst.symbol == "USDJPY":
        return 1.0 / price
    if fx is None:
        raise ValueError(f"{inst.symbol} needs a quote->USD rate (e.g. --usdjpy 150)")
    return 1.0 / fx  # fx given as USD/quote, e.g. USDJPY


def run_backtest(
    bars: pd.DataFrame,
    signals: pd.DataFrame,
    inst: Instrument,
    initial_equity: float = 100_000.0,
    risk: RiskConfig | None = None,
    usd_quote_rate: float | pd.Series | None = None,
    strategy_name: str = "",
) -> BacktestResult:
    risk = risk or RiskConfig()
    rm = RiskManager.start(risk, initial_equity)
    o, h, l, c = (bars[k].to_numpy() for k in ("open", "high", "low", "close"))
    times = bars.index
    days = times.normalize()
    entry_sig = signals["entry"].to_numpy()
    exit_l = signals["exit_long"].to_numpy()
    exit_s = signals["exit_short"].to_numpy()
    stop_d = signals["stop_dist"].to_numpy()
    tgt_d = signals["target_dist"].to_numpy()
    if isinstance(usd_quote_rate, pd.Series):
        fx_arr = usd_quote_rate.reindex(times, method="ffill").to_numpy()
    else:
        fx_arr = np.full(len(bars), usd_quote_rate if usd_quote_rate is not None else np.nan)

    half = inst.spread / 2 + inst.slippage
    cash = initial_equity
    pos: Trade | None = None
    trades: list[Trade] = []
    equity = np.empty(len(bars))
    pending_exit = False
    pending_entry: tuple[int, float, float] | None = None

    def q2u(i: int, price: float) -> float:
        fx = fx_arr[i]
        return _quote_to_usd(inst, price, None if np.isnan(fx) else fx)

    def commission(qty: float, price: float, i: int) -> float:
        return inst.commission_per_qty * qty + inst.commission_pct * qty * price * inst.multiplier * q2u(i, price)

    def close_pos(i: int, raw_price: float, reason: str, already_filled: bool = False) -> None:
        nonlocal cash, pos
        assert pos is not None
        fill = raw_price if already_filled else raw_price - pos.direction * half
        gross = (fill - pos.entry_price) * pos.direction * pos.qty * inst.multiplier * q2u(i, fill)
        cost = commission(pos.qty, fill, i)
        pos.pnl += gross - cost
        cash += gross - cost
        pos.exit_time, pos.exit_price, pos.exit_reason = times[i], fill, reason
        trades.append(pos)
        pos = None

    def mark(i: int, price: float) -> float:
        if pos is None:
            return cash
        return cash + (price - pos.entry_price) * pos.direction * pos.qty * inst.multiplier * q2u(i, price)

    for i in range(len(bars)):
        rm.on_new_day(days[i], mark(i, o[i]))

        # 1) actions decided at the previous close, filled at this open
        if pending_exit and pos is not None:
            close_pos(i, o[i], "signal")
        pending_exit = False
        if pending_entry and pos is None and rm.can_open():
            d, sd, td = pending_entry
            fill = o[i] + d * half
            qty = position_size(inst, cash, fill, sd, risk.risk_per_trade, q2u(i, fill))
            if qty > 0:
                cost = commission(qty, fill, i)
                cash -= cost
                pos = Trade(
                    inst.symbol, d, qty, times[i], fill,
                    stop=fill - d * sd,
                    target=fill + d * td if not np.isnan(td) else np.nan,
                    risk_usd=sd * qty * inst.multiplier * q2u(i, fill),
                    pnl=-cost,
                )
        pending_entry = None

        # 2) intrabar stop / target
        if pos is not None:
            d = pos.direction
            stop_hit = (l[i] <= pos.stop) if d == 1 else (h[i] >= pos.stop)
            tgt_hit = not np.isnan(pos.target) and ((h[i] >= pos.target) if d == 1 else (l[i] <= pos.target))
            if stop_hit:
                gapped = (o[i] <= pos.stop) if d == 1 else (o[i] >= pos.stop)
                close_pos(i, o[i] if gapped else pos.stop, "stop")
            elif tgt_hit:
                gapped = (o[i] >= pos.target) if d == 1 else (o[i] <= pos.target)
                close_pos(i, o[i] if gapped else pos.target, "target")

        # 3) end of bar: risk checks, then read signals for the next open
        equity[i] = mark(i, c[i])
        if rm.update(equity[i], times[i]) and pos is not None:
            pending_exit = True
        if pos is not None and ((pos.direction == 1 and exit_l[i]) or (pos.direction == -1 and exit_s[i])):
            pending_exit = True
        e = entry_sig[i]
        if e != 0 and not np.isnan(stop_d[i]) and (pos is None or pending_exit or pos.direction != e):
            if pos is not None and pos.direction != e:
                pending_exit = True  # reverse
            pending_entry = (int(e), float(stop_d[i]), float(tgt_d[i]))

    if pos is not None:
        close_pos(len(bars) - 1, c[-1], "end")
        equity[-1] = cash

    return BacktestResult(
        symbol=inst.symbol,
        strategy=strategy_name,
        trades=trades,
        equity=pd.Series(equity, index=times, name="equity"),
        initial_equity=initial_equity,
        risk_events=rm.events,
    )
