"""OANDA v20 REST adapter (practice endpoint by default).

Engine qty maps 1:1 to OANDA ``units`` (units of the base currency / ounces / index units).
"""

from __future__ import annotations

import os
import time
from typing import Callable

import requests

from ..instruments import Instrument
from .base import (
    Broker, OrderResult, fmt_num, is_transient, new_client_id, request_with_retry, symbol_map,
)

PRACTICE_URL = "https://api-fxpractice.oanda.com"


class OandaBroker(Broker):
    name = "oanda"

    def __init__(self, token: str, account_id: str, base_url: str = PRACTICE_URL,
                 sleep: Callable[[float], None] = time.sleep, retries: int = 3):
        if "fxpractice" not in base_url and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError("Refusing non-practice OANDA URL (prototype is demo-only)")
        self.base = base_url.rstrip("/")
        self.account = account_id
        self.sleep, self.retries = sleep, retries
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        self._by_symbol = symbol_map("oanda")

    @classmethod
    def from_env(cls) -> OandaBroker:
        try:
            return cls(
                os.environ["OANDA_API_TOKEN"],
                os.environ["OANDA_ACCOUNT_ID"],
                os.environ.get("OANDA_API_URL", PRACTICE_URL),
            )
        except KeyError as e:
            raise RuntimeError(f"missing environment variable {e}") from None

    # ------------------------------------------------------------ http
    def _req(self, method: str, path: str, *, retry: bool = True, **kw) -> dict:
        r = request_with_retry(
            self.s, method, f"{self.base}/v3/accounts/{self.account}{path}",
            retries=self.retries if retry else 0, sleep=self.sleep, **kw,
        )
        r.raise_for_status()
        return r.json()

    # ----------------------------------------------------------- reads
    def equity(self) -> float:
        return float(self._req("GET", "/summary")["account"]["NAV"])

    def position(self, inst: Instrument) -> float:
        try:
            p = self._req("GET", f"/positions/{inst.broker_symbol}")["position"]
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return 0.0
            raise
        return float(p["long"]["units"]) + float(p["short"]["units"])

    def positions(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for p in self._req("GET", "/openPositions")["positions"]:
            q = float(p["long"]["units"]) + float(p["short"]["units"])
            if q:
                inst = self._by_symbol.get(p["instrument"])
                out[inst.symbol if inst else p["instrument"]] = q
        return out

    def _open_trades(self, inst: Instrument | None) -> list[dict]:
        path = "/openTrades" + (f"?instrument={inst.broker_symbol}" if inst else "")
        return self._req("GET", path)["trades"]

    def open_orders(self, inst: Instrument | None = None) -> list[dict]:
        """Protective stop / take-profit orders, read off the open trades."""
        out = []
        for t in self._open_trades(inst):
            sym = self._by_symbol.get(t["instrument"])
            sym = sym.symbol if sym else t["instrument"]
            for key, kind in (("stopLossOrder", "stop"), ("takeProfitOrder", "target")):
                o = t.get(key)
                if o and o.get("state", "PENDING") == "PENDING":
                    ce = o.get("clientExtensions") or {}
                    out.append({"id": o["id"], "client_id": ce.get("id", ""), "symbol": sym,
                                "type": kind, "price": float(o["price"]), "trade_id": t["id"]})
        return out

    def price(self, inst: Instrument) -> float:
        p = self._req("GET", f"/pricing?instruments={inst.broker_symbol}")["prices"][0]
        return (float(p["bids"][0]["price"]) + float(p["asks"][0]["price"])) / 2

    # ---------------------------------------------------------- orders
    def _lookup(self, cid: str) -> OrderResult | None:
        """Result of the order with client id ``cid``, or None if the broker never saw it."""
        try:
            o = self._req("GET", f"/orders/@{cid}")["order"]
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return None
            raise
        if o.get("state") == "FILLED":
            price = None
            if o.get("fillingTransactionID"):
                tx = self._req("GET", f"/transactions/{o['fillingTransactionID']}")["transaction"]
                price = float(tx["price"]) if tx.get("price") else None
            return OrderResult(True, str(o.get("fillingTransactionID", o["id"])), price, "found by client id")
        if o.get("state") == "CANCELLED":
            return OrderResult(False, message=f"order cancelled: {o.get('cancelledTime', '')}")
        return OrderResult(False, message=f"order in state {o.get('state')}")

    def _submit(self, order: dict, cid: str) -> OrderResult:
        """POST once; on an ambiguous failure look the order up by client id before re-posting."""
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            if attempt:
                self.sleep(0.5 * 2 ** (attempt - 1))
                try:
                    found = self._lookup(cid)
                except Exception as e:  # noqa: BLE001
                    last = e
                    continue
                if found is not None:
                    return found
            try:
                data = self._req("POST", "/orders", json={"order": order}, retry=False)
            except requests.HTTPError as e:
                if is_transient(e):
                    last = e
                    continue
                body = e.response.text[:300] if e.response is not None else str(e)
                return OrderResult(False, message=f"order rejected: {body}")
            except (requests.ConnectionError, requests.Timeout) as e:
                last = e
                continue
            fill = data.get("orderFillTransaction")
            if not fill:
                return OrderResult(False, message=str(data.get("orderCancelTransaction", data)))
            return OrderResult(True, fill["id"], float(fill["price"]))
        return OrderResult(False, message=f"order submission failed after retries: {last}")

    def _confirm_protection(self, inst: Instrument, stop: float, target: float | None) -> str | None:
        """None if every open trade has a pending stop; otherwise try to attach one, else an error."""
        for t in self._open_trades(inst):
            sl = t.get("stopLossOrder")
            if sl and sl.get("state", "PENDING") == "PENDING":
                continue
            body = {"stopLoss": {"price": fmt_num(inst.round_price(stop)), "timeInForce": "GTC"}}
            if target is not None and not t.get("takeProfitOrder"):
                body["takeProfit"] = {"price": fmt_num(inst.round_price(target)), "timeInForce": "GTC"}
            self._req("PUT", f"/trades/{t['id']}/orders", json=body)
        for t in self._open_trades(inst):
            sl = t.get("stopLossOrder")
            if not sl or sl.get("state", "PENDING") != "PENDING":
                return f"no stop-loss on trade {t['id']}"
        return None

    def market_order(self, inst, qty, stop=None, target=None, client_id=None) -> OrderResult:
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        q = inst.round_qty(qty)
        if q == 0:
            return OrderResult(False, message=f"qty {qty} below minimum {inst.min_qty}")
        units = q if qty > 0 else -q
        cid = client_id or new_client_id()
        order = {
            "type": "MARKET",
            "instrument": inst.broker_symbol,
            "units": fmt_num(units),
            "timeInForce": "FOK",
            "positionFill": "DEFAULT",
            "clientExtensions": {"id": cid},
            "stopLossOnFill": {"price": fmt_num(inst.round_price(stop))},
        }
        if target is not None:
            order["takeProfitOnFill"] = {"price": fmt_num(inst.round_price(target))}
        res = self._submit(order, cid)
        if not res.ok:
            return res
        try:
            problem = self._confirm_protection(inst, stop, target)
        except Exception as e:  # noqa: BLE001
            problem = f"could not verify stop: {e}"
        if problem:
            return self._flatten_after_failure(inst, f"stop not in place ({problem})")
        return res

    def set_stop(self, inst, stop, target=None) -> OrderResult:
        trades = self._open_trades(inst)
        if not trades:
            return OrderResult(False, message="no open trade")
        body: dict = {"stopLoss": {"price": fmt_num(inst.round_price(stop)), "timeInForce": "GTC"}}
        if target is not None:
            body["takeProfit"] = {"price": fmt_num(inst.round_price(target)), "timeInForce": "GTC"}
        for t in trades:
            self._req("PUT", f"/trades/{t['id']}/orders", json=body)
        return OrderResult(True, message=f"stop -> {body['stopLoss']['price']}")

    def close(self, inst) -> OrderResult:
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        side = "longUnits" if q > 0 else "shortUnits"
        data = self._req("PUT", f"/positions/{inst.broker_symbol}/close", json={side: "ALL"})
        return OrderResult(True, message=str(list(data)))
