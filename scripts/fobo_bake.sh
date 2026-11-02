#!/usr/bin/env bash
# Bake the FOBO host's static hood/cloak art to transparent PNGs (filters are too costly to run per frame).
set -e
cd "$(dirname "$0")/.."
npx remotion bundle src/index.ts --out-dir build --log=error >/dev/null
for p in Head Body; do
  npx remotion still build FoboHood$p public/fobo/hood_$(echo $p | tr A-Z a-z).png --frame=0 --image-format=png --browser-executable=/usr/local/bin/google-chrome --log=error
done
