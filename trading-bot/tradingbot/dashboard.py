"""Local web dashboard for testing the system in a browser.

    uv run tradingbot dashboard            # http://127.0.0.1:8050
    uv run tradingbot dashboard --auto-paper   # also ticks the paper trader every bar

Everything runs locally on simulated fills; nothing is sent to a broker.
"""

from __future__ import annotations

import json
import math
import threading
import time
import traceback
import uuid
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import pandas as pd

from . import data, metrics
from .backtest import Trade, run_backtest
from .instruments import INSTRUMENTS, get_instrument
from .paper import TF_DELTA, PaperConfig, PaperTrader, replay
from .risk import KILL_SWITCH_FILE, RiskConfig, kill_switch_active
from .strategies import STRATEGIES
from .walkforward import bars_per_day, resample, walk_forward

ROOT = Path(__file__).resolve().parent.parent
WEB = Path(__file__).resolve().parent / "web"
SETTINGS = ROOT / "config" / "settings.yaml"
PAPER_CFG = ROOT / "config" / "paper.yaml"


# ------------------------------------------------------------------ helpers

def clean(o):
    """Make results JSON-safe (numpy, timestamps, NaN/inf -> null)."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (pd.Timestamp, datetime, date)):
        return o.isoformat()
    if isinstance(o, np.generic):
        o = o.item()
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


def series(s: pd.Series, n: int = 600) -> dict:
    if len(s) > n:
        s = s.iloc[np.unique(np.linspace(0, len(s) - 1, n).astype(int))]
    return {"t": [t.isoformat() for t in s.index], "v": [round(float(v), 2) for v in s.to_numpy()]}


def trade_rows(trades: list[Trade], limit: int = 300) -> list[dict]:
    return [{**t.to_dict(), "r": round(t.r_multiple, 2)} for t in trades[-limit:][::-1]]


def by_symbol(trades: list[Trade]) -> list[dict]:
    rows: dict[str, dict] = {}
    for t in trades:
        r = rows.setdefault(t.symbol, {"symbol": t.symbol, "trades": 0, "wins": 0, "net_pnl": 0.0, "financing": 0.0})
        r["trades"] += 1
        r["wins"] += t.pnl > 0
        r["net_pnl"] += t.pnl
        r["financing"] += t.financing
    return sorted(rows.values(), key=lambda r: -r["net_pnl"])


def open_rows(eng) -> list[dict]:
    out = []
    for s, t in eng.pos.items():
        last = eng.last_close.get(s, t.entry_price)
        out.append({"symbol": s, "side": "long" if t.direction == 1 else "short", "qty": t.qty,
                    "entry_time": t.entry_time, "entry": t.entry_price, "stop": t.stop,
                    "target": None if np.isnan(t.target) else t.target, "last": last,
                    "unrealised": eng._usd_mark(s, last), "financing": t.financing})
    return out


def risk_state(eng) -> dict:
    rm, eq = eng.rm, eng.equity()
    return {"halted": rm.halted, "day_blocked": rm.day_blocked, "kill_switch": kill_switch_active(),
            "today_pct": (eq / rm.day_start_equity - 1) * 100 if rm.day_start_equity else 0,
            "drawdown_pct": (1 - eq / rm.peak_equity) * 100 if rm.peak_equity else 0}


def file_tail_time(p: Path) -> str | None:
    if not p.exists():
        return None
    with open(p, "rb") as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 400))
        last = f.read().decode(errors="ignore").strip().splitlines()[-1]
    return last.split(",")[0]


def data_status() -> list[dict]:
    out = []
    for sym, inst in INSTRUMENTS.items():
        base = "ES" if sym == "MES" else sym
        candidates = [data.data_path(base), data.data_path(base, "yahoo")]
        p = next((c for c in candidates if c.exists()), None)
        out.append({"symbol": sym, "file": p.name if p else None, "last": file_tail_time(p) if p else None,
                    "daily": data.data_path(base, "yahoo", "1d").exists() or data.data_path(base, "", "1d").exists()})
    return out


# --------------------------------------------------------------------- jobs

class Jobs:
    """Background jobs, run one at a time (the machine has few CPUs)."""

    def __init__(self):
        self.jobs: dict[str, dict] = {}
        self.run_lock = threading.Lock()

    def submit(self, kind: str, fn) -> dict:
        jid = uuid.uuid4().hex[:10]
        job = {"id": jid, "kind": kind, "status": "queued", "log": [], "result": None, "error": None,
               "created": time.time()}
        self.jobs[jid] = job
        for old in sorted(self.jobs.values(), key=lambda j: j["created"])[:-50]:
            self.jobs.pop(old["id"], None)

        def log(msg):
            job["log"] = (job["log"] + [str(msg)])[-100:]

        def run():
            with self.run_lock:
                job["status"] = "running"
                try:
                    job["result"] = clean(fn(log))
                    job["status"] = "done"
                except Exception as e:
                    job["error"] = f"{type(e).__name__}: {e}"
                    job["status"] = "error"
                    log(traceback.format_exc())

        threading.Thread(target=run, daemon=True).start()
        return job

    def busy(self, kind: str) -> dict | None:
        return next((j for j in self.jobs.values() if j["kind"] == kind and j["status"] in ("queued", "running")), None)


JOBS = Jobs()


# ------------------------------------------------------------- job bodies

def _paper_cfg() -> PaperConfig:
    return PaperConfig.load(PAPER_CFG)


def job_replay(body: dict, log) -> dict:
    cfg = _paper_cfg()
    cfg.strategy = body.get("strategy") or cfg.strategy
    cfg.timeframe = body.get("timeframe") or cfg.timeframe
    cfg.long_only = bool(body.get("long_only", cfg.long_only))
    cfg.equity = float(body.get("equity") or cfg.equity)
    cfg.legs = [get_instrument(s).symbol for s in body.get("symbols") or cfg.legs]
    if body.get("risk_per_trade"):
        cfg.risk.risk_per_trade = min(0.05, max(0.0005, float(body["risk_per_trade"]) / 100))
    if body.get("sit_out"):
        cfg.min_train_score = 0.0
    days = int(min(365, max(14, int(body.get("days") or 90))))
    out = replay(cfg, days, log=log)
    res, eng = out["result"], out["engine"]
    m = metrics.compute(res)
    return {
        "metrics": m, "accept": metrics.acceptance(m), "equity": series(res.equity),
        "initial_equity": cfg.equity, "start": out["start"], "end": out["end"],
        "final_equity": eng.equity(), "trades": trade_rows(res.trades), "by_symbol": by_symbol(res.trades),
        "open": open_rows(eng), "fits": out["fits"], "notes": out["notes"], "risk_events": res.risk_events,
        "risk": risk_state(eng), "config": {"strategy": cfg.strategy, "timeframe": cfg.timeframe,
                                             "days": days, "legs": cfg.legs,
                                             "risk_per_trade": cfg.risk.risk_per_trade},
    }


def job_backtest(body: dict, log) -> dict:
    inst = get_instrument(body.get("symbol") or "BTCUSDT")
    strat = body.get("strategy") or "trend"
    tf = body.get("timeframe") or "4h"
    long_only = bool(body.get("long_only"))
    mode = body.get("mode") or "walkforward"
    risk = RiskConfig.load(SETTINGS)
    interval = "1d" if tf == "1D" else "1h"
    bars = data.load_symbol(inst.symbol, "", interval)
    if bars is None:
        log("no cached data, downloading")
        src = "yahoo" if inst.broker != "binance" else "binance"
        bars = data.download(inst, days=2400, source=src, interval=interval)
    if tf == "4h":
        bars = resample(bars, "4h")
    funding = data.load_funding(inst.symbol) if inst.broker == "binance" else None
    folds = []
    if mode == "walkforward":
        train_days, test_days = (1095, 365) if tf == "1D" else (365, 90)
        bpd = bars_per_day(bars)
        log(f"walk-forward {inst.symbol} {strat} {tf}: {len(bars)} bars")
        wf = walk_forward(bars, inst, strat, int(train_days * bpd), int(test_days * bpd), risk=risk,
                          long_only=long_only, usd_quote_rate=150.0, funding=funding,
                          min_score=0.0 if body.get("sit_out") else float("-inf"))
        if not wf.folds:
            raise RuntimeError(f"not enough history for one {train_days}+{test_days} day fold")
        res = wf.oos
        folds = wf.folds_frame().to_dict("records")
    else:
        log(f"fixed-parameter backtest {inst.symbol} {strat} {tf}")
        sig = STRATEGIES[strat]().generate(bars)
        if long_only:
            sig.loc[sig["entry"] < 0, "entry"] = 0
        res = run_backtest(bars, sig, inst, risk=risk, usd_quote_rate=150.0, funding=funding, strategy_name=strat)
    m = metrics.compute(res)
    return {"metrics": m, "accept": metrics.acceptance(m), "equity": series(res.equity),
            "initial_equity": res.initial_equity, "trades": trade_rows(res.trades, 200), "folds": folds,
            "range": [bars.index[0], bars.index[-1]], "bars": len(bars),
            "config": {"symbol": inst.symbol, "strategy": strat, "timeframe": tf, "mode": mode,
                       "long_only": long_only}}


def paper_status() -> dict:
    cfg = _paper_cfg()
    base = {"config": {"strategy": cfg.strategy, "timeframe": cfg.timeframe, "legs": cfg.legs,
                       "equity": cfg.equity, "refit_days": cfg.refit_days, "train_days": cfg.train_days}}
    if not (cfg.dir / "state.json").exists():
        return {**base, "initialised": False}
    pt = PaperTrader(cfg, log=lambda m: None)
    eng = pt.state["engine_obj"]
    eq_p, tr_p = cfg.dir / "equity.csv", cfg.dir / "trades.csv"
    eq = pd.Series(dtype=float)
    if eq_p.exists():
        e = pd.read_csv(eq_p)
        eq = pd.Series(e["equity"].to_numpy(), index=pd.to_datetime(e["time"], utc=True))
    trades = pd.read_csv(tr_p).iloc[::-1].head(200).to_dict("records") if tr_p.exists() else []
    last_bar = max(pt.state["last_time"].values()) if pt.state["last_time"] else None
    return {**base, "initialised": True, "started": pt.state["started"], "last_bar": last_bar,
            "equity_now": eng.equity(), "initial_equity": eng.initial_equity, "risk": risk_state(eng),
            "open": open_rows(eng),
            "pending": [{"symbol": s, "side": "long" if v[0] == 1 else "short"} for s, v in eng.pending_entry.items()],
            "trades": trades, "equity": series(eq) if len(eq) else {"t": [], "v": []},
            "params": pt.state["params"],
            "next_tick": (pd.Timestamp.now(tz="UTC").floor(TF_DELTA[cfg.timeframe]) + TF_DELTA[cfg.timeframe]
                          + pd.Timedelta(minutes=cfg.delay_minutes))}


def job_paper_tick(body: dict, log) -> dict:
    pt = PaperTrader(_paper_cfg(), log=log)
    return pt.tick()


def job_refresh(body: dict, log) -> dict:
    done, failed = [], []
    for sym, inst in INSTRUMENTS.items():
        if sym == "MES":
            continue
        try:
            data.refresh(inst, log)
            done.append(sym)
        except Exception as e:
            log(f"{sym}: failed ({e})")
            failed.append(sym)
    return {"updated": done, "failed": failed}


def overview() -> dict:
    risk = RiskConfig.load(SETTINGS)
    cfg = _paper_cfg()
    return {
        "instruments": [{"symbol": i.symbol, "broker": i.broker, "broker_symbol": i.broker_symbol,
                         "group": i.group, "spread": i.spread, "commission_pct": i.commission_pct,
                         "commission_per_qty": i.commission_per_qty, "multiplier": i.multiplier,
                         "financing_long": i.financing_long, "financing_short": i.financing_short}
                        for i in INSTRUMENTS.values()],
        "strategies": {k: v.__doc__.strip().splitlines()[0] for k, v in STRATEGIES.items()},
        "risk": risk.__dict__, "paper_legs": cfg.legs, "kill_switch": kill_switch_active(),
        "data": data_status(),
    }


# -------------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "tradingbot-dashboard"

    def log_message(self, fmt, *args):  # quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code: int = 200) -> None:
        self._send(code, json.dumps(clean(obj)).encode(), "application/json")

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path in ("/", "/index.html"):
                return self._send(200, (WEB / "index.html").read_bytes(), "text/html; charset=utf-8")
            if path == "/api/overview":
                return self._json(overview())
            if path == "/api/paper":
                return self._json(paper_status())
            if path == "/api/research":
                p = ROOT / "RESEARCH.md"
                return self._json({"markdown": p.read_text() if p.exists() else ""})
            if path.startswith("/api/jobs/"):
                job = JOBS.jobs.get(path.rsplit("/", 1)[-1])
                return self._json(job) if job else self._json({"error": "unknown job"}, 404)
            if path == "/healthz":
                return self._json({"ok": True})
            self._json({"error": "not found"}, 404)
        except Exception as e:
            self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            jobs = {"/api/replay": ("replay", job_replay), "/api/backtest": ("backtest", job_backtest),
                    "/api/paper/tick": ("paper_tick", job_paper_tick), "/api/data/refresh": ("refresh", job_refresh)}
            if path in jobs:
                kind, fn = jobs[path]
                if kind in ("paper_tick", "refresh") and (running := JOBS.busy(kind)):
                    return self._json(running)
                return self._json(JOBS.submit(kind, lambda log: fn(body, log)))
            if path == "/api/paper/reset":
                d = _paper_cfg().dir
                if d.exists():
                    for f in d.glob("*"):
                        f.unlink()
                return self._json({"ok": True})
            if path == "/api/killswitch":
                if body.get("on"):
                    KILL_SWITCH_FILE.write_text(f"set from dashboard {pd.Timestamp.now(tz='UTC').isoformat()}\n")
                else:
                    KILL_SWITCH_FILE.unlink(missing_ok=True)
                return self._json({"kill_switch": kill_switch_active()})
            self._json({"error": "not found"}, 404)
        except Exception as e:
            self._json({"error": f"{type(e).__name__}: {e}"}, 400)


def _auto_paper(stop: threading.Event) -> None:
    cfg = _paper_cfg()
    delta = TF_DELTA[cfg.timeframe]
    while not stop.is_set():
        if not JOBS.busy("paper_tick"):
            JOBS.submit("paper_tick", lambda log: job_paper_tick({}, log))
        now = pd.Timestamp.now(tz="UTC")
        nxt = now.floor(delta) + delta + pd.Timedelta(minutes=cfg.delay_minutes)
        stop.wait(max(30.0, (nxt - now).total_seconds()))


def serve(host: str = "127.0.0.1", port: int = 8050, auto_paper: bool = False) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    stop = threading.Event()
    if auto_paper:
        threading.Thread(target=_auto_paper, args=(stop,), daemon=True).start()
    print(f"dashboard on http://{host}:{port}  (auto paper trading: {'on' if auto_paper else 'off'})", flush=True)
    try:
        httpd.serve_forever()
    finally:
        stop.set()
