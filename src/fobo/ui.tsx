import React from 'react';
import { Easing, interpolate } from 'remotion';
import { loadFont as loadHead } from '@remotion/google-fonts/BarlowCondensed';
import { loadFont as loadSans } from '@remotion/google-fonts/Geist';
import { loadFont as loadMono } from '@remotion/google-fonts/GeistMono';

// Brand type from the FOBO litepaper: Barlow Condensed headlines, Geist body.
export const HEAD = loadHead('normal', { weights: ['500', '600', '700'] }).fontFamily;
export const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '500'] }).fontFamily;

// Sampled from fobo.fun: #5CFFE4 face, #080B0D / #171D21 surfaces, green buys / red sells.
export const C = {
  bg: '#06090B',
  bg2: '#080B0D',
  panel: '#171D21',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.13)',
  white: '#F2F7F7',
  muted: 'rgba(242,247,247,0.55)',
  dim: 'rgba(242,247,247,0.3)',
  cyan: '#5CFFE4',
  cyanDeep: '#16A893',
  buy: '#3FE39A',
  sell: '#FF4D5E',
  pink: '#FF5FA2',
};

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const inout = Easing.bezier(0.65, 0, 0.35, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

export const io = (t: number, a: number, b: number, from = 0, to = 1, easing = expo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const noise = (x: number, seed = 0) =>
  Math.sin(x * 1.31 + seed) * 0.5 + Math.sin(x * 2.17 + seed * 1.7) * 0.3 + Math.sin(x * 4.03 + seed * 2.3) * 0.2;

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const fmtUsd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : `$${v.toFixed(2)}`;

/* ------------------------------ Pixel face ------------------------------ */

type Px = [number, number, number?]; // x, y, intensity
const row = (y: number, x0: number, x1: number, a = 1): Px[] => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y, a]);
const roundEye = (x0: number, dy = 0): Px[] => [...row(dy, x0 + 1, x0 + 3), ...row(1 + dy, x0, x0 + 4), ...row(2 + dy, x0, x0 + 4), ...row(3 + dy, x0, x0 + 4), ...row(4 + dy, x0 + 1, x0 + 3)];
const dashEye = (x0: number, dy = 0): Px[] => row(2 + dy, x0, x0 + 4);
const happyEye = (x0: number): Px[] => [[x0, 3], [x0 + 1, 2], [x0 + 2, 1.6], [x0 + 3, 2], [x0 + 4, 3]];
const heartEye = (x0: number): Px[] => [[x0, 1], [x0 + 1, 0.5], [x0 + 3, 0.5], [x0 + 4, 1], ...row(1.5, x0, x0 + 4), ...row(2.5, x0 + 0.5, x0 + 3.5).map(([x, y]) => [x, y, 1] as Px).slice(0, 4), [x0 + 1.5, 3.5], [x0 + 2.5, 3.5], [x0 + 2, 4.3]];

export type Expr = 'normal' | 'wink' | 'blink' | 'happy' | 'heart' | 'up';
const EYES: Record<Expr, Px[]> = {
  normal: [...roundEye(0), ...roundEye(10)],
  wink: [...roundEye(0), ...dashEye(10)], // the official logo
  blink: [...dashEye(0), ...dashEye(10)],
  happy: [...happyEye(0), ...happyEye(10)],
  heart: [...heartEye(0), ...heartEye(10)].map(([x, y, a]) => [x, y, a ?? 1] as Px),
  up: [...roundEye(0, -0.6), ...roundEye(10, -0.6)],
};

// Pixel visemes, origin at the logo's smile (x 5..9, y 6.4). R is the exact logo smile.
const MY = 6.4;
const D = 0.32; // dim "mouth interior" LEDs
const VISEMES: Record<string, Px[]> = {
  R: [[5, 0], [9, 0], [6, 1], [7, 1], [8, 1]],
  X: row(0.8, 5, 9),
  M: row(0.8, 4, 10),
  a: [...row(0, 5, 9), [5, 1], [9, 1], ...row(1, 6, 8, D), ...row(2, 6, 8)],
  A: [...row(-0.4, 5, 9), [4, 0.6], [10, 0.6], [4, 1.6], [10, 1.6], ...row(0.6, 5, 9, D), ...row(1.6, 5, 9, D), ...row(2.6, 5, 9)],
  E: [...row(0, 4, 10), [3.6, 1], [10.4, 1], ...row(1, 4.6, 9.4, D).slice(0, 5), ...row(2, 5, 9)],
  O: [...row(-0.2, 6, 8), [5, 0.8], [9, 0.8], [5, 1.8], [9, 1.8], ...row(0.8, 6, 8, D), ...row(1.8, 6, 8, D), ...row(2.8, 6, 8)],
  U: [...row(0.2, 6, 8), [6, 1.2], [8, 1.2], [7, 1.2, D], ...row(2.2, 6, 8)],
  F: [...row(0.2, 5, 9), ...row(1.2, 6, 8)],
  S: [...row(0.4, 4, 10), ...row(1.4, 5, 9, 0.5)],
  L: [...row(0, 5, 9), [5, 1], [9, 1], [6, 1, D], [8, 1, D], [7, 1], ...row(2, 6, 8)],
  K: [...row(0.2, 5, 9), ...row(1.2, 5, 9, D)],
};

