import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Host } from './Presenter';
import { Avatar, C, Card, Chip, Expr, Eyebrow, HEAD, Kinetic, LiveDot, MONO, PixelFace, Quote, SANS, Wordmark, backOut, fmtUsd, hash, inout, io, noise } from './ui';

const S = T.scenes;
const FPS = T.fps;
const wi = (seg: number, i: number) => Number(T.vo[seg].words[i][0]);
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;
const exitStyle = (t: number, end: number, dx = -1): React.CSSProperties => {
  const o = io(t, end - 0.3, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateX(${dx * o * 140}px) scale(${1 + o * 0.04})`, filter: o > 0.02 ? `blur(${o * 14}px)` : undefined };
};
const rise = (t: number, a: number, d = 0.55, dist = 40): React.CSSProperties => {
  const p = io(t, a, a + d);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};
const HITS = [0.72, wi(4, 4), S.end + 0.12];

/* ------------------------------ data ------------------------------ */

/** Price path with a ratcheting floor: every step's traded size lifts the floor, and price never goes below it. */
const market = (seed: number, n: number, start: number, drift: number, vol: number, lift: number) => {
  const price: number[] = []; const floor: number[] = [];
  let p = start, f = start * 0.99;
  for (let i = 0; i < n; i++) {
    const shock = (hash(seed + i * 1.37) - 0.5) * 2 * vol + drift + Math.sin(i * 0.31 + seed) * vol * 0.4;
    const np = Math.max(f * 1.02, p * (1 + shock));
    f += Math.abs(np - p) * lift;
    p = np; price.push(p); floor.push(f);
  }
  return { price, floor };
};

const Candles: React.FC<{ price: number[]; floor: number[]; w: number; h: number; p: number; lo: number; hi: number; per?: number; ghost?: number[]; flash?: number; floorLabel?: boolean }> = ({ price, floor, w, h, p, lo, hi, per = 4, ghost, flash = 0, floorLabel = true }) => {
  const n = Math.floor(price.length / per);
  const shown = Math.max(1, Math.floor(n * p));
  const cw = w / n;
  const y = (v: number) => h - ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * h;
  const fpts: string[] = [];
  for (let i = 0; i < shown; i++) fpts.push(`${i === 0 ? 'M' : 'L'}${(i * cw).toFixed(1)},${y(floor[(i + 1) * per - 1]).toFixed(1)} L${((i + 1) * cw).toFixed(1)},${y(floor[(i + 1) * per - 1]).toFixed(1)}`);
  const fl = floor[shown * per - 1];
  const fy = y(fl);
  const id = 'fl' + React.useId().replace(/:/g, '');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={C.cyan} stopOpacity={0.34 + flash * 0.4} /><stop offset="1" stopColor={C.cyan} stopOpacity={0} /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke="rgba(255,255,255,0.05)" />)}
      {ghost && <path d={ghost.slice(0, Math.floor(ghost.length * p)).map((v, i) => `${i ? 'L' : 'M'}${((i / (ghost.length - 1)) * w).toFixed(1)},${Math.min(h + 40, y(v)).toFixed(1)}`).join(' ')} fill="none" stroke={C.sell} strokeWidth={2.5} strokeDasharray="8 8" opacity={0.55} />}
      <path d={`${fpts.join(' ')} L${shown * cw},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={fpts.join(' ')} fill="none" stroke={C.cyan} strokeWidth={3 + flash * 3} style={{ filter: `drop-shadow(0 0 ${8 + flash * 20}px ${C.cyan})` }} />
      {Array.from({ length: shown }).map((_, i) => {
        const seg = price.slice(i * per, (i + 1) * per);
        const o = i ? price[i * per - 1] : seg[0], c = seg[seg.length - 1];
        const up = c >= o;
        const top = y(Math.max(...seg, o)), bot = y(Math.min(...seg, o));
        return (
          <g key={i}>
            <line x1={i * cw + cw / 2} x2={i * cw + cw / 2} y1={top} y2={bot} stroke={up ? C.buy : C.sell} strokeWidth={1.4} />
            <rect x={i * cw + cw * 0.18} width={cw * 0.64} y={Math.min(y(o), y(c))} height={Math.max(2, Math.abs(y(o) - y(c)))} fill={up ? C.buy : C.sell} rx={1} />
          </g>
        );
      })}
      {floorLabel && (
        <g transform={`translate(${shown * cw + 10} ${fy})`}>
          <rect x={0} y={-15} width={112} height={30} rx={8} fill="#0B1A19" stroke={C.cyan} strokeOpacity={0.6} />
          <text x={56} y={6} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={16} fill={C.cyan}>Floor {fmtUsd(fl)}</text>
        </g>
      )}
    </svg>
  );
};

