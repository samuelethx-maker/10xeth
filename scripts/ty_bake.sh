#!/usr/bin/env bash
# Bake the TickerYard host's static hair/jacket art to transparent PNGs (filters are too costly per frame).
set -e
cd "$(dirname "$0")/.."
npx remotion bundle src/index.ts --out-dir build --log=error >/dev/null
for p in Hair Body; do
  npx remotion still build Ty$p public/ty/$(echo $p | tr A-Z a-z).png --frame=0 --image-format=png --browser-executable=/usr/local/bin/google-chrome --log=error
done
