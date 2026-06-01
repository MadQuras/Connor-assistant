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
    # ── Browsers ──────────────────────────────────────────────────────────────
    "хром": "chrome",
    "гугл": "chrome",
    "chrome": "chrome",
    "хромиум": "chrome",
    "chromium": "chrome",
    "опера": "__opera__",
    "opera": "__opera__",
    "фаерфокс": "__firefox__",
    "firefox": "__firefox__",
    "яндекс браузер": "__yabrowser__",
    "яндекс": "__yabrowser__",
    "edge": "msedge",
    "браузер": "msedge",
    # ── System ────────────────────────────────────────────────────────────────
    "блокнот": "notepad",
    "notepad": "notepad",
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
    # ── Games — Steam ecosystem ───────────────────────────────────────────────
    "стим": "__steam__",
    "steam": "__steam__",
    "дота": "__dota2__",
    "дота 2": "__dota2__",
    "dota": "__dota2__",
    "dota 2": "__dota2__",
    "кс": "__cs2__",
    "кс 2": "__cs2__",
    "кс го": "__csgo__",
    "контр страйк": "__cs2__",
    "counter strike": "__cs2__",
    "cs2": "__cs2__",
    "csgo": "__csgo__",
    "майнкрафт": "__minecraft__",
    "майн": "__minecraft__",
    "minecraft": "__minecraft__",
    "раст": "__rust__",
    "rust": "__rust__",
    "гта": "__gta5__",
    "гта 5": "__gta5__",
    "гта пять": "__gta5__",
    "gta": "__gta5__",
    "gta 5": "__gta5__",
    "gta v": "__gta5__",
    "валорант": "__valorant__",
    "valorant": "__valorant__",
    "апекс": "__apex__",
    "апекс легендс": "__apex__",
    "apex": "__apex__",
    "apex legends": "__apex__",
    "фортнайт": "__fortnite__",
    "fortnite": "__fortnite__",
    "овервотч": "__overwatch__",
    "overwatch": "__overwatch__",
    "хеймстор": "__hearthstone__",
    "hearthstone": "__hearthstone__",
    "лига легенд": "__lol__",
    "лол": "__lol__",
    "league of legends": "__lol__",
    "лигу": "__lol__",
    # ── Productivity ──────────────────────────────────────────────────────────
    "ворд": "__word__",
    "word": "__word__",
    "эксель": "__excel__",
    "excel": "__excel__",
    "пауэрпоинт": "__powerpoint__",
    "powerpoint": "__powerpoint__",
    # ── Messengers / Social ───────────────────────────────────────────────────
    "дискорд": "__discord__",
    "discord": "__discord__",
    "дискорт": "__discord__",
    "дискор": "__discord__",
    "телеграм": "__telegram__",
    "telegram": "__telegram__",
    "вк": "__vk__",
    "вконтакте": "__vk__",
    "vk": "__vk__",
    "вайбер": "__viber__",
    "viber": "__viber__",
    "ватсап": "__whatsapp__",
    "whatsapp": "__whatsapp__",
    "скайп": "__skype__",
    "skype": "__skype__",
    # ── Dev tools ─────────────────────────────────────────────────────────────
    "код": "__vscode__",
    "code": "__vscode__",
    "vscode": "__vscode__",
    "visual studio code": "__vscode__",
    "питон": "__vscode__",
    # ── Media ─────────────────────────────────────────────────────────────────
    "спотифай": "__spotify__",
    "spotify": "__spotify__",
    "obs": "__obs__",
    "влц": "__vlc__",
    "vlc": "__vlc__",
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


