import React from 'react';
import { Easing, interpolate } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/Geist';
import { loadFont as loadMono } from '@remotion/google-fonts/GeistMono';
import { MARK, WORD } from './logoPaths';

export const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '500', '600'] }).fontFamily;

// Nest brand green (#24A57C, from usenest.xyz CSS) plus teal / cyan / electric green accents.
export const C = {
  bg: '#050706',
  white: '#F3F7F5',
  muted: 'rgba(243,247,245,0.56)',
  dim: 'rgba(243,247,245,0.32)',
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.14)',
  nest: '#24A57C',
  nestDeep: '#0E5740',
  teal: '#2EE6C5',
  cyan: '#3DE0FF',
  lime: '#7CFF6B',
  mint: '#B9F5DE',
  red: '#FF5D6C',
};

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const inout = Easing.bezier(0.65, 0, 0.35, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

export const io = (t: number, a: number, b: number, from = 0, to = 1, easing = expo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const noise = (x: number, seed = 0) =>
  Math.sin(x * 1.31 + seed) * 0.5 + Math.sin(x * 2.17 + seed * 1.7) * 0.3 + Math.sin(x * 4.03 + seed * 2.3) * 0.2;

export const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Official Nest mark (+ optional wordmark), drawn from the brand SVG paths. */
export const NestLogo: React.FC<{ height: number; word?: boolean; color?: string; glow?: number; draw?: number; style?: React.CSSProperties }> = ({ height, word = true, color = C.white, glow = 0.6, draw = 1, style }) => {
  const vbW = word ? 81.2208 : 28;
  return (
    <svg width={(height * vbW) / 28} height={height} viewBox={`0 0 ${vbW} 28`} style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${height * 0.12 * glow}px ${C.teal}aa)` : undefined, ...style }}>
      {MARK.map((d, i) => <path key={i} d={d} fill={color} />)}
      {word && WORD.map((d, i) => (
        <path key={i} d={d} fill={color} style={{ opacity: io(draw, 0.2 + i * 0.15, 0.55 + i * 0.15), transform: `translateY(${(1 - io(draw, 0.2 + i * 0.15, 0.7 + i * 0.15)) * 6}px)` }} />
      ))}
    </svg>
  );
};

/** Brand app icon: white mark on the Nest-green disc. */
export const NestBadge: React.FC<{ size: number; glow?: number }> = ({ size, glow = 1 }) => (
  <div style={{ width: size, height: size, borderRadius: size, background: `radial-gradient(circle at 35% 30%, #3CC898, ${C.nest} 55%, ${C.nestDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${size * 0.5 * glow}px ${C.nest}88, inset 0 0 0 ${Math.max(1, size * 0.02)}px rgba(255,255,255,0.25)` }}>
    <NestLogo height={size * 0.56} word={false} glow={0} />
  </div>
);

export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties;
  weight?: number; accent?: string[]; accentColor?: string; tracking?: number;
}> = ({ text, t, at, size, color = C.white, stagger = 0.06, style, weight = 600, accent = [], accentColor = C.teal, tracking = -0.035 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.24, fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: `${tracking}em`, color, ...style }}>
    {text.split(' ').map((w, i) => {
      const s = at + i * stagger;
      const p = io(t, s, s + 0.6);
      const isAcc = accent.includes(w.replace(/[.,]/g, ''));
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.05}px ${size * 0.14}px`, margin: `0 ${-size * 0.05}px ${-size * 0.14}px` }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 1.8), ...(isAcc ? { background: `linear-gradient(90deg, ${C.teal}, ${C.lime})`, WebkitBackgroundClip: 'text', color: 'transparent', filter: `drop-shadow(0 0 22px ${accentColor}66)` } : {}) }}>{w}</span>
        </span>
      );
    })}
  </div>
);

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.teal, style }) => {
  const p = io(t, at, at + 0.5);
  const n = Math.round(children.length * io(t, at, at + 0.45, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontWeight: 500, fontSize: 19, letterSpacing: '0.16em', color, opacity: p, ...style }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color, boxShadow: `0 0 10px ${color}` }} />
      {children.slice(0, n)}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.teal, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, border: `1px solid ${color}55`, background: `${color}14`, color, fontFamily: MONO, fontWeight: 500, fontSize: 16, whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

export const LiveDot: React.FC<{ t: number; color?: string; size?: number }> = ({ t, color = C.lime, size = 9 }) => {
  const p = (t * 1.3) % 1;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, background: color }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, border: `2px solid ${color}`, transform: `scale(${1 + p * 2.2})`, opacity: 1 - p }} />
    </span>
  );
};

/** Dark glass card with a hairline gradient rim. */
export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: number; color?: string; radius?: number }> = ({ style, children, glow = 0.4, color = C.teal, radius = 22 }) => (
  <div style={{ position: 'absolute', borderRadius: radius, padding: 1.2, background: `linear-gradient(150deg, ${color}99, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, ${color}55)`, boxShadow: `0 0 ${50 * glow}px ${color}33, 0 30px 70px rgba(0,0,0,0.6)`, ...style }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radius - 1, background: 'linear-gradient(180deg, rgba(16,24,21,0.96), rgba(7,10,9,0.98))', overflow: 'hidden' }}>{children}</div>
  </div>
);

/** Token glyph: HYPE uses Hyperliquid mint, NEST uses the brand badge. */
const TOKENS: Record<string, { bg: string; fg: string; label: string }> = {
  HYPE: { bg: '#97FCE4', fg: '#062B23', label: 'H' },
  USDC: { bg: '#2775CA', fg: '#fff', label: '$' },
  UBTC: { bg: '#F7931A', fg: '#fff', label: '₿' },
  UETH: { bg: '#627EEA', fg: '#fff', label: 'Ξ' },
  veNEST: { bg: '#0E5740', fg: '#B9F5DE', label: 've' },
};
export const Token: React.FC<{ sym: string; size?: number; style?: React.CSSProperties }> = ({ sym, size = 36, style }) => {
  if (sym === 'NEST') return <div style={style}><NestBadge size={size} glow={0.2} /></div>;
  const k = TOKENS[sym] ?? TOKENS.USDC;
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: k.bg, color: k.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: size * (k.label.length > 1 ? 0.36 : 0.5), boxShadow: '0 0 0 2px rgba(0,0,0,0.4)', flexShrink: 0, ...style }}>{k.label}</div>
  );
};
