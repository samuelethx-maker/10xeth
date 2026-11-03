import React from 'react';
import { AbsoluteFill } from 'remotion';
import { hash } from './ui';

/* Static, filter-heavy character art, baked to transparent PNGs by scripts/ty_bake.sh.
   Shares the 800 x 1000 rig space with Presenter.tsx. */

const Grain: React.FC<{ id: string; freq: number; gain: number; bias: number; seed: number; rgb?: [number, number, number] }> = ({ id, freq, gain, bias, seed, rgb = [0, 0, 0] }) => (
  <filter id={id} x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={4} seed={seed} result="n" />
    <feColorMatrix in="n" type="matrix" values={`0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  ${gain} 0 0 0 ${-bias}`} />
  </filter>
);

export const HAIR = 'M286 330 C276 262 292 196 340 160 C380 130 444 126 492 150 C536 172 528 214 516 246 C520 280 518 306 514 330 C506 294 498 268 486 252 C470 236 446 228 420 228 C392 228 362 236 338 248 C316 260 300 284 294 312 Z';

export const HairArt: React.FC = () => (
  <svg viewBox="0 0 800 1000" width="100%" height="100%">
    <defs>
      <linearGradient id="hg" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#2A2624" /><stop offset="0.5" stopColor="#141211" /><stop offset="1" stopColor="#090808" />
      </linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#151312" stopOpacity={0.95} /><stop offset="1" stopColor="#151312" stopOpacity={0} />
      </linearGradient>
      <clipPath id="hc"><path d={HAIR} /></clipPath>
      <Grain id="hgrain" freq={0.9} gain={1.2} bias={0.65} seed={3} rgb={[0.45, 0.42, 0.4]} />
      <filter id="hs"><feGaussianBlur stdDeviation="3" /></filter>
      <filter id="hs2"><feGaussianBlur stdDeviation="1.2" /></filter>
    </defs>
    {/* skin-fade on the sides */}
    <path d="M290 300 C286 330 288 352 292 372 L306 372 C304 340 306 314 312 290 Z" fill="url(#fade)" opacity={0.9} />
    <path d="M510 300 C514 330 512 352 508 372 L494 372 C496 340 494 314 488 290 Z" fill="url(#fade)" opacity={0.9} />
    <path d={HAIR} fill="url(#hg)" />
    <g clipPath="url(#hc)">
      <rect width="800" height="1000" filter="url(#hgrain)" opacity={0.5} />
      {/* swept-back strands */}
      {Array.from({ length: 120 }).map((_, i) => {
        const u = hash(i * 1.7), v = hash(i * 3.1);
        const x0 = 300 + u * 210, y0 = 250 - v * 40 + Math.abs(u - 0.45) * 60;
        const len = 70 + hash(i * 5.3) * 90;
        const dx = 40 + u * 40, dy = -len;
        const c = i % 7 === 0 ? '#5A524C' : i % 3 ? '#0B0A09' : '#2E2926';
        return <path key={i} d={`M${x0} ${y0} q${dx * 0.3} ${dy * 0.55} ${dx} ${dy}`} stroke={c} strokeWidth={1.4 + hash(i) * 2.4} fill="none" strokeLinecap="round" opacity={0.75} />;
      })}
      {/* sheen from the key light + green rim */}
      <path d="M350 190 C400 160 460 160 500 180" stroke="#B9B2AC" strokeWidth={14} opacity={0.18} fill="none" filter="url(#hs)" />
      <path d="M288 320 C280 260 296 200 340 164" stroke="#00E997" strokeWidth={6} opacity={0.5} fill="none" filter="url(#hs)" />
      <path d={HAIR} fill="none" stroke="#000" strokeWidth={22} opacity={0.35} filter="url(#hs)" />
    </g>
    {/* front quiff edge */}
    <path d="M338 248 C362 236 392 228 420 228 C446 228 470 236 486 252" stroke="#060505" strokeWidth={5} fill="none" opacity={0.7} filter="url(#hs2)" />
  </svg>
);

const JACKET_L = 'M0 1060 C10 880 70 790 210 744 C258 728 300 712 322 694 L360 760 L392 1060 Z';
const JACKET_R = 'M800 1060 C790 880 730 790 590 744 C542 728 500 712 478 694 L440 760 L408 1060 Z';

