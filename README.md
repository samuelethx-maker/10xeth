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
