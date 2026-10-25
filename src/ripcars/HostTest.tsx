import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Host } from './Presenter';

const cfg = [
  { open: 0, wide: 0, round: 0, hold: 1, rip: 0 },
  { open: 0.6, wide: 0, round: 0, hold: 1, rip: 0.6, packGlow: 0.8 },
  { open: 0.8, wide: 0.1, round: 0, hold: 0, rip: 0 },
  { open: 0.3, wide: 1, round: 0, hold: 0, rip: 0 },
  { open: 0.45, wide: 0, round: 1, hold: 0, rip: 0 },
];
export const HostTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2a0d0c, #08080B 60%)', flexDirection: 'row', overflow: 'hidden' }}>
      {cfg.map((c, i) => (
        <div key={i} style={{ width: 384, height: 1080, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', width: i < 2 ? 760 : 1400, height: i < 2 ? 950 : 1750, left: i < 2 ? -188 : -508, top: i < 2 ? 130 : -260 }}>
          <Host t={f / 60 + i} {...c} />
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
