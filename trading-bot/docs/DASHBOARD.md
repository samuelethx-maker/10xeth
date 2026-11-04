# Dashboard

`uv run tradingbot dashboard` serves a local, offline web UI at `http://127.0.0.1:8050` (loopback by default; `--host`/`--port` to change, `--auto-paper` to tick the paper trader every bar). Everything is simulated; no broker orders are sent. The page is a single self-contained file (`tradingbot/web/index.html`): vanilla JS, hand-written SVG charts, no CDNs.

## Tabs

- **Replay**: runs the paper engine over the last 30–365 days across the selected markets.
- **Paper trading**: live forward-test account. Auto-refreshes every 60 s while the tab is visible, shows a countdown to the next bar tick and the last tick's log lines, and has clear empty states before the first tick.
- **Backtest lab**: walk-forward (out-of-sample only) or fixed-parameter backtest of one market.
- **Research**: renders `RESEARCH.md`.
- **Markets & risk**: risk rules, cost assumptions, data freshness.

Replay and Backtest lab share one result view:

- KPI cards and acceptance-gate badges.
- Equity chart with a drawdown (underwater) chart below; the hover crosshair is synced. Daily-loss-limit and max-drawdown events are marked.
- Key statistics: CAGR, Sharpe, max DD, profit factor, win rate, avg win/loss, payoff, expectancy ($ and R), best/worst trade, longest losing streak, time in market.
- Monthly returns heatmap with yearly totals.
- Market candlestick chart: click a by-market row or a trade row. Long/short entry (▲/▼) and exit (●) markers, dashed entry→exit lines, and stop/target/entry lines for the selected trade; hover shows OHLC and any trade at that bar. Timeframe selector (1h/4h/1D).
- Trades table: sortable columns, market filter, pagination, **Export CSV** (client-side download of the filtered, sorted rows).

Keyboard: tabs use `role=tab` with Left/Right/Home/End; trade and market rows are focusable (Enter selects). The layout works down to ~380 px wide.

Strategy dropdowns are filled from `/api/overview` `strategies`, so new strategies appear without UI changes.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/overview` | instruments, strategies, risk, data status |
| GET | `/api/paper` | paper account; also `drawdown`, `last_tick_job` (status + log), `next_tick`, `server_time`, `auto_paper` |
| GET | `/api/candles?symbol=&tf=&start=&end=&limit=` | OHLC arrays `t,o,h,l,c`. `tf` is `1h`, `4h` or `1D` (default `4h`); `start`/`end` ISO timestamps; at most 600 (latest) bars, `truncated` says if cut. 400 on bad params, 404 if no cached data |
| GET | `/api/research`, `/api/jobs/{id}`, `/healthz` | as before |
| POST | `/api/replay`, `/api/backtest` | start a job; result adds `stats`, `monthly`, `drawdown`, `risk_events_parsed`, `by_symbol`; up to 1500 trades |
| POST | `/api/paper/tick`, `/api/data/refresh`, `/api/paper/reset`, `/api/killswitch` | as before |

`stats` is computed from the full-resolution equity curve and trades (`perf_stats`); `monthly` holds calendar-month returns in percent (first month vs initial equity).

## Hardening

Binds to 127.0.0.1 by default. Query and body parameters are validated (known strategies, markets, timeframes; clamped equity, risk and window). Errors are JSON (`{"error": ...}`); malformed JSON or non-object bodies return 400 and bodies over 1 MB return 413. Jobs run one at a time and at most 50 are kept. Responses carry `nosniff`, `X-Frame-Options: DENY` and a same-origin Content-Security-Policy. There is no authentication: do not expose the port beyond a trusted network.