def _find_vlc() -> Optional[str]:
    candidates = [
        Path(r"C:\Program Files\VideoLAN\VLC\vlc.exe"),
        Path(r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_opera() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        Path(local) / "Programs" / "Opera" / "opera.exe",
        Path(local) / "Programs" / "Opera GX" / "opera.exe",
        Path(r"C:\Program Files\Opera\opera.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_firefox() -> Optional[str]:
    candidates = [
        Path(r"C:\Program Files\Mozilla Firefox\firefox.exe"),
        Path(r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_yabrowser() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        Path(local) / "Yandex" / "YandexBrowser" / "Application" / "browser.exe",
        Path(r"C:\Program Files\Yandex\YandexBrowser\Application\browser.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_steam() -> Optional[str]:
    candidates = [
        Path(r"C:\Program Files (x86)\Steam\Steam.exe"),
        Path(r"C:\Program Files\Steam\Steam.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    # Try registry or shutil
    import shutil
    exe = shutil.which("steam")
    return exe


def _find_steam_game(appid: int, exe_names: list) -> Optional[str]:
    """Find a Steam game via common install paths or shutil.which."""
    steam_dirs = [
        Path(r"C:\Program Files (x86)\Steam\steamapps\common"),
        Path(r"C:\Program Files\Steam\steamapps\common"),
    ]
    for d in steam_dirs:
        if not d.exists():
            continue
        for name in exe_names:
            candidates = list(d.rglob(name))
            if candidates:
                return str(candidates[0])
    # Fallback: launch via Steam protocol
    return f"steam://rungameid/{appid}"


def _find_dota2() -> Optional[str]:
    return _find_steam_game(570, ["dota2.exe"])


def _find_cs2() -> Optional[str]:
    return _find_steam_game(730, ["cs2.exe"])


def _find_csgo() -> Optional[str]:
    return _find_steam_game(730, ["cs2.exe", "csgo.exe"])


def _find_minecraft() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        Path(local) / "Packages" / "Microsoft.4297127D64EC6_8wekyb3d8bbwe" / "LocalCache" / "Local" / "runtime",
        Path(os.environ.get("APPDATA", "")) / ".minecraft",
    ]
    # Check for official Minecraft Launcher
    lnk = (
        Path(os.environ.get("APPDATA", ""))
        / "Microsoft/Windows/Start Menu/Programs/Minecraft Launcher.lnk"
    )
    if lnk.exists():
        return str(lnk)
    exe = Path(local) / "Packages" / "Microsoft.MinecraftUWP_8wekyb3d8bbwe"
    if exe.exists():
        return "minecraft:"  # UWP protocol
    return None


def _find_rust_game() -> Optional[str]:
    return _find_steam_game(252490, ["RustClient.exe", "Rust.exe"])


def _find_gta5() -> Optional[str]:
    # Check Steam
    r = _find_steam_game(271590, ["GTA5.exe"])
    if r:
        return r
    # Check Epic / Rockstar
    for d in [
        Path(r"C:\Program Files\Rockstar Games\Grand Theft Auto V\GTA5.exe"),
        Path(r"C:\Program Files (x86)\Rockstar Games\Grand Theft Auto V\GTA5.exe"),
    ]:
        if d.exists():
            return str(d)
    return None


def _find_valorant() -> Optional[str]:
    candidates = [
        Path(r"C:\Riot Games\VALORANT\live\VALORANT.exe"),
        Path(r"C:\Program Files\Riot Games\VALORANT\live\VALORANT.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    # Try via Riot Client
    riot = Path(r"C:\Riot Games\Riot Client\RiotClientServices.exe")
    if riot.exists():
        return str(riot)
    return None


def _find_apex() -> Optional[str]:
    return _find_steam_game(1172470, ["r5apex.exe"])


def _find_fortnite() -> Optional[str]:
    for d in [
        Path(r"C:\Program Files\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"),
        Path(r"C:\Program Files (x86)\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"),
    ]:
        if d.exists():
            return str(d)
    return None


def _find_office(exe: str) -> Optional[str]:
    for base in [
        Path(r"C:\Program Files\Microsoft Office\root\Office16"),
        Path(r"C:\Program Files (x86)\Microsoft Office\root\Office16"),
        Path(r"C:\Program Files\Microsoft Office\Office16"),
    ]:
        candidate = base / exe
        if candidate.exists():
            return str(candidate)
    return None


def _find_word() -> Optional[str]:
    return _find_office("WINWORD.EXE")


def _find_excel() -> Optional[str]:
    return _find_office("EXCEL.EXE")


def _find_powerpoint() -> Optional[str]:
    return _find_office("POWERPNT.EXE")


def _find_viber() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    exe = Path(local) / "Viber" / "Viber.exe"
    return str(exe) if exe.exists() else None


def _find_whatsapp() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    for p in [
        Path(local) / "WhatsApp" / "WhatsApp.exe",
        Path(local) / "Programs" / "WhatsApp" / "WhatsApp.exe",
    ]:
        if p.exists():
            return str(p)
    return None


def _find_skype() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    for p in [
        Path(local) / "Microsoft" / "Skype" / "app" / "Skype.exe",
        Path(r"C:\Program Files (x86)\Microsoft\Skype for Desktop\Skype.exe"),
    ]:
        if p.exists():
            return str(p)
    return None


def _find_vk() -> Optional[str]:
    local = os.environ.get("LOCALAPPDATA", "")
    for p in [
        Path(local) / "Programs" / "VK" / "VK.exe",
        Path(local) / "VK" / "VK.exe",
    ]:
        if p.exists():
            return str(p)
    # Fallback: open in browser (not forcing open here, just return None)
    return None


def _find_overwatch() -> Optional[str]:
    candidates = [
        Path(r"C:\Program Files (x86)\Overwatch\_retail_\Overwatch.exe"),
        Path(r"C:\Program Files\Overwatch\_retail_\Overwatch.exe"),
        Path(r"C:\Program Files (x86)\Battle.net\Overwatch\Overwatch.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def _find_lol() -> Optional[str]:
    candidates = [
        Path(r"C:\Riot Games\League of Legends\LeagueClient.exe"),
        Path(r"C:\Program Files\Riot Games\League of Legends\LeagueClient.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


_SPECIAL = {
    "__discord__":    _find_discord,
    "__telegram__":   _find_telegram,
    "__vscode__":     _find_vscode,
    "__spotify__":    _find_spotify,
    "__obs__":        _find_obs,
    "__vlc__":        _find_vlc,
    "__opera__":      _find_opera,
    "__firefox__":    _find_firefox,
    "__yabrowser__":  _find_yabrowser,
    "__steam__":      _find_steam,
    "__dota2__":      _find_dota2,
    "__cs2__":        _find_cs2,
    "__csgo__":       _find_csgo,
    "__minecraft__":  _find_minecraft,
    "__rust__":       _find_rust_game,
    "__gta5__":       _find_gta5,
    "__valorant__":   _find_valorant,
    "__apex__":       _find_apex,
    "__fortnite__":   _find_fortnite,
    "__word__":       _find_word,
    "__excel__":      _find_excel,
    "__powerpoint__": _find_powerpoint,
    "__viber__":      _find_viber,
    "__whatsapp__":   _find_whatsapp,
    "__skype__":      _find_skype,
    "__vk__":         _find_vk,
    "__overwatch__":  _find_overwatch,
    "__lol__":        _find_lol,
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
            # Finder returned None — fall through to Start Menu / PATH search
        if special_key in ("calc", "notepad", "explorer"):
            subprocess.Popen([special_key + ".exe"], shell=False)
            return True
        # Regular exe name (for entries like "chrome", "msedge" that remain as-is)
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
    """Open a file/lnk/exe/URI via os.startfile or subprocess."""
    if not path:
        return False
    # Protocol URIs (steam://, minecraft:, ...) — use ShellExecute
    if "://" in path or path.endswith(":"):
        try:
            os.startfile(path)
            return True
        except Exception:
            return False
    try:
        os.startfile(path)
        return True
    except Exception:
        try:
            subprocess.Popen([path], shell=False)
            return True
        except Exception:
            return False
