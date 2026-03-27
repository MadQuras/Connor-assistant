# Connor Assistant (v2.0.0)

Futuristic Electron assistant with voice wake-word, system monitoring, screenshots+OCR, reminders, DeepSeek chat, roulette casino, and macro automation.

## Requirements

- Windows 10/11
- Node.js (for installing dependencies during development)
- For offline speech (Vosk): trained model files.

## Install (development)

1. `npm install`
2. Make sure you have local Vosk model (one of these):
   - `./models/vosk-ru/` (dev fallback)
   - `./resources/vosk-model/` (packaged)
3. Run:
   - `npm start`

## DeepSeek API Key

In the app Settings, provide your DeepSeek API token (Bearer token) and save.

## Voice commands

Wake word: **«Коннор»**.

Examples:

- `Коннор, запусти макрос 1` — play macro #1
- `Коннор, сделай скриншот` — take fullscreen screenshot, run OCR, copy text to clipboard
- `Коннор, сделай скриншот области` — select area with transparent overlay, run OCR, copy text
- `Коннор, спроси у DeepSeek ...` — send question to DeepSeek, show answer in DeepSeek tab, optionally speak it
- `Коннор, напомни через 5 минут про встречу` — create one-time reminder
- `Коннор, напомни через 10 минут ежедневно про работу` — daily recurring reminder

## Keyboard hotkeys

Hotkeys are configurable in Settings → “Горячие клавиши”.

Defaults:

- `Ctrl+Shift+T` — show/hide main window
- `Ctrl+Shift+M` — toggle mute/unmute sound (robotjs media keys)
- `Ctrl+Shift+B` — open browser
- `Ctrl+Shift+R` — start voice recognition
- `Ctrl+Shift+Q` — exit

## Screenshots

Screenshots are saved to:

- `./screenshots/screenshot_YYYY-MM-DD_HH-mm-ss.png`

Recognized OCR text is copied to clipboard.

## Build / Installer (NSIS)

The project uses `electron-builder` with NSIS installer:

- Folder selection enabled
- Desktop & Start Menu shortcuts enabled

## Logs

- Voice errors: `./logs/voice-error.log`
- System errors: `./logs/system-error.log`