/** The FOBO LED face, drawn on the official logo's pixel grid (15 x 8.4 units). */
export const PixelFace: React.FC<{
  unit: number; expr?: Expr; vis?: string; ghost?: string; glow?: number; boot?: number; color?: string; lookX?: number; showMouth?: boolean;
}> = ({ unit, expr = 'wink', vis = 'R', ghost, glow = 1, boot = 1, color = C.cyan, lookX = 0, showMouth = true }) => {
  const eyes = EYES[expr];
  const mouth = showMouth ? VISEMES[vis] ?? VISEMES.R : [];
  const ghostPx = showMouth && ghost && ghost !== vis ? VISEMES[ghost] ?? [] : [];
  const pad = 2.2;
  const W = 15 + pad * 2, H = 10.6 + pad * 2;
  const cell = (x: number, y: number, a: number, k: string, i: number, op = 1) => {
    const on = hash(i * 7.13 + (k === 'm' ? 50 : 0)) < boot || boot >= 1;
    if (!on) return null;
    return <rect key={`${k}${i}`} x={(x + pad) * unit + unit * 0.04} y={(y + pad) * unit + unit * 0.04} width={unit * 0.92} height={unit * 0.92} rx={unit * 0.12} fill={color} opacity={a * op} />;
  };
  return (
    <svg width={W * unit} height={H * unit} viewBox={`0 0 ${W * unit} ${H * unit}`} style={{ overflow: 'visible', display: 'block' }}>
      <g style={{ filter: `drop-shadow(0 0 ${unit * 0.45 * glow}px ${color}) drop-shadow(0 0 ${unit * 1.4 * glow}px ${color}88)` }} transform={`translate(${lookX * unit} 0)`}>
        {eyes.map(([x, y, a], i) => cell(x, y, a ?? 1, 'e', i))}
        {ghostPx.map(([x, y, a], i) => cell(x, y + MY, a ?? 1, 'g', i, 0.28))}
        {mouth.map(([x, y, a], i) => cell(x, y + MY, a ?? 1, 'm', i))}
      </g>
    </svg>
  );
};

/** Wordmark: pixel face + "FOBO" set in Barlow Condensed with litepaper-wide tracking. */
export const Wordmark: React.FC<{ height: number; t: number; at?: number; expr?: Expr; glow?: number }> = ({ height, t, at = 0, expr = 'wink', glow = 1 }) => {
  const unit = height / 9;
  const p = io(t, at, at + 0.9);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.32 }}>
      <PixelFace unit={unit} expr={expr} boot={io(t, at, at + 0.6, 0, 1, Easing.linear)} glow={glow} />
      <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: height * 1.25, lineHeight: 1, letterSpacing: `${0.16 + (1 - p) * 0.3}em`, color: C.white, opacity: p, textShadow: `0 0 ${height * 0.25}px rgba(92,255,228,0.25)` }}>FOBO</div>
    </div>
  );
};

/* ------------------------------ Type + chrome ------------------------------ */

