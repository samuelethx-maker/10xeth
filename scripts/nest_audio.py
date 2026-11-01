"""Nest film audio: public/nest/mix.wav (VO + synthesized score + SFX) and src/nest/mouth.json
(per-frame visemes: open / wide / round), driven by src/nest/timeline.json."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
T = json.load(open('src/nest/timeline.json'))
N = int(SR * T['duration'])
S = T['scenes']
rng = np.random.default_rng(21)


def read(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def place(buf, sig, at):
    i = int(at * SR)
    if i < 0: sig, i = sig[-i:], 0
    j = min(buf.shape[-1], i + len(sig))
    if j > i: buf[..., i:j] += sig[: j - i]
def word(seg, text):
    for s, e, w in T['vo'][seg]['words']:
        if w.lower().lstrip('$').startswith(text.lower()): return s
    raise KeyError(text)

# ---------------- VO
vo = np.zeros(N)
for s in T['vo']:
    place(vo, read('public/nest/vo/' + s['file']), s['at'])
vo = np.tanh(hp(vo, 90) * 1.5) / np.tanh(1.5)

# ---------------- Music: 118 BPM synthwave-leaning, A minor
BPM = 122; beat = 60 / BPM
drop = S['spot'] - 0.15
end_hit = S['end'] + 0.1
music = np.zeros(N)
def kick():
    t = tt(0.42); f = 44 + 110 * np.exp(-t * 34)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
def snare():
    t = tt(0.32)
    return bp(rng.normal(0, 1, len(t)), 1400, 6500) * np.exp(-t * 14) * 0.7 + np.sin(2 * np.pi * 200 * t) * np.exp(-t * 28) * 0.4
def hat(d=0.05):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 8000) * np.exp(-t * 85)
roots = [38, 46, 41, 45]  # D Bb F A
# intro: half-time pulse, then full beat from the drop
b, i = 0.7, 0
while b < end_hit - 0.05:
    full = b >= drop
    bar = int(i // 4)
    if full or i % 2 == 0: place(music, kick() * (0.6 if full else 0.35), b)
    if full: place(music, hat() * 0.06, b + beat / 2)
    if b > S['swap'] and i % 4 in (1, 3): place(music, snare() * 0.18, b)
    if b > S['engine']:
        place(music, hat(0.03) * 0.045, b + beat / 4); place(music, hat(0.03) * 0.045, b + 3 * beat / 4)
    # rolling 8th-note bass
    for h in (0, 0.5):
        t = tt(beat * 0.42); f = mtof(roots[(bar // 2) % 4])
        saw = 2 * ((f * t) % 1) - 1
        place(music, lp(saw, 420 + 300 * full) * np.exp(-t * 7) * (0.16 if full else 0.08), b + h * beat)
    b += beat; i += 1

# pads + arp
pad = np.zeros(N)
chords = [[62, 65, 69, 74], [58, 62, 65, 70], [53, 57, 60, 65], [57, 61, 64, 69]]
bl = beat * 8; st, k = 0.0, 0
while st < 30:
    d = bl + 1.0; t = tt(d); sig = np.zeros(len(t))
    for m in chords[k % 4]:
        for det in (-0.08, 0.08):
            f = mtof(m) * 2 ** (det / 12); sig += 2 * ((f * t + rng.uniform()) % 1) - 1
    e = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.9)
    place(pad, lp(sig, 1300, 4) * e * 0.02, st); st += bl; k += 1
arp = np.zeros(N)
seq = [74, 77, 81, 86, 81, 77, 84, 81]
st, k = S['swap'], 0
while st < end_hit - 0.1:
    t = tt(0.2); f = mtof(seq[k % 8])
    sq = np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t) * 0.4
    place(arp, lp(sq, 2600) * np.exp(-t * 15) * 0.035, st); st += beat / 2; k += 1

# ---------------- SFX
sfx = np.zeros(N)
def whoosh(d=0.6, lo=300, hi=7000):
    n = int(d * SR); x = rng.normal(0, 1, n); out = np.zeros(n); seg = 512
    for s in range(0, n, seg):
        p = s / n; fc = lo * (hi / lo) ** np.sin(np.pi * p)
        out[s:s + seg] = bp(x[s:s + seg], max(fc * 0.7, 40), min(fc * 1.3, 20000))
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
def impact(d=2.5, amt=1.0):
    t = tt(d)
    boom = np.sin(2 * np.pi * np.cumsum(36 + 80 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.2)
    return (boom + lp(rng.normal(0, 1, len(t)), 500) * np.exp(-t * 6) * 0.3) * amt
def blip(at, f=1800, amt=0.04, d=0.08):
    t = tt(d); place(sfx, np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 60) * amt, at)
def chime(at, notes=(81, 88, 93), amt=0.035):
    for j, m in enumerate(notes):
        t = tt(1.8); f = mtof(m)
        place(sfx, (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 4)) * np.exp(-t * 2) * amt, at + j * 0.06)
def neon_buzz(at, d=0.5, amt=0.05):
    t = tt(d); hum = np.sign(np.sin(2 * np.pi * 120 * t)) * (rng.uniform(0, 1, len(t)) > 0.15)
    place(sfx, lp(hum, 3000) * np.minimum(1, t / 0.02) * np.exp(-t * 4) * amt, at)
def coin(at):
    for j, f in enumerate((1568, 2093)):
        t = tt(0.5); place(sfx, np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 9) * 0.03, at + j * 0.08)
def burn(at, d=1.0):
    t = tt(d); x = bp(rng.normal(0, 1, len(t)), 400, 3000) * (1 + 0.6 * np.sin(2 * np.pi * 9 * t))
    place(sfx, x * np.minimum(1, t / 0.15) * np.exp(-t * 2.5) * 0.08, at)

# hook: logo ignition
place(sfx, impact(2.2, 0.5), 0.3)
chime(0.35, (62, 69, 74), 0.03)
for s in ('spot', 'swap', 'lock', 'engine', 'flywheel'):
    place(sfx, whoosh() * 0.1, S[s] - 0.3)
blip(word(1, 'Hyperliquid'), 2200, 0.03)
blip(word(2, 'Swap'), 1600, 0.04); blip(word(2, 'Swap') + 0.12, 2400, 0.03)
coin(word(2, 'emissions'))
blip(word(3, 'Lock'), 900, 0.05)
chime(word(3, 'vote'), (74, 81), 0.03)
coin(word(3, 'fees') + 0.1)
t_ = tt(1.6); place(sfx, lp(np.sin(2 * np.pi * np.cumsum(50 + 60 * np.minimum(1, t_ / 0.8)) / SR), 300) * np.minimum(1, t_ / 0.3) * np.exp(-np.maximum(0, t_ - 0.9) * 4) * 0.25, word(4, 'Engine') - 0.1)
coin(word(4, 'hype'))
burn(word(4, 'revenue'), 0.8)
chime(word(5, 'aligned'), (74, 78, 81), 0.03)
blip(word(5, 'flywheel'), 2000, 0.03)
# riser + end impact
t = tt(2.6); r = (t / t[-1])
place(sfx, hp(rng.normal(0, 1, len(t)), 2500) * r ** 3 * 0.06 + np.sin(2 * np.pi * np.cumsum(220 + 900 * r ** 2) / SR) * r ** 2 * 0.02, S['end'] - 2.6)
place(sfx, impact(3.5, 0.95), end_hit)
chime(end_hit + 0.2, (62, 69, 74, 81), 0.04)

# ---------------- bus
ir_n = int(1.8 * SR); ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2); ir /= np.sqrt((ir ** 2).sum())
mixm = np.zeros((2, N))
for ch in range(2):
    wet = fftconvolve(pad + arp + sfx * 0.5, ir)[:N] * 0.3
    a = np.roll(arp, int(0.011 * SR)) if ch else arp
    mixm[ch] = music + pad + a + sfx + wet
env = np.convolve(np.abs(vo), np.ones(int(0.06 * SR)) / int(0.06 * SR), 'same')
mixm *= lp(1 - 0.5 * np.clip(env / 0.05, 0, 1), 7)
mix = mixm + vo[None, :]
mix[:, -int(0.7 * SR):] *= np.linspace(1, 0, int(0.7 * SR))
mix /= np.abs(mix).max() / 0.89
with wave.open('public/nest/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ---------------- visemes from the VO alone (same model as the Rip Cars film)
fps = T['fps']; hop = SR // fps; F = N // hop
def band_rms(x): return np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(F)]) + 1e-12)
rms = band_rms(vo); f1 = band_rms(bp(vo, 300, 1000)); f2lo = band_rms(bp(vo, 700, 1300)); f2hi = band_rms(bp(vo, 1800, 3200)); sib = band_rms(hp(vo, 4500))
voiced = np.clip((rms - 0.008) / 0.02, 0, 1)
vf = voiced > 0.5
lo1, hi1 = np.percentile(f1[vf], 8), np.percentile(f1[vf], 97)
open_ = np.clip((f1 - lo1) / (hi1 - lo1), 0, 1) ** 1.1 * voiced
open_ *= 1 - 0.6 * np.clip(sib / (rms + 1e-4) - 0.35, 0, 1)
wide = np.maximum(np.clip((f2hi / (f2lo + 1e-4) - 0.25) * 1.2, 0, 1), np.clip(sib / (rms + 1e-4) * 1.4, 0, 1)) * voiced
round_ = np.clip((f2lo / (f2hi + 1e-4) - 1.6) * 0.35, 0, 1) * voiced * (1 - wide * 0.7)
def follow(x, att=0.75, rel=0.4):
    y = np.zeros_like(x); v = 0.0
    for i, s in enumerate(x): v += (s - v) * (att if s > v else rel); y[i] = v
    return y
LEAD = 2  # lips lead the sound by ~33ms
sh = lambda a: np.concatenate([a[LEAD:], np.zeros(LEAD)])
json.dump({k: [round(float(v), 3) for v in sh(follow(a))] for k, a in (('open', open_), ('wide', wide), ('round', round_))}, open('src/nest/mouth.json', 'w'))
print('ok; mean open while voiced', round(float(open_[vf].mean()), 3))
