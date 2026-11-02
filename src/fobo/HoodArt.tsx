import React from 'react';
import { AbsoluteFill } from 'remotion';
import { hash } from './ui';

/* Static character art, baked once to PNG (see scripts/fobo_bake.sh) so filter-heavy texture costs nothing per frame.
   Coordinates are in an 800 x 1000 space shared with Presenter.tsx. */

export const VOID = 'M400 262 C492 262 556 330 560 432 C564 522 520 590 452 614 C420 624 380 624 348 614 C280 590 236 522 240 432 C244 330 308 262 400 262 Z';
const HOOD = 'M400 92 C432 96 472 110 508 130 C594 178 646 270 654 382 C662 484 634 566 592 616 C560 652 518 672 466 680 L334 680 C282 672 240 652 208 616 C166 566 138 484 146 382 C154 270 206 178 292 130 C328 110 368 96 400 92 Z';
const RIM = 'M400 236 C512 236 586 318 590 432 C594 536 536 616 456 642 C420 652 380 652 344 642 C264 616 206 536 210 432 C214 318 288 236 400 236 Z';
const CLOAK = 'M262 630 C160 668 66 748 30 1000 L770 1000 C734 748 640 668 538 630 C500 664 452 690 400 692 C348 690 300 664 262 630 Z';

const Fabric: React.FC<{ id: string; freq: number; gain: number; bias: number; seed: number; rgb?: [number, number, number] }> = ({ id, freq, gain, bias, seed, rgb = [0, 0, 0] }) => (
  <filter id={id} x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={4} seed={seed} result="n" />
    <feColorMatrix in="n" type="matrix" values={`0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  ${gain} 0 0 0 ${-bias}`} />
  </filter>
);

const Droplets: React.FC<{ n: number; seed: number; inside: (x: number, y: number) => boolean; box: [number, number, number, number] }> = ({ n, seed, inside, box }) => {
  const out: React.ReactNode[] = [];
  for (let i = 0, k = 0; k < n && i < n * 8; i++) {
    const x = box[0] + hash(seed + i * 3.1) * (box[2] - box[0]);
    const y = box[1] + hash(seed + i * 7.7) * (box[3] - box[1]);
    if (!inside(x, y)) continue;
    k++;
    const r = 1.2 + hash(seed + i * 1.9) ** 2 * 3.2;
    out.push(
      <g key={i}>
        <ellipse cx={x + r * 0.25} cy={y + r * 0.35} rx={r} ry={r * 0.9} fill="#000" opacity={0.35} />
        <ellipse cx={x} cy={y} rx={r} ry={r * 0.9} fill="#9FB7BD" opacity={0.18} />
        <circle cx={x - r * 0.3} cy={y - r * 0.35} r={Math.max(0.5, r * 0.32)} fill="#EFFFFF" opacity={0.85} />
      </g>,
    );
  }
  return <>{out}</>;
};

const inEllipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

