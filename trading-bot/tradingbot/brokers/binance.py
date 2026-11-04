"""Binance USD-M futures adapter (testnet by default; futures so we can short)."""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from urllib.parse import urlencode

import requests

from ..instruments import Instrument
from .base import Broker, OrderResult

TESTNET_URL = "https://testnet.binancefuture.com"


class BinanceFuturesBroker(Broker):
    name = "binance"

    def __init__(self, key: str, secret: str, base_url: str = TESTNET_URL):
        if "testnet" not in base_url and "demo" not in base_url and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError("Refusing non-testnet Binance URL (prototype is demo-only)")
        self.base = base_url.rstrip("/")
        self.secret = secret.encode()
        self.s = requests.Session()
        self.s.headers.update({"X-MBX-APIKEY": key})

    @classmethod
    def from_env(cls) -> BinanceFuturesBroker:
        try:
            return cls(
                os.environ["BINANCE_API_KEY"],
                os.environ["BINANCE_API_SECRET"],
                os.environ.get("BINANCE_FUTURES_URL", TESTNET_URL),
            )
        except KeyError as e:
            raise RuntimeError(f"missing environment variable {e}") from None

    def _signed(self, method: str, path: str, params: dict | None = None):
        p = {**(params or {}), "timestamp": int(time.time() * 1000), "recvWindow": 5000}
        q = urlencode(p)
        sig = hmac.new(self.secret, q.encode(), hashlib.sha256).hexdigest()
        r = self.s.request(method, f"{self.base}{path}?{q}&signature={sig}", timeout=30)
        r.raise_for_status()
        return r.json()

    def equity(self) -> float:
        return float(self._signed("GET", "/fapi/v2/account")["totalMarginBalance"])

    def position(self, inst: Instrument) -> float:
        rows = self._signed("GET", "/fapi/v2/positionRisk", {"symbol": inst.broker_symbol})
        return sum(float(r["positionAmt"]) for r in rows)

    def market_order(self, inst, qty, stop=None, target=None) -> OrderResult:
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        side, exit_side = ("BUY", "SELL") if qty > 0 else ("SELL", "BUY")
        o = self._signed("POST", "/fapi/v1/order", {
            "symbol": inst.broker_symbol, "side": side, "type": "MARKET", "quantity": f"{abs(qty):g}",
        })
        self._signed("POST", "/fapi/v1/order", {
            "symbol": inst.broker_symbol, "side": exit_side, "type": "STOP_MARKET",
            "stopPrice": f"{inst.round_price(stop)}", "closePosition": "true",
        })
        if target is not None:
            self._signed("POST", "/fapi/v1/order", {
                "symbol": inst.broker_symbol, "side": exit_side, "type": "TAKE_PROFIT_MARKET",
                "stopPrice": f"{inst.round_price(target)}", "closePosition": "true",
            })
        avg = float(o.get("avgPrice") or 0) or None
        return OrderResult(True, str(o["orderId"]), avg)

    def close(self, inst) -> OrderResult:
        self._signed("DELETE", "/fapi/v1/allOpenOrders", {"symbol": inst.broker_symbol})
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        o = self._signed("POST", "/fapi/v1/order", {
            "symbol": inst.broker_symbol, "side": "SELL" if q > 0 else "BUY", "type": "MARKET",
            "quantity": f"{abs(q):g}", "reduceOnly": "true",
        })
        return OrderResult(True, str(o["orderId"]))
