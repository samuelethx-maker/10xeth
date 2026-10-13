import React from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import T from './timeline.json';
import { Presenter } from './Presenter';
import { Film } from './Film';

const CharTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #13213d, #04060B 60%)', flexDirection: 'row' }}>
      {[0, 0.5, 1].map((o, i) => (
        <div key={i} style={{ width: 640, height: 800, marginTop: 280 }}>
          <Presenter t={f / 60 + i} open={o} wide={i === 1 ? 1 : 0} emphasis={i === 2 ? 1 : 0} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="DexstockFilm" component={Film} durationInFrames={T.fps * T.duration} fps={T.fps} width={1920} height={1080} />
    <Composition id="CharTest" component={CharTest} durationInFrames={60} fps={T.fps} width={1920} height={1080} />
  </>
);
