"""FOBO film audio + lip sync.

Writes src/fobo/timeline.json, public/fobo/mix.wav (VO + synthesized score + SFX) and src/fobo/mouth.json.
Mouth shapes are phoneme-driven: CMUdict phonemes are spread across each Whisper word span, mapped to pixel
visemes, gated by the voice energy, and bilabials (M/B/P) get a guaranteed visible lip closure."""
import json, re, wave
import numpy as np
import cmudict
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
FPS = 60
DUR = 30
N = SR * DUR
rng = np.random.default_rng(7)

# ---------------- timeline
AT = [0.5, 3.4, 7.15, 13.55, 17.2, 20.4, 26.15]
SCENES = {'hook': 0, 'floor': 3.2, 'launch': 6.95, 'trade': 13.35, 'dump': 17.0, 'pairs': 20.2, 'end': 25.95}
FIX = {'Dump': 'Dumps'}
W = json.load(open('public/fobo/vo/words.json'))


def read(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


vo_list = []
for i, a in enumerate(AT):
    f = f's{i+1}.wav'
    d = len(read('public/fobo/vo/' + f)) / SR
    words = [[round(a + s, 3), round(a + e, 3), (FIX.get(x, x) if i == 4 and j == 0 else x)] for j, (s, e, x) in enumerate(W[f's{i+1}'])]
    vo_list.append({'file': f, 'at': a, 'dur': round(d, 3), 'words': words})
T = {'fps': FPS, 'duration': DUR, 'vo': vo_list, 'scenes': SCENES}
json.dump(T, open('src/fobo/timeline.json', 'w'), indent=1)
S = SCENES


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
def word(seg, text, nth=0):
    hits = [s for s, e, w in T['vo'][seg]['words'] if re.sub(r'[^a-z0-9]', '', w.lower()).startswith(text.lower())]
    return hits[nth]


# ---------------- VO bus
vo = np.zeros(N)
for s in T['vo']:
    place(vo, read('public/fobo/vo/' + s['file']), s['at'])
vo = np.tanh(vo * 1.4) / np.tanh(1.4)

# ---------------- music: 120 BPM, E minor, dark synth + chip accents
BPM = 120; beat = 60 / BPM
drop = S['floor'] - 0.12
end_hit = S['end'] + 0.12
music = np.zeros(N)
def kick(amt=1.0):
    t = tt(0.45); f = 42 + 120 * np.exp(-t * 32)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) + hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t * 200) * 0.15) * amt
def clap():
    t = tt(0.3); n = bp(rng.normal(0, 1, len(t)), 900, 5000)
    env = sum(np.exp(-np.maximum(0, t - k * 0.011) * 60) * (t >= k * 0.011) for k in range(3)) + np.exp(-t * 14) * 0.6
    return n * env * 0.45
