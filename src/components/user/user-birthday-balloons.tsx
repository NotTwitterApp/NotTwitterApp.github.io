import { publicAsset } from '@lib/assets';
import type { CSSProperties, JSX } from 'react';

const BALLOONS = [
  { left: 1, size: 78, hue: 190, delay: 0, duration: 9.8, sway: 84 },
  {
    left: 8,
    size: 54,
    hue: 315,
    delay: 0.45,
    duration: 10.6,
    sway: -56
  },
  { left: 15, size: 92, hue: 38, delay: 1.1, duration: 9.4, sway: 72 },
  {
    left: 24,
    size: 66,
    hue: 140,
    delay: 0.2,
    duration: 10.9,
    sway: -82
  },
  {
    left: 32,
    size: 106,
    hue: 260,
    delay: 1.35,
    duration: 10.2,
    sway: 62
  },
  {
    left: 42,
    size: 58,
    hue: 24,
    delay: 0.85,
    duration: 9.7,
    sway: -48
  },
  {
    left: 51,
    size: 86,
    hue: 205,
    delay: 1.75,
    duration: 11,
    sway: 76
  },
  {
    left: 61,
    size: 60,
    hue: 332,
    delay: 0.6,
    duration: 9.5,
    sway: -68
  },
  {
    left: 70,
    size: 98,
    hue: 58,
    delay: 1.45,
    duration: 10.8,
    sway: -74
  },
  {
    left: 81,
    size: 64,
    hue: 154,
    delay: 0.95,
    duration: 9.9,
    sway: 54
  },
  {
    left: 90,
    size: 110,
    hue: 280,
    delay: 1.95,
    duration: 11.2,
    sway: -88
  },
  {
    left: 97,
    size: 72,
    hue: 15,
    delay: 0.35,
    duration: 10.1,
    sway: -64
  }
] as const;

export function UserBirthdayBalloons(): JSX.Element {
  const balloonTexture = publicAsset('/assets/twitter-birthday-balloon.svg');

  return (
    <div
      className='birthday-balloons pointer-events-none fixed inset-0 z-[70] h-screen w-screen overflow-hidden'
      aria-hidden='true'
    >
      {BALLOONS.map(({ left, size, hue, delay, duration, sway }) => (
        <span
          className='birthday-balloon'
          style={
            {
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundImage: `url(${balloonTexture})`,
              filter: `hue-rotate(${hue}deg) saturate(1.25)`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              '--birthday-balloon-sway': `${sway}px`
            } as CSSProperties
          }
          key={`${left}-${hue}`}
        />
      ))}
    </div>
  );
}
