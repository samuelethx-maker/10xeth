"""Broker adapters against mocked HTTP / a fake ib object. No network, no credentials."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
import requests
import responses

from tradingbot.brokers import get_broker
from tradingbot.brokers.base import fmt_num, request_with_retry
from tradingbot.brokers.binance import BinanceFuturesBroker
from tradingbot.brokers.ibkr import IBKRBroker
from tradingbot.brokers.oanda import OandaBroker
from tradingbot.instruments import get_instrument

OANDA = "https://api-fxpractice.oanda.com/v3/accounts/ACC"
BIN = "https://testnet.binancefuture.com"
nosleep = lambda s: None  # noqa: E731


def oanda() -> OandaBroker:
    return OandaBroker("tok", "ACC", sleep=nosleep)


def binance() -> BinanceFuturesBroker:
    return BinanceFuturesBroker("k", "s", sleep=nosleep)


def posted(method="POST", contains=""):
    return [c for c in responses.calls if c.request.method == method and contains in c.request.url]


# ------------------------------------------------------------------ generic
def test_fmt_num_never_scientific():
    assert fmt_num(1_000_000) == "1000000"
    assert fmt_num(0.00001) == "0.00001"
    assert fmt_num(0.1 + 0.2) == "0.30000000000000004"


@responses.activate
def test_retry_on_429_then_503_then_success():
    responses.get(f"{OANDA}/summary", status=429, headers={"Retry-After": "1"})
    responses.get(f"{OANDA}/summary", status=503)
    responses.get(f"{OANDA}/summary", json={"account": {"NAV": "1234.5"}})
    assert oanda().equity() == 1234.5
    assert len(responses.calls) == 3


@responses.activate
def test_retry_on_connection_error_then_gives_up():
    responses.get("http://x/y", body=requests.ConnectionError("boom"))
    with pytest.raises(requests.ConnectionError):
        request_with_retry(requests.Session(), "GET", "http://x/y", retries=2, sleep=nosleep)
    assert len(responses.calls) == 3


def test_live_url_guard(monkeypatch):
    monkeypatch.delenv("ALLOW_LIVE", raising=False)
    with pytest.raises(RuntimeError, match="non-practice"):
        OandaBroker("t", "a", "https://api-fxtrade.oanda.com")
    with pytest.raises(RuntimeError, match="non-testnet"):
        BinanceFuturesBroker("k", "s", "https://fapi.binance.com")
    with pytest.raises(RuntimeError, match="non-paper"):
        IBKRBroker(port=7496, ib=object())
    monkeypatch.setenv("ALLOW_LIVE", "1")
    OandaBroker("t", "a", "https://api-fxtrade.oanda.com")  # explicit opt-in only
    with pytest.raises(ValueError):
        get_broker("nope")


# -------------------------------------------------------------------- OANDA
FILL = {"orderFillTransaction": {"id": "77", "price": "150.123"}}


def trade(stop=True):
    t = {"id": "5", "instrument": "USD_JPY", "currentUnits": "1000"}
    if stop:
        t["stopLossOrder"] = {"id": "6", "price": "149.000", "state": "PENDING"}
    return t


@responses.activate
def test_oanda_order_ok_and_stop_confirmed():
    responses.post(f"{OANDA}/orders", json=FILL, status=201)
    responses.get(f"{OANDA}/openTrades", json={"trades": [trade()]})
    r = oanda().market_order(get_instrument("USDJPY"), -1000, stop=151.0, target=148.0, client_id="cid1")
    assert r.ok and r.fill_price == 150.123
    body = json.loads(posted()[0].request.body)["order"]
    assert body["units"] == "-1000" and body["clientExtensions"] == {"id": "cid1"}
    assert body["stopLossOnFill"]["price"] == "151" and body["takeProfitOnFill"]["price"] == "148"


@responses.activate
def test_oanda_no_duplicate_when_first_post_actually_succeeded():
    responses.post(f"{OANDA}/orders", status=503)  # response lost, order really placed
    responses.get(f"{OANDA}/orders/@cid1", json={"order": {"id": "9", "state": "FILLED", "fillingTransactionID": "77"}})
    responses.get(f"{OANDA}/transactions/77", json={"transaction": {"price": "150.5"}})
    responses.get(f"{OANDA}/openTrades", json={"trades": [trade()]})
    r = oanda().market_order(get_instrument("USDJPY"), 1000, stop=149.0, client_id="cid1")
    assert r.ok and r.fill_price == 150.5
    assert len(posted()) == 1


@responses.activate
def test_oanda_reposts_when_lookup_says_order_never_arrived():
    responses.post(f"{OANDA}/orders", body=requests.Timeout("slow"))
    responses.get(f"{OANDA}/orders/@cid1", status=404)
    responses.post(f"{OANDA}/orders", json=FILL, status=201)
    responses.get(f"{OANDA}/openTrades", json={"trades": [trade()]})
    assert oanda().market_order(get_instrument("USDJPY"), 1000, stop=149.0, client_id="cid1").ok
    assert len(posted()) == 2


@responses.activate
def test_oanda_missing_stop_flattens():
    responses.post(f"{OANDA}/orders", json=FILL, status=201)
    responses.get(f"{OANDA}/openTrades", json={"trades": [trade(stop=False)]})
    responses.put(f"{OANDA}/trades/5/orders", status=400, json={"errorMessage": "nope"})
    responses.get(f"{OANDA}/positions/USD_JPY", json={"position": {"long": {"units": "1000"}, "short": {"units": "0"}}})
    responses.put(f"{OANDA}/positions/USD_JPY/close", json={"longOrderFillTransaction": {}})
    r = oanda().market_order(get_instrument("USDJPY"), 1000, stop=149.0)
    assert not r.ok and "flattened" in r.message
    assert len(posted("PUT", "/close")) == 1


def test_oanda_refuses_without_stop():
    assert not oanda().market_order(get_instrument("USDJPY"), 1000).ok


@responses.activate
def test_oanda_positions_orders_price():
    responses.get(f"{OANDA}/openPositions", json={"positions": [
        {"instrument": "USD_JPY", "long": {"units": "0"}, "short": {"units": "-500"}}]})
    responses.get(f"{OANDA}/openTrades", json={"trades": [trade()]})
    responses.get(f"{OANDA}/pricing", json={"prices": [{"bids": [{"price": "1.0"}], "asks": [{"price": "1.2"}]}]})
    b = oanda()
    assert b.positions() == {"USDJPY": -500.0}
    assert b.open_orders()[0]["type"] == "stop" and b.open_orders()[0]["price"] == 149.0
    assert b.price(get_instrument("USDJPY")) == pytest.approx(1.1)


# ------------------------------------------------------------------ Binance
EXCHANGE_INFO = {"symbols": [{"symbol": "BTCUSDT", "filters": [
    {"filterType": "LOT_SIZE", "stepSize": "0.001", "minQty": "0.001"},
    {"filterType": "PRICE_FILTER", "tickSize": "0.10"},
    {"filterType": "MIN_NOTIONAL", "notional": "100"},
]}]}
BTC = get_instrument("BTCUSDT")


def binance_common():
    responses.get(f"{BIN}/fapi/v1/exchangeInfo", json=EXCHANGE_INFO)
    responses.get(f"{BIN}/fapi/v1/ticker/price", json={"price": "60000"})


@responses.activate
def test_binance_filters_round_and_cache():
    binance_common()
    b = binance()
    assert b.round_qty(BTC, -0.0019) == 0.001
    assert b.round_qty(BTC, 0.0004) == 0.0
    assert b.round_price(BTC, 59999.97) == 60000.0
    assert b.round_price(BTC, 59999.94) == 59999.9
    assert len(posted("GET", "exchangeInfo")) == 1
    assert b.min_test_qty(BTC) >= 100 * 1.1 / 60000


@responses.activate
def test_binance_min_notional_rejected():
    binance_common()
    r = binance().market_order(BTC, 0.001, stop=59000)  # $60 < $100
    assert not r.ok and "MIN_NOTIONAL" in r.message and not posted()


@responses.activate
def test_binance_entry_with_stop_and_target():
    binance_common()
    responses.post(f"{BIN}/fapi/v1/order", json={"orderId": 1, "status": "FILLED", "avgPrice": "60001.5"})
    responses.post(f"{BIN}/fapi/v1/algoOrder", json={"algoId": 2})
    responses.post(f"{BIN}/fapi/v1/algoOrder", json={"algoId": 3})
    responses.get(f"{BIN}/fapi/v1/openOrders", json=[])
    responses.get(f"{BIN}/fapi/v1/openAlgoOrders", json=[
        {"algoId": 2, "clientAlgoId": "c-sl", "symbol": "BTCUSDT", "orderType": "STOP_MARKET", "triggerPrice": "59000"}])
    r = binance().market_order(BTC, 0.0021, stop=59000.04, target=62000, client_id="cid1")
    assert r.ok and r.fill_price == 60001.5
    entry, stop_o, tp_o = [c.request.url for c in posted()]
    assert "quantity=0.002&" in entry and "newClientOrderId=cid1" in entry and "signature=" in entry
    assert "triggerPrice=59000&" in stop_o and "clientAlgoId=cid1-sl" in stop_o and "side=SELL" in stop_o
    assert "TAKE_PROFIT_MARKET" in tp_o


@responses.activate
def test_binance_no_duplicate_entry_on_retry():
    binance_common()
    responses.post(f"{BIN}/fapi/v1/order", status=503)
    responses.get(f"{BIN}/fapi/v1/order", json={"orderId": 1, "status": "FILLED", "avgPrice": "60000"})
    responses.post(f"{BIN}/fapi/v1/algoOrder", json={"algoId": 2})
    responses.get(f"{BIN}/fapi/v1/openOrders", json=[])
    responses.get(f"{BIN}/fapi/v1/openAlgoOrders", json=[
        {"algoId": 2, "symbol": "BTCUSDT", "orderType": "STOP_MARKET", "triggerPrice": "59000"}])
    assert binance().market_order(BTC, 0.002, stop=59000, client_id="cid1").ok
    assert len(posted("POST", "/fapi/v1/order")) == 1
    assert "origClientOrderId=cid1" in posted("GET", "/fapi/v1/order?")[0].request.url


@responses.activate
def test_binance_stop_failure_flattens():
    binance_common()
    responses.post(f"{BIN}/fapi/v1/order", json={"orderId": 1, "status": "FILLED", "avgPrice": "60000"})
    responses.post(f"{BIN}/fapi/v1/algoOrder", status=400, json={"code": -4120, "msg": "bad"})
    responses.delete(f"{BIN}/fapi/v1/allOpenOrders", json={})
    responses.delete(f"{BIN}/fapi/v1/algoOpenOrders", json={})
    responses.get(f"{BIN}/fapi/v2/positionRisk", json=[{"symbol": "BTCUSDT", "positionAmt": "0.002"}])
    responses.post(f"{BIN}/fapi/v1/order", json={"orderId": 9})
    r = binance().market_order(BTC, 0.002, stop=59000)
    assert not r.ok and "flattened" in r.message
    last = posted("POST", "/fapi/v1/order")[-1].request.url
    assert "reduceOnly=true" in last and "side=SELL" in last


@responses.activate
def test_binance_positions_and_orders_mapping():
    responses.get(f"{BIN}/fapi/v2/positionRisk", json=[
        {"symbol": "BTCUSDT", "positionAmt": "-0.5"}, {"symbol": "ETHUSDT", "positionAmt": "0"}])
    assert binance().positions() == {"BTCUSDT": -0.5}


# --------------------------------------------------------------------- IBKR
class FakeIB:
    def __init__(self, stop_status="Submitted"):
        self.pos = 0.0
        self.trades: list = []
        self.placed: list = []
        self.cancelled: list = []
        self.stop_status = stop_status
        self.client = SimpleNamespace(getReqId=lambda: 101)

    def sleep(self, _s):
        pass

    def positions(self):
        return [SimpleNamespace(position=self.pos, contract=SimpleNamespace(symbol="MES"))] if self.pos else []

    def openTrades(self):
        return [t for t in self.trades if t.orderStatus.status not in ("Filled", "Cancelled")]

    def accountSummary(self):
        return [SimpleNamespace(tag="NetLiquidation", currency="USD", value="99000")]

    def reqTickers(self, _c):
        return [SimpleNamespace(marketPrice=lambda: 5000.25, last=0, close=0)]

    def cancelOrder(self, order):
        self.cancelled.append(order)
        for t in self.trades:
            if t.order is order:
                t.orderStatus.status = "Cancelled"

    def placeOrder(self, contract, order):
        for t in self.trades:
            if t.order is order:  # modification of a live order
                return t
        self.placed.append(order)
        if not hasattr(order, "orderId"):
            order.orderId = 200 + len(self.placed)
        if order.orderType == "MKT":
            status = "Filled"
            self.pos += order.totalQuantity if order.action == "BUY" else -order.totalQuantity
        else:
            status = self.stop_status
        t = SimpleNamespace(order=order, contract=contract,
                            orderStatus=SimpleNamespace(status=status, avgFillPrice=5000.0))
        self.trades.append(t)
        return t


def _order(kind):
    def make(action, qty, price=None, **kw):
        o = SimpleNamespace(action=action, totalQuantity=qty, orderType=kind, auxPrice=0, lmtPrice=0, **kw)
        if kind == "STP":
            o.auxPrice = price
        if kind == "LMT":
            o.lmtPrice = price
        return o
    return make


IB_MOD = SimpleNamespace(MarketOrder=_order("MKT"), StopOrder=_order("STP"), LimitOrder=_order("LMT"))


def ibkr(ib):
    b = IBKRBroker(ib=ib, ib_mod=IB_MOD)
    b._contracts["MES"] = SimpleNamespace(symbol="MES")
    return b


def test_ibkr_bracket_ok_and_reads():
    ib = FakeIB()
    b = ibkr(ib)
    mes = get_instrument("MES")
    r = b.market_order(mes, 2, stop=4900.1, target=5200, client_id="ref1")
    assert r.ok
    kinds = [(o.orderType, o.orderRef) for o in ib.placed]
    assert kinds == [("MKT", "ref1"), ("STP", "ref1-sl"), ("LMT", "ref1-tp")]
    assert ib.placed[1].auxPrice == 4900.0  # rounded to tick
    assert b.positions() == {"MES": 2.0} and b.equity() == 99000 and b.price(mes) == 5000.25
    assert {o["type"] for o in b.open_orders(mes)} == {"stop", "target"}
    assert not b.market_order(mes, 1, stop=1.0, client_id="ref1").ok  # duplicate orderRef refused


def test_ibkr_stop_rejected_flattens():
    ib = FakeIB(stop_status="Inactive")
    b = ibkr(ib)
    r = b.market_order(get_instrument("MES"), 1, stop=4900)
    assert not r.ok and "flattened" in r.message
    assert ib.pos == 0  # closing market order was sent


def test_ibkr_set_stop_modifies_existing():
    ib = FakeIB()
    b = ibkr(ib)
    mes = get_instrument("MES")
    b.market_order(mes, 1, stop=4900)
    b.set_stop(mes, 4950)
    assert [t.order.auxPrice for t in ib.trades if t.order.orderType == "STP"] == [4950.0]


def test_ibkr_import_is_lazy():
    import sys
    assert "ib_async" not in sys.modules
