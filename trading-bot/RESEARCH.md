# Research log

## 2026-11-04: Phase 3, walk-forward on crypto (BTCUSDT, ETHUSDT)

**Data:** Binance USD-M futures, 1h, 2020-04-09 → 2026-11-04 (57,600 bars each).
**Method:** `tradingbot walkforward`: train 365 days, test 90 days, roll by 90 days (22 folds).
Each fold picks the best of a small, coarse parameter grid on the training window by
return/max DD, then trades those parameters unchanged on the next 90 days. The table shows
**only stitched out-of-sample results**, after spread, slippage and commission, at 0.75% risk per trade.

Reproduce: `uv run tradingbot walkforward --symbol BTCUSDT --timeframe 4h [--long-only] --out results/wf`

| Symbol | TF | Dir | Strategy | Trades | Return % | Max DD % | PF | Pos. folds % | Gates |
|---|---|---|---|---:|---:|---:|---:|---:|:-:|
| BTC | 4h | long only | trend | 116 | 49.5 | 11.3 | 1.81 | 41 | ✅ |
| BTC | 4h | both | trend | 189 | 46.4 | 16.2 | 1.46 | 59 | ❌ DD |
| BTC | 4h | both | momentum | 132 | 12.2 | 7.4 | 1.36 | 64 | ✅ |
| BTC | 4h | long only | momentum | 76 | 11.9 | 5.1 | 1.60 | 55 | ❌ trades |
| ETH | 4h | long only | trend | 109 | 43.1 | 9.3 | 1.74 | 45 | ✅ |
| ETH | 4h | both | trend | 176 | 45.4 | 13.5 | 1.43 | 50 | ✅ |
| ETH | 4h | both | momentum | 149 | 12.5 | 6.0 | 1.29 | 50 | ❌ PF |
| BTC | 1h | long only | trend | 343 | 68.9 | 18.4 | 1.31 | 50 | ❌ DD |
| ETH | 1h | long only | trend | 313 | 65.5 | 16.9 | 1.38 | 55 | ❌ DD |
| BTC/ETH | 1h, 4h | any | meanrev | | | | 0.66–1.13 | | ❌ |
| BTC/ETH | 1D | any | any | ~0 | | | | | n/a¹ |

¹ One year of daily bars yields fewer than the 15 training trades required, so every fold sat out.

### Findings

1. **The trend breakout on 4h is the only candidate that is consistent across both coins.**
   It passes the gates in 3 of 4 variants, with PF 1.43–1.81 and DD 9–16%.
2. **1h is worse than 4h for the same strategies.** There are more trades, so costs and noise eat the edge.
3. **Mean reversion does not work on crypto at these settings.** It loses in nearly every variant. Drop it for crypto.
4. **Momentum (EMA cross) is marginal.** Its drawdowns are low but its PF sits near the 1.3 line.
5. Per-fold consistency is modest: only 41–59% of 90-day windows are positive. Expect
   multi-month flat or losing stretches. That is typical for trend following, and it rules out "profit every day".

### Caveats (read before trusting the numbers)

- **Selection bias:** about 30 configurations were compared and the best are highlighted. Out-of-sample
  per fold does not protect against picking the luckiest config *afterwards*. Treat the
  ✅ rows as hypotheses, not proof.
- **Long-only results benefit from 2020–2026 crypto drift.** Long-only is not a free improvement.
- Funding rates on perpetual futures are not modelled yet. Expect roughly 5–10%/yr drag on longs
  in bull markets.
- Cost assumptions (spread, slippage, 0.05%/side taker fees) are estimates.

### Decision / next steps

- **Candidate #1:** `trend` on 4h for BTC/ETH. Choose both directions or long-only after funding costs are modelled.
- The real test of the trend breakout is whether it also works on the **OANDA instruments**
  (gold, silver, indices, JPY pairs) and **ES**, using data it has never been tuned on. This needs the OANDA
  practice key and IBKR paper account.
- Then: model funding, set up a portfolio-level backtest across instruments (shared risk budget, correlation),
  and build the live paper runner.

> **Correction (later the same day):** the walk-forward tables above were run before financing was modelled
> and are superseded by the section below. BTC trend 4h is now PF 1.43 / DD 16.9%; ETH trend 4h is PF 1.38 / DD 13.9%.

