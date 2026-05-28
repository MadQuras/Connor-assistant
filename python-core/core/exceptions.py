"""
exceptions.py — типизированные ошибки Connor.

Использование:
  - ConfigError — нет config.json / невалидный JSON
  - AudioNotFoundError — нет WAV для play_key
  - GeminiError — API недоступен (переход на fallback)
  - MicrophoneError — sounddevice не открыл микрофон

В main.py ловите ConnorError и показывайте overlay.show_text(str(e)).
"""


class ConnorError(Exception):
    """Базовая ошибка ассистента."""


class ConfigError(ConnorError):
    """Проблема с config.json."""


class AudioNotFoundError(ConnorError):
    """WAV файл не найден по AUDIO_MAP."""


class GeminiError(ConnorError):
    """Ошибка вызова Gemini API."""


class MicrophoneError(ConnorError):
    """Микрофон недоступен."""
