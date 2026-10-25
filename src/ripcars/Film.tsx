import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Host } from './Presenter';
import { Pack } from './Pack';
import {
  Badge, C, CarCard, CarKey, Chip, DISPLAY, Eyebrow, Icon, Kinetic, LiveDot, SANS, SolanaMark, TIER, Wordmark, backOut, car, carImg, expo, inout, io, noise, usd,
} from './ui';

const S = T.scenes;
const FPS = T.fps;

/** Absolute time of the first word in VO segment `seg` that starts with `text`. */
const w = (seg: number, text: string) => {
  const hit = T.vo[seg].words.find((x) => String(x[2]).toLowerCase().replace(/^[^a-z0-9$]+/, '').startsWith(text.toLowerCase()));
  if (!hit) throw new Error(`word ${text}`);
  return Number(hit[0]);
};
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;
const exitStyle = (t: number, end: number, dx = -1): React.CSSProperties => {
  const o = io(t, end - 0.3, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateX(${dx * o * 120}px) scale(${1 + o * 0.03})`, filter: o > 0.02 ? `blur(${o * 12}px)` : undefined };
};
const HERO: CarKey = 'skyline34';
const HOOK_CAR: CarKey = 'boneshaker';

/* ------------------------------ Background ------------------------------ */

const Background: React.FC<{ t: number }> = ({ t }) => {
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {/* red neon bars, as on the brand key art */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          position: 'absolute', left: 120 + i * 90 + noise(t * 0.2, i) * 30, top: -40, width: 18 + (i % 2) * 10, height: 1160,
          background: `linear-gradient(180deg, rgba(224,50,47,0) 0%, rgba(224,50,47,${0.32 * pulse}) 30%, rgba(224,50,47,${0.12 * pulse}) 70%, rgba(224,50,47,0) 100%)`,
          filter: 'blur(14px)', opacity: 0.6 + 0.4 * Math.sin(t * 1.3 + i),
        }} />
      ))}
      <div style={{ position: 'absolute', width: 1500, height: 1500, borderRadius: 1500, left: 600 + noise(t * 0.15, 3) * 200, top: -700, background: 'radial-gradient(circle, rgba(224,50,47,0.16), rgba(224,50,47,0) 60%)' }} />
      <div style={{ position: 'absolute', width: 1300, height: 900, borderRadius: 1300, left: 900 + noise(t * 0.13, 5) * 220, top: 500, background: 'radial-gradient(ellipse, rgba(255,138,31,0.07), rgba(255,138,31,0) 60%)' }} />
      {/* haze */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', width: 900, height: 360, borderRadius: 900, left: ((t * (30 + i * 12) + i * 700) % 2800) - 900, top: 700 + i * 90, background: 'radial-gradient(ellipse, rgba(255,255,255,0.045), rgba(255,255,255,0) 65%)', filter: 'blur(10px)' }} />
      ))}
      {/* glossy floor */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(224,50,47,0.05) 40%, rgba(0,0,0,0.6))' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 820, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
    </AbsoluteFill>
  );
};

const SpeedLines: React.FC<{ t: number; amt: number; seed?: number }> = ({ t, amt, seed = 1 }) => {
  if (amt <= 0.01) return null;
  return (
    <AbsoluteFill style={{ opacity: amt, pointerEvents: 'none' }}>
      {Array.from({ length: 26 }).map((_, i) => {
        const y = ((Math.sin(i * 91.7 + seed) + 1) / 2) * 1080;
        const len = 200 + ((i * 37) % 500);
        const x = ((t * (2600 + (i % 5) * 500) + i * 433) % 2800) - 600;
        return <div key={i} style={{ position: 'absolute', top: y, left: 1920 - x, width: len, height: i % 3 ? 2 : 3, background: `linear-gradient(90deg, rgba(255,255,255,0), ${i % 4 ? 'rgba(255,255,255,0.5)' : C.red2})` }} />;
      })}
    </AbsoluteFill>
  );
};

const Sparks: React.FC<{ t: number; at: number; x: number; y: number; n?: number; spread?: number; colors?: string[] }> = ({ t, at, x, y, n = 40, spread = 900, colors = ['#FFE2B0', C.orange, C.red2, '#fff'] }) => {
  const dt = t - at;
  if (dt < 0 || dt > 1.6) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.sin(i * 12.9) * 0.4;
        const v = spread * (0.35 + ((Math.sin(i * 78.2) + 1) / 2) * 0.65);
        const px = x + Math.cos(a) * v * dt * (1 - dt * 0.3);
        const py = y + Math.sin(a) * v * dt * (1 - dt * 0.3) + 500 * dt * dt;
        const o = Math.max(0, 1 - dt / 1.2);
        const sz = 3 + (i % 4) * 1.5;
        return <div key={i} style={{ position: 'absolute', left: px, top: py, width: sz * 3, height: sz, borderRadius: sz, background: colors[i % colors.length], opacity: o, transform: `rotate(${(a * 180) / Math.PI}deg)`, boxShadow: `0 0 10px ${colors[i % colors.length]}` }} />;
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------ Host rig ------------------------------ */

const K = {
  t: [0, 0.95, 1.65, 5.75, 6.25, 10.9, 11.4, 16.55, 17.05, 21.45, 21.95, 25.75, 26.35],
  x: [960, 960, 440, 440, 380, 380, 1560, 1560, 390, 390, 330, 330, 500],
  y: [70, 70, 30, 30, 40, 40, 40, 40, 40, 40, 70, 70, 20],
  s: [1.0, 1.0, 0.94, 0.94, 0.86, 0.86, 0.86, 0.86, 0.86, 0.86, 0.78, 0.78, 0.98],
  look: [0, 0, 0.9, 0.9, 0.9, 0.9, -0.9, -0.9, 0.9, 0.9, 0.9, 0.9, 0.6],
};
const kf = (t: number, arr: number[]) => interpolate(t, K.t, arr, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const sentenceStarts = T.vo.flatMap((v) => v.words.filter((x, i) => i === 0 || /[.,]$/.test(String(v.words[i - 1][2]))).map((x) => Number(x[0])));

const HostRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const x = kf(t, K.x), y = kf(t, K.y), s = kf(t, K.s);
  const intro = io(t, 0, 0.3, 0, 1, Easing.out(Easing.quad));
  const cam = Math.max(0, ...T.vo.map((v) => io(t, v.at - 0.25, v.at) * (1 - io(t, v.at + 0.9, v.at + 1.3))));
  const look = kf(t, K.look) * (1 - cam);
  const emphasis = Math.max(0, ...sentenceStarts.map((p) => (t >= p - 0.1 && t < p + 0.6 ? Math.sin(((t - p + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.open.length - 1, frame);
  const rip = io(t, T.rip, T.burst - 0.04, 0, 1, Easing.in(Easing.quad)) + io(t, T.burst + 0.2, T.burst + 0.6, 0, 1);
  const hold = 1 - io(t, T.burst + 0.25, T.burst + 0.8, 0, 1, Easing.in(Easing.cubic));
  const glow = io(t, T.rip + 0.15, T.burst, 0, 1) * (1 - io(t, T.burst + 0.3, T.burst + 0.8));
  const smile = 0.45 + io(t, T.vo[5].at + 2.5, T.vo[5].at + 3.0) * 0.5;
  const W = 800 * s, H = 1000 * s;
  return (
    <div style={{ position: 'absolute', left: x - W / 2, top: 1080 - H + y, width: W, height: H, opacity: intro }}>
      <div style={{ position: 'absolute', left: W * 0.1, top: H * 0.05, width: W * 0.8, height: W * 0.8, borderRadius: W, background: 'radial-gradient(circle, rgba(224,50,47,0.26), rgba(224,50,47,0) 65%)' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Host t={t} open={mouth.open[i]} wide={mouth.wide[i]} round={mouth.round[i]} smile={smile} emphasis={emphasis * 0.8} look={[look, 0.05]} hold={hold} rip={rip} packGlow={glow} />
      </div>
    </div>
  );
};

/* ------------------------------ 1. Hook ------------------------------ */

const HookBurst: React.FC<{ t: number }> = ({ t }) => {
  const b = T.burst;
  // card launches from the pack mouth toward camera
  const p = io(t, b, b + 0.5, 0, 1, Easing.in(Easing.cubic));
  const rise = io(t, b - 0.02, b + 0.22, 0, 1, Easing.out(Easing.cubic));
  const flash = io(t, b + 0.38, b + 0.5, 0, 1, Easing.linear) * (1 - io(t, b + 0.5, b + 0.95, 0, 1, Easing.out(Easing.quad)));
  const rays = io(t, b - 0.05, b + 0.1) * (1 - io(t, b + 0.45, b + 0.8));
  if (t > b + 1.0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* god rays from the pack */}
      <div style={{ position: 'absolute', left: 960 - 900, top: 720 - 900, width: 1800, height: 1800, opacity: rays * 0.8, transform: `rotate(${t * 20}deg)`, background: 'repeating-conic-gradient(from 0deg, rgba(255,214,150,0.22) 0deg 4deg, rgba(255,214,150,0) 4deg 16deg)', maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)' }} />
      {t > b - 0.02 && (
        <div style={{ position: 'absolute', left: 960 - 150, top: 700 - 213 - rise * 260 - p * 120, transform: `perspective(1200px) scale(${0.55 + rise * 0.45 + p * 4.5}) rotateY(${(1 - rise) * 160}deg) rotateZ(${(1 - rise) * -12}deg)`, opacity: 1 - io(t, b + 0.42, b + 0.52) }}>
          <CarCard k={HOOK_CAR} w={300} t={t} info={false} />
        </div>
      )}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(255,240,215,${flash}), rgba(255,120,60,${flash * 0.6}) 45%, rgba(224,50,47,${flash * 0.3}) 80%)` }} />
    </AbsoluteFill>
  );
};

