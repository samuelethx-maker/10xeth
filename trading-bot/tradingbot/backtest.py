"""Bar-by-bar execution engine shared by single-instrument backtests, the portfolio
backtest and the simulated paper trader, so all three apply identical rules.

Execution model (deliberately conservative):
  * signals from bar i's close are filled at bar i+1's open
  * buys pay half the spread + slippage, sells receive half the spread - slippage
  * stops/targets are checked against each bar's high/low; if both are touched in
    the same bar the stop is assumed to fill first; gaps through a stop fill at the open
  * commissions charged on entry and exit
  * financing / funding charged on notional for the time a position is held
Position size is based on realised cash, not open P&L.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from .instruments import Instrument, get_instrument
from .risk import RiskConfig, RiskManager, position_size

HOURS_PER_YEAR = 24 * 365


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
    financing: float = 0.0
    exit_reason: str = ""

    @property
    def r_multiple(self) -> float:
        return self.pnl / self.risk_usd if self.risk_usd else 0.0

    def to_dict(self) -> dict:
        d = asdict(self)
        for k in ("entry_time", "exit_time"):
            d[k] = d[k].isoformat() if d[k] is not None else None
        d["target"] = None if np.isnan(self.target) else self.target
        return d

    @classmethod
    def from_dict(cls, d: dict) -> Trade:
        d = dict(d)
        for k in ("entry_time", "exit_time"):
            d[k] = pd.Timestamp(d[k]) if d[k] else None
        d["target"] = np.nan if d["target"] is None else d["target"]
        return cls(**d)


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


def _quote_to_usd(inst: Instrument, price: float, usdjpy: float | None) -> float:
    if inst.quote_ccy == "USD":
        return 1.0
    if inst.symbol == "USDJPY":
        return 1.0 / price
    if usdjpy is None or np.isnan(usdjpy):
        raise ValueError(f"{inst.symbol} needs a quote->USD rate (e.g. --usdjpy 150)")
    return 1.0 / usdjpy


def _usdjpy_for(inst: Instrument, index: pd.DatetimeIndex, usdjpy) -> np.ndarray | None:
    """Per-bar USDJPY known at each bar's open, for JPY-quoted crosses (GBPJPY).
    An explicit Series wins; otherwise cached USDJPY bar *opens* are used when they
    cover the period (opens are known at bar start, so this is causal); a float is
    the fallback for anything not covered."""
    if inst.quote_ccy != "JPY" or inst.symbol == "USDJPY":
        return None
    fallback = None if isinstance(usdjpy, pd.Series) or usdjpy is None else float(usdjpy)
    ref = usdjpy if isinstance(usdjpy, pd.Series) else _cached_usdjpy()
    if ref is None or ref.empty or ref.index[-1] < index[-1] - pd.Timedelta(days=4):
        # No (fresh) reference: let the engine's running rate / fallback apply.
        return None if fallback is None else np.full(len(index), fallback)
    fx = ref.sort_index().reindex(index, method="ffill")
    if fallback is not None:
        fx = fx.fillna(fallback)
    return fx.bfill().to_numpy(float)


_USDJPY_CACHE: dict[str, pd.Series | None] = {}


def _cached_usdjpy() -> pd.Series | None:
    """Daily + hourly USDJPY opens from the local data cache (hourly wins where both exist)."""
    if "s" not in _USDJPY_CACHE:
        from . import data  # local import: data is optional for pure-engine use

        parts = []
        for interval in ("1d", "1h"):
            df = data.load_symbol("USDJPY", "", interval)
            if df is not None:
                parts.append(df["open"])
        if parts:
            s = pd.concat(parts)
            _USDJPY_CACHE["s"] = s[~s.index.duplicated(keep="last")].sort_index()
        else:
            _USDJPY_CACHE["s"] = None
    return _USDJPY_CACHE["s"]


def financing_per_bar(
    inst: Instrument, index: pd.DatetimeIndex, funding: pd.Series | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """Fraction of notional charged at bar i to a position held since bar i-1
    (long, short). Uses elapsed time, so weekends are charged too. With a funding
    series (crypto perps), the actual 8h funding events in (t[i-1], t[i]] are used."""
    # Unit-agnostic on purpose: DatetimeIndex resolution may be s/ms/us/ns.
    if funding is not None and len(funding):
        f = funding[(funding.index > index[0]) & (funding.index <= index[-1])]
        pos = index.searchsorted(f.index, side="left")
        long_ = np.bincount(pos, weights=f.to_numpy(), minlength=len(index))[: len(index)]
        return long_, -long_
    secs = (index - index[0]).total_seconds().to_numpy()
    hours = np.diff(secs, prepend=0.0) / 3600
    return inst.financing_long * hours / HOURS_PER_YEAR, inst.financing_short * hours / HOURS_PER_YEAR


@dataclass
class Leg:
    """One instrument's bars + signals, as numpy arrays for speed."""

    inst: Instrument
    times: pd.DatetimeIndex
    o: np.ndarray
    h: np.ndarray
    l: np.ndarray
    c: np.ndarray
    entry: np.ndarray
    exit_l: np.ndarray
    exit_s: np.ndarray
    stop_d: np.ndarray
    tgt_d: np.ndarray
    fin_l: np.ndarray
    fin_s: np.ndarray
    usdjpy: np.ndarray | None = None  # optional per-bar USDJPY for JPY-quoted P&L

    @classmethod
    def build(
        cls,
        inst: Instrument,
        bars: pd.DataFrame,
        signals: pd.DataFrame,
        funding: pd.Series | None = None,
        financing: bool = True,
        usdjpy: pd.Series | float | None = None,
    ) -> Leg:
        if financing:
            fl, fs = financing_per_bar(inst, bars.index, funding)
        else:
            fl = fs = np.zeros(len(bars))
        fx = _usdjpy_for(inst, bars.index, usdjpy)
        return cls(
            inst, bars.index,
            *(bars[k].to_numpy(float) for k in ("open", "high", "low", "close")),
            signals["entry"].to_numpy(), signals["exit_long"].to_numpy(bool),
            signals["exit_short"].to_numpy(bool), signals["stop_dist"].to_numpy(float),
            signals["target_dist"].to_numpy(float), fl, fs, fx,
        )


    def slice(self, mask) -> Leg:
        """Sub-range that keeps financing computed over the full history, so the
        first bar of the slice still carries its accrued financing."""
        d = {k: (v[mask] if isinstance(v, (np.ndarray, pd.DatetimeIndex)) else v)
             for k, v in self.__dict__.items()}
        return Leg(**d)


