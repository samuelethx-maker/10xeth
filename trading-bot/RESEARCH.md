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
