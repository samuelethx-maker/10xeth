#!/usr/bin/env bash
# Reproduces the RESEARCH.md tables. Usage: bash scripts/research.sh [A|B]
#   A = 4h walk-forward (all instruments) + 4h portfolio; B = daily long-history
set -u
cd "$(dirname "$0")/.."
L=results/logs
mkdir -p "$L"
case "${1:-A}" in
  A)
    uv run tradingbot walkforward --all --timeframe 4h --out results/wf4h > $L/wf_4h_all.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --out results/pf > $L/pf_4h.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --since 2025-06-15 > $L/pf_4h_common.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --max-dd 1.0 > $L/pf_4h_nohalt.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --symbols BTCUSDT,ETHUSDT > $L/pf_4h_crypto.txt 2>&1
    ;;
  C)  # extra portfolio views only (no walk-forward tables)
    uv run tradingbot portfolio --timeframe 4h --max-dd 1.0 > $L/pf_4h_nohalt.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --symbols BTCUSDT,ETHUSDT > $L/pf_4h_crypto.txt 2>&1
    ;;
  D)
    uv run tradingbot portfolio --timeframe 1D --train-days 1095 --test-days 365 --max-dd 1.0 > $L/pf_1d_nohalt.txt 2>&1
    ;;
  E)  # pre-registered "sit out when training score <= 0" rule
    uv run tradingbot walkforward --all --timeframe 4h --strategy trend --min-score 0 > $L/wf_4h_sitout.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --min-score 0 > $L/pf_4h_sitout.txt 2>&1
    uv run tradingbot portfolio --timeframe 4h --min-score 0 --max-dd 1.0 > $L/pf_4h_sitout_nohalt.txt 2>&1
    uv run tradingbot portfolio --timeframe 1D --train-days 1095 --test-days 365 --min-score 0 --max-dd 1.0 > $L/pf_1d_sitout_nohalt.txt 2>&1
    ;;
  B)
    uv run tradingbot walkforward --all --timeframe 1D --train-days 1095 --test-days 365 --out results/wf1d > $L/wf_1d_all.txt 2>&1
    uv run tradingbot portfolio --timeframe 1D --train-days 1095 --test-days 365 --out results/pf > $L/pf_1d.txt 2>&1
    uv run tradingbot portfolio --timeframe 1D --train-days 1095 --test-days 365 --max-dd 1.0 > $L/pf_1d_nohalt.txt 2>&1
    ;;
esac
touch "$L/${1:-A}.done"
