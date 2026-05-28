from __future__ import annotations

"""
Lune desktop music player controller.
Lune is an Electron/Chromium app — we control it via:
  - subprocess.Popen to launch it (if not running)
  - pyautogui media keys for play/pause, next, prev
  - pygetwindow + pyautogui for search (Ctrl+K / Ctrl+F)
"""

import subprocess
import time
from pathlib import Path

import pyautogui
import pygetwindow as gw  # type: ignore

_LUNE_EXE = r"C:\Users\CompX\AppData\Local\Programs\Lune\Lune.exe"
_LUNE_LNK = (
    r"C:\Users\CompX\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Lune.lnk"
)

# Window title substring that identifies a Lune window
_LUNE_TITLE = "Lune"

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05


def _is_running() -> bool:
    """Return True if a Lune window is visible."""
    try:
        wins = gw.getWindowsWithTitle(_LUNE_TITLE)
        return any(w.title for w in wins)
    except Exception:
        return False


def _launch() -> bool:
    """Launch Lune and wait up to 5 s for its window to appear."""
    exe = Path(_LUNE_EXE)
    if not exe.exists():
        # Fallback: open via shortcut
        subprocess.Popen(["cmd", "/c", "start", "", _LUNE_LNK], shell=False)
    else:
        subprocess.Popen([str(exe)])

    deadline = time.time() + 5.0
    while time.time() < deadline:
        time.sleep(0.3)
        if _is_running():
            return True
    return False


def _focus() -> bool:
    """Bring Lune window to foreground. Returns True on success."""
    try:
        wins = gw.getWindowsWithTitle(_LUNE_TITLE)
        for w in wins:
            if w.title:
                w.activate()
                time.sleep(0.2)
                return True
    except Exception:
        pass
    return False


class LuneMusicPlayer:
    """Controls Lune via OS media keys and window activation."""

    def ensure_open(self) -> bool:
        if _is_running():
            return True
        return _launch()

    def play_pause(self) -> None:
        self.ensure_open()
        pyautogui.press("playpause")

    def next_track(self) -> None:
        self.ensure_open()
        pyautogui.press("nexttrack")

    def prev_track(self) -> None:
        self.ensure_open()
        pyautogui.press("prevtrack")

    def search_and_play(self, query: str) -> bool:
        """
        Open Lune, focus it, open search with Ctrl+K, type query, press Enter.
        Lune uses Ctrl+K as its universal search shortcut (common in Electron music apps).
        Falls back to Ctrl+F if the first shortcut doesn't open a field within 1 s.
        """
        if not self.ensure_open():
            return False

        time.sleep(0.3)
        _focus()
        time.sleep(0.3)

        # Open search
        pyautogui.hotkey("ctrl", "k")
        time.sleep(0.8)

        # Type query and submit
        pyautogui.typewrite(query, interval=0.04)
        time.sleep(0.3)
        pyautogui.press("enter")
        time.sleep(0.5)
        return True
