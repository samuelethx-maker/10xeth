import React from 'react';
import { C, noise } from './ui';
import { MARK } from './logoPaths';

const SKIN = '#D9A88A';
const SKIN_LIT = '#EDC1A5';
const SKIN_SHADE = '#B07F65';
const HAIR = '#0B0D0E';
const LIP = '#B5645E';

export type HostProps = { t: number; open: number; wide: number; round: number; smile?: number; emphasis?: number; look?: [number, number] };

const FACE = 'M400 200 C460 200 504 246 504 326 C504 402 488 452 462 488 C442 516 422 532 400 534 C378 532 358 516 338 488 C312 452 296 402 296 326 C296 246 340 200 400 200 Z';

/** DeFi-native host: sleek asymmetric bob, techwear jacket with teal piping, Nest pin, earpiece mic. */
export const Host: React.FC<HostProps> = ({ t, open, wide, round, smile = 0.35, emphasis = 0, look = [0, 0] }) => {
  const u = React.useId().replace(/:/g, '');
  const phase = (t + 1.1) % 3.6;
  const bl = (x: number) => Math.max(0, 1 - Math.abs(phase - x) / 0.07);
  const blink = 1 - Math.max(bl(0.1), Math.floor((t + 1.1) / 3.6) % 3 === 2 ? bl(0.32) : 0);
  const ex = look[0] * 6 + noise(t * 0.7, 5) * 2;
  const ey = look[1] * 4 + noise(t * 0.6, 11) * 1.2;
  const tilt = noise(t * 0.5, 4) * 2.2 + open * 0.5;
  const nod = noise(t * 0.85, 7) * 3 + open * 3.2 + emphasis * 5;
  const turn = noise(t * 0.35, 1) * 5;
  const breathe = Math.sin(t * 1.6) * 0.004;
  const brow = emphasis * 6 + open * 2;
  const led = 0.6 + 0.4 * Math.sin(t * 2.6);

  // Visemes: open -> jaw drop, wide -> spread (ee / s), round -> pucker (oo / oh).
  const mw = 29 + wide * 8 - round * 11 + smile * 4 - open * 3;
  const gap = 1 + open * 25 + round * 4;
  const cy = 472;
  const corner = cy - smile * 5 + open * 1.5;
  const lipUp = 3.5 + round * 2;
  const lipLo = 6.5 + round * 3;
  const mouth = `M${400 - mw} ${corner} C${400 - mw * 0.55} ${cy - 3} 392 ${cy - 4} 400 ${cy - 2} C408 ${cy - 4} ${400 + mw * 0.55} ${cy - 3} ${400 + mw} ${corner} C${400 + mw * 0.62} ${cy + gap} ${400 - mw * 0.62} ${cy + gap} ${400 - mw} ${corner} Z`;
  const head = `translate(0 88) translate(400 560) scale(1.12) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -560)`;
  const sway = noise(t * 0.9, 3) * 3 + turn * 0.4;

  const eye = (cx: number, side: number) => {
    const almond = `M${cx - 26} 356 C${cx - 15} 341 ${cx + 15} 340 ${cx + 26} 351 C${cx + 15} 365 ${cx - 13} 368 ${cx - 26} 356 Z`;
    return (
      <g>
        <g transform={`translate(0 354) scale(1 ${Math.max(0.06, blink)}) translate(0 -354)`}>
          <clipPath id={`he${side}${u}`}><path d={almond} /></clipPath>
          <path d={almond} fill="#F4F0EC" />
          <g clipPath={`url(#he${side}${u})`}>
            <circle cx={cx + ex} cy={354 + ey} r={11.5} fill="#2F4A3F" />
            <circle cx={cx + ex} cy={354 + ey} r={5} fill="#060807" />
            <circle cx={cx + ex + 3.5} cy={350 + ey} r={2.8} fill="#fff" />
            <circle cx={cx + ex - 4} cy={358 + ey} r={1.4} fill={C.teal} opacity={0.8} />
            <rect x={cx - 30} y={337} width={60} height={8} fill="#00000040" />
          </g>
          {/* lashes + liner flick */}
          <path d={`M${cx - 28} 357 C${cx - 16} 337 ${cx + 15} 336 ${cx + 28} 350 L${cx + 34 * (side > 0 ? 1 : 1)} ${345}`} fill="none" stroke="#0A0706" strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <path d={`M${cx - 17} 370 Q${cx} 375 ${cx + 17} 368`} fill="none" stroke={SKIN_SHADE} strokeWidth={1.5} opacity={0.45} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`hf${u}`} cx="0.42" cy="0.36" r="0.72">
          <stop offset="0" stopColor={SKIN_LIT} /><stop offset="0.55" stopColor={SKIN} /><stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <linearGradient id={`hr${u}`} x1="0" x2="1">
          <stop offset="0" stopColor={C.teal} stopOpacity={0.5} /><stop offset="0.14" stopColor={C.teal} stopOpacity={0} />
          <stop offset="0.86" stopColor={C.lime} stopOpacity={0} /><stop offset="1" stopColor={C.lime} stopOpacity={0.35} />
        </linearGradient>
        <linearGradient id={`hj${u}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1A1F1E" /><stop offset="0.5" stopColor="#0E1211" /><stop offset="1" stopColor="#060807" />
        </linearGradient>
        <linearGradient id={`hh${u}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1B2422" /><stop offset="0.45" stopColor={HAIR} /><stop offset="1" stopColor="#050606" />
        </linearGradient>
        <radialGradient id={`hn${u}`} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#7A5040" stopOpacity={0.6} /><stop offset="1" stopColor="#7A5040" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`hfc${u}`}><path d={FACE} /></clipPath>
      </defs>

      {/* back hair */}
      <g transform={head}>
        <path d={`M282 300 C270 420 286 520 ${312 + sway} 580 L${490 + sway} 580 C516 520 530 420 518 300 Z`} fill={`url(#hh${u})`} />
      </g>

      {/* torso */}
      <g transform={`translate(400 1000) scale(${1 + breathe * 0.6} ${1 + breathe}) translate(-400 -1000)`}>
        <path d="M350 600 L450 600 L456 700 Q400 728 344 700 Z" fill={SKIN_SHADE} />
        <path d="M350 600 L450 600 L456 700 Q400 728 344 700 Z" fill={`url(#hn${u})`} />
        {/* mock-neck base layer */}
        <path d="M336 676 Q400 708 464 676 L470 740 Q400 770 330 740 Z" fill="#0A0D0C" />
        {/* jacket */}
        <path d="M0 1180 C8 900 70 790 228 744 C276 730 312 716 330 700 L364 760 L400 1180 Z" fill={`url(#hj${u})`} />
        <path d="M800 1180 C792 900 730 790 572 744 C524 730 488 716 470 700 L436 760 L400 1180 Z" fill={`url(#hj${u})`} />
        {/* high collar flaps */}
        <path d="M318 690 L366 772 L402 830 L360 846 L296 742 Z" fill="#151A19" />
        <path d="M482 690 L434 772 L398 830 L440 846 L504 742 Z" fill="#151A19" />
        {/* teal piping along the zip + collar */}
        <path d="M400 830 L400 1180" stroke={C.teal} strokeWidth={3.5} style={{ filter: `drop-shadow(0 0 6px ${C.teal})` }} />
        <path d="M318 690 L366 772 L402 830" fill="none" stroke={C.teal} strokeOpacity={0.75} strokeWidth={2.5} />
        <path d="M482 690 L434 772 L398 830" fill="none" stroke={C.teal} strokeOpacity={0.75} strokeWidth={2.5} />
        {/* shoulder panel seams */}
        <path d="M150 800 C210 790 260 800 300 830" stroke="#232A28" strokeWidth={4} fill="none" />
        <path d="M650 800 C590 790 540 800 500 830" stroke="#232A28" strokeWidth={4} fill="none" />
        {/* Nest pin on the chest */}
        <g transform="translate(548 900)">
          <circle r={26} fill={C.nest} style={{ filter: `drop-shadow(0 0 10px ${C.nest})` }} />
          <g transform="translate(-14 -14)">{MARK.map((d, i) => <path key={i} d={d} fill="#fff" />)}</g>
        </g>
        {/* rim lights */}
        <path d="M228 744 C70 790 8 900 0 1180" fill="none" stroke={C.teal} strokeOpacity={0.6} strokeWidth={5} style={{ filter: 'blur(2px)' }} />
        <path d="M572 744 C730 790 792 900 800 1180" fill="none" stroke={C.lime} strokeOpacity={0.35} strokeWidth={4} style={{ filter: 'blur(1.5px)' }} />
      </g>

      {/* head */}
      <g transform={head}>
        <path d={FACE} fill={`url(#hf${u})`} />
        <g clipPath={`url(#hfc${u})`}>
          <rect x={280} y={180} width={240} height={380} fill={`url(#hr${u})`} />
          <ellipse cx={346} cy={420} rx={26} ry={14} fill="#E58C80" opacity={0.18} />
          <ellipse cx={454} cy={420} rx={26} ry={14} fill="#E58C80" opacity={0.18} />
        </g>
        {/* nose */}
        <g transform={`translate(${turn * 0.9} 0)`}>
          <path d="M403 370 C407 392 412 406 413 418" fill="none" stroke={SKIN_SHADE} strokeWidth={2.8} strokeLinecap="round" opacity={0.6} />
          <path d="M389 425 C395 431 407 431 413 425" fill="none" stroke="#9A6A55" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          <ellipse cx={405} cy={396} rx={4.5} ry={15} fill="#F6D2BC" opacity={0.4} />
        </g>
        {/* mouth */}
        <g transform={`translate(${turn * 0.7} 0)`}>
          <path d={mouth} fill="#3A1316" />
          <clipPath id={`hm${u}`}><path d={mouth} /></clipPath>
          <g clipPath={`url(#hm${u})`}>
            <rect x={366} y={cy - 4} width={68} height={3 + Math.min(7, gap * 0.3)} rx={3} fill="#F4F0EC" />
            <ellipse cx={400} cy={cy + gap * 0.95} rx={mw * 0.5} ry={gap * 0.32} fill="#B55C63" />
          </g>
          <path d={`M${400 - mw - 2} ${corner} C${400 - mw * 0.6} ${cy - lipUp - 3} 394 ${cy - lipUp - 5} 400 ${cy - lipUp - 1} C406 ${cy - lipUp - 5} ${400 + mw * 0.6} ${cy - lipUp - 3} ${400 + mw + 2} ${corner} C${400 + mw * 0.55} ${cy - 2} ${400 - mw * 0.55} ${cy - 2} ${400 - mw - 2} ${corner} Z`} fill={LIP} />
          <path d={`M${400 - mw} ${corner + 1} C${400 - mw * 0.6} ${cy + gap * 0.8} ${400 + mw * 0.6} ${cy + gap * 0.8} ${400 + mw} ${corner + 1} C${400 + mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw} ${corner + 1} Z`} fill="#C26E66" />
          <ellipse cx={404} cy={cy + gap + lipLo - 1} rx={8} ry={2} fill="#fff" opacity={0.18} />
        </g>
        {/* eyes + brows */}
        <g transform={`translate(${turn * 0.8} 0)`}>
          {eye(354, -1)}
          {eye(446, 1)}
          <path d={`M318 ${320 - brow} Q348 ${305 - brow * 1.2} 382 ${316 - brow}`} fill="none" stroke="#141010" strokeWidth={7} strokeLinecap="round" />
          <path d={`M418 ${316 - brow} Q452 ${305 - brow * 1.2} 482 ${320 - brow}`} fill="none" stroke="#141010" strokeWidth={7} strokeLinecap="round" />
        </g>
        {/* front hair: sharp asymmetric bob with a side part and teal sheen */}
        <path d={`M300 300 C292 220 330 160 404 156 C470 152 516 196 514 270 C514 360 520 440 ${506 + sway} 520 C488 470 482 400 484 330 C470 280 452 250 430 236 C400 250 360 262 330 300 C318 340 312 380 ${304 + sway * 0.5} 430 C294 390 296 340 300 300 Z`} fill={`url(#hh${u})`} />
        <path d={`M430 236 C462 252 486 290 488 340`} stroke="#1F2B28" strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M340 186 C380 162 440 162 480 192" stroke={C.teal} strokeOpacity={0.55} strokeWidth={5} fill="none" style={{ filter: 'blur(1.5px)' }} />
        <path d={`M512 290 C518 380 516 450 ${506 + sway} 516`} stroke={C.lime} strokeOpacity={0.3} strokeWidth={4} fill="none" style={{ filter: 'blur(1px)' }} />
        {/* earpiece + boom mic on the visible ear side */}
        <g transform="translate(296 372)">
          <rect x={-14} y={-20} width={18} height={40} rx={9} fill="#1C2321" stroke="#38433F" strokeWidth={2} />
          <circle cx={-5} cy={-6} r={3.5} fill={C.teal} opacity={led} style={{ filter: `drop-shadow(0 0 6px ${C.teal})` }} />
          <path d="M-5 18 C-2 70 30 100 70 104" stroke="#2A3330" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={72} cy={104} r={5} fill="#2A3330" />
        </g>
      </g>
    </svg>
  );
};
