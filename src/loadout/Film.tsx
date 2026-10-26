import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Gamer } from './Presenter';
import {
  Art, C, Chip, DISPLAY, Eyebrow, GameArt, Kinetic, LiveDot, Logo, Panel, SANS, SolanaMark, backOut, expo, flicker, fmt, inout, io, noise, walk,
} from './ui';

const S = T.scenes;
const FPS = T.fps;
/** Absolute start time of word `i` in VO segment `seg`. */
const wi = (seg: number, i: number) => Number(T.vo[seg].words[i][0]);
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;
const exitStyle = (t: number, end: number, dx = -1): React.CSSProperties => {
  const o = io(t, end - 0.3, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateX(${dx * o * 120}px) scale(${1 + o * 0.03})`, filter: o > 0.02 ? `blur(${o * 12}px)` : undefined };
};

/* Fictional titles for illustration; no real game's data is shown. */
type Game = { title: string; genre: string; tier: 'Indie' | 'AA'; mcap: string; chg: number; holders: string; wish: string; art: Art };
const GAMES: Game[] = [
  { title: 'Neon Drifters', genre: 'Racing', tier: 'AA', mcap: '$2.4M', chg: 18.4, holders: '3.1K', wish: '62K', art: { sky: ['#1A0B3A', '#0B2747'], sun: '#FF4FD8', hills: ['#0A0F24', '#060914'], seed: 3, motif: 'city' } },
  { title: 'Hollow Crown', genre: 'Action RPG', tier: 'Indie', mcap: '$1.1M', chg: 9.2, holders: '1.8K', wish: '41K', art: { sky: ['#3A1606', '#7A3410'], sun: '#FFC067', hills: ['#1E0C06', '#0E0604'], seed: 7, motif: 'castle' } },
  { title: 'Skyward', genre: 'Adventure', tier: 'Indie', mcap: '$860K', chg: 12.7, holders: '1.2K', wish: '28K', art: { sky: ['#06343F', '#0E6C7A'], sun: '#E6FFF8', hills: ['#05262E', '#03161B'], seed: 11, motif: 'ship' } },
  { title: 'Emberfall', genre: 'Survival', tier: 'AA', mcap: '$3.2M', chg: 6.1, holders: '4.4K', wish: '88K', art: { sky: ['#2A0A0A', '#6B1F0B'], sun: '#FEA438', hills: ['#190707', '#0C0404'], seed: 17, motif: 'tree' } },
  { title: 'Tidebound', genre: 'Roguelite', tier: 'Indie', mcap: '$540K', chg: 22.9, holders: '960', wish: '19K', art: { sky: ['#0A1B3D', '#1E4E8C'], sun: '#BFE4FF', hills: ['#081428', '#040B17'], seed: 23 } },
  { title: 'Iron Verse', genre: 'Tactics', tier: 'AA', mcap: '$1.9M', chg: 4.8, holders: '2.6K', wish: '53K', art: { sky: ['#1C1A10', '#4B3F14'], sun: '#FFE9B0', hills: ['#121008', '#090804'], seed: 29, motif: 'city' } },
];

/* ------------------------------ Background ------------------------------ */

const Background: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: 1500, height: 1500, borderRadius: 1500, left: -300 + noise(t * 0.15, 1) * 200, top: -800, background: 'radial-gradient(circle, rgba(32,242,255,0.13), rgba(32,242,255,0) 60%)' }} />
    <div style={{ position: 'absolute', width: 1300, height: 1300, borderRadius: 1300, left: 1000 + noise(t * 0.13, 4) * 220, top: 250, background: 'radial-gradient(circle, rgba(254,164,56,0.09), rgba(254,164,56,0) 60%)' }} />
    {/* neon perspective floor */}
    <div style={{ position: 'absolute', inset: 0, perspective: 800, perspectiveOrigin: '50% 35%' }}>
      <div style={{
        position: 'absolute', left: -1200, right: -1200, top: 640, height: 1500, transform: 'rotateX(76deg)', transformOrigin: '50% 0%',
        backgroundImage: 'linear-gradient(rgba(32,242,255,0.22) 2px, transparent 2px), linear-gradient(90deg, rgba(32,242,255,0.16) 2px, transparent 2px)',
        backgroundSize: '110px 110px', backgroundPosition: `0px ${(t * 70) % 110}px`,
        maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95), transparent 65%)', WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95), transparent 65%)',
      }} />
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 636, height: 3, background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)`, opacity: 0.35, filter: 'blur(1px)' }} />
    {/* drifting motes */}
    {Array.from({ length: 28 }).map((_, i) => {
      const x = ((i * 397) % 1920 + t * (8 + (i % 5) * 4)) % 1920;
      const y = 1080 - (((i * 211) % 1080 + t * (20 + (i % 7) * 6)) % 1180);
      return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, borderRadius: 3, background: i % 4 ? C.cyan : C.orange, opacity: 0.25 + 0.25 * Math.sin(t * 2 + i), boxShadow: `0 0 8px ${i % 4 ? C.cyan : C.orange}` }} />;
    })}
  </AbsoluteFill>
);

