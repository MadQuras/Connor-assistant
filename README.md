# Connor RK800

Голосовой ассистент для Windows в духе **Detroit: Become Human** — андроид RK800 «Коннор» слушает wake-слово, выполняет команды, отвечает голосом и показывает HUD-оверлей поверх всех окон.

| | |
|---|---|
| **Версия** | 1.3.0 |
| **Платформа** | Windows 10 build 17763+ (рекомендуется 19041+) |
| **Язык интерфейса** | Русский (голосовые команды — RU/EN) |
| **Репозиторий** | [github.com/MadQuras/Connor-assistant](https://github.com/MadQuras/Connor-assistant) |
| **Скачать** | [Releases](https://github.com/MadQuras/Connor-assistant/releases) → **Connor-Setup.exe** |

---

## Содержание

1. [Что умеет Connor](#что-умеет-connor)
2. [Установка через Setup.exe (рекомендуется)](#установка-через-setupexe-рекомендуется)
3. [Установка для разработчиков (git clone)](#установка-для-разработчиков-git-clone)
4. [Первый запуск и настройка](#первый-запуск-и-настройка)
5. [Архитектура](#архитектура)
6. [Голосовой пайплайн](#голосовой-пайплайн)
7. [Состояния ассистента](#состояния-ассистента)
8. [Маршрутизация команд](#маршрутизация-команд)
9. [Полный список голосовых команд](#полный-список-голосовых-команд)
10. [config.json — все параметры](#configjson--все-параметры)
11. [LLM: Ollama и Gemini](#llm-ollama-и-gemini)
12. [Q&A — короткие ответы голосом](#qa--короткие-ответы-голосом)
13. [TTS — озвучка реплик](#tts--озвучка-реплик)
14. [Музыка: Spotify / Яндекс / Lune](#музыка-spotify--яндекс--lune)
15. [Overlay (PyQt5 HUD)](#overlay-pyqt5-hud)
16. [Tauri UI (dashboard, настройки, tray)](#tauri-ui-dashboard-настройки-tray)
17. [Пути и переносимость](#пути-и-переносимость)
18. [Структура проекта](#структура-проекта)
19. [Скрипты и утилиты](#скрипты-и-утилиты)
20. [Сборка Setup.exe и Tauri из исходников](#сборка-setupexe-и-tauri-из-исходников)
21. [Иконки RK800](#иконки-rk800)
22. [Аудио-реплики (WAV)](#аудио-реплики-wav)
23. [Устранение неполадок](#устранение-неполадок)
24. [История релизов](#история-релизов)
25. [Лицензия](#лицензия)

---

## Что умеет Connor

| Категория | Возможности |
|-----------|-------------|
| **Wake & STT** | Wake-слово «Коннор»; Silero VAD; faster-whisper (RU/EN) |
| **Приложения** | Запуск из кэша, Start Menu, `%LOCALAPPDATA%\Programs`; алиасы игр (Дота 2, CS, GTA, Valorant…) |
| **Поиск** | «Найди …» → Google в браузере |
| **Q&A** | Фактические вопросы → короткий ответ голосом (Gemini + Google Search); при нехватке данных → Google |
| **Погода** | «Какая погода?» → Яндекс.Погода (город в `weather_city`) |
| **Музыка** | Spotify / Яндекс.Музыка / Lune — play, pause, next, prev, поиск трека |
| **Система** | Время, громкость, блокировка, выключение (с подтверждением), очистка корзины |
| **Заметки** | «Запомни …», «О чём я просил» — SQLite + memory.json |
| **Активность** | Учёт времени за ПК (focus time) |
| **Courtesy** | «Привет», «Спасибо», «Пока» — бытовые реплики |
| **Dismiss** | «Отойди пока» → молчит; «Коннор, вернись» → снова слушает |
| **Сон** | «Поспи» / «Спи» → обычный сон; будить снова «Коннор» |
| **UI** | Tauri 2 + React — dashboard, команды, заметки, настройки, 8 акцентных цветов |
| **Overlay** | Волна микрофона, текст ответа, статус-бар, boot splash, welcome |
| **Tray** | Иконка RK800 в системном трее; управление из окна настроек |

---

## Установка через Setup.exe (рекомендуется)

> **Для обычного пользователя** — скачайте готовый установщик, не клонируйте репозиторий.

### Шаг 1 — скачать

1. Откройте [Releases](https://github.com/MadQuras/Connor-assistant/releases)
2. Выберите **последнюю версию** (сейчас **v1.3.0**)
3. Скачайте **`Connor-Setup.exe`**

Старые версии с установщиком: **v1.0.0**, **v1.1.0**, **v1.2.0** — у каждой есть свой `Connor-Setup.exe`.

### Шаг 2 — запустить установщик

`Connor-Setup.exe` — полноценный Inno Setup installer. Он:

1. **Определяет** уже установленные компоненты (Python 3.11, VC++ Redist, Tesseract, Rust)
2. **Скачивает** недостающее с официальных сайтов:
   - Python 3.11.9 (~25 МБ)
   - Visual C++ Redistributable 2022 (~25 МБ)
   - Tesseract OCR 5.4 (опционально, для OCR)
   - Rust rustup (опционально, только для пересборки Tauri)
3. **Копирует** Connor в `%LOCALAPPDATA%\Programs\Connor RK800` (или выбранную папку):
   - Python-ядро (`python-core/`)
   - Собранный `connor-tray-v2.exe` (Tauri UI)
   - Лаунчеры, скрипты, WAV-реплики, иконки
4. **Создаёт** `config.json` из шаблона и `python_path.txt`
5. **Запускает** `pip install -r requirements.txt` (5–15 мин, ~2–3 ГБ: torch, whisper и др.)

### Шаг 3 — после установки (галочки на финальном экране)

| Действие | Зачем |
|----------|-------|
| **Создать ярлык** | `create_shortcut.bat` → **Connor RK800** на рабочем столе |
| **Установить Ollama** | `install_ollama.bat` → локальный LLM Gemma (~2 ГБ) |
| **Открыть config.json** | API-ключи и настройки |

### Шаг 4 — первый запуск

Двойной клик **Connor RK800** (или `Connor.vbs`). При первом запуске:

- Загрузка моделей Whisper (скачиваются автоматически)
- Boot-экран в Tauri UI
- Приветствие голосом (если есть WAV в `models/audio/startup/`)

### Системные требования

| Компонент | Минимум |
|-----------|---------|
| ОС | Windows 10 1809+ |
| RAM | 8 ГБ (16 ГБ для torch + Ollama одновременно) |
| Диск | ~5 ГБ (Python-пакеты + Whisper + опционально Ollama) |
| Микрофон | Любой (рекомендуется без сильного эха) |
| Интернет | Нужен при установке и для Q&A/Gemini |

---

## Установка для разработчиков (git clone)

Если вы **разрабатываете** или хотите собрать UI с нуля:

```powershell
git clone https://github.com/MadQuras/Connor-assistant.git
cd Connor-assistant
PowerShell -ExecutionPolicy Bypass -File Install-Connor.ps1
```

`Install-Connor.ps1` делает то же, что post-install Setup, но без Inno:

- Проверяет Python 3.11, VC++ Redist
- `pip install -r python-core/requirements.txt`
- Создаёт `config.json`, `python_path.txt`
- Предлагает Ollama + Gemma

Затем **соберите Tauri UI** (один раз):

```powershell
cd tauri-front
npm install
npm run tauri build
cd ..
.\create_shortcut.bat
```

Запуск: `Connor.vbs` или ярлык **Connor RK800**.

---

## Первый запуск и настройка

### Обязательно

1. **Микрофон** — разрешите доступ Windows
2. **Python-пакеты** — дождитесь окончания pip (при Setup — окно «Установка Python-пакетов»)

### Рекомендуется

| Настройка | Как |
|-----------|-----|
| **Ollama + Gemma** | `install_ollama.bat` или галочка в Setup |
| **Gemini API** | [aistudio.google.com](https://aistudio.google.com) → ключ в `gemini_api_key` |
| **Camb.ai TTS** | Ключ в `camb_api_key`, `use_camb_tts: true` — голос RK800 |
| **Город погоды** | `weather_city`: `"Москва"` |
| **Имя пользователя** | `user_name`: `"Лейтенант"` — обращение в репликах |

### Проверка компонентов

```powershell
# Ollama + Gemma
py python-core\scripts\verify_gemma.py

# Camb TTS (если включён)
py python-core\scripts\verify_camb_tts.py
```

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│  Connor RK800.lnk  →  Connor.vbs  (тихий запуск, без консоли)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│  pythonw main.py    │               │  connor-tray-v2.exe │
│  (Python-ядро)      │◄── flag ─────►│  (Tauri 2 + React)  │
│                     │  python_ready │                     │
│  VAD → STT → route  │               │  Dashboard, Settings│
│  handlers → TTS     │               │  Notes, Tray icon   │
│  PyQt5 overlay      │               │  config.json R/W    │
└─────────────────────┘               └─────────────────────┘
         │                                       │
         ▼                                       ▼
  config.json                            config.json
  python_path.txt                        models/python_ready.flag
  models/audio/*.wav                     models/memory.json
  models/notes.db
```

**Связь процессов:** Tauri читает `python-core/models/python_ready.flag` — пока ядро загружает Whisper/VAD, UI показывает boot-экран.

**Корень проекта:** определяется автоматически (см. [Пути и переносимость](#пути-и-переносимость)).

---

## Голосовой пайплайн

```
Микрофон
   │
   ▼
Silero VAD (vad.py)          — детекция речи, отсечение тишины
   │
   ▼
faster-whisper (stt_worker)  — транскрипция RU/EN, beam=3, anti-hallucination
   │
   ▼
Wake detector (wake_detector) — «Коннор» в тексте? Ollama/Gemini или regex
   │
   ▼
State machine              — SLEEPING → AWAKENED → PROCESSING → SLEEPING
   │
   ▼
route_command (route.py)   — fallback_router + опционально LLM tool routing
   │
   ▼
dispatch → handler         — apps, music, qa, weather, …
   │
   ▼
TTS (pygame WAV / Camb.ai) + overlay text_panel + status_bar
```

**Таймаут команды:** `command_timeout_sec` (по умолчанию 15 с) — если после wake нет команды, Connor засыпает.

**Параллельная STT-очередь:** VAD не блокируется на Whisper — новые фрагменты ставятся в очередь.

---

## Состояния ассистента

| Состояние | Описание |
|-----------|----------|
| `SLEEPING` | Ждёт wake-слово «Коннор» |
| `AWAKENED` | Услышал «Коннор», ждёт команду (таймер 15 с) |
| `LISTENING` | Идёт запись команды |
| `PROCESSING` | Выполняется handler |
| `DISMISSED` | «Отойди пока» — игнорирует всё кроме «Коннор, вернись» |

**Сон vs Dismiss:**

| Фраза | Эффект | Как вернуть |
|-------|--------|-------------|
| «Коннор, поспи» / «спи» | Обычный сон | Сказать «Коннор» |
| «Коннор, отойди пока» | Dismiss — полное молчание | «Коннор, вернись» |

---

## Маршрутизация команд

Порядок проверки в `fallback_router.py` (важен!):

1. **DISMISS** — «отойди пока»
2. **COURTESY** — привет, спасибо, пока, молодец
3. **ACTIVITY** — время за ПК
4. **APPS** (спец.) — корзина, загрузки, документы, рабочий стол
5. **WEATHER** — до QA, чтобы «какая погода» не ушла в Q&A
6. **QA** — фактические вопросы
7. **SEARCH** — «найди», «загугли»
8. **VOLUME** — громче/тише
9. **MUSIC** — до APPS (конфликт «включи»)
10. **SHUTDOWN** / **LOCK**
11. **APPS** — открой/запусти
12. **TIME** — время и дата
13. **PLANS** — заметки
14. **MUSIC** (остаточные ключевые слова)
15. **UNKNOWN** — fallback через LLM или «не понял»

Опционально: `use_gemini_route` / Ollama tools — LLM выбирает категорию вместо regex.

---

## Полный список голосовых команд

### Активация

| Команда | Действие |
|---------|----------|
| **Коннор** | Пробуждение, ожидание команды |
| **Коннор, спи** / **поспи** | Режим сна |
| **Коннор, отойди пока** | Dismiss — не отвечает |
| **Коннор, вернись** | Выход из dismiss |

### Приложения

| Команда | Действие |
|---------|----------|
| **Коннор, открой [имя]** | Chrome, Steam, Discord, Telegram, VS Code… |
| **Коннор, открой дота 2 / кс / гта / валорант** | Игры по русским алиасам |
| **Коннор, открой загрузки** | Папка Downloads |
| **Коннор, открой документы** | Папка Documents |
| **Коннор, открой рабочую папку** | Desktop |
| **Коннор, очисти корзину** | Очистка Recycle Bin |

Поиск exe: Start Menu, `%LOCALAPPDATA%\Programs`, кэш `memory.json`.

### Музыка

| Команда | Действие |
|---------|----------|
| **Коннор, включи музыку** | Открыть плеер (Spotify/Яндекс/Lune) |
| **Коннор, включи [трек]** | Поиск и воспроизведение |
| **Коннор, пауза** / **стоп** | Пауза |
| **Коннор, возобнови** / **продолжи** | Resume |
| **Коннор, следующий трек** | Next |
| **Коннор, предыдущий трек** | Previous |

Backend: `music_backend` в config — `spotify` | `yandex` | `lune`.

### Информация

| Команда | Действие |
|---------|----------|
| **Коннор, найди [запрос]** | Google в браузере |
| **Коннор, когда выйдет …** / **что такое …** | Q&A голосом или Google |
| **Коннор, подробно …** | Сразу Google (длинный ответ) |
| **Коннор, какая погода** | Яндекс.Погода |
| **Коннор, сколько времени** | Время + дата на overlay |
| **Коннор, запомни [текст]** | Заметка в SQLite |
| **Коннор, о чём я просил** | Список заметок |
| **Коннор, моя активность** | Время за ПК сегодня |

### Система

| Команда | Действие |
|---------|----------|
| **Коннор, громче** / **тише** | ± громкость Windows |
| **Коннор, заблокируй** | Lock workstation |
| **Коннор, выключи компьютер** | Shutdown (если `allow_shutdown: true`) |

### Courtesy

| Команда | Действие |
|---------|----------|
| **Коннор, привет** | Приветствие |
| **Коннор, спасибо** | Ответ благодарности |
| **Коннор, пока** | Прощание (не dismiss!) |
| **Коннор, молодец** | Похвала |

Полный список также на вкладке **Команды** в Tauri UI.

---

## config.json — все параметры

Файл создаётся из `config.example.json`. Редактируется в UI (**Настройки**) или вручную.

### Интерфейс и пользователь

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `accent_color` | string | `#00B4D8` | Акцент UI и цвет «глаз» RK800 (8 цветов) |
| `overlay_opacity` | int | `75` | Прозрачность overlay 0–100 |
| `user_name` | string | `Лейтенант` | Обращение в репликах |
| `first_launch` | bool | `true` | Первый запуск — welcome flow |
| `working_folder_path` | string | `""` | Рабочая папка (опционально) |

### LLM — Ollama (локально)

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `llm_backend` | string | `ollama` | `ollama` или `gemini` |
| `ollama_url` | string | `http://127.0.0.1:11434` | URL Ollama API |
| `ollama_model` | string | `gemma4:e4b` | Модель (Gemma 4) |
| `ollama_think` | bool | `false` | Режим «thinking» модели |
| `ollama_timeout_sec` | int | `60` | Таймаут запроса |
| `use_ollama_tools` | bool | `true` | Tool calling для маршрутизации |
| `use_ollama_wake` | bool | `true` | Wake detection через Ollama |
| `use_ollama_responses` | bool | `true` | Генерация ответов |
| `use_ollama_chat` | bool | `true` | Chat-режим |

### LLM — Gemini (облако)

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `gemini_api_key` | string | — | API-ключ Google AI Studio |
| `use_gemini_route` | bool | `false` | Маршрутизация через Gemini |
| `use_gemini_wake` | bool | `false` | Wake через Gemini |

### Q&A

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `use_qa` | bool | `true` | Включить Q&A handler |
| `qa_use_gemini_grounding` | bool | `true` | Gemini + Google Search |
| `qa_max_words` | int | `25` | Макс. слов в голосовом ответе |
| `qa_timeout_sec` | int | `15` | Таймаут Q&A |

### TTS

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `tts_backend` | string | `camb` | `camb` или `wav` (локальные WAV) |
| `use_camb_tts` | bool | `false` | Camb.ai синтез речи |
| `camb_api_key` | string | — | API Camb.ai |
| `camb_voice_id` | int | `182207` | ID голоса Connor RK800 |
| `camb_voice_name` | string | `Connor RK800` | Имя голоса |
| `camb_language` | string | `ru-ru` | Язык |
| `camb_speech_model` | string | `mars-8.1-flash-beta` | Модель речи |
| `camb_sample_rate` | int | `44100` | Sample rate |
| `camb_timeout_sec` | int | `60` | Таймаут TTS |

### Overlay / TTS sync

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `connor_panel_hide_ms` | int | `7000` | Автоскрытие панели без TTS |
| `connor_tts_post_hide_ms` | int | `600` | Задержка после конца озвучки |
| `connor_tts_sync_timeout_sec` | int | `10` | Safety timeout панели |

### Музыка и погода

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `music_backend` | string | `spotify` | `spotify` / `yandex` / `lune` |
| `yandex_music_url` | string | `https://music.yandex.ru` | URL Яндекс.Музыки |
| `weather_city` | string | `Москва` | Город для Яндекс.Погоды |

### STT и безопасность

| Ключ | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `whisper_model` | string | `base` | `tiny` / `base` / `small` / `medium` |
| `command_timeout_sec` | int | `15` | Таймаут после wake |
| `allow_shutdown` | bool | `false` | Разрешить выключение ПК |
| `auto_confirm_dangerous_commands` | bool | `false` | Авто-подтверждение опасных команд |

**Не коммитить в git:** `config.json`, `python_path.txt` (ключи и локальные пути).

---

## LLM: Ollama и Gemini

### Ollama (рекомендуется для офлайн)

```powershell
.\install_ollama.bat
# или
PowerShell -File scripts\install_ollama.ps1
```

Устанавливает Ollama и тянет `gemma4:e4b`. Connor использует Ollama для:

- Wake detection (есть ли «Коннор» в фразе)
- Tool routing (выбор handler)
- Свободных ответов на UNKNOWN

### Gemini (облако, точнее для Q&A)

1. Ключ на [aistudio.google.com](https://aistudio.google.com)
2. `gemini_api_key` в config
3. Для Q&A с поиском: `qa_use_gemini_grounding: true`

---

## Q&A — короткие ответы голосом

**Пример:** «Коннор, когда анонс игры Метро 2039?» → одно предложение голосом.

**Логика (`qa_service.py`):**

1. Если в фразе «подробно», «как работает» и т.п. → сразу Google
2. Gemini + Google Search grounding (если ключ есть)
3. Иначе Ollama + DuckDuckGo snippets
4. Если ответ пустой / неуверенный → «Открою Google…» + браузер

**Не Q&A:** время, погода, «как дела», «кто ты».

---

## TTS — озвучка реплик

| Режим | Когда |
|-------|-------|
| **WAV** | `use_camb_tts: false` — готовые файлы из `models/audio/` |
| **Camb.ai** | `use_camb_tts: true` — синтез голосом Connor RK800 |

Каталог WAV: `models/audio/AUDIO_MAP.json` — ключ → файл.

Панель текста синхронизирована с TTS: закрывается после конца аудио + `connor_tts_post_hide_ms`.

---

## Музыка: Spotify / Яндекс / Lune

| Backend | Управление |
|---------|------------|
| **spotify** | Win32 media keys + авто-детект окна Spotify |
| **yandex** | Яндекс.Музыка в браузере, hotkeys |
| **lune** | Локальный плеер Lune |

`player_detector.py` определяет активный плеер при старте.

Команды: play/pause/next/prev, «включи [название трека]» (поиск + `playlist.json`).

---

## Overlay (PyQt5 HUD)

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Controller | `overlay/controller.py` | QApplication, координация |
| Text panel | `text_panel.py` | Текст ответа слева |
| Wave panel | `wave_panel.py` | Волна микрофона сверху |
| Status bar | `status_bar.py` | Статус снизу |
| Boot splash | `boot_splash.py` | Загрузка моделей |
| Welcome | `welcome_screen.py` | Первый запуск |
| Weather | `weather_panel.py` | Погодный виджет |

Overlay поверх всех окон, прозрачность из `overlay_opacity`.

---

## Tauri UI (dashboard, настройки, tray)

| Вкладка | Содержимое |
|---------|------------|
| **Dashboard** | Статус, волна микрофона, быстрые команды |
| **Команды** | Список голосовых команд |
| **Заметки** | SQLite notes (чтение/запись через IPC) |
| **Устройства** | Заглушка Arduino (будущее) |
| **Настройки** | config.json, акцент, LLM, TTS |

**Tray:** `connor-tray-v2.exe` — иконка RK800, меню, скрытие окна.

**Глаза RK800:** 8 PNG (`src/assets/eyes/`) синхронизированы с `accent_color` через `ConfigProvider`.

---

## Пути и переносимость

Проект **не привязан** к конкретному пользователю или диску.

| Компонент | Как находит корень |
|-----------|-------------------|
| `Connor.vbs`, `*.bat` | Папка скрипта |
| `Install-Connor.ps1` | `$PSScriptRoot` |
| Python `constants.py` | `CONNOR_ROOT` env или walk-up от `python-core/` |
| Tauri `lib.rs` | Walk-up от exe + `CONNOR_ROOT` |
| `pythonw.exe` | `python_path.txt` → `%LOCALAPPDATA%\Programs\Python\` → PATH |

Переменная **`CONNOR_ROOT`** — абсолютный путь к корню (устанавливается в `main.py` и launcher).

После копирования на другой ПК: переустановите pip (`Install-Connor.ps1` или Setup) и при необходимости пересоберите Tauri.

---

## Структура проекта

```
Connor-assistant/
├── Connor.vbs                 # Production launcher (pythonw + tray)
├── start.bat / start_core.bat / start_tray.bat
├── stop_connor.bat            # Kill connor-tray + pythonw
├── create_shortcut.bat        # Ярлык на рабочем столе
├── install_ollama.bat         # Ollama + Gemma
├── Install-Connor.ps1           # Dev installer
├── config.example.json        # Шаблон настроек
├── config.json                # Локальный (gitignore)
├── python_path.txt            # Путь к pythonw (gitignore)
│
├── installer/
│   ├── Connor-Setup.iss       # Inno Setup spec
│   └── Output/
│       └── Connor-Setup.exe   # Готовый установщик
│
├── scripts/
│   ├── create_shortcut.ps1
│   ├── install_ollama.ps1
│   └── gen_app_icons.py       # icon.ico из source-rk800.raw.png
│
├── python-core/
│   ├── main.py                # Entry point
│   ├── requirements.txt
│   ├── core/
│   │   ├── pipeline.py        # VAD→STT→wake→route
│   │   ├── vad.py / stt_worker.py / wake_detector.py
│   │   ├── state_machine.py / dismiss.py
│   │   ├── overlay/           # PyQt5 HUD
│   │   ├── music/             # spotify, yandex, lune
│   │   ├── system/            # apps, volume, power
│   │   ├── ocr/               # Tesseract screen text
│   │   ├── storage/           # notes_db, memory_store
│   │   └── activity_tracker.py
│   ├── openjarvis/
│   │   ├── fallback_router.py # Regex routing
│   │   ├── route.py / dispatch.py
│   │   ├── qa_service.py      # Q&A + grounding
│   │   ├── ollama_client.py / gemini_client.py
│   │   ├── connor_ui.py       # TTS + panel sync
│   │   └── handlers/          # APPS, MUSIC, QA, …
│   ├── scripts/               # verify_gemma, verify_camb_tts
│   └── models/
│       ├── audio/             # WAV + AUDIO_MAP.json
│       ├── playlist.json
│       ├── memory.json
│       ├── notes.db
│       └── python_ready.flag
│
└── tauri-front/
    ├── src/                   # React UI
    ├── src-tauri/             # Rust + icons
    │   ├── src/lib.rs         # IPC, tray, config
    │   └── icons/             # icon.ico, taskbar-icon.png
    └── package.json
```

Подробный индекс каждого файла — **`FILES.md`**.

---

## Скрипты и утилиты

| Файл | Назначение |
|------|------------|
| `Connor.vbs` | Тихий запуск без консоли |
| `Install-Connor.ps1` | Полная dev-установка |
| `install_ollama.bat` | Ollama + gemma4:e4b |
| `create_shortcut.bat` | Ярлык + sync иконок |
| `stop_connor.bat` | Завершить все процессы Connor |
| `install_deps.bat` | pip для Python 3.11/3.14 |
| `find_pythonw.bat` | Найти pythonw.exe |
| `scripts/gen_app_icons.py` | Генерация icon.ico |
| `tauri-front/refresh_taskbar_icon.bat` | Пересборка + сброс кэша иконок |
| `python-core/scripts/verify_gemma.py` | Проверка Ollama |
| `python-core/scripts/verify_camb_tts.py` | Проверка Camb TTS |

---

## Сборка Setup.exe и Tauri из исходников

### Tauri UI

```powershell
cd tauri-front
npm install
npm run tauri build
# → src-tauri/target/release/connor-tray-v2.exe
```

Требуется: Node.js 18+, Rust (rustup), WebView2 (есть в Win10+).

### Connor-Setup.exe

```powershell
# 1. Собрать connor-tray-v2.exe (см. выше)
# 2. Скомпилировать Inno Setup
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\Connor-Setup.iss
# → installer/Output/Connor-Setup.exe
```

Setup **не включает** Ollama — только опциональный запуск `install_ollama.bat` после установки.

---

## Иконки RK800

| Файл | Назначение |
|------|------------|
| `icons/source-rk800.raw.png` | Исходник 512×512 |
| `icons/icon.ico` | Hybrid ICO (tray + taskbar + window) |
| `icons/taskbar-icon.png` | Панель задач |
| `icons/window-icon.png` | Заголовок окна |
| `icons/app-icon.ico` | Альтернативный ICO |

Регенерация:

```powershell
py scripts\gen_app_icons.py
cd tauri-front && npm run tauri build
.\create_shortcut.bat
```

---

## Аудио-реплики (WAV)

Структура `python-core/models/audio/`:

| Папка | Примеры |
|-------|---------|
| `startup/` | Приветствие, boot |
| `commands/` | «Выполняю», «Открываю» |
| `search/` | «Ищу в Google» |
| `weather/` | «Смотрю погоду» |
| `music/` | «Включаю музыку» |
| `errors/` | «Не понял» |
| `shutdown/` | «До свидания» |

Маппинг: `AUDIO_MAP.json`. Воспроизведение: `tts_player.py` (pygame).

---

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| Connor не слышит | Проверьте микрофон в Windows; вкладка Dashboard — волна |
| «Python not found» | Переустановите Setup или запустите `Install-Connor.ps1` |
| torch / DLL error | Установите [VC++ Redist 2022](https://aka.ms/vs/17/release/vc_redist.x64.exe) |
| Whisper долго грузится | Первый запуск скачивает модель; подождите boot-экран |
| Q&A не отвечает | Добавьте `gemini_api_key` или установите Ollama |
| Ollama timeout | `ollama pull gemma4:e4b`; проверьте `verify_gemma.py` |
| Панель текста не закрывается | Увеличьте `connor_tts_post_hide_ms` или проверьте TTS |
| Иконка в трее старая | `create_shortcut.bat` + `refresh_taskbar_icon.bat` |
| Два Connor | `stop_connor.bat` перед повторным запуском |
| «Какая погода» → Q&A | Обновитесь до v1.3.0+ (WEATHER до QA в router) |

Логи: `python-core/models/logs.jsonl`.

---

## История релизов

| Версия | Setup.exe | Примечание |
|--------|-----------|------------|
| **v1.3.0** | ✅ Connor-Setup.exe | Q&A, dismiss, погода, portable paths, TTS-sync, eyes accent |
| **v1.2.0** | ✅ | Параллельная STT, Spotify, glass UI, Camb TTS |
| **v1.1.0** | ✅ | Улучшения UI и routing |
| **v1.0.0** | ✅ + connor-tray-v2.exe | Первый публичный RK800 release |
| **v2.x** | Connor_Assistant_Setup_*.exe | Старая ветка «Connor Assistant» (Electron) |

Все релизы: [github.com/MadQuras/Connor-assistant/releases](https://github.com/MadQuras/Connor-assistant/releases)

---

## Лицензия

Fan-проект Connor RK800. Не аффилирован с Quantic Dream, CyberLife или Detroit: Become Human.
