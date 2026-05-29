from __future__ import annotations

"""
Lune desktop music player controller.
Lune is an Electron/Chromium app — we control it via:
  - subprocess.Popen to launch it
  - win32api.keybd_event for media keys (more reliable than pyautogui.press)
  - Internal _playing state so pause/resume work independently
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
_LUNE_TITLE = "Lune"

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

# Windows virtual key codes for media control
_VK_NEXT_TRACK  = 0xB0
_VK_PREV_TRACK  = 0xB1
_VK_PLAY_PAUSE  = 0xB3


def _media_key(vk_code: int) -> None:
    """Send a media key via win32api (more reliable than pyautogui for global keys)."""
    try:
        import win32api, win32con
        win32api.keybd_event(vk_code, 0, 0, 0)
        time.sleep(0.05)
        win32api.keybd_event(vk_code, 0, win32con.KEYEVENTF_KEYUP, 0)
    except Exception:
        # Fallback: pyautogui (may not work for all apps but better than nothing)
        key_map = {
            _VK_NEXT_TRACK: "nexttrack",
            _VK_PREV_TRACK: "prevtrack",
            _VK_PLAY_PAUSE: "playpause",
        }
        pyautogui.press(key_map.get(vk_code, "playpause"))


def _is_running() -> bool:
    try:
        wins = gw.getWindowsWithTitle(_LUNE_TITLE)
        return any(w.title for w in wins)
    except Exception:
        return False


def _launch() -> bool:
    exe = Path(_LUNE_EXE)
    if not exe.exists():
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

    # Class-level state: assume playing when Lune is open.
    # Tracks what WE sent so pause/resume don't toggle back.
    _playing: bool = True

    def ensure_open(self) -> bool:
        if _is_running():
            return True
        launched = _launch()
        if launched:
            # Mark as playing since Lune resumes last track on open
            LuneMusicPlayer._playing = True
        return launched

    def play_pause(self) -> None:
        """Toggle — used for generic open-music command."""
        self.ensure_open()
        _media_key(_VK_PLAY_PAUSE)
        LuneMusicPlayer._playing = not LuneMusicPlayer._playing

    def pause(self) -> None:
        """Only pause if we believe music is currently playing."""
        self.ensure_open()
        if LuneMusicPlayer._playing:
            _media_key(_VK_PLAY_PAUSE)
            LuneMusicPlayer._playing = False

    def resume(self) -> None:
        """Only resume if we believe music is currently paused."""
        self.ensure_open()
        if not LuneMusicPlayer._playing:
            _media_key(_VK_PLAY_PAUSE)
            LuneMusicPlayer._playing = True

    def next_track(self) -> None:
        self.ensure_open()
        _media_key(_VK_NEXT_TRACK)
        LuneMusicPlayer._playing = True  # playing continues after skip

    def prev_track(self) -> None:
        self.ensure_open()
        _media_key(_VK_PREV_TRACK)
        LuneMusicPlayer._playing = True

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
        LuneMusicPlayer._playing = True
        return True
