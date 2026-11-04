"""Interactive Brokers adapter for CME ES futures via TWS / IB Gateway (paper).

Requires `pip install -e .[ibkr]` and a running paper TWS (port 7497) or
IB Gateway (port 4002) with API access enabled.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone

import pandas as pd

from ..instruments import Instrument, get_instrument
from .base import Broker, OrderResult, new_client_id, symbol_map

PAPER_PORTS = {7497, 4002}


class IBKRBroker(Broker):
    name = "ibkr"

    def __init__(self, host: str = "127.0.0.1", port: int = 7497, client_id: int = 17,
                 ib=None, ib_mod=None, connect_retries: int = 3):
        """``ib`` / ``ib_mod`` let tests inject a fake IB object and ib_async namespace."""
        if port not in PAPER_PORTS and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError(f"Refusing non-paper IBKR port {port} (prototype is demo-only)")
        self._mod = ib_mod
        self._contracts: dict[str, object] = {}
        self._by_symbol = symbol_map("ibkr")
        if ib is not None:
            self.ib = ib
            return
        mod = self._ib_async()
        self.ib = mod.IB()
        for attempt in range(connect_retries + 1):
            try:
                self.ib.connect(host, port, clientId=client_id, timeout=10)
                break
            except (ConnectionError, TimeoutError, OSError) as e:
                if attempt == connect_retries:
                    raise RuntimeError(f"cannot connect to TWS/Gateway at {host}:{port}: {e}") from None
                time.sleep(0.5 * 2**attempt)

    def _ib_async(self):
        if self._mod is None:
            try:
                import ib_async
            except ImportError:
                raise RuntimeError("ib_async not installed: pip install -e '.[ibkr]'") from None
            self._mod = ib_async
        return self._mod

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
        Future = self._ib_async().Future

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

    def positions(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for p in self.ib.positions():
            if p.position:
                inst = self._by_symbol.get(p.contract.symbol)
                key = inst.symbol if inst else p.contract.symbol
                out[key] = out.get(key, 0.0) + float(p.position)
        return out

    def price(self, inst: Instrument) -> float:
        t = self.ib.reqTickers(self.contract(inst))[0]
        px = t.marketPrice()
        if not px or px != px:
            px = t.last or t.close
        if not px or px != px:
            raise RuntimeError(f"no quote for {inst.symbol}")
        return float(px)

    def _trades(self, inst: Instrument | None = None) -> list:
        return [t for t in self.ib.openTrades()
                if inst is None or t.contract.symbol == inst.broker_symbol]

    def open_orders(self, inst: Instrument | None = None) -> list[dict]:
        out = []
        for t in self._trades(inst):
            o = t.order
            kind = {"STP": "stop", "LMT": "target"}.get(o.orderType, "other")
            px = o.auxPrice if o.orderType == "STP" else getattr(o, "lmtPrice", 0)
            i = self._by_symbol.get(t.contract.symbol)
            out.append({"id": str(o.orderId), "client_id": getattr(o, "orderRef", "") or "",
                        "symbol": i.symbol if i else t.contract.symbol, "type": kind,
                        "price": float(px or 0)})
        return out

    def _wait_filled(self, trade, timeout: float = 15.0) -> str:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            st = trade.orderStatus.status
            if st == "Filled" or st in ("Cancelled", "ApiCancelled", "Inactive"):
                return st
            self.ib.sleep(0.5)
        return trade.orderStatus.status

    def market_order(self, inst, qty, stop=None, target=None, client_id=None) -> OrderResult:
        mod = self._ib_async()
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        n = int(inst.round_qty(qty))
        if n == 0:
            return OrderResult(False, message=f"qty {qty} below minimum {inst.min_qty}")
        ref = client_id or new_client_id()
        for t in self.ib.openTrades():  # idempotency: never place the same orderRef twice
            if getattr(t.order, "orderRef", None) == ref:
                return OrderResult(False, message=f"orderRef {ref} already exists")
        c = self.contract(inst)
        action, exit_action = ("BUY", "SELL") if qty > 0 else ("SELL", "BUY")
        parent = mod.MarketOrder(action, n, orderId=self.ib.client.getReqId(), transmit=False, orderRef=ref)
        children = [mod.StopOrder(exit_action, n, inst.round_price(stop), parentId=parent.orderId,
                                  transmit=target is None, orderRef=f"{ref}-sl")]
        if target is not None:
            children.append(mod.LimitOrder(exit_action, n, inst.round_price(target), parentId=parent.orderId,
                                           transmit=True, orderRef=f"{ref}-tp"))
        oca = f"oca-{parent.orderId}"
        for ch in children:
            ch.ocaGroup, ch.ocaType = oca, 1
        trade = self.ib.placeOrder(c, parent)
        placed = [self.ib.placeOrder(c, ch) for ch in children]
        status = self._wait_filled(trade)
        if status != "Filled":
            self.ib.cancelOrder(parent)
            self.ib.sleep(1)
            if trade.orderStatus.status != "Filled":
                for pt in placed:
                    self.ib.cancelOrder(pt.order)
                return OrderResult(False, message=f"entry not filled ({trade.orderStatus.status})")
        stop_trade = placed[0]
        if stop_trade.orderStatus.status in ("Cancelled", "ApiCancelled", "Inactive"):
            return self._flatten_after_failure(inst, f"stop not in place ({stop_trade.orderStatus.status})")
        return OrderResult(True, str(parent.orderId), trade.orderStatus.avgFillPrice or None, status)

    def set_stop(self, inst, stop, target=None) -> OrderResult:
        mod = self._ib_async()
        px = inst.round_price(stop)
        trades = self._trades(inst)
        stops = [t for t in trades if t.order.orderType == "STP"]
        if stops:
            for t in stops:
                t.order.auxPrice = px
                self.ib.placeOrder(t.contract, t.order)
        else:
            q = self.position(inst)
            if q == 0:
                return OrderResult(False, message="no open position")
            self.ib.placeOrder(self.contract(inst), mod.StopOrder(
                "SELL" if q > 0 else "BUY", abs(int(q)), px, orderRef=f"{new_client_id()}-sl"))
        if target is not None:
            for t in (x for x in trades if x.order.orderType == "LMT"):
                t.order.lmtPrice = inst.round_price(target)
                self.ib.placeOrder(t.contract, t.order)
        self.ib.sleep(1)
        return OrderResult(True, message=f"stop -> {px}")

    def close(self, inst) -> OrderResult:
        mod = self._ib_async()
        for t in self._trades(inst):
            self.ib.cancelOrder(t.order)
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        t = self.ib.placeOrder(
            self.contract(inst),
            mod.MarketOrder("SELL" if q > 0 else "BUY", abs(int(q)), orderRef=new_client_id()),
        )
        return OrderResult(True, str(t.order.orderId))
