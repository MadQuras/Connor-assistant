import { CSSProperties } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { eyeSrcForAccent } from '../../lib/eyeAccent';

interface ConnorLogoProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
  animated?: boolean;
}

/** Connor RK800 eye — PNG asset (1A), color follows accent_color. */
export function ConnorLogo({
  size = 24,
  style,
  className,
  animated = false,
}: ConnorLogoProps) {
  const { config } = useConfig();
  const src = eyeSrcForAccent(config.accent_color);

  const anim: CSSProperties = animated
    ? { animation: 'triPulse 3s ease-in-out infinite' }
    : {};

  return (
    <img
      key={src}
      src={src}
      width={size}
      height={size}
      alt="Connor RK800"
      draggable={false}
      className={className}
      style={{
        display: 'block',
        objectFit: 'contain',
        flexShrink: 0,
        ...anim,
        ...style,
      }}
    />
  );
}
