import { useState, useEffect, useCallback, useRef } from 'react';
// useRef kept for dismissedRef and onFinishRef

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
/* Darkness veil: stays solid black for 0.5s, then fades away over 0.7s.
   fill-mode:both means the veil starts at opacity:1 BEFORE the animation begins,
   hiding any CSS parsing / initial render jitter from the user. */
@keyframes gs-veil-out {
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

export function GreetingScreen({ onFinish, userName }: GreetingScreenProps) {
  const [now, setNow] = useState(() => new Date());
  const [exiting, setExiting] = useState(false);
  const dismissedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => { injectStyle(); }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setExiting(true);
    setTimeout(() => onFinishRef.current(), 700);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(dismiss, 15000);
    return () => clearTimeout(id);
  }, [dismiss]);

  const greeting = getGreeting(now.getHours());
  const displayName = (userName || 'ЛЕЙТЕНАНТ').toUpperCase();

  // b() = animation with fill:both — elements start at 'from' state during delay,
  // so they're invisible before their own animation plays. No JS visible-toggle needed.
  const b = (name: string, dur: string, delay: string, ease = 'cubic-bezier(0.22,1,0.36,1)') =>
    `${name} ${dur} ${ease} ${delay} 1 both`;

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
        // Screen fades in from black immediately; flicker starts at 2.5s
        animation: exiting
          ? 'gs-fade-out 0.7s ease 0s forwards'
          : 'gs-screen-in 0.5s ease 0s both, gs-flicker 8s ease-in-out 2.5s infinite',
      }}
    >
      {/* Scanline sweep */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(transparent, rgba(var(--cyan-rgb),0.06), transparent)',
          animation: 'gs-scan 6s linear 0.5s infinite',
        }} />
      </div>

      <div className="grid-bg" style={{ zIndex: 0 }} />

      {/* Corner — top-left */}
      <div style={{ position: 'absolute', top: 24, left: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-h', '0.4s', '0.2s') }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width:  '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-v', '0.4s', '0.2s') }} />
        </div>
      </div>

      {/* Corner — top-right */}
      <div style={{ position: 'absolute', top: 24, right: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{ position: 'absolute', top: 0, right: 0, height: '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-h', '0.4s', '0.25s') }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width:  '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-v', '0.4s', '0.25s') }} />
        </div>
      </div>

      {/* Corner — bottom-left */}
      <div style={{ position: 'absolute', bottom: 24, left: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-h', '0.4s', '0.30s') }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width:  '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-v', '0.4s', '0.30s') }} />
        </div>
      </div>

      {/* Corner — bottom-right */}
      <div style={{ position: 'absolute', bottom: 24, right: 28, zIndex: 2 }}>
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div style={{ position: 'absolute', bottom: 0, right: 0, height: '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-h', '0.4s', '0.35s') }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width:  '2px', background: 'var(--cyan)', borderRadius: 1, animation: b('gs-corner-v', '0.4s', '0.35s') }} />
        </div>
      </div>

      {/* Center content — all elements use fill:both so they start invisible
          during their delay, then animate in. No JS toggle required. */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>

        {/* Greeting */}
        <div style={{
          fontSize: '13px', letterSpacing: '0.35em',
          color: 'rgba(var(--cyan-rgb), 0.55)',
          marginBottom: '10px', textTransform: 'uppercase',
          animation: b('gs-fade-down', '0.5s', '0.1s'),
        }}>
          {greeting}
        </div>

        {/* Name */}
        <div style={{
          fontSize: '44px', fontWeight: 700, letterSpacing: '0.2em',
          color: 'var(--cyan)', lineHeight: 1, marginBottom: '8px',
          animation: `${b('gs-fade-up', '0.6s', '0.25s')}, gs-glow-pulse 3s ease-in-out 1.2s infinite both`,
        }}>
          {displayName}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: '11px', letterSpacing: '0.32em',
          color: 'rgba(var(--cyan-rgb), 0.35)', marginBottom: '40px',
          animation: b('gs-fade-up', '0.5s', '0.4s'),
        }}>
          СИСТЕМА КОННОРА · CYBERLIFE
        </div>

        {/* Divider line */}
        <div style={{ width: '1px', height: '48px', margin: '0 auto 40px', overflow: 'hidden' }}>
          <div style={{
            width: '1px', background: 'rgba(var(--cyan-rgb), 0.22)',
            animation: b('gs-divider-grow', '0.45s', '0.55s'),
          }} />
        </div>

        {/* Time */}
        <div style={{
          fontSize: '76px', fontWeight: 700, letterSpacing: '0.06em',
          color: 'var(--cyan)', lineHeight: 1, marginBottom: '14px',
          textShadow: '0 0 40px rgba(var(--cyan-rgb),0.35)',
          animation: b('gs-fade-up', '0.55s', '0.7s'),
        }}>
          {formatTime(now)}
        </div>

        {/* Date */}
        <div style={{
          fontSize: '12px', letterSpacing: '0.25em',
          color: 'rgba(var(--cyan-rgb), 0.5)',
          animation: b('gs-fade-up', '0.5s', '0.85s'),
        }}>
          {formatDate(now)}
        </div>
      </div>

      {/* Skip hint — flex outer for reliable centering regardless of text width */}
      <div style={{
        position: 'absolute', bottom: '32px',
        left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2, pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.3em',
          color: 'rgba(var(--cyan-rgb), 0.3)',
          animation: `${b('gs-fade-up', '0.5s', '2.0s')}, gs-skip-pulse 2.5s ease-in-out 2.5s infinite both`,
        }}>
          НАЖМИТЕ ДЛЯ ПРОПУСКА
        </div>
      </div>
    </div>
  );
}