const Floaters: React.FC<{ t: number; cars: CarKey[]; opacity: number }> = ({ t, cars, opacity }) => (
  <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
    {cars.map((k, i) => {
      const x = [1500, 1720, 1250][i % 3] + noise(t * 0.3, i) * 30;
      const y = [90, 540, 640][i % 3] + noise(t * 0.25, i + 4) * 24 - t * 6;
      const sc = [0.62, 0.5, 0.42][i % 3];
      return (
        <div key={k} style={{ position: 'absolute', left: x, top: y, transform: `scale(${sc}) rotate(${[-8, 10, -4][i % 3] + noise(t * 0.4, i) * 3}deg)`, filter: `blur(${[3, 5, 7][i % 3]}px)`, opacity: [0.35, 0.28, 0.22][i % 3] }}>
          <CarCard k={k} w={300} t={t} info={false} glow={0.5} />
        </div>
      );
    })}
  </AbsoluteFill>
);

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const a = w(0, 'rip'), b = w(0, 'world'), c = w(0, 'hot'), d = w(0, 'live');
  const lay = io(t, T.burst + 0.45, T.burst + 0.8);
  const badge = io(t, a - 0.15, a + 0.5, 0, 1, backOut);
  const solana = io(t, d - 0.05, d + 0.45);
  return (
    <AbsoluteFill style={exitStyle(t, S.flow)}>
      <Floaters t={t} cars={['gt3rs', 'skyline32', 'gasser']} opacity={lay} />
      <div style={{ position: 'absolute', left: 900, top: 250, width: 960, opacity: lay }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ transform: `scale(${badge}) rotate(${(1 - badge) * -200}deg)`, filter: 'drop-shadow(0 0 36px rgba(224,50,47,0.6))' }}><Badge size={170} /></div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 196, lineHeight: 0.86, letterSpacing: '0.01em', display: 'flex', gap: 30 }}>
            {['RIP', 'CARS'].map((word, i) => {
              const p = io(t, a + i * 0.16, a + 0.5 + i * 0.16);
              return <span key={word} style={{ display: 'inline-block', overflow: 'hidden', paddingRight: 8 }}><span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 105}%) skewX(-6deg)`, color: i ? C.red : C.white, textShadow: i ? '0 0 40px rgba(224,50,47,0.5)' : undefined }}>{word}</span></span>;
            })}
          </div>
        </div>
        <div style={{ height: 4, width: 900 * io(t, a + 0.3, a + 1.1), background: `linear-gradient(90deg, ${C.red}, ${C.orange}, transparent)`, marginTop: 30, boxShadow: `0 0 20px ${C.red}` }} />
        <Eyebrow t={t} at={b} style={{ marginTop: 40 }} color={C.cream}>THE WORLD'S FIRST</Eyebrow>
        <div style={{ marginTop: 16 }}><Kinetic t={t} at={c} size={112} text="Hot Wheels gacha" accent={['gacha']} stagger={0.17} /></div>
        <div style={{ marginTop: 36, opacity: solana, transform: `translateY(${(1 - solana) * 20}px)` }}>
          <Chip color={C.green} style={{ fontSize: 24, padding: '12px 22px', gap: 14 }}><LiveDot t={t} /> LIVE ON <SolanaMark size={30} /> SOLANA</Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 2. Flow (app) ------------------------------ */

const MACHINES = [
  { name: 'Starter Pack', price: 5, blurb: 'Five bucks and a real shot at a grail', tint: C.red },
  { name: 'Garage Pack', price: 20, blurb: 'Everyday chase at a friendly price', tint: C.orange },
  { name: 'Collector Pack', price: 50, blurb: 'Premium castings, RLC and chase cars', tint: C.blue },
  { name: 'Nitro Pack', price: 200, blurb: 'Top-shelf cars, some found nowhere else', tint: '#B45CFF' },
];

const Phone: React.FC<{ t: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ t, style, children }) => (
  <div style={{ position: 'absolute', width: 460, height: 940, borderRadius: 64, background: '#050507', border: '2px solid #2A2A31', boxShadow: '0 0 0 10px #121216, 0 0 0 11px #2A2A31, 0 60px 120px rgba(0,0,0,0.7), 0 0 80px rgba(224,50,47,0.18)', overflow: 'hidden', ...style }}>
    <div style={{ position: 'absolute', left: 175, top: 16, width: 110, height: 32, borderRadius: 20, background: '#000', zIndex: 5 }} />
    <div style={{ position: 'absolute', left: 30, right: 30, top: 66, display: 'flex', alignItems: 'center', gap: 10, zIndex: 4 }}>
      <Badge size={34} />
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, color: C.white }}>RIP <span style={{ color: C.red }}>CARS</span></span>
      <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 15, color: C.white, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}><SolanaMark size={16} /> 248.00 USDC</span>
    </div>
    {children}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'linear-gradient(125deg, rgba(255,255,255,0.07), transparent 30%)', pointerEvents: 'none' }} />
  </div>
);

const Flow: React.FC<{ t: number }> = ({ t }) => {
  const open = w(1, 'open'), pull = w(1, 'pull'), already = w(1, 'already'), vault = w(1, 'vault');
  const phoneIn = io(t, S.flow - 0.05, S.flow + 0.55);
  const tap = open + 0.75;
  const listOut = io(t, tap + 0.15, tap + 0.45, 0, 1, inout);
  const packIn = io(t, tap + 0.25, tap + 0.6);
  const ripP = io(t, pull - 0.15, pull + 0.18, 0, 1, Easing.in(Easing.quad));
  const reveal = io(t, pull + 0.2, pull + 0.75, 0, 1, backOut);
  const shake = t > tap + 0.5 && t < pull ? Math.sin(t * 60) * 4 * io(t, tap + 0.5, pull - 0.2) : 0;
  const toVault = io(t, already - 0.25, already + 0.35, 0, 1, inout);
  const vaultIn = io(t, already - 0.2, already + 0.4);
  const spin = io(t, already + 0.05, vault - 0.05, 0, 1, inout);
  const doorOpen = io(t, vault - 0.2, vault + 0.35, 0, 1, Easing.out(Easing.cubic));
  const slot = io(t, vault + 0.1, vault + 0.6);
  return (
    <AbsoluteFill style={exitStyle(t, S.options)}>
      <Eyebrow t={t} at={open - 0.1} style={{ position: 'absolute', left: 820, top: 70 }}>01 · RIP A DIGITAL PACK</Eyebrow>
      <Phone t={t} style={{ left: 840 - toVault * 70, top: 120 + (1 - phoneIn) * 200, opacity: phoneIn, transform: `perspective(1600px) rotateY(${-10 + toVault * 6}deg) scale(${1 - toVault * 0.06})` }}>
        {/* machine list */}
        <div style={{ position: 'absolute', left: 24, right: 24, top: 130, opacity: 1 - listOut, transform: `translateX(${-listOut * 80}px)` }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: C.white, textTransform: 'uppercase' }}>Pick your gacha</div>
          {MACHINES.map((m, i) => {
            const p = io(t, S.flow + 0.2 + i * 0.08, S.flow + 0.6 + i * 0.08);
            const sel = i === 1 ? io(t, open + 0.4, open + 0.6) : 0;
            return (
              <div key={m.name} style={{ marginTop: 16, height: 128, borderRadius: 20, position: 'relative', overflow: 'hidden', border: `1.5px solid ${sel ? C.red : C.line2}`, background: '#0E0E12', opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${1 + sel * 0.03})`, boxShadow: sel ? `0 0 30px ${C.red}66` : undefined }}>
                <Img src={staticFile('ripcars/hero-machine.webp')} style={{ position: 'absolute', right: -40, top: -20, height: 180, opacity: 0.55, objectFit: 'cover', filter: `hue-rotate(${i * 50}deg)` }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0E0E12 45%, rgba(14,14,18,0.2))' }} />
                <div style={{ position: 'absolute', left: 20, top: 18, fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, color: C.white, textTransform: 'uppercase' }}>{m.name}</div>
                <div style={{ position: 'absolute', left: 20, top: 56, fontFamily: SANS, fontSize: 14, color: C.muted, width: 230 }}>{m.blurb}</div>
                <div style={{ position: 'absolute', left: 20, bottom: 14, fontFamily: SANS, fontWeight: 700, fontSize: 20, color: m.tint }}>${m.price}</div>
              </div>
            );
          })}
          <div style={{ marginTop: 22, height: 64, borderRadius: 18, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, color: '#fff', letterSpacing: '0.04em', transform: `scale(${1 - Math.sin(io(t, tap - 0.1, tap + 0.1, 0, 1, Easing.linear) * Math.PI) * 0.05})`, boxShadow: `0 0 30px ${C.red}88` }}>OPEN PACK · $20</div>
        </div>
        {/* pack -> reveal */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150, height: 720, opacity: packIn, transform: `translateX(${(1 - packIn) * 120}px)` }}>
          <svg width={460} height={560} viewBox="0 0 460 560" style={{ position: 'absolute', left: 0, top: 30, opacity: 1 - io(t, pull + 0.25, pull + 0.45), transform: `translateX(${shake}px)` }}>
            <g transform="translate(75 60) scale(1.18)"><Pack id="phonepack" rip={ripP + io(t, pull + 0.2, pull + 0.4)} glow={io(t, pull - 0.1, pull + 0.2)} sheen={(t * 0.7) % 1.4} tint={C.orange} label="GARAGE PACK" /></g>
          </svg>
          {t > pull + 0.15 && (
            <div style={{ position: 'absolute', left: 80, top: 40, transform: `perspective(1200px) rotateY(${(1 - reveal) * 180}deg) scale(${0.6 + reveal * 0.4})`, opacity: Math.min(1, reveal * 3) }}>
              <CarCard k={HERO} w={300} t={t} />
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, color: C.white, opacity: io(t, pull + 0.6, pull + 0.9), textTransform: 'uppercase' }}>
            <span style={{ color: TIER.Epic }}>Epic pull!</span> Real car, yours.
          </div>
        </div>
      </Phone>
      <Sparks t={t} at={pull + 0.25} x={1060} y={430} colors={[TIER.Epic, '#E2C6FF', '#fff', C.orange]} />
      {/* vault */}
      <div style={{ position: 'absolute', left: 1330, top: 150, width: 520, height: 720, opacity: vaultIn, transform: `translateX(${(1 - vaultIn) * 120}px)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: 'linear-gradient(180deg, #16161B, #0A0A0D)', border: `1px solid ${C.line2}`, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.6)' }}>
          {/* shelves behind the door */}
          <div style={{ position: 'absolute', left: 40, top: 70, right: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {(['gt3rs', 'datsun', 'm3', 's2000', HERO, 'gasser'] as CarKey[]).map((k) => (
              <div key={k} style={{ height: 250, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,240,215,0.10), rgba(0,0,0,0.3))', border: `1px solid ${k === HERO ? TIER.Epic : C.line}`, position: 'relative', boxShadow: k === HERO ? `0 0 ${30 * slot}px ${TIER.Epic}` : undefined }}>
                <Img src={carImg(k)} style={{ position: 'absolute', inset: 10, width: 'calc(100% - 20px)', height: 'calc(100% - 20px)', objectFit: 'contain', opacity: k === HERO ? 0.3 + slot * 0.7 : 0.75 }} />
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, bottom: 40, opacity: slot, transform: `translateY(${(1 - slot) * 20}px)` }}>
            <div style={{ fontFamily: SANS, fontSize: 15, letterSpacing: '0.2em', color: C.muted }}>VAULT · SLOT A-0482</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: C.white, textTransform: 'uppercase', marginTop: 4 }}>{car(HERO).name.replace(' V-Spec II', '')}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <Chip color={C.green} style={{ fontSize: 15 }}><Icon name="shield" size={18} color={C.green} /> INSURED</Chip>
              <Chip color={C.cream} style={{ fontSize: 15 }}>OWNED BY YOU</Chip>
            </div>
          </div>
        </div>
        {/* door */}
        <div style={{ position: 'absolute', inset: 0, perspective: 1600 }}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '100% 50%', transform: `rotateY(${-doorOpen * 105}deg)`, opacity: 1 - io(t, vault + 0.25, vault + 0.5), borderRadius: 30, background: 'linear-gradient(135deg, #3A3A42, #17171C 50%, #2C2C33)', border: '2px solid #4A4A55', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)' }}>
            <svg width={420} height={420} viewBox="-210 -210 420 420">
              <defs>
                <linearGradient id="chrome" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#F2F2F5" /><stop offset="0.45" stopColor="#7A7A84" /><stop offset="0.55" stopColor="#C9C9D0" /><stop offset="1" stopColor="#4A4A52" /></linearGradient>
              </defs>
              <circle r={200} fill="url(#chrome)" />
              <circle r={178} fill="#1A1A1F" stroke="#5A5A64" strokeWidth={3} />
              {Array.from({ length: 16 }).map((_, i) => <circle key={i} cx={Math.cos((i / 16) * Math.PI * 2) * 189} cy={Math.sin((i / 16) * Math.PI * 2) * 189} r={6} fill="#2A2A30" stroke="#9A9AA5" />)}
              <circle r={120} fill="none" stroke="#3A3A42" strokeWidth={10} />
              <g transform={`rotate(${spin * 270})`}>
                {[0, 120, 240].map((a) => <g key={a} transform={`rotate(${a})`}><rect x={-9} y={-150} width={18} height={150} rx={9} fill="url(#chrome)" /><circle cy={-150} r={18} fill="url(#chrome)" /></g>)}
                <circle r={46} fill="url(#chrome)" stroke="#2A2A30" strokeWidth={4} />
                <circle r={20} fill={C.red} />
              </g>
            </svg>
            <div style={{ position: 'absolute', top: 30, fontFamily: SANS, fontSize: 15, letterSpacing: '0.3em', color: C.muted }}>INSURED VAULT</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 3. Options ------------------------------ */

const Options: React.FC<{ t: number }> = ({ t }) => {
  const keep = w(2, 'keep'), sell = w(2, 'sell'), ship = w(2, 'ship'), or = w(2, 'or');
  const cardIn = io(t, S.options - 0.05, S.options + 0.5);
  const buyback = car(HERO).price * 0.9;
  const opts = [
    { at: keep, icon: 'vault' as const, title: 'Keep it vaulted', sub: 'Free, insured storage for as long as you hold it', chip: 'FREE', color: C.green },
    { at: sell, icon: 'cash' as const, title: 'Sell it back', sub: '90% of market price, instantly · first week', chip: 'INSTANT', color: C.red },
    { at: or, icon: 'ship' as const, title: 'Ship to your shelf', sub: 'The real die-cast, delivered to your door', chip: 'COMING SOON', color: C.orange },
  ];
  const activeIdx = opts.filter((o) => t >= o.at - 0.1).length - 1;
  return (
    <AbsoluteFill style={exitStyle(t, S.trust, 1)}>
      <Eyebrow t={t} at={S.options + 0.1} style={{ position: 'absolute', left: 110, top: 90 }}>02 · YOUR CAR, YOUR CALL</Eyebrow>
      <div style={{ position: 'absolute', left: 110, top: 160, opacity: cardIn, transform: `perspective(1400px) rotateY(${(1 - cardIn) * 40 + 8}deg) translateX(${(1 - cardIn) * -80}px)` }}>
        <CarCard k={HERO} w={380} t={t} />
      </div>
      <div style={{ position: 'absolute', left: 560, top: 170, width: 640 }}>
        {opts.map((o, i) => {
          const p = io(t, o.at - 0.12, o.at + 0.4);
          const active = activeIdx === i ? 1 : 0;
          const done = activeIdx > i;
          const pre = io(t, S.options + 0.15 + i * 0.08, S.options + 0.55 + i * 0.08);
          return (
            <div key={i} style={{
              position: 'relative', height: 196, marginBottom: 24, borderRadius: 24, padding: '28px 30px', boxSizing: 'border-box',
              background: active ? `linear-gradient(120deg, ${o.color}26, rgba(14,14,18,0.95) 60%)` : 'rgba(14,14,18,0.85)',
              border: `1.5px solid ${p > 0.01 ? o.color + (active ? 'EE' : '66') : C.line2}`,
              boxShadow: active ? `0 0 50px ${o.color}55, 0 30px 60px rgba(0,0,0,0.5)` : '0 30px 60px rgba(0,0,0,0.4)',
              opacity: pre * (0.45 + 0.55 * Math.max(p, done ? 0.75 : 0)), transform: `translateX(${(1 - pre) * 60}px) scale(${1 + active * p * 0.03})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: `${o.color}22`, border: `1.5px solid ${o.color}88`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={o.icon} size={34} color={o.color} />
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, color: C.white, textTransform: 'uppercase', lineHeight: 1 }}>{o.title}</div>
                <Chip color={o.color} style={{ marginLeft: 'auto', fontSize: 15, padding: '6px 12px' }}>{o.chip}</Chip>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 21, color: C.muted, marginTop: 16, marginLeft: 84 }}>{o.sub}</div>
              {i === 1 && (
                <div style={{ position: 'absolute', right: 30, bottom: 22, fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.white, opacity: io(t, sell + 0.3, sell + 0.6) }}>
                  {usd(buyback * io(t, sell + 0.3, w(2, '90') + 0.5, 0, 1, Easing.out(Easing.cubic)))} <span style={{ fontSize: 16, color: C.muted, fontWeight: 500 }}>to your wallet</span>
                </div>
              )}
              {done && <div style={{ position: 'absolute', left: 30, top: 30, width: 64, height: 64, borderRadius: 18, background: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.95 }}><Icon name="check" size={34} color="#0B0B0D" /></div>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 4. Trust ------------------------------ */

const ODDS = [
  { tier: 'Common', p: 0.75, band: '$10.90 – $22' },
  { tier: 'Uncommon', p: 0.2, band: '$22 – $40' },
  { tier: 'Rare', p: 0.04, band: '$40 – $75' },
  { tier: 'Epic', p: 0.01, band: '$75 – $650' },
];

const Seal: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const p = io(t, at, at + 0.3, 0, 1, Easing.in(Easing.cubic));
  const text = 'AUTHENTICITY GUARANTEED · 100% REAL DIE-CAST · ';
  return (
    <div style={{ width: 250, height: 250, opacity: p > 0 ? Math.min(1, p * 2) : 0, transform: `scale(${2.2 - p * 1.2}) rotate(${-14 + (1 - p) * 20}deg)` }}>
      <svg viewBox="-125 -125 250 250" width={250} height={250}>
        <defs><path id="sealpath" d="M0,-92 a92,92 0 1,1 -0.1,0" /></defs>
        <circle r={120} fill="#0E0E12" stroke={C.green} strokeWidth={4} />
        <circle r={78} fill="none" stroke={`${C.green}88`} strokeWidth={2} strokeDasharray="4 6" />
        <g transform={`rotate(${t * 25})`}>
          <text fontFamily={SANS} fontWeight={700} fontSize={17} letterSpacing="2.6" fill={C.green}><textPath href="#sealpath">{text}</textPath></text>
        </g>
        <g transform="translate(-34 -38) scale(2.85)"><path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z" fill={`${C.green}22`} stroke={C.green} strokeWidth={1.6} /><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke={C.green} strokeWidth={2} strokeLinecap="round" /></g>
      </svg>
    </div>
  );
};

