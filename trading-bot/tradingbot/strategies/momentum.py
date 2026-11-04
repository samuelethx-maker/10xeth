from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .. import indicators as ind
from .base import Strategy


@dataclass
class MomentumEMA(Strategy):
    """EMA-crossover trend following with a chandelier exit.

    Long when EMA(fast) crosses above EMA(slow); exit when close falls below
    highest-high(chandelier_n) - chandelier_atr x ATR, or on the opposite cross.
    Initial stop = `stop_atr` x ATR. Shorts mirrored.
    """

    fast: int = 20
    slow: int = 100
    atr_n: int = 20
    stop_atr: float = 3.0
    chandelier_n: int = 22
    chandelier_atr: float = 3.0

    name = "momentum"

    def generate(self, bars: pd.DataFrame) -> pd.DataFrame:
        sig = self.empty_signals(bars.index)
        close = bars["close"]
        f, s = ind.ema(close, self.fast), ind.ema(close, self.slow)
        a = ind.atr(bars, self.atr_n)
        above = f > s
        cross_up = above & ~above.shift(1, fill_value=False) & s.notna()
        below = f < s
        cross_dn = below & ~below.shift(1, fill_value=False) & s.notna()
        hh = bars["high"].rolling(self.chandelier_n).max()
        ll = bars["low"].rolling(self.chandelier_n).min()

        sig.loc[cross_up, "entry"] = 1
        sig.loc[cross_dn, "entry"] = -1
        sig["exit_long"] = (close < hh - self.chandelier_atr * a) | below
        sig["exit_short"] = (close > ll + self.chandelier_atr * a) | above
        sig["stop_dist"] = self.stop_atr * a
        sig.loc[sig["stop_dist"].isna(), "entry"] = 0
        return sig
