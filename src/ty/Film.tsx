import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import mouth from './mouth.json';
import { Host } from './Presenter';
import { C, Card, ChainBadge, CHAINS, Chip, Eyebrow, Kinetic, LiveDot, MONO, Mark, SANS, TRIDENT, Token, Wordmark, backOut, fmt, hash, inout, io, noise } from './ui';

const S = T.scenes;
const FPS = T.fps;
const wi = (seg: number, i: number) => Number(T.vo[seg].words[i][0]);
const between = (t: number, a: number, b: number) => t >= a - 0.05 && t < b + 0.05;
const exitStyle = (t: number, end: number, dx = -1): React.CSSProperties => {
  const o = io(t, end - 0.32, end, 0, 1, inout);
  return { opacity: 1 - o, transform: `translateX(${dx * o * 120}px) scale(${1 - o * 0.03})`, filter: o > 0.02 ? `blur(${o * 12}px)` : undefined };
};
const rise = (t: number, a: number, d = 0.55, dist = 36): React.CSSProperties => {
  const p = io(t, a, a + d);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};
const HITS = [0.62, S.end + 0.1];

/* ------------------------------ background ------------------------------ */

/** Orthogonal "metro map" routes with packets travelling along them. */
const ROUTES = Array.from({ length: 14 }, (_, i) => {
  const y0 = 80 + hash(i * 2.3) * 920, x1 = 200 + hash(i * 4.1) * 1500, y1 = 80 + hash(i * 6.7) * 920;
  return `M-40 ${y0.toFixed(0)} H${x1.toFixed(0)} L${(x1 + Math.abs(y1 - y0) * 0.6).toFixed(0)} ${y1.toFixed(0)} H1980`;
});
const Background: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: 1700, height: 1700, borderRadius: 1700, left: -500 + noise(t * 0.12, 1) * 200, top: -1000, background: 'radial-gradient(circle, rgba(0,233,151,0.085), rgba(0,233,151,0) 60%)' }} />
    <div style={{ position: 'absolute', width: 1400, height: 1400, borderRadius: 1400, left: 1000 + noise(t * 0.1, 4) * 220, top: 380, background: 'radial-gradient(circle, rgba(0,233,151,0.06), rgba(0,233,151,0) 60%)' }} />
    <AbsoluteFill style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)', backgroundSize: '64px 64px', backgroundPosition: `${-t * 6}px ${-t * 3}px`, maskImage: 'radial-gradient(ellipse at 50% 45%, black 15%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 15%, transparent 75%)' }} />
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      {ROUTES.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="rgba(0,233,151,0.06)" strokeWidth={1.5} />
          <path d={d} fill="none" stroke={C.green} strokeWidth={2} strokeDasharray="2 400" strokeDashoffset={-(t * (160 + hash(i) * 200) + hash(i * 9) * 400)} strokeLinecap="round" opacity={0.5} />
        </g>
      ))}
    </svg>
  </AbsoluteFill>
);

