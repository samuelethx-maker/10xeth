"""Make broker positions match the Engine's desired positions (demo/paper accounts only).

Unit assumption (checked against instruments.py): Engine ``qty`` is expressed in the broker's
native order unit, so it is sent unconverted after rounding to the instrument's ``qty_step``:
OANDA = units (``multiplier`` 1), Binance = coin quantity, IBKR = contracts (ES/MES).

Only ``Engine.pos`` (positions already opened by the simulator) is mirrored; ``pending_entry``
signals are not executed until the Engine actually opens them.

Reconciliation per instrument:
  * broker position without a matching desired one (flat, other side, other size) -> close
  * desired position missing at the broker -> open with stop (+ target); blocked by the kill
    switch, the notional cap, or a price too far from the Engine's last close
  * matching position whose resting stop/target differ or are missing -> move them
Closes and protective-order repairs are always allowed. Every intended and actual action is
appended to ``orders.jsonl``. ``dry_run`` performs reads only.
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Mapping

from .brokers.base import Broker
from .instruments import Instrument, get_instrument
from .risk import kill_switch_active


@dataclass(frozen=True)
class Desired:
    symbol: str
    qty: float  # signed, instrument units
    stop: float
    target: float | None = None


def desired_from_engine(eng) -> dict[str, Desired]:
    return {
        s: Desired(s, t.direction * t.qty, t.stop, None if math.isnan(t.target) else t.target)
        for s, t in eng.pos.items()
    }


class Reconciler:
    def __init__(
        self,
        brokers: Mapping[str, Broker],
        *,
        dry_run: bool = True,
        orders_path: str | Path | None = None,
        kill_switch: Callable[[], bool] = kill_switch_active,
        max_price_dev: float = 0.05,
        max_leverage: float | None = None,
        log: Callable[[str], None] = print,
    ):
        self.brokers = brokers
        self.dry_run = dry_run
        self.orders_path = Path(orders_path) if orders_path else None
        self.kill_switch = kill_switch
        self.max_price_dev = max_price_dev
        self.max_leverage = max_leverage  # overrides Instrument.max_leverage when set
        self.log = log

    # ------------------------------------------------------------ journal
    def _journal(self, rec: dict) -> dict:
        rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "dry_run": self.dry_run, **rec}
        if self.orders_path:
            self.orders_path.parent.mkdir(parents=True, exist_ok=True)
            with self.orders_path.open("a") as f:
                f.write(json.dumps(rec, default=str) + "\n")
        self.log(f"[exec] {rec['symbol']} {rec['action']} {rec['status']} {rec.get('message', '')}".rstrip())
        return rec

    def _act(self, out: list[dict], inst: Instrument, action: str, fn: Callable, **detail) -> bool:
        """Journal intent, run ``fn`` (skipped in dry_run), journal the outcome. True on success."""
        base = {"symbol": inst.symbol, "broker": inst.broker, "action": action, **detail}
        out.append(self._journal({**base, "status": "intended"}))
        if self.dry_run:
            out.append(self._journal({**base, "status": "dry_run"}))
            return True
        try:
            res = fn()
            ok, msg = res.ok, res.message
            extra = {"order_id": res.order_id, "fill_price": res.fill_price}
        except Exception as e:  # noqa: BLE001 - a broker error must never crash the tick
            ok, msg, extra = False, f"{type(e).__name__}: {e}", {}
        out.append(self._journal({**base, "status": "done" if ok else "failed", "message": msg, **extra}))
        return ok

    def _skip(self, out: list[dict], inst: Instrument, action: str, why: str) -> None:
        out.append(self._journal({"symbol": inst.symbol, "broker": inst.broker, "action": action,
                                  "status": "blocked", "message": why}))

    # ---------------------------------------------------------- sanity
    def _entry_problem(self, inst: Instrument, d: Desired, broker: Broker, equity: float | None,
                       expected: float | None, usdjpy: float) -> str | None:
        if self.kill_switch():
            return "kill switch active"
        if equity is None or equity <= 0:
            return "broker equity unavailable"
        try:
            px = broker.price(inst)
        except Exception as e:  # noqa: BLE001
            return f"no quote: {e}"
        if expected and abs(px / expected - 1) > self.max_price_dev:
            return f"price {px:g} deviates >{self.max_price_dev:.0%} from expected {expected:g}"
        notional = abs(d.qty) * px * inst.multiplier
        if inst.quote_ccy == "JPY":
            notional /= usdjpy
        cap = equity * (self.max_leverage or inst.max_leverage)
        if notional > cap:
            return f"notional ${notional:,.0f} exceeds cap ${cap:,.0f}"
        long = d.qty > 0
        if (long and d.stop >= px) or (not long and d.stop <= px):
            return f"stop {d.stop:g} on the wrong side of price {px:g}"
        return None

    # -------------------------------------------------------- reconcile
    def reconcile(
        self,
        desired: Mapping[str, Desired],
        symbols: Iterable[str],
        expected_prices: Mapping[str, float] | None = None,
        usdjpy: float = 150.0,
    ) -> list[dict]:
        expected_prices = expected_prices or {}
        out: list[dict] = []
        by_broker: dict[str, list[Instrument]] = {}
        for s in symbols:
            inst = get_instrument(s)
            by_broker.setdefault(inst.broker, []).append(inst)
        for bname, insts in by_broker.items():
            broker = self.brokers.get(bname)
            if broker is None:
                self.log(f"[exec] no {bname} broker available; skipping {[i.symbol for i in insts]}")
                continue
            try:
                actual = broker.positions()
            except Exception as e:  # noqa: BLE001
                self.log(f"[exec] {bname} positions() failed, skipping: {e}")
                continue
            equity: float | None = None
            try:
                equity = broker.equity()
            except Exception as e:  # noqa: BLE001
                self.log(f"[exec] {bname} equity() failed, entries blocked: {e}")
            for inst in insts:
                try:
                    self._reconcile_one(out, broker, inst, desired.get(inst.symbol),
                                        actual.get(inst.symbol, 0.0), equity,
                                        expected_prices.get(inst.symbol), usdjpy)
                except Exception as e:  # noqa: BLE001
                    out.append(self._journal({"symbol": inst.symbol, "broker": bname, "action": "reconcile",
                                              "status": "failed", "message": f"{type(e).__name__}: {e}"}))
        return out

    def _reconcile_one(self, out, broker: Broker, inst: Instrument, d: Desired | None, have: float,
                       equity, expected, usdjpy) -> None:
        want = inst.round_qty(d.qty) * (1 if d and d.qty > 0 else -1) if d else 0.0
        tol = inst.qty_step / 2
        if d and want == 0:
            self._skip(out, inst, "open", f"qty {d.qty:g} rounds below minimum {inst.min_qty:g}")
            d = None
        mismatch = abs(have - want) > tol
        if have and mismatch:
            if not self._act(out, inst, "close", lambda: broker.close(inst), have=have, want=want):
                return  # still holding the wrong position; do not stack another order
            have = 0.0
        if d is None:
            return
        if not have:
            why = self._entry_problem(inst, d, broker, equity, expected, usdjpy)
            if why:
                self._skip(out, inst, "open", why)
                return
            self._act(out, inst, "open",
                      lambda: broker.market_order(inst, want, d.stop, d.target),
                      qty=want, stop=d.stop, target=d.target)
            return
        self._sync_protection(out, broker, inst, d)

    def _sync_protection(self, out, broker: Broker, inst: Instrument, d: Desired) -> None:
        try:
            orders = broker.open_orders(inst)
        except Exception as e:  # noqa: BLE001
            self.log(f"[exec] {inst.symbol} open_orders() failed, stop check skipped: {e}")
            return
        half = inst.tick_size / 2

        def differs(kind: str, want: float | None) -> bool:
            if want is None:
                return False
            px = [o["price"] for o in orders if o["type"] == kind]
            return not px or any(abs(p - want) > half for p in px)

        if differs("stop", d.stop) or differs("target", d.target):
            self._act(out, inst, "update_stop", lambda: broker.set_stop(inst, d.stop, d.target),
                      stop=d.stop, target=d.target)


LiveExecutor = Reconciler
