"""Rip Cars film audio: builds public/ripcars/mix.wav (VO + synthesized score + SFX) and
src/ripcars/mouth.json (per-frame lip-sync: open / wide / round), all driven by src/ripcars/timeline.json."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
T = json.load(open('src/ripcars/timeline.json'))
N = int(SR * T['duration'])
rng = np.random.default_rng(11)
S = T['scenes']


def read(path):
    with wave.open(path) as w:
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
        if w.lower().strip('.,%').startswith(text.lower()): return s
    raise KeyError(text)


# ---------------- VO
vo = np.zeros(N)
for s in T['vo']:
    place(vo, read('public/ripcars/vo/' + s['file']), s['at'])
vo = hp(vo, 90)
vo = np.tanh(vo * 1.5) / np.tanh(1.5)

# ---------------- Music (124 BPM, E minor drive)
BPM = 124; beat = 60 / BPM
drop = T['burst']
music = np.zeros(N)
end_impact = S['end'] + 0.1

def kick():
    t = tt(0.42); f = 42 + 120 * np.exp(-t * 38)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t * 300) * 0.3
def snare():
    t = tt(0.3)
    return bp(rng.normal(0, 1, len(t)), 1500, 6000) * np.exp(-t * 16) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
def hat(d=0.05):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 8000) * np.exp(-t * 80)

roots = [40, 36, 43, 38]  # E C G D
b, i = drop, 0
while b < end_impact - 0.05:
    bar = int(i // 4)
    place(music, kick() * 0.62, b)
    if b > S['flow']: place(music, hat() * 0.07, b + beat / 2)
    if b > S['options'] and i % 4 in (1, 3): place(music, snare() * 0.2, b)
    if b > S['thrill']:
        place(music, hat(0.03) * 0.05, b + beat / 4); place(music, hat(0.03) * 0.05, b + 3 * beat / 4)
    # offbeat sub bass with pluck envelope
    t = tt(beat * 0.45); f = mtof(roots[(bar // 2) % 4])
    bass = (np.sin(2 * np.pi * f * t) + 0.35 * np.sign(np.sin(2 * np.pi * f * t))) * np.exp(-t * 6)
    place(music, lp(bass, 500) * 0.22, b + beat / 2)
    b += beat; i += 1

# dark pad + arp layer
pad = np.zeros(N)
chords = [[52, 55, 59, 64], [48, 52, 55, 60], [55, 59, 62, 67], [50, 54, 57, 62]]
bar_len = beat * 8
k, st = 0, 0.0
while st < 30:
    d = bar_len + 1.0; t = tt(d); sig = np.zeros(len(t))
    for m in chords[k % 4]:
        for det in (-0.07, 0.07):
            f = mtof(m) * 2 ** (det / 12); sig += 2 * ((f * t + rng.uniform()) % 1) - 1
    e = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.9)
    place(pad, lp(sig, 1100, 4) * e * 0.022, st)
    st += bar_len; k += 1
arp = np.zeros(N)
st, k = S['options'], 0
seq = [64, 67, 71, 76, 71, 67, 74, 71]
while st < end_impact - 0.1:
    t = tt(0.22); f = mtof(seq[k % 8])
    arp_n = (2 * ((f * t) % 1) - 1) * np.exp(-t * 14)
    place(arp, lp(arp_n, 3000) * 0.05, st); st += beat / 2; k += 1
pad[: int(drop * SR)] *= 0.4

# ---------------- SFX
sfx = np.zeros(N)

def whoosh(d=0.6, lo=300, hi=7000):
    n = int(d * SR); x = rng.normal(0, 1, n); out = np.zeros(n); seg = 512
    for s in range(0, n, seg):
        p = s / n; fc = lo * (hi / lo) ** np.sin(np.pi * p)
        out[s:s + seg] = bp(x[s:s + seg], max(fc * 0.7, 40), min(fc * 1.3, 20000))
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 2

def foil_rip(d=0.38):
    """Crinkly tear: dense random crackles through a rising band-pass."""
    n = int(d * SR); x = np.zeros(n)
    for _ in range(int(d * 900)):
        p = rng.integers(0, n - 400); L = rng.integers(40, 400)
        x[p:p + L] += rng.normal(0, 1, L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.3, 1)
    x = bp(x, 1500, 9000) + bp(rng.normal(0, 1, n), 600, 2500) * 0.25
    return x * np.minimum(1, np.linspace(0, 6, n)) * np.minimum(1, np.linspace(6, 0, n))

def rev(d=0.9):
    t = tt(d); f = 38 + 70 * (t / d) ** 1.6 + 6 * np.sin(2 * np.pi * 9 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    eng = np.sign(np.sin(ph)) * 0.5 + np.sin(2 * ph) * 0.4 + np.sin(3 * ph + 0.3) * 0.2
    return lp(eng, 900) * np.minimum(1, t / 0.1) * np.minimum(1, (d - t) / 0.15)

def impact(d=2.5, amt=1.0):
    t = tt(d)
    boom = np.sin(2 * np.pi * np.cumsum(36 + 80 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.2)
    return (boom + lp(rng.normal(0, 1, len(t)), 500) * np.exp(-t * 6) * 0.35) * amt

def shimmer(at, notes=(88, 95, 100), amt=0.035):
    for j, m in enumerate(notes):
        t = tt(2.2); f = mtof(m)
        place(sfx, (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3)) * np.exp(-t * 1.8) * amt, at + j * 0.05)

def clunk(at):
    t = tt(1.4)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, dcy in ((180, 5), (431, 7), (912, 9))) * 0.25
    place(sfx, (impact(1.2, 0.6)[: len(t)] if len(t) <= int(1.2 * SR) else np.pad(impact(1.2, 0.6), (0, len(t) - int(1.2 * SR)))) + ring, at)
    # bolt clicks
    for j in range(3):
        c = tt(0.03); place(sfx, hp(rng.normal(0, 1, len(c)), 2500) * np.exp(-c * 150) * 0.25, at - 0.25 + j * 0.07)

def coin(at):
    for j, f in enumerate((1976, 2637)):
        t = tt(0.6); place(sfx, (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.4 * t)) * np.exp(-t * 7) * 0.05, at + j * 0.07)

def tick(at, f=2600, amt=0.03):
    t = tt(0.05); place(sfx, np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * amt, at)

# hook: engine rev -> rip -> burst
place(sfx, rev(0.75) * 0.22, 0.0)
place(sfx, foil_rip(0.36) * 0.22, T['rip'])
place(sfx, impact(2.4, 0.75), T['burst'])
shimmer(T['burst'] + 0.05, amt=0.04)
place(sfx, whoosh(0.7, 200, 5000) * 0.12, T['burst'] - 0.05)
# scene whooshes
for s in ('flow', 'options', 'trust', 'thrill'):
    place(sfx, whoosh() * 0.1, S[s] - 0.3)
# flow beats
tick(word(1, 'Open') + 0.35, 1800, 0.05)
place(sfx, foil_rip(0.25) * 0.12, word(1, 'Pull') - 0.12)
shimmer(word(1, 'Pull') + 0.15, (84, 91, 96), 0.03)
clunk(word(1, 'vault') + 0.05)
# options
for w in ('Keep', 'Sell', 'ship'):
    tick(word(2, w), 2200, 0.04)
coin(word(2, '90'))
# trust: stamp on "Guaranteed"
place(sfx, impact(0.8, 0.35), word(3, 'Guaranteed') + 0.25)
tick(word(3, 'Published'), 2400); tick(word(3, 'Nothing'), 2400)
# thrill: card flips on the beat
fb = S['thrill'] + 0.2
while fb < S['end'] - 0.3:
    place(sfx, whoosh(0.18, 1500, 9000) * 0.035, fb); fb += beat
t = tt(3.0); riser = hp(rng.normal(0, 1, len(t)), 2500) * (t / t[-1]) ** 3 * 0.07
riser += np.sin(2 * np.pi * np.cumsum(220 + 900 * (t / t[-1]) ** 2) / SR) * (t / t[-1]) ** 2 * 0.02
place(sfx, riser, S['end'] - 3.0)
# end impact + rev
place(sfx, impact(3.5, 0.95), S['end'] + 0.1)
place(sfx, rev(1.2) * 0.12, S['end'] + 0.15)
shimmer(S['end'] + 0.15, (86, 93, 98, 105), 0.04)
for w in ('Rip', 'Reveal'):
    tick(word(5, w), 2000, 0.04)

# ---------------- Reverb + bus
ir_n = int(1.8 * SR); ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2); ir /= np.sqrt((ir ** 2).sum())
mixm = np.zeros((2, N))
for ch, pan in ((0, -1), (1, 1)):
    wet = fftconvolve(pad + arp + sfx * 0.5, ir)[:N] * 0.3
    arp_d = np.roll(arp, int(0.012 * SR)) if pan > 0 else arp
    mixm[ch] = music + pad + arp_d + sfx + wet
# drop everything but the tail after the final impact so the tagline breathes
fade = np.ones(N); i0 = int((S['end'] + 0.1) * SR); fade[i0:] = 0.0
mixm[:, :] = mixm  # music already stops at end_impact; pad/arp keep ringing via reverb

# duck music under VO
env = np.convolve(np.abs(vo), np.ones(int(0.06 * SR)) / int(0.06 * SR), 'same')
duck = lp(1 - 0.5 * np.clip(env / 0.05, 0, 1), 7)
mixm *= duck
mix = mixm + vo[None, :] * 1.0
mix[:, -int(0.7 * SR):] *= np.linspace(1, 0, int(0.7 * SR))
mix /= np.abs(mix).max() / 0.89
with wave.open('public/ripcars/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ---------------- Lip sync from the VO alone
fps = T['fps']; hop = SR // fps; F = N // hop
def band_rms(x):
    return np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(F)]) + 1e-12)
rms = band_rms(vo)
f1 = band_rms(bp(vo, 300, 1000))       # jaw opening (first formant region)
f2lo = band_rms(bp(vo, 700, 1300))     # rounded vowels (oo / oh): low F2
f2hi = band_rms(bp(vo, 1800, 3200))    # spread vowels (ee / eh): high F2
sib = band_rms(hp(vo, 4500))           # s / sh / t: teeth close, lips slightly spread
voiced = np.clip((rms - 0.008) / 0.02, 0, 1)
vf = voiced > 0.5
lo1, hi1 = np.percentile(f1[vf], 8), np.percentile(f1[vf], 97)
open_ = np.clip((f1 - lo1) / (hi1 - lo1), 0, 1) ** 1.1 * voiced
open_ *= 1 - 0.6 * np.clip(sib / (rms + 1e-4) - 0.35, 0, 1)
wide = np.clip((f2hi / (f2lo + 1e-4) - 0.25) * 1.2, 0, 1) * voiced
wide = np.maximum(wide, np.clip(sib / (rms + 1e-4) * 1.4, 0, 1) * voiced)
round_ = np.clip((f2lo / (f2hi + 1e-4) - 1.6) * 0.35, 0, 1) * voiced * (1 - wide * 0.7)

def follow(x, att=0.75, rel=0.4):
    y = np.zeros_like(x); v = 0.0
    for i, s in enumerate(x):
        v += (s - v) * (att if s > v else rel); y[i] = v
    return y
LEAD = 2  # frames: lips form shapes slightly before the sound reaches the ear
sh = lambda a: np.concatenate([a[LEAD:], np.zeros(LEAD)])
out = {k: [round(float(v), 3) for v in sh(follow(a))] for k, a in (('open', open_), ('wide', wide), ('round', round_))}
json.dump(out, open('src/ripcars/mouth.json', 'w'))
print('mix ok; frames', F, 'mean open while speaking', round(float(open_[voiced > 0.5].mean()), 3))
