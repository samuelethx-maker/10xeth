import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Presenter } from './Presenter';
import {
  C, Candles, Chip, Eyebrow, Glass, Kinetic, LineChart, LiveDot, MONO, Mark, SANS, TickerLogo, expo, fmt, inout, io, noise, walk,
} from './ui';

const S = T.scenes;
const vo = (i: number, p = 0) => T.vo[i].at + Number(T.vo[i].phrases[p][0]);
const GRAD = `linear-gradient(95deg, ${C.blue2} 0%, ${C.blue} 40%, ${C.green} 100%)`;
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;

/* ---------------------------------- Background ---------------------------------- */

const Background: React.FC<{ t: number }> = ({ t }) => {
  const endGlow = io(t, S.end, S.end + 1.2);
  const custody = io(t, S.custody - 0.3, S.custody + 0.6) * (1 - io(t, S.features - 0.3, S.features + 0.4));
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: 1400, height: 1400, borderRadius: 1400, left: 200 + noise(t * 0.2, 1) * 220 + custody * 700, top: -500 + noise(t * 0.17, 2) * 120,
        background: `radial-gradient(circle, rgba(60,120,255,${0.22 + endGlow * 0.1}) 0%, rgba(60,120,255,0) 62%)`,
      }} />
      <div style={{
        position: 'absolute', width: 1200, height: 1200, borderRadius: 1200, left: 1000 + noise(t * 0.15, 4) * 260 - custody * 800, top: 300 + noise(t * 0.19, 6) * 150,
        background: 'radial-gradient(circle, rgba(46,229,157,0.10) 0%, rgba(46,229,157,0) 62%)',
      }} />
      {/* perspective floor grid */}
      <div style={{ position: 'absolute', inset: 0, perspective: 900, perspectiveOrigin: '50% 30%' }}>
        <div style={{
          position: 'absolute', left: -1000, right: -1000, top: 560, height: 1400, transform: 'rotateX(74deg)', transformOrigin: '50% 0%',
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: '90px 90px', backgroundPosition: `0px ${(t * 40) % 90}px`,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 70%)', WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 70%)',
          opacity: 0.7,
        }} />
      </div>
      {/* fine dot field */}
      <div style={{
        position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '36px 36px',
        backgroundPosition: `${-t * 6}px ${-t * 3}px`, maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
      }} />
    </AbsoluteFill>
  );
};

/* ---------------------------------- Presenter rig ---------------------------------- */

