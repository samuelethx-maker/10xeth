import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import numpy as np
import pandas as pd
import pytest

from tradingbot import dashboard, data, risk
from tradingbot.backtest import Trade


@pytest.fixture()
def server(tmp_path, monkeypatch):
    ks = tmp_path / "KILL_SWITCH"
    monkeypatch.setattr(risk, "KILL_SWITCH_FILE", ks)
    monkeypatch.setattr(dashboard, "KILL_SWITCH_FILE", ks)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), dashboard.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}", ks
    httpd.shutdown()


def _get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return r.status, r.read()


def _post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def test_clean_makes_json_safe():
    out = dashboard.clean({"a": np.float64(1.5), "b": float("nan"), "c": [np.inf, pd.Timestamp("2024-01-01", tz="UTC")],
                           "d": np.int64(3)})
    assert out == {"a": 1.5, "b": None, "c": [None, "2024-01-01T00:00:00+00:00"], "d": 3}
    json.dumps(out, allow_nan=False)


def test_page_overview_and_kill_switch(server):
    base, ks = server
    status, html = _get(base + "/")
    assert status == 200 and b"Trading Bot" in html
    ov = json.loads(_get(base + "/api/overview")[1])
    assert {i["symbol"] for i in ov["instruments"]} >= {"GBPJPY", "XAUUSD", "BTCUSDT", "ES", "MES"}
    assert set(ov["strategies"]) >= {"trend", "meanrev", "momentum"}
    assert _post(base + "/api/killswitch", {"on": True}) == {"kill_switch": True} and ks.exists()
    assert _post(base + "/api/killswitch", {"on": False}) == {"kill_switch": False} and not ks.exists()


def test_unknown_routes_404(server):
    base, _ = server
    with pytest.raises(urllib.error.HTTPError) as e:
        _get(base + "/api/nope")
    assert e.value.code == 404


# ------------------------------------------------------------ analytics

def _trade(entry, exit_, pnl, risk_usd=100.0, sym="XAUUSD"):
    return Trade(symbol=sym, direction=1, qty=1, entry_time=pd.Timestamp(entry, tz="UTC"), entry_price=100, stop=99,
                 target=float("nan"), risk_usd=risk_usd, exit_time=pd.Timestamp(exit_, tz="UTC"), exit_price=101,
                 pnl=pnl, exit_reason="signal")


def test_monthly_returns_first_month_vs_initial():
    idx = pd.to_datetime(["2024-01-15", "2024-01-31", "2024-02-15", "2024-02-29", "2024-03-10"], utc=True)
    eq = pd.Series([100, 110, 105, 99, 108.9], index=idx, dtype=float)
    rows = dashboard.monthly_returns(eq, 100.0)
    assert [(r["y"], r["m"]) for r in rows] == [(2024, 1), (2024, 2), (2024, 3)]
    assert [r["ret"] for r in rows] == [10.0, -10.0, 10.0]
    assert rows[0]["pnl"] == 10.0
    assert dashboard.monthly_returns(pd.Series(dtype=float), 100.0) == []


def test_perf_stats():
    trades = [_trade("2024-01-01", "2024-01-03", 200), _trade("2024-01-05", "2024-01-06", -100),
              _trade("2024-01-07", "2024-01-08", -50), _trade("2024-01-09", "2024-01-10", -50),
              _trade("2024-01-11", "2024-01-12", 100)]
    idx = pd.date_range("2024-01-01", periods=12, freq="D", tz="UTC")
    eq = pd.Series([100, 102, 104, 104, 103, 103, 102, 101, 101, 100, 101, 102], index=idx, dtype=float) * 1000
    s = dashboard.perf_stats(eq, trades, 100_000)
    assert s["trades"] == 5 and s["net_pnl"] == 100
    assert s["win_rate_pct"] == 40.0
    assert s["profit_factor"] == pytest.approx(300 / 200)
    assert s["avg_win"] == 150 and s["avg_loss"] == pytest.approx(-200 / 3)
    assert s["expectancy"] == 20 and s["expectancy_r"] == pytest.approx(0.2)
    assert s["longest_losing_streak"] == 3
    assert s["max_dd_pct"] == pytest.approx((1 - 100 / 104) * 100)
    # 2 + 1 + 1 + 1 + 1 days of positions over an 11 day window
    assert s["exposure_pct"] == pytest.approx(6 / 11 * 100)
    json.dumps(dashboard.clean(s), allow_nan=False)


def test_perf_stats_empty_and_all_wins():
    idx = pd.date_range("2024-01-01", periods=3, freq="D", tz="UTC")
    s = dashboard.perf_stats(pd.Series([1.0, 1.0, 1.0], index=idx) * 1000, [], 1000)
    assert s["trades"] == 0 and s["exposure_pct"] == 0 and s["longest_losing_streak"] == 0
    s = dashboard.perf_stats(pd.Series([1.0, 2.0], index=idx[:2]) * 1000, [_trade("2024-01-01", "2024-01-02", 5)], 1000)
    assert s["profit_factor"] == float("inf") and dashboard.clean(s)["profit_factor"] is None