const TokenHeader: React.FC<{ t: number; mcap: number; floor: number; seed?: number; name?: string; tick?: string }> = ({ mcap, floor, seed = 3, name = 'Night Owl', tick = '$OWL' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <Avatar seed={seed} size={52} />
    <div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: C.white }}>{name} <span style={{ fontWeight: 500, fontSize: 18, color: C.muted }}>{tick}</span></div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: C.dim }}>paired with ETH · liquidity locked</div>
    </div>
    <div style={{ marginLeft: 40, display: 'flex', gap: 34 }}>
      {[['Market cap', fmtUsd(mcap), C.white], ['Floor', fmtUsd(floor), C.cyan]].map(([k, v, c]) => (
        <div key={k}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{k}</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: c }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------ background ------------------------------ */

const Background: React.FC<{ t: number }> = ({ t }) => {
  const rain = Math.max(1 - io(t, 2.6, 3.6), io(t, S.end - 0.4, S.end + 0.6)) * 0.85 + 0.15;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1600, height: 1600, borderRadius: 1600, left: -500 + noise(t * 0.12, 1) * 200, top: -900, background: 'radial-gradient(circle, rgba(92,255,228,0.10), rgba(92,255,228,0) 60%)' }} />
      <div style={{ position: 'absolute', width: 1400, height: 1400, borderRadius: 1400, left: 900 + noise(t * 0.1, 4) * 200, top: 350, background: 'radial-gradient(circle, rgba(22,168,147,0.12), rgba(22,168,147,0) 60%)' }} />
      {/* LED matrix */}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(92,255,228,0.09) 1.3px, transparent 1.5px)', backgroundSize: '28px 28px', backgroundPosition: `${(t * 5) % 28}px ${(t * 2) % 28}px`, maskImage: 'radial-gradient(ellipse at 50% 45%, black 15%, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 15%, transparent 72%)' }} />
      {/* city bokeh */}
      {Array.from({ length: 22 }).map((_, i) => {
        const x = (hash(i * 3.3) * 2100 - 90 + t * (6 + (i % 4) * 3)) % 2100 - 90;
        const r = 30 + hash(i * 5.1) * 70;
        const c = i % 5 === 0 ? '#FFB86B' : i % 3 ? C.cyan : '#7FB5FF';
        return <div key={i} style={{ position: 'absolute', left: x, top: 640 + hash(i * 9.7) * 380, width: r, height: r, borderRadius: r, background: c, opacity: (0.05 + hash(i) * 0.07) * (0.4 + rain * 0.6), filter: `blur(${10 + r * 0.25}px)` }} />;
      })}
      {/* rain */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: rain }}>
        {Array.from({ length: 140 }).map((_, i) => {
          const sp = 900 + hash(i * 2.7) * 700;
          const x = hash(i * 1.3) * 2100 - 90;
          const y = ((hash(i * 4.1) * 1300 + t * sp) % 1300) - 120;
          const L = 18 + hash(i * 6.6) * 40;
          return <line key={i} x1={x} y1={y} x2={x - L * 0.18} y2={y + L} stroke="#A9D9E0" strokeWidth={1 + hash(i) * 0.8} opacity={0.08 + hash(i * 8.8) * 0.16} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Pixel dissolve between scenes, on the LED grid. */
const PixelWipe: React.FC<{ t: number }> = ({ t }) => {
  const at = [S.floor, S.launch, S.trade, S.dump, S.pairs, S.end].find((s) => t > s - 0.32 && t < s + 0.22);
  if (at === undefined) return null;
  const p = (t - (at - 0.32)) / 0.54;
  const cols = 32, rows = 18, cw = 1920 / cols, ch = 1080 / rows;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: cols * rows }).map((_, i) => {
        const cx = i % cols, cy = Math.floor(i / cols);
        const d = (cx / cols) * 0.6 + hash(i * 1.7) * 0.4;
        const a = Math.max(0, 1 - Math.abs(p - d) * 7);
        if (a <= 0.02) return null;
        return <rect key={i} x={cx * cw + 3} y={cy * ch + 3} width={cw - 6} height={ch - 6} rx={4} fill={C.cyan} opacity={a * 0.16} />;
      })}
    </svg>
  );
};

/* ------------------------------ host rig ------------------------------ */

