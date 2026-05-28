# Полная карта файлов Connor RK800

Легенда: `[скелет]` — файл с сигнатурами и комментариями, логику пишете по ним.

## Корень

| Файл | Назначение |
|------|------------|
| `config.json` | Конфигурация (Gemini, Whisper, Яндекс Музыка, таймауты) |
| `README.md` | Обзор и запуск |
| `FILES.md` | Этот индекс |
| `install_deps.bat` | pip 3.11 + 3.14 |
| `start_core.bat` | Голосовое ядро |
| `start_tray.bat` | Tauri UI |
| `start.bat` | Подсказка / полный запуск |

## python-core/

| Файл | Назначение |
|------|------------|
| `main.py` | Точка входа, потоки, ConnorApp |
| `core/constants.py` | Пути, enum состояний, wake-слова |
| `core/exceptions.py` | ConnorError, ConfigError, … |
| `core/config_loader.py` | load_config(), save_config() |
| `core/state_machine.py` | FSM + таймер 15 с |
| `core/pipeline.py` | Связка VAD→STT→wake→route→handler |
| `core/vad.py` | Silero + VADListener |
| `core/stt_worker.py` | faster-whisper |
| `core/wake_detector.py` | Gemini YES/NO + fallback |
| `core/tts_player.py` | pygame WAV |
| `core/audio_catalog.py` | AUDIO_MAP.json → play_key |
| `core/overlay/controller.py` | QApplication, главный контроллер |
| `core/overlay/text_panel.py` | Текст слева (LLM + ответы) |
| `core/overlay/wave_panel.py` | Волна сверху |
| `core/overlay/status_bar.py` | Полоса статуса снизу |
| `core/overlay/boot_splash.py` | Загрузка моделей |
| `core/music/yandex.py` | Яндекс Музыка |
| `core/music/base.py` | Интерфейс плеера |
| `core/ocr/screen_text.py` | OCR всего экрана |
| `core/ocr/find_click.py` | OCR → клик по слову |
| `core/scanner/window_scanner.py` | pygetwindow |
| `core/storage/notes_db.py` | SQLite заметки |
| `core/storage/memory_store.py` | memory.json |
| `core/system/apps_launcher.py` | subprocess приложений |
| `core/system/volume_control.py` | pycaw |
| `core/system/power.py` | lock / shutdown |
| `openjarvis/context.py` | CommandContext dataclass |
| `openjarvis/gemini_client.py` | google-genai |
| `openjarvis/fallback_router.py` | Regex/keywords |
| `openjarvis/dispatch.py` | category → handler |
| `openjarvis/route.py` | Фасад wake + route |
| `openjarvis/handlers/base.py` | Базовый handler |
| `openjarvis/handlers/registry.py` | HANDLERS dict |
| `openjarvis/handlers/*.py` | Команды |

## tauri-front/

| Файл | Назначение |
|------|------------|
| `src/App.tsx` | Роутинг вкладок |
| `src/components/Layout/Shell.tsx` | Titlebar + tabs |
| `src/components/Dashboard/...` | Главная |
| `src/components/Commands/...` | Список команд |
| `src/components/Notes/...` | Заметки (заглушка) |
| `src/components/Devices/...` | Arduino заглушка |
| `src/components/Settings/...` | config.json |
| `src/hooks/useConfig.ts` | load/save |
| `src/lib/tauri.ts` | invoke обёртки |
| `src/styles/tokens.css` | #00B4D8, шрифты |
| `src-tauri/src/lib.rs` | IPC + tray |

## models/

| Путь | Назначение |
|------|------------|
| `audio/**` | WAV + AUDIO_MAP.json |
| `playlist.json` | Треки для поиска в Яндекс |
| `memory.json` | Кэш, first_run, user_name |
| `notes.db` | Создаётся notes_db.py |
| `UI-references/` | HTML-макеты (не код) |

## Порядок кодирования (7 дней)

День 1: config_loader, constants, state_machine, pipeline skeleton  
День 2: vad, stt, wake_detector, gemini_client  
День 3: route, dispatch, handlers (apps, search, time)  
День 4: handlers (music/yandex, weather, plans)  
День 5: audio_catalog, tts, overlay/*  
День 6: main.py end-to-end, boot_splash  
День 7: tauri-front + репетиция демо  
