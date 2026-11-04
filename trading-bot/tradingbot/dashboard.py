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
from urllib.parse import parse_qs, urlparse

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

MAX_BODY = 1_000_000          # reject larger request bodies
MAX_BARS = 600                # candle cap per /api/candles response
TIMEFRAMES = ("1h", "4h", "1D")
AUTO_PAPER = False            # set by serve(); shown in the Paper tab


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


def _sample_idx(n_total: int, n: int) -> np.ndarray:
    if n_total <= n:
        return np.arange(n_total)
    return np.unique(np.linspace(0, n_total - 1, n).astype(int))


def series(s: pd.Series, n: int = 600) -> dict:
    s = s.iloc[_sample_idx(len(s), n)]
    return {"t": [t.isoformat() for t in s.index], "v": [round(float(v), 2) for v in s.to_numpy()]}


def drawdown_series(eq: pd.Series, n: int = 600) -> dict:
    """Underwater curve in percent (<= 0), computed at full resolution then sampled."""
    if not len(eq):
        return {"t": [], "v": []}
    dd = (eq / eq.cummax() - 1) * 100
    s = dd.iloc[_sample_idx(len(dd), n)]
    return {"t": [t.isoformat() for t in s.index], "v": [round(float(v), 3) for v in s.to_numpy()]}


def trade_rows(trades: list[Trade], limit: int = 1500) -> list[dict]:
    return [{**t.to_dict(), "r": round(t.r_multiple, 2)} for t in trades[-limit:][::-1]]


def parse_risk_events(events: list[str]) -> list[dict]:
    """'<timestamp>: <message>' strings -> {t, kind, text} (kind: halt | daily_limit)."""
    out = []
    for e in events or []:
        when, _, msg = str(e).partition(": ")
        try:
            t = pd.Timestamp(when)
            t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
        except Exception:
            continue
        out.append({"t": t.isoformat(), "kind": "halt" if "halted" in msg else "daily_limit", "text": msg})
    return out


def monthly_returns(eq: pd.Series, initial: float) -> list[dict]:
    """Calendar-month returns from month-end equity (first month vs initial equity)."""
    if not len(eq):
        return []
    idx = eq.index.tz_convert("UTC").tz_localize(None) if eq.index.tz is not None else eq.index
    end = pd.Series(eq.to_numpy(), index=idx.to_period("M")).groupby(level=0).last()
    prev = end.shift(1)
    prev.iloc[0] = initial
    return [{"y": p.year, "m": p.month, "ret": round(float((end[p] / prev[p] - 1) * 100), 3),
             "pnl": round(float(end[p] - prev[p]), 2)} for p in end.index]


def perf_stats(eq: pd.Series, trades: list[Trade], initial: float) -> dict:
    """Headline statistics from the equity curve and closed trades."""
    pnls = np.array([t.pnl for t in trades], dtype=float)
    wins, losses = pnls[pnls > 0], pnls[pnls < 0]
    gross_loss = -losses.sum()
    pf = float(wins.sum() / gross_loss) if gross_loss > 0 else (float("inf") if len(wins) else 0.0)
    final = float(eq.iloc[-1]) if len(eq) else initial
    years = (eq.index[-1] - eq.index[0]).total_seconds() / (365.25 * 86400) if len(eq) > 1 else 0.0
    cagr = ((final / initial) ** (1 / years) - 1) * 100 if years >= 1 / 365.25 and final > 0 and initial > 0 else None
    daily = eq.resample("1D").last().dropna().pct_change().dropna() if len(eq) > 1 else pd.Series(dtype=float)
    sharpe = float(daily.mean() / daily.std() * np.sqrt(252)) if len(daily) > 1 and daily.std() > 0 else 0.0
    max_dd = float(-(eq / eq.cummax() - 1).min() * 100) if len(eq) else 0.0
    streak = best = 0
    for t in sorted(trades, key=lambda t: t.exit_time or pd.Timestamp.max.tz_localize("UTC")):
        streak = streak + 1 if t.pnl < 0 else 0
        best = max(best, streak)
    exposure = None
    if len(eq) > 1:
        t0, t1 = eq.index[0], eq.index[-1]
        spans = sorted((max(t.entry_time, t0), min(t.exit_time or t1, t1)) for t in trades)
        covered, cur = pd.Timedelta(0), None
        for a, b in spans:
            if b <= a:
                continue
            if cur is None or a > cur[1]:
                covered += (cur[1] - cur[0]) if cur else pd.Timedelta(0)
                cur = [a, b]
            else:
                cur[1] = max(cur[1], b)
        covered += (cur[1] - cur[0]) if cur else pd.Timedelta(0)
        exposure = float(covered / (t1 - t0) * 100) if t1 > t0 else None
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(losses.mean()) if len(losses) else 0.0
    return {"trades": len(pnls), "net_pnl": float(pnls.sum()), "cagr_pct": cagr, "sharpe": sharpe,
            "max_dd_pct": max_dd, "profit_factor": pf,
            "win_rate_pct": float(len(wins) / len(pnls) * 100) if len(pnls) else 0.0,
            "avg_win": avg_win, "avg_loss": avg_loss,
            "payoff": abs(avg_win / avg_loss) if avg_loss else None,
            "expectancy": float(pnls.mean()) if len(pnls) else 0.0,
            "expectancy_r": float(np.mean([t.r_multiple for t in trades])) if trades else 0.0,
            "best_trade": float(pnls.max()) if len(pnls) else 0.0,
            "worst_trade": float(pnls.min()) if len(pnls) else 0.0,
            "longest_losing_streak": best, "exposure_pct": exposure}


