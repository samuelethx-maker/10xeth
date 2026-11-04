"""Binance USD-M futures adapter (testnet by default; futures so we can short).

Engine qty is in coin units (BTC, ETH), matching Binance ``quantity``.

Since 2025-12-09 Binance routes conditional orders (STOP_MARKET / TAKE_PROFIT_MARKET) through the
Algo Service (``/fapi/v1/algoOrder``). That is the default here; set
``BINANCE_CONDITIONAL_API=classic`` to use ``/fapi/v1/order`` if your endpoint still accepts them.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from collections.abc import Callable
from decimal import ROUND_FLOOR, ROUND_HALF_EVEN, Decimal
from urllib.parse import urlencode

import requests

from ..instruments import Instrument
from .base import (
    Broker,
    OrderResult,
    fmt_num,
    is_transient,
    new_client_id,
    request_with_retry,
    symbol_map,
)

TESTNET_URL = "https://testnet.binancefuture.com"
NO_SUCH_ORDER = {-2013, -2011}
DUPLICATE_ID = {-4015}


class BinanceError(requests.HTTPError):
    """HTTP error carrying Binance's JSON ``code`` / ``msg``."""

    def __init__(self, msg: str, code: int | None, response):
        super().__init__(msg, response=response)
        self.code = code


def _dec(x) -> Decimal:
    return Decimal(str(x))


