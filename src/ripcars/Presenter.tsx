import React from 'react';
import { staticFile } from 'remotion';
import { C, noise } from './ui';
import { PACK_W, Pack } from './Pack';

const SKIN = '#C68863';
const SKIN_LIT = '#DDA27E';
const SKIN_SHADE = '#9C6448';
const HAIR = '#160F0D';
const LIP = '#A9505A';

const uid = () => React.useId().replace(/:/g, '');
const Mirror: React.FC<{ children: React.ReactNode }> = ({ children }) => <g transform="translate(800,0) scale(-1,1)">{children}</g>;

export type HostProps = {
  t: number;
  open: number; wide: number; round: number;
  smile?: number; emphasis?: number; look?: [number, number];
  hold?: number; // 0..1 arms + pack raised into frame
  rip?: number; // 0..1+ pack tear progress
  packGlow?: number;
};

const FACE = 'M400 192 C462 192 506 240 508 322 C510 400 494 452 466 490 C446 516 424 532 400 534 C376 532 354 516 334 490 C306 452 290 400 292 322 C294 240 338 192 400 192 Z';

export const Host: React.FC<HostProps> = ({ t, open, wide, round, smile = 0.35, emphasis = 0, look = [0, 0], hold = 0, rip = 0, packGlow = 0 }) => {
  const u = uid();
  const phase = (t + 1.3) % 3.6;
  const bl = (x: number) => Math.max(0, 1 - Math.abs(phase - x) / 0.07);
  const blink = 1 - Math.max(bl(0.1), Math.floor((t + 1.3) / 3.6) % 3 === 2 ? bl(0.33) : 0);
  const ex = look[0] * 6 + noise(t * 0.7, 3) * 2;
  const ey = look[1] * 4 + noise(t * 0.6, 9) * 1.2;

  const tilt = noise(t * 0.5, 1) * 2.6 + open * 0.6;
  const nod = noise(t * 0.85, 5) * 3 + open * 3.5 + emphasis * 5;
  const turn = noise(t * 0.35, 7) * 5;
  const lagTilt = noise((t - 0.18) * 0.5, 1) * 2.6;
  const tail = (tilt - lagTilt) * 6 + noise(t * 1.1, 12) * 2.5;
  const breathe = Math.sin(t * 1.7) * 0.004;
  const brow = emphasis * 6 + open * 2;

  // Mouth shape from visemes: open -> jaw, wide -> spread (ee / s), round -> pucker (oo / oh).
  const mw = 30 + wide * 8 - round * 11 + smile * 4 - open * 3;
  const gap = 1.2 + open * 26 + round * 4;
  const cy = 472;
  const corner = cy - smile * 5 + open * 1.5;
  const lipUp = 5 + round * 2;
  const lipLo = 8 + round * 3;
  const mouthShape = `M${400 - mw} ${corner} C${400 - mw * 0.55} ${cy - 3} 392 ${cy - 4} 400 ${cy - 2} C408 ${cy - 4} ${400 + mw * 0.55} ${cy - 3} ${400 + mw} ${corner} C${400 + mw * 0.62} ${cy + gap} ${400 - mw * 0.62} ${cy + gap} ${400 - mw} ${corner} Z`;

  const eye = (cx: number, side: number) => {
    const almond = `M${cx - 24} 354 C${cx - 13} 339 ${cx + 13} 338 ${cx + 25} 350 C${cx + 14} 363 ${cx - 12} 365 ${cx - 24} 354 Z`;
    const wing = side < 0 ? `M${cx - 25} 354 L${cx - 35} 346` : `M${cx + 25} 350 L${cx + 36} 342`;
    return (
      <g>
        <g transform={`translate(0 352) scale(1 ${Math.max(0.06, blink)}) translate(0 -352)`}>
          <clipPath id={`he${side}${u}`}><path d={almond} /></clipPath>
          <path d={almond} fill="#F4EFEA" />
          <g clipPath={`url(#he${side}${u})`}>
            <circle cx={cx + ex} cy={352 + ey} r={11.5} fill="#4A2D1C" />
            <circle cx={cx + ex} cy={352 + ey} r={11.5} fill="url(#hiris)" />
            <circle cx={cx + ex} cy={352 + ey} r={5.2} fill="#0B0705" />
            <circle cx={cx + ex + 3.5} cy={348 + ey} r={2.8} fill="#fff" />
            <circle cx={cx + ex - 4} cy={356 + ey} r={1.2} fill="#fff" opacity={0.6} />
            <rect x={cx - 30} y={335} width={60} height={8} fill="#00000038" />
          </g>
          <path d={`M${cx - 26} 355 C${cx - 14} 336 ${cx + 14} 335 ${cx + 26} 350`} fill="none" stroke="#120A08" strokeWidth={4.5} strokeLinecap="round" />
          <path d={wing} stroke="#120A08" strokeWidth={4} strokeLinecap="round" />
        </g>
        <path d={`M${cx - 16} 366 Q${cx} 371 ${cx + 16} 364`} fill="none" stroke={SKIN_SHADE} strokeWidth={1.6} opacity={0.4} />
      </g>
    );
  };

  const handsY = (1 - hold) * 560;
  const r = Math.min(1, rip);
  const PS = 1.3;
  const PX = 400 - (PACK_W * PS) / 2, PY = 640;

  const forearm = (wx: number, wy: number, ex_: number, side: number) => (
    <g>
      <path d={`M${ex_ - 62 * side} 1180 L${wx - 40 * side} ${wy + 30} L${wx + 34 * side} ${wy + 20} L${ex_ + 70 * side} 1180 Z`} fill="url(#hjacket)" />
      <path d={`M${ex_ + 10 * side} 1180 L${wx - 2 * side} ${wy + 24}`} stroke={C.red} strokeWidth={9} />
      <path d={`M${ex_ + 24 * side} 1180 L${wx + 10 * side} ${wy + 24}`} stroke="#F4F4F6" strokeWidth={4} />
      <path d={`M${wx - 42 * side} ${wy + 34} L${wx + 36 * side} ${wy + 22} L${wx + 33 * side} ${wy + 2} L${wx - 40 * side} ${wy + 12} Z`} fill={C.red} />
      <path d={`M${wx - 41 * side} ${wy + 24} L${wx + 35 * side} ${wy + 12}`} stroke="#00000055" strokeWidth={2} />
    </g>
  );
  const fist = (x: number, y: number, side: number) => (
    <g>
      <ellipse cx={x} cy={y} rx={34} ry={40} fill={SKIN} />
      <ellipse cx={x - 8 * side} cy={y - 6} rx={18} ry={22} fill={SKIN_LIT} opacity={0.35} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${x - 30 * side} ${y - 22 + i * 14} q${-8 * side} 6 0 12`} stroke={SKIN_SHADE} strokeWidth={2.4} fill="none" opacity={0.7} />)}
    </g>
  );
  const thumb = (x: number, y: number, side: number) => (
    <g>
      <path d={`M${x - 14 * side} ${y + 18} C${x - 4 * side} ${y - 8} ${x + 16 * side} ${y - 16} ${x + 30 * side} ${y - 6} C${x + 38 * side} ${y + 2} ${x + 30 * side} ${y + 14} ${x + 14 * side} ${y + 20} Z`} fill={SKIN} stroke={SKIN_SHADE} strokeWidth={1.5} />
      <path d={`M${x + 22 * side} ${y - 7} q${6 * side} 3 ${7 * side} 9`} stroke="#E7B8A0" strokeWidth={3} fill="none" opacity={0.8} />
    </g>
  );
  // her right hand (viewer-left) carries the torn strip
  const stripDx = -r * 150 * PS, stripDy = -r * 70 * PS;
  const lx = PX + 10 + stripDx, ly = PY + 34 + stripDy;
  const rx_ = PX + PACK_W * PS - 10, ry_ = PY + 44;

  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="hface" cx="0.42" cy="0.36" r="0.72">
          <stop offset="0" stopColor={SKIN_LIT} /><stop offset="0.55" stopColor={SKIN} /><stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <radialGradient id="hiris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.45" stopColor="#8A5A34" stopOpacity={0} /><stop offset="1" stopColor="#1E120A" />
        </radialGradient>
        <linearGradient id="hrim" x1="0" x2="1">
          <stop offset="0" stopColor={C.red2} stopOpacity={0.65} /><stop offset="0.12" stopColor={C.red2} stopOpacity={0} />
          <stop offset="0.86" stopColor="#FFD9A8" stopOpacity={0} /><stop offset="1" stopColor="#FFD9A8" stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id="hjacket" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#24242B" /><stop offset="0.5" stopColor="#111115" /><stop offset="1" stopColor="#08080A" />
        </linearGradient>
        <linearGradient id="hhair" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3B2820" /><stop offset="0.45" stopColor={HAIR} /><stop offset="1" stopColor="#0A0605" />
        </linearGradient>
        <linearGradient id="htee" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#E9E9EE" /><stop offset="1" stopColor="#BDBDC6" />
        </linearGradient>
        <radialGradient id="hneck" cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#5A3424" stopOpacity={0.75} /><stop offset="1" stopColor="#5A3424" stopOpacity={0} />
        </radialGradient>
        <clipPath id="hfaceclip"><path d={FACE} /></clipPath>
      </defs>

      {/* ponytail (behind everything, swings with lag) */}
      <g transform={`translate(0 92) translate(400 560) scale(1.14) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -560)`}>
        <g transform={`rotate(${tail} 440 170)`}>
          <path d="M430 160 C520 150 590 220 594 330 C598 420 570 500 540 560 C560 480 556 400 530 330 C512 280 478 240 440 214 Z" fill="url(#hhair)" />
          <path d="M470 180 C540 200 576 270 572 360" stroke="#4A3328" strokeWidth={4} fill="none" opacity={0.7} />
          <path d="M588 300 C596 380 580 460 548 540" stroke={C.red2} strokeOpacity={0.45} strokeWidth={4} fill="none" style={{ filter: 'blur(1px)' }} />
        </g>
      </g>

      {/* torso */}
      <g transform={`translate(400 1000) scale(${1 + breathe * 0.6} ${1 + breathe}) translate(-400 -1000)`}>
        <path d="M346 600 L454 600 L460 700 Q400 730 340 700 Z" fill={SKIN_SHADE} />
        <path d="M346 600 L454 600 L460 700 Q400 730 340 700 Z" fill="url(#hneck)" />
        <path d="M446 590 L452 690" stroke="#FFD9A8" strokeOpacity={0.35} strokeWidth={4} />
        {/* tee */}
        <path d="M300 690 Q400 740 500 690 L520 1180 L280 1180 Z" fill="url(#htee)" />
        <path d="M338 688 Q400 728 462 688" fill="none" stroke="#A9A9B3" strokeWidth={8} />
        {/* jacket */}
        <path d="M10 1180 C14 900 80 780 230 728 C278 712 314 700 336 684 L360 760 L338 1180 Z" fill="url(#hjacket)" />
        <Mirror><path d="M10 1180 C14 900 80 780 230 728 C278 712 314 700 336 684 L360 760 L338 1180 Z" fill="url(#hjacket)" /></Mirror>
        {/* ribbed collar */}
        <path d="M336 684 C316 700 288 712 262 720 L282 760 C312 748 336 734 356 716 Z" fill={C.red} />
        <path d="M270 734 C300 724 324 712 344 698" stroke="#111" strokeWidth={4} fill="none" />
        <Mirror>
          <path d="M336 684 C316 700 288 712 262 720 L282 760 C312 748 336 734 356 716 Z" fill={C.red} />
          <path d="M270 734 C300 724 324 712 344 698" stroke="#111" strokeWidth={4} fill="none" />
        </Mirror>
        {/* racing stripes over the shoulders */}
        <path d="M206 738 C140 770 96 840 74 960" stroke={C.red} strokeWidth={22} fill="none" />
        <path d="M232 730 C170 760 126 830 106 950" stroke="#F4F4F6" strokeWidth={7} fill="none" />
        <Mirror>
          <path d="M206 738 C140 770 96 840 74 960" stroke={C.red} strokeWidth={22} fill="none" />
          <path d="M232 730 C170 760 126 830 106 950" stroke="#F4F4F6" strokeWidth={7} fill="none" />
        </Mirror>
        {/* zip edges + sheen */}
        <path d="M360 760 L338 1180" stroke="#3A3A44" strokeWidth={4} />
        <path d="M440 760 L462 1180" stroke="#3A3A44" strokeWidth={4} />
        <path d="M120 820 C150 800 190 786 230 780" stroke="#ffffff14" strokeWidth={14} fill="none" />
        {/* chest badge */}
        <circle cx={560} cy={850} r={40} fill="#0A0A0D" />
        <image href={staticFile('ripcars/logo.svg')} x={524} y={814} width={72} height={72} />
        {/* rim light */}
        <path d="M570 728 C720 780 786 900 790 1180" fill="none" stroke="#FFD9A8" strokeOpacity={0.45} strokeWidth={4} style={{ filter: 'blur(1.5px)' }} />
        <path d="M230 728 C80 780 14 900 10 1180" fill="none" stroke={C.red2} strokeOpacity={0.6} strokeWidth={5} style={{ filter: 'blur(2px)' }} />
      </g>

      {/* head */}
      <g transform={`translate(0 92) translate(400 560) scale(1.14) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -560)`}>
        <ellipse cx={294} cy={356} rx={18} ry={33} fill={SKIN_SHADE} />
        <ellipse cx={506} cy={356} rx={18} ry={33} fill={SKIN_SHADE} />
        <path d={FACE} fill="url(#hface)" />
        <g clipPath="url(#hfaceclip)">
          <ellipse cx={336 + turn} cy={420} rx={34} ry={22} fill="#E0796E" opacity={0.18} />
          <ellipse cx={464 + turn} cy={420} rx={34} ry={22} fill="#E0796E" opacity={0.18} />
          <path d="M300 430 C320 500 360 530 400 534 C440 530 480 500 500 430 C490 488 450 520 400 524 C350 520 310 488 300 430 Z" fill={SKIN_SHADE} opacity={0.35} />
          <rect x={280} y={180} width={240} height={380} fill="url(#hrim)" />
        </g>
        {/* nose */}
        <g transform={`translate(${turn * 0.9} 0)`}>
          <path d="M404 366 C408 392 414 408 416 420" fill="none" stroke={SKIN_SHADE} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
          <path d="M388 426 C394 432 408 432 414 426" fill="none" stroke="#86503A" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          <ellipse cx={407} cy={396} rx={5} ry={17} fill="#EDBB9C" opacity={0.4} />
        </g>
        {/* mouth */}
        <g transform={`translate(${turn * 0.7} 0)`}>
          <path d={mouthShape} fill="#3A1214" />
          <clipPath id={`hm${u}`}><path d={mouthShape} /></clipPath>
          <g clipPath={`url(#hm${u})`}>
            <rect x={366} y={cy - 4} width={68} height={3 + Math.min(7, gap * 0.3)} rx={3} fill="#F4F0EC" />
            <ellipse cx={400} cy={cy + gap * 0.95} rx={mw * 0.5} ry={gap * 0.32} fill="#B85A62" />
          </g>
          {/* upper lip */}
          <path d={`M${400 - mw - 2} ${corner} C${400 - mw * 0.6} ${cy - lipUp - 4} 394 ${cy - lipUp - 6} 400 ${cy - lipUp - 2} C406 ${cy - lipUp - 6} ${400 + mw * 0.6} ${cy - lipUp - 4} ${400 + mw + 2} ${corner} C${400 + mw * 0.55} ${cy - 2} ${400 - mw * 0.55} ${cy - 2} ${400 - mw - 2} ${corner} Z`} fill={LIP} />
          {/* lower lip */}
          <path d={`M${400 - mw} ${corner + 1} C${400 - mw * 0.6} ${cy + gap * 0.8} ${400 + mw * 0.6} ${cy + gap * 0.8} ${400 + mw} ${corner + 1} C${400 + mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw * 0.7} ${cy + gap + lipLo + 4} ${400 - mw} ${corner + 1} Z`} fill="#B85A62" />
          <ellipse cx={400} cy={cy + gap + lipLo * 0.45} rx={mw * 0.35} ry={2.6} fill="#fff" opacity={0.22} />
        </g>
        {/* eyes + brows */}
        <g transform={`translate(${turn * 0.8} 0)`}>
          {eye(354, -1)}
          {eye(446, 1)}
          <path d={`M318 ${318 - brow} Q346 ${302 - brow * 1.2} 382 ${312 - brow}`} fill="none" stroke="#1A100C" strokeWidth={7} strokeLinecap="round" />
          <path d={`M418 ${312 - brow} Q454 ${302 - brow * 1.2} 482 ${318 - brow}`} fill="none" stroke="#1A100C" strokeWidth={7} strokeLinecap="round" />
        </g>
        {/* hair front: swept fringe + face-framing strands */}
        <path d="M286 360 C270 250 310 168 392 150 C460 136 520 168 530 236 C536 280 530 320 516 352 C512 300 500 262 478 240 C440 262 380 266 330 250 C312 284 300 320 296 362 Z" fill="url(#hhair)" />
        <path d="M330 250 C370 196 450 186 500 224 C470 214 420 218 388 236 C368 246 348 250 330 250 Z" fill="#2E1F19" />
        <path d="M300 262 C292 320 296 400 314 446 C302 400 304 330 318 280 Z" fill={HAIR} />
        <path d="M506 250 C520 320 512 400 492 446 C500 396 498 330 486 280 Z" fill={HAIR} />
        <path d="M360 168 C410 150 470 160 506 196" fill="none" stroke="#5A4134" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        <path d="M528 236 C536 280 530 320 516 352" fill="none" stroke="#FFD9A8" strokeOpacity={0.5} strokeWidth={3.5} />
        <path d="M288 360 C272 260 300 190 360 160" fill="none" stroke={C.red2} strokeOpacity={0.55} strokeWidth={4} style={{ filter: 'blur(1px)' }} />
        {/* hoops */}
        <g transform={`rotate(${-tail * 0.8} 296 388)`}><circle cx={296} cy={406} r={15} fill="none" stroke="#E2B65A" strokeWidth={4} /></g>
        <g transform={`rotate(${-tail * 0.8} 504 388)`}><circle cx={504} cy={406} r={15} fill="none" stroke="#E2B65A" strokeWidth={4} /></g>
      </g>

      {/* arms + pack */}
      {hold > 0.001 && (
        <g transform={`translate(0 ${handsY})`}>
          {forearm(lx, ly + 20, 120, -1)}
          {forearm(rx_, ry_ + 20, 680, 1)}
          {fist(lx - 8, ly, -1)}
          {fist(rx_ + 8, ry_, 1)}
          <g transform={`translate(${PX} ${PY}) scale(${PS})`}>
            <Pack id="hostpack" rip={rip} glow={packGlow} sheen={(t * 0.6) % 1.4} />
          </g>
          {thumb(lx + 4, ly - 2, 1)}
          {thumb(rx_ - 4, ry_ - 2, -1)}
        </g>
      )}
    </svg>
  );
};
