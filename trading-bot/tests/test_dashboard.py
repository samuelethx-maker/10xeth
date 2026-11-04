import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import numpy as np
import pandas as pd
import pytest

from tradingbot import dashboard, risk


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
    assert set(ov["strategies"]) == {"trend", "meanrev", "momentum"}
    assert _post(base + "/api/killswitch", {"on": True}) == {"kill_switch": True} and ks.exists()
    assert _post(base + "/api/killswitch", {"on": False}) == {"kill_switch": False} and not ks.exists()


def test_unknown_routes_404(server):
    base, _ = server
    with pytest.raises(urllib.error.HTTPError) as e:
        _get(base + "/api/nope")
    assert e.value.code == 404
