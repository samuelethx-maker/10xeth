"""OANDA v20 REST adapter (practice endpoint by default)."""

from __future__ import annotations

import os

import requests

from ..instruments import Instrument
from .base import Broker, OrderResult

PRACTICE_URL = "https://api-fxpractice.oanda.com"


class OandaBroker(Broker):
    name = "oanda"

    def __init__(self, token: str, account_id: str, base_url: str = PRACTICE_URL):
        if "fxpractice" not in base_url and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError("Refusing non-practice OANDA URL (prototype is demo-only)")
        self.base = base_url.rstrip("/")
        self.account = account_id
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})

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

    def _req(self, method: str, path: str, **kw) -> dict:
        r = self.s.request(method, f"{self.base}/v3/accounts/{self.account}{path}", timeout=30, **kw)
        r.raise_for_status()
        return r.json()

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

    def market_order(self, inst, qty, stop=None, target=None) -> OrderResult:
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        order = {
            "type": "MARKET",
            "instrument": inst.broker_symbol,
            "units": f"{qty:g}",
            "timeInForce": "FOK",
            "positionFill": "DEFAULT",
            "stopLossOnFill": {"price": f"{inst.round_price(stop)}"},
        }
        if target is not None:
            order["takeProfitOnFill"] = {"price": f"{inst.round_price(target)}"}
        data = self._req("POST", "/orders", json={"order": order})
        fill = data.get("orderFillTransaction")
        if not fill:
            return OrderResult(False, message=str(data.get("orderCancelTransaction", data)))
        return OrderResult(True, fill["id"], float(fill["price"]))

    def close(self, inst) -> OrderResult:
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        side = "longUnits" if q > 0 else "shortUnits"
        data = self._req("PUT", f"/positions/{inst.broker_symbol}/close", json={side: "ALL"})
        return OrderResult(True, message=str(list(data)))