class Engine:
    """Account state + rules. Feed bars with step(); serialisable for paper trading."""

    def __init__(self, risk: RiskConfig | None = None, equity: float = 100_000.0,
                 usdjpy: float = 150.0, record_equity: bool = True):
        self.risk = risk or RiskConfig()
        self.initial_equity = equity
        self.cash = equity
        self.rm = RiskManager.start(self.risk, equity)
        self.pos: dict[str, Trade] = {}
        self.pending_exit: set[str] = set()
        self.pending_entry: dict[str, tuple[int, float, float]] = {}
        self.last_close: dict[str, float] = {}
        self.usdjpy = usdjpy
        self.trades: list[Trade] = []
        self.record_equity = record_equity
        self.eq_times: list[pd.Timestamp] = []
        self.eq_values: list[float] = []

    # ----------------------------------------------------------- helpers
    def _q2u(self, leg: Leg, i: int, price: float) -> float:
        fx = leg.usdjpy[i] if leg.usdjpy is not None else self.usdjpy
        return _quote_to_usd(leg.inst, price, fx)

    def _pnl(self, inst: Instrument, t: Trade, price: float, q2u: float) -> float:
        return (price - t.entry_price) * t.direction * t.qty * inst.multiplier * q2u

    def _commission(self, inst: Instrument, qty: float, price: float, q2u: float) -> float:
        return inst.commission_per_qty * qty + inst.commission_pct * qty * price * inst.multiplier * q2u

    def _usd_mark(self, sym: str, price: float) -> float:
        t = self.pos[sym]
        inst = get_instrument(sym)
        if inst.quote_ccy == "USD":
            q2u = 1.0
        elif sym == "USDJPY":
            q2u = 1.0 / price
        else:
            q2u = 1.0 / self.usdjpy
        return self._pnl(inst, t, price, q2u)

    def equity(self, prices: dict[str, float] | None = None) -> float:
        prices = prices or {}
        return self.cash + sum(
            self._usd_mark(s, prices.get(s, self.last_close.get(s, t.entry_price)))
            for s, t in self.pos.items()
        )

    def gross_notional(self, prices: dict[str, float] | None = None) -> float:
        """Sum of |position value| in USD across open positions."""
        prices = prices or {}
        total = 0.0
        for s, t in self.pos.items():
            inst = get_instrument(s)
            px = prices.get(s, self.last_close.get(s, t.entry_price))
            q2u = 1.0 if inst.quote_ccy == "USD" else (1.0 / px if s == "USDJPY" else 1.0 / self.usdjpy)
            total += abs(t.qty * px * inst.multiplier * q2u)
        return total

    def _slots_ok(self, inst: Instrument) -> bool:
        if len(self.pos) >= self.risk.max_open_positions:
            return False
        if inst.group:
            same = sum(get_instrument(s).group == inst.group for s in self.pos)
            if same >= self.risk.max_per_group:
                return False
        return True

    def _close(self, leg: Leg, i: int, raw_price: float, reason: str) -> None:
        sym = leg.inst.symbol
        t = self.pos.pop(sym)
        half = leg.inst.spread / 2 + leg.inst.slippage
        fill = raw_price - t.direction * half
        q2u = self._q2u(leg, i, fill)
        gross = self._pnl(leg.inst, t, fill, q2u)
        cost = self._commission(leg.inst, t.qty, fill, q2u)
        t.pnl += gross - cost
        self.cash += gross - cost
        t.exit_time, t.exit_price, t.exit_reason = leg.times[i], fill, reason
        self.trades.append(t)

    # -------------------------------------------------------------- step
    def step(self, t: pd.Timestamp, rows: list[tuple[Leg, int]]) -> None:
        """Process every leg that has a bar starting at time t."""
        opens = {leg.inst.symbol: leg.o[i] for leg, i in rows}
        self.rm.on_new_day(t.normalize(), self.equity(opens))

        # 0) financing for positions carried into this bar
        for leg, i in rows:
            p = self.pos.get(leg.inst.symbol)
            if p is not None:
                rate = leg.fin_l[i] if p.direction == 1 else leg.fin_s[i]
                if rate:
                    px = leg.o[i]
                    cost = rate * p.qty * px * leg.inst.multiplier * self._q2u(leg, i, px)
                    self.cash -= cost
                    p.pnl -= cost
                    p.financing += cost

        # 1) actions decided at the previous close, filled at this open
        for leg, i in rows:
            sym = leg.inst.symbol
            if sym in self.pending_exit and sym in self.pos:
                self._close(leg, i, leg.o[i], "signal")
            self.pending_exit.discard(sym)
        for leg, i in rows:
            sym, inst = leg.inst.symbol, leg.inst
            pe = self.pending_entry.pop(sym, None)
            if pe is None or sym in self.pos or not self.rm.can_open() or not self._slots_ok(inst):
                continue
            d, sd, td = pe
            half = inst.spread / 2 + inst.slippage
            fill = leg.o[i] + d * half
            q2u = self._q2u(leg, i, fill)
            qty = position_size(inst, self.cash, fill, sd, self.risk.risk_per_trade, q2u)
            room = self.risk.max_gross_leverage * self.equity(opens) - self.gross_notional(opens)
            unit_notional = fill * inst.multiplier * q2u
            if qty * unit_notional > room:
                qty = inst.round_qty(max(room, 0.0) / unit_notional)
            if qty > 0:
                cost = self._commission(inst, qty, fill, q2u)
                self.cash -= cost
                self.pos[sym] = Trade(
                    sym, d, qty, leg.times[i], fill,
                    stop=fill - d * sd,
                    target=fill + d * td if not np.isnan(td) else np.nan,
                    risk_usd=sd * qty * inst.multiplier * q2u,
                    pnl=-cost,
                )

        # 2) intrabar stop / target
        for leg, i in rows:
            p = self.pos.get(leg.inst.symbol)
            if p is None:
                continue
            d = p.direction
            o, h, l = leg.o[i], leg.h[i], leg.l[i]
            stop_hit = (l <= p.stop) if d == 1 else (h >= p.stop)
            tgt_hit = not np.isnan(p.target) and ((h >= p.target) if d == 1 else (l <= p.target))
            if stop_hit:
                gapped = (o <= p.stop) if d == 1 else (o >= p.stop)
                self._close(leg, i, o if gapped else p.stop, "stop")
            elif tgt_hit:
                gapped = (o >= p.target) if d == 1 else (o <= p.target)
                self._close(leg, i, o if gapped else p.target, "target")

        # 3) end of bar: mark, risk checks, then read signals for the next open
        for leg, i in rows:
            self.last_close[leg.inst.symbol] = leg.c[i]
            if leg.inst.symbol == "USDJPY":
                self.usdjpy = leg.c[i]
            elif leg.usdjpy is not None:
                self.usdjpy = leg.usdjpy[i]
        eq = self.equity()
        if self.record_equity:
            self.eq_times.append(t)
            self.eq_values.append(eq)
        flatten = self.rm.update(eq, t)
        if flatten:
            self.pending_exit.update(self.pos)
            self.pending_entry.clear()
        for leg, i in rows:
            sym = leg.inst.symbol
            p = self.pos.get(sym)
            if p is not None and ((p.direction == 1 and leg.exit_l[i]) or (p.direction == -1 and leg.exit_s[i])):
                self.pending_exit.add(sym)
            e = leg.entry[i]
            # A risk limit that just tripped must not leave entries queued for the
            # next open (which may fall on a new day after the daily block resets).
            if flatten or e == 0 or np.isnan(leg.stop_d[i]):
                continue
            exiting = sym in self.pending_exit
            if p is None or exiting or p.direction != e:
                if p is not None and p.direction != e:
                    self.pending_exit.add(sym)  # reverse
                self.pending_entry[sym] = (int(e), float(leg.stop_d[i]), float(leg.tgt_d[i]))

    def close_all(self, rows: list[tuple[Leg, int]], reason: str = "end") -> None:
        for leg, i in rows:
            if leg.inst.symbol in self.pos:
                self._close(leg, i, leg.c[i], reason)
        if self.record_equity and self.eq_values:
            self.eq_values[-1] = self.equity()

    def equity_series(self) -> pd.Series:
        return pd.Series(self.eq_values, index=pd.DatetimeIndex(self.eq_times), name="equity", dtype=float)

    # ---------------------------------------------------- serialisation
    def to_dict(self) -> dict:
        rm = self.rm
        return {
            "initial_equity": self.initial_equity,
            "cash": self.cash,
            "usdjpy": None if not np.isfinite(self.usdjpy) else self.usdjpy,
            "positions": {s: t.to_dict() for s, t in self.pos.items()},
            "pending_exit": sorted(self.pending_exit),
            "pending_entry": {s: [d, sd, None if np.isnan(td) else td] for s, (d, sd, td) in self.pending_entry.items()},
            "last_close": self.last_close,
            "risk_state": {
                "peak_equity": rm.peak_equity, "day_start_equity": rm.day_start_equity,
                "current_day": rm.current_day.isoformat() if rm.current_day is not None else None,
                "day_blocked": rm.day_blocked, "halted": rm.halted,
            },
        }

    @classmethod
    def from_dict(cls, d: dict, risk: RiskConfig) -> Engine:
        e = cls(risk, d["initial_equity"], np.nan if d["usdjpy"] is None else d["usdjpy"], record_equity=False)
        e.cash = d["cash"]
        e.pos = {s: Trade.from_dict(t) for s, t in d["positions"].items()}
        e.pending_exit = set(d["pending_exit"])
        e.pending_entry = {s: (v[0], v[1], np.nan if v[2] is None else v[2]) for s, v in d["pending_entry"].items()}
        e.last_close = d["last_close"]
        rs = d["risk_state"]
        e.rm.peak_equity, e.rm.day_start_equity = rs["peak_equity"], rs["day_start_equity"]
        e.rm.current_day = pd.Timestamp(rs["current_day"]) if rs["current_day"] else None
        e.rm.day_blocked, e.rm.halted = rs["day_blocked"], rs["halted"]
        return e


