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
    Scan Start Menu shortcuts AND %LOCALAPPDATA%\\Programs (user-installed apps
    like Discord, Lune, VS Code) and save {normalised_name: path} to memory.json.
    Returns the resulting dict.
    """
    import os
    from pathlib import Path
    from core.system.apps_launcher import scan_start_menu, save_apps_to_memory

    apps = scan_start_menu()

    # Additionally scan %LOCALAPPDATA%\Programs for user-installed executables
    local_programs = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs"
    if local_programs.exists():
        for exe in local_programs.rglob("*.exe"):
            # Skip helper executables (updaters, uninstallers, etc.)
            skip_keywords = (
                "update", "uninstall", "helper", "crash", "setup",
                "install", "squirrel", "stub", "repair",
            )
            name_lower = exe.stem.lower()
            if any(kw in name_lower for kw in skip_keywords):
                continue
            # Normalise name: "YandexMusic" → "yandexmusic", keep it simple
            normalised = name_lower.replace("-", " ").replace("_", " ").strip()
            if normalised and normalised not in apps:
                apps[normalised] = str(exe)

    save_apps_to_memory(apps)
    return apps
