"""Builds public/mix.wav (VO + synthesized score + SFX) and src/mouth.json (per-frame lip-sync envelope)."""
import json, numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
T = json.load(open('src/timeline.json'))
N = int(SR * T['duration'])
rng = np.random.default_rng(7)
t = np.arange(N) / SR

def read(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768

def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def env(n, a, r):
    e = np.ones(n); a = int(a * SR); r = int(r * SR)
    e[:a] = np.linspace(0, 1, a) if a else 1
    if r: e[-r:] *= np.linspace(1, 0, r) ** 2
    return e
def place(buf, sig, at):
    i = int(at * SR); j = min(len(buf), i + len(sig)); buf[i:j] += sig[: j - i]
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# ---- VO
vo = np.zeros(N)
for s in T['vo']:
    place(vo, read('public/vo/' + s['file']), s['at'])
vo = hp(vo, 80)
# subtle presence: gentle compression via soft-knee
vo = np.tanh(vo * 1.6) / np.tanh(1.6)

# ---- Pad: D minor-ish progression, detuned saws, lowpassed
chords = [  # (start, [midi notes])
    (0, [38, 50, 57, 60, 64, 69]),      # Dm9
    (5.9, [34, 46, 53, 57, 62, 65]),    # Bbmaj7
    (11.05, [31, 43, 50, 53, 57, 62]),  # Gm9
    (17.25, [36, 48, 55, 59, 62, 67]),  # C6/9-ish
    (22.85, [33, 45, 52, 57, 61, 64]),  # A
    (26.15, [38, 50, 57, 62, 65, 69]),  # Dm add9 resolve
]
pad = np.zeros((2, N))
for k, (st, notes) in enumerate(chords):
    en = chords[k + 1][0] if k + 1 < len(chords) else T['duration']
    n = int((en - st + 1.2) * SR); tt = np.arange(n) / SR
    for ch in range(2):
        sig = np.zeros(n)
        for m in notes:
            for d in (-0.08, 0.08):
                f = mtof(m) * 2 ** ((d + (0.03 if ch else -0.03)) / 12)
                ph = rng.uniform(0, 1)
                sig += (2 * ((f * tt + ph) % 1) - 1) * (0.5 if m < 45 else 0.22)
        sig = lp(sig, 900 if k < 5 else 1400, 4) * env(n, 0.6, 1.2)
        place(pad[ch], sig * 0.05, st)
pad[:, : int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))

# ---- Pulse: soft kick + ticks at 100 BPM from 5.9s to 26.15s
beat = 60 / 100
drums = np.zeros(N)
def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 45 + 90 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
def tick():
    n = int(0.06 * SR); return hp(rng.normal(0, 1, n), 7000) * np.exp(-np.arange(n) / SR * 70)
def clap():
    n = int(0.25 * SR); return bp(rng.normal(0, 1, n), 1200, 4000) * np.exp(-np.arange(n) / SR * 18)
b = 5.9
i = 0
while b < 26.1:
    if b >= 22.85 and i % 2: pass
    place(drums, kick() * 0.55, b)
    place(drums, tick() * 0.08, b + beat / 2)
    if b > 11.05 and i % 4 == 2: place(drums, clap() * 0.12, b)
    if b > 17.25: place(drums, tick() * 0.05, b + beat / 4); place(drums, tick() * 0.05, b + 3 * beat / 4)
    b += beat; i += 1

# ---- Arp sparkle in features section
arp = np.zeros(N)
seq = [72, 76, 79, 83, 79, 76]
st = 17.25; k = 0
while st < 22.8:
    n = int(0.3 * SR); tt = np.arange(n) / SR
    f = mtof(seq[k % len(seq)])
    arp_note = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 10)
    place(arp, arp_note * 0.05, st); st += beat / 2; k += 1

