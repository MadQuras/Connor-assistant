import { CSSProperties } from 'react';

interface ConnorLogoProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
  animated?: boolean;
}

/**
 * Connor RK800 logo — android cyber-eye in an octagon frame.
 *
 * Geometry (viewBox 200×200, eye center 100,95):
 *  • Octagon with 4 directional chevrons (N/S/E/W)
 *  • Upper eyelid: filled crescent between outer arc (r≈73, c≈100,130)
 *    and inner arc (r≈104, c≈100,177)
 *  • Eye socket dark fill
 *  • Iris rings (r=36 outer, r=26 mid), black pupil
 *  • 4 lower-iris data segments (thick arcs, bright)
 *  • Pointed eye corners (left/right chevrons)
 *  • Scanlines overlay
 *
 * Uses currentColor → inherits --cyan from Shell / wherever it's placed.
 */
export function ConnorLogo({
  size = 24,
  style,
  className,
  animated = false,
}: ConnorLogoProps) {
  const anim: CSSProperties = animated
    ? { animation: 'triPulse 3s ease-in-out infinite' }
    : {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      width={size}
      height={size}
      style={{ color: 'var(--cyan)', display: 'block', ...anim, ...style }}
      className={className}
      aria-label="Connor RK800"
    >
      <defs>
        {/* Scanline pattern — one 1px line every 4px */}
        <pattern
          id="csl"
          x="0" y="0"
          width="200" height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="200" height="1"
            fill="currentColor" opacity="0.04" />
        </pattern>

        {/* Glow filter for the key elements */}
        <filter id="cglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Eye interior clip — outer arc + lower arc */}
        <clipPath id="ceye">
          {/*
            Upper boundary: from (36,95) → r=73 CCW → (164,95)   [top of eye, y≈57]
            Lower boundary: from (164,95) → r=76 CW  → (36,95)   [bottom of eye, y=130]
          */}
          <path d="M 36,95 A 73,73 0 0,0 164,95 A 76,76 0 0,1 36,95 Z" />
        </clipPath>
      </defs>

      {/* ── OCTAGON ── */}
      {/* Outer glow ring */}
      <polygon
        points="70,12 130,12 188,70 188,130 130,188 70,188 12,130 12,70"
        stroke="currentColor" strokeWidth="5" opacity="0.07"
      />
      {/* Main border */}
      <polygon
        points="70,12 130,12 188,70 188,130 130,188 70,188 12,130 12,70"
        stroke="currentColor" strokeWidth="2.2"
      />

      {/* ── DIRECTIONAL MARKERS ── */}
      {/* North ▼ */}
      <path d="M 88,16 L100,35 L112,16 Z" fill="currentColor" />
      {/* South ▲ */}
      <path d="M 88,184 L100,165 L112,184 Z" fill="currentColor" />
      {/* West ► */}
      <path d="M 16,86 L35,100 L16,114 Z" fill="currentColor" />
      {/* East ◄ */}
      <path d="M 184,86 L165,100 L184,114 Z" fill="currentColor" />

      {/* ── UPPER EYELID FILL ──
           Crescent between:
             outer arc (36,95)→(164,95) curving to y≈57  [r=73, ctr≈(100,130)]
             inner arc (164,95)→(36,95) curving to y≈73  [r=104, ctr≈(100,177)]
           Both arcs: CCW (sweep-flag=0), short (large-arc-flag=0).
      */}
      <path
        d="M 36,95 A 73,73 0 0,0 164,95 A 104,104 0 0,0 36,95 Z"
        fill="currentColor"
        filter="url(#cglow)"
      />

      {/* ── EYE SOCKET DARK FILL ──
           Region between inner eyelid arc (going through y≈73) and lower arc
           (going through y=130). Uses bg1 colour so pupil area is pure black.
      */}
      <path
        d="M 36,95 A 104,104 0 0,0 164,95 A 76,76 0 0,1 36,95 Z"
        style={{ fill: 'var(--bg1, #04070E)' }}
      />

      {/* ── IRIS & PUPIL (clipped to eye interior) ── */}
      <g clipPath="url(#ceye)">
        {/* Outer iris ring */}
        <circle cx="100" cy="95" r="36"
          stroke="currentColor" strokeWidth="2.5" filter="url(#cglow)" />
        {/* Middle iris ring */}
        <circle cx="100" cy="95" r="26"
          stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        {/* Pupil */}
        <circle cx="100" cy="95" r="14" fill="#000" />
        {/* Inner pupil ring */}
        <circle cx="100" cy="95" r="12"
          stroke="currentColor" strokeWidth="1" opacity="0.3" />

        {/* ── LOWER IRIS DATA SEGMENTS ──
             Iris r=36, center (100,95). Angles measured CW from East.
             All arcs drawn CW (sweep-flag=1), short (large-arc-flag=0).

             Points pre-calculated:
               θ=20°  → (133.8, 107.3)
               θ=58°  → (119.1, 125.5)
               θ=65°  → (115.2, 127.6)
               θ=86°  → (102.5, 130.9)
               θ=94°  → (97.5, 130.9)
               θ=115° → (84.8, 127.6)
               θ=122° → (80.9, 125.5)
               θ=160° → (66.2, 107.3)
        */}
        {/* Seg 1 — lower right */}
        <path
          d="M 133.8,107.3 A 36,36 0 0,1 119.1,125.5"
          stroke="currentColor" strokeWidth="7"
          strokeLinecap="butt" filter="url(#cglow)"
        />
        {/* Seg 2 — bottom right */}
        <path
          d="M 115.2,127.6 A 36,36 0 0,1 102.5,130.9"
          stroke="currentColor" strokeWidth="7"
          strokeLinecap="butt" filter="url(#cglow)"
        />
        {/* Bottom centre pointer ▼ */}
        <path d="M 96,131 L100,141 L104,131 Z" fill="currentColor" />
        {/* Seg 3 — bottom left */}
        <path
          d="M 97.5,130.9 A 36,36 0 0,1 84.8,127.6"
          stroke="currentColor" strokeWidth="7"
          strokeLinecap="butt" filter="url(#cglow)"
        />
        {/* Seg 4 — lower left */}
        <path
          d="M 80.9,125.5 A 36,36 0 0,1 66.2,107.3"
          stroke="currentColor" strokeWidth="7"
          strokeLinecap="butt" filter="url(#cglow)"
        />
      </g>

      {/* ── EYE CORNER ARROWS ──
           Left: point at (36,95), arrow body extends right into eye
           Right: point at (164,95), arrow body extends left into eye
      */}
      <path d="M 36,95 L 56,83 L 56,107 Z" fill="currentColor" />
      <path d="M 164,95 L 144,83 L 144,107 Z" fill="currentColor" />

      {/* ── SCANLINES OVERLAY ── */}
      <rect x="0" y="0" width="200" height="200" fill="url(#csl)" />
    </svg>
  );
}
