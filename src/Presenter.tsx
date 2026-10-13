import React from 'react';
import { C, Mark, noise } from './ui';

const SKIN = '#C88E69';
const SKIN_SHADE = '#A06A4C';
const HAIR = '#16110E';
const BEARD = '#231A15';

/** Mirrors a left-side element onto the right half of the 800-wide canvas. */
const Mirror: React.FC<{ children: React.ReactNode }> = ({ children }) => <g transform="translate(800,0) scale(-1,1)">{children}</g>;

export type PresenterProps = {
  t: number;
  open: number; // 0..1 mouth openness
  wide: number; // 0..1 mouth width (sibilants)
  smile?: number;
  emphasis?: number; // 0..1, brow raise / nod
  look?: [number, number];
};

export const Presenter: React.FC<PresenterProps> = ({ t, open, wide, smile = 0.35, emphasis = 0, look = [0, 0] }) => {
  // Blink roughly every 3.4s with a double blink now and then.
  const blinkPhase = (t + 0.7) % 3.4;
  const blinkAt = (x: number) => Math.max(0, 1 - Math.abs(blinkPhase - x) / 0.07);
  const blink = 1 - Math.max(blinkAt(0.1), Math.floor((t + 0.7) / 3.4) % 3 === 1 ? blinkAt(0.32) : 0);
  const eyeX = look[0] * 6 + noise(t * 0.7, 3) * 2.2;
  const eyeY = look[1] * 4 + noise(t * 0.6, 9) * 1.4;

  const tilt = noise(t * 0.45, 1) * 2.4 + open * 0.8;
  const nod = noise(t * 0.8, 5) * 3 + open * 4 + emphasis * 5;
  const turn = noise(t * 0.33, 7) * 5;
  const breathe = Math.sin(t * 1.6) * 0.004;
  const brow = emphasis * 7 + open * 2.5;

  const mw = 33 + wide * 9 - open * 6 + smile * 4;
  const h = 1.5 + open * 30;
  const cy = 484;
  const corner = cy - smile * 6 + open * 2;

  const eye = (cx: number, side: 1 | -1) => (
    <g>
      <g transform={`translate(0 ${352}) scale(1 ${Math.max(0.06, blink)}) translate(0 ${-352})`}>
        <clipPath id={`eye${side}`}>
          <path d={`M${cx - 25} 352 C${cx - 14} 337 ${cx + 14} 337 ${cx + 25} 352 C${cx + 14} 364 ${cx - 14} 364 ${cx - 25} 352 Z`} />
        </clipPath>
        <path d={`M${cx - 25} 352 C${cx - 14} 337 ${cx + 14} 337 ${cx + 25} 352 C${cx + 14} 364 ${cx - 14} 364 ${cx - 25} 352 Z`} fill="#F3EEEA" />
        <g clipPath={`url(#eye${side})`}>
          <circle cx={cx + eyeX} cy={352 + eyeY} r={11.5} fill="#5A3B26" />
          <circle cx={cx + eyeX} cy={352 + eyeY} r={11.5} fill="url(#iris)" />
          <circle cx={cx + eyeX} cy={352 + eyeY} r={5.4} fill="#0E0906" />
          <circle cx={cx + eyeX + 3.6} cy={348 + eyeY} r={2.8} fill="#fff" opacity={0.95} />
          <rect x={cx - 30} y={334} width={60} height={9} fill="#00000033" />
        </g>
        <path d={`M${cx - 27} 353 C${cx - 15} 335 ${cx + 15} 335 ${cx + 27} 351`} fill="none" stroke="#1A120D" strokeWidth={4.2} strokeLinecap="round" />
      </g>
      {/* under-eye crease */}
      <path d={`M${cx - 18} 368 Q${cx} 374 ${cx + 18} 367`} fill="none" stroke={SKIN_SHADE} strokeWidth={2} opacity={0.45} strokeLinecap="round" />
    </g>
  );

  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="face" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#DDA27C" />
          <stop offset="0.55" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_SHADE} />
        </radialGradient>
        <radialGradient id="iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.45" stopColor="#7A5232" stopOpacity={0} />
          <stop offset="1" stopColor="#2A1A10" />
        </radialGradient>
        <linearGradient id="rim" x1="0" x2="1">
          <stop offset="0" stopColor={C.green} stopOpacity={0.5} />
          <stop offset="0.1" stopColor={C.green} stopOpacity={0} />
          <stop offset="0.86" stopColor={C.blue} stopOpacity={0} />
          <stop offset="1" stopColor={C.blue2} stopOpacity={0.8} />
        </linearGradient>
        <linearGradient id="blazer" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1C2539" />
          <stop offset="1" stopColor="#0A0F1A" />
        </linearGradient>
        <linearGradient id="lapel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#141C2D" />
          <stop offset="1" stopColor="#090D16" />
        </linearGradient>
        <linearGradient id="shirt" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#DCE2EB" />
          <stop offset="0.25" stopColor="#F4F6FA" />
          <stop offset="1" stopColor="#C9D1DD" />
        </linearGradient>
        <linearGradient id="hair" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2B221C" />
          <stop offset="0.5" stopColor={HAIR} />
          <stop offset="1" stopColor="#0B0806" />
        </linearGradient>
        <linearGradient id="lens" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9CC4FF" stopOpacity={0.16} />
          <stop offset="0.4" stopColor="#9CC4FF" stopOpacity={0.02} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0.1} />
          <stop offset="0.7" stopColor="#9CC4FF" stopOpacity={0.02} />
        </linearGradient>
        <radialGradient id="neckShadow" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#5A3524" stopOpacity={0.7} />
          <stop offset="1" stopColor="#5A3524" stopOpacity={0} />
        </radialGradient>
        <clipPath id="faceClip">
          <path d="M400 172 C468 172 518 222 518 318 C518 400 500 458 470 494 C448 520 424 536 400 538 C376 536 352 520 330 494 C300 458 282 400 282 318 C282 222 332 172 400 172 Z" />
        </clipPath>
      </defs>

      {/* torso */}
      <g transform={`translate(400 1000) scale(${1 + breathe * 0.6} ${1 + breathe}) translate(-400 -1000)`}>
        <path d="M330 664 L470 664 L486 1000 L314 1000 Z" fill="url(#shirt)" />
        <path d="M400 760 L400 1000" stroke="#B9C2CF" strokeWidth={2} />
        <circle cx={400} cy={812} r={4} fill="#AEB7C5" />
        <circle cx={400} cy={880} r={4} fill="#AEB7C5" />
        {/* neck */}
        <path d="M342 520 L458 520 L464 676 Q400 716 336 676 Z" fill={SKIN_SHADE} />
        <path d="M342 520 L458 520 L464 676 Q400 716 336 676 Z" fill="url(#neckShadow)" />
        <path d="M456 580 L463 676" stroke={C.blue2} strokeOpacity={0.35} strokeWidth={5} />
        {/* collar */}
        <path d="M352 660 L336 704 L384 768 L398 712 Z" fill="#F7F9FC" />
        <path d="M352 660 L336 704 L384 768" fill="none" stroke="#B4BDCB" strokeWidth={2} />
        <Mirror>
          <path d="M352 660 L336 704 L384 768 L398 712 Z" fill="#EEF1F6" />
          <path d="M352 660 L336 704 L384 768" fill="none" stroke="#B4BDCB" strokeWidth={2} />
        </Mirror>
        {/* blazer body */}
        <path d="M30 1000 C40 862 104 762 246 718 C296 702 326 690 348 670 L396 902 L392 1000 Z" fill="url(#blazer)" />
        <Mirror><path d="M30 1000 C40 862 104 762 246 718 C296 702 326 690 348 670 L396 902 L392 1000 Z" fill="url(#blazer)" /></Mirror>
        {/* lapels */}
        <path d="M348 670 L300 716 L322 756 L282 790 L340 1000 L380 1000 L396 902 Z" fill="url(#lapel)" />
        <path d="M348 670 L300 716 L322 756 L282 790 L340 1000" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={2} />
        <Mirror>
          <path d="M348 670 L300 716 L322 756 L282 790 L340 1000 L380 1000 L396 902 Z" fill="url(#lapel)" />
          <path d="M348 670 L300 716 L322 756 L282 790 L340 1000" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={2} />
        </Mirror>
        {/* rim light along shoulders */}
        <path d="M554 718 C696 762 760 862 770 1000" fill="none" stroke={C.blue2} strokeOpacity={0.55} strokeWidth={4} style={{ filter: 'blur(1.5px)' }} />
        <path d="M246 718 C104 762 40 862 30 1000" fill="none" stroke={C.green} strokeOpacity={0.28} strokeWidth={3} style={{ filter: 'blur(1.5px)' }} />
        {/* pocket square + lapel pin */}
        <path d="M560 846 L620 838 L616 852 L563 858 Z" fill={C.blue} opacity={0.85} />
        <circle cx={268} cy={826} r={15} fill="#0A0E16" stroke={C.blue} strokeWidth={2} />
        <g transform="translate(259 816)"><Mark size={18} color={C.blue2} /></g>
      </g>

      {/* head */}
      <g transform={`translate(0 48) translate(400 560) rotate(${tilt}) translate(${turn * 0.6} ${nod * 0.5}) translate(-400 -560)`}>
        {/* ears */}
        <ellipse cx={286} cy={354} rx={21} ry={37} fill={SKIN_SHADE} />
        <ellipse cx={514} cy={354} rx={21} ry={37} fill={SKIN_SHADE} />
        <path d="M282 334 Q272 354 284 378" fill="none" stroke="#8A563C" strokeWidth={3} />
        <path d="M518 334 Q528 354 516 378" fill="none" stroke="#8A563C" strokeWidth={3} />
        {/* face */}
        <path d="M400 172 C468 172 518 222 518 318 C518 400 500 458 470 494 C448 520 424 536 400 538 C376 536 352 520 330 494 C300 458 282 400 282 318 C282 222 332 172 400 172 Z" fill="url(#face)" />
        <g clipPath="url(#faceClip)">
          <ellipse cx={330 + turn} cy={420} rx={40} ry={60} fill={SKIN_SHADE} opacity={0.25} />
          <ellipse cx={470 + turn} cy={420} rx={40} ry={60} fill={SKIN_SHADE} opacity={0.3} />
          {/* beard */}
          <path d="M282 372 C288 440 312 488 340 512 C362 532 382 544 400 546 C418 544 438 532 460 512 C488 488 512 440 518 372 C508 420 496 448 476 462 C458 472 440 452 400 450 C360 452 342 472 324 462 C304 448 292 420 282 372 Z" fill={BEARD} opacity={0.88} transform={`translate(${turn * 0.5} 0)`} />
          <rect x={270} y={160} width={260} height={400} fill="url(#rim)" />
        </g>
        {/* nose */}
        <g transform={`translate(${turn * 0.9} 0)`}>
          <path d="M402 362 C406 390 414 410 418 422" fill="none" stroke={SKIN_SHADE} strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
          <path d="M384 428 C392 436 410 436 418 428" fill="none" stroke="#8C573D" strokeWidth={3.5} strokeLinecap="round" opacity={0.75} />
          <ellipse cx={408} cy={398} rx={6} ry={20} fill="#E6B391" opacity={0.35} />
        </g>
        {/* moustache */}
        <path d={`M${358 + turn * 0.6} 462 C380 448 420 448 ${442 + turn * 0.6} 462 C426 458 410 460 400 464 C390 460 374 458 ${358 + turn * 0.6} 462 Z`} fill={BEARD} />
        {/* mouth */}
        <g transform={`translate(${turn * 0.7} 0)`}>
          <path d={`M${400 - mw} ${corner} C${400 - mw * 0.5} ${cy - 4} ${392} ${cy - 5} 400 ${cy - 3} C408 ${cy - 5} ${400 + mw * 0.5} ${cy - 4} ${400 + mw} ${corner} C${400 + mw * 0.6} ${cy + h} ${400 - mw * 0.6} ${cy + h} ${400 - mw} ${corner} Z`} fill="#2A0E0E" />
          <clipPath id="mouthClip">
            <path d={`M${400 - mw} ${corner} C${400 - mw * 0.5} ${cy - 4} 392 ${cy - 5} 400 ${cy - 3} C408 ${cy - 5} ${400 + mw * 0.5} ${cy - 4} ${400 + mw} ${corner} C${400 + mw * 0.6} ${cy + h} ${400 - mw * 0.6} ${cy + h} ${400 - mw} ${corner} Z`} />
          </clipPath>
          <g clipPath="url(#mouthClip)">
            <rect x={360} y={cy - 6} width={80} height={4 + Math.min(8, h * 0.32)} rx={3} fill="#F2EEE9" />
            <ellipse cx={400} cy={cy + h * 0.95} rx={mw * 0.55} ry={h * 0.35} fill="#B5535A" />
          </g>
          <path d={`M${400 - mw} ${corner} C${400 - mw * 0.5} ${cy - 5} 392 ${cy - 7} 400 ${cy - 4} C408 ${cy - 7} ${400 + mw * 0.5} ${cy - 5} ${400 + mw} ${corner}`} fill="none" stroke="#7E4537" strokeWidth={3.2} strokeLinecap="round" />
          <path d={`M${400 - mw * 0.8} ${corner + 3 + h * 0.4} C${400 - mw * 0.4} ${cy + h + 8} ${400 + mw * 0.4} ${cy + h + 8} ${400 + mw * 0.8} ${corner + 3 + h * 0.4}`} fill="none" stroke="#9A5747" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        </g>
        {/* eyes + brows + glasses */}
        <g transform={`translate(${turn * 0.8} 0)`}>
          {eye(352, -1)}
          {eye(448, 1)}
          <path d={`M318 ${310 - brow} Q346 ${296 - brow * 1.2} 380 ${306 - brow}`} fill="none" stroke="#1B140F" strokeWidth={10} strokeLinecap="round" />
          <path d={`M420 ${306 - brow} Q454 ${296 - brow * 1.2} 482 ${310 - brow}`} fill="none" stroke="#1B140F" strokeWidth={10} strokeLinecap="round" />
          <rect x={308} y={322} width={86} height={60} rx={22} fill="url(#lens)" stroke="#0B0D12" strokeWidth={5.5} />
          <rect x={406} y={322} width={86} height={60} rx={22} fill="url(#lens)" stroke="#0B0D12" strokeWidth={5.5} />
          <path d="M394 344 Q400 337 406 344" fill="none" stroke="#0B0D12" strokeWidth={5} />
          <path d="M308 340 L288 334" stroke="#0B0D12" strokeWidth={5} />
          <path d="M492 340 L512 334" stroke="#0B0D12" strokeWidth={5} />
          <path d="M478 328 Q490 336 488 360" fill="none" stroke={C.blue2} strokeWidth={2.5} opacity={0.7} />
        </g>
        {/* hair */}
        <path d="M278 340 C264 236 298 160 372 138 C420 124 474 130 506 158 C534 184 540 238 528 302 L520 340 C516 292 508 262 490 246 C468 228 440 234 410 224 C380 216 352 228 330 238 C304 252 296 292 290 340 Z" fill="url(#hair)" />
        <path d="M318 196 C350 132 448 116 504 156 C526 174 534 204 524 232 C504 196 470 184 430 184 C388 184 352 196 318 196 Z" fill="#2E241D" />
        <path d="M352 168 C392 146 446 144 488 166" fill="none" stroke="#4A3A2E" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        <path d="M372 152 C410 138 450 140 478 152" fill="none" stroke="#4A3A2E" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        <path d="M506 158 C534 184 540 238 528 302" fill="none" stroke={C.blue2} strokeWidth={4} strokeOpacity={0.55} style={{ filter: 'blur(1px)' }} />
        {/* sideburn fade */}
        <path d="M290 340 L296 300 L300 372 Z" fill={HAIR} opacity={0.7} />
        <path d="M510 340 L504 300 L500 372 Z" fill={HAIR} opacity={0.7} />
      </g>
    </svg>
  );
};
