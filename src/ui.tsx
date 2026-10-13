import React, { useMemo } from 'react';
import { Easing, interpolate } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/InstrumentSans';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { MARK_PATHS, MARK_TRANSFORM, MARK_VIEWBOX } from './markPaths';

export const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '500'] }).fontFamily;

export const C = {
  bg: '#04060B',
  panel: 'rgba(14,19,30,0.72)',
  panelSolid: '#0C111B',
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.14)',
  white: '#F5F7FB',
  muted: '#8A94A8',
  dim: '#566075',
  blue: '#4C8DFF',
  blue2: '#7DB2FF',
  green: '#2EE59D',
  red: '#FF5C6C',
};

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const inout = Easing.bezier(0.65, 0, 0.35, 1);

/** Clamped interpolation over seconds. */
export const io = (t: number, a: number, b: number, from = 0, to = 1, easing = expo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const rand = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

/** Smooth deterministic noise in [-1, 1]. */
export const noise = (x: number, seed = 0) =>
  Math.sin(x * 1.31 + seed) * 0.5 + Math.sin(x * 2.17 + seed * 1.7) * 0.3 + Math.sin(x * 4.03 + seed * 2.3) * 0.2;

export const walk = (seed: number, n: number, vol = 0.02, drift = 0.002) => {
  const r = rand(seed); let v = 1; const out: number[] = [];
  for (let i = 0; i < n; i++) { v *= 1 + (r() - 0.5) * 2 * vol + drift; out.push(v); }
  return out;
};

export const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = C.white, style }) => {
  const [, , w, h] = MARK_VIEWBOX.split(' ').map(Number);
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={(size * h) / w} style={style}>
      <g transform={MARK_TRANSFORM} fill={color}>
        {MARK_PATHS.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
};

/** Word-by-word masked reveal timed in seconds. */
export const Kinetic: React.FC<{
  text: string; t: number; at: number; size: number; weight?: number; color?: string;
  stagger?: number; style?: React.CSSProperties; gradient?: string; out?: number; font?: string; tracking?: number;
}> = ({ text, t, at, size, weight = 600, color = C.white, stagger = 0.06, style, gradient, out, font = SANS, tracking = -0.035 }) => {
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, lineHeight: 1.06, color, ...style }}>
      {words.map((w, i) => {
        const s = at + i * stagger;
        const p = io(t, s, s + 0.7);
        const o = out !== undefined ? io(t, out + i * 0.03, out + 0.35 + i * 0.03, 0, 1, inout) : 0;
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{
              display: 'inline-block',
              transform: `translateY(${(1 - p) * 105 - o * 60}%)`,
              opacity: Math.min(1, p * 1.6) * (1 - o),
              filter: `blur(${(1 - p) * 8 + o * 10}px)`,
              ...(gradient ? { backgroundImage: gradient, WebkitBackgroundClip: 'text', color: 'transparent' } : {}),
            }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Eyebrow: React.FC<{ t: number; at: number; children: string; color?: string; style?: React.CSSProperties }> = ({ t, at, children, color = C.blue2, style }) => {
  const p = io(t, at, at + 0.6);
  const chars = Math.round(children.length * io(t, at, at + 0.5, 0, 1, Easing.linear));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: 20, letterSpacing: '0.22em', color, opacity: p, ...style }}>
      <div style={{ width: 40 * p, height: 2, background: color, boxShadow: `0 0 12px ${color}` }} />
      {children.slice(0, chars)}
    </div>
  );
};

export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: string }> = ({ style, children, glow }) => (
  <div style={{
    position: 'absolute', borderRadius: 24, background: 'linear-gradient(180deg, rgba(22,29,44,0.86), rgba(10,14,22,0.9))',
    border: `1px solid ${C.line2}`, boxShadow: `0 40px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)${glow ? `, 0 0 60px ${glow}` : ''}`,
    overflow: 'hidden', ...style,
  }}>{children}</div>
);

