import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../../hooks/useConfig';

const QUICK_COMMANDS = [
  { phrase: 'Коннор, открой [приложение]', desc: 'Запуск приложения по имени' },
  { phrase: 'Коннор, включи музыку',       desc: 'Открыть музыкальный плеер' },
  { phrase: 'Коннор, найди [запрос]',      desc: 'Поиск в браузере' },
  { phrase: 'Коннор, какая погода',        desc: 'Текущие погодные данные' },
  { phrase: 'Коннор, сколько времени',     desc: 'Системное время' },
  { phrase: 'Коннор, громче / тише',       desc: 'Управление громкостью' },
  { phrase: 'Коннор, заблокируй',         desc: 'Блокировка рабочей станции' },
  { phrase: 'Коннор, запомни [текст]',    desc: 'Добавить заметку' },
];

// ─── Mic-reactive wave visualiser ────────────────────────────
function MicWave() {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef      = useRef<HTMLDivElement[]>([]);
  const rafRef       = useRef<number>(0);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRef      = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'active' | 'denied'>('idle');

  const BAR_COUNT = 52;

  // Build bar elements once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    barsRef.current = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const b = document.createElement('div');
      b.className = 'wb';
      b.style.animationDelay = `${i * 0.055}s`;
      b.style.animationDuration = `${1.0 + Math.random() * 0.9}s`;
      el.appendChild(b);
      barsRef.current.push(b);
    }
  }, []);

  // Start mic capture
  useEffect(() => {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null  = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        ctx = new AudioContext();
        const source   = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;            // 64 frequency bins
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
        setStatus('active');

        const draw = () => {
          if (!analyserRef.current || !dataRef.current) return;
          analyserRef.current.getByteFrequencyData(dataRef.current);
          const bars = barsRef.current;
          const data = dataRef.current;
          const step = Math.floor(data.length / bars.length) || 1;

          bars.forEach((bar, i) => {
            // Average a small neighbourhood of frequency bins
            let sum = 0;
            for (let k = 0; k < step; k++) sum += data[i * step + k] || 0;
            const amplitude = sum / step / 255; // 0 … 1
            const pxHeight  = Math.max(3, amplitude * 52);
            const opacity   = 0.15 + amplitude * 0.85;
            // Override the CSS animation with live values
            bar.style.height = `${pxHeight}px`;
            bar.style.opacity = String(opacity);
            bar.style.animation = 'none';
          });
          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      } catch {
        setStatus('denied');
      }
    };

    init();
    return () => {
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach(t => t.stop());
      ctx?.close();
    };
  }, []);

  const micLabel = status === 'denied'
    ? 'МИК НЕДОСТУПЕН'
    : status === 'active'
      ? 'АУДИО ПОТОК'
      : 'ИНИЦИАЛИЗАЦИЯ...';

  return (
    <div className="wave-card">
      <div className="wave-hd">
        <div className="wave-status">
          <div className="wave-dot" style={status !== 'active' ? { opacity: 0.3 } : {}} />
          {micLabel}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(var(--cyan-rgb),0.3)', letterSpacing: 1 }}>
          faster-whisper · Web Audio API
        </div>
      </div>
      <div className="wave-canvas" ref={containerRef} />
    </div>
  );
}


// ─── Dashboard page ───────────────────────────────────────────
export function Dashboard() {
  const { config, status, startCore } = useConfig();
  const [coreStarted, setCoreStarted] = useState(false);

  const handleStart = () => {
    startCore();
    setCoreStarted(true);
  };

  return (
    <>
      {/* STAT CARDS */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">СТАТУС СИСТЕМЫ</div>
          <div className="sec-line" />
          <div className="sec-badge">LIVE</div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">РАСПОЗНАВАНИЕ</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {(config.whisper_model || 'base').toUpperCase()}
            </div>
            <div className="stat-sub">faster-whisper · русский</div>
            <div className="stat-corner">STT</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">МУЗЫКА</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {config.music_backend === 'lune' ? 'LUNE' : 'ЯНДЕКС'}
            </div>
            <div className="stat-sub">голосовые команды</div>
            <div className="stat-corner">MUSIC</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">КОМАНДЫ</div>
            <div className="stat-value">15+</div>
            <div className="stat-sub">голосовых сценариев</div>
            <div className="stat-corner">EXEC</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">ПОЛЬЗОВАТЕЛЬ</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {config.user_name?.split(' ')[0].toUpperCase() || 'LT'}
            </div>
            <div className="stat-sub">{config.user_name || 'Лейтенант'}</div>
            <div className="stat-corner">USER</div>
          </div>
        </div>
      </div>

      {/* MIC WAVE */}
      <MicWave />

      {/* START CORE */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ГОЛОСОВОЕ ЯДРО</div>
          <div className="sec-line" />
        </div>
        <div className="cmd-item" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, letterSpacing: 1 }}>
              Python · VoicePipeline
            </div>
            <div style={{ fontSize: 10, color: 'rgba(var(--cyan-rgb),0.45)', letterSpacing: 1 }}>
              {coreStarted ? (status || 'Запускается...') : 'Готово к запуску · скажите «Коннор»'}
            </div>
          </div>
          <button
            type="button"
            className="save-btn"
            style={{
              marginTop: 0,
              padding: '9px 26px',
              fontSize: 10,
              background: coreStarted ? 'rgba(6,214,160,0.15)' : undefined,
              borderColor: coreStarted ? '#06D6A0' : undefined,
              color: coreStarted ? '#06D6A0' : undefined,
            }}
            onClick={handleStart}
            disabled={coreStarted}
          >
            {coreStarted ? '● ЯДРО АКТИВНО' : '▶ ЗАПУСТИТЬ ЯДРО'}
          </button>
        </div>
      </div>

      {/* QUICK COMMANDS */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ГОЛОСОВЫЕ КОМАНДЫ</div>
          <div className="sec-line" />
          <div className="sec-badge">{QUICK_COMMANDS.length} КОМАНД</div>
        </div>
        <div className="cmd-list">
          {QUICK_COMMANDS.map((c) => (
            <div className="cmd-item" key={c.phrase}>
              <div className="cmd-phrase">{c.phrase}</div>
              <div className="cmd-sep">→</div>
              <div className="cmd-desc">{c.desc}</div>
              <div className="cmd-ind on" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