def analytics(res, initial: float) -> dict:
    return {"stats": perf_stats(res.equity, res.trades, initial), "monthly": monthly_returns(res.equity, initial),
            "drawdown": drawdown_series(res.equity), "risk_events_parsed": parse_risk_events(res.risk_events)}


def candles(symbol: str, tf: str = "4h", start: str | None = None, end: str | None = None,
            limit: int = MAX_BARS) -> dict:
    """OHLC bars from the cached 1h history, resampled; at most `limit` (the latest) bars."""
    if symbol not in INSTRUMENTS:
        raise ValueError(f"unknown symbol {symbol!r}")
    if tf not in TIMEFRAMES:
        raise ValueError(f"tf must be one of {', '.join(TIMEFRAMES)}")
    limit = max(10, min(MAX_BARS, int(limit)))
    bars = data.load_symbol(symbol, "", "1h")
    if bars is None or bars.empty:
        raise LookupError(f"no cached price data for {symbol}")
    if tf != "1h":
        bars = resample(bars, tf)
    for val, lo in ((start, True), (end, False)):
        if val:
            ts = _parse_ts(val)
            bars = bars[bars.index >= ts] if lo else bars[bars.index <= ts]
    truncated = len(bars) > limit
    bars = bars.iloc[-limit:]
    rnd = lambda col: [round(float(v), 6) for v in bars[col].to_numpy()]  # noqa: E731
    return {"symbol": symbol, "tf": tf, "truncated": truncated, "n": len(bars),
            "t": [t.isoformat() for t in bars.index],
            "o": rnd("open"), "h": rnd("high"), "l": rnd("low"), "c": rnd("close")}


def _parse_ts(val: str) -> pd.Timestamp:
    if len(str(val)) > 40:
        raise ValueError("bad timestamp")
    try:
        ts = pd.Timestamp(val)
    except Exception:
        raise ValueError(f"bad timestamp {val!r}") from None
    if pd.isna(ts):
        raise ValueError(f"bad timestamp {val!r}")
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")


def _clamped(name: str, v, lo: float, hi: float) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number") from None
    if not math.isfinite(f) or not lo <= f <= hi:
        raise ValueError(f"{name} must be between {lo:g} and {hi:g}")
    return f


def validate_replay(body: dict) -> dict:
    out = dict(body)
    if body.get("strategy") and body["strategy"] not in STRATEGIES:
        raise ValueError(f"unknown strategy {body['strategy']!r}")
    if body.get("timeframe") and body["timeframe"] not in TF_DELTA:
        raise ValueError("timeframe must be 1h, 4h or 1D")
    syms = body.get("symbols")
    if syms is not None:
        if not isinstance(syms, list) or not syms or len(syms) > 30 or not all(isinstance(x, str) for x in syms):
            raise ValueError("symbols must be a non-empty list of market names")
        for x in syms:
            get_instrument(x)  # raises on unknown
    if body.get("equity"):
        out["equity"] = _clamped("equity", body["equity"], 1_000, 1e9)
    if body.get("risk_per_trade"):
        out["risk_per_trade"] = _clamped("risk_per_trade", body["risk_per_trade"], 0.05, 5)
    if body.get("days"):
        out["days"] = int(_clamped("days", body["days"], 14, 365))
    return out


def validate_backtest(body: dict) -> dict:
    if body.get("symbol"):
        get_instrument(str(body["symbol"]))
    if body.get("strategy") and body["strategy"] not in STRATEGIES:
        raise ValueError(f"unknown strategy {body['strategy']!r}")
    if body.get("timeframe") and body["timeframe"] not in TIMEFRAMES:
        raise ValueError("timeframe must be 1h, 4h or 1D")
    if body.get("mode") and body["mode"] not in ("walkforward", "fixed"):
        raise ValueError("mode must be walkforward or fixed")
    return dict(body)


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
        **analytics(res, cfg.equity),
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
            "initial_equity": res.initial_equity, "trades": trade_rows(res.trades), "by_symbol": by_symbol(res.trades), "folds": folds,
            "range": [bars.index[0], bars.index[-1]], "bars": len(bars),
            "risk_events": res.risk_events, **analytics(res, res.initial_equity),
            "config": {"symbol": inst.symbol, "strategy": strat, "timeframe": tf, "mode": mode,
                       "long_only": long_only}}