export const HoodHeadArt: React.FC = () => (
  <svg viewBox="0 0 800 1000" width="100%" height="100%">
    <defs>
      <radialGradient id="hd" cx="0.38" cy="0.22" r="0.85">
        <stop offset="0" stopColor="#2C3438" /><stop offset="0.5" stopColor="#151B1E" /><stop offset="1" stopColor="#07090B" />
      </radialGradient>
      <radialGradient id="rim" cx="0.5" cy="0.45" r="0.6">
        <stop offset="0.8" stopColor="#060809" /><stop offset="0.9" stopColor="#1F272A" /><stop offset="1" stopColor="#0C1012" />
      </radialGradient>
      <radialGradient id="void" cx="0.5" cy="0.42" r="0.62">
        <stop offset="0" stopColor="#040606" /><stop offset="0.8" stopColor="#020303" /><stop offset="1" stopColor="#000" />
      </radialGradient>
      <linearGradient id="fth" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#24040A" /><stop offset="0.4" stopColor="#5E0F1E" /><stop offset="0.72" stopColor="#7E1729" /><stop offset="1" stopColor="#3A0812" />
      </linearGradient>
      <linearGradient id="cyanRim" x1="0" x2="1">
        <stop offset="0" stopColor="#5CFFE4" stopOpacity={0.85} /><stop offset="0.12" stopColor="#5CFFE4" stopOpacity={0} />
        <stop offset="0.9" stopColor="#9FD9FF" stopOpacity={0} /><stop offset="1" stopColor="#9FD9FF" stopOpacity={0.4} />
      </linearGradient>
      <clipPath id="hoodClip"><path d={HOOD} /></clipPath>
      <Fabric id="knit" freq={0.85} gain={1.1} bias={0.62} seed={4} rgb={[0.75, 0.85, 0.88]} />
      <Fabric id="wool" freq={0.035} gain={1.8} bias={0.62} seed={9} />
      <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="soft2"><feGaussianBlur stdDeviation="2.5" /></filter>
    </defs>

    {/* feather tucked behind the right side of the hood */}
    <g>
      <path d="M560 520 C610 420 668 280 748 96 C770 150 768 222 742 296 C712 380 660 452 598 516 Z" fill="url(#fth)" />
      <path d="M560 520 C600 430 652 300 748 96 C716 170 690 236 650 320 C622 380 590 450 560 520 Z" fill="#2A050B" opacity={0.55} />
      {Array.from({ length: 70 }).map((_, i) => {
        const p = i / 69; const x = 562 + p * 184 - p * p * 10, y = 516 - p * 418;
        const L = 34 - p * 18;
        return (
          <g key={i} opacity={0.5}>
            <path d={`M${x} ${y} q${L * 0.6} ${-L * 0.2} ${L} ${L * 0.15}`} stroke={i % 4 ? '#B8344C' : '#5A0A18'} strokeWidth={1.1} fill="none" />
            <path d={`M${x} ${y} q${-L * 0.25} ${-L * 0.35} ${-L * 0.45} ${-L * 0.1}`} stroke="#3E0712" strokeWidth={1} fill="none" />
          </g>
        );
      })}
      {[[0.3, 1], [0.52, 1], [0.7, 1], [0.44, -1]].map(([p, side], i) => {
        const x = 562 + p * 184, y = 516 - p * 418;
        return <path key={i} d={`M${x + side * 6} ${y - 4} l${side * 28} ${-6} l${side * 2} ${12} Z`} fill="#06090B" />;
      })}
      <path d="M556 530 C606 424 664 282 748 96" stroke="#EAD3CB" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.75} />
      <path d="M620 300 C660 220 700 160 740 112" stroke="#FF8EA0" strokeWidth={6} fill="none" opacity={0.18} filter="url(#soft2)" />
    </g>

    {/* hood */}
    <path d={HOOD} fill="url(#hd)" />
    <g clipPath="url(#hoodClip)">
      <rect width="800" height="1000" filter="url(#wool)" opacity={0.75} />
      <rect width="800" height="1000" filter="url(#knit)" opacity={0.35} />
      {/* volume: dark falloff toward the silhouette, soft top-left sheen */}
      <path d={HOOD} fill="none" stroke="#000" strokeWidth={90} opacity={0.55} filter="url(#soft)" />
      <ellipse cx={300} cy={190} rx={120} ry={70} fill="#8FA6AC" opacity={0.1} filter="url(#soft)" />
      {/* folds */}
      <path d="M210 230 C250 320 236 420 260 560" stroke="#000" strokeWidth={26} opacity={0.35} fill="none" filter="url(#soft)" />
      <path d="M590 230 C552 320 566 420 540 560" stroke="#000" strokeWidth={26} opacity={0.3} fill="none" filter="url(#soft)" />
      <path d="M300 140 C330 170 352 200 362 250" stroke="#8FA3A8" strokeWidth={14} opacity={0.12} fill="none" filter="url(#soft)" />
      {/* centre seam */}
      <path d="M400 94 C403 150 404 200 400 240" stroke="#05080A" strokeWidth={6} fill="none" />
      <path d="M400 94 C403 150 404 200 400 240" stroke="#5E6E73" strokeWidth={2} strokeDasharray="5 6" fill="none" opacity={0.6} />
      <Droplets n={170} seed={11} box={[150, 95, 650, 680]} inside={(x, y) => !inEllipse(400, 440, 200, 215)(x, y)} />
      {/* rim lights: cyan key from the left, cool city light from the right */}
      <path d={HOOD} fill="none" stroke="url(#cyanRim)" strokeWidth={10} filter="url(#soft2)" />
    </g>
    {/* rolled inner lip + face void */}
    <path d={RIM} fill="url(#rim)" />
    <path d={RIM} fill="none" stroke="#000" strokeWidth={14} opacity={0.6} filter="url(#soft)" />
    <path d="M232 400 C246 300 316 248 400 246 C470 246 532 284 562 350" stroke="#7E949A" strokeWidth={7} fill="none" opacity={0.28} filter="url(#soft2)" />
    <path d={VOID} fill="none" stroke="#5CFFE4" strokeOpacity={0.35} strokeWidth={16} filter="url(#soft)" />
    <path d={VOID} fill="url(#void)" />
    <path d={VOID} fill="none" stroke="#000" strokeWidth={10} filter="url(#soft2)" />
  </svg>
);

