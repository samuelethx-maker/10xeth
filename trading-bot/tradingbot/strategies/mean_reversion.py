from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .. import indicators as ind
from .base import Strategy


@dataclass
class MeanReversion(Strategy):
    """Buy pullbacks in an uptrend, sell rallies in a downtrend.

    Long when close < lower Bollinger band and RSI < rsi_low while close > EMA(trend_n);
    exit when close crosses back above the middle band (shorts mirrored).
    Stop = `stop_atr` x ATR, target = `target_atr` x ATR.
    """

    bb_n: int = 20
    bb_k: float = 2.0
    rsi_n: int = 3
    rsi_low: float = 15.0
    trend_n: int = 200
    atr_n: int = 14
    stop_atr: float = 2.0
    target_atr: float = 3.0

    name = "meanrev"

    def generate(self, bars: pd.DataFrame) -> pd.DataFrame:
        sig = self.empty_signals(bars.index)
        close = bars["close"]
        lower, mid, upper = ind.bollinger(close, self.bb_n, self.bb_k)
        r = ind.rsi(close, self.rsi_n)
        trend = ind.ema(close, self.trend_n)
        a = ind.atr(bars, self.atr_n)

        long_ = (close < lower) & (r < self.rsi_low) & (close > trend)
        short = (close > upper) & (r > 100 - self.rsi_low) & (close < trend)
        sig.loc[long_, "entry"] = 1
        sig.loc[short, "entry"] = -1
        sig["exit_long"] = close > mid
        sig["exit_short"] = close < mid
        sig["stop_dist"] = self.stop_atr * a
        sig["target_dist"] = self.target_atr * a
        sig.loc[sig["stop_dist"].isna(), "entry"] = 0
        return sig
