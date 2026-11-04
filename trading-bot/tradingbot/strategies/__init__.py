from .base import Strategy
from .mean_reversion import MeanReversion
from .momentum import MomentumEMA
from .trend_breakout import TrendBreakout
from .tsmom import TimeSeriesMomentum

STRATEGIES: dict[str, type[Strategy]] = {
    "trend": TrendBreakout,
    "meanrev": MeanReversion,
    "momentum": MomentumEMA,
    "tsmom": TimeSeriesMomentum,
}

__all__ = ["Strategy", "TrendBreakout", "MeanReversion", "MomentumEMA", "TimeSeriesMomentum", "STRATEGIES"]
