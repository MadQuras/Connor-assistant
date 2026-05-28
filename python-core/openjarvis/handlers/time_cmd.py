from __future__ import annotations

from datetime import datetime

from core.overlay import get_overlay

_MONTHS = [
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]
_DAYS = [
    "Понедельник", "Вторник", "Среда", "Четверг",
    "Пятница", "Суббота", "Воскресенье",
]


def handle(arg: str, original_text: str = "") -> None:
    now = datetime.now()
    time_str = now.strftime("%H:%M")
    date_str = f"{_DAYS[now.weekday()]}, {now.day} {_MONTHS[now.month]} {now.year}"
    # Visual answer: big clock + date. connor_response layer adds no text for TIME.
    get_overlay().show_text(f"{time_str}\n{date_str}", auto_hide_ms=6000, tag="ВРЕМЯ")