def run_legs(legs: list[Leg], engine: Engine, close_at_end: bool = True,
             after: pd.Timestamp | None = None) -> Engine:
    """Drive the engine over the union of all legs' bar times (optionally only times > after)."""
    if not legs:
        return engine
    all_times = legs[0].times
    for leg in legs[1:]:
        all_times = all_times.union(leg.times)
    if after is not None:
        all_times = all_times[all_times > after]
    idx = [leg.times.get_indexer(all_times) for leg in legs]
    last_rows: dict[str, tuple[Leg, int]] = {}
    for k, t in enumerate(all_times):
        rows = [(leg, int(ix[k])) for leg, ix in zip(legs, idx, strict=True) if ix[k] >= 0]
        for r in rows:
            last_rows[r[0].inst.symbol] = r
        engine.step(t, rows)
    if close_at_end:
        engine.close_all(list(last_rows.values()))
    return engine


def run_backtest(
    bars: pd.DataFrame,
    signals: pd.DataFrame,
    inst: Instrument,
    initial_equity: float = 100_000.0,
    risk: RiskConfig | None = None,
    usd_quote_rate: float | pd.Series | None = None,
    strategy_name: str = "",
    funding: pd.Series | None = None,
    financing: bool = True,
) -> BacktestResult:
    """Single instrument, single strategy."""
    risk = risk or RiskConfig()
    leg = Leg.build(inst, bars, signals, funding, financing, usd_quote_rate)
    eng = Engine(risk, initial_equity, usdjpy=np.nan)
    run_legs([leg], eng)
    return BacktestResult(inst.symbol, strategy_name, eng.trades, eng.equity_series(),
                          initial_equity, eng.rm.events)


def run_portfolio(
    legs: list[Leg], initial_equity: float = 100_000.0, risk: RiskConfig | None = None,
    usdjpy: float = 150.0,
) -> BacktestResult:
    eng = Engine(risk or RiskConfig(), initial_equity, usdjpy=usdjpy)
    run_legs(legs, eng)
    return BacktestResult("PORTFOLIO", "+".join(sorted({l.inst.symbol for l in legs})),
                          eng.trades, eng.equity_series(), initial_equity, eng.rm.events)
