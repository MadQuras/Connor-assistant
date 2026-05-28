from __future__ import annotations

from typing import Any, Dict, List, Optional

from core.storage.memory_store import MemoryStore


def list_windows() -> List[Dict[str, Any]]:
    import pygetwindow as gw

    out: List[Dict[str, Any]] = []
    for w in gw.getAllWindows():
        try:
            title = (w.title or "").strip()
            if not title:
                continue
            out.append(
                {
                    "title": title,
                    "left": int(w.left),
                    "top": int(w.top),
                    "width": int(w.width),
                    "height": int(w.height),
                }
            )
        except Exception:
            continue
    return out


def find_window(substring: str) -> Optional[Dict[str, Any]]:
    sub = substring.lower()
    for w in list_windows():
        if sub in w.get("title", "").lower():
            return w
    return None


def scan_apps_to_memory() -> None:
    wins = list_windows()
    known = {
        "chrome": ["chrome", "гугл"],
        "explorer": ["проводник", "explorer"],
        "discord": ["discord"],
        "steam": ["steam"],
        "telegram": ["telegram", "телеграм"],
        "notepad": ["блокнот", "notepad"],
        "yandex": ["яндекс", "yandex"],
    }
    detected: List[str] = []
    titles = " | ".join(w["title"].lower() for w in wins)
    for app, keys in known.items():
        if any(k in titles for k in keys):
            detected.append(app)

    store = MemoryStore()
    data = store.load()
    data["apps_cache"] = sorted(set(detected))
    store.save(data)