// Keyframes in screen space: LED-face centre (fx, fy) and rig scale.
const K = {
  t: [0, 0.9, 2.0, 3.05, 3.5, 6.8, 7.25, 13.2, 13.65, 16.9, 17.35, 20.05, 20.5, 25.75, 26.35, 30],
  fx: [960, 960, 540, 540, 1530, 1530, 390, 390, 1530, 1530, 390, 390, 1530, 1530, 520, 520],
  fy: [500, 500, 560, 560, 610, 610, 610, 610, 610, 610, 610, 610, 610, 610, 560, 560],
  s: [2.75, 2.6, 1.0, 1.0, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 1.0, 1.03],
  look: [0, 0, 0.6, 0.6, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 0.6, 0.6],
};
const kf = (t: number, a: number[]) => interpolate(t, K.t, a, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const phraseStarts = T.vo.flatMap((v) => v.words.filter((_, i) => i === 0 || /[.,]$/.test(String(v.words[i - 1][2]))).map((x) => Number(x[0])));

const exprAt = (t: number): Expr => {
  if (t < 0.85) return 'wink';
  if (t >= wi(0, 3) - 0.05 && t < wi(0, 5) - 0.1) return 'heart';
  if (t >= wi(1, 10) && t < wi(1, 12) + 0.5) return 'up';
  if (t >= wi(6, 0) - 0.1 && t < wi(6, 1) - 0.15) return 'wink';
  if (t >= 29.3) return 'happy';
  const ph = (t + 0.6) % 3.4;
  if (ph < 0.1 || (Math.floor((t + 0.6) / 3.4) % 3 === 1 && ph > 0.24 && ph < 0.32)) return 'blink';
  return 'normal';
};

const HostRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const fx = kf(t, K.fx), fy = kf(t, K.fy), s = kf(t, K.s);
  const cam = Math.max(0, ...T.vo.map((v) => io(t, v.at - 0.25, v.at) * (1 - io(t, v.at + 0.9, v.at + 1.3))));
  const look = kf(t, K.look) * (1 - cam * 0.8);
  const emphasis = Math.max(0, ...phraseStarts.map((p) => (t >= p - 0.1 && t < p + 0.6 ? Math.sin(((t - p + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.vis.length - 1, frame);
  const W = 800 * s, H = 1000 * s;
  const boot = io(t, 0.12, 0.75, 0, 1, Easing.linear);
  const hit = HITS.reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 5) : 0), 0);
  return (
    <div style={{ position: 'absolute', left: fx - 400 * s, top: fy - 438 * s, width: W, height: H }}>
      <div style={{ position: 'absolute', left: W * 0.08, top: H * 0.04, width: W * 0.84, height: W * 0.84, borderRadius: W, background: 'radial-gradient(circle, rgba(92,255,228,0.16), rgba(92,255,228,0) 65%)', opacity: 0.7 + hit * 0.3 }} />
      <Host t={t} vis={mouth.vis[i]} ghost={i ? mouth.vis[i - 1] : undefined} level={mouth.level[i]} expr={exprAt(t)} emphasis={emphasis * 0.8} look={look} boot={boot} screenGlow={1 + hit * 0.6} />
    </div>
  );
};

/* ------------------------------ 1. hook ------------------------------ */

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const pump = wi(0, 3), dump = wi(0, 5);
  return (
    <AbsoluteFill style={exitStyle(t, S.floor)}>
      <div style={{ position: 'absolute', left: 1010, top: 250, opacity: io(t, 1.05, 1.6) }}>
        <Wordmark height={110} t={t} at={1.05} expr="wink" />
      </div>
      <div style={{ position: 'absolute', left: 1015, top: 470 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 70, color: C.cyan, transform: `translateY(${(1 - io(t, pump, pump + 0.4)) * 30}px)`, opacity: io(t, pump - 0.05, pump + 0.3), textShadow: `0 0 30px ${C.cyan}` }}>▲</span>
          <Kinetic t={t} at={pump - 0.05} size={120} text="Pump more." accent={['Pump']} stagger={0.12} tracking={0.06} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 12 }}>
          <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 70, color: C.muted, transform: `translateY(${(1 - io(t, dump, dump + 0.4)) * -30}px)`, opacity: io(t, dump - 0.05, dump + 0.3) }}>▼</span>
          <Kinetic t={t} at={dump - 0.05} size={120} text="Dump less." color={C.muted} stagger={0.12} tracking={0.06} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 2. floor ------------------------------ */

