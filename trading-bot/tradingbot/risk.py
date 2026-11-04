"""Position sizing and account-level risk limits (shared by backtest and live)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .instruments import Instrument

KILL_SWITCH_FILE = Path(__file__).resolve().parent.parent / "KILL_SWITCH"


@dataclass
class RiskConfig:
    risk_per_trade: float = 0.0075  # fraction of equity risked per trade
    daily_loss_limit: float = 0.03  # flatten + stop for the day at -3% from day start
    max_drawdown: float = 0.20  # hard stop from equity peak
    max_open_positions: int = 4  # across all instruments
    max_per_group: int = 2  # e.g. at most 2 of NAS100/US30/ES, 2 of BTC/ETH
    max_gross_leverage: float = 5.0  # total open notional / equity, across all positions

    @classmethod
    def load(cls, path: str | Path | None) -> RiskConfig:
        if not path:
            return cls()
        data = yaml.safe_load(Path(path).read_text()) or {}
        return cls(**data.get("risk", {}))


def position_size(
    inst: Instrument,
    equity: float,
    entry_price: float,
    stop_dist: float,
    risk_fraction: float,
    quote_to_usd: float = 1.0,
) -> float:
    """Quantity such that hitting the stop loses ~risk_fraction of equity,
    capped by the instrument's max leverage. Returns 0 if not tradable."""
    if stop_dist <= 0 or equity <= 0:
        return 0.0
    usd_per_point = inst.multiplier * quote_to_usd
    qty = (equity * risk_fraction) / (stop_dist * usd_per_point)
    max_qty = equity * inst.max_leverage / (entry_price * usd_per_point)
    return inst.round_qty(min(qty, max_qty))


@dataclass
class RiskManager:
    cfg: RiskConfig
    peak_equity: float
    day_start_equity: float
    current_day: object = None
    day_blocked: bool = False
    halted: bool = False
    events: list[str] = field(default_factory=list)

    @classmethod
    def start(cls, cfg: RiskConfig, equity: float) -> RiskManager:
        return cls(cfg=cfg, peak_equity=equity, day_start_equity=equity)

    def on_new_day(self, day, equity: float) -> None:
        if day != self.current_day:
            self.current_day = day
            self.day_start_equity = equity
            self.day_blocked = False

    def update(self, equity: float, when=None) -> bool:
        """Record equity; returns True if positions must be flattened now."""
        self.peak_equity = max(self.peak_equity, equity)
        flatten = False
        if not self.halted and equity <= self.peak_equity * (1 - self.cfg.max_drawdown):
            self.halted = True
            flatten = True
            self.events.append(f"{when}: max drawdown hit, trading halted")
        if not self.day_blocked and equity <= self.day_start_equity * (1 - self.cfg.daily_loss_limit):
            self.day_blocked = True
            flatten = True
            self.events.append(f"{when}: daily loss limit hit, flat for the day")
        return flatten

    def can_open(self) -> bool:
        return not (self.halted or self.day_blocked or kill_switch_active())


def kill_switch_active() -> bool:
    """Create a file named KILL_SWITCH in trading-bot/ to block all new entries."""
    return KILL_SWITCH_FILE.exists()
