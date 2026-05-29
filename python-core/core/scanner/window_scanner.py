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


def scan_apps_to_memory() -> Dict[str, str]:
    """
    Scan Start Menu shortcuts and save {normalised_name: lnk_path} to memory.json.
    Returns the resulting dict.
    """
    from core.system.apps_launcher import scan_start_menu, save_apps_to_memory

    apps = scan_start_menu()
    save_apps_to_memory(apps)
    return apps