const keys = {
  t: [0, 5.55, 6.25, 10.75, 11.45, 16.95, 17.6, 22.45, 22.95, 26.2, 26.95],
  x: [600, 600, 370, 370, 1540, 1540, 340, 340, 340, 560, 560],
  y: [0, 0, 30, 30, 30, 30, 80, 80, 1000, 1000, 10],
  s: [1.05, 1.05, 0.86, 0.86, 0.86, 0.86, 0.8, 0.8, 0.8, 0.98, 0.98],
  look: [0, 0, 0.9, 0.9, -0.9, -0.9, 0.9, 0.9, 0.9, 0.5, 0.5],
};
const k = (t: number, arr: number[]) => interpolate(t, keys.t, arr, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const PresenterRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const x = k(t, keys.x), y = k(t, keys.y), s = k(t, keys.s);
  let look = k(t, keys.look);
  const intro = io(t, 0.05, 1.4);
  // Glance at camera on each line start, then back to the UI.
  const phraseStarts = T.vo.flatMap((v) => v.phrases.map((p) => v.at + Number(p[0])));
  const lineStarts = T.vo.map((v) => v.at);
  const cam = Math.max(0, ...lineStarts.map((ls) => io(t, ls - 0.25, ls, 0, 1) * (1 - io(t, ls + 0.9, ls + 1.3, 0, 1))));
  look = look * (1 - cam);
  const emphasis = Math.max(0, ...phraseStarts.map((ps) => (t >= ps - 0.1 && t < ps + 0.6 ? Math.sin(((t - ps + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.open.length - 1, frame);
  const speakingEnd = T.vo[5].at + 1.7;
  const smile = 0.3 + io(t, speakingEnd, speakingEnd + 0.5) * 0.7;
  const w = 800 * s, h = 1000 * s;
  return (
    <div style={{
      position: 'absolute', left: x - w / 2, top: 1080 - h + 40 + y + (1 - intro) * 140, width: w, height: h,
      opacity: intro, filter: `blur(${(1 - intro) * 16}px)`,
    }}>
      {/* back light */}
      <div style={{ position: 'absolute', left: w * 0.05, top: h * 0.02, width: w * 0.9, height: w * 0.9, borderRadius: w, background: 'radial-gradient(circle, rgba(76,141,255,0.30), rgba(76,141,255,0) 65%)' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Presenter t={t} open={mouth.open[i]} wide={mouth.wide[i]} smile={smile} emphasis={emphasis * 0.8} look={[look, 0.1]} />
      </div>
    </div>
  );
};

/* ---------------------------------- Shared bits ---------------------------------- */

const TAPE = [
  ['AAPL', 231.42, 1.12], ['NVDA', 218.93, 0.63], ['TSLA', 333.13, 0.68], ['MSFT', 502.97, 0.41], ['AMD', 170.09, 0.11], ['AMZN', 228.4, -0.32],
  ['META', 742.18, 0.92], ['GOOGL', 196.55, 0.27], ['SPY', 672.55, -0.06], ['AVGO', 301.2, 1.48],
] as const;

const TickerTape: React.FC<{ t: number; opacity: number }> = ({ t, opacity }) => {
  const items = [...TAPE, ...TAPE, ...TAPE];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, opacity, background: 'linear-gradient(180deg, rgba(4,6,11,0), rgba(4,6,11,0.92) 40%)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 18, height: 1, background: C.line }} />
      <div style={{ position: 'absolute', top: 28, left: -(t * 90) % 2400, display: 'flex', gap: 56, fontFamily: MONO, fontSize: 19, whiteSpace: 'nowrap' }}>
        {items.map(([s, p, c], i) => {
          const live = p * (1 + noise(t * 2 + i, i) * 0.002);
          return (
            <span key={i} style={{ color: C.muted }}>
              <span style={{ color: C.white }}>{s}</span>&nbsp; {fmt(live)}&nbsp; <span style={{ color: c >= 0 ? C.green : C.red }}>{c >= 0 ? '▲' : '▼'} {Math.abs(c).toFixed(2)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Fade + push + blur used for every scene exit. */
const exitStyle = (t: number, end: number, dir = -1): React.CSSProperties => {
  const o = io(t, end - 0.35, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateY(${dir * o * 40}px) scale(${1 + o * 0.04})`, filter: o > 0.01 ? `blur(${o * 14}px)` : undefined };
};

/* ---------------------------------- 1. Hook ---------------------------------- */

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const a = vo(0, 0), b = vo(0, 1), c = vo(0, 2);
  const chain = io(t, c - 0.05, c + 0.6);
  return (
    <AbsoluteFill style={exitStyle(t, S.always)}>
      <div style={{ position: 'absolute', left: 1010, top: 250, width: 820 }}>
        <Eyebrow t={t} at={0.3}>INTRODUCING</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 30 }}>
          <div style={{ transform: `scale(${io(t, a + 0.25, a + 0.9)}) rotate(${(1 - io(t, a + 0.25, a + 1.0)) * -40}deg)`, filter: `drop-shadow(0 0 30px ${C.blue}aa)` }}>
            <Mark size={104} />
          </div>
          <Kinetic t={t} at={a + 0.1} size={124} weight={600} text="dexstock" stagger={0} />
        </div>
        <div style={{ height: 3, width: 760 * io(t, a + 0.5, a + 1.4), background: GRAD, marginTop: 34, boxShadow: `0 0 20px ${C.blue}` }} />
        <div style={{ marginTop: 40 }}>
          <Kinetic t={t} at={b} size={56} weight={500} color={C.muted} text="The all-in-one app for trading" stagger={0.09} />
          <Kinetic t={t} at={b + 1.05} size={76} weight={600} text="tokenised stocks" gradient={GRAD} stagger={0.2} />
        </div>
        <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 18, opacity: chain, transform: `translateY(${(1 - chain) * 30}px)` }}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const p = io(t, c + i * 0.07, c + i * 0.07 + 0.4);
            return (
              <React.Fragment key={i}>
                <div style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${i === 5 ? C.green : C.blue}`, background: i === 5 ? `${C.green}33` : `${C.blue}22`, transform: `scale(${p})`, boxShadow: i === 5 ? `0 0 20px ${C.green}` : undefined }} />
                {i < 5 && <div style={{ width: 22 * p, height: 2, background: C.blue }} />}
              </React.Fragment>
            );
          })}
          <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: '0.2em', color: C.green, marginLeft: 14 }}>ON-CHAIN</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- 2. Always open ---------------------------------- */

const STOCKS = [
  { sym: 'AAPL', name: 'Apple', price: 231.42, chg: 1.12, seed: 11 },
  { sym: 'NVDA', name: 'NVIDIA', price: 218.93, chg: 0.63, seed: 23 },
  { sym: 'TSLA', name: 'Tesla', price: 333.13, chg: 0.68, seed: 37 },
];

const StockCard: React.FC<{ t: number; at: number; s: (typeof STOCKS)[number]; buy?: number }> = ({ t, at, s, buy = 0 }) => {
  const data = useMemo(() => walk(s.seed, 60, 0.018, 0.003), [s.seed]);
  const p = io(t, at, at + 0.9);
  const price = s.price * (1 + noise(t * 3, s.seed) * 0.0015) * (0.985 + 0.015 * p);
  return (
    <div style={{
      width: 300, height: 290, position: 'relative', borderRadius: 22, padding: 24, boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(24,31,47,0.9), rgba(11,15,24,0.94))', border: `1px solid ${C.line2}`, boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
      opacity: p, transform: `perspective(1200px) translateX(${(1 - p) * 220}px) rotateY(${(1 - p) * -35}deg)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <TickerLogo sym={s.sym} size={46} />
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: C.white }}>{s.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.muted }}>{s.sym} · tokenised</div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 34, color: C.white, letterSpacing: '-0.02em' }}>${fmt(price)}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, color: C.green }}>▲ {s.chg.toFixed(2)}%</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 64 }}>
        <LineChart data={data} w={300} h={70} progress={io(t, at + 0.2, at + 1.6, 0, 1, Easing.out(Easing.quad))} stroke={2.5} dot={false} />
      </div>
      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 20, height: 38, borderRadius: 12, background: buy > 0 ? C.green : 'rgba(255,255,255,0.06)', color: buy > 0 ? '#04140C' : C.white, fontFamily: SANS, fontWeight: 600, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - Math.sin(Math.min(1, buy) * Math.PI) * 0.06})` }}>
        {buy > 0 ? 'Buy · signed' : 'Buy'}
      </div>
    </div>
  );
};

const Moon = () => <svg width="40" height="40" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill={C.blue2} /></svg>;
const Cal = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.blue2} strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
const Star = () => <svg width="40" height="40" viewBox="0 0 24 24"><path d="M12 2l2.4 6.9H22l-6 4.5 2.3 7-6.3-4.4-6.3 4.4 2.3-7-6-4.5h7.6Z" fill={C.blue2} /></svg>;

const AlwaysOpen: React.FC<{ t: number }> = ({ t }) => {
  const a = vo(1, 0);
  const tiles = [
    { at: vo(1, 1), title: 'Nights', meta: 'TUE · 02:14 AM', icon: <Moon /> },
    { at: vo(1, 2), title: 'Weekends', meta: 'SAT · 11:40 AM', icon: <Cal /> },
    { at: vo(1, 3), title: 'Holidays', meta: 'DEC 25 · 09:05 PM', icon: <Star /> },
  ];
  const tapAt = 7.35;
  const buy = io(t, tapAt, tapAt + 0.25, 0, 1, Easing.linear);
  const toast = io(t, tapAt + 0.15, tapAt + 0.6) * (1 - io(t, 8.6, 8.95));
  const big = io(t, tiles[0].at - 0.2, tiles[0].at + 1.6);
  const intro = io(t, S.always - 0.1, S.always + 0.5);
  return (
    <AbsoluteFill style={exitStyle(t, S.custody)}>
      {/* giant outline 24/7 */}
      <div style={{ position: 'absolute', right: 40, top: 520, fontFamily: SANS, fontWeight: 700, fontSize: 470, letterSpacing: '-0.06em', color: 'transparent', WebkitTextStroke: `2px rgba(125,178,255,${0.16 * big})`, transform: `scale(${0.9 + big * 0.1})`, transformOrigin: '100% 50%', lineHeight: 1 }}>24/7</div>
      <div style={{ position: 'absolute', left: 820, top: 120, opacity: intro }}>
        <Kinetic t={t} at={a} size={74} text="Trade real stocks" stagger={0.1} />
        <div style={{ marginTop: 18, opacity: io(t, a + 0.9, a + 1.4), transform: `translateX(${(1 - io(t, a + 0.9, a + 1.5)) * -30}px)` }}>
          <Chip color={C.green}><LiveDot t={t} /> on Robinhood Chain · live</Chip>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 820, top: 330, display: 'flex', gap: 28, transform: `translateY(${-big * 20}px) scale(${1 - big * 0.06})`, transformOrigin: '0 0' }}>
        {STOCKS.map((s, i) => <StockCard key={s.sym} t={t} at={S.always + 0.15 + i * 0.14} s={s} buy={s.sym === 'NVDA' ? buy : 0} />)}
      </div>
      {/* tap ripple + toast */}
      <div style={{ position: 'absolute', left: 820 + 328 + 150 - 40, top: 330 + 250 - 40, width: 80, height: 80, borderRadius: 80, border: `2px solid ${C.green}`, opacity: (1 - buy) * (t > tapAt ? 1 : 0), transform: `scale(${0.3 + buy * 1.4})` }} />
      <div style={{ position: 'absolute', left: 1180, top: 268, opacity: toast, transform: `translateY(${(1 - toast) * 16}px)` }}>
        <Chip color={C.green} style={{ background: 'rgba(8,24,18,0.92)', fontSize: 17 }}>✓ Bought 2.50 NVDA · settled on-chain</Chip>
      </div>
      {/* time tiles */}
      <div style={{ position: 'absolute', left: 820, top: 690, display: 'flex', gap: 28 }}>
        {tiles.map((tile, i) => {
          const p = io(t, tile.at - 0.08, tile.at + 0.6);
          return (
            <div key={i} style={{
              width: 300, height: 190, borderRadius: 22, padding: 24, boxSizing: 'border-box', position: 'relative',
              background: 'linear-gradient(180deg, rgba(20,30,52,0.92), rgba(9,13,22,0.95))', border: `1px solid ${C.blue}44`,
              boxShadow: `0 0 ${40 * p}px ${C.blue}33, 0 30px 60px rgba(0,0,0,0.5)`,
              opacity: p, transform: `translateY(${(1 - p) * 60}px) scale(${0.92 + p * 0.08})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {tile.icon}
                <div style={{ fontFamily: MONO, fontSize: 15, color: C.muted, letterSpacing: '0.08em' }}>{tile.meta}</div>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, color: C.white, marginTop: 14, letterSpacing: '-0.03em' }}>{tile.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 17, color: C.green, marginTop: 6 }}><LiveDot t={t + i * 0.3} size={9} /> Market open</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- 3. Self-custody ---------------------------------- */

const HOLDINGS = [
  { sym: 'AAPL', qty: '12.40', val: 2869.61 },
  { sym: 'NVDA', qty: '42.50', val: 9304.53 },
  { sym: 'TSLA', qty: '8.00', val: 2665.04 },
];

const Custody: React.FC<{ t: number }> = ({ t }) => {
  const [h, wallet, assets, noMid, zero] = [0, 1, 2, 3, 4].map((i) => vo(2, i));
  const wIn = io(t, wallet - 0.15, wallet + 0.7);
  const total = HOLDINGS.reduce((s, x) => s + x.val, 0) * io(t, assets, assets + 1.0, 0, 1, Easing.out(Easing.cubic));
  const brokerIn = io(t, S.custody + 0.2, S.custody + 0.9);
  const strike = io(t, noMid + 0.05, noMid + 0.4, 0, 1, Easing.inOut(Easing.quad));
  const fall = io(t, noMid + 0.45, noMid + 1.1, 0, 1, Easing.in(Easing.cubic));
  const fee = io(t, zero - 0.05, zero + 0.5);
  const feeVal = 6.95 * (1 - io(t, zero, zero + 0.55, 0, 1, Easing.out(Easing.cubic)));
  const listItem = (at: number, text: string, i: number) => {
    const p = io(t, at - 0.05, at + 0.5);
    return (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, marginBottom: 22 }}>
        <div style={{ width: 40, height: 40, borderRadius: 40, background: `${C.green}22`, border: `1.5px solid ${C.green}`, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontFamily: SANS, transform: `scale(${io(t, at + 0.1, at + 0.5)})` }}>✓</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 52, color: C.white, letterSpacing: '-0.03em' }}>{text}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={exitStyle(t, S.features)}>
      <div style={{ position: 'absolute', left: 120, top: 110 }}>
        <Eyebrow t={t} at={h - 0.1}>SELF-CUSTODY · NON-CUSTODIAL</Eyebrow>
        <div style={{ marginTop: 24 }}><Kinetic t={t} at={h} size={96} text="Fully self-custodied." stagger={0.12} /></div>
      </div>
      <div style={{ position: 'absolute', left: 124, top: 420 }}>
        {listItem(wallet, 'Your wallet.', 0)}
        {listItem(assets, 'Your assets.', 1)}
        {listItem(noMid, 'No middleman.', 2)}
      </div>
      {/* fees */}
      <div style={{ position: 'absolute', left: 124, top: 760, opacity: fee, transform: `translateY(${(1 - fee) * 30}px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <div style={{ fontFamily: MONO, fontSize: 120, color: C.green, letterSpacing: '-0.05em', textShadow: `0 0 40px ${C.green}88` }}>${feeVal.toFixed(2)}</div>
          <div style={{ fontFamily: SANS, fontSize: 34, color: C.white, fontWeight: 600 }}>trading fees<div style={{ fontFamily: MONO, fontSize: 17, color: C.muted, fontWeight: 400, marginTop: 6 }}>currently zero, every trade</div></div>
        </div>
      </div>
      {/* broker ghost card */}
      <div style={{
        position: 'absolute', left: 760, top: 300 - wIn * 40 + fall * 300, width: 400, height: 96, borderRadius: 18, border: `2px dashed ${C.muted}66`, background: 'rgba(30,34,44,0.6)',
        opacity: brokerIn * (1 - fall) * 0.95, transform: `rotate(${fall * 14}deg)`, filter: `blur(${fall * 6}px)`, display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', boxSizing: 'border-box',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><path d="M3 21h18M5 21V10M19 21V10M9 21v-6h6v6M2 10l10-7 10 7" /></svg>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: C.muted, fontWeight: 600 }}>Broker / Custodian</div>
          <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim }}>holds your shares for you</div>
        </div>
        <div style={{ position: 'absolute', left: 14, top: 46, height: 4, width: 372 * strike, background: C.red, borderRadius: 4, boxShadow: `0 0 16px ${C.red}`, transform: 'rotate(-4deg)' }} />
      </div>
      {/* wallet card */}
      <Glass glow={`rgba(76,141,255,${0.25 * wIn})`} style={{
        left: 700, top: 440, width: 520, height: 470, opacity: wIn, transform: `perspective(1400px) translateY(${(1 - wIn) * 80}px) rotateX(${(1 - wIn) * 20}deg) rotateY(-8deg)`, padding: 30, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#04060B" strokeWidth="2.4"><rect x="2" y="6" width="20" height="14" rx="3" /><path d="M16 13h2M2 9h16V6" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.white }}>Your wallet</div>
              <div style={{ fontFamily: MONO, fontSize: 16, color: C.muted }}>0x7a3c…f91e</div>
            </div>
          </div>
          <Chip color={C.green} style={{ fontSize: 15, padding: '6px 12px' }}><LiveDot t={t} size={8} /> You hold the keys</Chip>
        </div>
        <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 15, color: C.muted, letterSpacing: '0.12em' }}>PORTFOLIO VALUE</div>
        <div style={{ fontFamily: MONO, fontSize: 52, color: C.white, letterSpacing: '-0.03em' }}>${fmt(total)}</div>
        <div style={{ marginTop: 14 }}>
          {HOLDINGS.map((x, i) => {
            const p = io(t, assets + i * 0.12, assets + 0.5 + i * 0.12);
            return (
              <div key={x.sym} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderTop: `1px solid ${C.line}`, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
                <TickerLogo sym={x.sym} size={38} />
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 22, color: C.white, flex: 1 }}>{x.sym}<span style={{ fontFamily: MONO, fontWeight: 400, fontSize: 16, color: C.muted, marginLeft: 12 }}>{x.qty} shares</span></div>
                <div style={{ fontFamily: MONO, fontSize: 20, color: C.white }}>${fmt(x.val)}</div>
              </div>
            );
          })}
        </div>
      </Glass>
    </AbsoluteFill>
  );
};

/* ---------------------------------- 4. Features ---------------------------------- */

const FEATURES = ['Trading', 'Strategies', 'Terminal', 'AI News', 'Baskets'];

const StrategyView: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const nodes = [
    { k: 'WHEN', v: 'NVDA dips 5%', c: C.blue },
    { k: 'THEN', v: 'Buy $500', c: C.green },
    { k: 'EXIT', v: 'Take profit +12%', c: C.blue2 },
  ];
  const data = useMemo(() => walk(91, 80, 0.012, 0.004), []);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 44 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 400, position: 'absolute', left: 44, top: 150 }}>
        {nodes.map((n, i) => {
          const p = io(t, at + 0.1 + i * 0.22, at + 0.6 + i * 0.22);
          return (
            <div key={i} style={{ position: 'relative', opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
              <div style={{ borderRadius: 16, border: `1.5px solid ${n.c}88`, background: `${n.c}12`, padding: '18px 22px' }}>
                <div style={{ fontFamily: MONO, fontSize: 15, color: n.c, letterSpacing: '0.16em' }}>{n.k}</div>
                <div style={{ fontFamily: SANS, fontSize: 32, color: C.white, fontWeight: 600, marginTop: 4 }}>{n.v}</div>
              </div>
              {i < 2 && <div style={{ position: 'absolute', left: 40, top: '100%', width: 2, height: 26 * io(t, at + 0.4 + i * 0.22, at + 0.7 + i * 0.22), background: C.line2 }} />}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 500, top: 150, right: 44 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 16, color: C.muted, letterSpacing: '0.1em' }}><span>BACKTEST · 1Y</span><span style={{ color: C.green }}>● RUNNING</span></div>
        <div style={{ marginTop: 30 }}><LineChart data={data} w={500} h={300} progress={io(t, at + 0.3, at + 1.6, 0, 1, Easing.out(Easing.quad))} /></div>
        <div style={{ marginTop: 26, height: 56, borderRadius: 14, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 22, color: '#04060B', opacity: io(t, at + 0.9, at + 1.3) }}>Deploy strategy</div>
      </div>
    </div>
  );
};

const TerminalView: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const rows = 9;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 44, top: 140, display: 'flex', alignItems: 'center', gap: 16 }}>
        <TickerLogo sym="NVDA" size={40} />
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.white }}>NVDA / USDG</div>
        <div style={{ fontFamily: MONO, fontSize: 26, color: C.green }}>{fmt(218.93 * (1 + noise(t * 5, 2) * 0.002))}</div>
        <Chip color={C.blue} style={{ fontSize: 14, padding: '5px 10px' }}>1m</Chip>
      </div>
      <div style={{ position: 'absolute', left: 44, top: 210 }}>
        <Candles seed={5} n={46} w={640} h={420} progress={io(t, at, at + 1.2, 0.25, 1, Easing.out(Easing.quad))} t={t} />
      </div>
      <div style={{ position: 'absolute', right: 40, top: 140, width: 300, fontFamily: MONO, fontSize: 16 }}>
        <div style={{ color: C.muted, letterSpacing: '0.12em', marginBottom: 12 }}>ORDER BOOK</div>
        {Array.from({ length: rows * 2 }).map((_, i) => {
          const ask = i < rows; const lvl = ask ? rows - i : i - rows + 1;
          const w = 0.25 + 0.7 * Math.abs(noise(t * 2.5 + i * 0.9, i));
          const p = io(t, at + i * 0.025, at + 0.3 + i * 0.025);
          return (
            <div key={i} style={{ position: 'relative', height: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', opacity: p, marginTop: i === rows ? 10 : 0 }}>
              <div style={{ position: 'absolute', right: 0, top: 2, bottom: 2, width: `${w * 100}%`, background: ask ? `${C.red}22` : `${C.green}22`, borderRadius: 3 }} />
              <span style={{ color: ask ? C.red : C.green, position: 'relative' }}>{(218.93 + (ask ? lvl : -lvl) * 0.04).toFixed(2)}</span>
              <span style={{ color: C.muted, position: 'relative' }}>{(w * 40).toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NEWS = [
  { tag: 'Bullish', sym: 'NVDA', head: 'Data-center demand outlook raised', sum: 'Guidance up on AI infrastructure orders.', c: C.green },
  { tag: 'Bullish', sym: 'AAPL', head: 'Services revenue reaches a new high', sum: 'Subscriptions keep margins expanding.', c: C.green },
  { tag: 'Neutral', sym: 'TSLA', head: 'Deliveries land in line with estimates', sum: 'Focus shifts to margins next quarter.', c: C.blue2 },
];

const NewsView: React.FC<{ t: number; at: number }> = ({ t, at }) => (
  <div style={{ position: 'absolute', left: 44, right: 44, top: 140 }}>
    {NEWS.map((n, i) => {
      const p = io(t, at + i * 0.18, at + 0.6 + i * 0.18);
      const typed = Math.round(n.sum.length * io(t, at + 0.3 + i * 0.18, at + 1.1 + i * 0.18, 0, 1, Easing.linear));
      return (
        <div key={i} style={{ display: 'flex', gap: 22, padding: 24, marginBottom: 18, borderRadius: 18, border: `1px solid ${C.line2}`, background: 'rgba(255,255,255,0.03)', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
          <TickerLogo sym={n.sym} size={50} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Chip color={n.c} style={{ fontSize: 14, padding: '4px 10px' }}>{n.tag} · {n.sym}</Chip>
              <span style={{ fontFamily: MONO, fontSize: 14, color: C.dim }}>{2 + i * 3} min ago</span>
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.white, marginTop: 10 }}>{n.head}</div>
            <div style={{ fontFamily: MONO, fontSize: 17, color: C.blue2, marginTop: 8 }}>✦ AI summary: <span style={{ color: C.muted }}>{n.sum.slice(0, typed)}</span></div>
          </div>
        </div>
      );
    })}
  </div>
);

const BASKET = [
  { sym: 'NVDA', w: 30, c: '#76B900' }, { sym: 'MSFT', w: 25, c: C.blue }, { sym: 'AAPL', w: 20, c: '#E8EBF0' }, { sym: 'AMD', w: 15, c: C.green }, { sym: 'AVGO', w: 10, c: '#7DB2FF' },
];

const BasketView: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const R = 150, circ = 2 * Math.PI * R;
  const grow = io(t, at + 0.05, at + 1.0, 0, 1, Easing.out(Easing.cubic));
  let acc = 0;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={400} height={400} style={{ position: 'absolute', left: 70, top: 170, transform: 'rotate(-90deg)' }}>
        <circle cx={200} cy={200} r={R} fill="none" stroke={C.line} strokeWidth={40} />
        {BASKET.map((b) => {
          const len = (b.w / 100) * circ * grow; const off = acc; acc += (b.w / 100) * circ * grow;
          return <circle key={b.sym} cx={200} cy={200} r={R} fill="none" stroke={b.c} strokeWidth={40} strokeDasharray={`${Math.max(0, len - 6)} ${circ}`} strokeDashoffset={-off} />;
        })}
      </svg>
      <div style={{ position: 'absolute', left: 70, top: 170, width: 400, height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 16, color: C.muted, letterSpacing: '0.12em' }}>BASKET</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.white }}>AI Leaders</div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: C.green }}>5 stocks</div>
      </div>
      <div style={{ position: 'absolute', left: 540, top: 180, right: 44 }}>
        {BASKET.map((b, i) => {
          const p = io(t, at + 0.1 + i * 0.08, at + 0.5 + i * 0.08);
          return (
            <div key={b.sym} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: `1px solid ${C.line}`, opacity: p }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: b.c }} />
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: C.white, flex: 1 }}>{b.sym}</div>
              <div style={{ fontFamily: MONO, fontSize: 20, color: C.muted }}>{b.w}%</div>
            </div>
          );
        })}
        <div style={{ marginTop: 26, height: 58, borderRadius: 14, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 22, color: '#04140C', opacity: io(t, at + 0.6, at + 1.0) }}>Buy basket · one transaction</div>
      </div>
    </div>
  );
};

