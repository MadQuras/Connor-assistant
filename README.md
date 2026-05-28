# Connor RK800

**Статус: каркас проекта** — ~50 файлов с описанием логики в каждом. Реализация: см. `FILES.md`.

## Дерево (кратко)

```
Connor-assistant/
├── config.json
├── FILES.md              ← полный индекс + порядок работы
├── install_deps.bat
├── start_core.bat / start_tray.bat
├── python-core/
│   ├── main.py
│   ├── core/
│   │   ├── config_loader.py, constants.py, exceptions.py
│   │   ├── state_machine.py, pipeline.py
│   │   ├── vad.py, stt_worker.py, wake_detector.py
│   │   ├── tts_player.py, audio_catalog.py
│   │   ├── overlay/      (controller, text, wave, status, boot)
│   │   ├── music/        (yandex.py)
│   │   ├── ocr/          (screen_text, find_click)
│   │   ├── scanner/      (window_scanner)
│   │   ├── storage/      (memory_store, notes_db)
│   │   └── system/       (apps, volume, power)
│   ├── openjarvis/
│   │   ├── route.py, dispatch.py, gemini_client.py, fallback_router.py
│   │   ├── context.py
│   │   └── handlers/     (10 команд + base + registry)
│   └── models/           (audio WAV, AUDIO_MAP.json, UI-references)
└── tauri-front/
    └── src/components/   (Dashboard, Commands, Notes, Devices, Settings)
```

## Демо-команды

Wake, найди, открой, музыка (Яндекс), время, погода, «о чём просил».

## Завтра с Pro

Откройте `FILES.md` → день 1 → `config_loader` + `state_machine` + `pipeline` + …
