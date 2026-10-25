import React from 'react';

/**
 * Foil mystery pack in the brand's style (black/red flame foil, condensed RIP CARS lettering).
 * Local coords: 0..W x 0..H. `rip` 0..1 tears the top strip off along a jagged line; `glow` lights the opening.
 */
export const PACK_W = 260;
export const PACK_H = 360;
const TEAR_Y = 56;

const crimp = (y: number, w: number, up: boolean) => {
  let d = '';
  for (let x = 0; x <= w; x += 10) d += `L${x},${y + ((x / 10) % 2 ? (up ? -5 : 5) : 0)} `;
  return d;
};
const tear = (() => {
  const pts: [number, number][] = [];
  let s = 7;
  for (let x = -4; x <= PACK_W + 4; x += 13) { s = (s * 9301 + 49297) % 233280; pts.push([x, TEAR_Y + ((s / 233280) - 0.5) * 12]); }
  return pts;
})();
const tearPath = tear.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');

export const Pack: React.FC<{ id: string; rip?: number; glow?: number; sheen?: number; tint?: string; label?: string }> = ({ id, rip = 0, glow = 0, sheen = 0.3, tint = '#E0322F', label = 'MYSTERY PACK' }) => {
  const W = PACK_W, H = PACK_H;
  const body = `M0,8 ${crimp(8, W, true)} L${W},${H - 8} ${crimp(H - 8, W, false).split(' ').reverse().join(' ')} L0,${H - 8} Z`;
  const r = Math.min(1, rip);
  const art = (
    <g>
      <path d={body} fill={`url(#${id}foil)`} />
      <path d={body} fill={`url(#${id}flame)`} />
      <ellipse cx={W * 0.5} cy={H * 0.78} rx={W * 0.62} ry={H * 0.2} fill={`url(#${id}fire)`} />
      {/* car silhouette */}
      <path d={`M${W * 0.14},${H * 0.8} C${W * 0.2},${H * 0.72} ${W * 0.34},${H * 0.7} ${W * 0.44},${H * 0.66} C${W * 0.56},${H * 0.62} ${W * 0.7},${H * 0.64} ${W * 0.8},${H * 0.71} L${W * 0.88},${H * 0.74} L${W * 0.88},${H * 0.8} Z`} fill="#0A0A0D" stroke="#ffffff55" strokeWidth={1.4} />
      <circle cx={W * 0.3} cy={H * 0.8} r={W * 0.06} fill="#111" stroke="#bbb" strokeWidth={2} />
      <circle cx={W * 0.72} cy={H * 0.8} r={W * 0.06} fill="#111" stroke="#bbb" strokeWidth={2} />
      <path d={`M${W * 0.47},${H * 0.665} L${W * 0.64},${H * 0.66} L${W * 0.7},${H * 0.69}`} fill="none" stroke={tint} strokeWidth={2} />
      <text x={W / 2} y={36} textAnchor="middle" fontFamily="Space Grotesk" fontWeight={600} fontSize={9.5} letterSpacing="2.4" fill="#ffffffaa">PREMIUM DIE-CAST</text>
      <g transform={`translate(${W / 2} ${H * 0.36}) skewX(-8)`}>
        <text y={0} textAnchor="middle" fontFamily="Rajdhani" fontWeight={700} fontSize={92} fill="#fff" stroke="#00000066" strokeWidth={2} style={{ paintOrder: 'stroke' }}>RIP</text>
        <text y={74} textAnchor="middle" fontFamily="Rajdhani" fontWeight={700} fontSize={92} fill="#fff" stroke="#00000066" strokeWidth={2} style={{ paintOrder: 'stroke' }}>CARS</text>
      </g>
      <text x={W / 2} y={H * 0.92} textAnchor="middle" fontFamily="Rajdhani" fontWeight={700} fontSize={19} letterSpacing="1.5" fill="#fff">{label}</text>
      {/* holographic sheen */}
      <rect x={-W + sheen * W * 3} y={-40} width={W * 0.45} height={H + 80} fill={`url(#${id}sheen)`} transform={`rotate(16 ${W / 2} ${H / 2})`} style={{ mixBlendMode: 'screen' }} />
      {/* foil wrinkles */}
      <path d={`M${W * 0.1},${H * 0.15} Q${W * 0.3},${H * 0.4} ${W * 0.12},${H * 0.62}`} stroke="#ffffff14" strokeWidth={6} fill="none" />
      <path d={`M${W * 0.9},${H * 0.2} Q${W * 0.75},${H * 0.45} ${W * 0.92},${H * 0.7}`} stroke="#ffffff10" strokeWidth={8} fill="none" />
      <path d={body} fill="none" stroke="#ffffff22" strokeWidth={1.5} />
    </g>
  );
  return (
    <g>
      <defs>
        <linearGradient id={`${id}foil`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2A2A30" /><stop offset="0.35" stopColor="#0E0E12" /><stop offset="0.6" stopColor="#1E1E24" /><stop offset="1" stopColor="#09090C" />
        </linearGradient>
        <radialGradient id={`${id}flame`} cx="0.5" cy="0.9" r="0.75">
          <stop offset="0" stopColor={tint} stopOpacity={0.85} /><stop offset="0.5" stopColor="#7A0F0C" stopOpacity={0.45} /><stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}fire`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFB547" stopOpacity={0.9} /><stop offset="0.4" stopColor="#FF5A1F" stopOpacity={0.55} /><stop offset="1" stopColor="#E0322F" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}sheen`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0} /><stop offset="0.35" stopColor="#7FE3FF" stopOpacity={0.25} /><stop offset="0.5" stopColor="#fff" stopOpacity={0.55} /><stop offset="0.65" stopColor="#FF7AE0" stopOpacity={0.25} /><stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={`${id}light`} cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#FFF4D6" stopOpacity={1} /><stop offset="0.3" stopColor="#FFB547" stopOpacity={0.6} /><stop offset="1" stopColor="#FF5A1F" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${id}bottom`}><path d={`${tearPath} L${W + 10},${H + 20} L-10,${H + 20} Z`} /></clipPath>
        <clipPath id={`${id}top`}><path d={`${tearPath} L${W + 10},-20 L-10,-20 Z`} /></clipPath>
      </defs>
      {/* light spilling from the opening */}
      {glow > 0 && <ellipse cx={W / 2} cy={TEAR_Y} rx={W * (0.35 + glow * 0.3)} ry={40 + glow * 70} fill={`url(#${id}light)`} opacity={glow * 0.85} transform={`translate(0 ${-10 * glow})`} />}
      <g clipPath={`url(#${id}bottom)`}>{art}</g>
      <g transform={`translate(${-r * 150} ${-r * 70}) rotate(${-r * 28} ${W * 0.15} ${TEAR_Y})`} opacity={1 - Math.max(0, rip - 1) * 2}>
        <g clipPath={`url(#${id}top)`}>{art}</g>
      </g>
      {r > 0.05 && <path d={tearPath} stroke="#FFE2B0" strokeWidth={2 + glow * 3} fill="none" opacity={Math.min(1, r * 3)} style={{ filter: 'blur(1px)' }} />}
    </g>
  );
};
