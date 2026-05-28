import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConfig } from '../../hooks/useConfig';

const TEST_COMMANDS = [
  'открой chrome',
  'который час',
  'какая погода',
  'включи музыку',
  'найди новости',
  'заблокируй экран',
];

// ─── Types ───────────────────────────────────────────────────
interface LogEntry { ts: string; type: string; text: string; }

const QUICK_COMMANDS = [
  { phrase: 'открой [приложение]', desc: 'запуск из кэша памяти',   audio: 'audio_03–05' },
  { phrase: 'включи музыку',       desc: 'запуск Yandex Music',      audio: 'audio_21–23' },
  { phrase: 'найди [запрос]',      desc: 'браузер + поиск',          audio: 'audio_14–16' },
  { phrase: 'какая погода',        desc: 'данные Weather API',        audio: 'audio_12–13' },
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

// ─── Live log terminal ────────────────────────────────────────
function LogTerminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const entries = await invoke<LogEntry[]>('read_logs');
      setLogs(entries);
    } catch { /* python core not started yet */ }
  }, []);

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 1500);
    return () => clearInterval(id);
  }, [fetchLogs]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="log-terminal">
      <div className="log-term-hd">
        <span className="log-term-dot" />
        <span className="log-term-dot" />
        <span className="log-term-dot" />
        <span className="log-term-title">CONNOR RUNTIME LOG</span>
      </div>
      <div className="log-body" ref={bodyRef}>
        {logs.length === 0 ? (
          <div className="log-empty">Запустите голосовое ядро чтобы увидеть логи...</div>
        ) : (
          logs.map((e, i) => (
            <div className="log-entry" key={i}>
              <span className="log-time">{e.ts}</span>
              <span className={`log-type ${e.type.toLowerCase()}`}>{e.type}</span>
              <span className="log-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────
export function Dashboard() {
  const { config, status, startCore } = useConfig();

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
            <div className="stat-label">МОДЕЛЬ</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {config.whisper_model?.toUpperCase() || 'TINY'}
            </div>
            <div className="stat-sub">faster-whisper STT</div>
            <div className="stat-corner">STT</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">МУЗЫКА</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {config.music_backend?.toUpperCase() || 'YANDEX'}
            </div>
            <div className="stat-sub">голосовое управление</div>
            <div className="stat-corner">MUSIC</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">КОМАНДЫ</div>
            <div className="stat-value">10</div>
            <div className="stat-sub">сценариев активно</div>
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

      {/* MIC WAVE — real amplitude */}
      <MicWave />

      {/* START CORE */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">УПРАВЛЕНИЕ ЯДРОМ</div>
          <div className="sec-line" />
        </div>
        <div className="cmd-item" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>Python Core · VoicePipeline</div>
            <div style={{ fontSize: 9, color: 'rgba(var(--cyan-rgb),0.3)', letterSpacing: 1 }}>
              {status || 'Готово к запуску'}
            </div>
          </div>
          <button
            type="button"
            className="save-btn"
            style={{ marginTop: 0, padding: '8px 22px', fontSize: 9 }}
            onClick={() => startCore()}
          >
            ▶ ЗАПУСТИТЬ ЯДРО
          </button>
        </div>
      </div>

      {/* LIVE LOG */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">RUNTIME ЛОГИ</div>
          <div className="sec-line" />
          <div className="sec-badge">LIVE · 1.5s</div>
        </div>
        <LogTerminal />
      </div>

      {/* TEST COMMANDS — debug bypass (no wake word needed) */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ТЕСТ КОМАНД</div>
          <div className="sec-line" />
          <div className="sec-badge">DEBUG · без wake word</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TEST_COMMANDS.map((cmd) => (
            <button
              type="button"
              key={cmd}
              className="save-btn"
              style={{
                margin: 0, fontSize: 9, padding: '7px 16px',
                background: 'transparent',
                border: '0.5px solid rgba(var(--cyan-rgb),0.3)',
              }}
              onClick={async () => {
                try {
                  await invoke('test_command', { cmd });
                } catch (e) { console.error(e); }
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(var(--cyan-rgb),0.3)', marginTop: 8, letterSpacing: 1 }}>
          Нажмите — команда пойдёт прямо в пайплайн. Результат появится в логах выше.
        </div>
      </div>

      {/* QUICK COMMANDS */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">БЫСТРЫЕ КОМАНДЫ</div>
          <div className="sec-line" />
        </div>
        <div className="cmd-list">
          {QUICK_COMMANDS.map((c) => (
            <div className="cmd-item" key={c.phrase}>
              <div className="cmd-phrase">{c.phrase}</div>
              <div className="cmd-sep">→</div>
              <div className="cmd-desc">{c.desc}</div>
              <div className="cmd-audio">{c.audio}</div>
              <div className="cmd-ind on" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
