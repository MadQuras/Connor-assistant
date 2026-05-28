import { useState, useEffect } from 'react';
import { ConnorLogo } from '../Logo/ConnorLogo';

interface WelcomeFlowProps {
  onFinish: (userName: string) => void;
}

const DAYS_RU = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function getGreeting(h: number) {
  if (h >= 5 && h < 12)  return { text: 'Доброе утро',  badge: 'УТРО · 05:00 — 12:00' };
  if (h >= 12 && h < 17) return { text: 'Добрый день',   badge: 'ДЕНЬ · 12:00 — 17:00' };
  if (h >= 17 && h < 22) return { text: 'Добрый вечер',  badge: 'ВЕЧЕР · 17:00 — 22:00' };
  return                         { text: 'Доброй ночи',   badge: 'НОЧЬ · 22:00 — 05:00' };
}

const SCAN_LOGS = [
  '> scanner.py запущен',
  '> захват рабочего стола...',
  '> OCR: обнаружено иконки...',
  '> сканирование Program Files...',
  '> найдено: chrome.exe',
  '> найдено: steam.exe',
  '> сканирование AppData\\Local...',
  '> найдено: code.exe',
  '> классификация завершена',
  '> запись в memory.json...',
  '> СКАНИРОВАНИЕ ЗАВЕРШЕНО ✓',
];

const INTRO_TEXT = 'Меня зовут Коннор. Я андроид, разработанный компанией Cyberlife. Рад познакомиться. Как мне к вам обращаться?';

