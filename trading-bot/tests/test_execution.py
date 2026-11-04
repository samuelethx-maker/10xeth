"""Reconciler: Engine desired positions -> broker actions (fake broker, no network)."""

from __future__ import annotations

import json

import pytest

from tradingbot.brokers.base import Broker, OrderResult
from tradingbot.execution import Desired, Reconciler, desired_from_engine
from tradingbot.paper import PaperConfig, PaperTrader

MES = "MES"


class FakeBroker(Broker):
    name = "ibkr"

    def __init__(self, pos=None, orders=None, px=5000.0, equity=100_000.0, order_ok=True):
        self.pos, self.orders, self.px, self.eq, self.order_ok = dict(pos or {}), list(orders or []), px, equity, order_ok
        self.calls: list[tuple] = []

    def equity(self):
        return self.eq

    def position(self, inst):
        return self.pos.get(inst.symbol, 0.0)

    def positions(self):
        return dict(self.pos)

    def open_orders(self, inst=None):
        return list(self.orders)

    def price(self, inst):
        return self.px

    def market_order(self, inst, qty, stop=None, target=None, client_id=None):
        self.calls.append(("open", inst.symbol, qty, stop, target))
        if not self.order_ok:
            return OrderResult(False, message="rejected")
        self.pos[inst.symbol] = qty
        return OrderResult(True, "1", self.px)

    def close(self, inst):
        self.calls.append(("close", inst.symbol))
        self.pos.pop(inst.symbol, None)
        return OrderResult(True, "2")

    def set_stop(self, inst, stop, target=None):
        self.calls.append(("stop", inst.symbol, stop, target))
        return OrderResult(True)


def rec(broker, tmp_path, **kw):
    kw.setdefault("dry_run", False)
    kw.setdefault("kill_switch", lambda: False)
    return Reconciler({"ibkr": broker}, orders_path=tmp_path / "orders.jsonl", log=lambda m: None, **kw)


def stop_order(price, kind="stop"):
    return {"id": "1", "client_id": "", "symbol": MES, "type": kind, "price": price}


def test_opens_missing_position_with_stop_and_target(tmp_path):
    b = FakeBroker()
    rec(b, tmp_path).reconcile({MES: Desired(MES, 2, 4900.0, 5200.0)}, [MES])
    assert b.calls == [("open", MES, 2.0, 4900.0, 5200.0)]


def test_short_desired_sends_negative_qty(tmp_path):
    b = FakeBroker()
    rec(b, tmp_path).reconcile({MES: Desired(MES, -3, 5100.0)}, [MES])
    assert b.calls == [("open", MES, -3.0, 5100.0, None)]


def test_closes_position_not_desired(tmp_path):
    b = FakeBroker(pos={MES: 2.0})
    rec(b, tmp_path).reconcile({}, [MES])
    assert b.calls == [("close", MES)] and not b.pos


def test_reverse_closes_then_reopens(tmp_path):
    b = FakeBroker(pos={MES: 2.0}, orders=[stop_order(4900)])
    rec(b, tmp_path).reconcile({MES: Desired(MES, -2, 5100.0)}, [MES])
    assert [c[0] for c in b.calls] == ["close", "open"] and b.pos[MES] == -2.0


def test_matching_position_with_changed_stop_is_updated(tmp_path):
    b = FakeBroker(pos={MES: 2.0}, orders=[stop_order(4900)])
    rec(b, tmp_path).reconcile({MES: Desired(MES, 2, 4950.0)}, [MES])
    assert b.calls == [("stop", MES, 4950.0, None)]


def test_matching_position_and_stop_does_nothing(tmp_path):
    b = FakeBroker(pos={MES: 2.0}, orders=[stop_order(4950.0), stop_order(5200.0, "target")])
    rec(b, tmp_path).reconcile({MES: Desired(MES, 2, 4950.0, 5200.0)}, [MES])
    assert b.calls == []


def test_missing_stop_is_repaired(tmp_path):
    b = FakeBroker(pos={MES: 2.0}, orders=[])
    rec(b, tmp_path).reconcile({MES: Desired(MES, 2, 4950.0)}, [MES])
    assert b.calls == [("stop", MES, 4950.0, None)]


def test_kill_switch_blocks_entries_but_allows_exits(tmp_path):
    b = FakeBroker()
    out = rec(b, tmp_path, kill_switch=lambda: True).reconcile({MES: Desired(MES, 2, 4900.0)}, [MES])
    assert b.calls == [] and out[-1]["status"] == "blocked"
    b = FakeBroker(pos={MES: 2.0})
    rec(b, tmp_path, kill_switch=lambda: True).reconcile({}, [MES])
    assert b.calls == [("close", MES)]
    b = FakeBroker(pos={MES: 2.0}, orders=[stop_order(4900)])  # reverse: close yes, re-entry no
    rec(b, tmp_path, kill_switch=lambda: True).reconcile({MES: Desired(MES, -2, 5100.0)}, [MES])
    assert b.calls == [("close", MES)]


