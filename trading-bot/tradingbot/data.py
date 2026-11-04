"""Bar data loading, downloading and synthetic generation.

Canonical bar format: DataFrame indexed by UTC DatetimeIndex with float columns
open, high, low, close, volume.
"""

from __future__ import annotations

import lzma
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from .instruments import Instrument

COLUMNS = ["open", "high", "low", "close", "volume"]
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def drop_unfinished(df: pd.DataFrame, bar: pd.Timedelta, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """Drop the still-forming last bar(s) returned by live feeds."""
    now = now or pd.Timestamp.now(tz="UTC")
    return df[df.index + bar <= now]


def validate(df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"bar data missing columns: {missing}")
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("bar data must be indexed by DatetimeIndex")
    df = df[COLUMNS].astype(float).sort_index()
    df = df[~df.index.duplicated(keep="last")]
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    else:
        df.index = df.index.tz_convert("UTC")
    df = df.dropna()
    df = df[(df[["open", "high", "low", "close"]] > 0).all(axis=1)]
    # Yahoo daily history sometimes has highs/lows that don't contain open/close.
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)
    return df


def data_path(symbol: str, source: str = "", interval: str = "1h") -> Path:
    suffix = f"_{source}" if source else ""
    return DATA_DIR / f"{symbol}{suffix}_{interval}.csv"


def load_symbol(symbol: str, source: str = "", interval: str = "1h") -> pd.DataFrame | None:
    """Load cached bars. Without an explicit source, the default file (Binance for
    crypto, Dukascopy otherwise) is tried first, then Yahoo. MES shares ES history."""
    for sym in (symbol, "ES") if symbol == "MES" else (symbol,):
        for src in [source] if source else ["", "yahoo"]:
            p = data_path(sym, src, interval)
            if p.exists():
                return load_csv(p)
    return None


def load_csv(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    time_col = next(c for c in df.columns if c.lower() in ("time", "timestamp", "date", "datetime"))
    df.index = pd.to_datetime(df.pop(time_col), utc=True)
    df.columns = [c.lower() for c in df.columns]
    if "volume" not in df.columns:
        df["volume"] = 0.0
    return validate(df)


def save_csv(df: pd.DataFrame, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.rename_axis("time").to_csv(path)


def synthetic(
    n_bars: int = 20_000,
    start_price: float = 100.0,
    freq: str = "1h",
    seed: int = 0,
    vol: float = 0.004,
) -> pd.DataFrame:
    """Random-walk bars with regime-switching drift. For pipeline testing ONLY:
    results on synthetic data say nothing about real-market profitability."""
    rng = np.random.default_rng(seed)
    regime_len = rng.integers(100, 600, size=n_bars // 100 + 1)
    drift = np.repeat(rng.normal(0, vol / 40, size=len(regime_len)), regime_len)[:n_bars]
    rets = drift + rng.normal(0, vol, size=n_bars)
    close = start_price * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[start_price], close[:-1]])
    wick = np.abs(rng.normal(0, vol / 2, size=(2, n_bars))) * close
    high = np.maximum(open_, close) + wick[0]
    low = np.minimum(open_, close) - wick[1]
    idx = pd.date_range("2020-01-01", periods=n_bars, freq=freq, tz="UTC")
    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": 1.0}, index=idx
    )


# ---------------------------------------------------------------- downloads