class BinanceFuturesBroker(Broker):
    name = "binance"

    def __init__(self, key: str, secret: str, base_url: str = TESTNET_URL,
                 sleep: Callable[[float], None] = time.sleep, retries: int = 3,
                 conditional_api: str | None = None):
        if "testnet" not in base_url and "demo" not in base_url and os.environ.get("ALLOW_LIVE") != "1":
            raise RuntimeError("Refusing non-testnet Binance URL (prototype is demo-only)")
        self.base = base_url.rstrip("/")
        self.secret = secret.encode()
        self.sleep, self.retries = sleep, retries
        self.algo = (conditional_api or os.environ.get("BINANCE_CONDITIONAL_API", "algo")) == "algo"
        self.s = requests.Session()
        self.s.headers.update({"X-MBX-APIKEY": key})
        self._filters: dict[str, dict] = {}
        self._by_symbol = symbol_map("binance")

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

    # ------------------------------------------------------------ http
    def _call(self, method: str, path: str, params: dict | None, signed: bool, retry: bool):
        p = dict(params or {})
        if signed:
            p.update(timestamp=int(time.time() * 1000), recvWindow=5000)
        q = urlencode(p)
        if signed:
            q += "&signature=" + hmac.new(self.secret, q.encode(), hashlib.sha256).hexdigest()
        url = f"{self.base}{path}" + (f"?{q}" if q else "")
        # Timestamp/signature are regenerated on each retry of an order by the caller; plain
        # transport retries here reuse the same (still valid, 5s window) signed URL.
        r = request_with_retry(self.s, method, url, retries=self.retries if retry else 0, sleep=self.sleep)
        if r.status_code >= 400:
            try:
                body = r.json()
            except ValueError:
                body = {}
            raise BinanceError(f"{r.status_code} {body.get('msg', r.text[:200])}", body.get("code"), r)
        return r.json()

    def _signed(self, method: str, path: str, params: dict | None = None, retry: bool = True):
        return self._call(method, path, params, True, retry)

    def _public(self, path: str, params: dict | None = None):
        return self._call("GET", path, params, False, True)

    # --------------------------------------------------- exchange filters
    def filters(self, inst: Instrument) -> dict:
        """Cached LOT_SIZE / PRICE_FILTER / MIN_NOTIONAL; falls back to Instrument specs."""
        if not self._filters:
            try:
                for s in self._public("/fapi/v1/exchangeInfo")["symbols"]:
                    f = {x["filterType"]: x for x in s["filters"]}
                    self._filters[s["symbol"]] = {
                        "step": _dec(f["LOT_SIZE"]["stepSize"]),
                        "min_qty": _dec(f["LOT_SIZE"]["minQty"]),
                        "tick": _dec(f["PRICE_FILTER"]["tickSize"]),
                        "min_notional": _dec(f.get("MIN_NOTIONAL", {}).get("notional", 0)),
                    }
            except Exception:  # noqa: BLE001 - spec fallback keeps trading usable
                self._filters = {}
        f = self._filters.get(inst.broker_symbol)
        if f is None:
            f = {"step": _dec(inst.qty_step), "min_qty": _dec(inst.min_qty),
                 "tick": _dec(inst.tick_size), "min_notional": Decimal(0)}
        return f

    def round_qty(self, inst: Instrument, qty: float) -> float:
        f = self.filters(inst)
        q = (_dec(abs(qty)) / f["step"]).to_integral_value(ROUND_FLOOR) * f["step"]
        return float(q) if q >= f["min_qty"] else 0.0

    def round_price(self, inst: Instrument, price: float) -> float:
        t = self.filters(inst)["tick"]
        return float((_dec(price) / t).to_integral_value(ROUND_HALF_EVEN) * t)

    def min_test_qty(self, inst: Instrument) -> float:
        f = self.filters(inst)
        q = f["min_qty"]
        if f["min_notional"]:
            need = f["min_notional"] * Decimal("1.1") / _dec(self.price(inst))
            q = max(q, (need / f["step"]).to_integral_value(ROUND_FLOOR) * f["step"] + f["step"])
        return float(q)

    # ----------------------------------------------------------- reads
    def equity(self) -> float:
        return float(self._signed("GET", "/fapi/v2/account")["totalMarginBalance"])

    def position(self, inst: Instrument) -> float:
        rows = self._signed("GET", "/fapi/v2/positionRisk", {"symbol": inst.broker_symbol})
        return sum(float(r["positionAmt"]) for r in rows)

    def positions(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for r in self._signed("GET", "/fapi/v2/positionRisk"):
            amt = float(r["positionAmt"])
            if amt:
                inst = self._by_symbol.get(r["symbol"])
                key = inst.symbol if inst else r["symbol"]
                out[key] = out.get(key, 0.0) + amt
        return out

    def price(self, inst: Instrument) -> float:
        return float(self._public("/fapi/v1/ticker/price", {"symbol": inst.broker_symbol})["price"])

    @staticmethod
    def _kind(otype: str) -> str:
        if otype.startswith("STOP"):
            return "stop"
        if otype.startswith("TAKE_PROFIT"):
            return "target"
        return "other"

    def open_orders(self, inst: Instrument | None = None) -> list[dict]:
        params = {"symbol": inst.broker_symbol} if inst else {}
        rows = [(o, o.get("clientOrderId", ""), str(o["orderId"]), o.get("stopPrice") or o.get("price"))
                for o in self._signed("GET", "/fapi/v1/openOrders", params)]
        if self.algo:
            rows += [(o, o.get("clientAlgoId", ""), str(o["algoId"]), o.get("triggerPrice"))
                     for o in self._signed("GET", "/fapi/v1/openAlgoOrders", params)]
        out = []
        for o, cid, oid, px in rows:
            i = self._by_symbol.get(o["symbol"])
            out.append({"id": oid, "client_id": cid, "symbol": i.symbol if i else o["symbol"],
                        "type": self._kind(o.get("orderType") or o.get("type", "")),
                        "price": float(px or 0), "side": o.get("side", "")})
        return out

    # ---------------------------------------------------------- orders
    def _post_idempotent(self, path: str, params: dict, lookup: Callable[[], dict | None]) -> dict:
        """POST an order; on ambiguous failure query by client id before ever re-posting."""
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            if attempt:
                self.sleep(0.5 * 2 ** (attempt - 1))
                try:
                    found = lookup()
                except Exception as e:  # noqa: BLE001
                    last = e
                    continue
                if found is not None:
                    return found
            try:
                return self._signed("POST", path, params, retry=False)
            except BinanceError as e:
                if e.code in DUPLICATE_ID:
                    found = lookup()
                    if found is not None:
                        return found
                if is_transient(e):
                    last = e
                    continue
                raise
            except (requests.ConnectionError, requests.Timeout) as e:
                last = e
        raise RuntimeError(f"order submission failed after retries: {last}")

    def _lookup_order(self, inst: Instrument, cid: str) -> dict | None:
        try:
            return self._signed("GET", "/fapi/v1/order", {"symbol": inst.broker_symbol, "origClientOrderId": cid})
        except BinanceError as e:
            if e.code in NO_SUCH_ORDER:
                return None
            raise

    def _lookup_algo(self, cid: str) -> dict | None:
        try:
            return self._signed("GET", "/fapi/v1/algoOrder", {"clientAlgoId": cid})
        except BinanceError as e:
            if e.code in NO_SUCH_ORDER or (e.response is not None and e.response.status_code == 404):
                return None
            raise

    def _place_conditional(self, inst: Instrument, side: str, otype: str, price: float, cid: str) -> dict:
        px = fmt_num(self.round_price(inst, price))
        base = {"symbol": inst.broker_symbol, "side": side, "type": otype, "closePosition": "true",
                "workingType": "MARK_PRICE"}
        if self.algo:
            return self._post_idempotent(
                "/fapi/v1/algoOrder",
                {**base, "algoType": "CONDITIONAL", "triggerPrice": px, "clientAlgoId": cid},
                lambda: self._lookup_algo(cid),
            )
        return self._post_idempotent(
            "/fapi/v1/order", {**base, "stopPrice": px, "newClientOrderId": cid},
            lambda: self._lookup_order(inst, cid),
        )

    def _protect(self, inst: Instrument, exit_side: str, stop: float, target: float | None, cid: str) -> str | None:
        """Place stop (+ target) and confirm the stop rests on the book. None = ok, else error."""
        try:
            self._place_conditional(inst, exit_side, "STOP_MARKET", stop, f"{cid}-sl")
            if not any(o["type"] == "stop" for o in self.open_orders(inst)):
                return "stop order not found on the book after placement"
        except Exception as e:  # noqa: BLE001
            return str(e)
        return None

    def market_order(self, inst, qty, stop=None, target=None, client_id=None) -> OrderResult:
        if stop is None:
            return OrderResult(False, message="refusing order without a stop")
        q = self.round_qty(inst, qty)
        if q == 0:
            return OrderResult(False, message=f"qty {qty} below LOT_SIZE minQty")
        f = self.filters(inst)
        if f["min_notional"]:
            try:
                if _dec(q) * _dec(self.price(inst)) < f["min_notional"]:
                    return OrderResult(False, message=f"notional below MIN_NOTIONAL {f['min_notional']}")
            except Exception as e:  # noqa: BLE001
                return OrderResult(False, message=f"cannot check MIN_NOTIONAL: {e}")
        side, exit_side = ("BUY", "SELL") if qty > 0 else ("SELL", "BUY")
        cid = client_id or new_client_id()
        try:
            o = self._post_idempotent(
                "/fapi/v1/order",
                {"symbol": inst.broker_symbol, "side": side, "type": "MARKET", "quantity": fmt_num(q),
                 "newClientOrderId": cid, "newOrderRespType": "RESULT"},
                lambda: self._lookup_order(inst, cid),
            )
        except Exception as e:  # noqa: BLE001
            return OrderResult(False, message=f"entry failed: {e}")
        if o.get("status") not in (None, "FILLED", "NEW", "PARTIALLY_FILLED"):
            return OrderResult(False, message=f"entry {o.get('status')}")
        problem = self._protect(inst, exit_side, stop, target, cid)
        if problem:
            return self._flatten_after_failure(inst, f"stop not in place ({problem})")
        note = ""
        if target is not None:
            try:
                self._place_conditional(inst, exit_side, "TAKE_PROFIT_MARKET", target, f"{cid}-tp")
            except Exception as e:  # noqa: BLE001 - stop is live, so the position is still protected
                note = f"target not placed: {e}"
        avg = float(o.get("avgPrice") or 0) or None
        return OrderResult(True, str(o["orderId"]), avg, note)

    def _cancel_all(self, inst: Instrument) -> None:
        self._signed("DELETE", "/fapi/v1/allOpenOrders", {"symbol": inst.broker_symbol})
        if self.algo:
            self._signed("DELETE", "/fapi/v1/algoOpenOrders", {"symbol": inst.broker_symbol})

    def _cancel_order(self, inst: Instrument, o: dict) -> None:
        if self.algo:
            self._signed("DELETE", "/fapi/v1/algoOrder", {"algoId": o["id"]})
        else:
            self._signed("DELETE", "/fapi/v1/order", {"symbol": inst.broker_symbol, "orderId": o["id"]})

    def set_stop(self, inst, stop, target=None) -> OrderResult:
        q = self.position(inst)
        if q == 0:
            return OrderResult(False, message="no open position")
        exit_side = "SELL" if q > 0 else "BUY"
        existing = self.open_orders(inst)
        for kind, px, otype in (("stop", stop, "STOP_MARKET"), ("target", target, "TAKE_PROFIT_MARKET")):
            if px is None:
                continue
            old = [o for o in existing if o["type"] == kind]
            for o in old:
                self._cancel_order(inst, o)
            cid = new_client_id()
            try:
                self._place_conditional(inst, exit_side, otype, px, f"{cid}-{kind[:2]}")
            except Exception as e:  # noqa: BLE001
                if kind == "stop":
                    # Restore the previous stop; if that fails too the position is naked, so flatten.
                    try:
                        if not old:
                            raise e
                        self._place_conditional(inst, exit_side, otype, old[0]["price"], f"{new_client_id()}-sl")
                    except Exception:  # noqa: BLE001
                        return self._flatten_after_failure(inst, f"could not move stop ({e})")
                return OrderResult(False, message=f"could not move {kind}: {e}")
        return OrderResult(True, message=f"stop -> {stop}")

    def close(self, inst) -> OrderResult:
        self._cancel_all(inst)
        q = self.position(inst)
        if q == 0:
            return OrderResult(True, message="already flat")
        cid = new_client_id()
        o = self._post_idempotent(
            "/fapi/v1/order",
            {"symbol": inst.broker_symbol, "side": "SELL" if q > 0 else "BUY", "type": "MARKET",
             "quantity": fmt_num(abs(q)), "reduceOnly": "true", "newClientOrderId": cid},
            lambda: self._lookup_order(inst, cid),
        )
        return OrderResult(True, str(o["orderId"]))
