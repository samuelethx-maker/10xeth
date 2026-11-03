"""TickerYard film audio + lip sync.

Writes src/ty/timeline.json, public/ty/mix.wav (VO + synthesized score + SFX) and src/ty/mouth.json.
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
AT = [0.55, 3.5, 7.25, 11.3, 15.65, 21.55, 26.55]
SCENES = {'hook': 0, 'layer': 3.3, 'intent': 7.05, 'routes': 11.1, 'terminal': 15.45, 'eco': 21.35, 'end': 26.3}
FIX = {'root': 'route', 'Markets.': 'Markets,', 'Market.': 'Market,', 'Limit.': 'Limit,', 'Stop.': 'Stop,', 'OCO.': 'OCO,'}
W = json.load(open('public/ty/vo/words.json'))


def read(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


vo_list = []
for i, a in enumerate(AT):
    f = f's{i+1}.wav'
    d = len(read('public/ty/vo/' + f)) / SR
    words = [[round(a + s, 3), round(a + e, 3), FIX.get(x, x)] for j, (s, e, x) in enumerate(W[f's{i+1}'])]
    vo_list.append({'file': f, 'at': a, 'dur': round(d, 3), 'words': words})
T = {'fps': FPS, 'duration': DUR, 'vo': vo_list, 'scenes': SCENES}
json.dump(T, open('src/ty/timeline.json', 'w'), indent=1)
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
    place(vo, read('public/ty/vo/' + s['file']), s['at'])
vo = np.tanh(vo * 1.4) / np.tanh(1.4)

# ---------------- music: 112 BPM, A minor, precise minimal-tech (pulse bass, glassy plucks, airy pad)
BPM = 112; beat = 60 / BPM
drop = S['layer'] - 0.1
end_hit = S['end'] + 0.1
music = np.zeros(N)
def kick(amt=1.0):
    t = tt(0.5); f = 40 + 110 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + hp(rng.normal(0, 1, len(t)), 4000) * np.exp(-t * 260) * 0.12) * amt
def rim():
    t = tt(0.12); return (bp(rng.normal(0, 1, len(t)), 1800, 6000) * np.exp(-t * 70) * 0.5 + np.sin(2 * np.pi * 820 * t) * np.exp(-t * 60) * 0.4)
def hat(d=0.04):
    t = tt(d); return hp(rng.normal(0, 1, len(t)), 9000) * np.exp(-t * 110)
roots = [45, 41, 36, 43]  # A F C G
b, i = 0.55, 0
while b < end_hit - 0.05:
    full = b >= drop
    bar = i // 4
    br = S['eco'] - 0.2 <= b < S['eco'] + 1.0  # breath before the finale build
    if not br:
        if full or i % 2 == 0: place(music, kick(0.55 if full else 0.3), b)
        if b > S['intent']: place(music, hat() * 0.05, b + beat / 2)
        if b > S['routes'] and i % 4 in (1, 3): place(music, rim() * 0.22, b)
        if b > S['terminal']:
            for q in (0.25, 0.75): place(music, hat(0.025) * 0.035, b + beat * q)
    # 16th pulse bass, filter opens per scene
    for q in range(4):
        if br or (not full and q % 2): continue
        t = tt(beat * 0.22); f = mtof(roots[(bar // 2) % 4])
        saw = 2 * ((f * t) % 1) - 1
        cut = 300 + 260 * full + 160 * (b > S['terminal'])
        place(music, (lp(saw, cut) * 0.7 + np.sin(2 * np.pi * f * t) * 0.5) * np.exp(-t * 9) * (0.12 if full else 0.07) * (1.15 if q == 0 else 0.85), b + q * beat / 4)
    b += beat; i += 1
pad = np.zeros(N)
chords = [[57, 60, 64, 69, 76], [53, 57, 60, 65, 72], [48, 52, 55, 60, 67], [55, 59, 62, 67, 74]]
bl = beat * 8; st, k = 0.0, 0
while st < 30:
    d = bl + 1.4; t = tt(d); sig = np.zeros(len(t))
    for m in chords[k % 4]:
        for det in (-0.07, 0.07):
            f = mtof(m) * 2 ** (det / 12); sig += 2 * ((f * t + rng.uniform()) % 1) - 1
    e = np.minimum(1, t / 1.0) * np.minimum(1, (d - t) / 1.2)
    place(pad, lp(sig, 900 + 500 * (st > S['terminal']), 4) * e * 0.012, st); st += bl; k += 1
arp = np.zeros(N)  # glassy FM plucks
seq = [69, 76, 72, 79, 76, 81, 79, 84]
st, k = S['intent'], 0
while st < end_hit - 0.1:
    if not (S['eco'] - 0.2 <= st < S['eco'] + 1.0):
        t = tt(0.35); f = mtof(seq[k % 8])
        fm = np.sin(2 * np.pi * f * t + 1.8 * np.exp(-t * 20) * np.sin(2 * np.pi * f * 2 * t))
        place(arp, fm * np.exp(-t * 11) * 0.03, st)
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
def tick(at, f=2400, amt=0.04):
    t = tt(0.05); place(sfx, np.sin(2 * np.pi * f * t) * np.exp(-t * 120) * amt, at)
def key(at, amt=0.035):
    t = tt(0.04); place(sfx, (bp(rng.normal(0, 1, len(t)), 1500, 6000) * np.exp(-t * 180) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.4) * amt, at)
def chime(at, notes, amt=0.03, step=0.07):
    for j, m in enumerate(notes):
        t = tt(1.4); f = mtof(m)
        place(sfx, (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 6)) * np.exp(-t * 3) * amt, at + j * step)
def data(at, d=0.5, amt=0.02):
    n = int(d / 0.03)
    for j in range(n): tick(at + j * 0.03, 1800 + (hash_ := (j * 37 % 11)) * 140, amt * (1 - j / n))
def zap(at, d=0.35, f0=600, f1=3200, amt=0.03):
    t = tt(d); r = t / d; place(sfx, np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * r ** 2) / SR) * np.sin(np.pi * r) * amt, at)

# hook: route lines draw in, trident locks with an impact
for j in range(6): zap(0.15 + j * 0.06, 0.3, 500 + j * 120, 2600 + j * 200, 0.012)
place(sfx, impact(2.6, 0.55), 0.62)
chime(0.66, (69, 76, 81), 0.028)
chime(word(0, 'routed'), (76, 81), 0.022)
for s in ('layer', 'intent', 'routes', 'terminal', 'eco'):
    place(sfx, whoosh() * 0.09, S[s] - 0.3)
data(word(1, 'robinhood') - 0.1, 0.5, 0.02)
# intent: typing the instruction, path search, execute confirmation
for j in range(26): key(S['intent'] + 0.25 + j * 0.045 + (j % 5 == 4) * 0.02, 0.03)
data(word(2, 'finds'), 0.6, 0.022)
zap(word(2, 'best'), 0.4, 700, 3000, 0.03)
chime(word(2, 'executes') + 0.2, (76, 81, 88), 0.032)
# routes
zap(word(3, 'bridge'), 0.5, 400, 2400, 0.03); chime(word(3, 'ybtc') + 0.1, (81, 88), 0.025)
zap(word(3, 'crop'), 0.5, 500, 2800, 0.03)
# terminal: a click per order type
for w in ('market', 'limit', 'stop', 'oco', 'twap'): tick(word(4, w), 2600, 0.05); tick(word(4, w) + 0.04, 3900, 0.025)
for j in range(8): tick(word(4, 'twap') + 0.25 + j * 0.1, 1700, 0.022)  # TWAP slices
# ecosystem
chime(word(5, 'yardkeepers'), (69, 76, 81, 88), 0.026, 0.05)
data(word(5, 'connected'), 0.7, 0.018)
# riser + end hit
t = tt(2.2); r = t / t[-1]
place(sfx, hp(rng.normal(0, 1, len(t)), 2500) * r ** 3 * 0.05 + np.sin(2 * np.pi * np.cumsum(220 + 900 * r ** 2) / SR) * r ** 2 * 0.018, S['end'] - 2.2)
place(sfx, impact(3.5, 0.95), end_hit)
for j in range(6): zap(end_hit + j * 0.05, 0.3, 500 + j * 150, 3000, 0.01)
chime(end_hit + 0.15, (69, 76, 81, 88), 0.032)

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
with wave.open('public/ty/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ---------------- lip sync
CMU = cmudict.dict()
EXTRA = {
    'tickeryard': 'T IH1 K ER0 Y AA2 R D', 'wbtc': 'D AH1 B AH0 L Y UW0 B IY1 T IY1 S IY1', 'ybtc': 'W AY1 B IY1 T IY1 S IY1',
    'oco': 'OW1 S IY1 OW1', 'twap': 'T IY1 W AA1 P', 'yardkeepers': 'Y AA1 R D K IY2 P ER0 Z', 'yard': 'Y AA1 R D',
    'robinhood': 'R AA1 B IH0 N HH UH2 D', 'route': 'R UW1 T', 'routed': 'R UW1 T IH0 D', 'routing': 'R UW1 T IH0 NG',
}
VOWELS = {'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'}
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
        ph = [re.sub(r'\d', '', x) for x in (p or ['AH'])]
        # British (non-rhotic) voice: drop R after a vowel unless a vowel follows; ER becomes a neutral schwa
        ph = ['AH' if x == 'ER' else x for x in ph]
        ph = [x for j, x in enumerate(ph) if not (x == 'R' and j > 0 and ph[j - 1] in VOWELS and (j + 1 == len(ph) or ph[j + 1] not in VOWELS))]
        out += ph
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
        on = [k for k in range(fr(s - 0.08), fr(s + 0.25)) if voiced[k] and not voiced[k - 1] and k / FPS > prev_e]
        if on: s = min(on, key=lambda k: abs(k / FPS - s)) / FPS
    else:
        k = fr(s)
        while k > fr(s - 0.12) and voiced[k - 1] and (k - 1) / FPS > prev_e: k -= 1
        s = k / FPS
    if not voiced[fr(e)]:
        off = [k for k in range(fr(e - 0.25), fr(e + 0.08)) if voiced[k] and not voiced[k + 1] and k / FPS < next_s]
        if off: e = (min(off, key=lambda k: abs(k / FPS - e)) + 1) / FPS
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
        # warp so each vowel's centre sits on its syllable's energy peak (when the peak count matches)
        vow = [j for j, p in enumerate(ph) if VIS[p] in 'AEOU' and p not in ('W', 'R', 'Y')]
        if len(vow) >= 2:
            k0, k1 = fr(s), fr(e)
            env = np.convolve(rms[k0:k1 + 1], np.ones(3) / 3, 'same')
            pk = [k for k in range(1, len(env) - 1) if env[k] >= env[k - 1] and env[k] > env[k + 1] and env[k] > 0.03]
            merged = []
            for k in pk:  # keep peaks separated by a real dip
                if merged and env[merged[-1]:k + 1].min() > 0.75 * min(env[merged[-1]], env[k]):
                    if env[k] > env[merged[-1]]: merged[-1] = k
                else: merged.append(k)
            if len(merged) == len(vow):
                nom = [(edges[j] + edges[j + 1]) / 2 for j in vow]
                real = [(k0 + k) / FPS for k in merged]
                edges = np.interp(edges, [s] + nom + [e], [s] + real + [e])
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
    span = range(fr(s - LEAD), fr(e - LEAD) + 1)
    last = None
    for f in span:
        if vis[f] in 'XR' and voiced[f]:
            nxt = next((vis[g] for g in range(f + 1, min(FR, f + 12)) if vis[g] not in 'XRM'), None)
            fill = last or nxt
            if fill: vis[f] = fill
        elif vis[f] not in 'XRM': last = vis[f]

# voice still sounding past a (too short) Whisper word span: keep the mouth moving with the nearest shape
for f in range(FR):
    if vis[f] in 'XR' and level[f] > 0.3:
        back = next((vis[g] for g in range(f - 1, max(0, f - 18), -1) if vis[g] not in 'XRM'), None)
        fwd = next((vis[g] for g in range(f + 1, min(FR, f + 18)) if vis[g] not in 'XRM'), None)
        v = back or fwd
        if v: vis[f] = 'a' if v in 'AEO' and level[f] < 0.5 else v

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

json.dump({'vis': vis, 'level': [round(float(x), 3) for x in level]}, open('src/ty/mouth.json', 'w'))

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
