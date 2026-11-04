from .base import Strategy
from .mean_reversion import MeanReversion
from .trend_breakout import TrendBreakout

STRATEGIES: dict[str, type[Strategy]] = {
    "trend": TrendBreakout,
    "meanrev": MeanReversion,
}

__all__ = ["Strategy", "TrendBreakout", "MeanReversion", "STRATEGIES"]
