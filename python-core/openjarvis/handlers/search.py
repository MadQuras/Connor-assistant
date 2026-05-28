from __future__ import annotations

import subprocess
import threading
import time
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


def handle(arg: str, original_text: str = "") -> None:
    query = (_clean_query(arg) if arg else _clean_query(original_text)).strip()

    if not query:
        get_overlay().show_text(
            "Что найти? Скажите: «Коннор, найди ...»",
            tag="ПОИСК", auto_hide_ms=8000,
        )
        audio_catalog.play_key("error_unknown")
        return

    # Randomly pick audio_04 ("Выполняю. Займет пару секунд") or audio_14 ("Ищу информацию...")
    audio_catalog.play_key_random("search_start_a", "search_start_b", block=False)

    url = "https://www.google.com/search?q=" + urllib.parse.quote(query)
    try:
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)
    except Exception as e:
        print(f"[Search] browser open failed: {e}")

    try:
        d = MemoryStore().load()
        d["last_search"] = query
        MemoryStore().save(d)
    except Exception:
        pass

    # After browser opens, randomly pick audio_15 or audio_16 with 0.5s delay
    def _play_done() -> None:
        time.sleep(0.5)
        audio_catalog.play_key_random("search_done_a", "search_done_b", block=False)

    threading.Thread(target=_play_done, name="search-audio-done", daemon=True).start()
