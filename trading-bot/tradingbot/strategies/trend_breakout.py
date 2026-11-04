from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .. import indicators as ind
from .base import Strategy


@dataclass
class TrendBreakout(Strategy):
    """Donchian breakout in the direction of the long-term trend.

    Long when close breaks the prior `entry_n`-bar high and close > EMA(trend_n);
    exit on a break of the prior `exit_n`-bar low (shorts mirrored).
    Initial stop = `stop_atr` x ATR.
    """

    entry_n: int = 55
    exit_n: int = 20
    trend_n: int = 200
    atr_n: int = 20
    stop_atr: float = 2.5

    name = "trend"

    def generate(self, bars: pd.DataFrame) -> pd.DataFrame:
        sig = self.empty_signals(bars.index)
        close = bars["close"]
        up, lo = ind.donchian(bars, self.entry_n)
        xup, xlo = ind.donchian(bars, self.exit_n)
        trend = ind.ema(close, self.trend_n)
        a = ind.atr(bars, self.atr_n)

        long_ = (close > up) & (close > trend)
        short = (close < lo) & (close < trend)
        sig.loc[long_, "entry"] = 1
        sig.loc[short, "entry"] = -1
        sig["exit_long"] = close < xlo
        sig["exit_short"] = close > xup
        sig["stop_dist"] = self.stop_atr * a
        sig.loc[sig["stop_dist"].isna(), "entry"] = 0
        return sig
