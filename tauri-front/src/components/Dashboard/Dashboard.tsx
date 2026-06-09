import { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { WeatherCard } from './WeatherCard';
import { ActivityPanel } from './ActivityPanel';

const QUICK_COMMANDS = [
  { phrase: 'Коннор, открой [приложение]', desc: 'Запуск приложения' },
  { phrase: 'Коннор, включи музыку', desc: 'Музыкальный плеер' },
  { phrase: 'Коннор, какая погода', desc: 'Визуальная карточка погоды' },
  { phrase: 'Коннор, сколько времени', desc: 'Часы в overlay' },
  { phrase: 'Коннор, громче / тише', desc: 'Громкость системы' },
  { phrase: 'Коннор, запомни [текст]', desc: 'Заметка в память' },
];

export function Dashboard() {
  const { config, status, startCore } = useConfig();
  const [coreStarted, setCoreStarted] = useState(false);

  const handleStart = () => {
    startCore();
    setCoreStarted(true);
  };

  return (
    <>
      <div className="dash-hero">
        <WeatherCard city="Москва" />
        <ActivityPanel />
      </div>

      <div>
        <div className="sec-hd">
          <div className="sec-title">СТАТУС ЯДРА</div>
          <div className="sec-line" />
        </div>
        <div className="stat-grid stat-grid-3">
          <div className="stat-card glass-stat">
            <div className="stat-label">STT</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {(config.whisper_model || 'base').toUpperCase()}
            </div>
            <div className="stat-sub">faster-whisper</div>
          </div>
          <div className="stat-card glass-stat">
            <div className="stat-label">LLM</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {(config.ollama_model || 'gemma4:e4b').split(':')[0].toUpperCase()}
            </div>
            <div className="stat-sub">{config.llm_backend || 'ollama'}</div>
          </div>
          <div className="stat-card glass-stat">
            <div className="stat-label">TTS</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {config.use_camb_tts ? 'CAMB' : 'WAV'}
            </div>
            <div className="stat-sub">{config.camb_voice_name || 'Connor clone'}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="sec-hd">
          <div className="sec-title">ГОЛОСОВОЕ ЯДРО</div>
          <div className="sec-line" />
        </div>
        <div className="cmd-item glass-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, letterSpacing: 1 }}>
              Python · VoicePipeline
            </div>
            <div style={{ fontSize: 10, color: 'rgba(var(--cyan-rgb),0.45)', letterSpacing: 1 }}>
              {coreStarted ? (status || 'Запускается...') : 'Скажите «Коннор» после запуска'}
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
            {coreStarted ? '● ЯДРО АКТИВНО' : '▶ ЗАПУСТИТЬ'}
          </button>
        </div>
      </div>

      <div>
        <div className="sec-hd">
          <div className="sec-title">КОМАНДЫ</div>
          <div className="sec-line" />
          <div className="sec-badge">{QUICK_COMMANDS.length}</div>
        </div>
        <div className="cmd-list cmd-list-compact">
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
