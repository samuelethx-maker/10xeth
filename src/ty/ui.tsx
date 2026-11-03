import React from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/IBMPlexSans';
import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';

// tickeryard.com ships IBM Plex Sans / Mono.
export const SANS = loadSans('normal', { weights: ['300', '400', '500', '600', '700'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '500', '600'] }).fontFamily;

// Design tokens from the live app CSS (--primary, --background, --card, --border, ...).
export const C = {
  bg: '#0A0B0B',
  bg2: '#0E1011',
  card: '#16191A',
  surface: '#1A1E1F',
  accentSurface: '#10211A',
  border: '#262C2E',
  white: '#EDF0EF',
  muted: '#AAB3B0',
  dim: 'rgba(237,240,239,0.36)',
  green: '#00E997',
  greenDeep: '#03140D',
  greenMid: '#0B6B48',
  red: '#FF5B6B',
  amber: '#FFC15C',
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

export const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Official TickerYard mark (pixel pitchfork), 32x32 grid from the app header. */
export const TRIDENT = 'M6 3h4v10h4V3h4v10h4V3h4v14h-8v11h-4V17H6Z';
// The mark decomposed into its seven pixel blocks, for assembling it from route lines.
export const TRIDENT_BLOCKS: [number, number, number, number][] = [
  [6, 3, 4, 10], [14, 3, 4, 10], [22, 3, 4, 10], [6, 13, 20, 4], [14, 17, 4, 11],
];

export const Mark: React.FC<{ size: number; color?: string; glow?: number; build?: number; style?: React.CSSProperties }> = ({ size, color = C.green, glow = 0.6, build = 1, style }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${size * 0.06 * glow}px ${color}) drop-shadow(0 0 ${size * 0.2 * glow}px ${color}66)` : undefined, ...style }}>
    {build >= 1 ? <path d={TRIDENT} fill={color} /> : TRIDENT_BLOCKS.map(([x, y, w, h], i) => {
      const p = io(build, i * 0.14, i * 0.14 + 0.4);
      const vertical = h > w;
      return <rect key={i} x={x} y={vertical ? y + h * (1 - p) * (i < 3 ? 0 : 1) : y} width={vertical ? w : w * p} height={vertical ? h * p : h} fill={color} opacity={Math.min(1, p * 2)} />;
    })}
  </svg>
);

export const Wordmark: React.FC<{ height: number; t: number; at?: number; glow?: number }> = ({ height, t, at = 0, glow = 0.8 }) => {
  const p = io(t, at, at + 0.9);
  const letters = 'TickerYard'.split('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.26 }}>
      <Mark size={height * 1.15} build={io(t, at - 0.1, at + 0.6, 0, 1, Easing.linear)} glow={glow} />
      <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 400, fontSize: height, letterSpacing: '-0.035em', color: C.white, lineHeight: 1 }}>
        {letters.map((ch, i) => {
          const q = io(t, at + 0.15 + i * 0.035, at + 0.6 + i * 0.035);
          return <span key={i} style={{ display: 'inline-block', opacity: q, transform: `translateY(${(1 - q) * height * 0.25}px)`, filter: q < 1 ? `blur(${(1 - q) * 6}px)` : undefined }}>{ch}</span>;
        })}
      </div>
      <span style={{ display: 'none' }}>{p}</span>
    </div>
  );
};

export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties;
  accent?: string[]; weight?: number; tracking?: number;
}> = ({ text, t, at, size, color = C.white, stagger = 0.06, style, accent = [], weight = 500, tracking = -0.03 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.25, fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: 1.04, letterSpacing: `${tracking}em`, color, ...style }}>
    {text.split(' ').map((w, i) => {
      const s = at + i * stagger;
      const p = io(t, s, s + 0.65);
      const acc = accent.includes(w.replace(/[.,]/g, ''));
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.05}px ${size * 0.14}px`, margin: `0 ${-size * 0.05}px ${-size * 0.14}px` }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 105}%)`, opacity: Math.min(1, p * 1.8), color: acc ? C.green : undefined, textShadow: acc ? `0 0 ${size * 0.4}px rgba(0,233,151,0.45)` : undefined }}>{w}</span>
        </span>
      );
    })}
  </div>
);

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.green, style }) => {
  const p = io(t, at, at + 0.5);
  const n = Math.round(children.length * io(t, at, at + 0.45, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontWeight: 500, fontSize: 18, letterSpacing: '0.18em', color, opacity: p, ...style }}>
      <svg width={14} height={14} viewBox="0 0 32 32" shapeRendering="crispEdges"><path d={TRIDENT} fill={color} /></svg>
      {children.slice(0, n)}
      <span style={{ opacity: n < children.length || Math.floor(t * 2.5) % 2 ? 1 : 0, color }}>▌</span>
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties; solid?: boolean }> = ({ children, color = C.green, style, solid }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 10, border: `1px solid ${solid ? color : color + '40'}`, background: solid ? color : `${color}10`, color: solid ? C.greenDeep : color, fontFamily: SANS, fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

export const LiveDot: React.FC<{ t: number; color?: string; size?: number }> = ({ t, color = C.green, size = 8 }) => {
  const p = (t * 1.2) % 1;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, background: color }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, border: `2px solid ${color}`, transform: `scale(${1 + p * 2.2})`, opacity: 1 - p }} />
    </span>
  );
};

/** App surface: --card fill, --border hairline, faint green top light. */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: number; radius?: number; active?: number }> = ({ style, children, glow = 0.25, radius = 16, active = 0 }) => (
  <div style={{ position: 'absolute', borderRadius: radius, boxShadow: `0 0 0 1px ${active ? `rgba(0,233,151,${0.25 + active * 0.5})` : C.border}, 0 0 ${70 * (glow + active * 0.5)}px rgba(0,233,151,${0.08 + active * 0.12}), 0 40px 80px rgba(0,0,0,0.6)`, background: `linear-gradient(180deg, #181C1D, #121516)`, overflow: 'hidden', ...style }}>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% -10%, rgba(0,233,151,0.07), transparent 55%)', pointerEvents: 'none' }} />
    {children}
  </div>
);

