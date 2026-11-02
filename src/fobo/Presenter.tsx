import React from 'react';
import { Img, staticFile } from 'remotion';
import { C, Expr, PixelFace, noise } from './ui';

/** FOBO host: the hooded figure from the litepaper key art, with a live LED pixel face that lip-syncs. */
export const Host: React.FC<{
  t: number; vis: string; ghost?: string; level?: number; expr?: Expr; emphasis?: number; look?: number; boot?: number; screenGlow?: number;
}> = ({ t, vis, ghost, level = 0, expr = 'normal', emphasis = 0, look = 0, boot = 1, screenGlow = 1 }) => {
  const tilt = noise(t * 0.45, 2) * 2.2 + look * 2.5 + emphasis * 1.5;
  const nod = noise(t * 0.8, 6) * 3 + level * 4 + emphasis * 7;
  const turn = noise(t * 0.33, 8) * 6 + look * 10;
  const breathe = Math.sin(t * 1.5) * 0.006;
  const U = 15.5; // LED pixel size in the 800x1000 rig space
  const faceL = 400 - 9.7 * U, faceT = 438 - 6.9 * U;
  const g = screenGlow * (0.75 + level * 0.5);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g transform={`translate(400 1000) scale(${1 + breathe * 0.5} ${1 + breathe}) translate(-400 -1000)`}>
          <image href={staticFile('fobo/hood_body.png')} x={0} y={0} width={800} height={1000} />
          {/* face spill on the chest */}
          <ellipse cx={400} cy={700} rx={170} ry={60} fill={C.cyan} opacity={0.05 * g} style={{ filter: 'blur(30px)' }} />
        </g>
        <g transform={`translate(400 640) rotate(${tilt}) translate(${turn} ${nod * 0.6}) translate(-400 -640)`}>
          <image href={staticFile('fobo/hood_head.png')} x={0} y={0} width={800} height={1000} />
          <ellipse cx={400 + turn * 0.8} cy={440} rx={150} ry={130} fill={C.cyan} opacity={0.07 * g * boot} style={{ filter: 'blur(40px)' }} />
          <foreignObject x={faceL + turn * 1.1} y={faceT + nod * 0.15} width={20 * U} height={16 * U}>
            <PixelFace unit={U} expr={expr} vis={vis} ghost={ghost} glow={0.8 + level * 0.5} boot={boot} lookX={look * 0.6} />
          </foreignObject>
        </g>
      </svg>
    </div>
  );
};
