import React from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { loadFont as loadDisplay } from '@remotion/google-fonts/Rajdhani';
import { loadFont as loadSans } from '@remotion/google-fonts/SpaceGrotesk';
import CARS from './cars.json';

export const DISPLAY = loadDisplay('normal', { weights: ['500', '600', '700'] }).fontFamily;
export const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'] }).fontFamily;

// Brand tokens lifted from ripcars.io's stylesheet.
export const C = {
  bg: '#08080B',
  surface: '#0C0C10',
  line: 'rgba(255,255,255,0.10)',
  line2: 'rgba(255,255,255,0.16)',
  white: '#F4F4F6',
  muted: 'rgba(255,255,255,0.55)',
  dim: 'rgba(255,255,255,0.32)',
  red: '#E0322F',
  red2: '#FF4A3D',
  orange: '#FF8A1F',
  cream: '#FFF1DA',
  green: '#1FDC85',
  blue: '#2E7BFF',
};
export const TIER: Record<string, string> = { Common: '#98989C', Uncommon: '#1FDC85', Rare: '#2E7BFF', Epic: '#B45CFF', Legendary: '#FFC531' };

export type CarKey = keyof typeof CARS;
export const car = (k: CarKey) => CARS[k];
export const carImg = (k: CarKey) => staticFile(`ripcars/cars/${k}.webp`);

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const inout = Easing.bezier(0.65, 0, 0.35, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

export const io = (t: number, a: number, b: number, from = 0, to = 1, easing = expo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const noise = (x: number, seed = 0) =>
  Math.sin(x * 1.31 + seed) * 0.5 + Math.sin(x * 2.17 + seed * 1.7) * 0.3 + Math.sin(x * 4.03 + seed * 2.3) * 0.2;

export const usd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Word-by-word masked reveal in the brand's condensed display face. */
export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties;
  weight?: number; accent?: string[]; accentColor?: string; italic?: boolean; font?: string; tracking?: number; upper?: boolean;
}> = ({ text, t, at, size, color = C.white, stagger = 0.06, style, weight = 700, accent = [], accentColor = C.red, italic, font = DISPLAY, tracking = 0.0, upper = true }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.24, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 0.98, letterSpacing: `${tracking}em`, textTransform: upper ? 'uppercase' : 'none', color, ...style }}>
    {text.split(' ').map((w, i) => {
      const s = at + i * stagger;
      const p = io(t, s, s + 0.55);
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.04}px ${size * 0.1}px`, margin: `0 ${-size * 0.04}px ${-size * 0.1}px` }}>
          <span style={{
            display: 'inline-block', transform: `translateY(${(1 - p) * 110}%) skewX(${italic ? -8 : 0}deg)`, opacity: Math.min(1, p * 1.8),
            color: accent.includes(w.replace(/[.,]/g, '')) ? accentColor : undefined,
          }}>{w}</span>
        </span>
      );
    })}
  </div>
);

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.red, style }) => {
  const p = io(t, at, at + 0.5);
  const n = Math.round(children.length * io(t, at, at + 0.45, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.24em', color, opacity: p, ...style }}>
      <div style={{ width: 36 * p, height: 3, background: color, boxShadow: `0 0 12px ${color}` }} />
      {children.slice(0, n)}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.red, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, border: `1px solid ${color}66`, background: `${color}1A`, color, fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: '0.04em', whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

export const LiveDot: React.FC<{ t: number; color?: string; size?: number }> = ({ t, color = C.green, size = 10 }) => {
  const p = (t * 1.3) % 1;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, background: color }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, border: `2px solid ${color}`, transform: `scale(${1 + p * 2.2})`, opacity: 1 - p }} />
    </span>
  );
};

export const SolanaMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 397 311">
    <defs>
      <linearGradient id="solg" x1="360" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    <path fill="url(#solg)" d="M64.6 237.9a14.5 14.5 0 0 1 10.3-4.3h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4l62.6-62.7zM64.6 3.8A14.9 14.9 0 0 1 74.9-.5h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4L64.6 3.8zM333.1 120.1a14.5 14.5 0 0 0-10.3-4.3H5.4c-6.5 0-9.7 7.8-5.1 12.4l62.7 62.7a14.5 14.5 0 0 0 10.3 4.3h317.4c6.5 0 9.7-7.8 5.1-12.4l-62.7-62.7z" />
  </svg>
);

export const Badge: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile('ripcars/logo.svg')} style={{ width: size, height: size, display: 'block', ...style }} />
);

/** Official lockup: chrome badge + condensed wordmark. */
export const Wordmark: React.FC<{ size: number; color?: string }> = ({ size, color = C.white }) => (
  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', color, lineHeight: 0.9 }}>
    RIP <span style={{ color: C.red }}>CARS</span>
  </span>
);

/** Reveal card: the real carded die-cast photo inside a tier-lit frame. */
export const CarCard: React.FC<{
  k: CarKey; w: number; t: number; glow?: number; info?: boolean; style?: React.CSSProperties; tierOverride?: string; sheen?: number;
}> = ({ k, w, t, glow = 1, info = true, style, tierOverride, sheen }) => {
  const c = car(k); const tier = tierOverride ?? c.tier; const col = TIER[tier] ?? C.red;
  const h = w * 1.42;
  const sh = sheen ?? ((t * 0.35) % 1.6);
  return (
    <div style={{
      width: w, height: h + (info ? w * 0.36 : 0), borderRadius: w * 0.07, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(180deg, ${col}26, rgba(12,12,16,0.96) 45%)`, border: `1.5px solid ${col}AA`,
      boxShadow: `0 0 ${60 * glow}px ${col}${Math.round(0x55 * glow).toString(16).padStart(2, '0')}, 0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)`,
      ...style,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: `radial-gradient(circle at 50% 45%, ${col}40, transparent 65%)` }} />
      <Img src={carImg(k)} style={{ position: 'absolute', left: w * 0.08, top: w * 0.07, width: w * 0.84, height: h - w * 0.1, objectFit: 'contain', filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.6))' }} />
      {info && (
        <div style={{ position: 'absolute', left: w * 0.08, right: w * 0.08, top: h, fontFamily: SANS }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: w * 0.05, fontWeight: 700, letterSpacing: '0.16em', color: col, textTransform: 'uppercase' }}>● {tier}</span>
            <span style={{ fontSize: w * 0.055, fontWeight: 600, color: C.white }}>{usd(c.price)}</span>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: w * 0.085, color: C.white, marginTop: w * 0.02, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{c.name.replace(/^HW /, '')}</div>
          <div style={{ fontSize: w * 0.042, color: C.muted, marginTop: w * 0.012, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.series}</div>
        </div>
      )}
      {/* holo sheen */}
      <div style={{ position: 'absolute', top: -h, bottom: -h, width: w * 0.5, left: -w + sh * w * 2.2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', transform: 'rotate(18deg)', mixBlendMode: 'screen' }} />
    </div>
  );
};

export const Icon: React.FC<{ name: 'vault' | 'cash' | 'ship' | 'shield' | 'chart' | 'check'; size?: number; color?: string }> = ({ name, size = 28, color = C.white }) => {
  const p: Record<string, React.ReactNode> = {
    vault: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="12" r="4.5" /><path d="M12 7.5V9M12 15v1.5M7.5 12H9M15 12h1.5" /></>,
    cash: <><rect x="2" y="6" width="20" height="12" rx="2.5" /><circle cx="12" cy="12" r="3" /><path d="M6 9.5v5M18 9.5v5" /></>,
    ship: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
    shield: <><path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    check: <path d="m5 12.5 4.5 4.5L19 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
};
