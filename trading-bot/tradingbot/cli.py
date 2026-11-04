"""Command line entry point.

  tradingbot backtest --symbol XAUUSD --strategy trend --data data/XAUUSD_1h.csv
  tradingbot backtest --all --synthetic          # smoke test the pipeline, no data needed
  tradingbot download --symbol BTCUSDT --days 1095
  tradingbot walkforward --symbol BTCUSDT --timeframe 4h --strategy all
  tradingbot portfolio --strategy trend --timeframe 4h
  tradingbot paper [--loop]                       # simulated paper trading, no keys
  tradingbot dashboard                            # browser UI on http://127.0.0.1:8050
  tradingbot instruments
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import data, metrics
import pandas as pd

from .backtest import Leg, run_backtest, run_portfolio
from .instruments import INSTRUMENTS, get_instrument
from .risk import RiskConfig
from .strategies import STRATEGIES
from .walkforward import bars_per_day, resample, stitched_signals, walk_forward

DEFAULT_PRICES = {"GBPJPY": 190, "USDJPY": 150, "XAUUSD": 2000, "XAGUSD": 25, "NAS100USD": 16000,
                  "US30": 38000, "BTCUSDT": 40000, "ETHUSDT": 2500, "ES": 5000, "MES": 5000}


def _bars_for(symbol: str, args) -> data.pd.DataFrame | None:
    if args.synthetic:
        seed = sum(map(ord, symbol))
        return data.synthetic(n_bars=args.bars, start_price=DEFAULT_PRICES.get(symbol, 100), seed=seed)
    path = Path(args.data) if args.data and not args.all else data.DATA_DIR / f"{symbol}_1h.csv"
    if not path.exists():
        print(f"[skip] {symbol}: no data at {path} (run `tradingbot download --symbol {symbol}`)")
        return None
    return data.load_csv(path)


def cmd_backtest(args) -> int:
    risk = RiskConfig.load(args.config)
    symbols = list(INSTRUMENTS) if args.all else [get_instrument(args.symbol).symbol]
    strategies = list(STRATEGIES) if args.strategy == "all" else [args.strategy]
    rows = []
    for sym in symbols:
        inst = get_instrument(sym)
        bars = _bars_for(sym, args)
        if bars is None:
            continue
        split = int(len(bars) * (1 - args.oos))
        for sname in strategies:
            strat = STRATEGIES[sname]()
            sig = strat.generate(bars)  # causal indicators, so computing on full history is safe
            for seg, sl in (("in-sample", slice(0, split)), ("out-of-sample", slice(split, None))):
                if sl.start == sl.stop or (seg == "out-of-sample" and args.oos == 0):
                    continue
                res = run_backtest(bars.iloc[sl], sig.iloc[sl], inst, args.equity, risk,
                                   usd_quote_rate=args.usdjpy, strategy_name=sname)
                m = metrics.compute(res)
                m["segment"] = seg
                m["accepted"] = all(metrics.acceptance(m).values())
                rows.append(m)
                if args.trades_out and seg == "out-of-sample":
                    out = Path(args.trades_out) / f"{sym}_{sname}_trades.csv"
                    out.parent.mkdir(parents=True, exist_ok=True)
                    res.trades_frame().to_csv(out, index=False)
    if args.synthetic:
        print("NOTE: synthetic random-walk data - these numbers only prove the pipeline runs.\n")
    print(metrics.format_table(rows))
    print(f"\nAcceptance: PF>{metrics.ACCEPTANCE['profit_factor']}, "
          f"maxDD<{metrics.ACCEPTANCE['max_drawdown']:.0%}, trades>={metrics.ACCEPTANCE['min_trades']}")
    return 0


def _research_bars(sym: str, args):
    """Bars for walk-forward / portfolio research at args.timeframe."""
    if args.synthetic:
        return data.synthetic(n_bars=args.bars, start_price=DEFAULT_PRICES.get(sym, 100),
                              seed=sum(map(ord, sym)))
    interval = "1d" if args.timeframe == "1D" else "1h"
    bars = data.load_symbol(sym, args.source, interval)
    if bars is None:
        print(f"[skip] {sym}: no {interval} data (run `tradingbot download --symbol {sym}`)")
        return None
    if args.timeframe not in ("1h", "1D"):
        bars = resample(bars, args.timeframe)
    return bars


def _wf(sym, args, risk):
    inst = get_instrument(sym)
    bars = _research_bars(sym, args)
    if bars is None:
        return None, None, None
    bpd = bars_per_day(bars)
    funding = data.load_funding(inst.symbol) if args.financing else None
    out = {}
    for sname in (list(STRATEGIES) if args.strategy == "all" else [args.strategy]):
        out[sname] = walk_forward(
            bars, inst, sname, int(args.train_days * bpd), int(args.test_days * bpd), risk=risk,
            equity=args.equity, long_only=args.long_only, usd_quote_rate=args.usdjpy,
            funding=funding, financing=args.financing,
            min_score=args.min_score if args.min_score is not None else float("-inf"),
        )
    return inst, bars, out


def _risk(args) -> RiskConfig:
    risk = RiskConfig.load(args.config)
    if getattr(args, "max_dd", None) is not None:
        risk.max_drawdown = args.max_dd
    return risk


def cmd_walkforward(args) -> int:
    risk = _risk(args)
    symbols = list(INSTRUMENTS) if args.all else [get_instrument(s).symbol for s in args.symbol.split(",")]
    rows = []
    for sym in symbols:
        inst, bars, results = _wf(sym, args, risk)
        if results is None:
            continue
        for sname, wf in results.items():
            if not wf.folds:
                print(f"[skip] {sym} {sname}: not enough history for one fold")
                continue
            m = metrics.compute(wf.oos)
            folds = wf.folds_frame()
            m.update(
                segment=f"WF {args.timeframe}{' L' if args.long_only else ''}",
                folds=len(folds),
                pos_folds_pct=float((folds["test_return_pct"] > 0).mean() * 100),
                plateau=float(folds["plateau"].mean()),
                neighbour=float(folds["neighbour"].mean()),
                accepted=all(metrics.acceptance(m).values()),
            )
            rows.append(m)
            if args.out:
                out = Path(args.out)
                out.mkdir(parents=True, exist_ok=True)
                tag = f"{sym}_{sname}_{args.timeframe}{'_long' if args.long_only else ''}"
                folds.to_csv(out / f"{tag}_folds.csv", index=False)
                wf.oos.trades_frame().to_csv(out / f"{tag}_trades.csv", index=False)
                wf.oos.equity.to_csv(out / f"{tag}_equity.csv")
    if args.synthetic:
        print("NOTE: synthetic random-walk data - these numbers only prove the pipeline runs.\n")
    print(metrics.format_table(rows))
    print(f"\nOut-of-sample only (stitched test windows), incl. financing={args.financing}. "
          f"Acceptance: PF>{metrics.ACCEPTANCE['profit_factor']}, "
          f"maxDD<{metrics.ACCEPTANCE['max_drawdown']:.0%}, trades>={metrics.ACCEPTANCE['min_trades']}")
    return 0


def cmd_portfolio(args) -> int:
    """Walk-forward each instrument, then trade all stitched out-of-sample signals
    together through one account with shared risk limits."""
    risk = _risk(args)
    symbols = [get_instrument(s).symbol for s in args.symbols.split(",")] if args.symbols != "all" \
        else [s for s in INSTRUMENTS if s != ("ES" if args.micro else "MES")]
    legs = []
    for sym in symbols:
        inst, bars, results = _wf(sym, args, risk)
        if results is None or not results[args.strategy].folds:
            continue
        sig = stitched_signals(bars, results[args.strategy], args.long_only)
        b = bars.loc[sig.index]
        if args.since:
            keep = b.index >= pd.Timestamp(args.since, tz="UTC")
            b, sig = b[keep], sig[keep]
        if len(b) == 0:
            continue
        funding = data.load_funding(inst.symbol) if args.financing else None
        legs.append(Leg.build(inst, b, sig, funding, args.financing))
        print(f"[leg] {sym}: OOS {b.index[0].date()} -> {b.index[-1].date()} ({len(b)} bars)")
    res = run_portfolio(legs, args.equity, risk, args.usdjpy)
    m = metrics.compute(res)
    m["segment"] = f"portfolio {args.timeframe}{' L' if args.long_only else ''}"
    m["accepted"] = all(metrics.acceptance(m).values())
    print()
    print(metrics.format_table([m]))
    lo, hi = metrics.bootstrap_pf([t.pnl for t in res.trades])
    print(f"\nProfit factor 95% bootstrap CI: [{lo:.2f}, {hi:.2f}]"
          f"{'  -> not distinguishable from break-even' if lo <= 1.0 else ''}")
    tf = res.trades_frame()
    if len(tf):
        by = tf.groupby("symbol").agg(trades=("pnl", "size"), net_pnl=("pnl", "sum"),
                                      financing=("financing", "sum"), avg_r=("r_multiple", "mean"))
        print("\nContribution by instrument:")
        print(by.round(2).to_string())
        yearly = res.equity.resample("YE").last()
        yearly = pd.concat([pd.Series([res.initial_equity], index=[yearly.index[0] - pd.offsets.YearEnd()]), yearly])
        print("\nReturn by calendar year (%):")
        print((yearly.pct_change().dropna() * 100).round(1).rename(lambda t: t.year).to_string())
        print(f"\nRisk events: {len(res.risk_events)} "
              f"(daily-limit days: {m['days_blocked']}, halted: {m['halted']})")
    if args.out:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        tag = f"portfolio_{args.strategy}_{args.timeframe}{'_long' if args.long_only else ''}"
        tf.to_csv(out / f"{tag}_trades.csv", index=False)
        res.equity.to_csv(out / f"{tag}_equity.csv")
    return 0


def cmd_paper(args) -> int:
    from .paper import PaperConfig, PaperTrader

    cfg = PaperConfig.load(args.config)
    if args.reset and cfg.dir.exists():
        for f in cfg.dir.glob("*"):
            f.unlink()
        print(f"reset {cfg.dir}")
    pt = PaperTrader(cfg)
    if args.loop:
        pt.loop()
        return 0
    s = pt.tick()
    print(f"[tick] new bars {s['new_bars']}, closed trades {s['closed_trades']}, "
          f"equity ${s['equity']:,.2f}, open {s['open']}, pending {s['pending']}")
    print(f"report: {cfg.dir / 'report.md'}")
    return 0


def cmd_dashboard(args) -> int:
    from .dashboard import serve

    serve(args.host, args.port, args.auto_paper)
    return 0


def cmd_download(args) -> int:
    symbols = list(INSTRUMENTS) if args.all else [args.symbol]
    for sym in symbols:
        inst = get_instrument(sym)
        if inst.symbol == "MES":
            continue  # shares ES history
        try:
            df = data.download(inst, days=args.days, source=args.source, interval=args.interval)
            if args.funding and inst.broker == "binance":
                f = data.download_funding(inst.broker_symbol)
                f.rename_axis("time").to_csv(data.DATA_DIR / f"{inst.symbol}_funding.csv")
                print(f"[ok] {inst.symbol}: {len(f)} funding events")
        except Exception as e:  # keep going for --all
            print(f"[fail] {inst.symbol}: {e}")
            continue
        src = args.source if args.source not in ("auto", "binance", "dukascopy") else ""
        out = data.data_path(inst.symbol, src, args.interval)
        data.save_csv(df, out)
        print(f"[ok] {inst.symbol}: {len(df)} bars {df.index[0]} -> {df.index[-1]} -> {out}")
    return 0


def cmd_instruments(_args) -> int:
    for i in INSTRUMENTS.values():
        print(f"{i.symbol:10} {i.broker:8} {i.broker_symbol:11} mult={i.multiplier:<5g} "
              f"spread={i.spread:<6g} step={i.qty_step:g}")
    return 0


def cmd_broker_check(args) -> int:
    from .brokers import get_broker

    inst = get_instrument(args.symbol or {"oanda": "USDJPY", "binance": "BTCUSDT", "ibkr": "MES"}[args.broker])
    if inst.broker != args.broker:
        print(f"{inst.symbol} trades on {inst.broker}, not {args.broker}")
        return 2
    try:
        b = get_broker(args.broker)
    except Exception as e:  # noqa: BLE001
        print(f"cannot create {args.broker} broker: {e}")
        return 1
    with b:
        try:
            print(f"[1] connected: {b.name}")
            print(f"[2] equity: {b.equity():,.2f}")
            print(f"[3] positions: {b.positions()}")
            print(f"[4] open orders: {b.open_orders()}")
            px = b.price(inst)
            print(f"[5] {inst.symbol} quote: {px}")
            if not args.test_order:
                return 0
            qty = b.min_test_qty(inst)
            stop = inst.round_price(px * 0.98)
            print(f"[6] placing market BUY {qty:g} {inst.symbol} with stop {stop} (DEMO account)")
            res = b.market_order(inst, qty, stop=stop)
            print(f"[7] result: {res}")
            print(f"[8] positions: {b.positions()}  orders: {b.open_orders(inst)}")
            if not res.ok:
                return 1
            print(f"[9] closing {inst.symbol}")
            print(f"[10] result: {b.close(inst)}")
            print(f"[11] positions: {b.positions()}")
        except Exception as e:  # noqa: BLE001
            print(f"FAILED: {type(e).__name__}: {e}")
            return 1
    return 0


def cmd_reconcile(args) -> int:
    from .paper import PaperConfig, PaperTrader

    cfg = PaperConfig.load(args.config)
    if not args.dry_run and cfg.execution != "live":
        print(f"execution is {cfg.execution!r} in {args.config}; use --dry-run or set execution: live")
        return 2
    pt = PaperTrader(cfg)
    acts = pt.execute(dry_run=args.dry_run)
    print(f"{len(acts)} journal entries; log: {cfg.dir / 'orders.jsonl'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="tradingbot")
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("backtest")
    b.add_argument("--symbol", default="XAUUSD")
    b.add_argument("--all", action="store_true", help="all instruments")
    b.add_argument("--strategy", default="all", choices=["all", *STRATEGIES])
    b.add_argument("--data", help="CSV with time,open,high,low,close[,volume]")
    b.add_argument("--synthetic", action="store_true")
    b.add_argument("--bars", type=int, default=20_000)
    b.add_argument("--equity", type=float, default=100_000)
    b.add_argument("--oos", type=float, default=0.3, help="fraction held out as out-of-sample")
    b.add_argument("--usdjpy", type=float, default=150.0, help="USDJPY rate for JPY-quoted P&L")
    b.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "settings.yaml"))
    b.add_argument("--trades-out", help="directory for out-of-sample trade logs")
    b.set_defaults(fn=cmd_backtest)

    def research_args(sp, strategy_default="all"):
        sp.add_argument("--strategy", default=strategy_default,
                        choices=(["all"] if strategy_default == "all" else []) + list(STRATEGIES))
        sp.add_argument("--timeframe", default="4h", choices=["1h", "4h", "1D"])
        sp.add_argument("--train-days", type=float, default=365)
        sp.add_argument("--test-days", type=float, default=90)
        sp.add_argument("--long-only", action="store_true")
        sp.add_argument("--source", default="", help="data file source suffix, e.g. yahoo (default: auto)")
        sp.add_argument("--no-financing", dest="financing", action="store_false")
        sp.add_argument("--synthetic", action="store_true")
        sp.add_argument("--bars", type=int, default=20_000)
        sp.add_argument("--equity", type=float, default=100_000)
        sp.add_argument("--usdjpy", type=float, default=150.0)
        sp.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "settings.yaml"))
        sp.add_argument("--out", help="directory for CSV outputs")
        sp.add_argument("--min-score", type=float,
                        help="sit a market out for the next window unless its training score "
                             "(return/maxDD) is above this, e.g. 0")
        sp.add_argument("--max-dd", type=float,
                        help="override the max-drawdown halt (research only, e.g. 1.0 = never halt)")

    w = sub.add_parser("walkforward", help="walk-forward optimisation (out-of-sample only)")
    w.add_argument("--symbol", default="BTCUSDT", help="one or more, comma separated")
    w.add_argument("--all", action="store_true")
    research_args(w)
    w.set_defaults(fn=cmd_walkforward)

    pf = sub.add_parser("portfolio", help="out-of-sample portfolio backtest with shared risk")
    pf.add_argument("--symbols", default="all", help="comma separated, or all")
    pf.add_argument("--micro", action=argparse.BooleanOptionalAction, default=True,
                    help="use MES instead of ES in 'all' (default on; ES rarely fits 0.75%% risk under ~$500k)")
    pf.add_argument("--since", help="only trade OOS bars from this date (common window)")
    research_args(pf, "trend")
    pf.set_defaults(fn=cmd_portfolio)

    pp = sub.add_parser("paper", help="simulated paper trading on live free prices")
    pp.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "paper.yaml"))
    pp.add_argument("--loop", action="store_true", help="run forever, one tick per bar")
    pp.add_argument("--reset", action="store_true", help="wipe paper state first")
    pp.set_defaults(fn=cmd_paper)

    db = sub.add_parser("dashboard", help="web dashboard to test everything in a browser")
    db.add_argument("--host", default="127.0.0.1")
    db.add_argument("--port", type=int, default=8050)
    db.add_argument("--auto-paper", action="store_true", help="tick the paper trader automatically every bar")
    db.set_defaults(fn=cmd_dashboard)

    d = sub.add_parser("download")
    d.add_argument("--symbol", default="BTCUSDT")
    d.add_argument("--all", action="store_true")
    d.add_argument("--days", type=int, default=3 * 365)
    d.add_argument("--source", default="auto", choices=["auto", "binance", "dukascopy", "yahoo", "oanda", "ibkr"],
                   help="auto = Binance for crypto, Dukascopy for everything else")
    d.add_argument("--interval", default="1h", choices=["1h", "1d"])
    d.add_argument("--no-funding", dest="funding", action="store_false",
                   help="skip Binance funding-rate history for crypto")
    d.set_defaults(fn=cmd_download)

    bc = sub.add_parser("broker-check", help="connect to a DEMO broker account and print equity/positions/quote")
    bc.add_argument("--broker", required=True, choices=["oanda", "binance", "ibkr"])
    bc.add_argument("--symbol")
    bc.add_argument("--test-order", action="store_true", help="place and close a minimum-size order with a stop")
    bc.set_defaults(fn=cmd_broker_check)

    rc = sub.add_parser("reconcile", help="make demo broker positions match the paper-trader state once")
    rc.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "paper.yaml"))
    rc.add_argument("--dry-run", action="store_true", help="log intended actions only")
    rc.set_defaults(fn=cmd_reconcile)

    sub.add_parser("instruments").set_defaults(fn=cmd_instruments)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