def hat(d=0.05):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 8500) * np.exp(-t * 90)
roots = [40, 36, 43, 38]  # E C G D
b, i = 0.5, 0
while b < end_hit - 0.05:
    full = b >= drop
    bar = i // 4
    breakdown = S['dump'] - 0.25 <= b < S['dump'] + 0.9  # drop-out for the dump moment
    if not breakdown:
        if full or i % 2 == 0: place(music, kick(0.62 if full else 0.32), b)
        if full: place(music, hat() * 0.055, b + beat / 2)
        if b > S['launch'] and i % 4 in (1, 3): place(music, clap() * 0.42, b)
        if b > S['trade']:
            place(music, hat(0.03) * 0.04, b + beat / 4); place(music, hat(0.03) * 0.04, b + 3 * beat / 4)
    for h in (0, 0.5):
        if breakdown: continue
        t = tt(beat * 0.45); f = mtof(roots[(bar // 2) % 4])
        saw = 2 * ((f * t) % 1) - 1
        sub = np.sin(2 * np.pi * f * t)
        place(music, (lp(saw, 380 + 340 * full) * 0.7 + sub * 0.5) * np.exp(-t * 6.5) * (0.15 if full else 0.08), b + h * beat)
    b += beat; i += 1

pad = np.zeros(N)
chords = [[64, 67, 71, 76], [60, 64, 67, 71], [67, 71, 74, 79], [62, 66, 69, 74]]
bl = beat * 8; st, k = 0.0, 0
while st < 30:
    d = bl + 1.2; t = tt(d); sig = np.zeros(len(t))
    for m in chords[k % 4]:
        for det in (-0.09, 0.0, 0.09):
            f = mtof(m) * 2 ** (det / 12); sig += 2 * ((f * t + rng.uniform()) % 1) - 1
    e = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 1.0)
    place(pad, lp(sig, 1100, 4) * e * 0.015, st); st += bl; k += 1
# chip arpeggio (square, pixel-brand nod) from the launch scene on
arp = np.zeros(N)
seq = [76, 79, 83, 88, 83, 79, 86, 83]
st, k = S['launch'], 0
while st < end_hit - 0.1:
    if not (S['dump'] - 0.25 <= st < S['dump'] + 0.9):
        t = tt(0.16); f = mtof(seq[k % 8])
        sq = np.sign(np.sin(2 * np.pi * f * t))
        place(arp, lp(sq, 3200) * np.exp(-t * 18) * 0.026, st)
    st += beat / 2; k += 1

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
    boom = np.sin(2 * np.pi * np.cumsum(34 + 90 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.0)
    return (boom + lp(rng.normal(0, 1, len(t)), 500) * np.exp(-t * 6) * 0.3) * amt
def chip(at, notes, step=0.055, amt=0.03, d=0.09):
    for j, m in enumerate(notes):
        t = tt(d); place(sfx, np.sign(np.sin(2 * np.pi * mtof(m) * t)) * np.exp(-t * 30) * amt, at + j * step)
def brick(at, amt=0.12):
    t = tt(0.25)
    place(sfx, (np.sin(2 * np.pi * np.cumsum(140 + 200 * np.exp(-t * 40)) / SR) * np.exp(-t * 22) + bp(rng.normal(0, 1, len(t)), 1500, 4000) * np.exp(-t * 80) * 0.4) * amt, at)
def click(at, amt=0.05):
    t = tt(0.03); place(sfx, hp(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 300) * amt, at)
def lock(at):
    t = tt(0.5)
    place(sfx, (bp(rng.normal(0, 1, len(t)), 2000, 7000) * np.exp(-t * 120) * 0.5 + np.sin(2 * np.pi * 95 * t) * np.exp(-t * 14)) * 0.22, at)
    place(sfx, hp(rng.normal(0, 1, int(0.04 * SR)), 3000) * 0.12, at + 0.09)
def pixel_on(at, n=10, amt=0.02):
    for j in range(n):
        t = tt(0.025); place(sfx, np.sign(np.sin(2 * np.pi * (900 + 160 * j) * t)) * amt, at + j * 0.035)

# hook: LED face boots up pixel by pixel, then the reveal hit
pixel_on(0.18, 14, 0.018)
place(sfx, impact(2.4, 0.55), 0.72)
chip(0.75, (76, 83, 88), 0.06, 0.025)
chip(word(0, 'pump'), (76, 83), 0.05, 0.03)
chip(word(0, 'dump'), (71, 64), 0.06, 0.03)
for s in ('floor', 'launch', 'trade', 'dump', 'pairs'):
    place(sfx, whoosh() * 0.1, S[s] - 0.3)
for j in range(5):
    click(word(1, 'only') + j * 0.09, 0.05)  # ratchet: floor only goes up
chip(word(1, 'up'), (79, 83, 88), 0.05, 0.03)
lock(word(2, 'locked') + 0.05)
chip(word(2, 'fair'), (72, 76), 0.05, 0.025)
for j in range(7):
    brick(S['trade'] + 0.55 + j * 0.42, 0.09)  # every trade lays a brick
chip(word(3, 'floor'), (76, 79, 83), 0.05, 0.03)
# dump: falling sweep -> heavy floor impact -> floor ratchets up
t = tt(0.9); place(sfx, np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 3)) / SR) * np.minimum(1, t / 0.05) * 0.05, word(4, 'dump') - 0.2)
place(sfx, impact(3.0, 0.85), word(4, 'floor', 0))
for j in range(4):
    click(word(4, 'keeps') + j * 0.11, 0.06)
chip(word(4, 'climbing'), (76, 79, 83, 88), 0.06, 0.03)
chip(word(5, 'eth'), (83, 88), 0.05, 0.025); chip(word(5, 'stocks'), (79, 86), 0.05, 0.025)
chip(word(5, 'robinhood'), (76, 83, 88), 0.06, 0.03)
# riser + end hit
t = tt(2.4); r = t / t[-1]
place(sfx, hp(rng.normal(0, 1, len(t)), 2500) * r ** 3 * 0.06 + np.sin(2 * np.pi * np.cumsum(220 + 900 * r ** 2) / SR) * r ** 2 * 0.02, S['end'] - 2.4)
place(sfx, impact(3.5, 0.95), end_hit)
pixel_on(end_hit + 0.05, 10, 0.016)
chip(end_hit + 0.15, (76, 83, 88, 95), 0.07, 0.03)