export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties;
  accent?: string[]; tracking?: number; weight?: number; font?: string; upper?: boolean;
}> = ({ text, t, at, size, color = C.white, stagger = 0.06, style, accent = [], tracking = 0.04, weight = 600, font = HEAD, upper = true }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.24, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 0.98, letterSpacing: `${tracking}em`, textTransform: upper ? 'uppercase' : 'none', color, ...style }}>
    {text.split(' ').map((w, i) => {
      const s = at + i * stagger;
      const p = io(t, s, s + 0.6);
      const acc = accent.includes(w.replace(/[.,]/g, ''));
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.06}px ${size * 0.12}px`, margin: `0 ${-size * 0.06}px ${-size * 0.12}px` }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 1.8), color: acc ? C.cyan : undefined, textShadow: acc ? `0 0 ${size * 0.35}px rgba(92,255,228,0.55)` : undefined }}>{w}</span>
        </span>
      );
    })}
  </div>
);

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.cyan, style }) => {
  const p = io(t, at, at + 0.5);
  const n = Math.round(children.length * io(t, at, at + 0.4, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: HEAD, fontWeight: 600, fontSize: 22, letterSpacing: '0.32em', color, opacity: p, ...style }}>
      <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.1em', color: C.dim }}>//</span>
      {children.slice(0, n)}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.cyan, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 15px', borderRadius: 10, border: `1px solid ${color}4D`, background: `${color}12`, color, fontFamily: SANS, fontWeight: 600, fontSize: 17, whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

export const LiveDot: React.FC<{ t: number; color?: string; size?: number }> = ({ t, color = C.buy, size = 9 }) => {
  const p = (t * 1.3) % 1;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, background: color }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, border: `2px solid ${color}`, transform: `scale(${1 + p * 2.2})`, opacity: 1 - p }} />
    </span>
  );
};

/** fobo.fun-style surface: #171D21 card, hairline rim, soft cyan bloom. */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: number; color?: string; radius?: number }> = ({ style, children, glow = 0.35, color = C.cyan, radius = 18 }) => (
  <div style={{ position: 'absolute', borderRadius: radius, padding: 1, background: `linear-gradient(160deg, ${color}66, rgba(255,255,255,0.07) 32%, rgba(255,255,255,0.03) 70%, ${color}33)`, boxShadow: `0 0 ${60 * glow}px ${color}22, 0 40px 80px rgba(0,0,0,0.65)`, ...style }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radius - 1, background: 'linear-gradient(180deg, #161C20, #0D1215)', overflow: 'hidden' }}>{children}</div>
  </div>
);

/** Token avatars echo fobo.fun's generated pixel avatars. */
const AV = ['#5CFFE4', '#FF5FA2', '#FFD15C', '#8C7CFF', '#3FE39A', '#FF8A4C'];
export const Avatar: React.FC<{ seed: number; size?: number; face?: boolean }> = ({ seed, size = 40, face = false }) => {
  const c = AV[seed % AV.length];
  if (face) {
    return (
      <div style={{ width: size, height: size, borderRadius: size, background: '#0B0F12', boxShadow: `inset 0 0 0 1px ${C.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PixelFace unit={size / 30} glow={0.4} />
      </div>
    );
  }
  const cells = Array.from({ length: 25 }, (_, i) => hash(seed * 31 + (i % 5 < 3 ? i : i - 2 * ((i % 5) - 2))) > 0.5);
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: '#141A1E', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: size * 0.18, gap: 0, flexShrink: 0, boxShadow: `inset 0 0 0 1px ${C.line2}` }}>
      {cells.map((on, i) => <div key={i} style={{ background: on ? c : 'transparent' }} />)}
    </div>
  );
};

/** Quote-asset glyphs for the pairing picker. */
const QA: Record<string, { bg: string; fg: string; t: string }> = {
  ETH: { bg: '#627EEA', fg: '#fff', t: 'Ξ' }, USDG: { bg: '#E9F7EF', fg: '#0B7A4B', t: '$' },
  TSLA: { bg: '#E82127', fg: '#fff', t: 'T' }, MSFT: { bg: '#00A4EF', fg: '#fff', t: 'M' }, NVDA: { bg: '#76B900', fg: '#fff', t: 'N' },
  AAPL: { bg: '#E6E6E6', fg: '#111', t: 'A' }, GOOGL: { bg: '#FFFFFF', fg: '#4285F4', t: 'G' }, AMZN: { bg: '#FF9900', fg: '#111', t: 'a' },
  META: { bg: '#0866FF', fg: '#fff', t: '∞' }, SPCX: { bg: '#111', fg: '#fff', t: 'X' },
};
export const Quote: React.FC<{ sym: string; size?: number }> = ({ sym, size = 40 }) => {
  if (sym === 'FOBO') return <Avatar seed={0} size={size} face />;
  const q = QA[sym];
  return <div style={{ width: size, height: size, borderRadius: size, background: q.bg, color: q.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: size * 0.5, flexShrink: 0, boxShadow: '0 0 0 2px rgba(0,0,0,0.5)' }}>{q.t}</div>;
};
