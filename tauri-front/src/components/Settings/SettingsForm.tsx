import { useState, useEffect } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { applyAccentColor } from '../../lib/tauri';

const ACCENT_COLORS = [
  '#00B4D8', '#3A86FF', '#06D6A0',
  '#FF4D6D', '#9B5DE5', '#FFD60A', '#FB5607', '#FF79C6',
];

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

      {/* МУЗЫКА */}
      <div className="s-section">
        <div className="sec-hd">
          <div className="sec-title">МУЗЫКА</div>
          <div className="sec-line" />
        </div>
        <div className="s-row">
          <div className="s-left">
            <div className="s-title">Музыкальный бэкенд</div>
            <div className="s-desc">Плеер для голосового управления музыкой</div>
          </div>
          <select
            className="s-sel"
            value={config.music_backend || 'yandex'}
            onChange={(e) => setConfig({ ...config, music_backend: e.target.value })}
          >
            <option value="yandex">Yandex Music</option>
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
          <div className="info-r"><div className="info-k">ВЕРСИЯ</div><div className="info-v">1.0.0 BUILD 001</div></div>
          <div className="info-r"><div className="info-k">STT ДВИЖОК</div><div className="info-v">FASTER-WHISPER</div></div>
          <div className="info-r"><div className="info-k">OCR ДВИЖОК</div><div className="info-v">TESSERACT 5.x</div></div>
          <div className="info-r"><div className="info-k">МАРШРУТИЗАТОР</div><div className="info-v">GEMINI + FALLBACK</div></div>
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
