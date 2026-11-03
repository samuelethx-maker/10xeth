import React from 'react';
import { staticFile } from 'remotion';
import { C, TRIDENT, noise } from './ui';

const SKIN = '#C99070';
const SKIN_LIT = '#E3AD8C';
const SKIN_SHADE = '#9A664C';
const LIP = '#A65A52';
const LIP_LO = '#BC6F66';

/* Mouth parameters per viseme: open = inner gap (px), w = half-width, round = pucker, tU/tL = teeth shown,
   tongue = tongue-tip raise, press = lip compression (M/B/P), tuck = lower lip under the teeth (F/V). */
type MP = { open: number; w: number; round: number; tU: number; tL: number; tongue: number; press: number; tuck: number };
const V: Record<string, MP> = {
  R: { open: 0, w: 33, round: 0, tU: 0, tL: 0, tongue: 0, press: 0, tuck: 0 },
  X: { open: 0, w: 31, round: 0, tU: 0, tL: 0, tongue: 0, press: 0.2, tuck: 0 },
  M: { open: 0, w: 31, round: 0, tU: 0, tL: 0, tongue: 0, press: 1, tuck: 0 },
  a: { open: 9, w: 31, round: 0, tU: 0.7, tL: 0, tongue: 0.2, press: 0, tuck: 0 },
  A: { open: 19, w: 33, round: 0, tU: 1, tL: 0.2, tongue: 0.4, press: 0, tuck: 0 },
  E: { open: 9, w: 37, round: 0, tU: 1, tL: 0.6, tongue: 0.2, press: 0, tuck: 0 },
  O: { open: 14, w: 23, round: 0.7, tU: 0.4, tL: 0, tongue: 0.2, press: 0, tuck: 0 },
  U: { open: 5, w: 18, round: 1, tU: 0, tL: 0, tongue: 0, press: 0, tuck: 0 },
  F: { open: 3, w: 32, round: 0, tU: 1, tL: 0, tongue: 0, press: 0, tuck: 1 },
  S: { open: 3, w: 35, round: 0, tU: 1, tL: 1, tongue: 0, press: 0, tuck: 0 },
  L: { open: 9, w: 32, round: 0, tU: 0.9, tL: 0.3, tongue: 1, press: 0, tuck: 0 },
  K: { open: 10, w: 32, round: 0, tU: 0.6, tL: 0.2, tongue: 0.1, press: 0, tuck: 0 },
};
const KEYS = Object.keys(V[ 'R' ]) as (keyof MP)[];

/** Coarticulation: blend neighbouring frames (1-frame anticipation), but never soften a lip closure. */
export const mouthAt = (vis: string, f: number): MP => {
  const W = [[-2, 0.12], [-1, 0.24], [0, 0.44], [1, 0.2]] as const;
  const out = { ...V.R };
  for (const k of KEYS) out[k] = 0;
  let tw = 0;
  for (const [d, w] of W) {
    const ch = vis[Math.max(0, Math.min(vis.length - 1, f + d))];
    const p = V[ch] ?? V.R;
    for (const k of KEYS) out[k] += p[k] * w;
    tw += w;
  }
  for (const k of KEYS) out[k] /= tw;
  if (vis[f] === 'M') { out.open = 0; out.press = 1; out.tU = 0; out.tL = 0; }
  if (vis[f] === 'F') { out.tuck = Math.max(out.tuck, 0.85); out.open = Math.min(out.open, 4); }
  return out;
};

const FACE = (dj: number) => `M400 194 C466 194 514 242 514 322 C514 382 508 420 496 452 C488 486 472 ${512 + dj} 448 ${530 + dj} C432 ${542 + dj} 416 ${549 + dj} 400 ${549 + dj} C384 ${549 + dj} 368 ${542 + dj} 352 ${530 + dj} C328 ${512 + dj} 312 486 304 452 C292 420 286 382 286 322 C286 242 334 194 400 194 Z`;

export type HostProps = {
  t: number; vis: string; frame: number; level?: number; emphasis?: number; look?: [number, number]; smile?: number;
  lensFx?: number; lensMark?: number; led?: number;
};

