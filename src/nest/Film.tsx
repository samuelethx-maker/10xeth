import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Host } from './Presenter';
import { C, Chip, Eyebrow, Glass, Kinetic, LiveDot, MONO, NestBadge, NestLogo, SANS, Token, backOut, fmt, inout, io, noise } from './ui';

const S = T.scenes;
const FPS = T.fps;
/** Absolute start time of word `i` in VO segment `seg`. */
const wi = (seg: number, i: number) => Number(T.vo[seg].words[i][0]);
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;
const exitStyle = (t: number, end: number, dx = -1): React.CSSProperties => {
  const o = io(t, end - 0.3, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateX(${dx * o * 120}px) scale(${1 + o * 0.03})`, filter: o > 0.02 ? `blur(${o * 12}px)` : undefined };
};
const rise = (t: number, a: number, d = 0.5, dist = 40): React.CSSProperties => {
  const p = io(t, a, a + d);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

/* ------------------------------ Background ------------------------------ */

const Background: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: 1600, height: 1600, borderRadius: 1600, left: -400 + noise(t * 0.15, 1) * 200, top: -900, background: 'radial-gradient(circle, rgba(46,230,197,0.12), rgba(46,230,197,0) 60%)' }} />
    <div style={{ position: 'absolute', width: 1300, height: 1300, borderRadius: 1300, left: 1000 + noise(t * 0.13, 4) * 220, top: 300, background: 'radial-gradient(circle, rgba(36,165,124,0.14), rgba(36,165,124,0) 60%)' }} />
    {/* dot matrix */}
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(185,245,222,0.11) 1.4px, transparent 1.6px)', backgroundSize: '36px 36px', backgroundPosition: `${(t * 6) % 36}px ${(t * 3) % 36}px`, maskImage: 'radial-gradient(ellipse at 50% 45%, black 20%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 20%, transparent 75%)' }} />
    {/* flowing liquidity curves */}
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const y = 720 + i * 34; const ph = t * (0.5 + i * 0.07) + i;
        let d = `M-20 ${y}`;
        for (let x = 0; x <= 1960; x += 80) d += ` L${x} ${y + Math.sin(x / 260 + ph) * (26 + i * 5) + Math.sin(x / 90 - ph * 1.3) * 4}`;
        return <path key={i} d={d} fill="none" stroke={i % 3 === 0 ? C.lime : C.teal} strokeOpacity={0.07 + 0.03 * (i % 3)} strokeWidth={1.6} />;
      })}
    </svg>
  </AbsoluteFill>
);

/* ------------------------------ Host rig ------------------------------ */

const K = {
  t: [0, 4.8, 5.3, 8.6, 9.1, 12.6, 13.1, 17.4, 17.9, 20.95, 21.45, 26.55, 27.1],
  x: [500, 500, 1570, 1570, 350, 350, 1570, 1570, 350, 350, 1570, 1570, 500],
  s: [0.98, 0.98, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.98],
  look: [0.6, 0.6, -0.9, -0.9, 0.9, 0.9, -0.9, -0.9, 0.9, 0.9, -0.9, -0.9, 0.6],
};
const kf = (t: number, a: number[]) => interpolate(t, K.t, a, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const phraseStarts = T.vo.flatMap((v) => v.words.filter((_, i) => i === 0 || /[.,]$/.test(String(v.words[i - 1][2]))).map((x) => Number(x[0])));

const HostRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const x = kf(t, K.x), s = kf(t, K.s);
  const intro = io(t, 0.25, 1.1);
  const cam = Math.max(0, ...T.vo.map((v) => io(t, v.at - 0.25, v.at) * (1 - io(t, v.at + 0.9, v.at + 1.3))));
  const look = kf(t, K.look) * (1 - cam);
  const emphasis = Math.max(0, ...phraseStarts.map((p) => (t >= p - 0.1 && t < p + 0.6 ? Math.sin(((t - p + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.open.length - 1, frame);
  const smile = 0.4 + io(t, 29.1, 29.5) * 0.5;
  const W = 800 * s, H = 1000 * s;
  return (
    <div style={{ position: 'absolute', left: x - W / 2, top: 1080 - H + 30 + (1 - intro) * 160, width: W, height: H, opacity: intro, filter: intro < 1 ? `blur(${(1 - intro) * 14}px)` : undefined }}>
      <div style={{ position: 'absolute', left: W * 0.1, top: H * 0.06, width: W * 0.8, height: W * 0.8, borderRadius: W, background: 'radial-gradient(circle, rgba(46,230,197,0.2), rgba(46,230,197,0) 65%)' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Host t={t} open={mouth.open[i]} wide={mouth.wide[i]} round={mouth.round[i]} smile={smile} emphasis={emphasis * 0.8} look={[look, 0.05]} />
      </div>
    </div>
  );
};

/* ------------------------------ shared ------------------------------ */

const Spark: React.FC<{ data: number[]; w: number; h: number; p: number; color?: string }> = ({ data, w, h, p, color = C.teal }) => {
  const id = 'sp' + React.useId().replace(/:/g, '');
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, 6 + (1 - (v - min) / (max - min || 1)) * (h - 12)]);
  const n = Math.max(1, p * (pts.length - 1)); const k = Math.floor(n), f = n - k;
  const vis = pts.slice(0, k + 1);
  if (k < pts.length - 1) vis.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  const d = vis.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const last = vis[vis.length - 1];
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.3} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <path d={`${d} L${last[0]},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx={last[0]} cy={last[1]} r={10} fill={color} opacity={0.2} /><circle cx={last[0]} cy={last[1]} r={4.5} fill="#fff" />
    </svg>
  );
};
const series = (seed: number, n: number, drift: number, vol: number) => {
  let v = 1; const out: number[] = [];
  for (let i = 0; i < n; i++) { v *= 1 + drift + Math.sin(i * 1.7 + seed) * vol + Math.sin(i * 0.37 + seed * 3) * vol * 0.6; out.push(v); }
  return out;
};