def download_binance(symbol: str, interval: str = "1h", days: int = 365) -> pd.DataFrame:
    """Public Binance USD-M futures klines (no API key needed)."""
    base = os.environ.get("BINANCE_DATA_URL", "https://fapi.binance.com")
    end = pd.Timestamp.now(tz="UTC")
    start_ms = int((end - pd.Timedelta(days=days)).timestamp() * 1000)
    rows: list[list] = []
    while True:
        r = requests.get(
            f"{base}/fapi/v1/klines",
            params={"symbol": symbol, "interval": interval, "startTime": start_ms, "limit": 1500},
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        rows.extend(batch)
        start_ms = batch[-1][0] + 1
        if len(batch) < 1500:
            break
    df = pd.DataFrame(rows).iloc[:, :6]
    df.columns = ["time", *COLUMNS]
    df.index = pd.to_datetime(df.pop("time"), unit="ms", utc=True)
    return drop_unfinished(validate(df), pd.Timedelta(interval))


def download_oanda(instrument: str, granularity: str = "H1", days: int = 365) -> pd.DataFrame:
    """OANDA v20 mid candles. Requires OANDA_API_TOKEN (practice account)."""
    token = os.environ.get("OANDA_API_TOKEN")
    if not token:
        raise RuntimeError("OANDA_API_TOKEN is not set (create a free OANDA practice account)")
    base = os.environ.get("OANDA_API_URL", "https://api-fxpractice.oanda.com")
    t = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
    rows = []
    while True:
        r = requests.get(
            f"{base}/v3/instruments/{instrument}/candles",
            headers={"Authorization": f"Bearer {token}"},
            params={"granularity": granularity, "from": t.isoformat(), "count": 5000, "price": "M"},
            timeout=30,
        )
        r.raise_for_status()
        candles = [c for c in r.json()["candles"] if c["complete"]]
        if not candles:
            break
        for c in candles:
            m = c["mid"]
            rows.append((c["time"], m["o"], m["h"], m["l"], m["c"], c["volume"]))
        new_t = pd.Timestamp(candles[-1]["time"]) + pd.Timedelta(seconds=1)
        if new_t <= t or len(candles) < 4999:
            break
        t = new_t
    df = pd.DataFrame(rows, columns=["time", *COLUMNS])
    df.index = pd.to_datetime(df.pop("time"), utc=True)
    return validate(df)


_DUKA_DTYPE = np.dtype([("t", ">u4"), ("o", ">i4"), ("c", ">i4"), ("l", ">i4"), ("h", ">i4"), ("v", ">f4")])
_UA = {"User-Agent": "Mozilla/5.0 (tradingbot research)"}


def _duka_fetch(symbol: str, period: pd.Period) -> bytes | None:
    """Raw monthly hour-candle file; b"" = month exists but is empty, None = not published."""
    # Months are 0-based in Dukascopy URLs.
    url = (f"https://datafeed.dukascopy.com/datafeed/{symbol}/{period.year}/"
           f"{period.month - 1:02d}/BID_candles_hour_1.bi5")
    for attempt in range(8):
        try:
            r = requests.get(url, timeout=90, headers=_UA)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.content
        except requests.RequestException:
            if attempt == 7:
                raise
            time.sleep(min(60, 5 * 2 ** attempt))
    return None


def _duka_month(symbol: str, period: pd.Period, scale: float) -> pd.DataFrame | None:
    cache = DATA_DIR / "cache" / "dukascopy" / symbol / f"{period}.bi5"
    this_month = pd.Timestamp.now(tz="UTC").to_period("M")
    if cache.exists() and period < this_month - 1:  # recent months may still change
        content = cache.read_bytes()
    else:
        content = _duka_fetch(symbol, period)
        if content is None:
            return None
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(content)
    if not content:
        return None
    a = np.frombuffer(lzma.decompress(content), dtype=_DUKA_DTYPE)

    base = pd.Timestamp(period.year, period.month, 1, tz="UTC")
    df = pd.DataFrame(
        {"open": a["o"] / scale, "high": a["h"] / scale, "low": a["l"] / scale,
         "close": a["c"] / scale, "volume": a["v"].astype(float)},
        index=base + pd.to_timedelta(a["t"].astype(np.int64), unit="s"),
    )
    # Closed-market hours are emitted as flat zero-volume candles.
    closed = (df["volume"] == 0) & (df["high"] == df["low"])
    return df[~closed]


def download_dukascopy(symbol: str, start: str = "2015-01", scale: float = 1000.0) -> pd.DataFrame:
    """Free hourly BID candles from Dukascopy's public datafeed (no key needed).
    The current month is usually not published yet."""
    months = pd.period_range(start, pd.Timestamp.now(tz="UTC").strftime("%Y-%m"), freq="M")
    # The feed throttles parallel requests hard; files are cached so reruns resume.
    with ThreadPoolExecutor(2) as ex:
        parts = [p for p in ex.map(lambda m: _duka_month(symbol, m, scale), months) if p is not None]
    if not parts:
        raise RuntimeError(f"no Dukascopy data for {symbol}")
    return validate(pd.concat(parts))


def download_yahoo(ticker: str, interval: str = "1h", period: str = "730d") -> pd.DataFrame:
    """Yahoo Finance bars via yfinance (`uv sync --extra live`). Futures are the
    continuous front month, not back-adjusted, so rolls show up as price jumps."""
    try:
        import yfinance as yf
    except ImportError:
        raise RuntimeError("yfinance not installed: uv sync --extra live") from None
    df = yf.download(ticker, period=period, interval=interval, progress=False,
                     auto_adjust=False, multi_level_index=False)
    if df.empty:
        raise RuntimeError(f"no Yahoo data for {ticker}")
    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index, utc=True)
    df = validate(df)
    return drop_unfinished(df, pd.Timedelta(hours=1)) if interval == "1h" else df