def test_drawdown_series_and_risk_events():
    idx = pd.date_range("2024-01-01", periods=4, freq="D", tz="UTC")
    dd = dashboard.drawdown_series(pd.Series([100.0, 110.0, 99.0, 110.0], index=idx))
    assert dd["v"] == [0.0, 0.0, -10.0, 0.0]
    ev = dashboard.parse_risk_events(["2024-01-02 04:00:00+00:00: daily loss limit hit, flat for the day",
                                      "2024-02-01 00:00:00+00:00: max drawdown hit, trading halted", "garbage"])
    assert [e["kind"] for e in ev] == ["daily_limit", "halt"] and ev[0]["t"].startswith("2024-01-02T04:00")


# ------------------------------------------------------------ candles + hardening

@pytest.fixture()
def fake_bars(monkeypatch):
    idx = pd.date_range("2024-03-01", periods=24 * 40, freq="h", tz="UTC")
    base = np.linspace(100, 140, len(idx))
    df = pd.DataFrame({"open": base, "high": base + 1, "low": base - 1, "close": base + 0.5, "volume": 1.0}, index=idx)
    monkeypatch.setattr(data, "load_symbol", lambda sym, source="", interval="1h": df)
    return df


def test_candles_endpoint(server, fake_bars):
    base, _ = server
    d = json.loads(_get(base + "/api/candles?symbol=XAUUSD&tf=4h&start=2024-03-05&end=2024-03-10")[1])
    assert d["symbol"] == "XAUUSD" and d["tf"] == "4h" and d["n"] == len(d["t"]) == len(d["o"]) == len(d["h"]) > 20
    assert all(h >= max(o, c) for o, h, c in zip(d["o"], d["h"], d["c"])) and not d["truncated"]
    assert d["t"][0] >= "2024-03-05" and d["t"][-1] <= "2024-03-10T00:00:00+00:00"
    d = json.loads(_get(base + "/api/candles?symbol=XAUUSD&tf=1h&limit=100000")[1])
    assert d["n"] == dashboard.MAX_BARS and d["truncated"]
    assert json.loads(_get(base + "/api/candles?symbol=XAUUSD&tf=1D")[1])["n"] == 40


@pytest.mark.parametrize("qs", ["", "?symbol=NOPE", "?symbol=XAUUSD&tf=5m", "?symbol=XAUUSD&start=banana",
                                "?symbol=XAUUSD&limit=abc"])
def test_candles_bad_params_are_json_400(server, fake_bars, qs):
    base, _ = server
    with pytest.raises(urllib.error.HTTPError) as e:
        _get(base + "/api/candles" + qs)
    assert e.value.code == 400 and "error" in json.loads(e.value.read())


def test_candles_no_data_is_404(server, monkeypatch):
    base, _ = server
    monkeypatch.setattr(data, "load_symbol", lambda *a, **k: None)
    with pytest.raises(urllib.error.HTTPError) as e:
        _get(base + "/api/candles?symbol=XAUUSD")
    assert e.value.code == 404


def _raw_post(url, raw: bytes):
    req = urllib.request.Request(url, raw, {"Content-Type": "application/json"})
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(req, timeout=10)
    return e.value.code, json.loads(e.value.read())


def test_post_validation_and_size_limit(server):
    base, _ = server
    code, body = _raw_post(base + "/api/killswitch", b"x" * (dashboard.MAX_BODY + 10))
    assert code == 413 and "too large" in body["error"]
    assert _raw_post(base + "/api/killswitch", b"{nope")[0] == 400
    assert _raw_post(base + "/api/killswitch", b"[1]")[0] == 400
    assert _raw_post(base + "/api/replay", json.dumps({"strategy": "nope"}).encode())[0] == 400
    assert _raw_post(base + "/api/replay", json.dumps({"symbols": ["NOPE"]}).encode())[0] == 400
    assert _raw_post(base + "/api/replay", json.dumps({"days": "x"}).encode())[0] == 400
    assert _raw_post(base + "/api/backtest", json.dumps({"timeframe": "9m"}).encode())[0] == 400


def test_security_headers(server):
    base, _ = server
    with urllib.request.urlopen(base + "/") as r:
        assert r.headers["X-Content-Type-Options"] == "nosniff" and "default-src 'self'" in r.headers["Content-Security-Policy"]
        assert b"https://" not in r.read().replace(b"http://127", b"")  # no external assets


def test_default_bind_is_loopback():
    import inspect
    assert inspect.signature(dashboard.serve).parameters["host"].default == "127.0.0.1"
