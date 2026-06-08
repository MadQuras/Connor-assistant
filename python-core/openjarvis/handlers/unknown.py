from __future__ import annotations

import random

from core import audio_catalog, tts_player
from core.overlay import get_overlay
from openjarvis.connor_ui import connor_llm_active


def handle(arg: str, original_text: str = "") -> None:
    if connor_llm_active():
        # Реплику генерирует Gemma через respond("UNKNOWN") в dispatch
        err = random.choice(("audio_06.wav", "audio_07.wav", "audio_08.wav"))
        tts_player.play_named("errors", err, block=False)
        return

    ov = get_overlay()
    ov.show_text(
        audio_catalog.phrase("errors", "audio_06.wav") or "Я не понял команду",
        tag="КОННОР",
    )
    err = random.choice(("audio_06.wav", "audio_07.wav", "audio_08.wav"))
    tts_player.play_named("errors", err, block=False)
