"""Common broker interface. Every adapter is demo/paper-only by default."""

from __future__ import annotations

import time
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

import requests

from ..instruments import INSTRUMENTS, Instrument

DEFAULT_TIMEOUT = 15.0
RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


@dataclass
class OrderResult:
    ok: bool
    order_id: str = ""
    fill_price: float | None = None
    message: str = ""


def fmt_num(x: float) -> str:
    """Plain decimal string (never scientific notation, which brokers reject)."""
    return format(Decimal(str(x)).normalize(), "f")


def new_client_id(prefix: str = "tb") -> str:
    """Unique, exchange-safe client order id (<= 26 chars, [a-z0-9])."""
    return f"{prefix}{uuid.uuid4().hex[:24]}"[:26]


def request_with_retry(
    session: requests.Session, method: str, url: str, *, retries: int = 3, backoff: float = 0.5,
    timeout: float = DEFAULT_TIMEOUT, sleep: Callable[[float], None] = time.sleep, **kw,
) -> requests.Response:
    """HTTP request with timeout; retries connection errors, 429 and 5xx with exponential backoff.

    Only use for idempotent requests (reads, cancels, close-all). Order submissions must use
    ``retries=0`` and recover via a client-order-id lookup instead. The final response is returned
    as-is on exhausted status retries; a connection error is re-raised.
    """
    for attempt in range(retries + 1):
        try:
            r = session.request(method, url, timeout=timeout, **kw)
        except (requests.ConnectionError, requests.Timeout):
            if attempt == retries:
                raise
            sleep(backoff * 2**attempt)
            continue
        if r.status_code in RETRY_STATUS and attempt < retries:
            try:
                wait = min(float(r.headers.get("Retry-After", "")), 30.0)
            except ValueError:
                wait = backoff * 2**attempt
            sleep(wait)
            continue
        return r
    raise AssertionError("unreachable")


def is_transient(exc: Exception) -> bool:
    """True when an order POST may or may not have reached the broker."""
    if isinstance(exc, (requests.ConnectionError, requests.Timeout)):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code in RETRY_STATUS
    return False


class Broker(ABC):
    """Adapter interface.

    ``positions()`` / ``open_orders()`` are keyed by our canonical symbol. ``open_orders()`` returns
    normalised dicts: ``{"id", "client_id", "symbol", "type": "stop"|"target"|"other", "price"}``.
    """

    name = "base"

    @abstractmethod
    def equity(self) -> float:
        """Account equity (NAV) in account currency."""

    @abstractmethod
    def position(self, inst: Instrument) -> float:
        """Signed open quantity (+long / -short / 0 flat)."""

    @abstractmethod
    def market_order(
        self, inst: Instrument, qty: float, stop: float | None = None, target: float | None = None,
        client_id: str | None = None,
    ) -> OrderResult:
        """Signed market order with protective stop / optional target.

        Fail-safe: if the stop cannot be confirmed after the entry fills, the position is
        flattened and a failed OrderResult is returned.
        """

    @abstractmethod
    def close(self, inst: Instrument) -> OrderResult:
        """Flatten the instrument (and cancel its resting protective orders)."""

    def positions(self) -> dict[str, float]:
        raise NotImplementedError

    def open_orders(self, inst: Instrument | None = None) -> list[dict]:
        raise NotImplementedError

    def price(self, inst: Instrument) -> float:
        raise NotImplementedError

    def set_stop(self, inst: Instrument, stop: float, target: float | None = None) -> OrderResult:
        """Move the protective stop (and the target if given) of an open position."""
        raise NotImplementedError

    def min_test_qty(self, inst: Instrument) -> float:
        return inst.min_qty

    def _flatten_after_failure(self, inst: Instrument, why: str) -> OrderResult:
        try:
            res = self.close(inst)
            flat = "flattened" if res.ok else f"FLATTEN FAILED ({res.message})"
        except Exception as e:  # noqa: BLE001 - must never raise from the fail-safe path
            flat = f"FLATTEN FAILED ({e})"
        return OrderResult(False, message=f"{why}; position {flat}")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def symbol_map(broker_name: str) -> dict[str, Instrument]:
    """broker_symbol -> Instrument for one broker."""
    return {i.broker_symbol: i for i in INSTRUMENTS.values() if i.broker == broker_name}