export const LineChart: React.FC<{
  data: number[]; w: number; h: number; progress: number; color?: string; fill?: boolean; stroke?: number; dot?: boolean; pad?: number;
}> = ({ data, w, h, progress, color = C.green, fill = true, stroke = 3, dot = true, pad = 6 }) => {
  const id = 'lc' + React.useId().replace(/:/g, '');
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2)]);
  const n = Math.max(1, progress * (pts.length - 1));
  const k = Math.floor(n), f = n - k;
  const vis = pts.slice(0, k + 1);
  if (k < pts.length - 1) vis.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  const d = vis.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = vis[vis.length - 1];
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.32} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${last[0]},${h} L0,${h} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      {dot && progress > 0.02 && <>
        <circle cx={last[0]} cy={last[1]} r={stroke * 4} fill={color} opacity={0.18} />
        <circle cx={last[0]} cy={last[1]} r={stroke * 1.6} fill="#fff" />
      </>}
    </svg>
  );
};

export const Candles: React.FC<{ seed: number; n: number; w: number; h: number; progress: number; t: number }> = ({ seed, n, w, h, progress, t }) => {
  const data = useMemo(() => {
    const r = rand(seed); let p = 100; const out: { o: number; c: number; hi: number; lo: number }[] = [];
    for (let i = 0; i < n; i++) {
      const o = p; const c = o * (1 + (r() - 0.46) * 0.045); const hi = Math.max(o, c) * (1 + r() * 0.015); const lo = Math.min(o, c) * (1 - r() * 0.015);
      out.push({ o, c, hi, lo }); p = c;
    }
    return out;
  }, [seed, n]);
  const shown = Math.max(1, Math.floor(progress * n));
  const live = data.slice(0, shown).map((d, i) => (i === shown - 1 ? { ...d, c: d.c * (1 + noise(t * 6, seed) * 0.008) } : d));
  const min = Math.min(...data.map((d) => d.lo)), max = Math.max(...data.map((d) => d.hi));
  const y = (v: number) => (1 - (v - min) / (max - min)) * h;
  const cw = w / n;
  const lastY = y(live[live.length - 1].c);
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      {[0.2, 0.4, 0.6, 0.8].map((g) => <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke={C.line} strokeDasharray="4 8" />)}
      {live.map((d, i) => {
        const up = d.c >= d.o; const col = up ? C.green : C.red;
        const x = i * cw + cw / 2;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(d.hi)} y2={y(d.lo)} stroke={col} strokeWidth={1.5} />
            <rect x={x - cw * 0.32} width={cw * 0.64} y={Math.min(y(d.o), y(d.c))} height={Math.max(2, Math.abs(y(d.o) - y(d.c)))} fill={col} rx={1.5} />
          </g>
        );
      })}
      <line x1={0} x2={w} y1={lastY} y2={lastY} stroke={C.blue} strokeDasharray="6 6" opacity={0.8} />
    </svg>
  );
};

export const TickerLogo: React.FC<{ sym: string; size?: number }> = ({ sym, size = 52 }) => {
  const map: Record<string, [string, string]> = {
    AAPL: ['#E8EBF0', '#0B0E14'], NVDA: ['#76B900', '#0B0E14'], TSLA: ['#E82127', '#fff'], MSFT: ['#1E8CFF', '#fff'],
    AMD: ['#F5F7FB', '#0B0E14'], AVGO: ['#CC092F', '#fff'], AMZN: ['#FF9900', '#0B0E14'], META: ['#0866FF', '#fff'], GOOGL: ['#34A853', '#fff'], SPY: ['#2A3142', '#fff'],
  };
  const [bg, fg] = map[sym] ?? ['#2A3142', '#fff'];
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: size * 0.34, letterSpacing: '-0.02em', flexShrink: 0 }}>
      {sym.slice(0, sym.length > 3 ? 2 : 1)}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.green, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, border: `1px solid ${color}55`, background: `${color}14`, color, fontFamily: MONO, fontSize: 18, fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

export const LiveDot: React.FC<{ t: number; color?: string; size?: number }> = ({ t, color = C.green, size = 10 }) => {
  const p = (t * 1.2) % 1;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, background: color }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, border: `2px solid ${color}`, transform: `scale(${1 + p * 2.2})`, opacity: 1 - p }} />
    </span>
  );
};