/** Transition: a bright route line sweeps across with a light trail. */
const RouteWipe: React.FC<{ t: number }> = ({ t }) => {
  const at = [S.layer, S.intent, S.routes, S.terminal, S.eco, S.end].find((s) => t > s - 0.35 && t < s + 0.25);
  if (at === undefined) return null;
  const p = (t - (at - 0.35)) / 0.6;
  const x = -200 + p * 2400;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: x - 600, top: 0, width: 600, height: 1080, background: 'linear-gradient(90deg, transparent, rgba(0,233,151,0.07))' }} />
      <div style={{ position: 'absolute', left: x, top: 0, width: 3, height: 1080, background: C.green, boxShadow: `0 0 30px ${C.green}, 0 0 90px ${C.green}` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ host rig ------------------------------ */

// Rig anchor (ax, ay) in the 800x1000 host space is placed at screen (sx, sy) with scale s.
const K = {
  t: [0, 0.35, 1.75, 3.05, 3.5, 6.85, 7.3, 10.95, 11.4, 15.25, 15.7, 21.15, 21.6, 26.1, 26.7, 30],
  ax: [352, 352, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
  ay: [356, 356, 420, 420, 420, 420, 420, 420, 420, 420, 420, 420, 420, 420, 420, 420],
  sx: [960, 960, 520, 520, 1565, 1565, 375, 375, 1565, 1565, 375, 375, 1565, 1565, 520, 520],
  sy: [540, 540, 560, 560, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 560, 560],
  s: [5.6, 5.1, 1.05, 1.05, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.05, 1.08],
  look: [0, 0, 0.5, 0.5, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 0.5, 0.5],
};
const kf = (t: number, a: number[]) => interpolate(t, K.t, a, { easing: inout, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const phraseStarts = T.vo.flatMap((v) => v.words.filter((_, i) => i === 0 || /[.,]$/.test(String(v.words[i - 1][2]))).map((x) => Number(x[0])));

const HostRig: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const s = kf(t, K.s), ax = kf(t, K.ax), ay = kf(t, K.ay), sx = kf(t, K.sx), sy = kf(t, K.sy);
  const cam = Math.max(0, ...T.vo.map((v) => io(t, v.at - 0.25, v.at) * (1 - io(t, v.at + 1.0, v.at + 1.4))));
  const look = kf(t, K.look) * (1 - cam * 0.85);
  const emphasis = Math.max(0, ...phraseStarts.map((p) => (t >= p - 0.1 && t < p + 0.6 ? Math.sin(((t - p + 0.1) / 0.7) * Math.PI) : 0)));
  const i = Math.min(mouth.vis.length - 1, frame);
  const intro = io(t, 0, 0.35, 0, 1, Easing.linear);
  const lensMark = 1 - io(t, 1.2, 1.7);
  const hud = Math.max(io(t, S.intent, S.intent + 0.4) * (1 - io(t, S.routes - 0.3, S.routes)), io(t, S.terminal, S.terminal + 0.4) * (1 - io(t, S.eco - 0.3, S.eco)));
  const smile = 0.25 + io(t, 28.9, 29.4) * 0.6;
  // depth of field: soft while the camera is pushed into the lens
  const blur = Math.max(0, (s - 2.4) * 0.5) * (1 - io(t, 0.0, 0.3));
  return (
    <div style={{ position: 'absolute', left: sx - ax * s, top: sy - ay * s, width: 800 * s, height: 1000 * s, opacity: intro, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
      <div style={{ position: 'absolute', left: 120 * s, top: 120 * s, width: 560 * s, height: 560 * s, borderRadius: 1000 * s, background: 'radial-gradient(circle, rgba(0,233,151,0.13), rgba(0,233,151,0) 65%)' }} />
      <Host t={t} vis={mouth.vis} frame={i} level={mouth.level[i]} emphasis={emphasis * 0.8} look={[look, 0.05]} smile={smile} lensFx={hud} lensMark={lensMark} led={0.5 + 0.5 * Math.sin(t * 3)} />
    </div>
  );
};

/* ------------------------------ 1. hook ------------------------------ */

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const mk = wi(0, 3);
  return (
    <AbsoluteFill style={exitStyle(t, S.layer)}>
      <div style={{ position: 'absolute', left: 1000, top: 330 }}><Wordmark height={104} t={t} at={1.3} /></div>
      <div style={{ position: 'absolute', left: 1006, top: 500 }}>
        <Kinetic t={t} at={mk - 0.05} size={92} text="Markets, routed." accent={['routed.']} stagger={0.16} weight={500} />
      </div>
      <div style={{ position: 'absolute', left: 1008, top: 640, display: 'flex', gap: 12, ...rise(t, wi(0, 4) + 0.2, 0.5, 14) }}>
        <Chip><LiveDot t={t} /> Routes to Robinhood Chain</Chip>
        <Chip color={C.muted}>Cross-chain asset mobility</Chip>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 2. routing layer ------------------------------ */

const SRC = [
  { id: 'eth', x: 190, y: 330 }, { id: 'arb', x: 150, y: 540 }, { id: 'base', x: 210, y: 750 },
  { id: 'hyper', x: 420, y: 250 }, { id: 'sol', x: 400, y: 860 },
];
const HUB = { x: 820, y: 560 };
const DEST = [{ l: 'Spot', y: 400 }, { l: 'Terminal', y: 560 }, { l: 'Portfolio', y: 720 }];

const Layer: React.FC<{ t: number }> = ({ t }) => {
  const clean = io(t, wi(1, 1) - 0.1, wi(1, 3) + 0.4, 0, 1, Easing.inOut(Easing.cubic));
  const into = wi(1, 4), across = wi(1, 6), rh = wi(1, 7);
  const hubOn = io(t, wi(1, 2), wi(1, 2) + 0.5, 0, 1, backOut);
  const MID = { x: 600, y: 560 };
  return (
    <AbsoluteFill style={exitStyle(t, S.intent)}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}><Eyebrow t={t} at={S.layer + 0.1}>CROSS-CHAIN ASSET MOBILITY</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 112 }}>
        <Kinetic t={t} at={wi(1, 0) - 0.05} size={66} text="The clean routing layer." accent={['routing']} stagger={0.08} />
      </div>
      <svg width={1200} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {SRC.map((n, i) => {
          // tangled bridge paths straighten into one clean lane through the TickerYard node
          const wob = (1 - clean) * 160;
          const c1x = n.x + 140 + Math.sin(i * 2.1) * wob, c1y = n.y + Math.cos(i * 1.7) * wob * 1.4;
          const c2x = MID.x - 120 + Math.cos(i * 3.3) * wob, c2y = MID.y + Math.sin(i * 2.9) * wob * 1.6;
          const d = `M${n.x + 26} ${n.y} C${c1x} ${c1y} ${c2x} ${c2y} ${MID.x} ${MID.y}`;
          const p = io(t, S.layer + 0.1 + i * 0.07, S.layer + 0.7 + i * 0.07);
          const flow = io(t, into - 0.1, into + 0.3);
          return (
            <g key={n.id} opacity={p}>
              <path d={d} fill="none" stroke={clean > 0.6 ? 'rgba(0,233,151,0.35)' : 'rgba(255,255,255,0.18)'} strokeWidth={2} strokeDasharray={clean < 0.6 ? '6 6' : undefined} />
              {flow > 0 && <path d={d} fill="none" stroke={C.green} strokeWidth={3} strokeDasharray="10 150" strokeDashoffset={-t * 340 - i * 40} strokeLinecap="round" opacity={flow} style={{ filter: `drop-shadow(0 0 6px ${C.green})` }} />}
              <text x={(n.x + MID.x) / 2 - 30} y={(n.y + MID.y) / 2 - 12 + (1 - clean) * 30} fill={C.dim} fontFamily={MONO} fontSize={13} opacity={1 - clean}>bridge {String.fromCharCode(65 + i)}</text>
            </g>
          );
        })}
        {/* single clean lane: TickerYard node -> Robinhood Chain */}
        <path d={`M${MID.x} ${MID.y} L${HUB.x - 40} ${HUB.y}`} stroke={C.green} strokeWidth={3} opacity={hubOn} />
        <path d={`M${MID.x} ${MID.y} L${HUB.x - 40} ${HUB.y}`} stroke="#fff" strokeWidth={3} strokeDasharray="8 26" strokeDashoffset={-t * 300} opacity={hubOn * io(t, into, into + 0.3)} />
        {DEST.map((d, i) => {
          const p = io(t, across - 0.1 + i * 0.1, across + 0.35 + i * 0.1);
          const path = `M${HUB.x + 40} ${HUB.y} C${HUB.x + 110} ${HUB.y} ${HUB.x + 110} ${d.y} ${HUB.x + 180} ${d.y}`;
          return (
            <g key={d.l} opacity={p}>
              <path d={path} stroke="rgba(0,233,151,0.5)" strokeWidth={2} fill="none" strokeDasharray="300" strokeDashoffset={300 * (1 - p)} />
              <path d={path} stroke={C.green} strokeWidth={3} fill="none" strokeDasharray="8 120" strokeDashoffset={-t * 260} />
            </g>
          );
        })}
      </svg>
      {SRC.map((n, i) => (
        <div key={n.id} style={{ position: 'absolute', left: n.x - 26, top: n.y - 26, display: 'flex', alignItems: 'center', gap: 10, ...rise(t, S.layer + 0.1 + i * 0.07, 0.5, 20) }}>
          <ChainBadge id={n.id} size={52} />
          <span style={{ fontFamily: SANS, fontSize: 15, color: C.muted, position: 'absolute', top: 58, left: -10, whiteSpace: 'nowrap' }}>{CHAINS[n.id].name}</span>
        </div>
      ))}
      {/* TickerYard node */}
      <div style={{ position: 'absolute', left: MID.x - 40, top: MID.y - 40, width: 80, height: 80, borderRadius: 22, background: '#0B0F0C', border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${hubOn})`, boxShadow: `0 0 40px ${C.green}66` }}>
        <Mark size={48} glow={0.6} />
      </div>
      {/* Robinhood Chain hub */}
      <div style={{ position: 'absolute', left: HUB.x - 44, top: HUB.y - 44, transform: `scale(${io(t, into - 0.2, into + 0.3, 0, 1, backOut)})` }}>
        <ChainBadge id="rh" size={88} glow={0.6 + 0.4 * io(t, rh, rh + 0.4)} />
      </div>
      <div style={{ position: 'absolute', left: HUB.x - 110, top: HUB.y + 58, width: 220, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 19, color: C.white, ...rise(t, rh - 0.1, 0.4, 10) }}>Robinhood Chain</div>
      {DEST.map((d, i) => (
        <div key={d.l} style={{ position: 'absolute', left: HUB.x + 190, top: d.y - 20, ...rise(t, across + i * 0.1, 0.4, 10) }}>
          <Chip color={C.green} style={{ fontSize: 17 }}>{d.l}</Chip>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 110, top: 940, ...rise(t, into, 0.5, 16) }}>
        <Kinetic t={t} at={into - 0.05} size={40} text="Into, and across, Robinhood Chain." color={C.muted} weight={400} stagger={0.07} accent={['Robinhood', 'Chain.']} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 3. intent ------------------------------ */

const INTENT = 'Move 0.25 WBTC from Arbitrum One to Robinhood Chain';
const Intent: React.FC<{ t: number }> = ({ t }) => {
  const tell = wi(2, 0), finds = wi(2, 6), best = wi(2, 8), exe = wi(2, 11);
  const typed = Math.round(INTENT.length * io(t, tell + 0.05, wi(2, 4) + 0.55, 0, 1, Easing.linear));
  const X0 = 790;
  const A = { x: 110, y: 230 }, B = { x: 950, y: 230 };
  const paths = [
    { d: `M${A.x} ${A.y} C${A.x + 260} ${A.y - 140} ${B.x - 260} ${A.y - 140} ${B.x} ${B.y}`, l: 'Alt route · 2 hops', fee: '0.6%', eta: '≈31 min' },
    { d: `M${A.x} ${A.y} L${B.x} ${B.y}`, l: 'yBTC bridge', fee: '0.30% destination fee', eta: '≈18 min' },
    { d: `M${A.x} ${A.y} C${A.x + 260} ${A.y + 140} ${B.x - 260} ${A.y + 140} ${B.x} ${B.y}`, l: 'Alt route · 3 hops', fee: '0.9%', eta: '≈44 min' },
  ];
  const scan = io(t, finds - 0.1, best, 0, 1, Easing.linear);
  const pick = io(t, best - 0.05, best + 0.35);
  const press = Math.sin(io(t, exe - 0.05, exe + 0.15, 0, 1, Easing.linear) * Math.PI);
  const steps = ['Deposit WBTC · Arbitrum One', 'Lock in vault', 'Mint yBTC · Robinhood Chain', 'Delivered'];
  return (
    <AbsoluteFill style={exitStyle(t, S.routes, 1)}>
      <div style={{ position: 'absolute', left: X0, top: 70 }}><Eyebrow t={t} at={S.intent + 0.1}>INTENT → ROUTE → EXECUTE</Eyebrow></div>
      {/* command bar */}
      <Card glow={0.4} active={io(t, tell, tell + 0.3) * (1 - pick * 0.6)} style={{ left: X0, top: 116, width: 1030, height: 96, ...rise(t, S.intent, 0.5, 30) }}>
        <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 18 }}>
          <Mark size={30} glow={0.3} />
          <span style={{ fontFamily: MONO, fontSize: 25, color: C.white }}>
            {INTENT.slice(0, typed).split(/(WBTC|Arbitrum One|Robinhood Chain)/).map((s, i) => <span key={i} style={{ color: /WBTC|Arbitrum One|Robinhood Chain/.test(s) ? C.green : undefined }}>{s}</span>)}
            <span style={{ opacity: Math.floor(t * 3) % 2 ? 1 : 0, color: C.green }}>▌</span>
          </span>
        </div>
        <div style={{ position: 'absolute', right: 24, top: 28, fontFamily: MONO, fontSize: 14, color: C.dim, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8 }}>⏎ route</div>
      </Card>
      {/* route search */}
      <Card glow={0.3} style={{ left: X0, top: 240, width: 1030, height: 470, ...rise(t, wi(2, 4), 0.5, 30) }}>
        <svg width={1030} height={470} style={{ position: 'absolute', inset: 0 }}>
          {paths.map((p, i) => {
            const isBest = i === 1;
            const op = isBest ? 1 : 1 - pick * 0.75;
            return (
              <g key={i} opacity={op}>
                <path d={p.d} fill="none" stroke={isBest && pick > 0 ? C.green : 'rgba(255,255,255,0.2)'} strokeWidth={isBest ? 2 + pick * 3 : 2} style={{ filter: isBest && pick > 0 ? `drop-shadow(0 0 10px ${C.green})` : undefined }} />
                {scan > 0 && scan < 1 && <path d={p.d} fill="none" stroke={C.green} strokeWidth={3} strokeDasharray="14 1200" strokeDashoffset={-scan * 1000 - i * 60} />}
                {isBest && t > exe && <path d={p.d} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="10 40" strokeDashoffset={-t * 400} />}
              </g>
            );
          })}
        </svg>
        {[A, B].map((n, i) => (
          <div key={i} style={{ position: 'absolute', left: n.x - 40 + (i ? 0 : 0), top: n.y - 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 80 }}>
            <ChainBadge id={i ? 'rh' : 'arb'} size={72} glow={i ? 0.3 + pick * 0.5 : 0.3} />
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 16, color: C.white, whiteSpace: 'nowrap' }}>{i ? 'Robinhood Chain' : 'Arbitrum One'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 14, color: C.muted, whiteSpace: 'nowrap' }}><Token sym={i ? 'yBTC' : 'WBTC'} size={20} />{i ? '0.25 yBTC' : '0.25 WBTC'}</div>
          </div>
        ))}
        {paths.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: 380, top: [96, 196, 326][i], padding: '8px 14px', borderRadius: 10, background: i === 1 && pick > 0 ? C.accentSurface : 'rgba(10,11,11,0.9)', border: `1px solid ${i === 1 && pick > 0 ? C.green + '88' : C.border}`, opacity: io(t, finds + i * 0.08, finds + 0.3 + i * 0.08) * (i === 1 ? 1 : 1 - pick * 0.6), display: 'flex', gap: 14, alignItems: 'center', fontFamily: SANS, fontSize: 15, color: C.white }}>
            {i === 1 && pick > 0.5 && <span style={{ color: C.green, fontWeight: 700 }}>BEST</span>}
            <span style={{ fontWeight: 600 }}>{p.l}</span><span style={{ color: C.muted }}>{p.fee}</span><span style={{ color: C.muted }}>{p.eta}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 24, display: 'flex', gap: 10 }}>
          {steps.map((s, i) => {
            const done = io(t, exe + 0.15 + i * 0.16, exe + 0.3 + i * 0.16);
            return (
              <div key={s} style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1px solid ${done > 0.5 ? C.green + '77' : C.border}`, background: done > 0.5 ? C.accentSurface : 'rgba(255,255,255,0.02)', fontFamily: SANS, fontSize: 15, color: done > 0.5 ? C.white : C.dim, display: 'flex', alignItems: 'center', gap: 10, opacity: io(t, exe - 0.1, exe + 0.2) }}>
                <span style={{ width: 22, height: 22, borderRadius: 22, background: done > 0.5 ? C.green : 'transparent', border: `1.5px solid ${done > 0.5 ? C.green : C.border}`, color: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transform: `scale(${0.6 + done * 0.4})` }}>{done > 0.5 ? '✓' : ''}</span>
                {s}
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ position: 'absolute', left: X0, top: 740, width: 1030, height: 72, borderRadius: 14, background: C.green, color: C.greenDeep, fontFamily: SANS, fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transform: `scale(${1 - press * 0.03})`, boxShadow: `0 0 ${30 + press * 50}px rgba(0,233,151,0.45)`, ...rise(t, best + 0.1, 0.4, 20) }}>
        {t > exe + 0.85 ? '✓ Routed · 0.25 yBTC on Robinhood Chain' : 'Execute route'}
      </div>
      <div style={{ position: 'absolute', left: X0, top: 860 }}>
        <Kinetic t={t} at={tell - 0.05} size={54} text="Tell it what to move." stagger={0.08} />
        <div style={{ marginTop: 6 }}><Kinetic t={t} at={wi(2, 5) - 0.05} size={54} text="It finds the best path." accent={['best', 'path.']} stagger={0.08} color={C.muted} /></div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 4. routes ------------------------------ */

const Routes: React.FC<{ t: number }> = ({ t }) => {
  const bridge = wi(3, 0), ybtc = wi(3, 3), crop = wi(3, 7), route = wi(3, 4);
  const assets = [
    { s: 'yZEC', from: 'zec', name: 'Yard Wrapped Zcash' },
    { s: 'yBoop', from: 'sol', name: 'Yard Wrapped Boop' },
    { s: 'yWHYPE', from: 'hyper', name: 'Yard Wrapped HYPE' },
    { s: 'yrHOOD', from: 'eth', name: 'Yard rHOOD' },
  ];
  const v2 = io(t, crop + 0.2, crop + 0.4) > 0.5;
  return (
    <AbsoluteFill style={exitStyle(t, S.terminal)}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}><Eyebrow t={t} at={S.routes + 0.1}>ROUTES</Eyebrow></div>
      <div style={{ position: 'absolute', left: 110, top: 112 }}>
        <Kinetic t={t} at={bridge - 0.05} size={62} text="Every route. One clean interface." accent={['One']} stagger={0.08} />
      </div>
      {/* yBTC bridge */}
      <Card glow={0.35} active={io(t, ybtc, ybtc + 0.3) * (1 - io(t, route - 0.2, route + 0.2)) * 0.6} style={{ left: 110, top: 230, width: 500, height: 600, ...rise(t, bridge - 0.1, 0.55, 40) }}>
        <div style={{ position: 'absolute', left: 28, top: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Token sym="yBTC" size={52} />
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.white }}>yBTC</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>WBTC BRIDGE</div>
          </div>
        </div>
        {/* vault -> receipt flow */}
        <div style={{ position: 'absolute', left: 28, right: 28, top: 120, height: 260 }}>
          {[{ y: 0, id: 'arb', tok: 'WBTC', l: 'Vault · Arbitrum One' }, { y: 170, id: 'rh', tok: 'yBTC', l: 'Receipt · Robinhood Chain' }].map((n, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: n.y, height: 88, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', ...rise(t, bridge + 0.2 + i * 0.5, 0.45, 16) }}>
              <ChainBadge id={n.id} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 20, color: C.white }}>{n.tok}</div>
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{n.l}</div>
              </div>
              <Token sym={n.tok} size={36} />
            </div>
          ))}
          <svg width={444} height={90} style={{ position: 'absolute', left: 0, top: 86 }}>
            {[150, 290].map((x, k) => (
              <g key={k}>
                <line x1={x} x2={x} y1={0} y2={84} stroke="rgba(0,233,151,0.35)" strokeWidth={2} />
                <line x1={x} x2={x} y1={0} y2={84} stroke={C.green} strokeWidth={3} strokeDasharray="8 24" strokeDashoffset={(k ? 1 : -1) * t * 120} opacity={io(t, wi(3, 2), wi(3, 2) + 0.3)} />
                <path d={k ? `M${x - 7} 10 L${x} 0 L${x + 7} 10` : `M${x - 7} 74 L${x} 84 L${x + 7} 74`} stroke={C.green} strokeWidth={2.5} fill="none" opacity={io(t, wi(3, 2), wi(3, 2) + 0.3)} />
              </g>
            ))}
          </svg>
        </div>
        <div style={{ position: 'absolute', left: 28, right: 28, top: 410, fontFamily: SANS, fontSize: 16, lineHeight: 1.5, color: C.muted, ...rise(t, ybtc, 0.45, 12) }}>A receipt for WBTC held in a vault on Arbitrum One — moved 1:1 to and from Robinhood Chain.</div>
        <div style={{ position: 'absolute', left: 28, bottom: 26, display: 'flex', gap: 10, ...rise(t, ybtc + 0.3, 0.4, 12) }}>
          <Chip>0.30% destination fee</Chip><Chip color={C.muted}>≈18 min</Chip>
        </div>
      </Card>
      {/* CROP routes */}
      <Card glow={0.35} active={io(t, crop - 0.1, crop + 0.3) * 0.6} style={{ left: 640, top: 230, width: 510, height: 600, ...rise(t, route - 0.2, 0.55, 40) }}>
        <div style={{ position: 'absolute', left: 28, top: 26, right: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.white }}>CROP routes</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>ASSETS INTO ROBINHOOD CHAIN</div>
          </div>
          <div style={{ display: 'flex', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {['V1', 'V2'].map((v, k) => <div key={v} style={{ padding: '6px 14px', fontFamily: SANS, fontWeight: 600, fontSize: 14, background: (k === 1) === v2 ? C.surface : 'transparent', color: (k === 1) === v2 ? C.white : C.muted }}>{v}</div>)}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 20, right: 20, top: 118 }}>
          {assets.map((a, i) => {
            const p = io(t, crop - 0.15 + i * 0.1, crop + 0.25 + i * 0.1);
            return (
              <div key={a.s} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 96, padding: '0 14px', marginBottom: 10, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: `1px solid ${C.border}`, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
                <ChainBadge id={a.from} size={36} />
                <svg width={110} height={20}><line x1={0} x2={110} y1={10} y2={10} stroke="rgba(0,233,151,0.3)" strokeWidth={2} /><line x1={0} x2={110} y1={10} y2={10} stroke={C.green} strokeWidth={3} strokeDasharray="6 30" strokeDashoffset={-t * 120 - i * 9} /></svg>
                <Token sym={a.s} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 20, color: C.white }}>{a.s}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>{a.name}</div>
                </div>
                <ChainBadge id="rh" size={32} />
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ position: 'absolute', left: 110, top: 870, display: 'flex', gap: 14, alignItems: 'center', ...rise(t, crop + 0.2, 0.45, 14) }}>
        <span style={{ fontFamily: SANS, fontSize: 22, color: C.muted }}>Bridges abstracted. Paths optimized. One interface.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5. terminal ------------------------------ */

const ORDER_TYPES = ['Market', 'Limit', 'Stop', 'OCO', 'TWAP'];
const Terminal: React.FC<{ t: number }> = ({ t }) => {
  const at = [wi(4, 4), wi(4, 5), wi(4, 6), wi(4, 7), wi(4, 8)];
  const active = at.reduce((a, s, i) => (t >= s - 0.08 ? i : a), -1);
  const X0 = 780, W = 1050;
  const N = 54;
  const candles = useMemo(() => {
    const out: { o: number; c: number; h: number; l: number; v: number }[] = [];
    let p = 0.00071;
    for (let i = 0; i < N; i++) {
      const d = (hash(i * 3.7) - 0.47) * 0.06 + Math.sin(i * 0.25) * 0.012;
      const o = p, c = p * (1 + d);
      out.push({ o, c, h: Math.max(o, c) * (1 + hash(i * 1.9) * 0.025), l: Math.min(o, c) * (1 - hash(i * 5.3) * 0.025), v: 0.2 + hash(i * 7.1) * 0.8 });
      p = c;
    }
    return out;
  }, []);
  const lo = Math.min(...candles.map((c) => c.l)) * 0.97, hi = Math.max(...candles.map((c) => c.h)) * 1.03;
  const CW = 700, CH = 470;
  const y = (v: number) => CH - ((v - lo) / (hi - lo)) * CH;
  const shown = Math.floor(N * io(t, S.terminal, wi(4, 3) + 0.6, 0.35, 1, Easing.inOut(Easing.quad)));
  const last = candles[Math.max(0, shown - 1)].c;
  const lim = last * 0.955, stop = last * 0.93, tp = last * 1.06;
  const line = (v: number, c: string, label: string, p: number, dash = '8 6') => (
    <g opacity={p}>
      <line x1={0} x2={CW * p} y1={y(v)} y2={y(v)} stroke={c} strokeWidth={2} strokeDasharray={dash} />
      <rect x={CW - 120} y={y(v) - 14} width={120} height={28} rx={6} fill="#0A0B0B" stroke={c} />
      <text x={CW - 60} y={y(v) + 5} textAnchor="middle" fontFamily={MONO} fontSize={13} fill={c}>{label}</text>
    </g>
  );
  const pL = io(t, at[1], at[1] + 0.35), pS = io(t, at[2], at[2] + 0.35), pO = io(t, at[3], at[3] + 0.35), pT = io(t, at[4], at[4] + 0.35);
  const twapK = Math.floor(io(t, at[4] + 0.2, at[4] + 1.0, 0, 8, Easing.linear));
  return (
    <AbsoluteFill style={exitStyle(t, S.eco, 1)}>
      <div style={{ position: 'absolute', left: X0, top: 70 }}><Eyebrow t={t} at={S.terminal + 0.1}>ADVANCED TRADING TERMINAL</Eyebrow></div>
      <Card glow={0.35} style={{ left: X0, top: 116, width: W, height: 820, ...rise(t, S.terminal, 0.55, 40) }}>
        {/* header */}
        <div style={{ position: 'absolute', left: 26, top: 22, right: 26, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Token sym="YARD" size={44} />
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: C.white }}>YARD <span style={{ color: C.muted, fontWeight: 400 }}>/ ETH</span></div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>Robinhood Chain · Terminal</div>
          </div>
          <div style={{ marginLeft: 30, fontFamily: MONO, fontSize: 30, color: C.white }}>${last.toFixed(7)}</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: last > candles[0].o ? C.green : C.red }}>{last > candles[0].o ? '+' : ''}{(((last / candles[0].o) - 1) * 100).toFixed(2)}%</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['15m', '1H', '4H', '1D'].map((x, i) => <div key={x} style={{ padding: '5px 10px', borderRadius: 8, fontFamily: SANS, fontSize: 14, background: i === 1 ? C.surface : 'transparent', color: i === 1 ? C.white : C.muted }}>{x}</div>)}
          </div>
        </div>
        {/* chart */}
        <div style={{ position: 'absolute', left: 26, top: 100 }}>
          <svg width={CW} height={CH + 90} style={{ overflow: 'visible' }}>
            {[0.2, 0.4, 0.6, 0.8].map((g) => <line key={g} x1={0} x2={CW} y1={CH * g} y2={CH * g} stroke="rgba(255,255,255,0.045)" />)}
            {candles.slice(0, shown).map((c, i) => {
              const x = (i / N) * CW, cw = CW / N;
              const upC = c.c >= c.o;
              const col = upC ? C.green : C.red;
              return (
                <g key={i}>
                  <line x1={x + cw / 2} x2={x + cw / 2} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1.3} />
                  <rect x={x + cw * 0.18} width={cw * 0.64} y={Math.min(y(c.o), y(c.c))} height={Math.max(1.5, Math.abs(y(c.o) - y(c.c)))} fill={col} />
                  <rect x={x + cw * 0.18} width={cw * 0.64} y={CH + 80 - c.v * 60} height={c.v * 60} fill={col} opacity={0.25} />
                </g>
              );
            })}
            {active === 0 && <circle cx={(shown / N) * CW} cy={y(last)} r={8 + 10 * ((t * 2) % 1)} fill="none" stroke={C.green} opacity={1 - ((t * 2) % 1)} />}
            {line(lim, C.green, `LIMIT ${lim.toFixed(6)}`, pL * (active === 1 ? 1 : 0.35))}
            {line(stop, C.red, `STOP ${stop.toFixed(6)}`, pS * (active === 2 || active === 3 ? 1 : 0.35))}
            {line(tp, C.green, `TP ${tp.toFixed(6)}`, pO * (active === 3 ? 1 : 0.35), '3 5')}
            {pO > 0 && <path d={`M${CW - 140} ${y(tp)} C${CW - 175} ${y(tp)} ${CW - 175} ${y(stop)} ${CW - 140} ${y(stop)}`} stroke={C.amber} strokeWidth={2} fill="none" opacity={pO * (active === 3 ? 1 : 0.35)} strokeDasharray="4 4" />}
            {pT > 0 && Array.from({ length: 8 }).map((_, k) => (
              <g key={k} opacity={pT}>
                <rect x={CW * 0.62 + k * 30} y={CH + 4} width={22} height={12} rx={3} fill={k < twapK ? C.green : 'rgba(255,255,255,0.12)'} />
              </g>
            ))}
          </svg>
        </div>
        {/* order panel */}
        <div style={{ position: 'absolute', right: 22, top: 100, width: 280, bottom: 24, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ORDER_TYPES.map((o, i) => {
              const on = i === active;
              const hl = io(t, at[i] - 0.08, at[i] + 0.15);
              return (
                <div key={o} style={{ padding: '8px 12px', borderRadius: 9, fontFamily: SANS, fontWeight: 600, fontSize: 16, background: on ? C.accentSurface : 'transparent', color: on ? C.green : hl > 0.5 ? C.white : C.muted, border: `1px solid ${on ? C.green + '88' : 'transparent'}`, transform: `scale(${on ? 1 + 0.08 * (1 - io(t, at[i], at[i] + 0.3)) : 1})` }}>{o}</div>
              );
            })}
          </div>
          <div style={{ display: 'flex', marginTop: 16, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, textAlign: 'center', padding: 9, background: C.accentSurface, color: C.green, fontFamily: SANS, fontWeight: 700, fontSize: 16 }}>Buy</div>
            <div style={{ flex: 1, textAlign: 'center', padding: 9, color: C.muted, fontFamily: SANS, fontWeight: 700, fontSize: 16 }}>Sell</div>
          </div>
          {[
            ['Amount', '250,000 YARD'],
            [active === 3 ? 'Take profit' : active === 2 ? 'Stop price' : 'Limit price', active <= 0 ? 'Market' : (active === 2 ? stop : active === 3 ? tp : lim).toFixed(7)],
            [active === 3 ? 'Stop loss' : active === 4 ? 'Slices' : 'Expires', active === 3 ? stop.toFixed(7) : active === 4 ? '8 × every 15m' : 'Never'],
          ].map(([k, v], i) => (
            <div key={i} style={{ marginTop: 14 }}>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>{k}</div>
              <div style={{ marginTop: 6, padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 16, color: C.white }}>{v}</div>
            </div>
          ))}
          {active === 4 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}><div style={{ width: `${(twapK / 8) * 100}%`, height: '100%', borderRadius: 8, background: C.green }} /></div>
              <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 13, color: C.muted }}>{twapK}/8 slices filled</div>
            </div>
          )}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, height: 54, borderRadius: 12, background: C.green, color: C.greenDeep, fontFamily: SANS, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Place {active >= 0 ? ORDER_TYPES[active] : 'Market'} order
          </div>
        </div>
      </Card>
      <div style={{ position: 'absolute', left: X0, top: 960, display: 'flex', gap: 12 }}>
        {ORDER_TYPES.map((o, i) => <div key={o} style={rise(t, at[i] - 0.05, 0.35, 12)}><Chip color={i === active ? C.green : C.muted}>{o}</Chip></div>)}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 6. ecosystem ------------------------------ */

