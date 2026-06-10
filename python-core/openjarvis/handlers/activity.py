from __future__ import annotations

from core.activity_tracker import get_activity_summary
from core.overlay import get_overlay
from openjarvis.connor_ui import speak_connor


def handle(arg: str, original_text: str = "") -> None:
    data = get_activity_summary()
    total = data.get("total_fmt", "0м")
    apps = data.get("apps") or []
    top = apps[0]["name"] if apps else "—"
    get_overlay().show_text(
        f"Активность сегодня: {total}\nОсновное окно: {top}",
        tag="АКТИВНОСТЬ",
        auto_hide_ms=12000,
    )
    speak_connor("ACTIVITY", original_text=original_text, context=f"сегодня {total}")
