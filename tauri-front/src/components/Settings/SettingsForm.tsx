import { useState, useEffect } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { applyAccentColor } from '../../lib/tauri';
import { ACCENT_COLORS } from '../../lib/eyeAccent';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <div className={`tog${on ? ' on' : ''}`} onClick={onToggle} />;
}

function Slider({
  min, max, value, unit, onChange,
}: { min: number; max: number; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="sl-wrap">
      <input
        type="range" className="sl"
        min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="sl-val">{value}{unit}</div>
    </div>
  );
}

export function SettingsForm() {
  const { config, setConfig, status, save } = useConfig();
  const [saving, setSaving] = useState(false);

  // Derive accent index from config.accent_color
  const accentIdx = ACCENT_COLORS.indexOf(config.accent_color || '#00B4D8');
  const accent = accentIdx >= 0 ? accentIdx : 0;

  // Sync CSS variable when config loads
  useEffect(() => {
    if (config.accent_color) applyAccentColor(config.accent_color);
  }, [config.accent_color]);

  const handleSave = async () => {
    setSaving(true);
    await save();
    setTimeout(() => setSaving(false), 2000);
  };

  return (
    <>
      {/* ВНЕШНИЙ ВИД */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">ВНЕШНИЙ ВИД</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Акцентный цвет</div>
            <div className="s-desc">Цвет волны, интерфейса и подсветки оверлея</div>
          </div>
          <div className="colors-row">
            {ACCENT_COLORS.map((hex, i) => (
              <div
                key={hex}
                className={`c-chip${accent === i ? ' sel' : ''}`}
                style={{ background: hex }}
                onClick={() => {
                  setConfig({ ...config, accent_color: hex });
                  applyAccentColor(hex); // live preview
                }}
              />
            ))}
          </div>
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Прозрачность overlay</div>
            <div className="s-desc">Прозрачность левой панели ассистента</div>
          </div>
          <Slider
            min={30} max={100}
            value={(config as any).overlay_opacity ?? 75}
            unit="%"
            onChange={(v) => setConfig({ ...config, overlay_opacity: v } as any)}
          />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Скорость печатной машинки</div>
            <div className="s-desc">Задержка появления текста в оверлее (мс/символ)</div>
          </div>
          <Slider
            min={10} max={80}
            value={(config as any).typewriter_speed ?? 30}
            unit="мс"
            onChange={(v) => setConfig({ ...config, typewriter_speed: v } as any)}
          />
        </div>
      </div>

      {/* ГОЛОС И STT */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">ГОЛОС И STT</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Модель Whisper</div>
            <div className="s-desc">Точность vs скорость распознавания речи</div>
          </div>
          <select
            className="s-sel"
            value={config.whisper_model || 'tiny'}
            onChange={(e) => setConfig({ ...config, whisper_model: e.target.value })}
          >
            <option value="tiny">tiny · быстро</option>
            <option value="base">base · баланс</option>
            <option value="small">small · точнее</option>
          </select>
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Таймаут команды</div>
            <div className="s-desc">Секунды ожидания после активации «Коннор»</div>
          </div>
          <Slider
            min={5} max={30}
            value={config.command_timeout_sec ?? 15}
            unit="с"
            onChange={(v) => setConfig({ ...config, command_timeout_sec: v })}
          />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">LLM бэкенд</div>
            <div className="s-desc">Локальная Gemma через Ollama или облачный Gemini</div>
          </div>
          <select
            className="s-sel"
            value={config.llm_backend || 'ollama'}
            onChange={(e) => setConfig({ ...config, llm_backend: e.target.value })}
          >
            <option value="ollama">Ollama (локально)</option>
            <option value="gemini">Gemini (облако)</option>
          </select>
        </div>
        {(config.llm_backend || 'ollama') === 'ollama' ? (
          <>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Ollama модель</div>
                <div className="s-desc">Имя модели, как в ollama run</div>
              </div>
              <input
                type="text"
                className="s-input"
                placeholder="gemma4:e4b"
                value={config.ollama_model || 'gemma4:e4b'}
                onChange={(e) => setConfig({ ...config, ollama_model: e.target.value })}
                style={{ minWidth: 160 }}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Ollama URL</div>
                <div className="s-desc">Адрес сервера Ollama</div>
              </div>
              <input
                type="text"
                className="s-input"
                placeholder="http://127.0.0.1:11434"
                value={config.ollama_url || 'http://127.0.0.1:11434'}
                onChange={(e) => setConfig({ ...config, ollama_url: e.target.value })}
                style={{ minWidth: 220 }}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Function calling (tools)</div>
                <div className="s-desc">Gemma 4 выбирает действие Коннора по JSON tools</div>
              </div>
              <Toggle
                on={config.use_ollama_tools !== false}
                onToggle={() => setConfig({ ...config, use_ollama_tools: config.use_ollama_tools === false })}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Реплики Коннора (Gemma)</div>
                <div className="s-desc">Gemma генерирует текст в панели после каждой команды</div>
              </div>
              <Toggle
                on={config.use_ollama_responses !== false}
                onToggle={() => setConfig({ ...config, use_ollama_responses: config.use_ollama_responses === false })}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Бытовой диалог (Gemma)</div>
                <div className="s-desc">Привет, как дела, шутки — разговор без команд</div>
              </div>
              <Toggle
                on={config.use_ollama_chat !== false}
                onToggle={() => setConfig({ ...config, use_ollama_chat: config.use_ollama_chat === false })}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Wake word через Gemma</div>
                <div className="s-desc">LLM для неоднозначного «Коннор» (если локальный матч не сработал)</div>
              </div>
              <Toggle
                on={config.use_ollama_wake !== false}
                onToggle={() => setConfig({ ...config, use_ollama_wake: config.use_ollama_wake === false })}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Thinking (размышления)</div>
                <div className="s-desc">Показывать блок Thinking… в Ollama (медленнее)</div>
              </div>
              <Toggle
                on={!!config.ollama_think}
                onToggle={() => setConfig({ ...config, ollama_think: !config.ollama_think })}
              />
            </div>
          </>
        ) : (
          <div className="s-row">
            <div className="s-left">
              <div className="s-title">Gemini API Key</div>
              <div className="s-desc">Google AI Studio → получить ключ</div>
            </div>
            <input
              type="password"
              className="s-input"
              placeholder="AIza..."
              value={config.gemini_api_key || ''}
              onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
            />
          </div>
        )}
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Обращение к пользователю</div>
            <div className="s-desc">Как Коннор будет обращаться к вам</div>
          </div>
          <input
            type="text"
            className="s-input"
            placeholder="Лейтенант"
            value={config.user_name || ''}
            onChange={(e) => setConfig({ ...config, user_name: e.target.value })}
            style={{ minWidth: 160 }}
          />
        </div>
      </div>

      {/* TTS — Camb.ai */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">ГОЛОС КОННОРА (TTS)</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Camb.ai TTS</div>
            <div className="s-desc">Озвучка реплик Gemma (текст → голос Коннора)</div>
          </div>
          <Toggle
            on={!!config.use_camb_tts}
            onToggle={() => setConfig({ ...config, use_camb_tts: !config.use_camb_tts })}
          />
        </div>
        {config.use_camb_tts && (
          <>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Camb API Key</div>
                <div className="s-desc">studio.camb.ai → API Keys</div>
              </div>
              <input
                type="password"
                className="s-input"
                placeholder="camb_..."
                value={config.camb_api_key || ''}
                onChange={(e) => setConfig({ ...config, camb_api_key: e.target.value })}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Voice ID</div>
                <div className="s-desc">
                  Клон Коннора (182207) — из connor_voice.wav. Пересоздать: setup_connor_camb_voice.py
                </div>
              </div>
              <input
                type="number"
                className="s-input"
                placeholder="182207"
                value={config.camb_voice_id ?? 182207}
                onChange={(e) => setConfig({ ...config, camb_voice_id: Number(e.target.value) })}
                style={{ minWidth: 120 }}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Язык</div>
                <div className="s-desc">BCP-47, для русского — ru-ru</div>
              </div>
              <input
                type="text"
                className="s-input"
                placeholder="ru-ru"
                value={config.camb_language || 'ru-ru'}
                onChange={(e) => setConfig({ ...config, camb_language: e.target.value })}
                style={{ minWidth: 100 }}
              />
            </div>
            <div className="s-row">
              <div className="s-left">
                <div className="s-title">Модель речи</div>
                <div className="s-desc">flash — быстро; pro — чуть лучше качество, медленнее</div>
              </div>
              <select
                className="s-sel"
                value={config.camb_speech_model || 'mars-8.1-flash-beta'}
                onChange={(e) => setConfig({ ...config, camb_speech_model: e.target.value })}
              >
                <option value="mars-8.1-flash-beta">mars-8.1-flash-beta</option>
                <option value="mars-8.1-pro-beta">mars-8.1-pro-beta</option>
                <option value="mars-flash">mars-flash</option>
                <option value="mars-pro">mars-pro</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* МУЗЫКА */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">МУЗЫКА</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Музыкальный бэкенд</div>
            <div className="s-desc">
              Lune — пауза и поиск; след./пред. трек — только Яндекс Музыка
            </div>
          </div>
          <select
            className="s-sel"
            value={config.music_backend || 'yandex'}
            onChange={(e) => setConfig({ ...config, music_backend: e.target.value })}
          >
            <option value="yandex">Яндекс Музыка (все команды)</option>
            <option value="lune">Lune (пауза, поиск)</option>
          </select>
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">URL Яндекс Музыки</div>
            <div className="s-desc">Стартовый адрес в браузере</div>
          </div>
          <input
            type="text"
            className="s-input"
            value={config.yandex_music_url || 'https://music.yandex.ru'}
            onChange={(e) => setConfig({ ...config, yandex_music_url: e.target.value })}
            style={{ minWidth: 220 }}
          />
        </div>
      </div>

      {/* СИСТЕМА */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">СИСТЕМА</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Рабочая папка</div>
            <div className="s-desc">Папка «рабочая папка» / «проекты»</div>
          </div>
          <input
            type="text"
            className="s-input"
            placeholder="C:\Users\...\Projects"
            value={config.working_folder_path || ''}
            onChange={(e) => setConfig({ ...config, working_folder_path: e.target.value })}
          />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Разрешить выключение ПК</div>
            <div className="s-desc">Голосовая команда «Коннор, выключи ПК»</div>
          </div>
          <Toggle on={!!config.allow_shutdown} onToggle={() => setConfig({ ...config, allow_shutdown: !config.allow_shutdown })} />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Автоподтверждение опасных команд</div>
            <div className="s-desc">Без диалога подтверждения (небезопасно)</div>
          </div>
          <Toggle
            on={!!config.auto_confirm_dangerous_commands}
            onToggle={() => setConfig({ ...config, auto_confirm_dangerous_commands: !config.auto_confirm_dangerous_commands })}
          />
        </div>
      </div>

      {/* INFO */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">ИНФОРМАЦИЯ</div>
          <div className="sec-line" />
        </div>
        <div className="info-grid">
          <div className="info-r"><div className="info-k">МОДЕЛЬ</div><div className="info-v">КОННОР RK800</div></div>
          <div className="info-r"><div className="info-k">ВЕРСИЯ</div><div className="info-v">1.2.1</div></div>
          <div className="info-r"><div className="info-k">РАСПОЗНАВАНИЕ РЕЧИ</div><div className="info-v">FASTER-WHISPER</div></div>
          <div className="info-r"><div className="info-k">МАРШРУТИЗАТОР</div><div className="info-v">{(config.llm_backend || 'ollama') === 'ollama' ? 'OLLAMA TOOLS + LOCAL' : 'GEMINI + LOCAL'}</div></div>
          <div className="info-r"><div className="info-k">TTS</div><div className="info-v">{config.use_camb_tts ? 'CAMB.AI' : 'WAV CLIPS'}</div></div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          className="save-btn"
          onClick={handleSave}
          style={{ background: saving ? '#06D6A0' : undefined }}
        >
          {saving ? 'СОХРАНЕНО ✓' : 'СОХРАНИТЬ НАСТРОЙКИ'}
        </button>
        {status && <div className="status-toast">{status}</div>}
      </div>
    </>
  );
}
