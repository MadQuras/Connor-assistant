# Connor RK800

Голосовой ассистент для Windows в духе **Detroit: Become Human** — андроид RK800 «Коннор» слушает wake-слово, выполняет команды, отвечает голосом и показывает HUD-оверлей поверх всех окон.

**Версия:** 1.3.0 · **Платформа:** Windows 10/11 · **Репозиторий:** [github.com/MadQuras/Connor-assistant](https://github.com/MadQuras/Connor-assistant)

---

## Возможности

| Категория | Примеры |
|-----------|---------|
| **Wake & голос** | «Коннор» → команда; Whisper STT, Silero VAD |
| **Приложения** | «Открой Chrome / Steam / Discord» |
| **Поиск** | «Найди рецепт борща» → Google |
| **Q&A** | «Когда анонс Метро 2039?» → короткий ответ голосом (Gemini + Google Search) |
| **Погода** | «Какая погода?» → Яндекс.Погода (Москва по умолчанию) |
| **Музыка** | Spotify / Яндекс.Музыка / Lune — play, pause, next |
| **Система** | Время, громкость, блокировка, заметки, активность за ПК |
| **Режим «отойди»** | «Коннор, отойди пока» → молчит; «Коннор, вернись» → снова слушает |
| **UI** | Tauri 2 + React — dashboard, настройки, 8 акцентных цветов + matching eye PNG |
| **TTS** | Camb.ai (опционально) — голос Коннора RK800 |
| **LLM** | Ollama + Gemma 4 (локально) или Gemini (облако) |

---

## Архитектура

```
Connor RK800.lnk
    └── Connor.vbs          ← тихий запуск (pythonw + tray exe)
            ├── python-core/main.py   ← голос, overlay PyQt5, маршрутизация
            └── connor-tray-v2.exe    ← Tauri UI (dashboard, settings, tray)
```

**Python-ядро:** VAD → Whisper → wake → `route_command` → handlers → TTS/overlay  
**Tauri:** настройки, заметки, boot/greeting, system tray  
**Связь:** `python-core/models/python_ready.flag` — Tauri ждёт готовности ядра

---

## Быстрая установка (новый ПК / ноутбук)

### Требования

- Windows 10 build 19041+ (рекомендуется)
- **Python 3.11** ([python.org](https://www.python.org/downloads/)) — галочка «Add to PATH»
- **Visual C++ Redistributable 2022** (нужен для torch)
- Интернет (~3–5 ГБ: torch, Whisper, Ollama-модель)
- Микрофон

### Шаг 1 — зависимости

```powershell
git clone https://github.com/MadQuras/Connor-assistant.git
cd Connor-assistant
PowerShell -ExecutionPolicy Bypass -File Install-Connor.ps1
```

Скрипт установит pip-пакеты, создаст `config.json`, запишет `python_path.txt`, предложит Ollama + Gemma.

### Шаг 2 — собрать UI (один раз)

```powershell
cd tauri-front
npm install
npm run tauri build
cd ..
```

### Шаг 3 — ярлык и запуск

```powershell
.\create_shortcut.bat
```

Или двойной клик **`Connor.vbs`**. Ярлык **Connor RK800** на рабочем столе.

### Шаг 4 — настройка (опционально)

Скопируй `config.example.json` → `config.json` (если ещё нет) и заполни:

| Ключ | Зачем |
|------|-------|
| `gemini_api_key` | Точные Q&A-ответы с Google Search |
| `use_camb_tts` + `camb_api_key` | Озвучка реплик Коннора |
| `weather_city` | Город для Яндекс.Погоды |
| `ollama_model` | Модель Ollama (по умолчанию `gemma4:e4b`) |

---

## Пути — переносимость

Все пути **относительные**, без привязки к пользователю или диску:

| Компонент | Как находит корень |
|-----------|-------------------|
| `Connor.vbs`, `*.bat` | Папка скрипта (`%~dp0`) |
| `Install-Connor.ps1` | `$PSScriptRoot` |
| Python `constants.py` | `__file__` → `python-core/` → repo root |
| Tauri `lib.rs` | Walk-up от exe + env `CONNOR_ROOT` |
| Python `pythonw` | `python_path.txt` → `%LOCALAPPDATA%\Programs\Python\` → PATH |

Проект можно скопировать на другой ПК — достаточно заново запустить `Install-Connor.ps1` и `npm run tauri build`.

**Не коммитить:** `config.json`, `python_path.txt` (содержат ключи/локальные пути).

---

## Полезные скрипты

| Файл | Назначение |
|------|------------|
| `Install-Connor.ps1` | Полная установка Python-зависимостей |
| `install_ollama.bat` | Ollama + `gemma4:e4b` |
| `create_shortcut.bat` | Ярлык Connor RK800 + sync иконок |
| `stop_connor.bat` | Завершить Connor и pythonw |
| `Connor.vbs` | Тихий запуск (production) |
| `scripts/gen_app_icons.py` | Генерация icon.ico из `source-rk800.raw.png` |
| `tauri-front/refresh_taskbar_icon.bat` | Пересборка exe + сброс кэша иконок |
| `installer/Connor-Setup.iss` | Inno Setup installer (Windows) |

---

## Голосовые команды (примеры)

```
Коннор                          → активация
Коннор, открой Steam            → приложение
Коннор, какая погода            → Яндекс.Погода Москва
Коннор, когда выйдет GTA 6      → короткий ответ / Google
Коннор, найди рецепт пиццы      → Google
Коннор, сколько времени         → часы на overlay
Коннор, отойди пока             → режим dismiss
Коннор, вернись                 → выход из dismiss
Коннор, поспи                   → обычный сон (будить «Коннор»)
```

Полный список — вкладка **Команды** в UI или `TUTORIAL_VAD`.

---

## Структура проекта

```
Connor-assistant/
├── config.example.json      ← шаблон настроек
├── Connor.vbs               ← launcher
├── Install-Connor.ps1
├── python-core/
│   ├── main.py              ← entry point
│   ├── core/                ← VAD, STT, overlay, pipeline
│   ├── openjarvis/          ← routing, handlers, LLM, Q&A
│   └── models/              ← audio WAV, cache, flags
├── tauri-front/             ← React + Tauri 2 UI
│   └── src-tauri/           ← Rust backend, icons
├── scripts/                 ← shortcuts, icons, ollama
└── installer/               ← Connor-Setup.iss
```

Подробный индекс файлов — `FILES.md`.

---

## Сборка installer (опционально)

1. Собери `connor-tray-v2.exe` (`npm run tauri build`)
2. Открой `installer/Connor-Setup.iss` в Inno Setup 6
3. Compile → `installer/Output/Connor-Setup.exe`

---

## Разработка

```powershell
# Python core отдельно
.\start_core.bat

# Tauri dev
cd tauri-front && npm run tauri dev

# Проверка Gemma
py python-core\scripts\verify_gemma.py
```

---

## Лицензия и автор

Проект Connor RK800 — fan-assistant, не аффилирован с Quantic Dream / CyberLife.

---

## Changelog

### v1.3.0
- Q&A: короткие голосовые ответы (Gemini grounding) + fallback в Google
- Режим «отойди пока» / «вернись»
- Погода → Яндекс.Погода; portable paths (`CONNOR_ROOT`, `python_path.txt`)
- TTS-sync: панель закрывается после озвучки
- UI: глаза меняют цвет вместе с акцентом (ConfigProvider)
- Иконки RK800: hybrid icon.ico, taskbar/window icons
- Spotify backend, activity tracker, courtesy commands

### v1.2.x
- Camb.ai TTS, glass UI redesign, weather overlay
