"""Command line entry point.

  tradingbot backtest --symbol XAUUSD --strategy trend --data data/XAUUSD_1h.csv
  tradingbot backtest --all --synthetic          # smoke test the pipeline, no data needed
  tradingbot download --symbol BTCUSDT --days 1095
  tradingbot walkforward --symbol BTCUSDT --timeframe 4h --strategy all
  tradingbot instruments
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import data, metrics
from .backtest import run_backtest
from .instruments import INSTRUMENTS, get_instrument
from .risk import RiskConfig
from .strategies import STRATEGIES
from .walkforward import resample, walk_forward

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


def cmd_walkforward(args) -> int:
    risk = RiskConfig.load(args.config)
    symbols = list(INSTRUMENTS) if args.all else [get_instrument(args.symbol).symbol]
    strategies = list(STRATEGIES) if args.strategy == "all" else [args.strategy]
    bars_per_day = {"1h": 24, "4h": 6, "1D": 1}[args.timeframe]
    rows = []
    for sym in symbols:
        inst = get_instrument(sym)
        bars = _bars_for(sym, args)
        if bars is None:
            continue
        if args.timeframe != "1h":
            bars = resample(bars, args.timeframe)
        train, test = int(args.train_days * bars_per_day), int(args.test_days * bars_per_day)
        for sname in strategies:
            wf = walk_forward(bars, inst, sname, train, test, risk=risk, equity=args.equity,
                              long_only=args.long_only, usd_quote_rate=args.usdjpy)
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
    print(f"\nOut-of-sample only (stitched test windows). Acceptance: PF>{metrics.ACCEPTANCE['profit_factor']}, "
          f"maxDD<{metrics.ACCEPTANCE['max_drawdown']:.0%}, trades>={metrics.ACCEPTANCE['min_trades']}")
    return 0


def cmd_download(args) -> int:
    symbols = list(INSTRUMENTS) if args.all else [args.symbol]
    for sym in symbols:
        inst = get_instrument(sym)
        try:
            df = data.download(inst, days=args.days)
        except Exception as e:  # keep going for --all
            print(f"[fail] {inst.symbol}: {e}")
            continue
        out = data.DATA_DIR / f"{inst.symbol}_1h.csv"
        data.save_csv(df, out)
        print(f"[ok] {inst.symbol}: {len(df)} bars {df.index[0]} -> {df.index[-1]} -> {out}")
    return 0


def cmd_instruments(_args) -> int:
    for i in INSTRUMENTS.values():
        print(f"{i.symbol:10} {i.broker:8} {i.broker_symbol:11} mult={i.multiplier:<5g} "
              f"spread={i.spread:<6g} step={i.qty_step:g}")
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

    w = sub.add_parser("walkforward", help="walk-forward optimisation (out-of-sample only)")
    w.add_argument("--symbol", default="BTCUSDT")
    w.add_argument("--all", action="store_true")
    w.add_argument("--strategy", default="all", choices=["all", *STRATEGIES])
    w.add_argument("--timeframe", default="4h", choices=["1h", "4h", "1D"])
    w.add_argument("--train-days", type=float, default=365)
    w.add_argument("--test-days", type=float, default=90)
    w.add_argument("--long-only", action="store_true")
    w.add_argument("--data")
    w.add_argument("--synthetic", action="store_true")
    w.add_argument("--bars", type=int, default=20_000)
    w.add_argument("--equity", type=float, default=100_000)
    w.add_argument("--usdjpy", type=float, default=150.0)
    w.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "settings.yaml"))
    w.add_argument("--out", help="directory for fold / trade / equity CSVs")
    w.set_defaults(fn=cmd_walkforward)

    d = sub.add_parser("download")
    d.add_argument("--symbol", default="BTCUSDT")
    d.add_argument("--all", action="store_true")
    d.add_argument("--days", type=int, default=3 * 365)
    d.set_defaults(fn=cmd_download)

    sub.add_parser("instruments").set_defaults(fn=cmd_instruments)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