/** Procedural pixel "Yardkeeper" portraits (illustrative, not the real collection art). */
const Keeper: React.FC<{ seed: number; size: number }> = ({ seed, size }) => {
  const g = 12, u = size / g;
  const bgs = ['#0F2A1F', '#13201F', '#1D1A10', '#101D2A', '#22131A'];
  const skins = ['#E3AD8C', '#C99070', '#9A664C', '#6E4634', '#F1C9A5'];
  const hats = ['#00E997', '#1E2426', '#C2A35A', '#3A5A8A', '#7A2E3A'];
  const r = (k: number) => hash(seed * 13.7 + k);
  const sk = skins[Math.floor(r(1) * 5)], hat = hats[Math.floor(r(2) * 5)], bg = bgs[Math.floor(r(3) * 5)];
  const cells: [number, number, string][] = [];
  for (let yy = 3; yy < 10; yy++) for (let xx = 3; xx < 9; xx++) cells.push([xx, yy, sk]);
  const hood = r(4) > 0.5;
  for (let xx = 2; xx < 10; xx++) cells.push([xx, 2, hat]);
  for (let xx = 3; xx < 9; xx++) cells.push([xx, 1, hat]);
  if (hood) for (let yy = 3; yy < 10; yy++) { cells.push([2, yy, hat]); cells.push([9, yy, hat]); }
  cells.push([4, 5, '#0A0B0B'], [7, 5, '#0A0B0B'], [5, 8, '#5A3020'], [6, 8, '#5A3020']);
  if (r(5) > 0.6) cells.push([4, 5, C.green], [5, 5, C.green], [6, 5, '#0A0B0B'], [7, 5, C.green]);
  for (let xx = 1; xx < 11; xx++) cells.push([xx, 10, '#1A1E1F'], [xx, 11, '#1A1E1F']);
  cells.push([5, 10, C.green], [6, 10, C.green], [5, 11, C.green], [6, 11, C.green]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect width={size} height={size} fill={bg} />
      {cells.map(([x, y2, c], i) => <rect key={i} x={x * u} y={y2 * u} width={u} height={u} fill={c} />)}
    </svg>
  );
};

