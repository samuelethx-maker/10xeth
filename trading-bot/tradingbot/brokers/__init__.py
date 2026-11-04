from .base import Broker, OrderResult

__all__ = ["Broker", "OrderResult", "get_broker"]


def get_broker(name: str) -> Broker:
    """Instantiate a broker adapter from environment variables."""
    if name == "paper":
        from .paper import PaperBroker

        return PaperBroker()
    if name == "oanda":
        from .oanda import OandaBroker

        return OandaBroker.from_env()
    if name == "binance":
        from .binance import BinanceFuturesBroker

        return BinanceFuturesBroker.from_env()
    if name == "ibkr":
        from .ibkr import IBKRBroker

        return IBKRBroker.from_env()
    raise ValueError(f"unknown broker {name!r}")
