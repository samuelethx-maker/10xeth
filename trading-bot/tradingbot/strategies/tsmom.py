from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .. import indicators as ind
from .base import Strategy


@dataclass
class TimeSeriesMomentum(Strategy):
    """Multi-horizon time-series momentum: trade when short, medium and long lookback returns agree.

    score = mean(sign(close / close.shift(L) - 1)) for L in (lb_short, lb_mid, lb_long).
    Enter long at score = +1, short at -1; exit long when score <= 0, short when >= 0.
    Disaster stop = `stop_atr` x ATR(atr_n). Lookbacks are in bars (designed for daily bars).
    """

    lb_short: int = 21
    lb_mid: int = 63
    lb_long: int = 252
    atr_n: int = 20
    stop_atr: float = 3.0

    name = "tsmom"

    def generate(self, bars: pd.DataFrame) -> pd.DataFrame:
        sig = self.empty_signals(bars.index)
        close = bars["close"]
        rets = [close / close.shift(n) - 1 for n in (self.lb_short, self.lb_mid, self.lb_long)]
        valid = pd.concat(rets, axis=1).notna().all(axis=1)
        score = sum(np.sign(r.fillna(0.0)) for r in rets) / 3
        a = ind.atr(bars, self.atr_n)

        sig.loc[valid & (score >= 1), "entry"] = 1
        sig.loc[valid & (score <= -1), "entry"] = -1
        sig["exit_long"] = valid & (score <= 0)
        sig["exit_short"] = valid & (score >= 0)
        sig["stop_dist"] = self.stop_atr * a
        sig.loc[sig["stop_dist"].isna(), "entry"] = 0
        return sig