const NET = [
  { id: 'eth', x: 180, y: 380 }, { id: 'arb', x: 200, y: 700 }, { id: 'base', x: 470, y: 900 },
  { id: 'hyper', x: 470, y: 270 }, { id: 'sol', x: 880, y: 300 }, { id: 'zec', x: 900, y: 820 },
];
const Eco: React.FC<{ t: number }> = ({ t }) => {
  const yard = wi(5, 2), keep = wi(5, 5), conn = wi(5, 6);
  const toNet = io(t, conn - 0.35, conn + 0.2, 0, 1, inout);
  const count = Math.round(io(t, keep, keep + 1.0, 0, 3333, Easing.out(Easing.cubic)));
  const hub = { x: 680, y: 590 };
  return (
    <AbsoluteFill style={{ opacity: 1 - io(t, S.end - 0.2, S.end + 0.1) }}>
      <div style={{ position: 'absolute', left: 110, top: 70 }}><Eyebrow t={t} at={S.eco + 0.1}>THE ECOSYSTEM</Eyebrow></div>
      <div style={{ opacity: 1 - toNet, transform: `scale(${1 - toNet * 0.06})`, transformOrigin: '600px 560px' }}>
        {/* YARD */}
        <Card glow={0.45} active={io(t, yard - 0.1, yard + 0.3) * 0.7} style={{ left: 110, top: 130, width: 400, height: 420, ...rise(t, wi(5, 0) - 0.1, 0.5, 40) }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 190, height: 190, borderRadius: 190, background: 'radial-gradient(circle at 35% 30%, #1E2A24, #0A0B0B 70%)', border: `3px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 60px rgba(0,233,151,0.35), inset 0 0 30px rgba(0,233,151,0.2)`, transform: `rotateY(${Math.sin(t * 1.4) * 25}deg)` }}>
              <Mark size={110} glow={0.8} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 260, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 52, color: C.white, letterSpacing: '0.02em' }}>YARD</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: SANS, fontSize: 17, color: C.muted }}>Ecosystem token</div>
        </Card>
        {/* Yardkeepers */}
        <Card glow={0.45} active={io(t, keep - 0.1, keep + 0.3) * 0.7} style={{ left: 540, top: 130, width: 610, height: 600, ...rise(t, keep - 0.25, 0.5, 40) }}>
          <div style={{ position: 'absolute', left: 26, top: 22, right: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: C.white }}>Yardkeepers</span>
            <span style={{ fontFamily: MONO, fontSize: 22, color: C.green }}>{fmt(count, 0)} NFTs</span>
          </div>
          <div style={{ position: 'absolute', left: 26, top: 84, display: 'grid', gridTemplateColumns: 'repeat(5, 102px)', gap: 12 }}>
            {Array.from({ length: 20 }).map((_, i) => {
              const p = io(t, keep - 0.1 + (i % 5) * 0.05 + Math.floor(i / 5) * 0.08, keep + 0.25 + (i % 5) * 0.05 + Math.floor(i / 5) * 0.08);
              return <div key={i} style={{ borderRadius: 10, overflow: 'hidden', transform: `perspective(600px) rotateY(${(1 - p) * 90}deg)`, opacity: p, boxShadow: `0 0 0 1px ${C.border}` }}><Keeper seed={i + 3} size={102} /></div>;
            })}
          </div>
        </Card>
        <div style={{ position: 'absolute', left: 110, top: 590, width: 400, ...rise(t, keep + 0.4, 0.4, 14) }}>
          <div style={{ fontFamily: SANS, fontSize: 20, lineHeight: 1.5, color: C.muted }}>YARD and the Yardkeepers collection power the TickerYard ecosystem.</div>
        </div>
      </div>
      {/* markets, connected */}
      <svg width={1200} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: toNet }}>
        {NET.map((n, i) => NET.slice(i + 1).map((m2, j) => (
          <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m2.x} y2={m2.y} stroke="rgba(0,233,151,0.12)" strokeWidth={1.4} />
        )))}
        {NET.map((n, i) => (
          <g key={n.id}>
            <line x1={n.x} y1={n.y} x2={hub.x} y2={hub.y} stroke="rgba(0,233,151,0.45)" strokeWidth={2} />
            <line x1={n.x} y1={n.y} x2={hub.x} y2={hub.y} stroke={C.green} strokeWidth={3} strokeDasharray="10 70" strokeDashoffset={-t * 220 - i * 13} style={{ filter: `drop-shadow(0 0 6px ${C.green})` }} />
          </g>
        ))}
      </svg>
      {NET.map((n, i) => (
        <div key={n.id} style={{ position: 'absolute', left: n.x - 28, top: n.y - 28, opacity: toNet, transform: `scale(${io(t, conn - 0.2 + i * 0.06, conn + 0.25 + i * 0.06, 0.4, 1, backOut)})` }}><ChainBadge id={n.id} size={56} /></div>
      ))}
      <div style={{ position: 'absolute', left: hub.x - 60, top: hub.y - 60, opacity: toNet, transform: `scale(${io(t, conn - 0.3, conn + 0.2, 0.5, 1, backOut)})` }}>
        <div style={{ width: 120, height: 120, borderRadius: 30, background: '#0B0F0C', border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 70px rgba(0,233,151,0.5)` }}><Mark size={72} glow={0.8} /></div>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 130, opacity: toNet }}>
        <Kinetic t={t} at={conn - 0.05} size={86} text="Markets, connected." accent={['connected.']} stagger={0.14} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 7. end ------------------------------ */

const End: React.FC<{ t: number }> = ({ t }) => {
  const s0 = S.end, tag = wi(6, 1);
  const flash = io(t, s0 + 0.06, s0 + 0.12, 0, 1, Easing.linear) * (1 - io(t, s0 + 0.12, s0 + 0.9, 0, 1, Easing.out(Easing.quad)));
  const url = io(t, wi(6, 2) + 0.4, wi(6, 2) + 0.9);
  const fade = io(t, 29.55, 30, 0, 1, Easing.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - fade }}>
      <div style={{ position: 'absolute', left: 1000, top: 300 }}><Wordmark height={110} t={t} at={s0 + 0.1} glow={1} /></div>
      <div style={{ position: 'absolute', left: 1006, top: 470 }}>
        <Kinetic t={t} at={tag - 0.05} size={110} text="Markets, routed." accent={['routed.']} stagger={0.2} weight={500} />
      </div>
      <div style={{ position: 'absolute', left: 1008, top: 640, height: 2, width: 780 * io(t, tag + 0.6, tag + 1.4), background: `linear-gradient(90deg, ${C.green}, transparent)`, boxShadow: `0 0 16px ${C.green}` }} />
      <div style={{ position: 'absolute', left: 1008, top: 676, display: 'flex', alignItems: 'center', gap: 18, opacity: url, transform: `translateY(${(1 - url) * 14}px)` }}>
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 40, letterSpacing: '-0.01em', color: C.white }}>tickeryard.com</span>
        <Chip><LiveDot t={t} /> Routes to Robinhood Chain</Chip>
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 42%, rgba(210,255,235,${flash * 0.8}), rgba(0,233,151,${flash * 0.4}) 45%, rgba(10,11,11,${flash * 0.1}) 90%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ film ------------------------------ */

export const TickerYardFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const punch = HITS.reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 6) * 0.02 : 0), 0);
  const camX = noise(t * 0.22, 2) * 7, camY = noise(t * 0.19, 5) * 4;
  const par = (k: number): React.CSSProperties => ({ transform: `translate(${camX * k}px, ${camY * k}px)` });
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <Audio src={staticFile('ty/mix.wav')} />
      <AbsoluteFill style={{ transform: `scale(${1.02 + punch + Math.sin(t * 0.3) * 0.004})` }}>
        <AbsoluteFill style={par(0.4)}><Background t={t} /></AbsoluteFill>
        <AbsoluteFill style={par(1)}>
          {between(t, 0, S.layer) && <Hook t={t} />}
          {between(t, S.layer - 0.3, S.intent) && <Layer t={t} />}
          {between(t, S.intent - 0.3, S.routes) && <Intent t={t} />}
          {between(t, S.routes - 0.3, S.terminal) && <Routes t={t} />}
          {between(t, S.terminal - 0.3, S.eco) && <Terminal t={t} />}
          {between(t, S.eco - 0.3, S.end + 0.2) && <Eco t={t} />}
        </AbsoluteFill>
        <AbsoluteFill style={par(1.6)}><HostRig t={t} frame={frame} /></AbsoluteFill>
        <AbsoluteFill style={par(1)}>{t >= S.end - 0.05 && <End t={t} />}</AbsoluteFill>
        <RouteWipe t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 291) % 512}px`, opacity: 0.04, mixBlendMode: 'overlay' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - io(t, 0, 0.3, 0, 1, Easing.linear) }} />
    </AbsoluteFill>
  );
};

export const _u = [Img, TRIDENT];
