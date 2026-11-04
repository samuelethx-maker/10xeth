# trading-bot — demo/paper prototype

Multi-instrument trading system for GBPJPY, USDJPY, XAUUSD, XAGUSD, NAS100USD, US30,
BTCUSDT, ETHUSDT and CME ES futures. **Demo and paper accounts only**: every live
adapter refuses non-practice endpoints unless `ALLOW_LIVE=1` is set.

No strategy here is known to be profitable. The goal is to *measure* whether one is,
using the acceptance gates below, before any paper trading.

## Setup

```bash
cd trading-bot
uv sync                      # or: pip install -e . pytest
uv sync --extra ibkr         # adds ib_async for ES via IBKR
uv run pytest
```

## Usage

```bash
uv run tradingbot instruments                        # specs, cost assumptions
uv run tradingbot backtest --all --synthetic          # pipeline smoke test (meaningless P&L)
uv run tradingbot download --symbol BTCUSDT           # public data, no key needed
uv run tradingbot download --all                      # OANDA needs keys, ES needs TWS running
uv run tradingbot backtest --symbol BTCUSDT --data data/BTCUSDT_1h.csv --trades-out results
uv run tradingbot walkforward --symbol BTCUSDT --timeframe 4h --out results/wf   # out-of-sample only
```

Research results and decisions are logged in [RESEARCH.md](RESEARCH.md).

Each backtest reports in-sample (first 70%) and out-of-sample (last 30%) separately.
Only out-of-sample numbers count.

## Brokers

| Instruments | Broker | Credentials (`.env.example`) |
|---|---|---|
| GBPJPY, USDJPY, XAUUSD, XAGUSD, NAS100USD, US30 | OANDA practice (v20 REST) | `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID` |
| BTCUSDT, ETHUSDT | Binance USD-M futures testnet | `BINANCE_API_KEY`, `BINANCE_API_SECRET` |
| ES (and MES) | IBKR paper via TWS 7497 / Gateway 4002 | `IBKR_HOST`, `IBKR_PORT`, `IBKR_CLIENT_ID` |

Every order must have a protective stop; adapters reject orders without one.

**ES sizing:** one ES contract is $50/point. A typical 40–60 point ATR stop risks
$2,000–3,000 per contract, so a $100k account risking 0.75% can rarely take an ES
trade. Micro E-mini (`MES`, $5/point) is included for the same exposure in smaller units.

## Risk rules (`config/settings.yaml`)

- 0.75% of equity risked per trade (stop distance x size), capped by max leverage
- Daily loss limit of 3% from the day's starting equity: flatten and no new entries until the next UTC day
- Max drawdown of 20% from peak: halt
- Kill switch: create a file `trading-bot/KILL_SWITCH` to block all new entries

## Backtest model

Signals are taken on the bar close and filled at the next bar's open. Fills pay half
the spread plus slippage, and commission is charged per side. Stops and targets are
checked against the bar's high/low; when both are touched in one bar, the stop fills
first, and a gap through the stop fills at the open. Cost figures in `instruments.py`
are estimates; replace them with real demo-account spreads.

## Acceptance gates (per strategy, out-of-sample, after costs)

Profit factor > 1.3, max drawdown < 15%, at least 100 trades, then 4–8 weeks of
paper trading that roughly matches the backtest.

## Layout

```
tradingbot/
  instruments.py   specs + cost assumptions
  data.py          CSV I/O, synthetic data, Binance/OANDA/IBKR downloads
  indicators.py    causal indicators (EMA, ATR, Donchian, Bollinger, RSI)
  strategies/      trend breakout, mean reversion, EMA momentum (Strategy interface)
  walkforward.py   rolling train/test optimisation, robustness diagnostics, resampling
  risk.py          position sizing, daily loss / drawdown limits, kill switch
  backtest.py      bar-by-bar engine
  metrics.py       stats + acceptance gates
  brokers/         paper, oanda, binance, ibkr adapters
```

## Roadmap

1. ✅ Engine, risk, backtester, broker adapters, baseline strategies
2. Get data for all 9 instruments (OANDA practice key, IBKR paper + TWS)
3. ✅ Walk-forward optimisation + robustness diagnostics; crypto research done (see RESEARCH.md)
   ⏳ Validate the 4h trend candidate on OANDA instruments and ES; model funding; portfolio backtest
4. Live paper runner (scheduler, reconciliation, daily report, alerts)
5. 4–8 weeks of paper trading, then compare against the backtest