// ── Screen 1: Greet ───────────────────────────────────────────
function GreetScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(id); }, []);
  const p2 = (v: number) => String(v).padStart(2, '0');
  const { text, badge } = getGreeting(now.getHours());
  const dateStr = `${DAYS_RU[now.getDay()]}, ${now.getDate()} ${MONTHS_RU[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="wf-screen">
      <div className="wf-badge">{badge}</div>
      <div className="wf-logo-wrap">
        <div className="wf-ring3" /><div className="wf-ring2" /><div className="wf-ring1" />
        <ConnorLogo size={64} animated />
      </div>
      <div className="wf-hello">{text}</div>
      <div className="wf-sub">СИСТЕМА КОННОР RK800 · CYBERLIFE</div>
      <div className="wf-clock">{p2(now.getHours())}:{p2(now.getMinutes())}</div>
      <div className="wf-date">{dateStr}</div>
      <div className="wf-btns">
        <button className="wf-btn-primary" onClick={onNext}>НАЧАТЬ →</button>
        <button className="wf-btn-ghost" onClick={onSkip}>ПРОПУСТИТЬ</button>
      </div>
    </div>
  );
}

// ── Screen 2: Intro / Name ────────────────────────────────────
function IntroScreen({ onNext, onBack }: { onNext: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(INTRO_TEXT.slice(0, i));
      if (i >= INTRO_TEXT.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="wf-screen wf-narrow">
      <div className="wf-intro-hdr">
        <ConnorLogo size={28} />
        <div className="wf-intro-title">ПЕРВЫЙ ЗАПУСК</div>
        <div className="wf-intro-sub">КОННОР ЗНАКОМИТСЯ С ПОЛЬЗОВАТЕЛЕМ</div>
      </div>
      <div className="wf-dialog">
        <div className="wf-dialog-text">
          {typed}<span className="wf-cursor" />
        </div>
      </div>
      <div className="wf-input-wrap">
        <div className="wf-input-label">КАК ВАС НАЗЫВАТЬ?</div>
        <input
          className="wf-input"
          type="text"
          placeholder="Введите имя или позывной..."
          maxLength={32}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
          autoFocus
        />
      </div>
      <div className="wf-row-btns">
        <button className="wf-btn-ghost" onClick={onBack}>← НАЗАД</button>
        <button
          className="wf-btn-primary"
          disabled={!name.trim()}
          onClick={() => onNext(name.trim())}
        >ДАЛЕЕ →</button>
      </div>
    </div>
  );
}

// ── Screen 3: Scan ────────────────────────────────────────────
function ScanScreen({ userName, onNext, onBack }: { userName: string; onNext: () => void; onBack: () => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState('ГОТОВ К СКАНИРОВАНИЮ');
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  const startScan = () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    SCAN_LOGS.forEach((line, i) => {
      setTimeout(() => {
        setLogs(prev => [...prev, line]);
        const p = Math.round((i + 1) / SCAN_LOGS.length * 100);
        setPct(p);
        setStatus(line.replace('> ', '').toUpperCase());
        if (i === SCAN_LOGS.length - 1) setDone(true);
      }, 400 + i * 650);
    });
  };

  return (
    <div className="wf-screen wf-narrow">
      <div className="wf-scan-hdr">
        <div className="wf-scan-title">ДИАГНОСТИКА</div>
        <div className="wf-intro-sub">КОННОР ИЗУЧАЕТ СИСТЕМУ · {userName.toUpperCase()}</div>
      </div>
      <div className="wf-terminal">
        <div className="wf-term-hd">
          <span className="wf-term-dot" /><span className="wf-term-dot" /><span className="wf-term-dot" />
          <span className="wf-term-title">SCANNER · PYTHON</span>
        </div>
        <div className="wf-term-body">
          {logs.length === 0
            ? <span style={{ color: 'rgba(0,180,216,0.3)' }}>Ожидание запуска...</span>
            : logs.map((l, i) => (
                <div key={i} className="wf-log-line" style={{ color: l.includes('ЗАВЕРШЕНО') ? '#06D6A0' : undefined }}>
                  {l}
                </div>
              ))
          }
        </div>
      </div>
      <div className="wf-prog-wrap">
        <div className="wf-prog-labels">
          <span>{status}</span><span>{pct}%</span>
        </div>
        <div className="wf-prog-track">
          <div className="wf-prog-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="wf-row-btns">
        <button className="wf-btn-ghost" onClick={onBack}>← НАЗАД</button>
        {done
          ? <button className="wf-btn-primary" onClick={onNext}>ДАЛЕЕ →</button>
          : <button className="wf-btn-primary" onClick={startScan} disabled={running}>
              {running ? 'СКАНИРОВАНИЕ...' : 'НАЧАТЬ СКАНИРОВАНИЕ'}
            </button>
        }
      </div>
    </div>
  );
}

// ── Screen 4: Ready ───────────────────────────────────────────
function ReadyScreen({ userName, onFinish }: { userName: string; onFinish: () => void }) {
  return (
    <div className="wf-screen">
      <div className="wf-ready-logo">
        <div className="wf-ring1" />
        <ConnorLogo size={52} animated />
      </div>
      <div className="wf-ready-title">СИСТЕМА ГОТОВА</div>
      <div className="wf-ready-name">{userName.toUpperCase()}</div>
      <div className="wf-ready-div" />
      <div className="wf-ready-text">
        Коннор инициализирован и готов к работе.<br />
        Скажите <strong>«Коннор»</strong> чтобы активировать ассистента.
      </div>
      <div className="wf-ready-stats">
        <div className="wf-stat"><div className="wf-stat-val">10</div><div className="wf-stat-lbl">КОМАНД</div></div>
        <div className="wf-stat"><div className="wf-stat-val">33</div><div className="wf-stat-lbl">АУДИО ФРАЗ</div></div>
        <div className="wf-stat"><div className="wf-stat-val">∞</div><div className="wf-stat-lbl">ВОЗМОЖНОСТЕЙ</div></div>
      </div>
      <button className="wf-btn-primary" style={{ marginTop: 8 }} onClick={onFinish}>
        ЗАПУСТИТЬ КОННОРА →
      </button>
    </div>
  );
}

// ── Main WelcomeFlow ──────────────────────────────────────────
export function WelcomeFlow({ onFinish }: WelcomeFlowProps) {
  const [screen, setScreen] = useState(0);
  const [userName, setUserName] = useState('Лейтенант');

  const screens = [
    <GreetScreen   key="greet"  onNext={() => setScreen(1)} onSkip={() => setScreen(3)} />,
    <IntroScreen   key="intro"  onNext={(n) => { setUserName(n); setScreen(2); }} onBack={() => setScreen(0)} />,
    <ScanScreen    key="scan"   userName={userName} onNext={() => setScreen(3)} onBack={() => setScreen(1)} />,
    <ReadyScreen   key="ready"  userName={userName} onFinish={() => onFinish(userName)} />,
  ];

  return (
    <div className="wf-root">
      <div className="grid-bg" />
      <div className="scanline" />
      <div className="corner corner-tl" /><div className="corner corner-tr" />
      <div className="corner corner-bl" /><div className="corner corner-br" />

      <div className="wf-step-dots">
        {[0,1,2,3].map(i => (
          <div key={i} className={`wf-dot${screen === i ? ' active' : ''}`} />
        ))}
      </div>
      {screen < 3 && (
        <button className="wf-skip" onClick={() => setScreen(3)}>ПРОПУСТИТЬ ↗</button>
      )}

      {screens[screen]}
    </div>
  );
}
