"""
audio_catalog.py — обёртка над AUDIO_MAP.json и tts_player.

API:
  load_catalog() -> dict
  phrase(folder, filename) -> str
  play_key(key: str, block=True) -> str   # handler_keys: wake, plans_recall, ...
  play_time_greeting() -> str             # audio_27-30 по часам
  play_startup_boot() -> str              # audio_25 + greeting

Ключи handler_keys (см. AUDIO_MAP.json):
  wake, app_open, app_done, music_start, plans_recall, search_start, ...
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from core.constants import AUDIO_DIR
from core import tts_player

_CATALOG: Optional[dict] = None


def load_catalog() -> dict[str, Any]:
    global _CATALOG
    if _CATALOG is None:
        path = AUDIO_DIR / "AUDIO_MAP.json"
        with open(path, "r", encoding="utf-8") as f:
            _CATALOG = json.load(f)
    return _CATALOG


def phrase(folder: str, filename: str) -> str:
    key = filename.replace(".wav", "")
    return load_catalog().get(folder, {}).get(key, "")


def play_key(key: str, block: bool = True) -> str:
    entry = load_catalog()["handler_keys"][key]
    if entry == "by_time_of_day":
        return play_time_greeting(block=block)
    folder, name = entry[0], entry[1]
    fn = name if name.endswith(".wav") else f"{name}.wav"
    return tts_player.play_named(folder, fn, block=block)


def play_time_greeting(block: bool = True) -> str:
    h = datetime.now().hour
    if 5 <= h < 12:
        fn = "audio_27.wav"
    elif 12 <= h < 17:
        fn = "audio_28.wav"
    elif 17 <= h < 22:
        fn = "audio_29.wav"
    else:
        fn = "audio_30.wav"
    return tts_player.play_named("startup", fn, block=block)


def play_startup_boot(block: bool = True) -> str:
    tts_player.play_named("startup", "audio_25.wav", block=block)
    return play_time_greeting(block=block)


_round_robin_counters: dict = {}
_maybe_play_counters: dict = {}
_call_counters: dict = {}


def play_key_random(*keys: str, block: bool = False) -> None:
    """Cycle through keys in round-robin order (1st call → keys[0], 2nd → keys[1], …)."""
    k = tuple(sorted(keys))
    idx = _round_robin_counters.get(k, 0)
    key = keys[idx % len(keys)]
    _round_robin_counters[k] = idx + 1
    play_key(key, block=block)


def play_music_browse(block: bool = False) -> None:
    """Alternates between audio_22 and audio_23 on each call using round-robin."""
    play_key_random("music_open_browse_a", "music_open_browse_b", block=block)


def maybe_play(cmd_id: str, *keys: str, block: bool = False) -> bool:
    """
    Play exactly ONE audio from keys with 10% chance (every 10th call).
    Uses round-robin within keys so responses vary each time.

    cmd_id  — unique string per command context, e.g. "apps", "search", "weather"
    keys    — handler_key names to rotate through on lucky hits
    Returns True if audio was played.
    """
    if not keys:
        return False
    n = _call_counters.get(cmd_id, 0) + 1
    _call_counters[cmd_id] = n
    if n % 10 != 0:
        return False
    # Round-robin among keys on each lucky hit
    rr_idx = _maybe_play_counters.get(cmd_id, 0)
    key = keys[rr_idx % len(keys)]
    _maybe_play_counters[cmd_id] = rr_idx + 1
    play_key(key, block=block)
    return True