export const Host: React.FC<HostProps> = ({ t, vis, frame, level = 0, emphasis = 0, look = [0, 0], smile = 0.25, lensFx = 0, lensMark = 0, led = 1 }) => {
  const u = React.useId().replace(/:/g, '');
  const m = mouthAt(vis, frame);
  const dj = m.open * 0.6 + m.round * 2;
  // blinks + micro saccades
  const ph = (t + 0.9) % 3.9;
  const bl = (x: number) => Math.max(0, 1 - Math.abs(ph - x) / 0.075);
  const blink = 1 - Math.max(bl(0.12), Math.floor((t + 0.9) / 3.9) % 3 === 1 ? bl(0.34) : 0);
  const sac = Math.floor(t * 1.7);
  const ex = look[0] * 6 + (noise(sac * 3.1, 2) * 2.2);
  const ey = look[1] * 4 + noise(sac * 1.7, 9) * 1.2;
  const tilt = noise(t * 0.45, 2) * 1.8 + look[0] * 1.5 + emphasis * 1.2;
  const nod = noise(t * 0.8, 6) * 2.4 + level * 3 + emphasis * 5;
  const turn = noise(t * 0.33, 8) * 4 + look[0] * 6;
  const brow = emphasis * 5 + level * 2.5;
  const breathe = Math.sin(t * 1.5) * 0.004;

  const cy = 476;
  const w = m.w + smile * 3;
  const corner = cy + 1.5 - smile * 4 + m.open * 0.1;
  const up = 8 + m.round * 2.5 - m.press * 2.5;
  const lo = 10.5 + m.round * 2.5 - m.press * 2.5 - m.tuck * 3;
  const ib = cy + m.open * 1.05 + m.round * 1.5;
  const lipLowY = ib - m.tuck * 4;
  const L = 400 - w, R = 400 + w;
  const innerTop = cy - 0.5 - m.round * 3;
  const mouthIn = `M${L} ${corner} C${400 - w * 0.5} ${innerTop} ${400 + w * 0.5} ${innerTop} ${R} ${corner} C${400 + w * 0.55} ${ib} ${400 - w * 0.55} ${ib} ${L} ${corner} Z`;
  const upperLip = `M${L - 2} ${corner} C${400 - w * 0.72} ${cy - up * 0.7} 393 ${cy - up - 0.5} 400 ${cy - up + 2} C407 ${cy - up - 0.5} ${400 + w * 0.72} ${cy - up * 0.7} ${R + 2} ${corner} C${400 + w * 0.5} ${innerTop} ${400 - w * 0.5} ${innerTop} ${L - 2} ${corner} Z`;
  const lowerLip = `M${L} ${corner + 0.5} C${400 - w * 0.55} ${lipLowY} ${400 + w * 0.55} ${lipLowY} ${R} ${corner + 0.5} C${400 + w * 0.68} ${lipLowY + lo + 3} ${400 - w * 0.68} ${lipLowY + lo + 3} ${L} ${corner + 0.5} Z`;
  const head = `translate(400 600) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -600)`;
  const fx = turn * 0.8;

  const eye = (cx: number, side: number) => {
    const almond = `M${cx - 24} 360 C${cx - 14} 347 ${cx + 13} 346 ${cx + 24} 357 C${cx + 14} 367 ${cx - 12} 369 ${cx - 24} 360 Z`;
    return (
      <g>
        <path d={`M${cx - 26} 352 C${cx - 12} 336 ${cx + 14} 335 ${cx + 27} 348`} fill="none" stroke={SKIN_SHADE} strokeWidth={2} opacity={0.55} />
        <g transform={`translate(0 357) scale(1 ${Math.max(0.05, blink)}) translate(0 -357)`}>
          <clipPath id={`e${side}${u}`}><path d={almond} /></clipPath>
          <path d={almond} fill="#F1ECE8" />
          <g clipPath={`url(#e${side}${u})`}>
            <circle cx={cx + ex} cy={357 + ey} r={10.5} fill={`url(#iris${u})`} />
            <circle cx={cx + ex} cy={357 + ey} r={10.5} fill="none" stroke="#10140F" strokeWidth={1.6} />
            <circle cx={cx + ex} cy={357 + ey} r={4.6} fill="#050605" />
            <circle cx={cx + ex + 3.6} cy={353 + ey} r={2.6} fill="#fff" />
            <circle cx={cx + ex - 3.5} cy={361 + ey} r={1.2} fill={C.green} opacity={0.8} />
            <rect x={cx - 30} y={344} width={60} height={9} fill="#00000038" />
          </g>
          <path d={`M${cx - 26} 361 C${cx - 15} 344 ${cx + 15} 343 ${cx + 26} 356`} fill="none" stroke="#120C09" strokeWidth={3.6} strokeLinecap="round" />
        </g>
        <path d={`M${cx - 16} 372 Q${cx} 377 ${cx + 16} 370`} fill="none" stroke={SKIN_SHADE} strokeWidth={1.4} opacity={0.5} />
      </g>
    );
  };

  const lens = (cx: number, side: number) => {
    const d = `M${cx - 47} ${330} h92 a10 10 0 0 1 10 10 v30 a14 14 0 0 1 -14 14 h-84 a14 14 0 0 1 -14 -14 v-30 a10 10 0 0 1 10 -10 Z`;
    const sweep = ((t * 0.35 + side * 0.2) % 1.4) - 0.2;
    return (
      <g>
        <clipPath id={`l${side}${u}`}><path d={d} /></clipPath>
        <path d={d} fill="rgba(190,255,230,0.045)" />
        <g clipPath={`url(#l${side}${u})`}>
          <rect x={cx - 70 + sweep * 140} y={300} width={22} height={120} fill="#fff" opacity={0.08} transform={`skewX(-22)`} />
          {/* HUD reflection: route lines + mark */}
          <g opacity={lensFx}>
            {[0, 1, 2].map((k) => <path key={k} d={`M${cx - 50} ${348 + k * 9} C${cx - 10} ${348 + k * 9} ${cx + 4} ${358} ${cx + 50} ${358}`} stroke={C.green} strokeWidth={1.4} fill="none" strokeDasharray="5 4" strokeDashoffset={-t * 30} opacity={0.6} />)}
          </g>
          {lensMark > 0 && side < 0 && (
            <g opacity={lensMark} transform={`translate(${cx - 16} ${341}) scale(1)`}>
              <path d={TRIDENT} fill={C.green} style={{ filter: `drop-shadow(0 0 3px ${C.green})` }} />
            </g>
          )}
        </g>
        <path d={d} fill="none" stroke="#0B0C0C" strokeWidth={4.5} />
        <path d={`M${cx - 47} 331 h92 a10 10 0 0 1 10 10`} fill="none" stroke="#3B4244" strokeWidth={1.4} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`sk${u}`} cx="0.58" cy="0.36" r="0.75">
          <stop offset="0" stopColor={SKIN_LIT} /><stop offset="0.55" stopColor={SKIN} /><stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <linearGradient id={`rim${u}`} x1="0" x2="1">
          <stop offset="0" stopColor={C.green} stopOpacity={0.55} /><stop offset="0.13" stopColor={C.green} stopOpacity={0} />
          <stop offset="0.9" stopColor="#DDEBFF" stopOpacity={0} /><stop offset="1" stopColor="#DDEBFF" stopOpacity={0.22} />
        </linearGradient>
        <radialGradient id={`iris${u}`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#8A7A3C" /><stop offset="0.6" stopColor="#4C5A2C" /><stop offset="1" stopColor="#1E2814" />
        </radialGradient>
        <linearGradient id={`neck${u}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7A4D39" /><stop offset="0.55" stopColor={SKIN_SHADE} /><stop offset="1" stopColor="#8A5A43" />
        </linearGradient>
      </defs>

      {/* neck + body */}
      <path d="M338 440 L462 440 L466 560 L462 700 Q400 728 338 700 L334 560 Z" fill={`url(#neck${u})`} />
      <path d="M338 560 Q400 600 462 560 L462 610 Q400 640 338 610 Z" fill="#5A3828" opacity={0.35} />
      <g transform={`translate(400 1000) scale(${1 + breathe * 0.5} ${1 + breathe}) translate(-400 -1000)`}>
        <image href={staticFile('ty/body.png')} x={0} y={0} width={800} height={1000} />
      </g>

      <g transform={head}>
        {/* ears + earpiece */}
        <g transform={`translate(${-fx * 0.4} 0)`}>
          <path d="M290 346 C270 340 264 362 268 384 C272 404 282 418 296 416 Z" fill={SKIN_SHADE} />
          <path d="M510 346 C530 340 536 362 532 384 C528 404 518 418 504 416 Z" fill={SKIN_SHADE} />
          <path d="M284 360 C276 370 278 392 288 402" stroke="#7A4C38" strokeWidth={2.5} fill="none" />
          <rect x={272} y={376} width={16} height={22} rx={8} fill="#141819" stroke="#2C3437" strokeWidth={1.5} />
          <circle cx={280} cy={384} r={3} fill={C.green} opacity={0.5 + 0.5 * led} style={{ filter: `drop-shadow(0 0 5px ${C.green})` }} />
        </g>
        {/* face */}
        <path d={FACE(dj)} fill={`url(#sk${u})`} />
        <clipPath id={`fc${u}`}><path d={FACE(dj)} /></clipPath>
        <g clipPath={`url(#fc${u})`}>
          <path d={`M300 430 C312 480 344 ${528 + dj} 400 ${548 + dj} C456 ${528 + dj} 488 480 500 430 C492 470 470 ${492 + dj} 452 ${500 + dj} C430 ${510 + dj} 370 ${510 + dj} 348 ${500 + dj} C330 ${492 + dj} 308 470 300 430 Z`} fill="#5A3828" opacity={0.18} />
          <ellipse cx={400} cy={540 + dj} rx={60} ry={14} fill="#7A4C38" opacity={0.25} />
          <rect x={280} y={180} width={240} height={400} fill={`url(#rim${u})`} />
          <ellipse cx={460} cy={300} rx={50} ry={30} fill="#FFE2CC" opacity={0.12} />
        </g>
        {/* nose */}
        <g transform={`translate(${fx * 1.1} 0)`}>
          <path d="M404 372 C408 396 414 412 416 426" fill="none" stroke={SKIN_SHADE} strokeWidth={2.8} strokeLinecap="round" opacity={0.55} />
          <path d="M386 432 C392 439 408 439 414 432" fill="none" stroke="#7E4E3A" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
          <ellipse cx={389} cy={433} rx={5} ry={3} fill="#5E3626" opacity={0.6} />
          <ellipse cx={411} cy={433} rx={5} ry={3} fill="#5E3626" opacity={0.6} />
          <ellipse cx={407} cy={402} rx={4.5} ry={15} fill="#F6CFB6" opacity={0.35} />
        </g>
        {/* nasolabial folds react to the mouth */}
        <g transform={`translate(${fx * 0.85} 0)`} opacity={0.35 + m.open * 0.012 + (m.w > 34 ? 0.15 : 0)}>
          <path d={`M378 442 C${366 - (m.w - 31) * 0.5} 456 ${362 - (m.w - 31) * 0.6} 470 ${364 - (m.w - 31) * 0.6} ${486 + dj * 0.3}`} fill="none" stroke={SKIN_SHADE} strokeWidth={2} />
          <path d={`M422 442 C${434 + (m.w - 31) * 0.5} 456 ${438 + (m.w - 31) * 0.6} 470 ${436 + (m.w - 31) * 0.6} ${486 + dj * 0.3}`} fill="none" stroke={SKIN_SHADE} strokeWidth={2} />
        </g>
        {/* mouth */}
        <g transform={`translate(${fx * 0.8} 0)`}>
          <path d={mouthIn} fill="#2A0E0F" />
          <clipPath id={`mi${u}`}><path d={mouthIn} /></clipPath>
          <g clipPath={`url(#mi${u})`}>
            <rect x={400 - w * 0.8} y={innerTop - 1} width={w * 1.6} height={2 + 6 * m.tU} rx={2} fill="#F3EEE8" />
            <rect x={400 - w * 0.7} y={ib - 1 - 5 * m.tL} width={w * 1.4} height={1 + 5 * m.tL} rx={2} fill="#E4DDD5" />
            <ellipse cx={400} cy={ib + 3 - m.tongue * (m.open * 0.7)} rx={w * 0.5} ry={4 + m.open * 0.25} fill="#B5555E" />
          </g>
          <path d={upperLip} fill={LIP} />
          <path d={lowerLip} fill={LIP_LO} />
          <path d={`M${L} ${corner} C${400 - w * 0.5} ${innerTop} ${400 + w * 0.5} ${innerTop} ${R} ${corner}`} stroke="#4A1F1C" strokeWidth={m.open < 1.5 ? 1.8 : 0.8} fill="none" opacity={0.85} />
          <ellipse cx={404} cy={lipLowY + lo * 0.5} rx={w * 0.25} ry={1.6} fill="#fff" opacity={0.16} />
          <ellipse cx={400} cy={lipLowY + lo + 9} rx={18} ry={5} fill={SKIN_SHADE} opacity={0.35} />
        </g>
        {/* eyes, brows, glasses */}
        <g transform={`translate(${fx} 0)`}>
          {eye(352, -1)}
          {eye(448, 1)}
          <path d={`M314 ${322 - brow} C332 ${312 - brow * 1.1} 360 ${310 - brow * 1.2} 384 ${318 - brow * 0.8}`} fill="none" stroke="#1A1411" strokeWidth={8} strokeLinecap="round" />
          <path d={`M416 ${318 - brow * 0.8} C440 ${310 - brow * 1.2} 468 ${312 - brow * 1.1} 486 ${322 - brow}`} fill="none" stroke="#1A1411" strokeWidth={8} strokeLinecap="round" />
          {lens(352, -1)}
          {lens(448, 1)}
          <path d="M396 345 C398 339 402 339 404 345" stroke="#0B0C0C" strokeWidth={4} fill="none" />
          <path d="M296 344 L278 350" stroke="#0B0C0C" strokeWidth={4} />
          <path d="M504 344 L522 350" stroke="#0B0C0C" strokeWidth={4} />
        </g>
        <image href={staticFile('ty/hair.png')} x={0} y={0} width={800} height={1000} />
      </g>
    </svg>
  );
};