/* ------------------------------ 1. Hook ------------------------------ */

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const ign = io(t, 0.2, 1.0);
  const shift = io(t, 1.0, 1.7, 0, 1, inout);
  const h = 210 - shift * 70;
  const cx = 960 + shift * 420, cy = 470 - shift * 150;
  const ring = io(t, 0.15, 1.1, 0, 1, Easing.out(Easing.cubic));
  const tag = wi(0, 4), built = wi(0, 8);
  const w = (h * 81.2208) / 28;
  return (
    <AbsoluteFill style={exitStyle(t, S.spot)}>
      {/* ignition rings */}
      {[0, 1, 2].map((i) => {
        const p = io(t, 0.25 + i * 0.12, 1.5 + i * 0.12, 0, 1, Easing.out(Easing.cubic));
        return <div key={i} style={{ position: 'absolute', left: cx - 40 - p * 520, top: cy - 40 - p * 520, width: 80 + p * 1040, height: 80 + p * 1040, borderRadius: 2000, border: `${2 - i * 0.5}px solid ${i === 1 ? C.lime : C.teal}`, opacity: (1 - p) * 0.6 }} />;
      })}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 1 - shift }}>
        <circle cx={cx - w / 2 + h / 2} cy={cy} r={h * 0.72} fill="none" stroke={C.teal} strokeWidth={2} strokeDasharray={`${ring * 2 * Math.PI * h * 0.72} 9999`} transform={`rotate(-90 ${cx - w / 2 + h / 2} ${cy})`} style={{ filter: `drop-shadow(0 0 8px ${C.teal})` }} />
      </svg>
      <div style={{ position: 'absolute', left: cx - w / 2, top: cy - h / 2, opacity: ign, transform: `scale(${0.85 + ign * 0.15})`, filter: `blur(${(1 - ign) * 10}px)` }}>
        <NestLogo height={h} draw={io(t, 0.4, 1.4, 0, 1, Easing.linear)} glow={1.2 - shift * 0.5} />
      </div>
      <div style={{ position: 'absolute', left: 1010, top: 470, width: 780, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: shift }}>
        <Kinetic t={t} at={tag - 0.05} size={74} text="The HYPE-aligned MetaDEX" accent={['HYPE-aligned']} stagger={0.12} style={{ justifyContent: 'center' }} />
        <div style={{ marginTop: 34, display: 'flex', gap: 14, ...rise(t, built - 0.1, 0.5, 16) }}>
          <Chip color={C.lime}><LiveDot t={t} /> Built on HyperEVM</Chip>
          <Chip>Hyperliquid ecosystem</Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 2. Spot layer ------------------------------ */

