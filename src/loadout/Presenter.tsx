import React from 'react';
import { C, noise } from './ui';

const SKIN = '#B9825F';
const SKIN_LIT = '#D29C78';
const SKIN_SHADE = '#8E5C42';
const HAIR = '#141012';
const LIP = '#94574F';

const Mirror: React.FC<{ children: React.ReactNode }> = ({ children }) => <g transform="translate(800,0) scale(-1,1)">{children}</g>;

export type GamerProps = {
  t: number;
  open: number; wide: number; round: number;
  smile?: number; emphasis?: number; look?: [number, number];
};

const FACE = 'M400 196 C464 196 510 244 510 326 C510 404 494 456 466 494 C446 520 424 536 400 538 C376 536 354 520 334 494 C306 456 290 404 290 326 C290 244 336 196 400 196 Z';

/** Gamer-native host: textured crop, stubble, headset around the neck, black hoodie with orange drawcords. */
export const Gamer: React.FC<GamerProps> = ({ t, open, wide, round, smile = 0.35, emphasis = 0, look = [0, 0] }) => {
  const u = React.useId().replace(/:/g, '');
  const phase = (t + 0.4) % 3.3;
  const bl = (x: number) => Math.max(0, 1 - Math.abs(phase - x) / 0.07);
  const blink = 1 - Math.max(bl(0.1), Math.floor((t + 0.4) / 3.3) % 3 === 1 ? bl(0.32) : 0);
  const ex = look[0] * 6 + noise(t * 0.7, 3) * 2;
  const ey = look[1] * 4 + noise(t * 0.6, 9) * 1.2;
  const tilt = noise(t * 0.5, 2) * 2.4 + open * 0.6;
  const nod = noise(t * 0.85, 6) * 3 + open * 3.5 + emphasis * 5;
  const turn = noise(t * 0.35, 8) * 5;
  const breathe = Math.sin(t * 1.7) * 0.004;
  const brow = emphasis * 6 + open * 2;
  const led = 0.6 + 0.4 * Math.sin(t * 3);

  // Visemes: open -> jaw drop, wide -> spread (ee / s), round -> pucker (oo / oh).
  const mw = 32 + wide * 8 - round * 12 + smile * 4 - open * 3;
  const gap = 1.2 + open * 26 + round * 4;
  const cy = 476;
  const corner = cy - smile * 5 + open * 1.5;
  const lipUp = 3 + round * 2;
  const lipLo = 6 + round * 3;
  const mouth = `M${400 - mw} ${corner} C${400 - mw * 0.55} ${cy - 3} 392 ${cy - 4} 400 ${cy - 2} C408 ${cy - 4} ${400 + mw * 0.55} ${cy - 3} ${400 + mw} ${corner} C${400 + mw * 0.62} ${cy + gap} ${400 - mw * 0.62} ${cy + gap} ${400 - mw} ${corner} Z`;
  const head = `translate(0 88) translate(400 560) scale(1.12) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -560)`;

  const eye = (cx: number, side: number) => {
    const almond = `M${cx - 25} 356 C${cx - 14} 342 ${cx + 14} 341 ${cx + 25} 353 C${cx + 14} 365 ${cx - 13} 367 ${cx - 25} 356 Z`;
    return (
      <g>
        <g transform={`translate(0 354) scale(1 ${Math.max(0.06, blink)}) translate(0 -354)`}>
          <clipPath id={`ge${side}${u}`}><path d={almond} /></clipPath>
          <path d={almond} fill="#F2EEEA" />
          <g clipPath={`url(#ge${side}${u})`}>
            <circle cx={cx + ex} cy={354 + ey} r={11.5} fill="#3A2416" />
            <circle cx={cx + ex} cy={354 + ey} r={5.2} fill="#0A0605" />
            <circle cx={cx + ex + 3.5} cy={350 + ey} r={2.8} fill="#fff" />
            <circle cx={cx + ex - 4} cy={358 + ey} r={1.4} fill={C.cyan} opacity={0.7} />
            <rect x={cx - 30} y={338} width={60} height={8} fill="#00000040" />
          </g>
          <path d={`M${cx - 27} 357 C${cx - 15} 338 ${cx + 15} 337 ${cx + 27} 352`} fill="none" stroke="#120B08" strokeWidth={4.2} strokeLinecap="round" />
        </g>
        <path d={`M${cx - 17} 369 Q${cx} 374 ${cx + 17} 367`} fill="none" stroke={SKIN_SHADE} strokeWidth={1.6} opacity={0.45} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`gf${u}`} cx="0.42" cy="0.36" r="0.72">
          <stop offset="0" stopColor={SKIN_LIT} /><stop offset="0.55" stopColor={SKIN} /><stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <linearGradient id={`gr${u}`} x1="0" x2="1">
          <stop offset="0" stopColor={C.cyan} stopOpacity={0.55} /><stop offset="0.13" stopColor={C.cyan} stopOpacity={0} />
          <stop offset="0.86" stopColor={C.orange} stopOpacity={0} /><stop offset="1" stopColor={C.orange} stopOpacity={0.5} />
        </linearGradient>
        <linearGradient id={`gh${u}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1B1F27" /><stop offset="0.5" stopColor="#0F1218" /><stop offset="1" stopColor="#07080B" />
        </linearGradient>
        <radialGradient id={`gn${u}`} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#4E2E20" stopOpacity={0.75} /><stop offset="1" stopColor="#4E2E20" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`gcup${u}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2A303B" /><stop offset="1" stopColor="#0B0E13" />
        </linearGradient>
        <pattern id={`stub${u}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#2A1A14" opacity="0.55" /><circle cx="5" cy="4.5" r="0.8" fill="#2A1A14" opacity="0.45" />
        </pattern>
        <clipPath id={`gfc${u}`}><path d={FACE} /></clipPath>
      </defs>

      {/* torso */}
      <g transform={`translate(400 1000) scale(${1 + breathe * 0.6} ${1 + breathe}) translate(-400 -1000)`}>
        <path d="M344 600 L456 600 L462 702 Q400 732 338 702 Z" fill={SKIN_SHADE} />
        <path d="M344 600 L456 600 L462 702 Q400 732 338 702 Z" fill={`url(#gn${u})`} />
        <path d="M454 610 L460 700" stroke={C.orange} strokeOpacity={0.3} strokeWidth={4} />
        {/* hoodie */}
        <path d="M0 1180 C6 900 70 790 220 738 C270 722 310 708 332 692 Q400 742 468 692 C490 708 530 722 580 738 C730 790 794 900 800 1180 Z" fill={`url(#gh${u})`} />
        {/* hood folds around the neck */}
        <path d="M250 742 C270 690 320 672 350 684 Q400 740 450 684 C480 672 530 690 550 742 C520 770 470 790 400 792 C330 790 280 770 250 742 Z" fill="#181C24" />
        <path d="M282 744 C330 772 470 772 518 744" stroke="#262B35" strokeWidth={5} fill="none" />
        {/* drawcords */}
        <path d="M368 784 C364 840 362 890 366 940" stroke={C.orange} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M432 784 C436 840 438 890 434 940" stroke={C.orange} strokeWidth={6} fill="none" strokeLinecap="round" />
        <rect x={360} y={936} width={12} height={22} rx={4} fill="#D9DEE6" />
        <rect x={428} y={936} width={12} height={22} rx={4} fill="#D9DEE6" />
        {/* chest print: neon "L" frame like the logo */}
        <path d="M520 860 L600 840 L600 900 L560 910 L560 940 L520 950 Z" fill="none" stroke={C.cyan} strokeWidth={4} style={{ filter: `drop-shadow(0 0 6px ${C.cyan})` }} />
        <circle cx={580} cy={918} r={14} fill={C.cream} style={{ filter: `drop-shadow(0 0 8px ${C.orange})` }} />
        {/* rim light */}
        <path d="M580 738 C730 790 794 900 800 1180" fill="none" stroke={C.orange} strokeOpacity={0.45} strokeWidth={4} style={{ filter: 'blur(1.5px)' }} />
        <path d="M220 738 C70 790 6 900 0 1180" fill="none" stroke={C.cyan} strokeOpacity={0.6} strokeWidth={5} style={{ filter: 'blur(2px)' }} />
        {/* headset resting on the neck */}
        <path d="M300 690 C300 760 500 760 500 690" stroke="#1E232C" strokeWidth={14} fill="none" />
        <path d="M300 690 C300 760 500 760 500 690" stroke={C.cyan} strokeOpacity={0.5 * led} strokeWidth={2} fill="none" />
        {[-1, 1].map((s) => (
          <g key={s} transform={`translate(${400 + s * 112} 704) rotate(${s * -18})`}>
            <ellipse rx={44} ry={52} fill={`url(#gcup${u})`} stroke="#3A414E" strokeWidth={3} />
            <ellipse rx={30} ry={38} fill="#0B0D12" />
            <ellipse rx={36} ry={44} fill="none" stroke={C.cyan} strokeWidth={3} opacity={led} style={{ filter: `drop-shadow(0 0 8px ${C.cyan})` }} />
          </g>
        ))}
      </g>

      {/* head */}
      <g transform={head}>
        <ellipse cx={292} cy={358} rx={18} ry={33} fill={SKIN_SHADE} />
        <ellipse cx={508} cy={358} rx={18} ry={33} fill={SKIN_SHADE} />
        <path d={FACE} fill={`url(#gf${u})`} />
        <g clipPath={`url(#gfc${u})`}>
          {/* stubble + jawline shade */}
          <path d="M292 400 C300 470 340 528 400 538 C460 528 500 470 508 400 C500 450 470 470 440 462 C420 456 410 452 400 452 C390 452 380 456 360 462 C330 470 300 450 292 400 Z" fill={`url(#stub${u})`} transform={`translate(${turn * 0.5} 0)`} />
          <path d="M292 400 C300 470 340 528 400 538 C460 528 500 470 508 400 C500 450 470 470 440 462 C420 456 410 452 400 452 C390 452 380 456 360 462 C330 470 300 450 292 400 Z" fill="#3A2318" opacity={0.18} transform={`translate(${turn * 0.5} 0)`} />
          <rect x={280} y={180} width={240} height={380} fill={`url(#gr${u})`} />
        </g>
        {/* nose */}
        <g transform={`translate(${turn * 0.9} 0)`}>
          <path d="M404 368 C408 394 414 410 416 424" fill="none" stroke={SKIN_SHADE} strokeWidth={3.2} strokeLinecap="round" opacity={0.65} />
          <path d="M386 430 C393 437 409 437 416 430" fill="none" stroke="#7A4A35" strokeWidth={3.2} strokeLinecap="round" opacity={0.75} />
          <ellipse cx={407} cy={398} rx={5} ry={17} fill="#E3AE8C" opacity={0.35} />
        </g>
        {/* moustache shadow */}
        <path d={`M${362 + turn * 0.6} 458 C384 448 416 448 ${438 + turn * 0.6} 458`} stroke="#2A1A13" strokeWidth={6} opacity={0.45} fill="none" strokeLinecap="round" />
        {/* mouth */}
        <g transform={`translate(${turn * 0.7} 0)`}>
          <path d={mouth} fill="#2E1012" />
          <clipPath id={`gm${u}`}><path d={mouth} /></clipPath>
          <g clipPath={`url(#gm${u})`}>
            <rect x={364} y={cy - 4} width={72} height={3 + Math.min(7, gap * 0.3)} rx={3} fill="#F2EEEA" />
            <ellipse cx={400} cy={cy + gap * 0.95} rx={mw * 0.5} ry={gap * 0.32} fill="#A9525A" />
          </g>
          <path d={`M${400 - mw - 2} ${corner} C${400 - mw * 0.6} ${cy - lipUp - 3} 394 ${cy - lipUp - 5} 400 ${cy - lipUp - 1} C406 ${cy - lipUp - 5} ${400 + mw * 0.6} ${cy - lipUp - 3} ${400 + mw + 2} ${corner} C${400 + mw * 0.55} ${cy - 2} ${400 - mw * 0.55} ${cy - 2} ${400 - mw - 2} ${corner} Z`} fill={LIP} />
          <path d={`M${400 - mw} ${corner + 1} C${400 - mw * 0.6} ${cy + gap * 0.8} ${400 + mw * 0.6} ${cy + gap * 0.8} ${400 + mw} ${corner + 1} C${400 + mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw} ${corner + 1} Z`} fill="#A2605A" />
        </g>
        {/* eyes + brows */}
        <g transform={`translate(${turn * 0.8} 0)`}>
          {eye(354, -1)}
          {eye(446, 1)}
          <path d={`M316 ${318 - brow} Q346 ${304 - brow * 1.2} 382 ${314 - brow}`} fill="none" stroke="#18100C" strokeWidth={9} strokeLinecap="round" />
          <path d={`M418 ${314 - brow} Q454 ${304 - brow * 1.2} 484 ${318 - brow}`} fill="none" stroke="#18100C" strokeWidth={9} strokeLinecap="round" />
        </g>
        {/* hair: skin fade on the sides, textured top */}
        <path d="M292 330 C286 280 296 236 318 214 L318 300 Z" fill="#2A2022" opacity={0.75} />
        <path d="M508 330 C514 280 504 236 482 214 L482 300 Z" fill="#2A2022" opacity={0.75} />
        <path d="M300 270 C292 200 330 146 400 140 C476 134 518 186 506 270 C496 240 470 222 430 220 C400 216 362 222 336 232 C318 240 306 254 300 270 Z" fill={HAIR} />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path key={i} d={`M${318 + i * 28} ${206 - Math.sin(i) * 6} q${10} -${40 + (i % 3) * 8} ${26} -${18 + (i % 2) * 10}`} stroke="#2B2224" strokeWidth={10} strokeLinecap="round" fill="none" />
        ))}
        <path d="M330 168 C380 140 450 142 492 186" stroke={C.cyan} strokeOpacity={0.45} strokeWidth={4} fill="none" style={{ filter: 'blur(1px)' }} />
        <path d="M506 270 C516 220 506 180 480 160" stroke={C.orange} strokeOpacity={0.45} strokeWidth={4} fill="none" style={{ filter: 'blur(1px)' }} />
      </g>
    </svg>
  );
};
