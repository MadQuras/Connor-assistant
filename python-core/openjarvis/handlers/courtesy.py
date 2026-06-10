from __future__ import annotations

from openjarvis.connor_ui import speak_connor


def handle(arg: str, original_text: str = "") -> None:
    speak_connor("COURTESY", original_text=original_text, context=(arg or "generic").strip())