# ---------------- bus
ir_n = int(1.8 * SR); ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2); ir /= np.sqrt((ir ** 2).sum())
vo_ir = ir[: int(0.6 * SR)] * np.exp(-np.arange(int(0.6 * SR)) / SR * 6)
vo_wet = fftconvolve(vo, vo_ir)[:N] * 0.05
mixm = np.zeros((2, N))
for ch in range(2):
    wet = fftconvolve(pad + arp + sfx * 0.5, ir)[:N] * 0.3
    a = np.roll(arp, int(0.012 * SR)) if ch else arp
    p = np.roll(pad, int(0.008 * SR)) if ch else pad
    mixm[ch] = music + p + a + sfx + wet
env = np.convolve(np.abs(vo), np.ones(int(0.06 * SR)) / int(0.06 * SR), 'same')
mixm *= lp(1 - 0.5 * np.clip(env / 0.05, 0, 1), 7)
mix = mixm + (vo + vo_wet)[None, :]
mix[:, -int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
mix /= np.abs(mix).max() / 0.89
with wave.open('public/fobo/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ---------------- lip sync
CMU = cmudict.dict()
EXTRA = {
    'fobo': 'F OW1 B OW0', 'uniswap': 'Y UW1 N IH0 S W AA2 P', 'v4': 'V IY1 F AO1 R', 'eth': 'IY1 TH',
    'launchpad': 'L AO1 N CH P AE2 D', 'anti': 'AE1 N T IY0', 'snipe': 'S N AY1 P', 'tokenized': 'T OW1 K AH0 N AY2 Z D',
    'robinhood': 'R AA1 B IH0 N HH UH2 D',
}
VIS = {  # phoneme -> pixel viseme
    'M': 'M', 'B': 'M', 'P': 'M', 'F': 'F', 'V': 'F',
    'AA': 'A', 'AE': 'A', 'AH': 'A', 'AY': 'A', 'AW': 'A',
    'EH': 'E', 'EY': 'E', 'IH': 'E', 'IY': 'E', 'Y': 'E',
    'AO': 'O', 'OW': 'O', 'OY': 'O',
    'UW': 'U', 'UH': 'U', 'W': 'U', 'R': 'U', 'ER': 'U',
    'L': 'L', 'TH': 'L', 'DH': 'L', 'T': 'L', 'D': 'L', 'N': 'L',
    'S': 'S', 'Z': 'S', 'SH': 'S', 'ZH': 'S', 'CH': 'S', 'JH': 'S',
    'K': 'K', 'G': 'K', 'NG': 'K', 'HH': 'K',
}
def phones(w):
    out = []
    for part in re.split(r'[-\s]+', w.lower()):
        k = re.sub(r"[^a-z0-9']", '', part)
        if not k: continue
        p = EXTRA.get(k) or (CMU[k][0] if k in CMU else None)
        if isinstance(p, str): p = p.split()
        out += [re.sub(r'\d', '', x) for x in (p or ['AH'])]
    return out

FR = DUR * FPS
hop = SR // FPS
rms = np.sqrt(np.array([np.mean(vo[i * hop:(i + 1) * hop] ** 2) for i in range(FR)]) + 1e-12)
voiced_thr = 0.006
level = np.clip(rms / np.percentile(rms[rms > voiced_thr], 90), 0, 1.2)

voiced = rms > voiced_thr
def fr(t): return int(np.clip(round(t * FPS), 0, FR - 1))

def snap_word(s, e, prev_e, next_s):
    """Whisper edges can sit ~50-100 ms off. Edges in silence move onto the voiced audio; edges inside sound
    grow outward across the contiguous voiced run (bounded by the neighbouring words)."""
    if not voiced[fr(s)]:
        w = [k for k in range(fr(s - 0.08), fr(s + 0.2)) if voiced[k]]
        if w: s = w[0] / FPS
    else:
        k = fr(s)
        while k > fr(s - 0.12) and voiced[k - 1] and (k - 1) / FPS > prev_e: k -= 1
        s = k / FPS
    if not voiced[fr(e)]:
        w = [k for k in range(fr(e - 0.2), fr(e + 0.08)) if voiced[k]]
        if w: e = (w[-1] + 1) / FPS
    else:
        k = fr(e)
        while k < fr(e + 0.15) and voiced[k + 1] and (k + 1) / FPS < next_s: k += 1
        e = (k + 1) / FPS
    return s, max(e, s + 0.05)

def snap_closure(c, lo, hi):
    """Center a lip closure on the local energy minimum (stops/nasals dip in level)."""
    ks = range(max(fr(lo), fr(c - 0.07)), min(fr(hi), fr(c + 0.07)) + 1)
    k = min(ks, key=lambda k: rms[k]) if len(ks) else fr(c)
    return k / FPS - 0.025, k / FPS + 0.026

events = []  # (start, end, viseme)
word_spans = []
for seg in T['vo']:
    ws = seg['words']
    for wi_, (s0, e0, w) in enumerate(ws):
        prev_e = word_spans[-1][1] if wi_ else -9
        next_s = ws[wi_ + 1][0] if wi_ + 1 < len(ws) else 99
        s, e = snap_word(s0, e0, prev_e, next_s)
        word_spans.append((s, e))
        ph = phones(w)
        wts = np.array([1.6 if VIS[p] in 'AEOU' else 0.7 if p in ('P', 'B', 'T', 'D', 'K', 'G') else 1.0 for p in ph])
        edges = s + (e - s) * np.concatenate([[0], np.cumsum(wts) / wts.sum()])
        for j, p in enumerate(ph):
            a, b2 = edges[j], edges[j + 1]
            if VIS[p] == 'M':
                if j == 0 and p in ('P', 'B'):  # closure precedes the release burst, without eating the previous word
                    a = max(s - 0.05, prev_e - 0.01); b2 = max(s + 0.01, a + 0.05)
                else: a, b2 = snap_closure((a + b2) / 2, s - 0.03, e + 0.05)
            events.append((a, b2, VIS[p]))
events.sort()

LEAD = 0.025  # mouth shape leads the sound slightly
vis = []
for f in range(FR):
    t = f / FPS + LEAD
    cur = [v for a, b2, v in events if a <= t < b2]
    if cur:
        v = 'M' if 'M' in cur else cur[-1]
        if v == 'A' and level[f] < 0.5: v = 'a'
        if v not in 'MF' and level[f] < 0.08 and rms[f] < voiced_thr: v = 'X'  # energy gate
    else:
        near = min((abs(t - s) for s, _ in word_spans), default=9)
        prev_end = max((e for _, e in word_spans if e <= t), default=-9)
        nxt = min((s for s, _ in word_spans if s > t), default=99)
        v = 'X' if (t - prev_end < 0.12 or nxt - t < 0.12) and nxt - prev_end < 0.6 else 'R'
    vis.append(v)

# snapping closures can leave holes inside a word; hold the previous shape while the voice is sounding
for s, e in word_spans:
    last = None
    for f in range(fr(s - LEAD), fr(e - LEAD) + 1):
        if vis[f] in 'XR' and voiced[f] and last: vis[f] = last
        elif vis[f] not in 'XRM': last = vis[f]

# minimum holds: 2 frames for any shape, 3 for lip closures so they read on screen
runs = []
for v in vis:
    if runs and runs[-1][0] == v: runs[-1][1] += 1
    else: runs.append([v, 1])
for k in range(len(runs)):
    v, n = runs[k]
    if v in 'MF' and n < 3 and k + 1 < len(runs) and runs[k + 1][1] > 3 - n + 1:
        runs[k + 1][1] -= 3 - n; runs[k][1] = 3
for k in range(1, len(runs)):
    if runs[k][1] == 1 and runs[k][0] not in 'MF':
        runs[k][0] = runs[k - 1][0]
vis = ''.join(v * n for v, n in runs)
assert len(vis) == FR

json.dump({'vis': vis, 'level': [round(float(x), 3) for x in level]}, open('src/fobo/mouth.json', 'w'))

# verification: lip closures should sit on energy dips; silence should be closed
closures = [m.start() for m in re.finditer('M+', vis)]
dips = []
for c in closures:
    n = len(re.match('M+', vis[c:]).group(0))
    inside = rms[c:c + n].mean()
    around = np.concatenate([rms[max(0, c - 8):c], rms[c + n:c + n + 8]]).mean()
    dips.append(inside / (around + 1e-9))
sil = [i for i in range(FR) if not any(sg['at'] - 0.05 <= i / FPS <= sg['at'] + sg['dur'] + 0.05 for sg in T['vo'])]
print('closures', len(closures), 'median energy ratio inside/around', round(float(np.median(dips)), 2))
print('open shapes during silence', sum(vis[i] in 'AaEOULSK' for i in sil), 'of', len(sil))
print('viseme counts', {k: vis.count(k) for k in sorted(set(vis))})
