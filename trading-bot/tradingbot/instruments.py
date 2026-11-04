"""Instrument specifications.

Spreads, commissions and financing rates are conservative *estimates* of typical
retail costs and must be checked against each broker's actual demo-account pricing.

Financing is an annual fraction of notional charged while a position is held
(positive = cost). For BTC/ETH the backtests use real Binance funding history when
data/<SYM>_funding.csv exists, and these rates only as a fallback.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Instrument:
    symbol: str  # our canonical name
    broker: str  # "oanda" | "binance" | "ibkr"
    broker_symbol: str
    quote_ccy: str  # currency P&L is denominated in before conversion to USD
    tick_size: float
    multiplier: float = 1.0  # USD (or quote ccy) per 1.0 price move per 1 qty
    qty_step: float = 1.0
    min_qty: float = 1.0
    spread: float = 0.0  # typical full spread, price units
    slippage: float = 0.0  # per-fill slippage, price units
    commission_per_qty: float = 0.0  # per side, account ccy
    commission_pct: float = 0.0  # per side, fraction of notional
    max_leverage: float = 10.0
    group: str = ""  # correlation bucket for portfolio limits
    financing_long: float = 0.0
    financing_short: float = 0.0
    dukascopy: str = ""  # Dukascopy datafeed symbol (historical research data)
    yahoo: str = ""  # Yahoo ticker (live paper-trading prices)

    def round_qty(self, qty: float) -> float:
        """Round down to the tradable step; 0 if below the minimum."""
        steps = math.floor(abs(qty) / self.qty_step + 1e-9)
        q = round(steps * self.qty_step, 10)
        return q if q >= self.min_qty else 0.0

    def round_price(self, price: float) -> float:
        decimals = max(0, -Decimal(str(self.tick_size)).as_tuple().exponent)
        return round(round(price / self.tick_size) * self.tick_size, decimals)


_FX = dict(group="jpy", financing_long=0.0, financing_short=0.06, max_leverage=20)
_METAL = dict(group="metals", financing_long=0.06, financing_short=0.0, max_leverage=10)
_INDEX = dict(group="us_index", financing_long=0.065, financing_short=0.0, max_leverage=10)
_CRYPTO = dict(group="crypto", commission_pct=0.0005, financing_long=0.10, financing_short=0.0,
               max_leverage=3, qty_step=0.001, min_qty=0.001)
_CME = dict(group="us_index", qty_step=1, min_qty=1, max_leverage=20, dukascopy="USA500IDXUSD")

INSTRUMENTS: dict[str, Instrument] = {
    i.symbol: i
    for i in [
        # --- OANDA practice (CFD / spot FX) ---
        Instrument("GBPJPY", "oanda", "GBP_JPY", "JPY", 0.001, spread=0.030, slippage=0.005,
                   dukascopy="GBPJPY", yahoo="GBPJPY=X", **_FX),
        Instrument("USDJPY", "oanda", "USD_JPY", "JPY", 0.001, spread=0.015, slippage=0.003,
                   dukascopy="USDJPY", yahoo="USDJPY=X", **_FX),
        Instrument("XAUUSD", "oanda", "XAU_USD", "USD", 0.01, spread=0.35, slippage=0.05,
                   dukascopy="XAUUSD", yahoo="GC=F", **_METAL),
        Instrument("XAGUSD", "oanda", "XAG_USD", "USD", 0.0001, spread=0.03, slippage=0.005,
                   dukascopy="XAGUSD", yahoo="SI=F", **_METAL),
        Instrument("NAS100USD", "oanda", "NAS100_USD", "USD", 0.1, qty_step=0.1, min_qty=0.1,
                   spread=1.5, slippage=0.5, dukascopy="USATECHIDXUSD", yahoo="NQ=F", **_INDEX),
        Instrument("US30", "oanda", "US30_USD", "USD", 0.1, qty_step=0.1, min_qty=0.1,
                   spread=3.0, slippage=1.0, dukascopy="USA30IDXUSD", yahoo="YM=F", **_INDEX),
        # --- Binance USD-M futures testnet (allows shorting) ---
        Instrument("BTCUSDT", "binance", "BTCUSDT", "USD", 0.1, spread=0.1, slippage=2.0,
                   yahoo="BTC-USD", **_CRYPTO),
        Instrument("ETHUSDT", "binance", "ETHUSDT", "USD", 0.01, spread=0.01, slippage=0.2,
                   yahoo="ETH-USD", **_CRYPTO),
        # --- IBKR paper: CME E-mini S&P 500 futures (front month, rolled) ---
        # Research history uses Dukascopy's S&P 500 CFD as a proxy; live prices use ES=F.
        Instrument("ES", "ibkr", "ES", "USD", 0.25, multiplier=50.0, spread=0.25, slippage=0.25,
                   commission_per_qty=2.25, yahoo="ES=F", **_CME),
        # Micro E-mini (1/10 of ES): lets accounts under ~$250k size ES risk properly.
        Instrument("MES", "ibkr", "MES", "USD", 0.25, multiplier=5.0, spread=0.25, slippage=0.25,
                   commission_per_qty=0.62, yahoo="MES=F", **_CME),
    ]
}

# Aliases so TradingView-style names work.
ALIASES = {"ES1!": "ES", "XAU": "XAUUSD", "NAS100": "NAS100USD", "US30USD": "US30"}


def get_instrument(symbol: str) -> Instrument:
    key = ALIASES.get(symbol.upper(), symbol.upper())
    try:
        return INSTRUMENTS[key]
    except KeyError:
        raise KeyError(f"Unknown instrument {symbol!r}. Known: {', '.join(INSTRUMENTS)}") from None