# ---- SFX
sfx = np.zeros(N)
def whoosh(dur=0.7, lo=300, hi=6000):
    n = int(dur * SR); x = rng.normal(0, 1, n); out = np.zeros(n)
    seg = 512
    for s in range(0, n, seg):
        p = s / n; fc = lo * (hi / lo) ** (np.sin(np.pi * p))
        out[s:s + seg] = bp(x[s:s + seg] if s + seg <= n else x[s:], max(fc * 0.7, 40), min(fc * 1.3, 20000))[: len(out[s:s + seg])]
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
for h in T['hits'][:3] + [T['hits'][6]]:
    place(sfx, whoosh() * 0.10, h - 0.38)
for h in T['hits'][3:6]:
    place(sfx, whoosh(0.4, 800, 9000) * 0.05, h - 0.2)
# riser into the end
n = int(3.2 * SR); tt = np.arange(n) / SR
riser = hp(rng.normal(0, 1, n), 2000) * (tt / tt[-1]) ** 3 * 0.06
riser += np.sin(2 * np.pi * np.cumsum(200 + 800 * (tt / tt[-1]) ** 2) / SR) * (tt / tt[-1]) ** 2 * 0.02
place(sfx, riser, 26.15 - 3.2)
# impact
n = int(3.5 * SR); tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 12)) / SR) * np.exp(-tt * 1.6) * 0.6
boom += lp(rng.normal(0, 1, n), 400) * np.exp(-tt * 5) * 0.25
place(sfx, boom, 26.15)
# shimmer bell on logo
for m, d in ((86, 0), (93, 0.06), (98, 0.12)):
    n = int(3 * SR); tt = np.arange(n) / SR; f = mtof(m)
    place(sfx, (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3)) * np.exp(-tt * 1.5) * 0.04, 26.2 + d)
# soft UI ticks on phrase hits
for s in T['vo']:
    for off, _ in s['phrases']:
        n = int(0.05 * SR); tt = np.arange(n) / SR
        place(sfx, np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 90) * 0.025, s['at'] + off)

# ---- Reverb (simple exponential noise IR) for music bus
ir_n = int(2.2 * SR); ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 3); ir /= np.sqrt((ir ** 2).sum())
music_mono_extra = drums + arp + sfx
music = np.zeros((2, N))
for ch in range(2):
    dry = pad[ch] + music_mono_extra
    wet = fftconvolve(pad[ch] + arp + sfx * 0.6, ir)[:N] * 0.35
    music[ch] = dry + wet

# ---- Duck music under VO
vo_env = np.abs(vo)
win = int(0.08 * SR)
vo_env = np.convolve(vo_env, np.ones(win) / win, 'same')
duck = 1 - 0.45 * np.clip(vo_env / 0.05, 0, 1)
duck = lp(duck, 6)
music *= duck

mix = music + vo[None, :] * 0.95
mix[:, -int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))
mix /= np.abs(mix).max() / 0.89
with wave.open('public/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ---- Mouth envelope (per video frame, 0..1) from the VO alone
fps = T['fps']; hop = SR // fps
raw = np.abs(vo)
frames = len(raw) // hop
rms = np.sqrt(np.array([np.mean(raw[i * hop:(i + 1) * hop] ** 2) for i in range(frames)]))
# brightness (high-band share) drives mouth width vs roundness
hi_b = np.abs(hp(vo, 2500))
hb = np.sqrt(np.array([np.mean(hi_b[i * hop:(i + 1) * hop] ** 2) for i in range(frames)]))
open_ = np.clip((rms - 0.01) / 0.12, 0, 1) ** 0.7
wide = np.clip(hb / (rms + 1e-4) * 2.5, 0, 1)
sm = lambda a: np.convolve(a, [0.25, 0.5, 0.25], 'same')
json.dump({'open': [round(float(v), 3) for v in sm(open_)], 'wide': [round(float(v), 3) for v in sm(wide)]}, open('src/mouth.json', 'w'))
print('ok', mix.shape, frames)
