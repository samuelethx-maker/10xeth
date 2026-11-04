import numpy as np
import pandas as pd
import pytest

from tradingbot import data, indicators as ind
from tradingbot.backtest import run_backtest
from tradingbot.brokers.paper import PaperBroker
from tradingbot.instruments import get_instrument
from tradingbot.metrics import compute
from tradingbot.risk import RiskConfig, RiskManager, position_size
from tradingbot.strategies import STRATEGIES, Strategy


def bars_from(closes, spread=0.5):
    closes = np.asarray(closes, float)
    opens = np.concatenate([[closes[0]], closes[:-1]])
    idx = pd.date_range("2024-01-01", periods=len(closes), freq="1h", tz="UTC")
    return pd.DataFrame({
        "open": opens, "high": np.maximum(opens, closes) + spread,
        "low": np.minimum(opens, closes) - spread, "close": closes, "volume": 1.0,
    }, index=idx)


def test_aliases_and_rounding():
    es = get_instrument("ES1!")
    assert es.symbol == "ES" and es.multiplier == 50
    assert es.round_qty(1.9) == 1 and es.round_qty(0.7) == 0
    assert get_instrument("NAS100USD").round_qty(0.37) == pytest.approx(0.3)
    assert es.round_price(5000.13) == 5000.25
    assert get_instrument("GBPJPY").round_price(190.12345) == 190.123


def test_position_size_risk_and_leverage():
    xau = get_instrument("XAUUSD")
    # $100k * 1% = $1000 risk, $10 stop -> 100 oz
    assert position_size(xau, 100_000, 2000, 10, 0.01) == 100
    # tiny stop would imply huge size -> capped at 10x leverage = 500 oz
    assert position_size(xau, 100_000, 2000, 0.1, 0.01) == 500
    # one ES contract at 20pt stop risks $1000: not affordable on $10k at 1%
    assert position_size(get_instrument("ES"), 10_000, 5000, 20, 0.01) == 0
    # JPY pair: risk converted through USDJPY
    gj = get_instrument("GBPJPY")
    assert position_size(gj, 100_000, 190, 0.5, 0.01, quote_to_usd=1 / 150) == 300_000


def test_indicators_are_causal():
    b = data.synthetic(500, seed=1)
    full = ind.atr(b, 14)
    part = ind.atr(b.iloc[:300], 14)
    pd.testing.assert_series_equal(full.iloc[:300], part)
    up, _ = ind.donchian(b, 20)
    assert up.iloc[25] == b["high"].iloc[5:25].max()


@pytest.mark.parametrize("name", list(STRATEGIES))
def test_strategies_no_lookahead(name):
    b = data.synthetic(3000, seed=2)
    s = STRATEGIES[name]()
    full = s.generate(b)
    part = s.generate(b.iloc[:2000])
    pd.testing.assert_frame_equal(full.iloc[:2000], part)
    assert set(full["entry"].unique()) <= {-1, 0, 1}


def _one_signal(bars, at, direction, stop_dist, target=np.nan):
    sig = Strategy.empty_signals(bars.index)
    sig.iloc[at, sig.columns.get_loc("entry")] = direction
    sig["stop_dist"] = stop_dist
    sig["target_dist"] = target
    return sig


def test_entry_next_open_and_stop_fill_with_costs():
    inst = get_instrument("XAUUSD")
    closes = [2000] * 5 + [1990] * 5
    b = bars_from(closes, spread=0.0)
    sig = _one_signal(b, 2, 1, 5.0)
    res = run_backtest(b, sig, inst, 100_000, RiskConfig(risk_per_trade=0.01))
    t = res.trades[0]
    half = inst.spread / 2 + inst.slippage
    assert t.entry_time == b.index[3]
    assert t.entry_price == pytest.approx(2000 + half)
    assert t.exit_reason == "stop"
    # bar 5 opens at 2000 and closes 1990 -> stop touched intrabar, filled at stop minus costs
    assert t.exit_price == pytest.approx(t.stop - half)
    assert t.r_multiple < -1  # costs make the loss slightly worse than 1R


def test_gap_through_stop_fills_at_open():
    inst = get_instrument("XAUUSD")
    b = bars_from([2000] * 5, spread=0.1)
    b.iloc[4] = [1950, 1951, 1949, 1950, 1]
    res = run_backtest(b, _one_signal(b, 1, 1, 5.0), inst)
    t = res.trades[0]
    assert t.exit_price == pytest.approx(1950 - inst.spread / 2 - inst.slippage)


def test_daily_loss_limit_blocks_rest_of_day():
    rm = RiskManager.start(RiskConfig(daily_loss_limit=0.03, max_drawdown=0.5), 100_000)
    rm.on_new_day("d1", 100_000)
    assert not rm.update(98_000)
    assert rm.update(96_900) and not rm.can_open()
    rm.on_new_day("d2", 96_900)
    assert rm.can_open()


def test_paper_broker_requires_stop():
    inst = get_instrument("BTCUSDT")
    pb = PaperBroker(10_000)
    pb.set_price(inst, 40_000)
    assert not pb.market_order(inst, 0.01).ok
    assert pb.market_order(inst, 0.01, stop=39_000).ok
    pb.set_price(inst, 41_000)
    assert pb.equity() == pytest.approx(10_010)
    pb.close(inst)
    assert pb.position(inst) == 0 and pb.equity() == pytest.approx(10_010)


def test_full_pipeline_runs_on_synthetic():
    b = data.synthetic(5000, start_price=2000, seed=3)
    for name, cls in STRATEGIES.items():
        res = run_backtest(b, cls().generate(b), get_instrument("XAUUSD"), strategy_name=name)
        m = compute(res)
        assert m["trades"] > 0
        assert np.isfinite(res.equity).all()
