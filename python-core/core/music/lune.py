from __future__ import annotations

"""
Lune desktop music player controller.

Media keys are sent via ctypes SendInput with KEYEVENTF_EXTENDEDKEY — the
only reliable method for VK_MEDIA_* codes (0xB0-0xB3) on Windows.

State tracking for pause/resume is intentionally removed: syncing internal
state with user-initiated play/pause is error-prone.  Both pause() and
resume() always send the toggle key and let the overlay text communicate
Connor's intent.
"""

import ctypes
import subprocess
import time
from pathlib import Path

import pyautogui
import pygetwindow as gw  # type: ignore
from core import logger

_LUNE_EXE = r"C:\Users\CompX\AppData\Local\Programs\Lune\Lune.exe"
_LUNE_LNK = (
    r"C:\Users\CompX\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Lune.lnk"
)
_LUNE_TITLE = "Lune"

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

# Windows virtual key codes for media control (all are "extended keys")
_VK_NEXT_TRACK  = 0xB0
_VK_PREV_TRACK  = 0xB1
_VK_PLAY_PAUSE  = 0xB3

# ctypes structures for SendInput
INPUT_KEYBOARD       = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP       = 0x0002


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk",         ctypes.c_ushort),
        ("wScan",       ctypes.c_ushort),
        ("dwFlags",     ctypes.c_ulong),
        ("time",        ctypes.c_ulong),
        ("dwExtraInfo", ctypes.c_ulong),
    ]


class _INPUT(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_ulong),
        ("ki",   _KEYBDINPUT),
        # pad to cover the union (INPUT is 28 bytes on 32-bit, 40 on 64-bit)
        ("_pad", ctypes.c_byte * 8),
    ]


def _make_key_input(vk: int, flags: int) -> _INPUT:
    inp = _INPUT()
    inp.type     = INPUT_KEYBOARD
    inp.ki.wVk   = vk
    inp.ki.wScan = 0
    inp.ki.dwFlags = flags
    inp.ki.time  = 0
    inp.ki.dwExtraInfo = 0
    return inp


def _media_key(vk_code: int) -> None:
    """
    Send a global media key press via ctypes SendInput (KEYEVENTF_EXTENDEDKEY).
    Media VK codes (0xB0-0xB3) require the extended-key flag to be recognised
    by SMTC-connected apps like Lune on modern Windows.
    Falls back to pyautogui if ctypes fails.
    """
    try:
        down = _make_key_input(vk_code, KEYEVENTF_EXTENDEDKEY)
        up   = _make_key_input(vk_code, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP)
        user32 = ctypes.windll.user32
        sent_d = user32.SendInput(1, ctypes.byref(down), ctypes.sizeof(_INPUT))
        time.sleep(0.08)
        sent_u = user32.SendInput(1, ctypes.byref(up),   ctypes.sizeof(_INPUT))
        logger.log_system(f"[Lune] SendInput vk={hex(vk_code)} down={sent_d} up={sent_u}")
        if sent_d == 0 or sent_u == 0:
            raise RuntimeError("SendInput returned 0")
    except Exception as exc:
        logger.log_system(f"[Lune] SendInput failed ({exc}), falling back to pyautogui")
        _key_map = {
            _VK_NEXT_TRACK: "nexttrack",
            _VK_PREV_TRACK: "prevtrack",
            _VK_PLAY_PAUSE: "playpause",
        }
        try:
            pyautogui.press(_key_map.get(vk_code, "playpause"))
        except Exception as exc2:
            logger.log_system(f"[Lune] pyautogui fallback also failed: {exc2}")


# ─── Window helpers ───────────────────────────────────────────────────────────

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


# ─── Player class ────────────────────────────────────────────────────────────

class LuneMusicPlayer:
    """
    Controls Lune via OS media keys.

    pause() and resume() both send the play/pause toggle — we don't track
    internal state because user-initiated changes in Lune would desync it.
    The overlay text communicates Connor's intent; the actual effect depends
    on Lune's current state, which is the same behaviour as physical media keys.
    """

    def ensure_open(self) -> bool:
        if _is_running():
            return True
        return _launch()

    def play_pause(self) -> None:
        """Toggle play/pause (used by open-music command)."""
        self.ensure_open()
        _media_key(_VK_PLAY_PAUSE)

    def pause(self) -> None:
        """Send play/pause key (pauses if playing, resumes if already paused)."""
        self.ensure_open()
        _media_key(_VK_PLAY_PAUSE)

    def resume(self) -> None:
        """Send play/pause key (resumes if paused, pauses if already playing)."""
        self.ensure_open()
        _media_key(_VK_PLAY_PAUSE)

    def next_track(self) -> None:
        self.ensure_open()
        _media_key(_VK_NEXT_TRACK)

    def prev_track(self) -> None:
        self.ensure_open()
        _media_key(_VK_PREV_TRACK)

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