const Spot: React.FC<{ t: number }> = ({ t }) => {
  const words = [wi(1, 1), wi(1, 3), wi(1, 5)];
  const hl = wi(1, 8);
  const layers = [
    { label: 'Spot liquidity', sub: 'Deep pools for every HyperEVM asset', c: C.cyan, at: words[0] },
    { label: 'Growth', sub: 'Launch, bootstrap, scale into HyperCore', c: C.teal, at: words[1] },
    { label: 'Yield', sub: 'Emissions, fees and HYPE for long-term holders', c: C.lime, at: words[2] },
  ];
  const pairs = [
    { a: 'HYPE', b: 'USDC', px: '38.42', ch: 2.41 },
    { a: 'UBTC', b: 'HYPE', px: '2,734.1', ch: 0.86 },
    { a: 'UETH', b: 'USDC', px: '3,912.6', ch: 1.37 },
    { a: 'NEST', b: 'HYPE', px: '0.0141', ch: 4.92 },
  ];
  return (
    <AbsoluteFill style={exitStyle(t, S.swap)}>
      <div style={{ position: 'absolute', left: 110, top: 74 }}>
        <Eyebrow t={t} at={S.spot + 0.05}>THE NATIVE METADEX OF HYPERLIQUID</Eyebrow>
      </div>
      {/* isometric layer stack */}
      <div style={{ position: 'absolute', left: 120, top: 180, width: 700, height: 700, perspective: 1800 }}>
        {layers.map((l, i) => {
          const p = io(t, l.at - 0.2, l.at + 0.35, 0, 1, backOut);
          const y = 360 - i * 150 - (1 - p) * 80;
          return (
            <div key={l.label} style={{ position: 'absolute', left: 40, top: y, width: 560, height: 300, opacity: Math.min(1, p * 1.5), transform: 'rotateX(58deg) rotateZ(-38deg)', transformStyle: 'preserve-3d' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 26, border: `2px solid ${l.c}`, background: `linear-gradient(135deg, ${l.c}33, ${l.c}0A)`, boxShadow: `0 0 50px ${l.c}55, inset 0 0 40px ${l.c}22` }} />
              <div style={{ position: 'absolute', inset: 30, borderRadius: 16, backgroundImage: `linear-gradient(${l.c}22 1px, transparent 1px), linear-gradient(90deg, ${l.c}22 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
            </div>
          );
        })}
        {layers.map((l, i) => (
          <div key={l.label + 'lbl'} style={{ position: 'absolute', left: 640, top: 470 - i * 150, width: 420, ...rise(t, l.at, 0.45, 20) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 2, background: l.c, boxShadow: `0 0 8px ${l.c}` }} />
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.white, letterSpacing: '-0.02em' }}>{l.label}</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 19, color: C.muted, marginLeft: 52, marginTop: 4 }}>{l.sub}</div>
          </div>
        ))}
      </div>
      {/* live spot markets */}
      <Glass style={{ left: 110, top: 850, width: 1080, height: 150, ...rise(t, hl - 0.15, 0.5, 30) }}>
        <div style={{ position: 'absolute', left: 24, top: 16, fontFamily: MONO, fontSize: 14, color: C.muted, letterSpacing: '0.12em', display: 'flex', gap: 10, alignItems: 'center' }}><LiveDot t={t} size={7} /> SPOT MARKETS · HYPEREVM</div>
        <div style={{ position: 'absolute', left: 24, right: 24, top: 52, display: 'flex', gap: 16 }}>
          {pairs.map((q, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', ...rise(t, hl + i * 0.08, 0.4, 14) }}>
              <div style={{ display: 'flex' }}><Token sym={q.a} size={32} /><Token sym={q.b} size={32} style={{ marginLeft: -10 }} /></div>
              <div>
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 17, color: C.white }}>{q.a}/{q.b}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: C.muted }}>{q.px} <span style={{ color: C.lime }}>+{q.ch}%</span></div>
              </div>
            </div>
          ))}
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

/* ------------------------------ 3. Swap → LP ------------------------------ */

const Swap: React.FC<{ t: number }> = ({ t }) => {
  const swap = wi(2, 0), prov = wi(2, 3), earn = wi(2, 6), emis = wi(2, 8);
  const press = Math.sin(io(t, swap + 0.75, swap + 0.95, 0, 1, Easing.linear) * Math.PI);
  const done = t > swap + 0.9;
  const flip = io(t, swap + 0.3, swap + 0.7, 0, 1, inout);
  const lp = io(t, prov - 0.15, prov + 0.45);
  const tvl = 4.2 + io(t, prov + 0.3, prov + 1.2, 0, 1, Easing.out(Easing.cubic)) * 0.35;
  const emitted = io(t, earn, S.lock, 0, 1, Easing.linear) * 1842.6;
  const curve = useMemo(() => series(2, 40, 0.004, 0.012), []);
  return (
    <AbsoluteFill style={exitStyle(t, S.lock, 1)}>
      <div style={{ position: 'absolute', left: 760, top: 74 }}><Eyebrow t={t} at={S.swap + 0.05}>SWAP · PROVIDE · EARN</Eyebrow></div>
      {/* swap widget */}
      <Glass glow={0.5} style={{ left: 760, top: 140, width: 500, height: 520, transform: `perspective(1600px) rotateY(${(1 - io(t, S.swap - 0.05, S.swap + 0.5)) * -18 + 4}deg)`, opacity: io(t, S.swap - 0.05, S.swap + 0.4) }}>
        <div style={{ position: 'absolute', left: 28, top: 22, fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.white }}>Swap</div>
        <div style={{ position: 'absolute', right: 28, top: 26 }}><Chip style={{ fontSize: 13, padding: '4px 10px' }}>Best route</Chip></div>
        {[0, 1].map((k) => {
          const sym = k === 0 ? 'USDC' : 'HYPE'; const amt = k === 0 ? '2,500.00' : fmt(65.07 * io(t, swap + 0.1, swap + 0.6), 2);
          return (
            <div key={k} style={{ position: 'absolute', left: 24, right: 24, top: 80 + k * 150, height: 128, borderRadius: 18, background: 'rgba(255,255,255,0.035)', border: `1px solid ${C.line}` }}>
              <div style={{ position: 'absolute', left: 20, top: 16, fontFamily: MONO, fontSize: 14, color: C.muted }}>{k === 0 ? 'YOU PAY' : 'YOU RECEIVE'}</div>
              <div style={{ position: 'absolute', left: 20, top: 48, fontFamily: SANS, fontWeight: 500, fontSize: 46, color: C.white, letterSpacing: '-0.03em' }}>{amt}</div>
              <div style={{ position: 'absolute', right: 18, top: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', fontFamily: SANS, fontWeight: 600, fontSize: 20, color: C.white }}><Token sym={sym} size={30} />{sym}</div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 226, top: 196, width: 48, height: 48, borderRadius: 14, background: '#0B110F', border: `1px solid ${C.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.teal, fontSize: 24, transform: `rotate(${flip * 180}deg)` }}>↓</div>
        <div style={{ position: 'absolute', left: 24, right: 24, top: 384, display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 14, color: C.muted }}><span>1 HYPE = 38.42 USDC</span><span>Fee 0.05%</span></div>
        <div style={{ position: 'absolute', left: 24, right: 24, top: 424, height: 70, borderRadius: 16, background: done ? `linear-gradient(90deg, ${C.nest}, ${C.teal})` : `linear-gradient(90deg, ${C.teal}, ${C.lime})`, color: '#03140F', fontFamily: SANS, fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - press * 0.05})`, boxShadow: `0 0 ${20 + press * 40}px ${C.teal}88` }}>{done ? '✓ Swapped' : 'Swap'}</div>
      </Glass>
      {/* LP position */}
      <Glass glow={0.6} color={C.lime} style={{ left: 1290, top: 140, width: 530, height: 520, opacity: lp, transform: `translateX(${(1 - lp) * 80}px)` }}>
        <div style={{ position: 'absolute', left: 26, top: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex' }}><Token sym="HYPE" size={40} /><Token sym="USDC" size={40} style={{ marginLeft: -12 }} /></div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: C.white }}>HYPE / USDC</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>Concentrated · 0.05%</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 26, top: 104, fontFamily: MONO, fontSize: 13, color: C.muted, letterSpacing: '0.12em' }}>POOL TVL</div>
        <div style={{ position: 'absolute', left: 26, top: 124, fontFamily: SANS, fontWeight: 600, fontSize: 44, color: C.white, letterSpacing: '-0.03em' }}>${tvl.toFixed(2)}M</div>
        <div style={{ position: 'absolute', left: 26, top: 190 }}><Spark data={curve} w={478} h={110} p={io(t, prov, prov + 1.4, 0.2, 1, Easing.inOut(Easing.quad))} color={C.lime} /></div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 330, padding: 18, borderRadius: 16, border: `1px solid ${C.lime}44`, background: `${C.lime}0D`, ...rise(t, earn - 0.1, 0.4, 16) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: C.muted, letterSpacing: '0.12em' }}>NEST EMISSIONS EARNED</span>
            <Chip color={C.lime} style={{ fontSize: 13, padding: '3px 10px' }}>APR 48.2%</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <NestBadge size={46} glow={0.6} />
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 48, color: C.white, letterSpacing: '-0.03em' }}>{fmt(emitted, 1)}</span>
            <span style={{ fontFamily: MONO, fontSize: 18, color: C.lime }}>NEST</span>
          </div>
        </div>
      </Glass>
      {/* emission stream into the LP card */}
      {Array.from({ length: 12 }).map((_, i) => {
        const s0 = emis - 0.4 + i * 0.12; const p = io(t, s0, s0 + 0.7, 0, 1, Easing.inOut(Easing.quad));
        if (p <= 0 || p >= 1) return null;
        const x = 1555 + Math.sin(i * 2.3) * 160 * (1 - p), y = 60 + (560 - 60) * p;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, opacity: Math.sin(p * Math.PI) }}><NestBadge size={22} glow={0.8} /></div>;
      })}
      <div style={{ position: 'absolute', left: 760, top: 720, width: 1060 }}>
        <Kinetic t={t} at={earn - 0.05} size={64} text="LPs earn NEST emissions." accent={['NEST']} stagger={0.09} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 4. veNEST ------------------------------ */

const Lock: React.FC<{ t: number }> = ({ t }) => {
  const lock = wi(3, 0), ve = wi(3, 3), vote = wi(3, 4), cap = wi(3, 6), fees = wi(3, 11);
  const slide = io(t, lock + 0.1, ve + 0.4, 0, 1, Easing.inOut(Easing.cubic));
  const gauges = [
    { pair: ['HYPE', 'USDC'], v: 0.34 }, { pair: ['UBTC', 'HYPE'], v: 0.22 }, { pair: ['NEST', 'HYPE'], v: 0.19 }, { pair: ['UETH', 'USDC'], v: 0.13 },
  ];
  const vp = io(t, vote - 0.1, vote + 0.9, 0, 1, Easing.out(Easing.cubic));
  const pct = Math.round(io(t, cap + 0.1, cap + 0.9, 0, 100, Easing.out(Easing.cubic)));
  const epoch = 3 * 86400 + 14 * 3600 + 22 * 60 - (t - S.lock) * 1;
  const dd = Math.floor(epoch / 86400), hh = Math.floor((epoch % 86400) / 3600), mm = Math.floor((epoch % 3600) / 60), ss = Math.floor(epoch % 60);
  return (
    <AbsoluteFill style={exitStyle(t, S.engine)}>
      <div style={{ position: 'absolute', left: 110, top: 74 }}><Eyebrow t={t} at={S.lock + 0.05}>LOCK · VOTE · EARN</Eyebrow></div>
      {/* lock card */}
      <Glass glow={0.5} style={{ left: 110, top: 140, width: 560, height: 420, ...rise(t, S.lock, 0.5) }}>
        <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.white }}>Lock NEST</div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><NestBadge size={52} glow={0.3} /><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.white }}>10,000</span></div>
          <span style={{ fontFamily: SANS, fontSize: 30, color: C.teal }}>→</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Token sym="veNEST" size={52} /><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.white }}>{fmt(10000 * (0.25 + slide * 0.75), 0)}</span></div>
        </div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 186, fontFamily: MONO, fontSize: 13, color: C.muted, display: 'flex', justifyContent: 'space-between' }}><span>LOCK DURATION</span><span style={{ color: C.white }}>{Math.max(1, Math.round(1.5 + slide * 4.5))} months</span></div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 220, height: 10, borderRadius: 10, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{ width: `${25 + slide * 75}%`, height: '100%', borderRadius: 10, background: `linear-gradient(90deg, ${C.nest}, ${C.teal})`, boxShadow: `0 0 12px ${C.teal}` }} />
          <div style={{ position: 'absolute', left: `calc(${25 + slide * 75}% - 13px)`, top: -8, width: 26, height: 26, borderRadius: 26, background: '#fff', boxShadow: `0 0 16px ${C.teal}` }} />
        </div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 268, fontFamily: MONO, fontSize: 13, color: C.dim, display: 'flex', justifyContent: 'space-between' }}><span>1W</span><span>3M</span><span>6M MAX</span></div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 318, height: 70, borderRadius: 16, border: `1px solid ${C.teal}66`, background: `${C.teal}14`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontFamily: SANS, fontSize: 19, color: C.white }}>
          <span>Voting power</span><span style={{ fontFamily: MONO, color: C.teal }}>{t > ve ? 'Max ✓' : '…'}</span>
        </div>
      </Glass>
      {/* gauge voting */}
      <Glass glow={0.4} style={{ left: 700, top: 140, width: 520, height: 420, ...rise(t, vote - 0.25, 0.5) }}>
        <div style={{ position: 'absolute', left: 26, top: 22, right: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.white }}>Vote</span>
          <Chip style={{ fontSize: 13, padding: '4px 10px' }}>Epoch 42 · {dd}d {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</Chip>
        </div>
        {gauges.map((g, i) => (
          <div key={i} style={{ position: 'absolute', left: 26, right: 26, top: 96 + i * 76 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, fontSize: 18, color: C.white }}>
              <div style={{ display: 'flex' }}><Token sym={g.pair[0]} size={24} /><Token sym={g.pair[1]} size={24} style={{ marginLeft: -8 }} /></div>
              {g.pair.join(' / ')}
              <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 15, color: i === 0 ? C.lime : C.muted }}>{Math.round(g.v * 100 * vp)}%</span>
            </div>
            <div style={{ marginTop: 10, height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${g.v * 260 * vp}%`, maxWidth: '100%', height: '100%', borderRadius: 8, background: i === 0 ? `linear-gradient(90deg, ${C.teal}, ${C.lime})` : C.nest }} />
            </div>
          </div>
        ))}
      </Glass>
      {/* 100% of fees */}
      <div style={{ position: 'absolute', left: 110, top: 600, ...rise(t, cap - 0.15, 0.5, 30) }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 26 }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 230, lineHeight: 0.9, letterSpacing: '-0.06em', background: `linear-gradient(180deg, #fff, ${C.mint} 50%, ${C.teal})`, WebkitBackgroundClip: 'text', color: 'transparent', filter: `drop-shadow(0 0 40px ${C.teal}55)` }}>{pct}%</span>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 50, lineHeight: 1.05, color: C.white, letterSpacing: '-0.03em', ...rise(t, fees - 0.1, 0.45, 20) }}>of trading fees<br /><span style={{ color: C.teal }}>to veNEST voters</span></div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', gap: 12, ...rise(t, fees + 0.25, 0.4, 12) }}>
          <Chip color={C.lime}>+ voting incentives</Chip><Chip>Weekly epochs</Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5. HYPE Engine ------------------------------ */

