# Dexstock — 30s product film

A Remotion project for a 30-second 1080p60 motion piece about [Dexstock](https://dexstock.app/), presented by an animated character with lip sync.

## Rebuild

```bash
npm install
# narration (edge-tts, en-US-AndrewNeural) lives in public/vo/s1..s6.wav
python3 scripts/audio.py        # -> public/mix.wav (VO + synthesized score/SFX) and src/mouth.json (lip sync)
npm run render                  # -> out/dexstock-film.mp4
```

`scripts/audio.py` needs numpy and scipy. Scene and VO timings live in `src/timeline.json`, which both the audio script and the film read.
To swap the narration (for example to ElevenLabs), replace `public/vo/s*.wav`, update the phrase offsets in `timeline.json`, and rerun `audio.py`.

## Rip Cars — 30s product film

Composition `RipCarsFilm` (`src/ripcars/`). Car photos and odds come from the live ripcars.io vault API; narration is edge-tts `en-US-AvaNeural`.

```bash
python3 scripts/ripcars_audio.py   # -> public/ripcars/mix.wav + src/ripcars/mouth.json (open/wide/round visemes)
npm run render:ripcars             # -> out/ripcars-film.mp4
```

Word-level timings in `src/ripcars/timeline.json` (from Whisper alignment) drive both the kinetic type and the SFX hits.