def test_dry_run_sends_nothing_but_logs(tmp_path):
    b = FakeBroker(pos={"MES": 1.0})
    out = rec(b, tmp_path, dry_run=True).reconcile({MES: Desired(MES, -2, 5100.0)}, [MES])
    assert b.calls == [] and b.pos == {MES: 1.0}
    lines = [json.loads(x) for x in (tmp_path / "orders.jsonl").read_text().splitlines()]
    assert {(r["action"], r["status"]) for r in lines} >= {("close", "dry_run"), ("close", "intended")}
    assert all(r["dry_run"] for r in lines) and len(lines) == len(out)


def test_journal_records_intent_and_result(tmp_path):
    b = FakeBroker()
    rec(b, tmp_path).reconcile({MES: Desired(MES, 1, 4900.0)}, [MES])
    lines = [json.loads(x) for x in (tmp_path / "orders.jsonl").read_text().splitlines()]
    assert [r["status"] for r in lines] == ["intended", "done"]
    assert lines[1]["fill_price"] == 5000.0 and lines[0]["stop"] == 4900.0


def test_failed_order_is_journaled_not_raised(tmp_path):
    b = FakeBroker(order_ok=False)
    out = rec(b, tmp_path).reconcile({MES: Desired(MES, 1, 4900.0)}, [MES])
    assert out[-1]["status"] == "failed" and out[-1]["message"] == "rejected"


@pytest.mark.parametrize("kw,desired,why", [
    (dict(px=5500.0), Desired(MES, 1, 5400.0), "deviates"),            # price far from expected 5000
    (dict(), Desired(MES, 200, 4900.0), "exceeds cap"),                # 200*5000*5 = $5M
    (dict(), Desired(MES, 1, 5100.0), "wrong side"),                   # long stop above price
    (dict(equity=0.0), Desired(MES, 1, 4900.0), "equity"),
])
def test_sanity_limits_block_entry(tmp_path, kw, desired, why):
    b = FakeBroker(**kw)
    out = rec(b, tmp_path).reconcile({MES: desired}, [MES], expected_prices={MES: 5000.0})
    assert b.calls == [] and why in out[-1]["message"]


def test_missing_broker_is_skipped(tmp_path):
    out = Reconciler({}, orders_path=tmp_path / "o.jsonl", log=lambda m: None, dry_run=False).reconcile(
        {MES: Desired(MES, 1, 4900.0)}, [MES])
    assert out == []


def test_broker_errors_do_not_propagate(tmp_path):
    class Boom(FakeBroker):
        def positions(self):
            raise RuntimeError("down")

    assert rec(Boom(), tmp_path).reconcile({MES: Desired(MES, 1, 4900.0)}, [MES]) == []


def test_desired_from_engine_handles_nan_target():
    import pandas as pd

    from tradingbot.backtest import Engine, Trade
    from tradingbot.risk import RiskConfig

    e = Engine(RiskConfig(), 100_000)
    t = pd.Timestamp("2024-01-01", tz="UTC")
    e.pos[MES] = Trade(MES, -1, 3.0, t, 5000.0, 5100.0, float("nan"), 100.0)
    assert desired_from_engine(e) == {MES: Desired(MES, -3.0, 5100.0, None)}


# ---------------------------------------------------------- paper.py wiring
def cfg(tmp_path, execution):
    return PaperConfig(legs=[MES, "BTCUSDT"], state_dir=str(tmp_path), execution=execution)


def test_unconstructable_broker_does_not_crash(tmp_path):
    def factory(name):
        raise RuntimeError(f"missing environment variable for {name}")

    logs = []
    pt = PaperTrader(cfg(tmp_path, "dry_run"), log=logs.append, broker_factory=factory)
    assert pt.execute() == []
    assert any("broker unavailable" in m for m in logs)


def test_execute_uses_engine_positions(tmp_path):
    import pandas as pd

    from tradingbot.backtest import Trade

    b = FakeBroker()
    pt = PaperTrader(cfg(tmp_path, "live"), log=lambda m: None, broker_factory=lambda n: b if n == "ibkr" else (_ for _ in ()).throw(RuntimeError("x")))
    t = pd.Timestamp("2024-01-01", tz="UTC")
    pt.state["engine_obj"].pos[MES] = Trade(MES, 1, 2.0, t, 5000.0, 4900.0, float("nan"), 100.0)
    pt.execute()
    assert b.calls == [("open", MES, 2.0, 4900.0, None)]
    assert (tmp_path / "orders.jsonl").exists()


def test_config_validates_execution(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text("legs: [MES]\nexecution: yolo\n")
    with pytest.raises(ValueError):
        PaperConfig.load(p)
    p.write_text("legs: [MES]\n")
    assert PaperConfig.load(p).execution == "sim"
