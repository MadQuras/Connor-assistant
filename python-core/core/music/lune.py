from __future__ import annotations

"""
Lune desktop music player — minimal external control.

What works reliably:
  play / pause / resume  → WM_APPCOMMAND to Lune window (Chromium <audio>)

What does NOT work (Lune ignores OS media keys and has no SMTC):
  next / previous track  → not supported; use music_backend=yandex in config.json
"""

import ctypes
import ctypes.wintypes
import os
import subprocess
import time
from pathlib import Path

import pyautogui
import pygetwindow as gw  # type: ignore
from core import logger

_LOCALAPPDATA = os.environ.get("LOCALAPPDATA", "")
_APPDATA = os.environ.get("APPDATA", "")

_LUNE_EXE = os.path.join(_LOCALAPPDATA, "Programs", "Lune", "Lune.exe")
_LUNE_LNK = os.path.join(
    _APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Lune.lnk"
)
_LUNE_TITLE = "Lune"

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

WM_APPCOMMAND = 0x0319
APPCOMMAND_MEDIA_PLAY_PAUSE = 14
HWND_BROADCAST = 0xFFFF

_user32 = ctypes.windll.user32


def _find_lune_hwnd() -> int:
    found: list[int] = []
    EnumWindowsProc = ctypes.WINFUNCTYPE(
        ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM,
    )

    def _cb(hwnd: int, _: int) -> bool:
        buf = ctypes.create_unicode_buffer(256)
        _user32.GetWindowTextW(hwnd, buf, 256)
        if _LUNE_TITLE in buf.value:
            found.append(hwnd)
        return True

    _user32.EnumWindows(EnumWindowsProc(_cb), 0)
    return found[0] if found else 0


def _appcommand_play_pause() -> None:
    hwnd = _find_lune_hwnd()
    lparam = APPCOMMAND_MEDIA_PLAY_PAUSE << 16
    if hwnd:
        ret = _user32.PostMessageW(hwnd, WM_APPCOMMAND, hwnd, lparam)
        logger.log_system(f"[Lune] play/pause hwnd={hwnd} ret={ret}")
        if ret:
            return
    _user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, lparam)
    logger.log_system("[Lune] play/pause broadcast")


def _is_running() -> bool:
    try:
        return any(w.title for w in gw.getWindowsWithTitle(_LUNE_TITLE))
    except Exception:
        return False


def _launch() -> bool:
    exe = Path(_LUNE_EXE)
    if exe.exists():
        subprocess.Popen([str(exe)])
    elif Path(_LUNE_LNK).exists():
        subprocess.Popen(["cmd", "/c", "start", "", _LUNE_LNK], shell=False)
    else:
        logger.log_system("[Lune] не найден — установите Lune или укажите music_backend=yandex")
        return False

    deadline = time.time() + 6.0
    while time.time() < deadline:
        time.sleep(0.4)
        if _is_running():
            return True
    return False


def _focus() -> bool:
    try:
        for w in gw.getWindowsWithTitle(_LUNE_TITLE):
            if w.title:
                w.activate()
                time.sleep(0.2)
                return True
    except Exception:
        pass
    return False


class LuneMusicPlayer:
    """Lune: open, search, play/pause only."""

    supports_track_skip = False

    def ensure_open(self) -> bool:
        if _is_running():
            return True
        return _launch()

    def play_pause(self) -> None:
        self.ensure_open()
        _appcommand_play_pause()

    def pause(self) -> None:
        self.ensure_open()
        _appcommand_play_pause()

    def resume(self) -> None:
        self.ensure_open()
        _appcommand_play_pause()

    def next_track(self) -> bool:
        logger.log_system(
            "[Lune] следующий трек недоступен — Lune не реагирует на системные команды. "
            "В config.json установите music_backend: yandex для переключения треков."
        )
        return False

    def prev_track(self) -> bool:
        logger.log_system(
            "[Lune] предыдущий трек недоступен — см. music_backend: yandex в config.json"
        )
        return False

    def search_and_play(self, query: str) -> bool:
        if not self.ensure_open():
            return False
        time.sleep(0.3)
        _focus()
        time.sleep(0.3)
        pyautogui.hotkey("ctrl", "k")
        time.sleep(0.8)
        pyautogui.typewrite(query, interval=0.04)
        time.sleep(0.3)
        pyautogui.press("enter")
        time.sleep(0.5)
        return True
