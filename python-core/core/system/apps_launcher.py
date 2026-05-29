from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Optional

from core.storage.memory_store import MemoryStore

# ─── Hardcoded shortcuts for always-available system apps ────────────────────
_BUILTIN: Dict[str, str] = {
    # Russian aliases → executable name
    "хром": "chrome",
    "гугл": "chrome",
    "chrome": "chrome",
    "яндекс браузер": "msedge",
    "яндекс": "msedge",
    "edge": "msedge",
    "браузер": "msedge",
    "блокнот": "notepad",
    "notepad": "notepad",
    "стим": "steam",
    "steam": "steam",
    "дота": "steam",
    "dota": "steam",
    "калькулятор": "calc",
    "calc": "calc",
    "calculator": "calc",
    "проводник": "explorer",
    "explorer": "explorer",
    "файлы": "explorer",
    "загрузки": "__downloads__",
    "документы": "__documents__",
    "рабочий стол": "__desktop__",
    "desktop": "__desktop__",
    # Discord — common path
    "дискорд": "__discord__",
    "discord": "__discord__",
    "дискорт": "__discord__",
    "дискор": "__discord__",
    # Telegram
    "телеграм": "__telegram__",
    "telegram": "__telegram__",
    # VS Code
    "код": "__vscode__",
    "code": "__vscode__",
    "vscode": "__vscode__",
    "visual studio code": "__vscode__",
    # Spotify
    "спотифай": "__spotify__",
    "spotify": "__spotify__",
    # OBS
    "obs": "__obs__",
}

# ─── Normalisation ────────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """Lower-case, strip punctuation and extra spaces."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)   # remove punct (replaces "." too)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ─── Special-path resolvers ───────────────────────────────────────────────────

def _find_discord() -> Optional[str]:
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Discord" / "Update.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Discord",
    ]
    # Look for Discord.exe inside versioned Update folder
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Discord"
    if base.exists():
        for sub in sorted(base.iterdir(), reverse=True):
            exe = sub / "Discord.exe"
            if exe.exists():
                return str(exe)
        # Fallback: launch via Update.exe --processStart Discord.exe
        upd = base / "Update.exe"
        if upd.exists():
            return str(upd)
    # Start Menu shortcut
    lnk = (
        Path(os.environ.get("APPDATA", ""))
        / "Microsoft/Windows/Start Menu/Programs/Discord Inc/Discord.lnk"
    )
    if lnk.exists():
        return str(lnk)
    return None


def _find_telegram() -> Optional[str]:
    exe = Path(os.environ.get("APPDATA", "")) / "Telegram Desktop" / "Telegram.exe"
    if exe.exists():
        return str(exe)
    return None


def _find_vscode() -> Optional[str]:
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Microsoft VS Code" / "Code.exe",
        Path(r"C:\Program Files\Microsoft VS Code\Code.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_spotify() -> Optional[str]:
    exe = Path(os.environ.get("APPDATA", "")) / "Spotify" / "Spotify.exe"
    if exe.exists():
        return str(exe)
    return None


def _find_obs() -> Optional[str]:
    candidates = [
        Path(r"C:\Program Files\obs-studio\bin\64bit\obs64.exe"),
        Path(r"C:\Program Files (x86)\obs-studio\bin\32bit\obs32.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


_SPECIAL = {
    "__discord__": _find_discord,
    "__telegram__": _find_telegram,
    "__vscode__": _find_vscode,
    "__spotify__": _find_spotify,
    "__obs__": _find_obs,
}


# ─── Start Menu scanner ───────────────────────────────────────────────────────

def _start_menu_dirs():
    dirs = []
    appdata = os.environ.get("APPDATA", "")
    progdata = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
    user_sm = Path(appdata) / "Microsoft/Windows/Start Menu/Programs"
    sys_sm  = Path(progdata) / "Microsoft/Windows/Start Menu/Programs"
    if user_sm.exists():
        dirs.append(user_sm)
    if sys_sm.exists():
        dirs.append(sys_sm)
    return dirs


def scan_start_menu() -> Dict[str, str]:
    """
    Walk Start Menu and return {normalised_name: lnk_or_exe_path}.
    Stored in memory.json under "apps" key and used by launch_app().
    """
    result: Dict[str, str] = {}
    for sm in _start_menu_dirs():
        for lnk in sm.rglob("*.lnk"):
            name = _normalise(lnk.stem)
            result[name] = str(lnk)
    return result


def save_apps_to_memory(apps: Dict[str, str]) -> None:
    store = MemoryStore()
    data = store.load()
    data["apps"] = apps
    store.save(data)


def _load_apps_cache() -> Dict[str, str]:
    data = MemoryStore().load()
    return {str(k): str(v) for k, v in data.get("apps", {}).items()}


# ─── Main launch function ─────────────────────────────────────────────────────

def launch_app(name: str) -> bool:
    query = _normalise(name)

    # 1. Hardcoded map
    special_key = _BUILTIN.get(query)

    # 2. Fuzzy hardcoded match (first word or substring)
    if not special_key:
        for alias, target in _BUILTIN.items():
            if alias in query or query in alias:
                special_key = target
                break

    # 3. Resolve special keys
    if special_key:
        if special_key == "__downloads__":
            os.startfile(os.path.join(os.path.expanduser("~"), "Downloads"))
            return True
        if special_key == "__documents__":
            os.startfile(os.path.join(os.path.expanduser("~"), "Documents"))
            return True
        if special_key == "__desktop__":
            os.startfile(os.path.expanduser("~") + "\\Desktop")
            return True
        if special_key in _SPECIAL:
            path = _SPECIAL[special_key]()
            if path:
                return _open_path(path)
        if special_key in ("calc", "notepad", "explorer"):
            subprocess.Popen([special_key + ".exe"], shell=False)
            return True
        # Regular exe name
        exe = shutil.which(special_key)
        if exe:
            subprocess.Popen([exe], shell=False)
            return True

    # 4. Start Menu cache (scanned .lnk files)
    cache = _load_apps_cache()
    if cache:
        # Exact match
        if query in cache:
            return _open_path(cache[query])
        # Fuzzy: query is substring of cache key OR vice versa
        for cached_name, path in cache.items():
            if query in cached_name or cached_name in query:
                return _open_path(path)

    # 5. shutil.which — exe is on PATH
    exe = shutil.which(query.replace(" ", ""))
    if exe:
        subprocess.Popen([exe], shell=False)
        return True

    # 6. os.startfile — hope Windows finds it
    try:
        os.startfile(query)
        return True
    except OSError:
        pass

    # 7. start command fallback
    try:
        subprocess.Popen(f'start "" "{query}"', shell=True)
        return True
    except OSError:
        return False


def _open_path(path: str) -> bool:
    """Open a file/lnk/exe via os.startfile or subprocess."""
    try:
        os.startfile(path)
        return True
    except Exception:
        try:
            subprocess.Popen([path], shell=False)
            return True
        except Exception:
            return False