/** Token icons: official TickerYard SVGs where published, simple glyphs otherwise. */
const GLYPH: Record<string, { bg: string; fg: string; t: string }> = {
  ETH: { bg: '#627EEA', fg: '#fff', t: 'Ξ' }, WBTC: { bg: '#F7931A', fg: '#fff', t: '₿' }, yZEC: { bg: '#0E1011', fg: '#F4B728', t: 'ⓩ' },
  yBoop: { bg: '#0E1011', fg: '#FF7AC6', t: 'b' }, USDC: { bg: '#2775CA', fg: '#fff', t: '$' },
};
const FILE: Record<string, string> = { yBTC: 'ybtc', yrHOOD: 'yrhood', yWHYPE: 'ywhype', YARD: 'yard' };
export const Token: React.FC<{ sym: string; size?: number; style?: React.CSSProperties }> = ({ sym, size = 36, style }) => {
  if (FILE[sym]) return <Img src={staticFile(`ty/tokens/${FILE[sym]}.svg`)} style={{ width: size, height: size, borderRadius: size, flexShrink: 0, boxShadow: '0 0 0 2px rgba(0,0,0,0.5)', ...style }} />;
  const g = GLYPH[sym] ?? GLYPH.USDC;
  return <div style={{ width: size, height: size, borderRadius: size, background: g.bg, color: g.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: size * 0.52, flexShrink: 0, boxShadow: `0 0 0 2px rgba(0,0,0,0.5), inset 0 0 0 1px ${g.fg}33`, ...style }}>{g.t}</div>;
};

/** Chain badges (monograms in each network's colour). */
export const CHAINS: Record<string, { c: string; t: string; name: string }> = {
  eth: { c: '#627EEA', t: 'Ξ', name: 'Ethereum' },
  arb: { c: '#28A0F0', t: 'A', name: 'Arbitrum One' },
  base: { c: '#0052FF', t: 'B', name: 'Base' },
  hyper: { c: '#97FCE4', t: 'H', name: 'HyperEVM' },
  zec: { c: '#F4B728', t: 'Z', name: 'Zcash' },
  sol: { c: '#9945FF', t: 'S', name: 'Solana' },
  rh: { c: '#CCFF00', t: 'R', name: 'Robinhood Chain' },
};
export const ChainBadge: React.FC<{ id: string; size?: number; glow?: number }> = ({ id, size = 44, glow = 0 }) => {
  const ch = CHAINS[id];
  if (id === 'rh') {
    return (
      <div style={{ width: size, height: size, borderRadius: size * 0.28, background: '#0B0F0C', border: `${Math.max(1.5, size * 0.04)}px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${size * 0.6 * glow}px ${C.green}`, flexShrink: 0 }}>
        <svg width={size * 0.5} height={size * 0.62} viewBox="0 0 60 100"><path d="M8 96 C20 70 34 40 54 4 C58 22 56 40 48 58 C40 74 28 86 12 97 Z" fill={C.green} /></svg>
      </div>
    );
  }
  return <div style={{ width: size, height: size, borderRadius: size * 0.28, background: `${ch.c}22`, border: `1.5px solid ${ch.c}AA`, color: ch.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: size * 0.46, flexShrink: 0, boxShadow: glow ? `0 0 ${size * 0.5 * glow}px ${ch.c}66` : undefined }}>{ch.t}</div>;
};