export const BodyArt: React.FC = () => (
  <svg viewBox="0 0 800 1000" width="100%" height="100%">
    <defs>
      <linearGradient id="jk" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#24292B" /><stop offset="0.4" stopColor="#121516" /><stop offset="1" stopColor="#060707" />
      </linearGradient>
      <linearGradient id="tee" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0E0F10" /><stop offset="1" stopColor="#050606" /></linearGradient>
      <radialGradient id="pin" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#7DFFD0" /><stop offset="0.5" stopColor="#00E997" /><stop offset="1" stopColor="#046B45" /></radialGradient>
      <clipPath id="jl"><path d={JACKET_L} /></clipPath>
      <clipPath id="jr"><path d={JACKET_R} /></clipPath>
      <Grain id="weave" freq={0.75} gain={1.1} bias={0.62} seed={8} rgb={[0.6, 0.66, 0.65]} />
      <Grain id="mott" freq={0.03} gain={1.6} bias={0.6} seed={21} />
      <filter id="bs"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="bs2"><feGaussianBlur stdDeviation="2" /></filter>
    </defs>
    {/* tee under the jacket */}
    <path d="M330 690 Q400 724 470 690 L476 1060 L324 1060 Z" fill="url(#tee)" />
    <path d="M336 694 Q400 726 464 694" stroke="#1C1F20" strokeWidth={6} fill="none" />
    {[JACKET_L, JACKET_R].map((d, k) => (
      <g key={k}>
        <path d={d} fill="url(#jk)" />
        <g clipPath={`url(#${k ? 'jr' : 'jl'})`}>
          <rect width="800" height="1060" filter="url(#mott)" opacity={0.6} />
          <rect width="800" height="1060" filter="url(#weave)" opacity={0.22} />
          <path d={d} fill="none" stroke="#000" strokeWidth={60} opacity={0.45} filter="url(#bs)" />
          {/* panel seams + quilted shoulder */}
          <path d={k ? 'M640 790 C600 780 560 790 520 820' : 'M160 790 C200 780 240 790 280 820'} stroke="#2E3436" strokeWidth={3} fill="none" />
          <path d={k ? 'M700 900 C640 880 580 890 520 930' : 'M100 900 C160 880 220 890 280 930'} stroke="#000" strokeWidth={10} opacity={0.4} fill="none" filter="url(#bs2)" />
        </g>
      </g>
    ))}
    {/* standing mandarin collar with green piping */}
    <path d="M306 690 C330 660 360 650 400 652 C440 650 470 660 494 690 L478 722 C456 700 430 692 400 694 C370 692 344 700 322 722 Z" fill="#181C1D" />
    <path d="M306 690 C330 660 360 650 400 652 C440 650 470 660 494 690" stroke="#00E997" strokeWidth={2.4} fill="none" opacity={0.85} />
    <path d="M306 690 C330 660 360 650 400 652 C440 650 470 660 494 690" stroke="#00E997" strokeWidth={8} fill="none" opacity={0.25} filter="url(#bs2)" />
    {/* zipper */}
    <path d="M400 760 L400 1060" stroke="#0A0B0B" strokeWidth={12} />
    {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={i % 2 ? 400 : 395} y={762 + i * 10} width={5} height={5} fill="#3A4143" />)}
    <rect x={393} y={756} width={14} height={30} rx={3} fill="#5E686B" />
    {/* trident pin */}
    <g transform="translate(540 850)">
      <rect x={-26} y={-26} width={52} height={52} rx={10} fill="#0B0F0C" stroke="#2B3A33" strokeWidth={2} />
      <g transform="translate(-19 -19) scale(1.19)"><path d="M6 3h4v10h4V3h4v10h4V3h4v14h-8v11h-4V17H6Z" fill="url(#pin)" /></g>
    </g>
    {/* rim lights */}
    <path d="M210 744 C70 790 10 880 0 1060" stroke="#00E997" strokeWidth={6} opacity={0.55} fill="none" filter="url(#bs2)" />
    <path d="M590 744 C730 790 790 880 800 1060" stroke="#CFE7FF" strokeWidth={4} opacity={0.2} fill="none" filter="url(#bs2)" />
  </svg>
);

export const TyBake: React.FC<{ part: 'hair' | 'body' }> = ({ part }) => (
  <AbsoluteFill style={{ background: 'transparent' }}>{part === 'hair' ? <HairArt /> : <BodyArt />}</AbsoluteFill>
);
