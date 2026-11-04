"""Strategy interface.

A strategy turns closed bars into a signal frame (same index as the bars) with:
  entry       1 = go long, -1 = go short, 0 = nothing
  exit_long   True = close an open long
  exit_short  True = close an open short
  stop_dist   stop-loss distance in price units (required when entry != 0)
  target_dist take-profit distance in price units (NaN = no target)

Signals are read at a bar's close and acted on at the NEXT bar's open, so a
strategy must only use causal indicators (see indicators.py).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd


@dataclass
class Strategy(ABC):
    name = "base"

    @abstractmethod
    def generate(self, bars: pd.DataFrame) -> pd.DataFrame: ...

    def params(self) -> dict:
        return asdict(self)

    @staticmethod
    def empty_signals(index: pd.Index) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "entry": 0,
                "exit_long": False,
                "exit_short": False,
                "stop_dist": np.nan,
                "target_dist": np.nan,
            },
            index=index,
        )