const Engine: React.FC<{ t: number }> = ({ t }) => {
  const eng = wi(4, 1), rev = wi(4, 5), real = wi(4, 7);
  const on = io(t, eng - 0.15, eng + 0.5, 0, 1, backOut);
  const spin = (t - S.engine) * 90 + io(t, rev, real + 0.6, 0, 1) * 200;
  const acc = io(t, real - 0.1, S.flywheel, 0, 1, Easing.out(Easing.cubic));
  const hypeSeries = useMemo(() => series(9, 50, 0.012, 0.01), []);
  const cx = 1180, cy = 430;
  return (
    <AbsoluteFill style={exitStyle(t, S.flywheel, 1)}>
      <div style={{ position: 'absolute', left: 760, top: 74 }}><Eyebrow t={t} at={S.engine + 0.05} color={C.lime}>THE HYPE ENGINE</Eyebrow></div>
      {/* revenue inputs */}
      {['Swap fees', 'Protocol revenue', 'veNEST share'].map((l, i) => (
        <div key={l} style={{ position: 'absolute', left: 760, top: 300 + i * 90, ...rise(t, eng + 0.1 + i * 0.12, 0.4, 14) }}>
          <Chip style={{ fontSize: 17, padding: '10px 16px' }}>{l}</Chip>
        </div>
      ))}
      {/* streams into the core */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {[0, 1, 2].map((i) => {
          const y0 = 320 + i * 90; const d = `M960 ${y0} C1040 ${y0} 1060 ${cy} ${cx - 150} ${cy}`;
          const dash = (t * 260) % 40;
          return <path key={i} d={d} fill="none" stroke={C.teal} strokeWidth={2.5} strokeDasharray="10 30" strokeDashoffset={-dash} opacity={io(t, rev - 0.3, rev + 0.2) * 0.9} style={{ filter: `drop-shadow(0 0 6px ${C.teal})` }} />;
        })}
        <path d={`M${cx + 150} ${cy} C${cx + 260} ${cy} ${cx + 300} ${cy + 40} ${cx + 380} ${cy + 40}`} fill="none" stroke={C.lime} strokeWidth={3} strokeDasharray="12 26" strokeDashoffset={-(t * 300) % 38} opacity={io(t, real - 0.3, real + 0.2)} style={{ filter: `drop-shadow(0 0 8px ${C.lime})` }} />
      </svg>
      {/* turbine core */}
      <div style={{ position: 'absolute', left: cx - 150, top: cy - 150, width: 300, height: 300, transform: `scale(${on})` }}>
        <div style={{ position: 'absolute', inset: -40, borderRadius: 400, background: `radial-gradient(circle, ${C.teal}55, transparent 65%)`, opacity: 0.6 + 0.4 * Math.sin(t * 6) }} />
        <svg width={300} height={300} viewBox="-150 -150 300 300" style={{ position: 'absolute', inset: 0 }}>
          <circle r={140} fill="#07100D" stroke={C.teal} strokeWidth={2} />
          <circle r={118} fill="none" stroke={C.teal} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 8" transform={`rotate(${-spin * 0.5})`} />
          <g transform={`rotate(${spin})`}>
            {Array.from({ length: 10 }).map((_, i) => <path key={i} d="M0 -30 C30 -60 60 -80 96 -82 C80 -60 50 -40 22 -22 Z" fill={i % 2 ? C.teal : C.nest} opacity={0.85} transform={`rotate(${i * 36})`} />)}
          </g>
          <circle r={40} fill="#97FCE4" style={{ filter: `drop-shadow(0 0 18px #97FCE4)` }} />
          <text y={12} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={34} fill="#062B23">H</text>
        </svg>
      </div>
      {/* HYPE accumulation */}
      <Glass glow={0.6} color={C.lime} style={{ left: 1430, top: 560, width: 400, height: 300, ...rise(t, real - 0.2, 0.5, 30) }}>
        <div style={{ position: 'absolute', left: 22, top: 18, fontFamily: MONO, fontSize: 13, color: C.muted, letterSpacing: '0.12em' }}>HYPE ACCUMULATED</div>
        <div style={{ position: 'absolute', left: 22, top: 42, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Token sym="HYPE" size={38} />
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, color: C.white, letterSpacing: '-0.03em' }}>{fmt(48210 + acc * 1874, 0)}</span>
        </div>
        <div style={{ position: 'absolute', left: 22, top: 130 }}><Spark data={hypeSeries} w={356} h={140} p={0.25 + acc * 0.75} color={C.lime} /></div>
      </Glass>
      <div style={{ position: 'absolute', left: 760, top: 640, width: 640 }}>
        <Kinetic t={t} at={rev - 0.1} size={60} text="Revenue in. Real HYPE out." accent={['HYPE']} stagger={0.1} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 6. Flywheel ------------------------------ */

const Flywheel: React.FC<{ t: number }> = ({ t }) => {
  const nodesAt = [wi(5, 0), wi(5, 1), wi(5, 3), wi(5, 5)];
  const every = wi(5, 6), fw = wi(5, 10);
  const cx = 560, cy = 540, R = 290;
  const rot = (t - S.flywheel) * 22 + io(t, every, fw + 0.8, 0, 1, Easing.inOut(Easing.cubic)) * 160;
  const nodes = [
    { l: 'Traders', s: 'Swap → fees', c: C.cyan },
    { l: 'LPs', s: 'Liquidity → emissions', c: C.teal },
    { l: 'Voters', s: 'veNEST → 100% fees', c: C.lime },
    { l: 'HYPE', s: 'Engine → accumulation', c: '#97FCE4' },
  ];
  const ringP = io(t, S.flywheel, S.flywheel + 1.2, 0, 1, Easing.out(Easing.cubic));
  return (
    <AbsoluteFill style={{ opacity: 1 - io(t, S.end - 0.2, S.end + 0.1) }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.line2} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#fwg)`} strokeWidth={5} strokeDasharray={`${ringP * 2 * Math.PI * R * 0.9} 9999`} strokeLinecap="round" transform={`rotate(${rot - 90} ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 10px ${C.teal})` }} />
        <defs><linearGradient id="fwg" x1="0" x2="1"><stop offset="0" stopColor={C.cyan} /><stop offset="0.5" stopColor={C.teal} /><stop offset="1" stopColor={C.lime} /></linearGradient></defs>
        {Array.from({ length: 4 }).map((_, i) => {
          const a = ((rot + i * 90 + 45) * Math.PI) / 180;
          return <path key={i} d={`M${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R} l-12 -7 l0 14 Z`} fill={C.teal} transform={`rotate(${rot + i * 90 + 45 + 90} ${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R})`} opacity={ringP} />;
        })}
      </svg>
      {/* hub */}
      <div style={{ position: 'absolute', left: cx - 95, top: cy - 95, transform: `scale(${io(t, S.flywheel, S.flywheel + 0.6, 0, 1, backOut)}) rotate(${Math.sin(t) * 3}deg)` }}><NestBadge size={190} glow={1.2} /></div>
      {nodes.map((n, i) => {
        const a = ((i * 90 - 90 + rot * 0.15) * Math.PI) / 180;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const p = io(t, nodesAt[i] - 0.15, nodesAt[i] + 0.35, 0, 1, backOut);
        return (
          <div key={n.l} style={{ position: 'absolute', left: x - 110, top: y - 50, width: 220, height: 100, transform: `scale(${p})` }}>
            <Glass glow={0.6} color={n.c} radius={20} style={{ inset: 0 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: n.c, letterSpacing: '-0.02em' }}>{n.l}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: C.muted, marginTop: 4 }}>{n.s}</span>
              </div>
            </Glass>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 980, top: 300, width: 600 }}>
        <Kinetic t={t} at={wi(5, 4) - 0.05} size={84} text="All aligned." accent={['aligned.']} stagger={0.1} />
        <div style={{ marginTop: 22 }}><Kinetic t={t} at={every - 0.05} size={56} text="Every trade feeds the flywheel." weight={500} color={C.muted} stagger={0.07} /></div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 7. End ------------------------------ */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end;
  const tag = wi(6, 1);
  const p = io(t, s0, s0 + 0.9);
  const flash = io(t, s0 + 0.05, s0 + 0.12, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.12, s0 + 0.9, 0, 1, Easing.out(Easing.quad)));
  const url = io(t, tag + 0.8, tag + 1.3);
  const fade = io(t, 29.55, 30, 0, 1, Easing.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - fade }}>
      {[0, 1].map((i) => {
        const q = io(t, s0 + i * 0.15, s0 + 1.6 + i * 0.15, 0, 1, Easing.out(Easing.cubic));
        return <div key={i} style={{ position: 'absolute', left: 1360 - 60 - q * 600, top: 300 - 60 - q * 600, width: 120 + q * 1200, height: 120 + q * 1200, borderRadius: 2000, border: `2px solid ${i ? C.lime : C.teal}`, opacity: (1 - q) * 0.5 }} />;
      })}
      <div style={{ position: 'absolute', left: 1360 - (150 * 81.2208) / 28 / 2, top: 225, opacity: p, transform: `scale(${0.92 + 0.08 * p})`, filter: `blur(${(1 - p) * 8}px)` }}>
        <NestLogo height={150} draw={io(t, s0 + 0.1, s0 + 1.0, 0, 1, Easing.linear)} glow={1.1} />
      </div>
      <div style={{ position: 'absolute', left: 960, top: 470, width: 800, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Kinetic t={t} at={tag - 0.05} size={80} text="The HYPE-aligned DEX" accent={['HYPE-aligned']} stagger={0.12} style={{ justifyContent: 'center' }} />
        <div style={{ height: 2, width: 640 * io(t, tag + 0.4, tag + 1.2), background: `linear-gradient(90deg, transparent, ${C.teal}, ${C.lime}, transparent)`, marginTop: 30, boxShadow: `0 0 16px ${C.teal}` }} />
        <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 20, opacity: url, transform: `translateY(${(1 - url) * 14}px)` }}>
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 38, color: C.white, letterSpacing: '-0.02em' }}>usenest.xyz</span>
          <Chip color={C.lime}><LiveDot t={t} /> Live on HyperEVM</Chip>
        </div>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 30%, rgba(220,255,245,${flash}), rgba(46,230,197,${flash * 0.5}) 50%, rgba(5,7,6,${flash * 0.2}) 90%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ Film ------------------------------ */

export const NestFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const punch = [0.3, S.end + 0.1].reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 6) * 0.02 : 0), 0);
  const camX = noise(t * 0.25, 2) * 6, camY = noise(t * 0.21, 5) * 4;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <Audio src={staticFile('nest/mix.wav')} />
      <AbsoluteFill style={{ transform: `scale(${1.02 + punch + Math.sin(t * 0.3) * 0.005}) translate(${camX}px, ${camY}px)` }}>
        <Background t={t} />
        {between(t, 0, S.spot) && <Hook t={t} />}
        {between(t, S.spot - 0.3, S.swap) && <Spot t={t} />}
        {between(t, S.swap - 0.3, S.lock) && <Swap t={t} />}
        {between(t, S.lock - 0.3, S.engine) && <Lock t={t} />}
        {between(t, S.engine - 0.3, S.flywheel) && <Engine t={t} />}
        {between(t, S.flywheel - 0.3, S.end + 0.2) && <Flywheel t={t} />}
        <HostRig t={t} frame={frame} />
        {t >= S.end - 0.05 && <End t={t} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.05, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - io(t, 0, 0.2, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};
