"""In-memory broker for dry runs and tests (no network)."""

from __future__ import annotations

import itertools

from ..instruments import Instrument
from .base import Broker, OrderResult


class PaperBroker(Broker):
    name = "paper"

    def __init__(self, equity: float = 100_000.0):
        self._cash = equity
        self._positions: dict[str, dict] = {}
        self._prices: dict[str, float] = {}
        self._ids = itertools.count(1)

    def set_price(self, inst: Instrument, price: float) -> None:
        self._prices[inst.symbol] = price

    def equity(self) -> float:
        unreal = sum(
            (self._prices[s] - p["price"]) * p["qty"] * p["mult"] for s, p in self._positions.items()
        )
        return self._cash + unreal

    def position(self, inst: Instrument) -> float:
        return self._positions.get(inst.symbol, {}).get("qty", 0.0)

    def market_order(self, inst, qty, stop=None, target=None) -> OrderResult:
        price = self._prices.get(inst.symbol)
        if price is None:
            return OrderResult(False, message="no price set")
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        if self.position(inst):
            return OrderResult(False, message="position already open")
        self._positions[inst.symbol] = {
            "qty": qty, "price": price, "mult": inst.multiplier, "stop": stop, "target": target,
        }
        return OrderResult(True, str(next(self._ids)), price)

    def close(self, inst) -> OrderResult:
        p = self._positions.pop(inst.symbol, None)
        if p is None:
            return OrderResult(True, message="already flat")
        price = self._prices[inst.symbol]
        self._cash += (price - p["price"]) * p["qty"] * p["mult"]
        return OrderResult(True, str(next(self._ids)), price)
