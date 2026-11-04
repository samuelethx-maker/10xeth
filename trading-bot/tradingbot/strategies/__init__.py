from .base import Strategy
from .mean_reversion import MeanReversion
from .momentum import MomentumEMA
from .trend_breakout import TrendBreakout

STRATEGIES: dict[str, type[Strategy]] = {
    "trend": TrendBreakout,
    "meanrev": MeanReversion,
    "momentum": MomentumEMA,
}

__all__ = ["Strategy", "TrendBreakout", "MeanReversion", "MomentumEMA", "STRATEGIES"]
