from __future__ import annotations

"""
Lune desktop music player controller.

Media commands are sent via WM_APPCOMMAND — a dedicated Windows message
for media control that Electron/Chromium handles natively regardless of
window focus or privilege level.  SendInput / keybd_event require the
target window to be in the foreground and can fail under UIPI; WM_APPCOMMAND
does not have these restrictions.

Strategy (three layers, first success wins):
  1. PostMessage WM_APPCOMMAND to the Lune window directly
  2. SendMessage WM_APPCOMMAND broadcast (HWND_BROADCAST)
  3. pyautogui media key (last resort)
"""

import ctypes
import ctypes.wintypes
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

# WM_APPCOMMAND codes for media control
WM_APPCOMMAND            = 0x0319
APPCOMMAND_MEDIA_NEXTTRACK    = 11
APPCOMMAND_MEDIA_PREVIOUSTRACK = 12
APPCOMMAND_MEDIA_PLAY_PAUSE   = 14
HWND_BROADCAST           = 0xFFFF

_user32 = ctypes.windll.user32


def _find_lune_hwnd() -> int:
    """Return the HWND of the first Lune window, or 0 if not found."""
    found: list[int] = []

    EnumWindowsProc = ctypes.WINFUNCTYPE(
        ctypes.wintypes.BOOL,
        ctypes.wintypes.HWND,
        ctypes.wintypes.LPARAM,
    )

    def _cb(hwnd: int, _: int) -> bool:
        buf = ctypes.create_unicode_buffer(256)
        _user32.GetWindowTextW(hwnd, buf, 256)
        if _LUNE_TITLE in buf.value:
            found.append(hwnd)
        return True

    _user32.EnumWindows(EnumWindowsProc(_cb), 0)
    return found[0] if found else 0


def _send_appcommand(cmd: int) -> None:
    """
    Send WM_APPCOMMAND to Lune's window directly, then fall back to broadcast,
    then pyautogui.  Logs result so we can diagnose from logs.jsonl.
    """
    _KEY_FALLBACK = {
        APPCOMMAND_MEDIA_NEXTTRACK:     "nexttrack",
        APPCOMMAND_MEDIA_PREVIOUSTRACK: "prevtrack",
        APPCOMMAND_MEDIA_PLAY_PAUSE:    "playpause",
    }
    lparam = cmd << 16

    # Layer 1 — post directly to Lune window
    hwnd = _find_lune_hwnd()
    if hwnd:
        ret = _user32.PostMessageW(hwnd, WM_APPCOMMAND, hwnd, lparam)
        logger.log_system(f"[Lune] PostMessage cmd={cmd} hwnd={hwnd} ret={ret}")
        if ret:
            return

    # Layer 2 — broadcast
    ret2 = _user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, lparam)
    logger.log_system(f"[Lune] Broadcast WM_APPCOMMAND cmd={cmd} ret={ret2}")
    if ret2:
        return

    # Layer 3 — pyautogui (physical key simulation)
    key = _KEY_FALLBACK.get(cmd, "playpause")
    logger.log_system(f"[Lune] pyautogui fallback key={key!r}")
    try:
        pyautogui.press(key)
    except Exception as exc:
        logger.log_system(f"[Lune] pyautogui also failed: {exc}")


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
        self.ensure_open()
        _send_appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def pause(self) -> None:
        self.ensure_open()
        _send_appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def resume(self) -> None:
        self.ensure_open()
        _send_appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def next_track(self) -> None:
        self.ensure_open()
        _send_appcommand(APPCOMMAND_MEDIA_NEXTTRACK)

    def prev_track(self) -> None:
        self.ensure_open()
        _send_appcommand(APPCOMMAND_MEDIA_PREVIOUSTRACK)

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