const Features: React.FC<{ t: number }> = ({ t }) => {
  const starts = [0, 1, 2, 3].map((i) => vo(3, i));
  const idx = starts.filter((s) => t >= s - 0.15).length; // 0 = intro (Trading), 1..4
  const active = Math.max(1, idx);
  const panelIn = io(t, S.features - 0.05, S.features + 0.6);
  const views = [StrategyView, TerminalView, NewsView, BasketView];
  const titles = ['Strategy builder', 'Pro terminal', 'AI-powered news', 'Baskets'];
  // Smoothly animate the highlight between rail positions.
  const hl = starts.reduce((acc, s, i) => acc + (i === 0 ? 1 : io(t, s - 0.15, s + 0.25, 0, 1, inout)), 0);
  const PILL = 176, GAP = 10;
  return (
    <AbsoluteFill style={exitStyle(t, S.build)}>
      {/* rail */}
      <div style={{ position: 'absolute', left: 700, top: 120, display: 'flex', gap: GAP, padding: 8, borderRadius: 999, background: 'rgba(12,17,27,0.85)', border: `1px solid ${C.line2}`, opacity: panelIn, transform: `translateY(${(1 - panelIn) * -20}px)` }}>
        <div style={{ position: 'absolute', top: 8, left: 8 + hl * (PILL + GAP), width: PILL, height: 52, borderRadius: 999, background: GRAD, boxShadow: `0 0 30px ${C.blue}66` }} />
        {FEATURES.map((f, i) => (
          <div key={f} style={{ position: 'relative', width: PILL, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: SANS, fontWeight: 600, fontSize: 21, color: i === active ? '#04060B' : i < active ? C.white : C.muted }}>
            {i < active && <span style={{ color: i === active ? '#04060B' : C.green, fontSize: 16 }}>✓</span>}{f}
          </div>
        ))}
      </div>
      {/* main panel */}
      <Glass glow="rgba(76,141,255,0.12)" style={{ left: 700, top: 210, width: 1130, height: 700, opacity: panelIn, transform: `perspective(1600px) rotateY(${(1 - panelIn) * -18 - 4}deg) translateX(${(1 - panelIn) * 120}px)`, transformOrigin: '0% 50%' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c, opacity: 0.85 }} />)}
          <div style={{ marginLeft: 18, display: 'flex', alignItems: 'center', gap: 10 }}><Mark size={20} /><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, color: C.white }}>Dexstock</span></div>
          <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 15, color: C.muted }}>0x7a3c…f91e</div>
        </div>
        {views.map((V, i) => {
          const s = starts[i]; const e = starts[i + 1] ?? S.build + 1;
          if (t < s - 0.4 || t > e + 0.3) return null;
          const inP = io(t, s - 0.15, s + 0.45);
          const outP = io(t, e - 0.2, e + 0.15, 0, 1, inout);
          return (
            <div key={i} style={{ position: 'absolute', inset: 0, opacity: inP * (1 - outP), transform: `translateX(${(1 - inP) * 80 - outP * 80}px)`, filter: (1 - inP) + outP > 0.02 ? `blur(${((1 - inP) + outP) * 10}px)` : undefined }}>
              <div style={{ position: 'absolute', left: 44, top: 80, display: 'flex', alignItems: 'baseline', gap: 18 }}>
                <span style={{ fontFamily: MONO, fontSize: 20, color: C.blue2 }}>0{i + 2}</span>
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.white, letterSpacing: '-0.03em' }}>{titles[i]}</span>
              </div>
              <V t={t} at={s} />
            </div>
          );
        })}
      </Glass>
    </AbsoluteFill>
  );
};

