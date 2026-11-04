"""Bar data loading, downloading and synthetic generation.

Canonical bar format: DataFrame indexed by UTC DatetimeIndex with float columns
open, high, low, close, volume.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from .instruments import Instrument

COLUMNS = ["open", "high", "low", "close", "volume"]
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


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
    return df.dropna()


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
    return validate(df)


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


def download(inst: Instrument, days: int = 365) -> pd.DataFrame:
    if inst.broker == "binance":
        return download_binance(inst.broker_symbol, "1h", days)
    if inst.broker == "oanda":
        return download_oanda(inst.broker_symbol, "H1", days)
    if inst.broker == "ibkr":
        from .brokers.ibkr import IBKRBroker

        with IBKRBroker.from_env() as b:
            return b.historical_bars(inst.symbol, days=days)
    raise ValueError(f"no downloader for broker {inst.broker}")
