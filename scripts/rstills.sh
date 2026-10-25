#!/usr/bin/env bash
# Usage: scripts/rstills.sh <composition> <sheet.jpg> t1 t2 ... (6 or 9 times) -> half-res stills tiled 3-wide
set -e
cd "$(dirname "$0")/.."
comp=$1; sheet=$2; shift 2
mkdir -p out/stills; files=()
for s in "$@"; do f=$(python3 -c "print(int($s*60))"); o="out/stills/${comp}_$s.jpg"
  npx remotion still build "$comp" "$o" --frame=$f --image-format=jpeg --scale=0.5 --browser-executable=/usr/local/bin/google-chrome --log=error >/dev/null 2>&1; files+=("$o"); done
n=${#files[@]}; rows=$(( (n + 2) / 3 ))
ffmpeg -nostdin -v error -y $(printf -- '-i %s ' "${files[@]}") -filter_complex "$(for i in $(seq 0 $((n-1))); do printf '[%d]' $i; done)xstack=inputs=$n:layout=$(python3 -c "print('|'.join(f'{(i%3)*960}_{(i//3)*540}' for i in range($n)))"):fill=black" "out/$sheet"
echo "out/$sheet"
