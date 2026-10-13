#!/usr/bin/env bash
# Usage: scripts/stills.sh 2.5 5.3 ...  -> out/stills/t<sec>.jpg (half-res) from the prebuilt bundle in build/
set -e
cd "$(dirname "$0")/.."
mkdir -p out/stills
for s in "$@"; do
  f=$(python3 -c "print(int($s*60))")
  npx remotion still build DexstockFilm "out/stills/t$s.jpg" --frame=$f --image-format=jpeg --scale=0.5 \
    --browser-executable=/usr/local/bin/google-chrome --log=error
done
