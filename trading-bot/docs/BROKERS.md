# Connecting demo broker accounts

The system runs end to end without any account (simulated fills on free prices). Connecting demo
accounts makes the paper trader send **real orders to demo/paper accounts**, so you can measure real
spreads, fills and rejections. Every adapter refuses live (real-money) endpoints unless `ALLOW_LIVE=1`
is set. Leave it unset.

| Markets | Broker (demo) | What you need |
|---|---|---|
| GBPJPY, USDJPY, XAUUSD, XAGUSD, NAS100USD, US30 | OANDA **fxTrade Practice** | API token + account id |
| BTCUSDT, ETHUSDT | **Binance USD-M Futures testnet** | testnet API key + secret |
| ES / MES (CME futures) | **Interactive Brokers paper account** | TWS or IB Gateway running, API enabled |

## 1. Create the accounts

**OANDA practice**: sign up for a free practice (demo) account at oanda.com. In the practice hub, open
*Manage API Access* and generate a token. The account id looks like `101-004-1234567-001`.

**Binance futures testnet**: log in at https://testnet.binancefuture.com (separate from your normal Binance
account) and create an API key under *API Key*. Testnet balances are fake USDT.

**IBKR paper**: in Client Portal, enable a *Paper Trading Account*. Subscribe the paper account to CME
market data (real-time ES/MES quotes need the CME futures data package). Install **IB Gateway** (or TWS),
log in with the paper username, then under *Configure → Settings → API → Settings*:
- enable *ActiveX and Socket Clients*
- socket port **4002** (Gateway paper) or **7497** (TWS paper). The adapter refuses other ports.
- add `127.0.0.1` to trusted IPs

Then install the IBKR extra: `uv sync --extra ibkr`.

## 2. Configure credentials

Copy `.env.example` to `.env` and fill it in, or set the same names as environment variables / Hoplite
project variables. Never commit `.env`; it is git-ignored.

```
OANDA_API_TOKEN=...      OANDA_ACCOUNT_ID=...
BINANCE_API_KEY=...      BINANCE_API_SECRET=...
IBKR_HOST=127.0.0.1      IBKR_PORT=4002      IBKR_CLIENT_ID=17
```

## 3. Check each connection

```bash
uv run tradingbot broker-check --broker oanda       # equity, positions, a quote
uv run tradingbot broker-check --broker binance
uv run tradingbot broker-check --broker ibkr
uv run tradingbot broker-check --broker oanda --test-order   # min-size order WITH a stop, then closes it
```

## 4. Turn on order routing for the paper trader

In `config/paper.yaml` set `execution`:

| Mode | What happens |
|---|---|
| `sim` (default) | Simulated fills only; nothing is sent anywhere. |
| `dry_run` | After each tick, the reconciler compares the Engine's positions with each broker and **logs** the orders it would send (`results/paper/orders.jsonl`). Read-only API calls. |
| `live` | Same, but the orders are sent to the **demo** accounts. |

Start with `dry_run` for a few days and read `orders.jsonl`, then switch to `live`. Run one reconciliation by
hand with `uv run tradingbot reconcile --dry-run`.

## How order routing works

- After each bar, the Engine (the same one used in backtests) decides the desired positions. The
  **reconciler** (`tradingbot/execution.py`) makes the broker match: it closes positions that shouldn't be open,
  opens missing ones with their protective stop (and target), and repairs missing or moved stops.
- **Every entry carries a stop.** After an entry fills, the adapter confirms the stop is on the book; if it can't
  place it, it immediately closes the position.
- **Idempotent orders:** each order has a client id (OANDA `clientExtensions.id`, Binance `newClientOrderId`,
  IBKR `orderRef`). After a timeout the adapter looks the order up before retrying, so a retry can't double a position.
- **Retries** with backoff on rate limits (429), server errors (5xx) and connection drops, for read calls.
- **Guards:** kill switch (blocks entries; exits still run), notional cap per order, a 5% price-sanity check against
  the last bar, a check that the stop is on the correct side of price, and Binance exchange filters (lot size,
  tick size, minimum notional).
- **Quantity units:** Engine quantities are sent as is: OANDA units, Binance coin quantity, IBKR contracts.
- Broker errors are written to the order journal and never crash the paper trader.

## Known limitations

- The adapters are tested against mocked APIs only. Run `broker-check --test-order` on each demo account
  before relying on them.
- Binance moved conditional (stop) orders to a separate "algo" endpoint in late 2025. If stops are rejected on
  the testnet, set `BINANCE_CONDITIONAL_API=classic`.
- The demo account's own spreads and swaps differ from the estimates in `instruments.py`. Compare
  `orders.jsonl` fills with the simulated ones and update the estimates.
