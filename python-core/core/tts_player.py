"""
tts_player.py — воспроизведение WAV (pygame).

API:
  play_file(path: str, block: bool = True) -> None
  play_named(folder: str, filename: str, block: bool = True) -> str  # returns path
  resolve_path(folder, pattern) -> str  # audio_03 or audio_21-24

Советы:
  - threading.Lock на mixer init
  - pygame.mixer.init(frequency=44100)
"""

from __future__ import annotations

import os
import random
import threading
import time
from typing import List

from core.constants import AUDIO_DIR

_lock = threading.Lock()
_ready = False


def _init() -> None:
    global _ready
    with _lock:
        if not _ready:
            import pygame
            try:
                pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
                _ready = True
            except Exception as exc:
                print(f"[tts_player] pygame.mixer.init failed: {exc}")
                _ready = True  # mark ready anyway to avoid repeated init attempts


def resolve_path(folder: str, pattern: str) -> str:
    """
    pattern: 'audio_34' или 'audio_21-24' (диапазон).
    """
    base = os.path.join(AUDIO_DIR, folder)
    if "-" in pattern and pattern.startswith("audio_"):
        _, rest = pattern.split("_", 1)
        a, b = rest.split("-", 1)
        nums = range(int(a), int(b) + 1)
        candidates: List[str] = []
        for n in nums:
            candidates.append(os.path.join(base, f"audio_{n:02d}.wav"))
            candidates.append(os.path.join(base, f"audio_{n}.wav"))
    else:
        name = pattern if pattern.endswith(".wav") else f"{pattern}.wav"
        candidates = [os.path.join(base, name)]
    existing = [c for c in candidates if os.path.isfile(c)]
    if not existing:
        raise FileNotFoundError(f"{folder}/{pattern}")
    return random.choice(existing)


def play_file(path: str, block: bool = True) -> None:
    _init()
    import pygame
    try:
        sound = pygame.mixer.Sound(path)
        ch = sound.play()
        if block and ch is not None:
            while ch.get_busy():
                time.sleep(0.05)
    except Exception as exc:
        print(f"[tts_player] play_file({path!r}) failed: {exc}")


def play_named(folder: str, filename: str, block: bool = True) -> str:
    path = os.path.join(AUDIO_DIR, folder, filename)
    if not os.path.isfile(path):
        path = resolve_path(folder, filename.replace(".wav", ""))
    play_file(path, block=block)
    return path
