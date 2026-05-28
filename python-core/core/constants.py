"""
constants.py — общие константы проекта (без логики).

Содержит:
  - Корневые пути к models/, config.json
  - SAMPLE_RATE = 16000 для VAD/STT
  - WAKE_WORDS_FALLBACK — список для offline wake
  - State enum re-export или определение здесь (если не в state_machine)

Совет: не импортируйте torch/pygame сюда — только str, int, Path.
"""

from enum import Enum
from pathlib import Path

# python-core/ — родитель core/
CORE_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = CORE_ROOT.parent
MODELS_DIR = CORE_ROOT / "models"
AUDIO_DIR = MODELS_DIR / "audio"
CONFIG_PATHS = (
    PROJECT_ROOT / "config.json",
    CORE_ROOT / "config.json",
    Path("config.json"),
)

SAMPLE_RATE = 16000
VAD_CHUNK_MS = 32
COMMAND_TIMEOUT_SEC = 15

WAKE_WORDS_FALLBACK = (
    "коннор", "конор", "конер", "connor", "конно", "коно", "гонор", "конне", "ко-нор",
)

GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_WAKE_TIMEOUT_SEC = 3.0
GEMINI_ROUTE_TIMEOUT_SEC = 5.0


class ConnorState(str, Enum):
    """Состояния FSM — дублировать с state_machine или импортировать оттуда."""

    SLEEPING = "sleeping"
    AWAKENED = "awakened"
    LISTENING = "listening"
    PROCESSING = "processing"
    RESPONDING = "responding"
