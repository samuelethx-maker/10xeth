"""Common broker interface. Every adapter is demo/paper-only by default."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..instruments import Instrument


@dataclass
class OrderResult:
    ok: bool
    order_id: str = ""
    fill_price: float | None = None
    message: str = ""


class Broker(ABC):
    name = "base"

    @abstractmethod
    def equity(self) -> float:
        """Account equity (NAV) in account currency."""

    @abstractmethod
    def position(self, inst: Instrument) -> float:
        """Signed open quantity (+long / -short / 0 flat)."""

    @abstractmethod
    def market_order(
        self, inst: Instrument, qty: float, stop: float | None = None, target: float | None = None
    ) -> OrderResult:
        """Signed market order with attached protective stop / optional target."""

    @abstractmethod
    def close(self, inst: Instrument) -> OrderResult:
        """Flatten the instrument."""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False