## 2026-11-04: Phase 3b, all 9 instruments, financing, portfolio

**Pre-committed before looking at non-crypto data:** candidate = `trend` breakout on 4h, both directions,
parameters chosen by walk-forward. These results test that candidate on markets it was never tuned on.

**Data (no broker keys):** Binance futures 1h for BTC/ETH (2020→) plus actual funding-rate history; Yahoo for
the other markets: 1h for the last ~2 years (FX from 2024-01, futures from 2024-06) and daily for 22–30 years.
XAU/XAG/NAS100/US30/ES use the CME futures continuous contracts (GC, SI, NQ, YM, ES), which are **not
back-adjusted**, so contract rolls show up as small price jumps. Dukascopy CFD history was tried, but its feed
rate-limited this environment (HTTP 503) after a few files; the downloader is kept, with a resumable cache.
**Costs:** spread + slippage + commission as before, plus financing: real funding for crypto, and estimated swap
rates for CFDs (`instruments.py`, e.g. 6–6.5%/yr on long index/metal CFDs). ES/MES carry no financing.

Reproduce: `bash scripts/research.sh A` (4h), `B` (daily), `C`/`D` (extra portfolio views).

### Single-instrument walk-forward, out-of-sample, after all costs

4h, train 365 days / test 90 days. Non-crypto has only 5–7 folds (~15–21 months out-of-sample, so too few trades to pass the 100-trade gate alone):

| | trend PF | trend return | best other strategy |
|---|---:|---:|---|
| BTCUSDT | 1.43 | +42.0% (DD 16.9%) | momentum PF 1.35 ✅ |
| ETHUSDT | 1.38 ✅ | +39.4% (DD 13.9%) | momentum PF 1.28 |
| XAUUSD | 1.27 | +3.7% | — |
| XAGUSD | 0.85 | −2.1% | momentum PF 2.05 (22 trades) |
| GBPJPY | 0.59 | −9.3% | — |
| USDJPY | 0.46 | −14.9% | meanrev PF 1.48 (41 trades) |
| NAS100USD | 0.51 | −10.2% | all strategies lose |
| US30 | 0.32 | −18.9% | all strategies lose |
| MES | 0.54 | −5.5% | all strategies lose |
| ES | — | 0 trades | one $50/pt contract never fits a 0.75% risk budget on $100k |

Daily, train 3 years / test 1 year, 20–27 folds (2000s → 2026): **no strategy passes on any instrument**. The best trend
results are XAGUSD PF 1.36 (DD 18.7%), XAUUSD PF 1.23, MES PF 1.27, NAS100 PF 1.01, US30 PF 0.65, JPY pairs PF 0.75–0.80.

### Portfolio: one $100k account, shared risk (0.75%/trade, max 4 open, max 2 per correlated group)

| Portfolio (trend, out-of-sample) | Trades | Return | Max DD | PF | Note |
|---|---:|---:|---:|---:|---|
| 4h, all 9, 2021→2026 | 248 | +47.2% | 20.1% | 1.33 | halted by the 20% DD rule in 2025 |
| 4h, all 9, DD halt off | 525 | +28.1% | **42.4%** | 1.09 | crypto +$63k, everything else −$34k |
| 4h, all 9, common window 2025-06 → 2026-09 | 152 | −16.2% | 20.2% | 0.77 | only XAU, XAG, ETH positive |
| 4h, BTC+ETH only | 259 | +46.4% | 20.5% | 1.30 | halted 2025 |
| Daily, all 9, 1999→2026, DD halt off | 668 | +4.4% (27 yrs) | 25.8% | 1.01 | silver +$32k carried it; financing cost about $79k |

### Conclusions

1. **The 4h trend candidate does not generalise.** Outside crypto, it loses money out-of-sample on 6 of 7 markets.
   Gold is the only non-crypto market with a consistent (small) edge on both 4h and daily.
2. **Even crypto alone fails the gates once it trades as one account** (PF 1.30, DD 20.5%), and its gains
   come mostly from 2023. Most of the earlier "edge" is BTC/ETH trend in a strong bull market.
3. **Financing matters.** On daily holding periods, estimated CFD swap costs (about $79k) wiped out a gross edge
   that was already thin. On CFDs, slow trend-following has to be much better than break-even.
