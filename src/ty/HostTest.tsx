import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Host } from './Presenter';
import { C } from './ui';

const SHAPES = 'RXMaAEOUFSLK';
/** Contact sheet of every viseme on the live rig, for review. */
export const TyHostTest: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, display: 'flex', flexWrap: 'wrap' }}>
    {SHAPES.split('').map((v, i) => (
      <div key={v} style={{ width: 320, height: 540, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -240, top: -230, width: 800, height: 1000 }}>
          <Host t={1 + i * 0.37} vis={v.repeat(8)} frame={4} level={0.4} lensFx={i === 1 ? 1 : 0} lensMark={i === 0 ? 1 : 0} />
        </div>
        <div style={{ position: 'absolute', left: 10, top: 10, color: '#fff', fontSize: 28, fontFamily: 'monospace' }}>{v}</div>
      </div>
    ))}
  </AbsoluteFill>
);