/* ------------------------------ Host rig ------------------------------ */

const K = {
  t: [0, 5.0, 5.5, 8.5, 9.0, 13.05, 13.55, 18.25, 18.75, 23.55, 24.05, 26.3, 26.9],
  x: [520, 520, 1560, 1560, 360, 360, 1560, 1560, 360, 360, 1560, 1560, 520],
  s: [0.98, 0.98, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.98],
  look: [0.6, 0.6, -0.9, -0.9, 0.9, 0.9, -0.9, -0.9, 0.9, 0.9, -0.9, -0.9, 0.6],
};
const kf = (t: number, a: number[]) => interpolate(t, K.t, a, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const sentenceStarts = T.vo.flatMap((v) => v.words.filter((_, i) => i === 0 || /[.,]$/.test(String(v.words[i - 1][2]))).map((x) => Number(x[0])));

const HostRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const x = kf(t, K.x), s = kf(t, K.s);
  const intro = io(t, 0.35, 1.2);
  const cam = Math.max(0, ...T.vo.map((v) => io(t, v.at - 0.25, v.at) * (1 - io(t, v.at + 0.9, v.at + 1.3))));
  const look = kf(t, K.look) * (1 - cam);
  const emphasis = Math.max(0, ...sentenceStarts.map((p) => (t >= p - 0.1 && t < p + 0.6 ? Math.sin(((t - p + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.open.length - 1, frame);
  const smile = 0.4 + io(t, 28.9, 29.4) * 0.5;
  const W = 800 * s, H = 1000 * s;
  return (
    <div style={{ position: 'absolute', left: x - W / 2, top: 1080 - H + 30 + (1 - intro) * 160, width: W, height: H, opacity: intro, filter: intro < 1 ? `blur(${(1 - intro) * 14}px)` : undefined }}>
      <div style={{ position: 'absolute', left: W * 0.1, top: H * 0.06, width: W * 0.8, height: W * 0.8, borderRadius: W, background: 'radial-gradient(circle, rgba(32,242,255,0.22), rgba(32,242,255,0) 65%)' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Gamer t={t} open={mouth.open[i]} wide={mouth.wide[i]} round={mouth.round[i]} smile={smile} emphasis={emphasis * 0.8} look={[look, 0.05]} />
      </div>
    </div>
  );
};

/* ------------------------------ shared ------------------------------ */

const Line: React.FC<{ data: number[]; w: number; h: number; p: number; color?: string; fill?: boolean; base?: boolean }> = ({ data, w, h, p, color = C.cyan, fill = true, base }) => {
  const id = 'ln' + React.useId().replace(/:/g, '');
  const min = base ? 0 : Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, 6 + (1 - (v - min) / (max - min || 1)) * (h - 12)]);
  const n = Math.max(1, p * (pts.length - 1)); const k = Math.floor(n), f = n - k;
  const vis = pts.slice(0, k + 1);
  if (k < pts.length - 1) vis.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  const d = vis.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const last = vis[vis.length - 1];
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.3} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      {fill && <path d={`${d} L${last[0]},${h} L0,${h} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx={last[0]} cy={last[1]} r={10} fill={color} opacity={0.2} /><circle cx={last[0]} cy={last[1]} r={4.5} fill="#fff" />
    </svg>
  );
};

const GameCard: React.FC<{ g: Game; t: number; w?: number; style?: React.CSSProperties; glow?: number }> = ({ g, t, w = 330, style, glow = 0.3 }) => (
  <Panel glow={glow} cut={16} style={{ width: w, height: w * 1.02, ...style }}>
    <div style={{ position: 'absolute', left: 0, top: 0 }}><GameArt art={g.art} w={w} h={w * 0.52} t={t} /></div>
    <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', gap: 8 }}>
      <Chip color={g.tier === 'AA' ? C.orange : C.cyan} style={{ fontSize: 13, padding: '4px 9px', background: 'rgba(5,7,11,0.8)' }}>{g.tier}</Chip>
    </div>
    <div style={{ position: 'absolute', left: 18, right: 18, top: w * 0.56, fontFamily: SANS }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: w * 0.085, color: C.white, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{g.title}</div>
      <div style={{ fontSize: w * 0.042, color: C.muted, marginTop: 2 }}>{g.genre} · Steam wishlists {g.wish}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: w * 0.05, fontSize: w * 0.048 }}>
        <span style={{ color: C.white, fontWeight: 600 }}>{g.mcap}</span>
        <span style={{ color: C.green, fontWeight: 600 }}>▲ {g.chg.toFixed(1)}%</span>
        <span style={{ color: C.muted }}>{g.holders} holders</span>
      </div>
    </div>
  </Panel>
);

/* ------------------------------ 1. Hook ------------------------------ */

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const shift = io(t, 0.95, 1.6, 0, 1, inout);
  const fl = flicker(t, 0.15);
  const size = 560 - shift * 170;
  const lx = 960 + shift * 420, ly = 470 - shift * 120;
  const tag = wi(0, 4);
  const creators = wi(0, 7);
  return (
    <AbsoluteFill style={exitStyle(t, S.games)}>
      <div style={{ position: 'absolute', left: lx - size / 2, top: ly - size / 2 }}><Logo size={size} glow={fl} /></div>
      <div style={{ position: 'absolute', left: 1000, top: 610, width: 820, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: shift }}>
        <Kinetic t={t} at={tag - 0.05} size={64} text="The launchpad for games" accent={['games']} accentColor={C.orange} stagger={0.1} style={{ justifyContent: 'center' }} />
        <div style={{ marginTop: 36, opacity: io(t, creators - 0.1, creators + 0.4), transform: `translateY(${(1 - io(t, creators - 0.1, creators + 0.5)) * 16}px)`, display: 'flex', alignItems: 'center', gap: 16, fontFamily: DISPLAY, fontWeight: 600, fontSize: 24, letterSpacing: '0.2em', color: C.muted }}>
          <div style={{ width: 40, height: 1, background: C.line2 }} />
          FROM THE CREATORS OF <span style={{ color: C.cream, textShadow: `0 0 18px ${C.orange}` }}>ILLUVIUM</span>
          <div style={{ width: 40, height: 1, background: C.line2 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 2. Games ------------------------------ */

const Games: React.FC<{ t: number }> = ({ t }) => {
  const real = wi(1, 0), sol = wi(1, 8);
  return (
    <AbsoluteFill style={exitStyle(t, S.trade)}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}>
        <Eyebrow t={t} at={S.games + 0.05}>NOT CRYPTO GAMES. REAL GAMES.</Eyebrow>
        <div style={{ marginTop: 18 }}><Kinetic t={t} at={real} size={80} text="Real indie & AA games" accent={['indie', 'AA']} stagger={0.12} /></div>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 280, display: 'grid', gridTemplateColumns: 'repeat(3, 330px)', gap: 26 }}>
        {GAMES.map((g, i) => {
          const p = io(t, S.games + 0.15 + i * 0.09, S.games + 0.75 + i * 0.09);
          return (
            <div key={g.title} style={{ position: 'relative', width: 330, height: 337, opacity: p, transform: `perspective(1400px) translateY(${(1 - p) * 120}px) rotateX(${(1 - p) * 30}deg)` }}>
              <GameCard g={g} t={t} glow={0.25 + 0.4 * Math.max(0, Math.sin(t * 2 - i))} style={{ left: 0, top: 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 1190, top: 120, opacity: io(t, sol - 0.1, sol + 0.4), transform: `translateX(${(1 - io(t, sol - 0.1, sol + 0.5)) * 40}px)` }}>
        <Chip color={C.green} style={{ fontSize: 22, padding: '12px 20px', gap: 12 }}><LiveDot t={t} /> TRADING ON <SolanaMark size={28} /> SOLANA</Chip>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 3. Trade ------------------------------ */

const Trade: React.FC<{ t: number }> = ({ t }) => {
  const disc = wi(2, 0), trade = wi(2, 3), fees = wi(2, 7);
  const g = GAMES[0];
  const curve = useMemo(() => Array.from({ length: 70 }, (_, i) => 0.04 + Math.pow(i / 69, 1.7) * (1 + 0.06 * Math.sin(i * 0.9))), []);
  const panel = io(t, S.trade - 0.05, S.trade + 0.5);
  const chartP = io(t, trade - 0.1, fees + 0.8, 0.02, 1, Easing.inOut(Easing.quad));
  const tap = trade + 0.75;
  const press = Math.sin(io(t, tap - 0.08, tap + 0.12, 0, 1, Easing.linear) * Math.PI);
  const fill = io(t, fees + 0.2, fees + 0.95, 0, 1, Easing.out(Easing.cubic));
  const raised = 18240 + fill * 6120;
  return (
    <AbsoluteFill style={exitStyle(t, S.trust, 1)}>
      <div style={{ position: 'absolute', left: 760, top: 64 }}>
        <Eyebrow t={t} at={disc - 0.05}>DISCOVER · TRADE · FUND</Eyebrow>
      </div>
      {/* coming-soon rail */}
      <div style={{ position: 'absolute', left: 760, top: 110, display: 'flex', gap: 16 }}>
        {GAMES.slice(1, 5).map((x, i) => {
          const p = io(t, disc + i * 0.08, disc + 0.45 + i * 0.08);
          return (
            <Panel key={x.title} cut={12} glow={0.2} style={{ position: 'relative', width: 250, height: 92, opacity: p, transform: `translateY(${(1 - p) * -30}px)` }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 92, height: 92, overflow: 'hidden' }}><GameArt art={x.art} w={92} h={92} t={t} /></div>
              <div style={{ position: 'absolute', left: 106, top: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, color: C.white, textTransform: 'uppercase' }}>{x.title}</div>
              <div style={{ position: 'absolute', left: 106, top: 44, fontFamily: SANS, fontSize: 13, color: C.orange, fontWeight: 600, letterSpacing: '0.06em' }}>COMING SOON</div>
              <div style={{ position: 'absolute', left: 106, top: 64, fontFamily: SANS, fontSize: 13, color: C.muted }}>T-{2 + i}d {String((14 + i * 7) % 24).padStart(2, '0')}h</div>
            </Panel>
          );
        })}
      </div>
      {/* trading page */}
      <Panel glow={0.5} style={{ left: 760, top: 236, width: 1060, height: 640, opacity: panel, transform: `perspective(1600px) rotateY(${(1 - panel) * -16 - 3}deg) translateX(${(1 - panel) * 100}px)`, transformOrigin: '0 50%' }}>
        <div style={{ position: 'absolute', left: 28, top: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, overflow: 'hidden', clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}><GameArt art={g.art} w={64} h={64} t={t} /></div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, color: C.white, textTransform: 'uppercase' }}>{g.title} <span style={{ color: C.cyan }}>$NEON</span></div>
            <div style={{ fontFamily: SANS, fontSize: 15, color: C.muted }}>Racing · AA studio · bonding curve</div>
          </div>
          <Chip color={C.orange} style={{ marginLeft: 30, fontSize: 14 }}>Ground floor</Chip>
        </div>
        <div style={{ position: 'absolute', left: 28, top: 116 }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted, letterSpacing: '0.14em' }}>CURVE PRICE</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, color: C.white }}>{fmt(0.00004 + chartP * 0.00031, 6)} SOL</div>
        </div>
        <div style={{ position: 'absolute', left: 28, top: 200 }}><Line data={curve} w={640} h={330} p={chartP} base /></div>
        <div style={{ position: 'absolute', left: 28, top: 200 + 330 - 34, opacity: io(t, trade, trade + 0.4) * (1 - io(t, fees - 0.2, fees)), fontFamily: SANS, fontWeight: 600, fontSize: 15, color: C.orange }}>◆ You: first trade, ground floor</div>
        {/* order box */}
        <div style={{ position: 'absolute', right: 28, top: 116, width: 300 }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.line2}` }}>
            <div style={{ flex: 1, padding: 10, textAlign: 'center', background: `${C.cyan}22`, color: C.cyan, fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>BUY</div>
            <div style={{ flex: 1, padding: 10, textAlign: 'center', color: C.muted, fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>SELL</div>
          </div>
          <div style={{ marginTop: 14, padding: 14, borderRadius: 8, border: `1px solid ${C.line2}`, fontFamily: SANS, color: C.white, fontSize: 26, display: 'flex', justifyContent: 'space-between' }}>2.00 <span style={{ color: C.muted, fontSize: 18 }}>SOL</span></div>
          <div style={{ marginTop: 14, height: 58, borderRadius: 8, background: C.cyan, color: '#04121A', fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - press * 0.06})`, boxShadow: `0 0 ${20 + press * 30}px ${C.cyan}88` }}>{t > tap ? '✓ BOUGHT' : 'BUY $NEON'}</div>
          {/* fee split */}
          <div style={{ marginTop: 26, opacity: io(t, fees - 0.15, fees + 0.3) }}>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted, letterSpacing: '0.12em' }}>WHERE YOUR FEES GO</div>
            <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ width: `${80 * fill}%`, background: C.orange, boxShadow: `0 0 14px ${C.orange}` }} />
              <div style={{ width: `${20 * fill}%`, background: C.cyanDeep }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 15, marginTop: 8 }}>
              <span style={{ color: C.orange, fontWeight: 600 }}>Majority → game treasury</span><span style={{ color: C.muted }}>Platform</span>
            </div>
            <div style={{ marginTop: 18, padding: 14, borderRadius: 8, border: `1px solid ${C.orange}55`, background: `${C.orange}12` }}>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted, letterSpacing: '0.12em' }}>DEV FUND RAISED</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, color: C.cream }}>${fmt(raised, 0)}</div>
            </div>
          </div>
        </div>
        {/* fee coins flying to the treasury */}
        {Array.from({ length: 7 }).map((_, i) => {
          const s0 = fees + i * 0.07; const p = io(t, s0, s0 + 0.55, 0, 1, Easing.inOut(Easing.quad));
          if (p <= 0 || p >= 1) return null;
          const x = 600 + (840 - 600) * p, y = 220 + (560 - 220) * p - Math.sin(p * Math.PI) * 120;
          return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 18, height: 18, borderRadius: 18, background: C.cream, boxShadow: `0 0 14px ${C.orange}` }} />;
        })}
      </Panel>
    </AbsoluteFill>
  );
};

/* ------------------------------ 4. Trust ------------------------------ */

const Trust: React.FC<{ t: number }> = ({ t }) => {
  const no1 = wi(3, 0), no2 = wi(3, 3), dev = wi(3, 5);
  const crossed = (at: number, label: string, sub: string, i: number) => {
    const p = io(t, at - 0.1, at + 0.35);
    const x = io(t, at + 0.3, at + 0.55, 0, 1, Easing.out(Easing.cubic));
    return (
      <div key={label} style={{ position: 'relative', width: 380, height: 120, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
        <Panel cut={14} glow={0.15} color={C.red} style={{ inset: 0, opacity: 1 - x * 0.45 }}>
          <div style={{ position: 'absolute', left: 24, top: 22, fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, color: C.white, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ position: 'absolute', left: 24, top: 66, fontFamily: SANS, fontSize: 16, color: C.muted }}>{sub}</div>
        </Panel>
        <div style={{ position: 'absolute', left: 12, right: 12, top: 58, height: 5, background: C.red, transformOrigin: '0 50%', transform: `scaleX(${x}) rotate(-6deg)`, boxShadow: `0 0 14px ${C.red}` }} />
        <div style={{ position: 'absolute', right: -18, top: -18, width: 50, height: 50, borderRadius: 50, background: C.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, transform: `scale(${io(t, at + 0.4, at + 0.65, 0, 1, backOut)})` }}>✕</div>
      </div>
    );
  };
  const feed = [
    { tag: 'DEVLOG #14', text: 'Boss fight now playable in the demo', c: C.cyan },
    { tag: 'MILESTONE', text: 'Steam wishlists passed 60,000', c: C.orange },
    { tag: 'BUILD 0.9', text: 'Co-op beta live for holders', c: C.green },
  ];
  const fp = io(t, dev - 0.2, dev + 0.4);
  return (
    <AbsoluteFill style={exitStyle(t, S.load)}>
      <div style={{ position: 'absolute', left: 110, top: 80 }}>
        <Eyebrow t={t} at={S.trust + 0.05}>FAIR FROM THE FIRST TRADE</Eyebrow>
        <div style={{ marginTop: 20 }}><Kinetic t={t} at={no1} size={78} text="Same curve. Same rules." accent={['Same', 'rules.']} stagger={0.1} /></div>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 300, display: 'flex', gap: 34 }}>
        {crossed(no1, 'Private rounds', 'No discounted presale', 0)}
        {crossed(no2, 'Insider access', 'Nobody gets in before you', 1)}
      </div>
      {/* dev updates on the trading page */}
      <Panel glow={0.45} style={{ left: 110, top: 480, width: 830, height: 440, opacity: fp, transform: `translateY(${(1 - fp) * 60}px)` }}>
        <div style={{ position: 'absolute', left: 26, top: 20, right: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: C.white }}>NEON DRIFTERS <span style={{ color: C.muted, fontSize: 18 }}>/ trading page</span></span>
          <Chip color={C.cyan} style={{ fontSize: 13 }}><LiveDot t={t} color={C.cyan} size={8} /> Dev updates</Chip>
        </div>
        <div style={{ position: 'absolute', left: 26, right: 26, top: 84 }}>
          {feed.map((f, i) => {
            const p = io(t, dev + 0.1 + i * 0.25, dev + 0.5 + i * 0.25);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 16px', marginBottom: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${f.c}`, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: f.c, letterSpacing: '0.1em', width: 130 }}>{f.tag}</span>
                <span style={{ fontFamily: SANS, fontSize: 22, color: C.white, flex: 1 }}>{f.text}</span>
                <span style={{ fontFamily: SANS, fontSize: 14, color: C.dim }}>{1 + i * 2}d ago</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5. $LOAD ------------------------------ */

const Coin: React.FC<{ size: number; t: number }> = ({ size, t }) => {
  const spin = Math.cos(t * 1.6);
  return (
    <div style={{ width: size, height: size, position: 'relative', transform: `scaleX(${0.35 + 0.65 * Math.abs(spin)})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: size, background: `radial-gradient(circle at 35% 30%, #FFF6DA, ${C.cream} 35%, ${C.orange} 80%, #B9671C)`, boxShadow: `0 0 60px ${C.orange}AA, inset 0 0 0 ${size * 0.04}px #FFF3CF` }} />
      <div style={{ position: 'absolute', inset: size * 0.12, borderRadius: size, border: `${size * 0.025}px solid rgba(120,60,10,0.5)` }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: size * 0.1, height: size * 0.42, borderRadius: size, background: '#2A1606', transform: 'translate(-50%,-50%)', opacity: spin > 0 ? 1 : 0 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.2, color: '#2A1606', opacity: spin > 0 ? 0 : 1 }}>$LOAD</div>
    </div>
  );
};

const Load: React.FC<{ t: number }> = ({ t }) => {
  const load = wi(4, 0), buy = wi(4, 3), burns = wi(4, 5), rew = wi(4, 7), ref = wi(4, 9);
  const coinIn = io(t, load - 0.1, load + 0.5, 0, 1, backOut);
  const loop = io(t, buy - 0.1, buy + 0.5);
  const burnP = io(t, burns, burns + 1.6, 0, 1, Easing.out(Easing.cubic));
  const supply = 1_000_000_000 - burnP * 4_812_390;
  const steps = [
    { at: buy - 0.1, label: 'Platform fees', icon: '◆', c: C.cyan },
    { at: buy + 0.15, label: 'Auto buyback', icon: '⟳', c: C.cyan },
    { at: burns - 0.05, label: 'Burn', icon: '🔥', c: C.orange },
  ];
  const cards = io(t, rew - 0.15, rew + 0.4);
  const refP = io(t, ref - 0.1, ref + 0.4);
  return (
    <AbsoluteFill style={exitStyle(t, S.early, 1)}>
      <div style={{ position: 'absolute', left: 780, top: 70 }}>
        <Eyebrow t={t} at={load - 0.05} color={C.orange}>PLATFORM UTILITY TOKEN</Eyebrow>
      </div>
      <div style={{ position: 'absolute', left: 790, top: 140, transform: `scale(${coinIn})` }}><Coin size={230} t={t} /></div>
      <div style={{ position: 'absolute', left: 1070, top: 150 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 150, lineHeight: 0.9, color: C.white, opacity: io(t, load, load + 0.3) }}><span style={{ color: C.orange, textShadow: `0 0 30px ${C.orange}88` }}>$</span>LOAD</div>
        <div style={{ fontFamily: SANS, fontSize: 22, color: C.muted, marginTop: 14, opacity: io(t, load + 0.3, load + 0.7) }}>Automatic buybacks and burns, on-chain.</div>
      </div>
      {/* buyback loop */}
      <div style={{ position: 'absolute', left: 790, top: 430, display: 'flex', alignItems: 'center', gap: 18, opacity: loop }}>
        {steps.map((s, i) => {
          const p = io(t, s.at, s.at + 0.35, 0, 1, backOut);
          return (
            <React.Fragment key={s.label}>
              <Panel cut={12} glow={0.3} color={s.c} style={{ position: 'relative', width: 270, height: 96, transform: `scale(${p})` }}>
                <div style={{ position: 'absolute', left: 20, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: C.white, textTransform: 'uppercase' }}>
                  <span style={{ color: s.c, fontSize: 30 }}>{s.icon}</span>{s.label}
                </div>
              </Panel>
              {i < 2 && <div style={{ width: 40 * io(t, steps[i + 1].at - 0.15, steps[i + 1].at), height: 3, background: C.cyan, boxShadow: `0 0 10px ${C.cyan}` }} />}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 790, top: 548, opacity: io(t, burns, burns + 0.3), fontFamily: SANS, fontSize: 18, color: C.muted }}>
        Supply <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, color: C.cream, marginLeft: 10 }}>{fmt(supply, 0)}</span>
        <span style={{ color: C.orange, marginLeft: 14 }}>▼ burning</span>
      </div>
      {/* rewards + referrals */}
      <div style={{ position: 'absolute', left: 790, top: 640, display: 'flex', gap: 24, opacity: cards, transform: `translateY(${(1 - cards) * 40}px)` }}>
        <Panel glow={0.35} style={{ position: 'relative', width: 480, height: 240 }}>
          <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: SANS, fontSize: 14, color: C.muted, letterSpacing: '0.14em' }}>REWARDS · SEASON 1</div>
          <div style={{ position: 'absolute', left: 26, top: 52, fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, color: C.white }}>{fmt(1240 * io(t, rew, rew + 0.9, 0, 1, Easing.out(Easing.cubic)), 0)} <span style={{ fontSize: 24, color: C.cyan }}>PTS</span></div>
          <div style={{ position: 'absolute', left: 26, right: 26, top: 150, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${72 * io(t, rew + 0.1, rew + 1.0)}%`, height: '100%', borderRadius: 7, background: `linear-gradient(90deg, ${C.cyan}, ${C.orange})`, boxShadow: `0 0 12px ${C.cyan}` }} />
          </div>
          <div style={{ position: 'absolute', left: 26, top: 180, fontFamily: SANS, fontSize: 16, color: C.muted }}>Trade, hold and explore to level up</div>
        </Panel>
        <Panel glow={0.35} color={C.orange} style={{ position: 'relative', width: 480, height: 240, opacity: refP, transform: `translateX(${(1 - refP) * 30}px)` }}>
          <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: SANS, fontSize: 14, color: C.muted, letterSpacing: '0.14em' }}>REFERRALS</div>
          <div style={{ position: 'absolute', left: 26, right: 26, top: 56, padding: '14px 16px', borderRadius: 8, border: `1px dashed ${C.orange}88`, fontFamily: SANS, fontSize: 20, color: C.cream }}>app.loadout.xyz/r/<span style={{ color: C.orange }}>player1</span></div>
          <div style={{ position: 'absolute', left: 26, top: 140, display: 'flex', gap: 12 }}>
            {['+1 friend joined', '+ fee share'].map((x, i) => (
              <div key={x} style={{ transform: `scale(${io(t, ref + 0.35 + i * 0.2, ref + 0.6 + i * 0.2, 0, 1, backOut)})` }}><Chip color={C.green} style={{ fontSize: 15 }}>{x}</Chip></div>
            ))}
          </div>
        </Panel>
      </div>
      {/* burn embers rising from the burn node */}
      {Array.from({ length: 16 }).map((_, i) => {
        const dt = (t - burns - i * 0.06);
        if (dt < 0 || dt > 1.2) return null;
        return <div key={i} style={{ position: 'absolute', left: 1440 + Math.sin(i * 7.3) * 90 + dt * Math.sin(i) * 30, top: 470 - dt * 260, width: 6, height: 6, borderRadius: 6, background: i % 2 ? C.orange : C.cream, opacity: 1 - dt / 1.2, boxShadow: `0 0 10px ${C.orange}` }} />;
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------ 6. Early ------------------------------ */

const Early: React.FC<{ t: number }> = ({ t }) => {
  const get = wi(5, 0), back = wi(5, 4);
  const launches = [GAMES[4], GAMES[1], GAMES[3]];
  const team = io(t, back - 0.1, back + 0.5);
  return (
    <AbsoluteFill style={{ opacity: 1 - io(t, S.end - 0.15, S.end + 0.1) }}>
      <div style={{ position: 'absolute', left: 110, top: 80 }}>
        <Kinetic t={t} at={get} size={96} text="Get in early." accent={['early.']} accentColor={C.orange} stagger={0.1} />
        <div style={{ marginTop: 6 }}><Kinetic t={t} at={back} size={96} text="Back the builders." accent={['builders.']} stagger={0.1} /></div>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 400, display: 'flex', gap: 26 }}>
        {launches.map((g, i) => {
          const p = io(t, S.early + 0.1 + i * 0.1, S.early + 0.6 + i * 0.1);
          const secs = Math.max(0, 7300 - i * 3100 - (t - S.early) * 1);
          const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = Math.floor(secs % 60);
          return (
            <div key={g.title} style={{ position: 'relative', width: 330, height: 400, opacity: p, transform: `translateY(${(1 - p) * 80}px)` }}>
              <GameCard g={g} t={t} glow={0.3} style={{ left: 0, top: 0 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 350, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, color: C.orange, background: `${C.orange}14`, border: `1px solid ${C.orange}55` }}>
                LAUNCH IN {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 840, display: 'flex', alignItems: 'center', gap: 18, opacity: team, transform: `translateY(${(1 - team) * 20}px)` }}>
        <div style={{ display: 'flex' }}>
          {['#FEA438', '#20F2FF', '#3BE38B', '#FF6FB5', '#FFE9B0'].map((c, i) => (
            <div key={c} style={{ width: 52, height: 52, borderRadius: 52, marginLeft: i ? -14 : 0, background: `radial-gradient(circle at 50% 38%, ${c} 0 28%, #1A2030 30%)`, border: `3px solid ${C.bg}` }} />
          ))}
        </div>
        <span style={{ fontFamily: SANS, fontSize: 22, color: C.white }}>The studios making them, funded by every trade.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 7. End ------------------------------ */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end;
  const name = wi(6, 0), tag = wi(6, 1);
  const fl = flicker(t, s0 + 0.15);
  const flash = io(t, s0 + 0.05, s0 + 0.12, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.12, s0 + 0.9, 0, 1, Easing.out(Easing.quad)));
  const url = io(t, tag + 0.9, tag + 1.4);
  const fade = io(t, 29.5, 30, 0, 1, Easing.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - fade }}>
      <div style={{ position: 'absolute', left: 1360 - 230, top: 70, transform: `scale(${0.9 + 0.1 * io(t, s0, s0 + 1.2)})` }}><Logo size={460} glow={fl} /></div>
      <div style={{ position: 'absolute', left: 960, top: 560, width: 800, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Kinetic t={t} at={tag - 0.05} size={78} text="The launchpad for games" accent={['games']} accentColor={C.orange} stagger={0.12} style={{ justifyContent: 'center' }} />
        <div style={{ height: 3, width: 700 * io(t, tag + 0.4, tag + 1.2), background: `linear-gradient(90deg, transparent, ${C.cyan}, ${C.orange}, transparent)`, marginTop: 30, boxShadow: `0 0 16px ${C.cyan}` }} />
        <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 22, opacity: url, transform: `translateY(${(1 - url) * 14}px)` }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 36, color: C.white, letterSpacing: '0.04em' }}>app.loadout.xyz</span>
          <Chip color={C.green}><LiveDot t={t} /> Live on <SolanaMark size={20} /> Solana</Chip>
        </div>
        <div style={{ marginTop: 22, fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, letterSpacing: '0.22em', color: C.muted, opacity: io(t, tag + 1.2, tag + 1.6) }}>
          FROM THE CREATORS OF <span style={{ color: C.cream }}>ILLUVIUM</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: io(t, name - 0.1, name + 0.2) * 0 }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 60% 40%, rgba(220,255,255,${flash}), rgba(32,242,255,${flash * 0.5}) 50%, rgba(5,7,11,${flash * 0.2}) 90%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ Film ------------------------------ */

export const LoadoutFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const punch = [0.36, S.end + 0.1].reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 6) * 0.02 : 0), 0);
  const glitch = Math.max(...[S.games, S.trade, S.trust, S.load, S.early].map((s) => (t > s - 0.12 && t < s + 0.05 ? 1 : 0)));
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <Audio src={staticFile('loadout/mix.wav')} />
      <AbsoluteFill style={{ transform: `scale(${1.02 + punch + Math.sin(t * 0.3) * 0.005}) translateX(${glitch * noise(t * 90, 1) * 8}px)` }}>
        <Background t={t} />
        {between(t, 0, S.games) && <Hook t={t} />}
        {between(t, S.games - 0.3, S.trade) && <Games t={t} />}
        {between(t, S.trade - 0.3, S.trust) && <Trade t={t} />}
        {between(t, S.trust - 0.3, S.load) && <Trust t={t} />}
        {between(t, S.load - 0.3, S.early) && <Load t={t} />}
        {between(t, S.early - 0.3, S.end + 0.2) && <Early t={t} />}
        <HostRig t={t} frame={frame} />
        {t >= S.end - 0.05 && <End t={t} />}
      </AbsoluteFill>
      {/* chromatic split on transitions */}
      {glitch > 0 && <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(32,242,255,0.08), transparent 30%, transparent 70%, rgba(254,164,56,0.08))`, mixBlendMode: 'screen' }} />}
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 4px)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.05, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - io(t, 0, 0.2, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};

export const _ = expo;