def download_funding(symbol: str, start: str = "2019-09-01") -> pd.Series:
    """Binance USD-M funding-rate history (fraction per 8h event; longs pay when > 0)."""
    base = os.environ.get("BINANCE_DATA_URL", "https://fapi.binance.com")
    t = int(pd.Timestamp(start, tz="UTC").timestamp() * 1000)
    rows = []
    while True:
        r = requests.get(f"{base}/fapi/v1/fundingRate",
                         params={"symbol": symbol, "startTime": t, "limit": 1000}, timeout=30)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        rows += [(b["fundingTime"], float(b["fundingRate"])) for b in batch]
        t = batch[-1]["fundingTime"] + 1
        if len(batch) < 1000:
            break
    s = pd.Series([v for _, v in rows], index=pd.to_datetime([k for k, _ in rows], unit="ms", utc=True),
                  name="funding")
    return s[~s.index.duplicated()]


def load_funding(symbol: str) -> pd.Series | None:
    p = DATA_DIR / f"{symbol}_funding.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, index_col=0)
    df.index = pd.to_datetime(df.index, utc=True)
    return df["funding"]


def download(inst: Instrument, days: int = 365, source: str = "auto", interval: str = "1h") -> pd.DataFrame:
    if source == "auto":
        source = "binance" if inst.broker == "binance" else "dukascopy"
    if source == "binance":
        return download_binance(inst.broker_symbol, interval, days)
    if source == "dukascopy":
        if not inst.dukascopy:
            raise ValueError(f"{inst.symbol} has no Dukascopy symbol")
        start = (pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)).strftime("%Y-%m")
        df = download_dukascopy(inst.dukascopy, start)
        # Dukascopy candles are BID; the engine adds half the spread around a mid
        # price, so shift to an approximate mid to avoid flattering longs.
        df[["open", "high", "low", "close"]] += inst.spread / 2
        return df
    if source == "yahoo":
        if not inst.yahoo:
            raise ValueError(f"{inst.symbol} has no Yahoo ticker")
        if interval == "1d":
            return download_yahoo(inst.yahoo, "1d", "max")
        return download_yahoo(inst.yahoo, "1h", f"{min(days, 729)}d")
    if source == "oanda":
        return download_oanda(inst.broker_symbol, "H1", days)
    if source == "ibkr":
        from .brokers.ibkr import IBKRBroker

        with IBKRBroker.from_env() as b:
            return b.historical_bars(inst.symbol, days=days)
    raise ValueError(f"unknown data source {source!r}")


def refresh(inst: Instrument, log=print) -> pd.DataFrame:
    """Incrementally update the cached 1h file used by replay / paper trading
    (Binance for crypto, Yahoo otherwise; MES shares ES)."""
    sym = "ES" if inst.symbol == "MES" else inst.symbol
    now = pd.Timestamp.now(tz="UTC")
    if inst.broker == "binance":
        p = data_path(sym)
        old = load_csv(p) if p.exists() else None
        days = 730 if old is None else max(2, (now - old.index[-1]).days + 2)
        try:
            new = download_binance(inst.broker_symbol, "1h", days)
        except requests.RequestException as e:
            log(f"{sym}: Binance unavailable ({e}); using Yahoo {inst.yahoo}")
            new = download_yahoo(inst.yahoo, "1h", f"{min(days, 729)}d")
        try:
            oldf = load_funding(sym)
            fstart = (oldf.index[-1] if oldf is not None else now - pd.Timedelta(days=days)).strftime("%Y-%m-%d")
            f = download_funding(inst.broker_symbol, fstart)
            if oldf is not None:
                f = pd.concat([oldf, f])
                f = f[~f.index.duplicated(keep="last")].sort_index()
            f.rename("funding").rename_axis("time").to_csv(DATA_DIR / f"{sym}_funding.csv")
        except requests.RequestException as e:
            log(f"{sym}: funding history unavailable ({e}); keeping cached funding")
    else:
        p = data_path(sym, "yahoo")
        old = load_csv(p) if p.exists() else None
        new = download_yahoo(inst.yahoo if inst.symbol != "MES" else "ES=F", "1h", "729d")
    df = new if old is None else validate(pd.concat([old, new]))
    save_csv(df, p)
    log(f"{sym}: {len(df)} bars, last {df.index[-1]:%Y-%m-%d %H:%M} UTC")
    return df
