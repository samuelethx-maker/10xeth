import React from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { loadFont as loadDisplay } from '@remotion/google-fonts/ChakraPetch';
import { loadFont as loadSans } from '@remotion/google-fonts/Inter';

export const DISPLAY = loadDisplay('normal', { weights: ['500', '600', '700'] }).fontFamily;
export const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'] }).fontFamily;

// Sampled from the official Loadout logo: neon cyan outline + warm orange/cream "O".
export const C = {
  bg: '#05070B',
  panel: '#0B1018',
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.14)',
  white: '#F2F6FA',
  muted: 'rgba(242,246,250,0.56)',
  dim: 'rgba(242,246,250,0.32)',
  cyan: '#20F2FF',
  cyan2: '#0CC9E6',
  cyanDeep: '#13A9CC',
  orange: '#FEA438',
  cream: '#FFE9B0',
  green: '#3BE38B',
  red: '#FF5A6A',
};

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const inout = Easing.bezier(0.65, 0, 0.35, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

export const io = (t: number, a: number, b: number, from = 0, to = 1, easing = expo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const noise = (x: number, seed = 0) =>
  Math.sin(x * 1.31 + seed) * 0.5 + Math.sin(x * 2.17 + seed * 1.7) * 0.3 + Math.sin(x * 4.03 + seed * 2.3) * 0.2;

export const rand = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

export const walk = (seed: number, n: number, vol = 0.03, drift = 0.01) => {
  const r = rand(seed); let v = 1; const out: number[] = [];
  for (let i = 0; i < n; i++) { v *= 1 + (r() - 0.5) * 2 * vol + drift; out.push(v); }
  return out;
};

export const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Neon flicker: returns 0..1 brightness, flickering in from `at`. */
export const flicker = (t: number, at: number) => {
  const d = t - at;
  if (d < 0) return 0;
  if (d < 0.06) return 0.9;
  if (d < 0.12) return 0.15;
  if (d < 0.18) return 1;
  if (d < 0.22) return 0.35;
  return Math.min(1, 0.6 + d * 4);
};

/** Official logo raster; its black backdrop drops out with screen blending. */
export const Logo: React.FC<{ size: number; glow?: number; style?: React.CSSProperties }> = ({ size, glow = 1, style }) => (
  <div style={{ position: 'relative', width: size, height: size, ...style }}>
    <Img src={staticFile('loadout/logo.png')} style={{ position: 'absolute', inset: 0, width: size, height: size, filter: `drop-shadow(0 0 ${18 * glow}px rgba(32,242,255,${0.55 * glow})) brightness(${0.4 + glow * 0.75})` }} />
  </div>
);

export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties;
  weight?: number; accent?: string[]; accentColor?: string; font?: string; upper?: boolean; tracking?: number;
}> = ({ text, t, at, size, color = C.white, stagger = 0.06, style, weight = 700, accent = [], accentColor = C.cyan, font = DISPLAY, upper = true, tracking = 0.01 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.0, letterSpacing: `${tracking}em`, textTransform: upper ? 'uppercase' : 'none', color, ...style }}>
    {text.split(' ').map((w, i) => {
      const s = at + i * stagger;
      const p = io(t, s, s + 0.55);
      const isAcc = accent.includes(w.replace(/[.,]/g, ''));
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.05}px ${size * 0.12}px`, margin: `0 ${-size * 0.05}px ${-size * 0.12}px` }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 1.8), color: isAcc ? accentColor : undefined, textShadow: isAcc ? `0 0 28px ${accentColor}88` : undefined }}>{w}</span>
        </span>
      );
    })}
  </div>
);

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.cyan, style }) => {
  const p = io(t, at, at + 0.5);
  const n = Math.round(children.length * io(t, at, at + 0.45, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: DISPLAY, fontWeight: 600, fontSize: 21, letterSpacing: '0.24em', color, opacity: p, ...style }}>
      <div style={{ width: 34 * p, height: 3, background: color, boxShadow: `0 0 12px ${color}` }} />
      {children.slice(0, n)}
      <span style={{ opacity: n < children.length || Math.floor(t * 3) % 2 ? 1 : 0 }}>_</span>
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.cyan, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 8, border: `1px solid ${color}66`, background: `${color}14`, color, fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, letterSpacing: '0.06em', whiteSpace: 'nowrap', textTransform: 'uppercase', ...style }}>
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

/** Neon-outlined panel with clipped corners, echoing the logo's angular frame. */
export const Panel: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: number; color?: string; cut?: number }> = ({ style, children, glow = 0.5, color = C.cyan, cut = 22 }) => {
  const clip = `polygon(${cut}px 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%, 0 ${cut}px)`;
  return (
    <div style={{ position: 'absolute', filter: `drop-shadow(0 0 ${22 * glow}px ${color}55) drop-shadow(0 30px 50px rgba(0,0,0,0.55))`, ...style }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: clip, background: `${color}AA` }} />
      <div style={{ position: 'absolute', inset: 1.5, clipPath: clip, background: 'linear-gradient(180deg, #0E1520, #070A10)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

export const SolanaMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 397 311">
    <defs>
      <linearGradient id="losol" x1="360" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    <path fill="url(#losol)" d="M64.6 237.9a14.5 14.5 0 0 1 10.3-4.3h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4l62.6-62.7zM64.6 3.8A14.9 14.9 0 0 1 74.9-.5h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4L64.6 3.8zM333.1 120.1a14.5 14.5 0 0 0-10.3-4.3H5.4c-6.5 0-9.7 7.8-5.1 12.4l62.7 62.7a14.5 14.5 0 0 0 10.3 4.3h317.4c6.5 0 9.7-7.8 5.1-12.4l-62.7-62.7z" />
  </svg>
);

/** Procedural key art for a game card (no third-party artwork). */
export type Art = { sky: [string, string]; sun: string; hills: string[]; seed: number; motif?: 'castle' | 'city' | 'ship' | 'tree' };
export const GameArt: React.FC<{ art: Art; w: number; h: number; t: number }> = ({ art, w, h, t }) => {
  const r = rand(art.seed);
  const ridge = (base: number, amp: number, k: number) => {
    let d = `M0 ${h}`; const n = 14;
    for (let i = 0; i <= n; i++) d += ` L${(i / n) * w} ${h * base - amp * h * (0.5 + 0.5 * Math.sin(i * 1.7 + k + r() * 2))}`;
    return d + ` L${w} ${h} Z`;
  };
  const drift = (t * 8) % w;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sky${art.seed}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={art.sky[0]} /><stop offset="1" stopColor={art.sky[1]} /></linearGradient>
        <radialGradient id={`sun${art.seed}`}><stop offset="0" stopColor={art.sun} /><stop offset="1" stopColor={art.sun} stopOpacity={0} /></radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#sky${art.seed})`} />
      <circle cx={w * 0.68} cy={h * 0.42} r={h * 0.5} fill={`url(#sun${art.seed})`} opacity={0.7} />
      <circle cx={w * 0.68} cy={h * 0.42} r={h * 0.13} fill={art.sun} />
      {[0, 1, 2].map((i) => <ellipse key={i} cx={((i * w) / 2 + drift * (1 + i * 0.3)) % (w + 200) - 100} cy={h * (0.2 + i * 0.08)} rx={w * 0.18} ry={h * 0.025} fill="#fff" opacity={0.12} />)}
      {art.hills.map((c, i) => <path key={i} d={ridge(0.62 + i * 0.13, 0.18 - i * 0.04, i * 2 + art.seed)} fill={c} />)}
      {art.motif === 'castle' && <path d={`M${w * 0.22} ${h * 0.62} v-${h * 0.22} h${w * 0.03} v${h * 0.05} h${w * 0.03} v-${h * 0.09} h${w * 0.03} v${h * 0.09} h${w * 0.03} v-${h * 0.05} h${w * 0.03} v${h * 0.22} Z`} fill={art.hills[0]} />}
      {art.motif === 'city' && [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={w * (0.08 + i * 0.07)} y={h * (0.36 + ((i * 37) % 5) * 0.04)} width={w * 0.05} height={h} fill={art.hills[0]} />)}
      {art.motif === 'tree' && <path d={`M${w * 0.2} ${h * 0.7} l${w * 0.06} -${h * 0.3} l${w * 0.06} ${h * 0.3} Z M${w * 0.3} ${h * 0.72} l${w * 0.05} -${h * 0.22} l${w * 0.05} ${h * 0.22} Z`} fill={art.hills[0]} />}
      {art.motif === 'ship' && <path d={`M${w * 0.15} ${h * (0.3 + Math.sin(t * 1.5) * 0.02)} l${w * 0.12} ${h * 0.04} l-${w * 0.12} ${h * 0.04} l${w * 0.03} -${h * 0.04} Z`} fill={C.cream} />}
      <rect width={w} height={h} fill="url(#scan)" opacity={0} />
    </svg>
  );
};
