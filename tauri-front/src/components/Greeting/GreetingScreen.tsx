import { useState, useEffect, useCallback, useRef } from 'react';

export interface GreetingScreenProps {
  onFinish: () => void;
  userName?: string;
}

const MONTHS = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];

const DAYS = [
  'Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота',
];

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'ДОБРОЕ УТРО';
  if (hour >= 12 && hour < 17) return 'ДОБРЫЙ ДЕНЬ';
  if (hour >= 17 && hour < 23) return 'ДОБРЫЙ ВЕЧЕР';
  return 'ДОБРОЙ НОЧИ';
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  const day = DAYS[date.getDay()];
  const d = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day}, ${d} ${month} ${year}`;
}

// CSS injected once
const STYLE = `
@keyframes gs-screen-in {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes gs-fade-up {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes gs-fade-down {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes gs-divider-grow {
  from { height: 0px; opacity: 0; }
  to   { height: 48px; opacity: 1; }
}
@keyframes gs-corner-h {
  from { width: 0; }
  to   { width: 24px; }
}
@keyframes gs-corner-v {
  from { height: 0; }
  to   { height: 24px; }
}
@keyframes gs-glow-pulse {
  0%, 100% { text-shadow: 0 0 24px rgba(var(--cyan-rgb),0.45), 0 0 60px rgba(var(--cyan-rgb),0.15); }
  50%       { text-shadow: 0 0 40px rgba(var(--cyan-rgb),0.75), 0 0 90px rgba(var(--cyan-rgb),0.30); }
}
@keyframes gs-flicker {
  0%,96%,100% { opacity: 1; }
  97%          { opacity: 0.6; }
  98%          { opacity: 1; }
  99%          { opacity: 0.7; }
}
@keyframes gs-scan {
  from { transform: translateY(-100%); }
  to   { transform: translateY(100vh); }
}
@keyframes gs-skip-pulse {
  0%,100% { opacity: 0.28; }
  50%     { opacity: 0.55; }
}
@keyframes gs-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
`;

function injectStyle() {
  if (document.getElementById('gs-style')) return;
  const el = document.createElement('style');
  el.id = 'gs-style';
  el.textContent = STYLE;
  document.head.appendChild(el);
}

const anim = (name: string, dur: string, delay: string, fill = 'forwards', ease = 'cubic-bezier(0.22,1,0.36,1)') =>
  `${name} ${dur} ${ease} ${delay} ${fill}`;

export function GreetingScreen({ onFinish, userName }: GreetingScreenProps) {
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Inject keyframes once
  useEffect(() => { injectStyle(); }, []);

  // Inject keyframes first, then give the browser ~200 ms to parse them
  // before kicking off content animations.  Using rAF alone fires too
  // quickly and the content appears before animations play.
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(id);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setExiting(true);
    setTimeout(() => onFinishRef.current(), 700);
  }, []);

  // Tick clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const id = setTimeout(dismiss, 15000);
    return () => clearTimeout(id);
  }, [dismiss]);

  const greeting = getGreeting(now.getHours());
  const displayName = (userName || 'ЛЕЙТЕНАНТ').toUpperCase();

  // Screen always fades in from black on mount; then flickers; then fades out on exit.
  const screenAnim = exiting
    ? anim('gs-fade-out', '0.7s', '0s', 'forwards', 'ease')
    : visible
      ? anim('gs-flicker', '8s', '2.5s', 'infinite')
      : anim('gs-screen-in', '0.35s', '0s', 'forwards', 'ease');

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none',
        fontFamily: 'var(--font-mono, "Share Tech Mono", monospace)',
        zIndex: 9999,
        opacity: exiting ? undefined : (visible ? undefined : 0),
        animation: screenAnim,
      }}
    >
      {/* Scanline sweep */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(transparent, rgba(var(--cyan-rgb),0.06), transparent)',
          animation: anim('gs-scan', '6s', '0.5s', 'infinite', 'linear'),
        }} />
      </div>

      {/* Grid background */}
      <div className="grid-bg" style={{ zIndex: 0 }} />

      {/* Corner — top-left */}
      <div style={{ position: 'absolute', top: 24, left: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            height: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-h', '0.45s', '0.05s') : undefined,
          }} />
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-v', '0.45s', '0.05s') : undefined,
          }} />
        </div>
      </div>

      {/* Corner — top-right */}
      <div style={{ position: 'absolute', top: 24, right: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            height: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-h', '0.45s', '0.10s') : undefined,
          }} />
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-v', '0.45s', '0.10s') : undefined,
          }} />
        </div>
      </div>

      {/* Corner — bottom-left */}
      <div style={{ position: 'absolute', bottom: 24, left: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            height: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-h', '0.45s', '0.15s') : undefined,
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            width: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-v', '0.45s', '0.15s') : undefined,
          }} />
        </div>
      </div>

      {/* Corner — bottom-right */}
      <div style={{ position: 'absolute', bottom: 24, right: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            height: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-h', '0.45s', '0.20s') : undefined,
          }} />
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '2px', background: 'var(--cyan)', borderRadius: 1,
            opacity: visible ? 1 : 0,
            animation: visible ? anim('gs-corner-v', '0.45s', '0.20s') : undefined,
          }} />
        </div>
      </div>

      {/* Center content */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>

        {/* Greeting */}
        <div style={{
          fontSize: '13px', letterSpacing: '0.35em',
          color: 'rgba(var(--cyan-rgb), 0.55)',
          marginBottom: '10px', textTransform: 'uppercase',
          opacity: visible ? 1 : 0,
          animation: visible ? anim('gs-fade-down', '0.6s', '0.35s') : undefined,
        }}>
          {greeting}
        </div>

        {/* Name */}
        <div style={{
          fontSize: '44px', fontWeight: 700, letterSpacing: '0.2em',
          color: 'var(--cyan)', lineHeight: 1, marginBottom: '8px',
          opacity: visible ? 1 : 0,
          animation: visible
            ? `${anim('gs-fade-up', '0.7s', '0.55s')}, ${anim('gs-glow-pulse', '3s', '1.5s', 'infinite', 'ease-in-out')}`
            : undefined,
        }}>
          {displayName}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: '11px', letterSpacing: '0.32em',
          color: 'rgba(var(--cyan-rgb), 0.35)', marginBottom: '40px',
          opacity: visible ? 1 : 0,
          animation: visible ? anim('gs-fade-up', '0.6s', '0.80s') : undefined,
        }}>
          СИСТЕМА КОННОРА · CYBERLIFE
        </div>

        {/* Divider line */}
        <div style={{
          width: '1px', height: '48px', margin: '0 auto 40px',
          overflow: 'hidden',
          opacity: visible ? 1 : 0,
        }}>
          <div style={{
            width: '1px',
            background: 'rgba(var(--cyan-rgb), 0.22)',
            animation: visible ? anim('gs-divider-grow', '0.5s', '1.0s') : undefined,
          }} />
        </div>

        {/* Time */}
        <div style={{
          fontSize: '76px', fontWeight: 700, letterSpacing: '0.06em',
          color: 'var(--cyan)', lineHeight: 1, marginBottom: '14px',
          textShadow: '0 0 40px rgba(var(--cyan-rgb),0.35)',
          opacity: visible ? 1 : 0,
          animation: visible ? anim('gs-fade-up', '0.65s', '1.15s') : undefined,
        }}>
          {formatTime(now)}
        </div>

        {/* Date */}
        <div style={{
          fontSize: '12px', letterSpacing: '0.25em',
          color: 'rgba(var(--cyan-rgb), 0.5)',
          opacity: visible ? 1 : 0,
          animation: visible ? anim('gs-fade-up', '0.6s', '1.35s') : undefined,
        }}>
          {formatDate(now)}
        </div>
      </div>

      {/* Skip hint */}
      <div style={{
        position: 'absolute', bottom: '32px', left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px', letterSpacing: '0.3em',
        color: 'rgba(var(--cyan-rgb), 0.3)', whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        animation: visible
          ? `${anim('gs-fade-up', '0.5s', '2.0s')}, ${anim('gs-skip-pulse', '2.5s', '2.5s', 'infinite', 'ease-in-out')}`
          : undefined,
      }}>
        НАЖМИТЕ ДЛЯ ПРОПУСКА
      </div>
    </div>
  );
}
