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

# WM_APPCOMMAND — used for play/pause (Lune handles this natively via Chromium)
WM_APPCOMMAND                  = 0x0319
APPCOMMAND_MEDIA_PLAY_PAUSE    = 14
APPCOMMAND_MEDIA_NEXTTRACK     = 11
APPCOMMAND_MEDIA_PREVIOUSTRACK = 12
HWND_BROADCAST                 = 0xFFFF

# SendInput — used for next/prev (Lune registers them as globalShortcut → WM_HOTKEY)
INPUT_KEYBOARD        = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP       = 0x0002
VK_MEDIA_NEXT_TRACK   = 0xB0
VK_MEDIA_PREV_TRACK   = 0xB1

_user32 = ctypes.windll.user32


# ── Correct INPUT structure (64-bit Windows, sizeof = 40) ────────────────────

class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk",         ctypes.c_ushort),
        ("wScan",       ctypes.c_ushort),
        ("dwFlags",     ctypes.c_ulong),
        ("time",        ctypes.c_ulong),
        ("dwExtraInfo", ctypes.c_void_p),  # ULONG_PTR: 8 bytes on 64-bit
    ]


class _INPUT_UNION(ctypes.Union):
    _fields_ = [
        ("ki",  _KEYBDINPUT),
        ("_mi", ctypes.c_byte * 32),  # pad to MOUSEINPUT size (largest member)
    ]


class _INPUT(ctypes.Structure):
    _fields_ = [
        ("type",   ctypes.c_ulong),
        ("_input", _INPUT_UNION),
    ]
    # On 64-bit: sizeof = 4 (type) + 4 (align pad) + 32 (union) = 40 bytes ✓


def _send_input_key(vk: int) -> bool:
    """
    Simulate a media key press via SendInput.
    Returns True if at least the key-down was accepted.
    """
    down = _INPUT()
    down.type = INPUT_KEYBOARD
    down.ki.wVk = vk
    down.ki.dwFlags = KEYEVENTF_EXTENDEDKEY

    up = _INPUT()
    up.type = INPUT_KEYBOARD
    up.ki.wVk = vk
    up.ki.dwFlags = KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP

    sz = ctypes.sizeof(_INPUT)
    r1 = _user32.SendInput(1, ctypes.byref(down), sz)
    time.sleep(0.08)
    r2 = _user32.SendInput(1, ctypes.byref(up), sz)
    err = ctypes.get_last_error()
    logger.log_system(f"[Lune] SendInput vk={hex(vk)} sz={sz} r1={r1} r2={r2} err={err}")
    return r1 > 0


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


def _appcommand(cmd: int) -> None:
    """WM_APPCOMMAND — reliable for play/pause in Electron/Chromium."""
    hwnd = _find_lune_hwnd()
    lparam = cmd << 16
    if hwnd:
        ret = _user32.PostMessageW(hwnd, WM_APPCOMMAND, hwnd, lparam)
        logger.log_system(f"[Lune] PostMessage cmd={cmd} hwnd={hwnd} ret={ret}")
        if ret:
            return
    ret2 = _user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, lparam)
    logger.log_system(f"[Lune] Broadcast cmd={cmd} ret={ret2}")


def _nav_key(vk: int, pg_name: str) -> None:
    """
    Next/prev track: SendInput (triggers globalShortcut/WM_HOTKEY in Lune).
    Falls back to WM_APPCOMMAND then pyautogui if SendInput is blocked.
    """
    if _send_input_key(vk):
        return
    # SendInput blocked (UIPI?) — try WM_APPCOMMAND for the nav command
    cmd = APPCOMMAND_MEDIA_NEXTTRACK if vk == VK_MEDIA_NEXT_TRACK else APPCOMMAND_MEDIA_PREVIOUSTRACK
    _appcommand(cmd)
    # Last resort: pyautogui
    logger.log_system(f"[Lune] pyautogui fallback key={pg_name!r}")
    try:
        pyautogui.press(pg_name)
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
        _appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def pause(self) -> None:
        self.ensure_open()
        _appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def resume(self) -> None:
        self.ensure_open()
        _appcommand(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def next_track(self) -> None:
        self.ensure_open()
        _nav_key(VK_MEDIA_NEXT_TRACK, "nexttrack")

    def prev_track(self) -> None:
        self.ensure_open()
        _nav_key(VK_MEDIA_PREV_TRACK, "prevtrack")

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
