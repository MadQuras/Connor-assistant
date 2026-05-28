from __future__ import annotations

from core import audio_catalog
from core.overlay import get_overlay
from core.storage.notes_db import NotesDB

RECALL_PHRASES = ("о чем", "о чём", "напомни", "просил", "что я просил")
SCHEDULE_PHRASES = ("расписани", "расписание", "план", "schedule")


def _is_recall(text: str) -> bool:
    return any(p in text.lower() for p in RECALL_PHRASES)


def _is_schedule(text: str) -> bool:
    return any(p in text.lower() for p in SCHEDULE_PHRASES)


def handle(arg: str, original_text: str = "") -> None:
    ov = get_overlay()
    db = NotesDB()
    text = (arg or "").strip()
    original = (original_text or "").strip()

    if text and not _is_recall(original):
        db.add(text)
        ov.show_text(f"Записал: {text}", tag="ПАМЯТЬ", auto_hide_ms=6000)
        return

    notes = db.list_active(limit=8)
    if notes:
        lines = [row[0] for row in notes]
        ov.show_text("Напоминания:\n" + "\n".join(lines), auto_hide_ms=6000, tag="ПАМЯТЬ")
        if _is_recall(original):
            audio_catalog.play_key("plans_recall", block=False)    # audio_11: "Вот все о чем вы меня просили напомнить"
        elif _is_schedule(original):
            audio_catalog.play_key("plans_schedule", block=False)  # audio_10: "Проверил ваше расписание"
        else:
            audio_catalog.play_key("plans_list", block=False)      # audio_09: "Напоминания найдены"
    else:
        ov.show_text("Напоминаний пока нет", tag="ПАМЯТЬ", auto_hide_ms=6000)
        audio_catalog.play_key("error_unknown")