def last_tick_job() -> dict | None:
    ticks = [j for j in JOBS.jobs.values() if j["kind"] == "paper_tick"]
    if not ticks:
        return None
    j = max(ticks, key=lambda j: j["created"])
    return {"status": j["status"], "created": j["created"], "log": j["log"][-30:], "error": j["error"]}


def paper_status() -> dict:
    cfg = _paper_cfg()
    base = {"config": {"strategy": cfg.strategy, "timeframe": cfg.timeframe, "legs": cfg.legs,
                       "equity": cfg.equity, "refit_days": cfg.refit_days, "train_days": cfg.train_days,
                       "delay_minutes": cfg.delay_minutes},
            "auto_paper": AUTO_PAPER, "server_time": pd.Timestamp.now(tz="UTC"), "last_tick_job": last_tick_job(),
            "next_tick": (pd.Timestamp.now(tz="UTC").floor(TF_DELTA[cfg.timeframe]) + TF_DELTA[cfg.timeframe]
                          + pd.Timedelta(minutes=cfg.delay_minutes))}
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
            "drawdown": drawdown_series(eq), "params": pt.state["params"]}


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
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
                         "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code: int = 200) -> None:
        self._send(code, json.dumps(clean(obj)).encode(), "application/json")

    def _fail(self, e: Exception, code: int) -> None:
        self._json({"error": f"{type(e).__name__}: {e}" if code >= 500 else str(e).strip("'\"")}, code)

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        try:
            if path in ("/", "/index.html"):
                return self._send(200, (WEB / "index.html").read_bytes(), "text/html; charset=utf-8")
            if path == "/api/overview":
                return self._json(overview())
            if path == "/api/paper":
                return self._json(paper_status())
            if path == "/api/candles":
                q = {k: v[-1] for k, v in parse_qs(url.query, max_num_fields=12).items()}
                if "symbol" not in q:
                    raise ValueError("symbol is required")
                return self._json(candles(q["symbol"], q.get("tf", "4h"), q.get("start"), q.get("end"),
                                          int(_clamped("limit", q.get("limit", MAX_BARS), 10, MAX_BARS))))
            if path == "/api/research":
                p = ROOT / "RESEARCH.md"
                return self._json({"markdown": p.read_text() if p.exists() else ""})
            if path.startswith("/api/jobs/"):
                job = JOBS.jobs.get(path.rsplit("/", 1)[-1])
                return self._json(job) if job else self._json({"error": "unknown job"}, 404)
            if path == "/healthz":
                return self._json({"ok": True})
            self._json({"error": "not found"}, 404)
        except (ValueError, KeyError) as e:
            self._fail(e, 400)
        except LookupError as e:
            self._fail(e, 404)
        except Exception as e:
            self._fail(e, 500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                raise ValueError("bad Content-Length") from None
            if n < 0:
                raise ValueError("bad Content-Length")
            if n > MAX_BODY:
                for _ in range(min(n, 10 * MAX_BODY) // 65536 + 1):  # drain so the client can read the 413
                    self.rfile.read(65536)
                self.close_connection = True
                return self._json({"error": f"request body too large (max {MAX_BODY} bytes)"}, 413)
            try:
                body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise ValueError("request body is not valid JSON") from None
            if not isinstance(body, dict):
                raise ValueError("request body must be a JSON object")
            jobs = {"/api/replay": ("replay", job_replay, validate_replay),
                    "/api/backtest": ("backtest", job_backtest, validate_backtest),
                    "/api/paper/tick": ("paper_tick", job_paper_tick, dict),
                    "/api/data/refresh": ("refresh", job_refresh, dict)}
            if path in jobs:
                kind, fn, check = jobs[path]
                if kind in ("paper_tick", "refresh") and (running := JOBS.busy(kind)):
                    return self._json(running)
                body = check(body)
                return self._json(JOBS.submit(kind, lambda log: fn(body, log)))
            if path == "/api/paper/reset":
                d = _paper_cfg().dir
                if d.exists():
                    for f in d.glob("*"):
                        if f.is_file():
                            f.unlink()
                return self._json({"ok": True})
            if path == "/api/killswitch":
                if body.get("on"):
                    KILL_SWITCH_FILE.write_text(f"set from dashboard {pd.Timestamp.now(tz='UTC').isoformat()}\n")
                else:
                    KILL_SWITCH_FILE.unlink(missing_ok=True)
                return self._json({"kill_switch": kill_switch_active()})
            self._json({"error": "not found"}, 404)
        except (ValueError, KeyError) as e:
            self._fail(e, 400)
        except Exception as e:
            self._fail(e, 500)


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
    global AUTO_PAPER
    AUTO_PAPER = auto_paper
    httpd = ThreadingHTTPServer((host, port), Handler)
    stop = threading.Event()
    if auto_paper:
        threading.Thread(target=_auto_paper, args=(stop,), daemon=True).start()
    print(f"dashboard on http://{host}:{port}  (auto paper trading: {'on' if auto_paper else 'off'})", flush=True)
    try:
        httpd.serve_forever()
    finally:
        stop.set()
