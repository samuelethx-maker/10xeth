"""Interactive Brokers adapter for CME ES futures via TWS / IB Gateway (paper).

Requires `pip install -e .[ibkr]` and a running paper TWS (port 7497) or
IB Gateway (port 4002) with API access enabled.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pandas as pd

from ..instruments import Instrument, get_instrument
from .base import Broker, OrderResult

PAPER_PORTS = {7497, 4002}


class IBKRBroker(Broker):
    name = "ibkr"

    def __init__(self, host: str = "127.0.0.1", port: int = 7497, client_id: int = 17):
        if port not in PAPER_PORTS and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError(f"Refusing non-paper IBKR port {port} (prototype is demo-only)")
        try:
            from ib_async import IB
        except ImportError:
            raise RuntimeError("ib_async not installed: pip install -e '.[ibkr]'") from None
        self.ib = IB()
        self.ib.connect(host, port, clientId=client_id)
        self._contracts: dict[str, object] = {}

    @classmethod
    def from_env(cls) -> IBKRBroker:
        return cls(
            os.environ.get("IBKR_HOST", "127.0.0.1"),
            int(os.environ.get("IBKR_PORT", "7497")),
            int(os.environ.get("IBKR_CLIENT_ID", "17")),
        )

    def __exit__(self, *exc):
        self.ib.disconnect()
        return False

    def contract(self, inst: Instrument):
        """Front-month future, rolling 8 days before expiry."""
        from ib_async import Future

        if inst.symbol not in self._contracts:
            details = self.ib.reqContractDetails(Future(inst.broker_symbol, exchange="CME", currency="USD"))
            today = datetime.now(timezone.utc).strftime("%Y%m%d")
            live = sorted(
                (d.contract for d in details
                 if d.contract.lastTradeDateOrContractMonth > (pd.Timestamp(today) + pd.Timedelta(days=8)).strftime("%Y%m%d")),
                key=lambda c: c.lastTradeDateOrContractMonth,
            )
            if not live:
                raise RuntimeError(f"no tradable {inst.symbol} contract found")
            self._contracts[inst.symbol] = live[0]
        return self._contracts[inst.symbol]

    def historical_bars(self, symbol: str, days: int = 365, bar_size: str = "1 hour") -> pd.DataFrame:
        from ib_async import ContFuture, util

        inst = get_instrument(symbol)
        cont = ContFuture(inst.broker_symbol, exchange="CME", currency="USD")
        self.ib.qualifyContracts(cont)
        duration = f"{max(1, days // 365)} Y" if days >= 365 else f"{days} D"
        bars = self.ib.reqHistoricalData(
            cont, endDateTime="", durationStr=duration, barSizeSetting=bar_size,
            whatToShow="TRADES", useRTH=False, formatDate=2,
        )
        df = util.df(bars).set_index("date")[["open", "high", "low", "close", "volume"]]
        df.index = pd.to_datetime(df.index, utc=True)
        return df

    def equity(self) -> float:
        for v in self.ib.accountSummary():
            if v.tag == "NetLiquidation" and v.currency == "USD":
                return float(v.value)
        raise RuntimeError("NetLiquidation not available")

    def position(self, inst: Instrument) -> float:
        return sum(
            p.position for p in self.ib.positions() if p.contract.symbol == inst.broker_symbol
        )

    def market_order(self, inst, qty, stop=None, target=None) -> OrderResult:
        from ib_async import LimitOrder, MarketOrder, StopOrder

        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        c = self.contract(inst)
        action, exit_action = ("BUY", "SELL") if qty > 0 else ("SELL", "BUY")
        n = abs(int(qty))
        parent = MarketOrder(action, n, orderId=self.ib.client.getReqId(), transmit=False)
        children = [StopOrder(exit_action, n, inst.round_price(stop), parentId=parent.orderId, transmit=target is None)]
        if target is not None:
            children.append(LimitOrder(exit_action, n, inst.round_price(target), parentId=parent.orderId, transmit=True))
        oca = f"oca-{parent.orderId}"
        for ch in children:
            ch.ocaGroup, ch.ocaType = oca, 1
        trade = self.ib.placeOrder(c, parent)
        for ch in children:
            self.ib.placeOrder(c, ch)
        self.ib.sleep(2)
        return OrderResult(True, str(parent.orderId), trade.orderStatus.avgFillPrice or None, trade.orderStatus.status)

    def close(self, inst) -> OrderResult:
        from ib_async import MarketOrder

        for o in self.ib.openOrders():
            self.ib.cancelOrder(o)
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        t = self.ib.placeOrder(self.contract(inst), MarketOrder("SELL" if q > 0 else "BUY", abs(int(q))))
        return OrderResult(True, str(t.order.orderId))
