from __future__ import annotations

from core import audio_catalog
from core.overlay import get_overlay
from core.system.power import lock_workstation


def handle(arg: str, original_text: str = "") -> None:
    phrase = audio_catalog.phrase("system", "audio_34.wav") or "Сессия завершена. Удачи вам"
    get_overlay().show_text(phrase, tag="КОННОР", auto_hide_ms=6000)
    audio_catalog.play_key("lock", block=False)
    lock_workstation()