4. **The system as specified does not meet the acceptance gates.** No combination of these three simple
   strategies makes reliable money across these 9 markets after realistic costs, and "profit every day" is not achievable with them.

### What this means for next steps

- The paper trader (`tradingbot paper`) is built and works on live prices. Running it now is useful to
  **verify the plumbing** (data, signals, fills, reporting), not because the strategy has earned it.
- Research worth doing next, each pre-registered and judged out-of-sample:
  a) volatility-targeted, diversified trend on daily futures, where financing is in the price (ES/MES, GC, SI, NQ, YM)
     instead of CFDs; b) a "sit out when training score ≤ 0" rule; c) per-market session filters and different
     models for FX/indices (these clearly don't trend at 4h in this sample); d) longer 4h history once OANDA practice
     or Dukascopy data is available, since 2 years is a short out-of-sample window for non-crypto.


## 2026-11-04: Phase 3c, sit-out rule (pre-registered) and replays

**Sit-out rule:** before each window, skip a market if its best training score (return / max DD) is ≤ 0.
It was proposed before testing and is judged out-of-sample (`bash scripts/research.sh E`).

| Portfolio (trend, all 9) | PF without rule | PF with rule | Max DD with rule |
|---|---:|---:|---:|
| 4h, DD halt off | 1.09 | 1.06 | 46.2% |
| Daily 1999→2026, DD halt off | 1.01 | 0.90 | 28.1% |

**Rejected.** It cuts some losing trades in FX and indices but also skips the windows where those markets
did trend. It stays available as an option (`--min-score 0`, or the dashboard checkbox), off by default.

**Replays of the configured paper trader** (all 9 markets, 4h trend, $100k, 0.75% risk, parameters fitted only on
the year before each 90-day window; the same code path as live paper trading, verified trade-for-trade by a test):

| Window ending 2026-11-04 | Return | Max DD | PF | Trades | Gates |
|---|---:|---:|---:|---:|:-:|
| last 90 days | +12.6% | 10.5% | 1.37 | 45 | ❌ (trades) |
| last 180 days | +9.0% | 15.2% | 1.10 | 90 | ❌ |
| last 365 days | +14.6% | 14.7% | 1.13 | 165 | ❌ PF |

The last year was positive, mostly from ETH, BTC, silver and gold; US30 and MES lost money. That is consistent with
the earlier finding: the edge is concentrated in crypto and metals, and is too thin across the full basket to pass the gates.

**Bug found and fixed while building the replay:** the tick-by-tick paper trader was not charging financing
on the first bar of each tick (in practice every 4h bar), so its P&L would have been too optimistic compared with the
backtests. Financing is now computed over the full history before slicing, and a test checks that the replay and the
paper trader produce identical trades and equity.

## 2026-11-04: Phase 4 pre-registration (written before any test is run)

**Hypothesis H4:** multi-horizon *time-series momentum* (`tsmom`) on **daily** bars works across more of the 9
markets than the 4h Donchian breakout, because it is the best-documented trend effect in futures literature
(1-, 3- and 12-month horizons) and holds positions longer, so trading costs matter less.

- Rule (fixed before testing): score = mean of sign(return over `lb_short`, 63, `lb_long` bars). Enter long when all three
  agree up (score = +1) and short when all agree down; exit when the score turns ≤ 0 (long) or ≥ 0 (short).
  Disaster stop = `stop_atr` × ATR(20). Position size from the same 0.75% risk-per-trade rule.
- Grid (12 combos, chosen once): lb_short ∈ {10, 21, 42}, lb_long ∈ {126, 252}, stop_atr ∈ {3, 5}.
- Test: walk-forward on daily bars, train 3 years, test 1 year, all 9 markets, then the shared-account
  portfolio from 1999 to 2026, with financing. **Pass = portfolio PF > 1.3 and max DD < 15% with the 20% halt disabled**,
  plus ≥ 100 trades. One run; no re-tuning after seeing the result.
- Statistical check: 95% bootstrap confidence interval on portfolio PF (resampling trades). If the lower bound is ≤ 1.0,
  the edge is not statistically distinguishable from zero, even if the point estimate passes.
