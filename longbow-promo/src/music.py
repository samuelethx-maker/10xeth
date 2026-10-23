# Original procedural soundtrack, 120 BPM, synced to the scene grid.
import numpy as np, wave
SR = 48000; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(1)
L = np.zeros(N); R = np.zeros(N)
BEAT = 0.5

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    s = sig[: N - i] * gain
    L[i:i + len(s)] += s * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(s)] += s * np.sqrt((1 + pan) / 2) * 1.414

def tt(d): return np.arange(int(d * SR)) / SR
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, k):  # moving-average lowpass
    return np.convolve(x, np.ones(k) / k, mode='same')
def saw(f, t, harm):
    return sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, harm + 1))

# chords per 2s bar: Am F C G (midi roots + triads)
CH = [[57, 60, 64], [53, 57, 60], [48, 55, 60, 64], [55, 59, 62]]
def chord(bar): return CH[bar % 4]

# --- pad
for bar in range(15):
    t0 = bar * 2.0; t = tt(2.3)
    harm = 3 if t0 < 6 else (5 if t0 < 10 else 7)
    g = 0.05 if t0 < 6 else (0.06 if t0 < 10 else 0.07)
    env = np.minimum(1, t / 0.3) * np.minimum(1, (2.3 - t) / 0.3)
    for j, m in enumerate(chord(bar)):
        for det in (-0.08, 0.08):
            add(saw(mtof(m + 12 + det), t, harm) * env, t0, g / 2, pan=det * 6 * (1 if j % 2 else -1))

# --- pluck arp (8ths), sparse in intro, absent in build, full in drop
def pluck(f, d=0.45):
    t = tt(d); return (np.sin(2*np.pi*f*t) + .4*np.sin(4*np.pi*f*t) + .15*np.sin(6*np.pi*f*t)) * np.exp(-t * 9)
for step in range(60):
    st = step * 0.5 * 1.0 / 1  # 8ths would be .25; use quarter in intro