const FloorScene: React.FC<{ t: number }> = ({ t }) => {
  const every = wi(1, 4), only = wi(1, 10), up = wi(1, 12);
  const m = useMemo(() => market(5, 160, 10000, 0.012, 0.06, 0.16), []);
  const p = io(t, S.floor + 0.2, 6.75, 0.08, 1, Easing.inOut(Easing.quad));
  const k = Math.max(1, Math.floor(m.price.length * p)) - 1;
  const ratchet = io(t, only, up + 0.3);
  return (
    <AbsoluteFill style={exitStyle(t, S.launch)}>
      <div style={{ position: 'absolute', left: 110, top: 80 }}><Eyebrow t={t} at={S.floor + 0.1}>EVERY TOKEN GETS A FLOOR</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 128, width: 1000 }}>
        <Kinetic t={t} at={every - 0.1} size={104} text="A floor that only goes up." accent={['floor', 'up.']} stagger={0.09} />
      </div>
      <Card glow={0.45} style={{ left: 110, top: 400, width: 1010, height: 600, ...rise(t, S.floor + 0.05, 0.6, 60) }}>
        <div style={{ position: 'absolute', left: 28, top: 24 }}><TokenHeader t={t} mcap={m.price[k]} floor={m.floor[k]} /></div>
        <div style={{ position: 'absolute', right: 28, top: 30, display: 'flex', gap: 8 }}>
          {['5m', '15m', '1h'].map((x, i) => <div key={x} style={{ padding: '6px 14px', borderRadius: 999, background: i === 1 ? 'rgba(255,255,255,0.08)' : 'transparent', fontFamily: SANS, fontSize: 15, color: i === 1 ? C.white : C.muted }}>{x}</div>)}
        </div>
        <div style={{ position: 'absolute', left: 28, top: 130 }}>
          <Candles price={m.price} floor={m.floor} w={830} h={420} p={p} lo={6000} hi={Math.max(...m.price) * 1.15} />
        </div>
        {/* ratchet: floor steps up, never down */}
        <div style={{ position: 'absolute', right: 26, top: 150, width: 90, height: 380, display: 'flex', flexDirection: 'column-reverse', gap: 8, opacity: ratchet }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const on = io(t, only + i * 0.09, only + i * 0.09 + 0.15);
            return <div key={i} style={{ height: 52, borderRadius: 8, background: on > 0.5 ? `${C.cyan}2A` : 'rgba(255,255,255,0.03)', border: `1px solid ${on > 0.5 ? C.cyan : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cyan, fontFamily: HEAD, fontWeight: 700, fontSize: 26, opacity: 0.4 + on * 0.6, boxShadow: on > 0.5 ? `0 0 18px ${C.cyan}55` : undefined }}>▲</div>;
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
};

/* ------------------------------ 3. fair launch ------------------------------ */

const Launch: React.FC<{ t: number }> = ({ t }) => {
  const fair = wi(2, 0), anti = wi(2, 2), liq = wi(2, 5), locked = wi(2, 6), forever = wi(2, 7), uni = wi(2, 10);
  const decay = io(t, anti + 0.1, anti + 1.4, 0, 1, Easing.inOut(Easing.quad));
  const tax = 90 * Math.pow(2.5 / 90, decay);
  const slam = io(t, locked - 0.05, locked + 0.18, 0, 1, Easing.in(Easing.cubic));
  const settle = io(t, locked + 0.18, locked + 0.5, 0, 1, backOut);
  const X0 = 800;
  return (
    <AbsoluteFill style={exitStyle(t, S.trade, 1)}>
      <div style={{ position: 'absolute', left: X0, top: 70 }}><Eyebrow t={t} at={S.launch + 0.1}>FAIR LAUNCH · NO PRESALE · NO TEAM BAG</Eyebrow></div>
      {/* launch card */}
      <Card glow={0.45} style={{ left: X0, top: 120, width: 1020, height: 320, ...rise(t, fair - 0.15, 0.55, 50) }}>
        <div style={{ position: 'absolute', left: 30, top: 26, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar seed={3} size={60} />
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.white }}>Night Owl <span style={{ fontSize: 20, color: C.muted, fontWeight: 500 }}>$OWL</span></div>
            <div style={{ fontFamily: SANS, fontSize: 16, color: C.muted }}>Launched just now · everyone buys on the same curve</div>
          </div>
          <div style={{ marginLeft: 26, ...rise(t, fair + 0.3, 0.4, 10) }}><Chip color={C.buy}><LiveDot t={t} /> Fair launch</Chip></div>
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, top: 130, display: 'flex', gap: 18 }}>
          {[['Supply', '1B', 'Fixed. No owner, no mint.'], ['Start', '≈$10K', 'Market cap at launch.'], ['Liquidity', '100%', 'In the pool.'], ['To the floor', '1.5%', 'Of every trade, forever.']].map(([k, v, d], i) => (
            <div key={k} style={{ flex: 1, padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1px solid ${i === 3 ? C.cyan + '55' : C.line}`, ...rise(t, fair + 0.2 + i * 0.1, 0.45, 18) }}>
              <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 17, letterSpacing: '0.24em', color: i === 3 ? C.cyan : C.muted, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 56, color: C.white, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, color: C.dim }}>{d}</div>
            </div>
          ))}
        </div>
      </Card>
      {/* anti-snipe */}
      <Card glow={0.35} color={C.sell} style={{ left: X0, top: 470, width: 490, height: 330, ...rise(t, anti - 0.2, 0.5, 40) }}>
        <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: HEAD, fontWeight: 600, fontSize: 20, letterSpacing: '0.24em', color: C.sell }}>ANTI-SNIPE</div>
        <div style={{ position: 'absolute', left: 26, top: 52, fontFamily: HEAD, fontWeight: 600, fontSize: 64, color: C.white }}>{tax.toFixed(1)}%</div>
        <div style={{ position: 'absolute', left: 190, top: 76, fontFamily: SANS, fontSize: 16, color: C.muted, width: 270 }}>launch tax, falling to 2.5% over the first minute</div>
        <svg width={440} height={130} style={{ position: 'absolute', left: 26, top: 150 }}>
          <path d={Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${(i / 60) * 440},${130 - (90 * Math.pow(2.5 / 90, i / 60)) / 90 * 120}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
          <path d={Array.from({ length: Math.max(2, Math.round(decay * 60) + 1) }, (_, i) => `${i ? 'L' : 'M'}${(i / 60) * 440},${130 - (90 * Math.pow(2.5 / 90, i / 60)) / 90 * 120}`).join(' ')} fill="none" stroke={C.sell} strokeWidth={3} style={{ filter: `drop-shadow(0 0 6px ${C.sell})` }} />
          <circle cx={decay * 440} cy={130 - (tax / 90) * 120} r={7} fill="#fff" />
        </svg>
        <div style={{ position: 'absolute', left: 26, bottom: 18, display: 'flex', gap: 10 }}>
          {['bot_0x9f', 'bot_0x3a', 'bot_0x71'].map((b, i) => (
            <div key={b} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.sell}55`, fontFamily: MONO, fontSize: 13, color: C.sell, opacity: io(t, anti + 0.4 + i * 0.12, anti + 0.6 + i * 0.12), textDecoration: 'line-through' }}>{b}</div>
          ))}
        </div>
      </Card>
      {/* locked liquidity */}
      <Card glow={0.55} style={{ left: X0 + 520, top: 470, width: 500, height: 330, ...rise(t, liq - 0.25, 0.5, 40) }}>
        <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: HEAD, fontWeight: 600, fontSize: 20, letterSpacing: '0.24em', color: C.cyan }}>LIQUIDITY</div>
        {/* pool */}
        <div style={{ position: 'absolute', left: 40, top: 80, width: 200, height: 200, borderRadius: 200, background: `radial-gradient(circle at 40% 35%, ${C.cyan}55, ${C.cyanDeep}22 60%, transparent 72%)`, border: `2px solid ${C.cyan}66` }}>
          <div style={{ position: 'absolute', inset: 30, borderRadius: 200, border: `2px dashed ${C.cyan}55`, transform: `rotate(${t * 40}deg)` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontWeight: 600, fontSize: 40, color: C.white }}>100%</div>
        </div>
        {/* padlock */}
        <svg width={110} height={130} viewBox="0 0 110 130" style={{ position: 'absolute', left: 185, top: 40 - (1 - slam) * 160, opacity: io(t, locked - 0.3, locked - 0.05), transform: `scale(${0.9 + settle * 0.1})` }}>
          <path d="M28 56 V38 a27 27 0 0 1 54 0 V56" fill="none" stroke={C.cyan} strokeWidth={12} strokeLinecap="round" transform={`translate(0 ${(1 - io(t, locked + 0.12, locked + 0.3)) * -14})`} />
          <rect x={10} y={54} width={90} height={70} rx={14} fill="#0C2522" stroke={C.cyan} strokeWidth={4} style={{ filter: `drop-shadow(0 0 14px ${C.cyan})` }} />
          <circle cx={55} cy={84} r={9} fill={C.cyan} /><rect x={51} y={88} width={8} height={18} rx={3} fill={C.cyan} />
        </svg>
        <div style={{ position: 'absolute', left: 270, top: 170, width: 210 }}>
          <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 44, lineHeight: 0.95, color: C.white, letterSpacing: '0.04em', ...rise(t, forever - 0.1, 0.4, 16) }}>LOCKED<br /><span style={{ color: C.cyan, textShadow: `0 0 20px ${C.cyan}88` }}>FOREVER</span></div>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.dim, marginTop: 8, ...rise(t, forever + 0.2, 0.4, 10) }}>No withdraw function.</div>
        </div>
        <div style={{ position: 'absolute', left: 26, bottom: 18, ...rise(t, uni - 0.1, 0.4, 14) }}>
          <Chip color="#FF4FB4" style={{ fontSize: 16 }}>
            <svg width={16} height={16} viewBox="0 0 16 16"><path d="M8 2 V9 a3.5 3.5 0 1 1 -3.5 -3.5" fill="none" stroke="#FF4FB4" strokeWidth={2} strokeLinecap="round" /></svg>
            Uniswap v4 hook
          </Chip>
        </div>
      </Card>
      <div style={{ position: 'absolute', left: X0, top: 840 }}>
        <Kinetic t={t} at={liq - 0.1} size={66} text="Liquidity locked forever." accent={['forever.']} stagger={0.1} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 4. every trade ------------------------------ */

const NAMES = ['FrostyCopperWren', 'SwiftPearlWren', 'PatientBlushPanther', 'MellowCobaltTrout', 'WittyTealLynx', 'CosmicIvoryRaven', 'PatientIndigoHare', 'BrightSageOtter'];
const Trade: React.FC<{ t: number }> = ({ t }) => {
  const every = wi(3, 0), price = wi(3, 5);
  const t0 = S.trade + 0.55, dt = 0.42;
  const trades = NAMES.map((n, i) => ({ n, at: t0 + i * dt, buy: i % 4 !== 2, amt: 40 + hash(i * 3.3) * 220, seed: i + 7 }));
  const done = trades.filter((x) => t >= x.at);
  const floorV = 48210 + done.reduce((a, x) => a + x.amt * 0.015 * 40, 0);
  return (
    <AbsoluteFill style={exitStyle(t, S.dump)}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}><Eyebrow t={t} at={S.trade + 0.1}>EVERY TRADE LAYS A BRICK</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 118, width: 1050 }}>
        <Kinetic t={t} at={every - 0.1} size={96} text="Every trade lifts the floor." accent={['floor.']} stagger={0.08} />
      </div>
      {/* live trades */}
      <Card glow={0.3} style={{ left: 110, top: 330, width: 480, height: 600, ...rise(t, S.trade, 0.5, 50) }}>
        <div style={{ position: 'absolute', left: 24, top: 20, display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, fontWeight: 600, fontSize: 18, color: C.white }}><LiveDot t={t} /> Swaps</div>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 64 }}>
          {[...done].reverse().slice(0, 7).map((x, j) => {
            const p = io(t, x.at, x.at + 0.3);
            return (
              <div key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 70, padding: '0 10px', borderRadius: 12, background: j === 0 ? 'rgba(92,255,228,0.06)' : 'transparent', transform: `translateY(${(1 - p) * -30}px)`, opacity: j === 0 ? p : 1 }}>
                <Avatar seed={x.seed} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 16, color: C.white }}>{x.n}</div>
                  <div style={{ fontFamily: SANS, fontSize: 14, color: x.buy ? C.buy : C.sell }}>{x.buy ? 'bought' : 'sold'} ${x.amt.toFixed(2)}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: C.cyan }}>+${(x.amt * 0.015).toFixed(2)} floor</div>
              </div>
            );
          })}
        </div>
      </Card>
      {/* brick wall */}
      <Card glow={0.5} style={{ left: 620, top: 330, width: 530, height: 600, ...rise(t, S.trade + 0.1, 0.5, 50) }}>
        <div style={{ position: 'absolute', left: 26, top: 20, fontFamily: SANS, fontSize: 15, color: C.muted }}>Floor</div>
        <div style={{ position: 'absolute', left: 26, top: 40, fontFamily: HEAD, fontWeight: 600, fontSize: 64, color: C.cyan, textShadow: `0 0 26px ${C.cyan}66` }}>{fmtUsd(floorV)} <span style={{ fontSize: 30 }}>▲</span></div>
        <div style={{ position: 'absolute', left: 26, right: 26, bottom: 120, height: 300 }}>
          {Array.from({ length: 24 + done.length * 3 }).map((_, b) => {
            const base = b < 24;
            const r = Math.floor(b / 6), c = b % 6;
            const trade = base ? null : trades[Math.floor((b - 24) / 3)];
            const fall = trade ? io(t, trade.at, trade.at + 0.28, 0, 1, Easing.in(Easing.quad)) : 1;
            return <div key={b} style={{ position: 'absolute', left: c * 80 + (r % 2) * 40 - 20, bottom: r * 42 + (1 - fall) * 260, width: 74, height: 36, borderRadius: 6, background: base ? `${C.cyanDeep}55` : C.cyan, border: `1px solid ${C.cyan}88`, opacity: base ? 0.8 : fall, boxShadow: base ? undefined : `0 0 16px ${C.cyan}88`, clipPath: 'inset(0 0 0 0)' }} />;
          })}
        </div>
        {/* tax split */}
        <div style={{ position: 'absolute', left: 26, right: 26, bottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 14, color: C.muted, marginBottom: 8 }}><span>2.5% tax per trade</span><span style={{ color: C.cyan }}>1.5% floor · 0.6% creator · 0.4% protocol</span></div>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
            <div style={{ flex: 15, background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` }} /><div style={{ flex: 6, background: '#FFD15C' }} /><div style={{ flex: 4, background: 'rgba(255,255,255,0.3)' }} />
          </div>
        </div>
      </Card>
      <div style={{ position: 'absolute', left: 110, top: 960, ...rise(t, price, 0.4, 16) }}>
        <Chip style={{ fontSize: 22, padding: '10px 18px' }}>Price never goes below the floor</Chip>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5. dump ------------------------------ */

const Dump: React.FC<{ t: number }> = ({ t }) => {
  const hit = wi(4, 4), keeps = wi(4, 8);
  const N = 120;
  const data = useMemo(() => {
    const price: number[] = [], floor: number[] = [], ghost: number[] = [];
    let f = 2.18e6;
    for (let i = 0; i < N; i++) {
      let p: number;
      if (i < 30) p = 9.6e6 * (1 + Math.sin(i * 0.9) * 0.03 + (hash(i) - 0.5) * 0.05);
      else if (i < 56) p = Math.max(f, 9.6e6 * Math.pow(0.93, i - 30) * (1 + (hash(i * 2) - 0.5) * 0.06));
      else { f *= 1.012; p = f * (1.02 + Math.abs(Math.sin(i * 0.7)) * 0.06); }
      price.push(p); floor.push(f);
      ghost.push(i < 30 ? p : 9.6e6 * Math.pow(0.86, i - 30));
    }
    return { price, floor, ghost };
  }, []);
  // reveal so the crash lands on the floor exactly on the spoken word "floor"
  const p = interpolate(t, [S.dump, hit, 20.1], [0.24, 0.47, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flash = t > hit ? Math.exp(-(t - hit) * 4) : 0;
  const wave = io(t, hit, hit + 0.8, 0, 1, Easing.out(Easing.cubic));
  const X0 = 790;
  return (
    <AbsoluteFill style={exitStyle(t, S.pairs, 1)}>
      <div style={{ position: 'absolute', left: X0, top: 70 }}><Eyebrow t={t} at={S.dump + 0.1}>A DUMP STOPS AT THE FLOOR</Eyebrow></div>
      <Card glow={0.45 + flash * 0.6} style={{ left: X0, top: 120, width: 1030, height: 640, ...rise(t, S.dump, 0.45, 40) }}>
        <div style={{ position: 'absolute', left: 28, top: 24 }}><TokenHeader t={t} mcap={data.price[Math.floor(N * p) - 1]} floor={data.floor[Math.floor(N * p) - 1]} seed={9} name="Every holder sells" tick="replay" /></div>
        <div style={{ position: 'absolute', left: 28, top: 140 }}>
          <Candles price={data.price} floor={data.floor} ghost={data.ghost} w={840} h={450} p={p} lo={1.2e5} hi={1.3e7} per={2} flash={flash} />
        </div>
        {/* impact ring on the floor */}
        {t > hit && <div style={{ position: 'absolute', left: 28 + 840 * 0.47 - 200 * wave, top: 140 + 450 * 0.32 - 40 * wave, width: 400 * wave, height: 80 * wave, borderRadius: '50%', border: `3px solid ${C.cyan}`, opacity: 1 - wave }} />}
        <div style={{ position: 'absolute', left: 520, top: 175, opacity: io(t, hit + 0.05, hit + 0.3) * (1 - io(t, keeps, keeps + 0.4)), transform: `scale(${io(t, hit, hit + 0.3, 0.6, 1, backOut)})` }}>
          <Chip style={{ fontSize: 22, padding: '10px 16px' }}>Floor held</Chip>
        </div>
        <div style={{ position: 'absolute', left: 520, top: 175, opacity: io(t, keeps, keeps + 0.4) }}>
          <Chip style={{ fontSize: 22, padding: '10px 16px' }}>▲ Floor keeps climbing</Chip>
        </div>
        <div style={{ position: 'absolute', left: 640, top: 600, fontFamily: SANS, fontSize: 15, color: C.sell, opacity: 0.8 * io(t, hit - 0.3, hit) }}>- - Without a floor</div>
      </Card>
      <div style={{ position: 'absolute', left: X0, top: 790, display: 'flex', gap: 20 }}>
        {[[hit + 0.25, '$10M → $2.18M', 'Every holder sold. Price stopped at the floor.'], [keeps - 0.1, '188×', 'Floor growth across 382,393 replayed trades.']].map(([at, v, d], i) => (
          <Card key={i} glow={0.25} style={{ position: 'relative', width: 505, height: 150, ...rise(t, at as number, 0.45, 20) }}>
            <div style={{ position: 'absolute', left: 24, top: 18, fontFamily: HEAD, fontWeight: 600, fontSize: 54, color: i ? C.cyan : C.white }}>{v}</div>
            <div style={{ position: 'absolute', left: 24, top: 92, fontFamily: SANS, fontSize: 16, color: C.muted, width: 460 }}>{d}</div>
          </Card>
        ))}
      </div>
      <div style={{ position: 'absolute', left: X0, top: 960, fontFamily: MONO, fontSize: 13, color: C.dim, opacity: io(t, keeps, keeps + 0.4) }}>Figures from the replay on fobo.fun/how-it-works</div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 6. pairs ------------------------------ */

const Pairs: React.FC<{ t: number }> = ({ t }) => {
  const pair = wi(5, 0), eth = wi(5, 2), stocks = wi(5, 4), safer = wi(5, 6), rh = wi(5, 10);
  const crypto = ['ETH', 'FOBO', 'USDG'];
  const eq = ['TSLA', 'MSFT', 'NVDA', 'AAPL', 'GOOGL', 'AMZN', 'META'];
  const shrink = io(t, safer - 0.3, safer + 0.3, 0, 1, inout);
  const feats = ['Fair launches', 'Anti-snipe', 'Locked liquidity', 'Creator earnings', 'AI-agent ready'];
  return (
    <AbsoluteFill style={{ opacity: 1 - io(t, S.end - 0.2, S.end + 0.1) }}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}><Eyebrow t={t} at={S.pairs + 0.1}>PAIR WITH ANYTHING</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 118, width: 1060 }}>
        <Kinetic t={t} at={pair - 0.05} size={88} text="Pair with ETH or tokenized stocks." accent={['ETH', 'stocks.']} stagger={0.08} />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 360 - shrink * 30, width: 1050, display: 'flex', flexWrap: 'wrap', gap: 18, transform: `scale(${1 - shrink * 0.2})`, transformOrigin: '0 0', opacity: 1 - shrink * 0.35 }}>
        {[...crypto, ...eq].map((s, i) => {
          const at = i < 3 ? eth + i * 0.1 : stocks + (i - 3) * 0.08;
          const p = io(t, at - 0.1, at + 0.35, 0, 1, backOut);
          return (
            <div key={s} style={{ width: 190, height: 84, borderRadius: 16, background: 'linear-gradient(180deg, #161C20, #0D1215)', border: `1px solid ${p > 0.5 ? C.cyan + '55' : C.line}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', transform: `scale(${0.7 + p * 0.3})`, opacity: Math.min(1, p * 1.3), boxShadow: `0 0 ${24 * p}px ${C.cyan}22` }}>
              <Quote sym={s} size={42} />
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, color: C.white }}>{i < 3 && s !== 'FOBO' ? s : `$${s}`}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 610, display: 'flex', flexWrap: 'wrap', gap: 14, width: 1050 }}>
        {feats.map((f, i) => (
          <div key={f} style={rise(t, safer + i * 0.12, 0.4, 20)}><Chip style={{ fontSize: 22, padding: '12px 20px' }}>✓ {f}</Chip></div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 760, ...rise(t, rh - 0.15, 0.5, 30) }}>
        <Card glow={0.6} color={C.buy} style={{ position: 'relative', width: 780, height: 170 }}>
          <div style={{ position: 'absolute', left: 30, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 26 }}>
            <svg width={60} height={100} viewBox="0 0 60 100"><path d="M10 95 C20 70 34 40 54 6 C58 22 56 40 48 58 C40 74 28 86 14 96 Z" fill="#8E1A2E" /><path d="M10 96 C22 68 36 40 54 6" stroke="#EAD3CB" strokeWidth={2.5} fill="none" /></svg>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: HEAD, fontWeight: 600, fontSize: 22, letterSpacing: '0.24em', color: C.buy }}><LiveDot t={t} /> LIVE ON</div>
              <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 70, lineHeight: 1, letterSpacing: '0.04em', color: C.white }}>ROBINHOOD CHAIN</div>
            </div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 7. end ------------------------------ */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end, name = wi(6, 0), tag = wi(6, 1);
  const flash = io(t, s0 + 0.08, s0 + 0.14, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.14, s0 + 0.9, 0, 1, Easing.out(Easing.quad)));
  const url = io(t, tag + 1.4, tag + 1.9);
  const fade = io(t, 29.55, 30, 0, 1, Easing.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - fade }}>
      <div style={{ position: 'absolute', left: 1010, top: 250 }}><Wordmark height={130} t={t} at={name - 0.1} expr="wink" glow={1.2} /></div>
      <div style={{ position: 'absolute', left: 1015, top: 470, width: 860 }}>
        <Kinetic t={t} at={tag - 0.05} size={78} text="The launchpad with a rising price floor" accent={['rising', 'floor']} stagger={0.1} />
        <div style={{ height: 2, width: 820 * io(t, tag + 1.0, tag + 1.8), marginTop: 30, background: `linear-gradient(90deg, ${C.cyan}, transparent)`, boxShadow: `0 0 16px ${C.cyan}` }} />
        <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 20, opacity: url, transform: `translateY(${(1 - url) * 14}px)` }}>
          <span style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 46, letterSpacing: '0.08em', color: C.white }}>FOBO.FUN</span>
          <Chip>Pump more. Dump less.</Chip>
          <Chip color={C.buy}><LiveDot t={t} /> Robinhood Chain</Chip>
        </div>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 45%, rgba(220,255,250,${flash * 0.9}), rgba(92,255,228,${flash * 0.45}) 45%, rgba(6,9,11,${flash * 0.1}) 90%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ film ------------------------------ */

export const FoboFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const punch = HITS.reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 6) * 0.022 : 0), 0);
  const shake = t > HITS[1] && t < HITS[1] + 0.4 ? Math.exp(-(t - HITS[1]) * 9) : 0;
  const camX = noise(t * 0.25, 2) * 6 + noise(t * 40, 1) * 14 * shake, camY = noise(t * 0.21, 5) * 4 + noise(t * 37, 7) * 10 * shake;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <Audio src={staticFile('fobo/mix.wav')} />
      <AbsoluteFill style={{ transform: `scale(${1.02 + punch + Math.sin(t * 0.3) * 0.005}) translate(${camX}px, ${camY}px)` }}>
        <Background t={t} />
        {between(t, 0, S.floor) && <Hook t={t} />}
        {between(t, S.floor - 0.3, S.launch) && <FloorScene t={t} />}
        {between(t, S.launch - 0.3, S.trade) && <Launch t={t} />}
        {between(t, S.trade - 0.3, S.dump) && <Trade t={t} />}
        {between(t, S.dump - 0.3, S.pairs) && <Dump t={t} />}
        {between(t, S.pairs - 0.3, S.end + 0.2) && <Pairs t={t} />}
        <HostRig t={t} frame={frame} />
        {t >= S.end - 0.05 && <End t={t} />}
        <PixelWipe t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.045, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - io(t, 0, 0.25, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};

export const _unused = PixelFace;
