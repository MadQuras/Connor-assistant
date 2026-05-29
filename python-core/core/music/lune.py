from __future__ import annotations

"""
Lune desktop music player controller.

play/pause  → WM_APPCOMMAND posted to the Lune window (Chromium handles it
              natively; no focus/privilege requirements).

next/prev   → PowerShell .ps1 helper that calls keybd_event() via C# P/Invoke.
              PowerShell.exe is a real UI-desktop process, so its keybd_event
              reaches the global input queue — unlike pythonw.exe (headless,
              background) whose SendInput/keybd_event are silently blocked by
              Windows on some systems.

The PS1 files are written once to %TEMP% on first use and re-used afterwards.
"""

import ctypes
import ctypes.wintypes
import subprocess
import tempfile
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

WM_APPCOMMAND               = 0x0319
APPCOMMAND_MEDIA_PLAY_PAUSE = 14
HWND_BROADCAST              = 0xFFFF

_user32 = ctypes.windll.user32

# ── PowerShell helper scripts ────────────────────────────────────────────────
# Template: C# class compiled once per PS session via Add-Type, calls
# keybd_event() with KEYEVENTF_EXTENDEDKEY from a proper UI process.

_PS_COMPILE = r"""
$dll = "$env:TEMP\ConnorMedia.dll"
if (!(Test-Path $dll)) {
    Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class ConnorMedia {
    [DllImport(`"user32.dll`")]
    public static extern void keybd_event(byte vk, byte scan, uint flags, int extra);
}
"@ -Language CSharp -OutputAssembly $dll
}
"""

_PS_TEMPLATE = r"""
$dll = "$env:TEMP\ConnorMedia.dll"
if (Test-Path $dll) {
    try { Add-Type -Path $dll -ErrorAction Stop } catch {}
} else {
    Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class ConnorMedia {
    [DllImport(`"user32.dll`")]
    public static extern void keybd_event(byte vk, byte scan, uint flags, int extra);
}
"@ -Language CSharp -OutputAssembly $dll -ErrorAction SilentlyContinue
    Add-Type -Path $dll
}
[ConnorMedia]::keybd_event({VK}, 0, 0x0001, 0)
[System.Threading.Thread]::Sleep(80)
[ConnorMedia]::keybd_event({VK}, 0, 0x0003, 0)
"""

_VK_NEXT  = 0xB0   # VK_MEDIA_NEXT_TRACK
_VK_PREV  = 0xB1   # VK_MEDIA_PREV_TRACK
_VK_PLAY  = 0xB3   # VK_MEDIA_PLAY_PAUSE

_TMPDIR = Path(tempfile.gettempdir())
_PS_NEXT = _TMPDIR / "connor_media_next.ps1"
_PS_PREV = _TMPDIR / "connor_media_prev.ps1"
_PS_PLAY = _TMPDIR / "connor_media_play.ps1"


_PS_PRECOMPILE = _TMPDIR / "connor_media_precompile.ps1"


def _ensure_scripts() -> None:
    """Write PS1 helpers to temp dir and pre-compile the helper DLL (idempotent)."""
    for path, vk in [(_PS_NEXT, _VK_NEXT), (_PS_PREV, _VK_PREV), (_PS_PLAY, _VK_PLAY)]:
        if not path.exists():
            path.write_text(
                _PS_TEMPLATE.replace("{VK}", hex(vk)),
                encoding="utf-8",
            )
    # Pre-compile ConnorMedia.dll so first keybd_event call is fast (~400ms not ~2s)
    dll = _TMPDIR / "ConnorMedia.dll"
    if not dll.exists() and not _PS_PRECOMPILE.exists():
        _PS_PRECOMPILE.write_text(_PS_COMPILE, encoding="utf-8")
        subprocess.Popen(
            [
                "powershell", "-NoProfile", "-NonInteractive",
                "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
                "-File", str(_PS_PRECOMPILE),
            ],
            creationflags=subprocess.CREATE_NO_WINDOW,
        )


_ensure_scripts()


def _run_ps(ps_path: Path) -> None:
    """
    Launch a PowerShell script asynchronously (fire-and-forget).
    We use Popen (non-blocking) so the VAD thread is not stalled.
    """
    try:
        subprocess.Popen(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle", "Hidden",
                "-ExecutionPolicy", "Bypass",
                "-File", str(ps_path),
            ],
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        logger.log_system(f"[Lune] PS key via {ps_path.name}")
    except Exception as exc:
        logger.log_system(f"[Lune] PS launch failed: {exc}")


# ── WM_APPCOMMAND for play/pause ─────────────────────────────────────────────

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
        logger.log_system(f"[Lune] WM_APPCOMMAND play/pause hwnd={hwnd} ret={ret}")
        if ret:
            return
    # Broadcast fallback
    _user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, lparam)
    logger.log_system("[Lune] WM_APPCOMMAND play/pause broadcast")


# ── Window helpers ────────────────────────────────────────────────────────────

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


# ─── Player class ─────────────────────────────────────────────────────────────

class LuneMusicPlayer:
    """
    Controls Lune via OS media keys.

    play/pause  → WM_APPCOMMAND (reliable for Electron/Chromium, no focus needed)
    next/prev   → PowerShell keybd_event helper (runs in a proper UI process)

    pause() and resume() both send play/pause toggle — tracking internal state
    would desync when the user manually controls Lune, so we don't bother.
    """

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

    def next_track(self) -> None:
        self.ensure_open()
        _run_ps(_PS_NEXT)

    def prev_track(self) -> None:
        self.ensure_open()
        _run_ps(_PS_PREV)

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