for k in range(int(30 / 0.25)):
    t0 = k * 0.25; bar = int(t0 // 2); notes = chord(bar)
    if t0 < 6:
        if k % 2: continue
        g = 0.18
    elif t0 < 10 or t0 >= 27: continue
    else: g = 0.14
    m = notes[k % len(notes)] + 24 + (12 if (k // 4) % 2 and t0 >= 10 else 0)
    add(pluck(mtof(m)), t0, g, pan=0.35 if k % 2 else -0.35)

# --- drums
def kick():
    t = tt(0.45); f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + np.exp(-t * 300) * 0.4
def hat(d=0.06):
    t = tt(d); n = rng.standard_normal(len(t)); n = np.diff(np.diff(n, prepend=0), prepend=0)
    return n * np.exp(-t * 70) * 0.25
def clap():
    t = tt(0.25); n = rng.standard_normal(len(t)); n = n - lp(n, 12)
    e = np.exp(-t * 18) * (1 + 0.6 * (np.sin(2*np.pi*90*t) > 0) * (t < .03))
    return n * e * 0.5
K = kick()
duck = np.ones(N)
def kick_at(t0, g=0.9):
    add(K, t0, g); i = int(t0 * SR); d = tt(0.3); env = 1 - 0.65 * np.exp(-d * 9)
    duck[i:i + len(d)] = np.minimum(duck[i:i + len(d)], env[: max(0, min(len(d), N - i))])
for b in range(int(30 / BEAT)):
    t0 = b * BEAT
    if 10 <= t0 < 27 and not (24.0 <= t0 < 24.5):
        kick_at(t0)
        if b % 2: add(clap(), t0, 0.55)
        add(hat(), t0 + 0.25, 0.6, pan=0.2)
        add(hat(0.03), t0 + 0.125, 0.25, pan=-0.2)
        add(hat(0.03), t0 + 0.375, 0.25, pan=-0.2)
    elif t0 < 6:
        add(hat(0.03), t0, 0.35)  # ticking clock
# build: accelerating snare roll 6..9.8
t0 = 6.0
while t0 < 9.8:
    p = (t0 - 6) / 3.8
    add(clap(), t0, 0.12 + 0.35 * p, pan=rng.uniform(-.3, .3))
    t0 += 0.5 if p < .3 else (0.25 if p < .6 else (0.125 if p < .85 else 0.0625))

# --- sub bass in drop
for k in range(int(30 / 0.25)):
    t0 = k * 0.25
    if not (10 <= t0 < 27): continue
    m = chord(int(t0 // 2))[0] - 12
    t = tt(0.24); s = np.sin(2*np.pi*mtof(m)*t) + 0.3*np.sin(4*np.pi*mtof(m)*t)
    add(s * np.minimum(1, t / .005) * np.exp(-t * 4), t0, 0.32)

# --- FX
def whoosh(d=0.7, up=True):
    t = tt(d); n = rng.standard_normal(len(t)); lo = lp(n, 40); hi = n - lp(n, 6)
    x = t / d; mix = x if up else 1 - x
    return (lo * (1 - mix) * 3 + hi * mix * .8) * np.sin(np.pi * x) ** 2 * 0.5
for tc in (3, 6, 13, 17, 21):
    add(whoosh(), tc - 0.35, 0.5, pan=-.3)
for tc in (21.75, 22.5, 23.25):
    add(whoosh(0.35), tc - 0.2, 0.35, pan=.3)
add(whoosh(), 23.68, 0.5); add(whoosh(), 26.68, 0.5)
# riser 6..10
t = tt(3.9); n = rng.standard_normal(len(t)); x = t / 3.9
riser = (n - lp(n, 4)) * x ** 2 * 0.35 + np.sin(2*np.pi*np.cumsum(200 + 1400 * x ** 2)/SR) * x ** 3 * 0.12
add(riser * np.minimum(1, (3.9 - t) / .05), 6.0, 0.6)
# bowstring creak (tension) 7.2..9.8
t = tt(2.6); f = 70 + 30 * (t / 2.6) + 3 * np.sin(2*np.pi*7*t)
creak = saw(1, 0, 1) if False else np.sign(np.sin(2*np.pi*np.cumsum(f)/SR)) * 0.5
add(lp(creak, 30) * (t / 2.6) ** 1.5 * np.minimum(1, (2.6 - t) / .05), 7.2, 0.12)
# release twang + snap at 10.0
t = tt(1.2); f = 110 * (1 + 0.5 * np.exp(-t * 20))
tw = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 5) + 0.5*np.sin(2*np.pi*np.cumsum(2.01*f)/SR) * np.exp(-t * 8)
add(tw, 10.0, 0.45); add(rng.standard_normal(2400) * np.exp(-tt(.05) * 90), 10.0, 0.5)
add(whoosh(0.6, up=False), 10.0, 0.7)
# counter ticks 13.5..14.9 (decelerating)
for i in range(18):
    tc = 13.5 + 1.4 * (1 - (1 - i / 18) ** 2)
    tk = tt(.02); add(np.sin(2*np.pi*2400*tk) * np.exp(-tk * 300), tc, 0.18, pan=.4)
# isolation: warning blip 18.7, lock clunk 19.2
tk = tt(.25); add(np.sin(2*np.pi*(320 - 120*tk/.25)*tk) * np.exp(-tk*10) * (np.sin(2*np.pi*14*tk) > 0), 18.7, 0.18)
tk = tt(.2); add((np.sin(2*np.pi*180*tk) + rng.standard_normal(len(tk))*.3) * np.exp(-tk * 30), 19.2, 0.35)
# arrow hit at 24.55: thunk + wood resonance
t = tt(0.9); f = 40 + 80 * np.exp(-t * 30)
thunk = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 6) + np.sin(2*np.pi*230*t) * np.exp(-t * 14) * .5
thunk += lp(rng.standard_normal(len(t)), 8) * np.exp(-t * 40) * 1.2
add(thunk, 24.55, 0.95)
add(whoosh(0.5), 24.08, 0.6, pan=-.5)
# final impact at 27 + crash
kick_at(27.0, 1.0)
t = tt(3.0); n = rng.standard_normal(len(t)); add((n - lp(n, 3)) * np.exp(-t * 1.6) * .3, 27.0, 0.5)
t = tt(3.0)
for m in (45, 57, 60, 64, 69, 76):
    add(saw(mtof(m), t, 5) * np.exp(-t * 0.6) * np.minimum(1, t / .02), 27.0, 0.05, pan=(m % 3 - 1) * .3)

# sidechain music bus (everything except kick is already mixed; light pump)
L *= 0.6 + 0.4 * duck; R *= 0.6 + 0.4 * duck
# reverb (FFT convolution with decaying noise IR)
ir_t = tt(1.8); ir = np.exp(-ir_t * 3.2)
def conv(x, ir):
    n = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]
irL = rng.standard_normal(len(ir_t)) * ir; irR = rng.standard_normal(len(ir_t)) * ir
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L2 = L + 0.22 * conv(L, irL); R2 = R + 0.22 * conv(R, irR)
fade = np.ones(N); tf = np.arange(N) / SR
fade *= np.clip((DUR - tf) / 1.2, 0, 1) ** 1.5; fade *= np.clip(tf / 0.02, 0, 1)
out = np.stack([L2, R2], 1) * fade[:, None]
out = np.tanh(out / np.abs(out).max() * 1.6) ; out = out / np.abs(out).max() * 0.89
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('ok', out.shape)
