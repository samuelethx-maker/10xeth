# trading-bot — demo/paper prototype

Multi-instrument trading system for GBPJPY, USDJPY, XAUUSD, XAGUSD, NAS100USD, US30,
BTCUSDT, ETHUSDT and CME ES futures. **Demo and paper accounts only**: every live
adapter refuses non-practice endpoints unless `ALLOW_LIVE=1` is set.

No strategy here is known to be profitable. The goal is to *measure* whether one is,
using the acceptance gates below, before any paper trading.

## Try it in the browser (demo)

```bash
cd trading-bot
uv sync --extra live
uv run tradingbot dashboard            # open http://127.0.0.1:8050
uv run tradingbot dashboard --auto-paper   # also paper-trades automatically every 4h bar
```

No accounts or API keys needed; missing price data is downloaded on first use (or click **Refresh data**).

| Tab | What you can test |
|---|---|
| **Replay** | "What would the paper trader have done over the last 30/90/180/365 days?" Pick markets, strategy, timeframe, equity, risk per trade, long-only and the sit-out rule. Shows equity + drawdown charts, key statistics, monthly returns, P&L by market, a candlestick chart with entry/exit/stop markers (click any market or trade), a sortable/filterable trade list with CSV export, and the parameters chosen on prior data only. |
| **Paper trading** | The live forward test: run a tick, see equity, today's P&L, drawdown, risk state, open positions, trades and parameters in use. Reset the account. |
| **Backtest lab** | Walk-forward (out-of-sample) or fixed-parameter backtest for any market / strategy / timeframe, with acceptance gates and per-fold results. |
| **Research** | `RESEARCH.md`: what has been tested and why the system does not pass yet. |
| **Markets & risk** | Risk rules, cost assumptions and data freshness per market. |

The **Kill switch** in the header blocks all new entries (same as creating the `KILL_SWITCH` file).
See [docs/DASHBOARD.md](docs/DASHBOARD.md) for the API and details.

## Connecting demo broker accounts

Optional. See **[docs/BROKERS.md](docs/BROKERS.md)**: account setup (OANDA practice, Binance futures testnet,
IBKR paper), `tradingbot broker-check`, and switching the paper trader from `execution: sim` to `dry_run` / `live`
(orders sent to demo accounts through a reconciler with stop fail-safes, idempotent client ids and retries).

## Quality checks

`uv run pytest` (87 tests: engine fills/financing/limits, no-lookahead, walk-forward, replay = paper trader
trade-for-trade, brokers against mocked APIs, reconciler, dashboard API) and `uvx ruff check tradingbot tests`.
Both run in GitHub Actions on every push touching `trading-bot/` (`.github/workflows/trading-bot.yml`).

## Setup

```bash
cd trading-bot
uv sync                      # or: pip install -e . pytest
uv sync --extra live         # adds yfinance (Yahoo data + paper trading)
uv sync --extra ibkr         # adds ib_async for ES via IBKR
uv run pytest
```

## Usage

```bash
uv run tradingbot instruments                        # specs, cost assumptions
uv run tradingbot backtest --all --synthetic          # pipeline smoke test (meaningless P&L)
uv run tradingbot download --symbol BTCUSDT           # Binance public data + funding history, no key
uv run tradingbot download --all --source yahoo       # ~2y of 1h for FX, metals, indices, ES (no key)
uv run tradingbot download --all --source yahoo --interval 1d   # 20+ years daily
uv run tradingbot download --symbol XAUUSD --source dukascopy   # long 1h CFD history (slow, rate-limited)
uv run tradingbot backtest --symbol BTCUSDT --data data/BTCUSDT_1h.csv --trades-out results
uv run tradingbot walkforward --symbol BTCUSDT --timeframe 4h --out results/wf   # out-of-sample only
uv run tradingbot portfolio --timeframe 4h            # all instruments, one account, shared risk
uv run tradingbot paper                               # one paper-trading tick (cron), or --loop
uv run tradingbot dashboard                           # browser UI (see above)
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

## Simulated paper trading (no broker keys)

`tradingbot paper` pulls live free prices (Binance for crypto, Yahoo for everything else) and runs
the same `Engine` as the backtests with simulated fills. Every 90 days it re-fits each market's
parameters on the last year, using exactly the walk-forward selection rule. State is persisted in
`results/paper/state.json`, so each tick picks up where the last stopped. `results/paper/report.md`
shows equity, today's P&L, drawdown, open positions and trades. Configure it in `config/paper.yaml`. Run
`tradingbot paper --loop` on an always-on machine, or with cron: `15 */4 * * * cd trading-bot && uv run tradingbot paper`.

Tests check that a run interrupted and resumed through the saved state produces exactly the same trades as an uninterrupted run.

## Risk rules (`config/settings.yaml`)

- 0.75% of equity risked per trade (stop distance x size), capped by max leverage
- Daily loss limit of 3% from the day's starting equity: flatten and no new entries until the next UTC day
- Max drawdown of 20% from peak: halt (permanent until a human resets it)
- Portfolio: at most 4 open positions, at most 2 per correlated group (crypto, US indices, metals, JPY),
  and total open notional at most 5× equity
- Kill switch: create a file `trading-bot/KILL_SWITCH` to block all new entries

## Backtest model

Signals are taken on the bar close and filled at the next bar's open. Fills pay half
the spread plus slippage, and commission is charged per side. Stops and targets are
checked against the bar's high/low; when both are touched in one bar, the stop fills
first, and a gap through the stop fills at the open. Financing is charged for the time held:
real Binance funding for crypto, and estimated swap rates for CFDs. Cost figures in `instruments.py`
are estimates; replace them with real demo-account spreads. Single-instrument backtests,
portfolio backtests and paper trading all run on the same `Engine`.

## Acceptance gates (per strategy, out-of-sample, after costs)

Profit factor > 1.3, max drawdown < 15%, at least 100 trades, then 4–8 weeks of
paper trading that roughly matches the backtest.

## Layout

```
tradingbot/
  instruments.py   specs + cost assumptions
  data.py          CSV I/O, synthetic data, Binance/OANDA/IBKR downloads
  indicators.py    causal indicators (EMA, ATR, Donchian, Bollinger, RSI)
  strategies/      trend breakout, mean reversion, EMA momentum, time-series momentum
  walkforward.py   rolling train/test optimisation, robustness diagnostics, resampling
  paper.py         simulated paper trader (live free data, persisted state, report) + replay
  dashboard.py     local web server + JSON API for the browser UI (web/index.html)
  risk.py          position sizing, daily loss / drawdown limits, kill switch
  backtest.py      Engine (shared by backtest / portfolio / paper), financing
  metrics.py       stats + acceptance gates
  brokers/         paper, oanda, binance, ibkr adapters (retries, client ids, stop fail-safe)
  execution.py     reconciler: makes demo-broker positions match the Engine
```

## Roadmap

1. ✅ Engine, risk, backtester, broker adapters, baseline strategies
2. ✅ Data for all 9 instruments from free sources (Binance, Yahoo; Dukascopy optional)
3. ✅ Walk-forward, financing, portfolio backtest. **Result: no strategy passes the gates across
   the 9 markets** (see RESEARCH.md). ⏳ Further strategy research.
4. ✅ Simulated paper trader. ⏳ Broker order paths (OANDA / Binance testnet / IBKR) need accounts.
5. 4–8 weeks of paper trading, then compare against the backtest