export const HoodBodyArt: React.FC = () => (
  <svg viewBox="0 0 800 1000" width="100%" height="100%">
    <defs>
      <linearGradient id="ck" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#1E2529" /><stop offset="0.35" stopColor="#101416" /><stop offset="1" stopColor="#050708" />
      </linearGradient>
      <radialGradient id="clasp" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#D8E4E6" /><stop offset="0.35" stopColor="#6E7E83" /><stop offset="1" stopColor="#1A2023" />
      </radialGradient>
      <clipPath id="cloakClip"><path d={CLOAK} /></clipPath>
      <Fabric id="knit2" freq={0.85} gain={1.1} bias={0.62} seed={5} rgb={[0.75, 0.85, 0.88]} />
      <Fabric id="wool2" freq={0.03} gain={1.8} bias={0.62} seed={13} />
      <filter id="softb"><feGaussianBlur stdDeviation="7" /></filter>
      <filter id="softc"><feGaussianBlur stdDeviation="2.5" /></filter>
    </defs>
    <path d={CLOAK} fill="url(#ck)" />
    <g clipPath="url(#cloakClip)">
      <rect width="800" height="1000" filter="url(#wool2)" opacity={0.75} />
      <rect width="800" height="1000" filter="url(#knit2)" opacity={0.3} />
      <path d="M262 630 C330 700 470 700 538 630" stroke="#000" strokeWidth={60} opacity={0.6} fill="none" filter="url(#softb)" />
      {/* capelet layer + folds */}
      <path d="M150 760 C250 820 330 840 400 842 C470 840 550 820 650 760 L700 1000 L100 1000 Z" fill="#000" opacity={0.25} filter="url(#softb)" />
      <path d="M150 760 C250 820 330 840 400 842 C470 840 550 820 650 760" stroke="#3A4448" strokeWidth={3} fill="none" opacity={0.6} />
      {[260, 330, 470, 540].map((x, i) => <path key={i} d={`M${x} ${820 + (i % 2) * 6} C${x + (x < 400 ? -10 : 10)} 900 ${x + (x < 400 ? -18 : 18)} 960 ${x + (x < 400 ? -22 : 22)} 1000`} stroke="#000" strokeWidth={14} opacity={0.3} fill="none" filter="url(#softb)" />)}
      <path d="M262 630 C160 668 66 748 30 1000" stroke="#5CFFE4" strokeOpacity={0.55} strokeWidth={6} fill="none" filter="url(#softc)" />
      <path d="M538 630 C640 668 734 748 770 1000" stroke="#9FD9FF" strokeOpacity={0.25} strokeWidth={5} fill="none" filter="url(#softc)" />
      <Droplets n={70} seed={23} box={[40, 640, 760, 1000]} inside={() => true} />
    </g>
    {/* clasp + cords */}
    <path d="M352 700 C370 740 386 760 400 772 C414 760 430 740 448 700" stroke="#0B0E10" strokeWidth={7} fill="none" />
    <circle cx={400} cy={776} r={24} fill="url(#clasp)" />
    <circle cx={400} cy={776} r={24} fill="none" stroke="#05080A" strokeWidth={3} />
    <circle cx={392} cy={768} r={6} fill="#fff" opacity={0.6} />
  </svg>
);

export const HoodBake: React.FC<{ part: 'head' | 'body' }> = ({ part }) => (
  <AbsoluteFill style={{ background: 'transparent' }}>{part === 'head' ? <HoodHeadArt /> : <HoodBodyArt />}</AbsoluteFill>
);