/* ---------------------------------- 5. Build ---------------------------------- */

const MiniPanel: React.FC<{ style: React.CSSProperties; title: string; children?: React.ReactNode }> = ({ style, title, children }) => (
  <div style={{ position: 'absolute', borderRadius: 16, background: 'rgba(14,19,30,0.92)', border: `1px solid ${C.line2}`, overflow: 'hidden', ...style }}>
    <div style={{ fontFamily: MONO, fontSize: 14, color: C.muted, letterSpacing: '0.12em', padding: '14px 18px' }}>{title}</div>
    {children}
  </div>
);

const Build: React.FC<{ t: number }> = ({ t }) => {
  const a = vo(4, 0), b = vo(4, 1);
  const s0 = S.build;
  const cam = io(t, s0 - 0.2, S.end, 0, 1, Easing.inOut(Easing.sin));
  const p = (i: number) => io(t, s0 - 0.1 + i * 0.07, s0 + 0.6 + i * 0.07);
  const ps = (i: number): React.CSSProperties => ({ opacity: p(i), transform: `translateZ(${(1 - p(i)) * -400}px)` });
  const dataA = useMemo(() => walk(7, 120, 0.012, 0.003), []);
  const dataB = useMemo(() => walk(17, 50, 0.02, 0.004), []);
  const zoom = io(t, S.end - 0.45, S.end, 0, 1, Easing.in(Easing.cubic));
  return (
    <AbsoluteFill style={{ opacity: 1 - zoom * 0.9 }}>
      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '50% 40%' }}>
        <div style={{
          position: 'absolute', left: 160, top: 120, width: 1600, height: 900, transformStyle: 'preserve-3d',
          transform: `translateZ(${cam * 260 + zoom * 900}px) rotateX(${30 - cam * 12}deg) rotateZ(${-8 + cam * 5}deg)`,
        }}>
          <MiniPanel title="NVDA · 1D" style={{ left: 0, top: 0, width: 1000, height: 520, ...ps(0) }}>
            <div style={{ padding: '10px 24px' }}><LineChart data={dataA} w={950} h={420} progress={io(t, s0, s0 + 2.5, 0.1, 1)} color={C.blue} /></div>
          </MiniPanel>
          <MiniPanel title="ORDER BOOK" style={{ left: 1030, top: 0, width: 570, height: 520, ...ps(1) }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ margin: '6px 18px', height: 22, borderRadius: 4, width: `${30 + 60 * Math.abs(noise(t * 2 + i, i))}%`, background: i < 7 ? `${C.red}30` : `${C.green}30` }} />
            ))}
          </MiniPanel>
          <MiniPanel title="STRATEGY · RUNNING" style={{ left: 0, top: 550, width: 480, height: 350, ...ps(2) }}>
            <div style={{ padding: '0 18px' }}><LineChart data={dataB} w={440} h={250} progress={io(t, s0 + 0.2, s0 + 2.2)} /></div>
          </MiniPanel>
          <MiniPanel title="AI NEWS" style={{ left: 510, top: 550, width: 490, height: 350, ...ps(3) }}>
            {NEWS.map((n) => <div key={n.sym} style={{ margin: '10px 18px', padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontFamily: SANS, fontSize: 20, color: C.white }}><span style={{ color: n.c, fontFamily: MONO, fontSize: 15 }}>{n.sym} </span>{n.head}</div>)}
          </MiniPanel>
          <MiniPanel title="BASKETS" style={{ left: 1030, top: 550, width: 570, height: 350, ...ps(4) }}>
            <div style={{ display: 'flex', gap: 10, padding: '20px 18px' }}>
              {BASKET.map((x) => <div key={x.sym} style={{ flex: x.w, height: 200, borderRadius: 10, background: x.c, opacity: 0.85 }} />)}
            </div>
          </MiniPanel>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(4,6,11,0.92) 0%, rgba(4,6,11,0.6) 40%, rgba(4,6,11,0.1) 75%)', opacity: io(t, a - 0.2, a + 0.4) }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <Kinetic t={t} at={a} size={124} text="Professional trading," stagger={0.12} style={{ justifyContent: 'center' }} />
        <Kinetic t={t} at={b} size={124} text="fully on-chain." gradient={GRAD} stagger={0.12} style={{ justifyContent: 'center' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------------------------- 6. End ---------------------------------- */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end;
  const a = vo(5, 0), b = vo(5, 1);
  const flash = io(t, s0 - 0.05, s0 + 0.05, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.05, s0 + 0.8, 0, 1, Easing.out(Easing.quad)));
  const markP = io(t, s0 + 0.15, s0 + 1.0);
  const sweep = io(t, s0 + 0.3, s0 + 1.4, 0, 1, inout);
  const url = io(t, b + 0.6, b + 1.2);
  const fadeOut = io(t, 29.55, 30, 0, 1, Easing.linear);
  const letters = 'dexstock'.split('');
  return (
    <AbsoluteFill style={{ opacity: 1 - fadeOut }}>
      <div style={{ position: 'absolute', left: 950, top: 300, width: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ position: 'relative', transform: `scale(${0.6 + markP * 0.4})`, opacity: markP, filter: `drop-shadow(0 0 ${40 * markP}px ${C.blue}aa)` }}>
            <div style={{ clipPath: `inset(${(1 - markP) * 100}% 0 0 0)` }}><Mark size={150} /></div>
          </div>
          <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 600, fontSize: 170, letterSpacing: '-0.045em', color: C.white, lineHeight: 1 }}>
            {letters.map((l, i) => {
              const p = io(t, a - 0.05 + i * 0.04, a + 0.5 + i * 0.04);
              return <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 50}px)`, filter: `blur(${(1 - p) * 10}px)` }}>{l}</span>;
            })}
          </div>
        </div>
        {/* light sweep over the lockup */}
        <div style={{ position: 'absolute', left: -100, top: -40, width: 1000, height: 260, overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'overlay' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 160, left: -200 + sweep * 1300, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)', transform: 'skewX(-20deg)' }} />
        </div>
        <div style={{ height: 2, width: 820 * io(t, a + 0.3, a + 1.2), background: GRAD, marginTop: 40, boxShadow: `0 0 18px ${C.blue}` }} />
        <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 22 }}>
          <Kinetic t={t} at={b} size={84} text="Always open." stagger={0.14} gradient={GRAD} />
        </div>
        <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 22, opacity: url, transform: `translateY(${(1 - url) * 16}px)` }}>
          <Chip color={C.green}><LiveDot t={t} /> Tokenised stocks · 24/7 · Robinhood Chain</Chip>
          <span style={{ fontFamily: MONO, fontSize: 26, color: C.white, letterSpacing: '0.04em' }}>dexstock.app</span>
        </div>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(160,200,255,${flash * 0.9}), rgba(76,141,255,${flash * 0.4}) 40%, rgba(4,6,11,0) 80%)` }} />
    </AbsoluteFill>
  );
};

/* ---------------------------------- Film ---------------------------------- */

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / T.fps;
  const tape = io(t, 1.2, 2.2) * (1 - io(t, S.custody - 0.4, S.custody));
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS }}>
      <Audio src={staticFile('mix.wav')} />
      <Background t={t} />
      {between(t, 0, S.always) && <Hook t={t} />}
      {between(t, S.always - 0.3, S.custody) && <AlwaysOpen t={t} />}
      {between(t, S.custody - 0.3, S.features) && <Custody t={t} />}
      {between(t, S.features - 0.3, S.build) && <Features t={t} />}
      {between(t, S.build - 0.4, S.end) && <Build t={t} />}
      <PresenterRig t={t} frame={frame} />
      {t >= S.end - 0.1 && <End t={t} />}
      <TickerTape t={t} opacity={tape} />
      {/* vignette + grain + letterbox */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.05, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: C.bg, opacity: 1 - io(t, 0, 0.6, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};

