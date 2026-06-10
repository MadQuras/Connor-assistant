from __future__ import annotations

import json
import os

from core import audio_catalog
from core.music.base import get_player
from core.overlay import get_overlay
from openjarvis.connor_ui import connor_llm_active, show_connor


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
    llm_ui = connor_llm_active()

    def _say(msg: str) -> None:
        if not llm_ui:
            ov.show_text(msg, tag="КОННОР")

    # Navigation / playback controls
    if any(x in text for x in (
        "следующ", "next", "дальше", "след трек", "следующий",
        "следующую", "следующая", "вперёд", "вперед",
    )):
        if player.next_track():
            _say("Следующий трек")
        else:
            msg = (
                "Lune не переключает треки. "
                "В настройках выберите Spotify или Яндекс Музыку."
            )
            show_connor(msg) if llm_ui else ov.show_text(msg, tag="КОННОР")
        return

    if any(x in text for x in (
        "возобнов", "продолжи", "продолжай", "продолжать", "продолжить",
        "resume", "unpause", "play",
    )):
        _say("Воспроизведение")
        player.resume()
        return

    if any(x in text for x in (
        "пауз", "pause", "стоп", "stop", "останови", "останов",
        "прерви", "поставь на паузу",
    )):
        _say("Пауза")
        player.pause()
        return

    if any(x in text for x in (
        "предыдущ", "prev", "назад", "пред трек", "предыдущий",
        "предыдущую", "предыдущая",
    )):
        if player.prev_track():
            _say("Предыдущий трек")
        else:
            msg = (
                "Lune не переключает треки. "
                "В настройках выберите Spotify или Яндекс Музыку."
            )
            show_connor(msg) if llm_ui else ov.show_text(msg, tag="КОННОР")
        return

    if text:
        # "включи [track]" — play specific track
        for item in _load_playlist():
            t = item["title"].lower()
            a = item["artist"].lower()
            if text in t or text in a:
                q = f"{item['title']} {item['artist']}"
                _say(f"Ищу: {item['title']}")
                player.search_and_play(q)
                # 10% chance, rotates: audio_21 → audio_24 → audio_21 → …
                audio_catalog.maybe_play("music_track", "music_open_player", "music_playing", block=False)
                return
        _say(f"Ищу трек: {text}")
        player.search_and_play(text)
        audio_catalog.maybe_play("music_track", "music_open_player", "music_playing", block=False)
        return

    # "открой музыку" — open Lune without specific track
    if not llm_ui:
        ov.show_text(audio_catalog.phrase("commands", "audio_05.wav") or "Включаю музыку", tag="КОННОР")
    player.play_pause()
    # 10% chance, rotates: audio_05 → audio_22 → audio_23 → audio_05 → …
    audio_catalog.maybe_play("music_open", "app_done", "music_open_browse_a", "music_open_browse_b", block=False)
