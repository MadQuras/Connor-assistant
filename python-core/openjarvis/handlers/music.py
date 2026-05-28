from __future__ import annotations

import json
import os

from core import audio_catalog
from core.music.base import get_player
from core.overlay import get_overlay


def _playlist_path() -> str:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(root, "models", "playlist.json")


def _load_playlist() -> list:
    with open(_playlist_path(), "r", encoding="utf-8") as f:
        return json.load(f)


def handle(arg: str, original_text: str = "") -> None:
    text = (arg or original_text or "").strip().lower()
    ov = get_overlay()
    player = get_player()

    # Navigation / playback controls — handled by central response, no specific audio
    if any(x in text for x in ("следующ", "next", "дальше")):
        ov.show_text("Следующий трек")
        player.next_track()
        return

    if any(x in text for x in ("пауз", "pause", "стоп", "stop")):
        ov.show_text("Пауза")
        player.play_pause()
        return

    if any(x in text for x in ("предыдущ", "prev", "назад")):
        ov.show_text("Предыдущий трек")
        player.prev_track()
        return

    if text:
        # "включи [track]" — play specific track
        for item in _load_playlist():
            t = item["title"].lower()
            a = item["artist"].lower()
            if text in t or text in a:
                q = f"{item['title']} {item['artist']}"
                ov.show_text(f"Ищу: {item['title']}")
                player.search_and_play(q)
                audio_catalog.play_key("music_open_player", block=False)  # audio_21: "Запускаю плеер..."
                audio_catalog.play_key("music_playing", block=False)       # audio_24: "Воспроизведение запущено..."
                return
        ov.show_text(f"Ищу трек: {text}")
        player.search_and_play(text)
        audio_catalog.play_key("music_open_player", block=False)  # audio_21
        audio_catalog.play_key("music_playing", block=False)       # audio_24
        return

    # "открой музыку" — open Lune without specific track
    ov.show_text(audio_catalog.phrase("commands", "audio_05.wav") or "Включаю музыку")
    player.play_pause()
    audio_catalog.play_key("app_done", block=False)    # audio_05: "Готово. Приложение запущено"
    audio_catalog.play_music_browse()                  # alternates audio_22 / audio_23
