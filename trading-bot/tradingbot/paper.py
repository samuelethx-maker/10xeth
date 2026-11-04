"""Simulated paper trader: live free prices, the same engine as the backtests,
simulated fills. No broker account needed.

Each tick:
  1. fetch recent 1h bars (Binance public API for crypto, Yahoo for the rest)
  2. build closed bars at the configured timeframe
  3. re-fit each instrument's parameters every `refit_days` on the last
     `train_days`, using exactly the walk-forward selection rule
  4. feed only bars newer than the last processed one into the persisted Engine
  5. append trades / equity, write a markdown report

The first tick only initialises (no historical replay). Run it every bar, e.g.
`tradingbot paper --loop`, or with cron at 15 minutes past every 4th hour.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
import yaml

from . import data
from .backtest import Engine, Leg, Trade, run_legs
from .instruments import Instrument, get_instrument
from .risk import RiskConfig, kill_switch_active
from .strategies import STRATEGIES
from .walkforward import GRIDS, _grid, bars_per_day, resample, select_params, strategy_signals

ROOT = Path(__file__).resolve().parent.parent
TF_DELTA = {"1h": pd.Timedelta(hours=1), "4h": pd.Timedelta(hours=4), "1D": pd.Timedelta(days=1)}


@dataclass
class PaperConfig:
    legs: list[str]
    strategy: str = "trend"
    timeframe: str = "4h"
    long_only: bool = False
    equity: float = 100_000.0
    train_days: int = 365
    refit_days: int = 90
    history_days: int = 540
    state_dir: str = "results/paper"
    delay_minutes: int = 15  # wait after bar close for delayed feeds
    risk: RiskConfig = field(default_factory=RiskConfig)

    @classmethod
    def load(cls, path: str | Path) -> PaperConfig:
        d = yaml.safe_load(Path(path).read_text()) or {}
        risk = RiskConfig(**d.pop("risk", {}))
        return cls(risk=risk, **d)

    @property
    def dir(self) -> Path:
        p = Path(self.state_dir)
        return p if p.is_absolute() else ROOT / p


def fetch_live(inst: Instrument, days: int) -> pd.DataFrame:
    if inst.broker == "binance":
        return data.download_binance(inst.broker_symbol, "1h", days)
    return data.download_yahoo(inst.yahoo, "1h", f"{min(days, 729)}d")


def fetch_funding(inst: Instrument, start: pd.Timestamp) -> pd.Series | None:
    if inst.broker != "binance":
        return None
    return data.download_funding(inst.broker_symbol, start.strftime("%Y-%m-%d"))


def closed_bars(bars_1h: pd.DataFrame, timeframe: str, now: pd.Timestamp) -> pd.DataFrame:
    bars = bars_1h if timeframe == "1h" else resample(bars_1h, timeframe)
    return bars[bars.index + TF_DELTA[timeframe] <= now]


class PaperTrader:
    def __init__(self, cfg: PaperConfig,
                 fetch: Callable[[Instrument, int], pd.DataFrame] = fetch_live,
                 fetch_fund: Callable[[Instrument, pd.Timestamp], pd.Series | None] = fetch_funding,
                 log: Callable[[str], None] = print):
        self.cfg = cfg
        self.fetch, self.fetch_fund, self.log = fetch, fetch_fund, log
        self.cfg.dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.cfg.dir / "state.json"
        self.state = self._load()

    # ------------------------------------------------------------ state
    def _load(self) -> dict:
        if self.state_path.exists():
            s = json.loads(self.state_path.read_text())
            s["engine_obj"] = Engine.from_dict(s["engine"], self.cfg.risk)
            return s
        return {"started": None, "last_time": {}, "params": {},
                "engine_obj": Engine(self.cfg.risk, self.cfg.equity)}

    def _save(self) -> None:
        s = {k: v for k, v in self.state.items() if k != "engine_obj"}
        s["engine"] = self.state["engine_obj"].to_dict()
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(s, indent=2, default=str))
        tmp.replace(self.state_path)

    def _append_csv(self, name: str, df: pd.DataFrame) -> None:
        if df.empty:
            return
        p = self.cfg.dir / name
        df.to_csv(p, mode="a", header=not p.exists(), index=False)

    # ------------------------------------------------------------- tick
    def _params_for(self, sym: str, inst: Instrument, bars: pd.DataFrame,
                    funding: pd.Series | None, now: pd.Timestamp) -> dict | None:
        cur = self.state["params"].get(sym)
        if cur and now - pd.Timestamp(cur["fitted_at"]) < pd.Timedelta(days=self.cfg.refit_days):
            return cur["params"]
        train = int(self.cfg.train_days * bars_per_day(bars))
        if len(bars) < train:
            self.log(f"[{sym}] only {len(bars)} bars, need {train} to fit; not trading yet")
            return None
        grid = GRIDS[self.cfg.strategy]
        combos = _grid(grid)
        sigs = strategy_signals(self.cfg.strategy, combos, bars, self.cfg.long_only)
        usdjpy = self.state["engine_obj"].usdjpy
        sel = select_params(bars, slice(len(bars) - train, len(bars)), inst, sigs, combos, grid,
                            self.cfg.risk, self.cfg.equity, funding=funding,
                            usd_quote_rate=usdjpy if np.isfinite(usdjpy) else 150.0)
        self.state["params"][sym] = {"params": sel["params"], "fitted_at": now.isoformat(),
                                     "train_score": sel["score"], "plateau": sel["plateau"]}
        self.log(f"[{sym}] refit -> {sel['params']} (score {sel['score']:.2f}, plateau {sel['plateau']:.2f})")
        return sel["params"]

    def tick(self, now: pd.Timestamp | None = None) -> dict:
        now = now or pd.Timestamp.now(tz="UTC")
        eng: Engine = self.state["engine_obj"]
        eng.record_equity = True
        eng.trades, eng.eq_times, eng.eq_values = [], [], []
        cls = STRATEGIES[self.cfg.strategy]
        new_legs: list[Leg] = []
        for sym in self.cfg.legs:
            inst = get_instrument(sym)
            try:
                bars = closed_bars(self.fetch(inst, self.cfg.history_days), self.cfg.timeframe, now)
                funding = self.fetch_fund(inst, bars.index[0])
            except Exception as e:
                self.log(f"[{sym}] data fetch failed, skipping this tick: {e}")
                continue
            if bars.empty:
                continue
            params = self._params_for(sym, inst, bars, funding, now)
            if params is None:
                sig = cls.empty_signals(bars.index)
                sig["exit_long"] = sig["exit_short"] = True
            else:
                sig = strategy_signals(self.cfg.strategy, [params], bars, self.cfg.long_only)[0]
            last = self.state["last_time"].get(sym)
            self.state["last_time"][sym] = bars.index[-1].isoformat()
            if last is None:
                continue  # first sight of this instrument: start from the next bar
            mask = bars.index > pd.Timestamp(last)
            if not mask.any():
                continue
            new_legs.append(Leg.build(inst, bars[mask], sig[mask], funding))

        if self.state["started"] is None:
            self.state["started"] = now.isoformat()
        run_legs(new_legs, eng, close_at_end=False)
        self._append_csv("trades.csv", pd.DataFrame([t.to_dict() for t in eng.trades]))
        self._append_csv("equity.csv", pd.DataFrame({"time": eng.eq_times, "equity": eng.eq_values}))
        for t in eng.trades:
            self.log(f"[trade] {t.symbol} {'LONG' if t.direction == 1 else 'SHORT'} closed "
                     f"({t.exit_reason}) pnl {t.pnl:+,.2f}")
        for e in eng.rm.events:
            self.log(f"[risk] {e}")
        eng.rm.events.clear()
        self._save()
        summary = {"now": now, "new_bars": sum(len(l.times) for l in new_legs),
                   "closed_trades": len(eng.trades), "equity": eng.equity(),
                   "open": list(eng.pos), "pending": list(eng.pending_entry)}
        self.write_report(now)
        return summary

    # ----------------------------------------------------------- report
    def write_report(self, now: pd.Timestamp) -> str:
        eng: Engine = self.state["engine_obj"]
        eq = eng.equity()
        rm = eng.rm
        lines = [
            f"# Paper trading report — {now:%Y-%m-%d %H:%M} UTC",
            "",
            "Simulated fills on free price feeds; not broker executions.",
            "",
            f"- Started: {self.state['started']}",
            f"- Equity: **${eq:,.2f}** (start ${eng.initial_equity:,.0f}, "
            f"{(eq / eng.initial_equity - 1) * 100:+.2f}%)",
            f"- Today: {(eq / rm.day_start_equity - 1) * 100:+.2f}% · "
            f"drawdown from peak: {(1 - eq / rm.peak_equity) * 100:.2f}%",
            f"- Risk state: {'HALTED (max drawdown)' if rm.halted else 'blocked for the day' if rm.day_blocked else 'normal'}"
            f"{' · KILL SWITCH ON' if kill_switch_active() else ''}",
            "",
            "## Open positions",
        ]
        if eng.pos:
            lines += ["| Symbol | Side | Qty | Entry | Stop | Last | Unrealised $ |", "|---|---|---:|---:|---:|---:|---:|"]
            for s, t in eng.pos.items():
                last = eng.last_close.get(s, t.entry_price)
                lines.append(f"| {s} | {'long' if t.direction == 1 else 'short'} | {t.qty:g} | {t.entry_price:.5g} | "
                             f"{t.stop:.5g} | {last:.5g} | {eng._usd_mark(s, last):+,.2f} |")
        else:
            lines.append("None.")
        if eng.pending_entry:
            lines += ["", "Pending entries at next bar open: " + ", ".join(
                f"{s} {'long' if v[0] == 1 else 'short'}" for s, v in eng.pending_entry.items())]
        p = self.cfg.dir / "trades.csv"
        lines += ["", "## Closed trades"]
        if p.exists():
            tr = pd.read_csv(p)
            wins = (tr["pnl"] > 0).mean() * 100 if len(tr) else 0
            lines.append(f"{len(tr)} trades · win rate {wins:.0f}% · net ${tr['pnl'].sum():+,.2f}")
            lines += ["", "| Symbol | Side | Entry time | Exit time | Reason | P&L $ |", "|---|---|---|---|---|---:|"]
            for _, r in tr.tail(10).iloc[::-1].iterrows():
                lines.append(f"| {r.symbol} | {'long' if r.direction == 1 else 'short'} | {r.entry_time} | "
                             f"{r.exit_time} | {r.exit_reason} | {r.pnl:+,.2f} |")
        else:
            lines.append("None yet.")
        lines += ["", "## Parameters", "| Symbol | Params | Fitted | Next refit |", "|---|---|---|---|"]
        for s in self.cfg.legs:
            pinfo = self.state["params"].get(s)
            if pinfo:
                nxt = pd.Timestamp(pinfo["fitted_at"]) + pd.Timedelta(days=self.cfg.refit_days)
                lines.append(f"| {s} | {pinfo['params'] or 'no tradable params'} | {pinfo['fitted_at'][:10]} | {nxt:%Y-%m-%d} |")
        text = "\n".join(lines) + "\n"
        (self.cfg.dir / "report.md").write_text(text)
        return text

    def loop(self) -> None:
        delta = TF_DELTA[self.cfg.timeframe]
        while True:
            try:
                s = self.tick()
                self.log(f"[tick] {s['now']:%Y-%m-%d %H:%M} new bars {s['new_bars']}, equity ${s['equity']:,.2f}, "
                         f"open {s['open']}")
            except Exception as e:  # keep the loop alive; next tick retries
                self.log(f"[error] tick failed: {e}")
            now = pd.Timestamp.now(tz="UTC")
            nxt = now.floor(delta) + delta + pd.Timedelta(minutes=self.cfg.delay_minutes)
            time.sleep(max(30.0, (nxt - now).total_seconds()))
