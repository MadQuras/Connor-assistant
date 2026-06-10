from __future__ import annotations

import subprocess
import urllib.parse

from core import audio_catalog
from core.overlay import get_overlay
from core.storage.memory_store import MemoryStore

_STRIP_PREFIXES = ("найди ", "найти ", "поиск ", "загугли ", "гугл ")


def _clean_query(text: str) -> str:
    low = text.lower().strip()
    for prefix in _STRIP_PREFIXES:
        if low.startswith(prefix):
            return text[len(prefix):].strip()
    return text.strip()


def open_google(query: str) -> bool:
    """Открыть Google Search. Возвращает True при успехе."""
    q = _clean_query(query).strip()
    if not q:
        return False
    url = "https://www.google.com/search?q=" + urllib.parse.quote(q)
    try:
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)
        return True
    except Exception as e:
        print(f"[Search] browser open failed: {e}")
        return False


def handle(arg: str, original_text: str = "") -> None:
    query = (_clean_query(arg) if arg else _clean_query(original_text)).strip()

    if not query:
        get_overlay().show_text(
            "Что найти? Скажите: «Коннор, найди ...»",
            tag="ПОИСК", auto_hide_ms=8000,
        )
        audio_catalog.play_key("error_unknown")
        return

    open_google(query)

    try:
        d = MemoryStore().load()
        d["last_search"] = query
        MemoryStore().save(d)
    except Exception:
        pass

    # 10% chance, rotates через все 4 варианта: audio_04 → audio_14 → audio_15 → audio_16 → …
    audio_catalog.maybe_play(
        "search",
        "search_start_a", "search_start_b", "search_done_a", "search_done_b",
        block=False,
    )