const Trust: React.FC<{ t: number }> = ({ t }) => {
  const pub = w(3, 'published'), auth = w(3, 'guaranteed'), noth = w(3, 'nothing');
  const bar = io(t, pub + 0.15, pub + 1.1, 0, 1, Easing.out(Easing.cubic));
  const panel = io(t, S.trust - 0.05, S.trust + 0.5);
  const row = io(t, noth - 0.15, noth + 0.4);
  let acc = 0;
  return (
    <AbsoluteFill style={exitStyle(t, S.thrill)}>
      <div style={{ position: 'absolute', left: 820, top: 80 }}>
        <Eyebrow t={t} at={S.trust}>03 · WHY IT'S SAFE</Eyebrow>
        <div style={{ marginTop: 18 }}><Kinetic t={t} at={pub} size={92} text="The odds are on the wall" accent={['wall']} stagger={0.08} /></div>
      </div>
      <div style={{ position: 'absolute', left: 820, top: 300, width: 840, height: 300, borderRadius: 26, background: 'linear-gradient(180deg, rgba(22,22,28,0.95), rgba(10,10,13,0.95))', border: `1px solid ${C.line2}`, padding: 34, boxSizing: 'border-box', opacity: panel, transform: `translateY(${(1 - panel) * 40}px)`, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 18, color: C.muted, letterSpacing: '0.14em' }}>
          <span style={{ color: C.white, fontWeight: 600 }}>PUBLISHED ODDS</span><span>GARAGE PACK · PER PULL</span>
        </div>
        <div style={{ display: 'flex', height: 26, borderRadius: 13, overflow: 'hidden', marginTop: 24, background: 'rgba(255,255,255,0.05)' }}>
          {ODDS.map((o) => <div key={o.tier} style={{ width: `${o.p * 100 * bar}%`, minWidth: bar > 0.9 ? 8 : 0, background: TIER[o.tier], boxShadow: `0 0 16px ${TIER[o.tier]}` }} />)}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 28 }}>
          {ODDS.map((o, i) => {
            const p = io(t, pub + 0.3 + i * 0.1, pub + 0.7 + i * 0.1);
            acc += o.p;
            return (
              <div key={o.tier} style={{ flex: 1, borderRadius: 16, border: `1px solid ${TIER[o.tier]}55`, background: `${TIER[o.tier]}10`, padding: '16px 18px', opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 48, color: TIER[o.tier], lineHeight: 1 }}>{Math.round(o.p * 100 * p)}%</div>
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, color: C.white, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{o.tier}</div>
                <div style={{ fontFamily: SANS, fontSize: 15, color: C.muted, marginTop: 2 }}>{o.band}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1650, top: 320 }}><Seal t={t} at={auth} /></div>
      {/* every car already in the vault */}
      <div style={{ position: 'absolute', left: 820, top: 640, width: 1000, opacity: row }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, color: C.white, textTransform: 'uppercase' }}>
          Nothing minted out of <span style={{ color: C.red }}>thin air</span>
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 20 }}>
          {(['mclaren', 'porsche935', 'essenza', 'diablo', 'audi', 'gt40'] as CarKey[]).map((k, i) => {
            const p = io(t, noth + 0.1 + i * 0.07, noth + 0.5 + i * 0.07);
            const tag = io(t, noth + 0.5 + i * 0.07, noth + 0.75 + i * 0.07, 0, 1, backOut);
            return (
              <div key={k} style={{ width: 150, height: 196, borderRadius: 14, position: 'relative', background: 'linear-gradient(180deg, rgba(255,240,215,0.08), rgba(0,0,0,0.3))', border: `1px solid ${C.line2}`, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
                <Img src={carImg(k)} style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', left: 10, bottom: -14, transform: `scale(${tag})` }}><Chip color={C.green} style={{ fontSize: 12, padding: '4px 9px', background: '#08160F' }}>✓ IN VAULT</Chip></div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5. Thrill ------------------------------ */

const PACKS = [
  { label: 'STARTER · $5', tint: C.red },
  { label: 'GARAGE · $20', tint: C.orange },
  { label: 'COLLECTOR · $50', tint: C.blue },
  { label: 'NITRO · $200', tint: '#B45CFF' },
];
const REEL: CarKey[] = ['gt3rs', 'roxy', 'skyline32', 'kombi', 'm3', 'essenza', 'boneshaker', 's2000', '4runner', 'gt2', 'datsun', 'gasser'];

const Thrill: React.FC<{ t: number }> = ({ t }) => {
  const packs = w(4, 'packs'), one = w(4, 'one'), real = w(4, 'real');
  const priceOut = io(t, one - 0.3, one, 0, 1, inout);
  const reelIn = io(t, one - 0.2, one + 0.3);
  const beat = 60 / 124;
  const scroll = (t - (one - 0.2)) / beat; // one card per beat
  return (
    <AbsoluteFill>
      {/* $5 + fanned packs */}
      <div style={{ position: 'absolute', left: 700, top: 150, opacity: 1 - priceOut, transform: `translateY(${-priceOut * 60}px)` }}>
        <Eyebrow t={t} at={packs - 0.05} color={C.cream}>PACKS FROM</Eyebrow>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 400, lineHeight: 0.85, color: C.white, textShadow: `0 0 80px ${C.red}88`, transform: `scale(${io(t, w(4, '$5') - 0.1, w(4, '$5') + 0.35, 1.3, 1, backOut)})`, transformOrigin: '0 50%', opacity: io(t, w(4, '$5') - 0.12, w(4, '$5') + 0.1) }}>
          <span style={{ color: C.red, fontSize: 260, verticalAlign: 'top' }}>$</span>5
        </div>
        <div style={{ fontFamily: SANS, fontSize: 24, color: C.muted, marginTop: 10, opacity: io(t, w(4, '$5') + 0.2, w(4, '$5') + 0.6) }}>Real vaulted inventory behind every machine.</div>
      </div>
      <div style={{ position: 'absolute', left: 1250, top: 230, width: 600, height: 600, opacity: 1 - priceOut }}>
        {PACKS.map((p, i) => {
          const f = io(t, packs + 0.1 + i * 0.08, packs + 0.6 + i * 0.08, 0, 1, backOut);
          const ang = (i - 1.5) * 13 * f;
          return (
            <svg key={i} width={300} height={420} viewBox="0 0 260 380" style={{ position: 'absolute', left: 150 + (i - 1.5) * 80 * f, top: 40 + Math.abs(i - 1.5) * 18 * f, transform: `rotate(${ang}deg)`, transformOrigin: '50% 100%', opacity: Math.min(1, f * 2), filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.6))' }}>
              <g transform="translate(0 10)"><Pack id={`fan${i}`} tint={p.tint} label={p.label} sheen={(t * 0.6 + i * 0.3) % 1.4} /></g>
            </svg>
          );
        })}
      </div>
      {/* reel of real pulls */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, height: 640, opacity: reelIn * (1 - io(t, S.end - 0.2, S.end)) }}>
        {REEL.map((k, i) => {
          const pos = i - scroll; // 0 = center
          if (pos < -1.6 || pos > 3.5) return null;
          const x = 1130 + pos * 300;
          const flip = io(-pos, -0.6, 0, 0, 1, Easing.inOut(Easing.cubic));
          const center = Math.max(0, 1 - Math.abs(pos));
          return (
            <div key={k} style={{ position: 'absolute', left: x - 150, top: 40 - center * 30, transform: `perspective(1200px) rotateY(${(1 - flip) * 180 + pos * -18}deg) scale(${0.72 + center * 0.3})`, opacity: Math.min(1, 1.2 - Math.abs(pos) * 0.25) * io(pos, -1.5, -0.9), zIndex: 10 - Math.round(Math.abs(pos)) }}>
              {flip > 0.5 ? (
                <CarCard k={k} w={300} t={t} glow={center} />
              ) : (
                <div style={{ transform: 'scaleX(-1)' }}><svg width={300} height={426} viewBox="0 0 260 370"><Pack id={`reel${i}`} tint={[C.red, C.orange, C.blue, '#B45CFF'][i % 4]} /></svg></div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 700, top: 90, display: 'flex', gap: 40, opacity: reelIn }}>
        <Kinetic t={t} at={one} size={110} text="One pull." stagger={0.1} />
        <Kinetic t={t} at={real - 0.1} size={110} text="One real car." accent={['real']} stagger={0.1} />
      </div>
      <SpeedLines t={t} amt={io(t, S.end - 1.4, S.end - 0.2) * (1 - io(t, S.end, S.end + 0.2))} seed={3} />
    </AbsoluteFill>
  );
};

/* ------------------------------ 6. End ------------------------------ */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end;
  const rip = w(5, 'rip'), reveal = w(5, 'reveal');
  const flash = io(t, s0 + 0.05, s0 + 0.12, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.12, s0 + 0.9, 0, 1, Easing.out(Easing.quad)));
  const badge = io(t, s0 + 0.15, s0 + 0.85, 0, 1, backOut);
  const url = io(t, reveal + 1.1, reveal + 1.6);
  const sweep = io(t, reveal + 0.9, reveal + 1.9, 0, 1, inout);
  const fade = io(t, 29.5, 30, 0, 1, Easing.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - fade }}>
      <Sparks t={t} at={s0 + 0.1} x={1350} y={300} n={60} spread={1300} />
      <div style={{ position: 'absolute', left: 960, top: 150, width: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ transform: `scale(${badge}) rotate(${(1 - badge) * 300}deg)`, filter: 'drop-shadow(0 0 40px rgba(224,50,47,0.7))' }}><Badge size={150} /></div>
          <div style={{ opacity: io(t, s0 + 0.3, s0 + 0.7), transform: `translateX(${(1 - io(t, s0 + 0.3, s0 + 0.8)) * -30}px)` }}><Wordmark size={120} /></div>
        </div>
        <div style={{ position: 'relative', marginTop: 50 }}>
          <Kinetic t={t} at={rip} size={128} text="Rip the pack." stagger={0.12} />
          <div style={{ marginTop: 6 }}><Kinetic t={t} at={reveal} size={128} text="Reveal your" stagger={0.14} /></div>
          <div style={{ marginTop: 6 }}><Kinetic t={t} at={w(5, 'dream')} size={128} text="dream car." color={C.red} stagger={0.12} style={{ textShadow: '0 0 50px rgba(224,50,47,0.45)' }} /></div>
          <div style={{ position: 'absolute', inset: -20, overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'overlay' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 180, left: -220 + sweep * 1200, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)', transform: 'skewX(-20deg)' }} />
          </div>
        </div>
        <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 22, opacity: url, transform: `translateY(${(1 - url) * 16}px)` }}>
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: C.white, letterSpacing: '0.02em' }}>ripcars.io</span>
          <Chip color={C.green}><LiveDot t={t} /> Live on Solana · Packs from $5</Chip>
        </div>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(255,240,220,${flash}), rgba(224,50,47,${flash * 0.6}) 55%, rgba(8,8,11,${flash * 0.2}) 90%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ Film ------------------------------ */

export const RipCarsFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const lines = Math.max(...[S.flow, S.options, S.trust, S.thrill].map((s) => io(t, s - 0.35, s - 0.1) * (1 - io(t, s, s + 0.3))));
  // subtle camera drift + punch-ins on hits
  const punch = [T.burst, S.end + 0.1].reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 6) * 0.025 : 0), 0);
  const shake = [T.burst, S.end + 0.1].reduce((a, h) => a + (t > h && t < h + 0.4 ? Math.exp(-(t - h) * 10) * 9 : 0), 0);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <Audio src={staticFile('ripcars/mix.wav')} />
      <AbsoluteFill style={{ transform: `scale(${1.02 + punch + Math.sin(t * 0.3) * 0.006}) translate(${noise(t * 25, 1) * shake}px, ${noise(t * 23, 2) * shake}px)` }}>
        <Background t={t} />
        {between(t, 0, S.flow) && t > T.burst + 0.3 && <Hook t={t} />}
        {between(t, S.flow - 0.3, S.options) && <Flow t={t} />}
        {between(t, S.options - 0.3, S.trust) && <Options t={t} />}
        {between(t, S.trust - 0.3, S.thrill) && <Trust t={t} />}
        {between(t, S.thrill - 0.3, S.end + 0.2) && <Thrill t={t} />}
        <HostRig t={t} frame={frame} />
        {t < T.burst + 1.05 && <HookBurst t={t} />}
        <Sparks t={t} at={T.burst} x={960} y={720} n={50} spread={1100} />
        {t >= S.end - 0.05 && <End t={t} />}
        <SpeedLines t={t} amt={lines * 0.8} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.06, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - io(t, 0, 0.25, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};
