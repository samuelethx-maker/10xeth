import json

import numpy as np
import pandas as pd
import pytest

from tradingbot import data
from tradingbot.backtest import Engine, Leg, financing_per_bar, run_backtest, run_legs, run_portfolio
from tradingbot.instruments import get_instrument
from tradingbot.paper import PaperConfig, PaperTrader, closed_bars
from tradingbot.risk import RiskConfig
from tradingbot.strategies import STRATEGIES, Strategy
from tradingbot.walkforward import resample


def _leg(sym, n=3000, seed=1, price=2000, strategy="trend"):
    b = resample(data.synthetic(n * 4, start_price=price, seed=seed), "4h")
    return Leg.build(get_instrument(sym), b, STRATEGIES[strategy]().generate(b), financing=False)


def test_financing_charges_elapsed_time_and_funding_events():
    inst = get_instrument("XAUUSD")
    idx = pd.DatetimeIndex(["2024-01-05 16:00", "2024-01-05 20:00", "2024-01-08 00:00"], tz="UTC")
    fl, fs = financing_per_bar(inst, idx)
    assert fl[0] == 0 and fl[1] == pytest.approx(0.06 * 4 / 8760)
    assert fl[2] == pytest.approx(0.06 * 52 / 8760)  # weekend is charged
    assert (fs == 0).all()
    f = pd.Series([0.001, 0.002], index=pd.DatetimeIndex(["2024-01-05 18:00", "2024-01-06 00:00"], tz="UTC"))
    fl, fs = financing_per_bar(get_instrument("BTCUSDT"), idx, f)
    assert list(fl) == [0, 0.001, 0.002] and list(fs) == [0, -0.001, -0.002]


def test_financing_reduces_long_pnl():
    b = resample(data.synthetic(8000, start_price=2000, seed=3), "4h")
    sig = Strategy.empty_signals(b.index)
    sig.iloc[10, 0] = 1
    sig["stop_dist"] = 1500.0  # effectively never stopped
    inst = get_instrument("XAUUSD")
    with_fin = run_backtest(b, sig, inst, 10_000_000, financing=True).trades[0]
    no_fin = run_backtest(b, sig, inst, 10_000_000, financing=False).trades[0]
    assert with_fin.financing > 0
    assert with_fin.pnl == pytest.approx(no_fin.pnl - with_fin.financing)


def test_portfolio_respects_position_limits():
    legs = [_leg(s, seed=i, price=p) for i, (s, p) in enumerate(
        [("XAUUSD", 2000), ("XAGUSD", 25), ("NAS100USD", 16000), ("US30", 38000), ("BTCUSDT", 40000)])]
    risk = RiskConfig(max_open_positions=2, max_per_group=1)
    eng = Engine(risk, 100_000)
    all_t = legs[0].times
    for leg in legs[1:]:
        all_t = all_t.union(leg.times)
    idx = [leg.times.get_indexer(all_t) for leg in legs]
    max_open = 0
    for k, t in enumerate(all_t):
        eng.step(t, [(leg, int(ix[k])) for leg, ix in zip(legs, idx) if ix[k] >= 0])
        max_open = max(max_open, len(eng.pos))
        groups = [get_instrument(s).group for s in eng.pos]
        assert len(groups) == len(set(groups))
    assert max_open == 2
    assert len(eng.trades) > 0


def test_engine_state_roundtrip_matches_single_run():
    """Running in two halves with JSON serialisation in between (as the paper
    trader does) must give exactly the same trades as one continuous run."""
    legs = [_leg("XAUUSD", seed=5), _leg("BTCUSDT", seed=6, price=40000, strategy="meanrev")]
    risk = RiskConfig()
    full = run_legs(legs, Engine(risk, 100_000), close_at_end=False)

    cut = legs[0].times[len(legs[0].times) // 2]
    e1 = Engine(risk, 100_000)
    run_legs([_slice(l, l.times <= cut) for l in legs], e1, close_at_end=False)
    e2 = Engine.from_dict(json.loads(json.dumps(e1.to_dict())), risk)
    e2.record_equity = True
    run_legs([_slice(l, l.times > cut) for l in legs], e2, close_at_end=False)
    trades = e1.trades + e2.trades
    assert len(trades) == len(full.trades) > 0
    for a, b in zip(trades, full.trades):
        assert a.symbol == b.symbol and a.entry_time == b.entry_time and a.pnl == pytest.approx(b.pnl)
    assert e2.equity() == pytest.approx(full.equity())


def _slice(leg: Leg, mask) -> Leg:
    d = {k: (v[mask] if isinstance(v, (np.ndarray, pd.DatetimeIndex)) else v) for k, v in leg.__dict__.items()}
    return Leg(**d)


def test_closed_bars_drops_incomplete():
    b = data.synthetic(30, freq="1h")
    now = b.index[0] + pd.Timedelta(hours=10, minutes=5)
    cb = closed_bars(b, "4h", now)
    assert list(cb.index) == [b.index[0], b.index[4]]  # 08:00 bar not finished until 12:00


def test_paper_trader_ticks_and_persists(tmp_path):
    full = data.synthetic(24 * 500, start_price=2000, seed=11)
    clock = {"now": full.index[0] + pd.Timedelta(days=420)}

    def fetch(inst, days):
        return full[full.index < clock["now"]]

    cfg = PaperConfig(legs=["XAUUSD"], train_days=365, refit_days=90, state_dir=str(tmp_path))
    pt = PaperTrader(cfg, fetch=fetch, fetch_fund=lambda i, s: None, log=lambda m: None)
    s0 = pt.tick(clock["now"])
    assert s0["new_bars"] == 0  # first tick only initialises
    assert pt.state["params"]["XAUUSD"]["params"] is not None
    for _ in range(60):  # ~60 days of daily ticks, restarting the trader each time
        clock["now"] += pd.Timedelta(days=1)
        pt = PaperTrader(cfg, fetch=fetch, fetch_fund=lambda i, s: None, log=lambda m: None)
        pt.tick(clock["now"])
    eq = pd.read_csv(tmp_path / "equity.csv")
    assert len(eq) == 60 * 6  # one point per 4h bar, no gaps or duplicates
    assert pd.to_datetime(eq["time"]).is_monotonic_increasing
    assert (tmp_path / "report.md").read_text().startswith("# Paper trading report")
