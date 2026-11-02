import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Host } from './Presenter';
import { C } from './ui';

const SHAPES = 'RXMaAEOUFSLK';
export const FoboHostTest: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, display: 'flex', flexWrap: 'wrap' }}>
    {SHAPES.split('').map((v, i) => (
      <div key={v} style={{ width: 320, height: 540, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -100, top: -60, width: 520, height: 650 }}>
          <Host t={i * 0.7} vis={v} expr={i === 0 ? 'wink' : i === 11 ? 'heart' : 'normal'} level={0.5} />
        </div>
        <div style={{ position: 'absolute', left: 10, top: 10, color: '#fff', fontSize: 28, fontFamily: 'monospace' }}>{v}</div>
      </div>
    ))}
  </AbsoluteFill>
);
