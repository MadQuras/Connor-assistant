from __future__ import annotations

"""
Lune desktop music player controller.

KEY INSIGHT (from reading Lune's source code):
  - Lune does NOT register globalShortcut for media keys
  - Lune does NOT use navigator.mediaSession for next/prev
  - The ONLY way to trigger next/prev is via Electron IPC 'tray-action'

STRATEGY:
  play/pause  → WM_APPCOMMAND (Chromium handles it natively for <audio> elements)
  next/prev   → Chrome DevTools Protocol (CDP): find and click the button in DOM

Lune must be launched with --remote-debugging-port=9222.
If it's already running without that flag, we kill it and relaunch.
"""

import ctypes
import ctypes.wintypes
import json
import subprocess
import time
from pathlib import Path

import pyautogui
import pygetwindow as gw  # type: ignore
import requests
import websocket  # type: ignore  (websocket-client)
from core import logger

_LUNE_EXE = r"C:\Users\CompX\AppData\Local\Programs\Lune\Lune.exe"
_LUNE_LNK = (
    r"C:\Users\CompX\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Lune.lnk"
)
_LUNE_TITLE = "Lune"
_CDP_PORT   = 9222

pyautogui.FAILSAFE = False
pyautogui.PAUSE    = 0.05

WM_APPCOMMAND               = 0x0319
APPCOMMAND_MEDIA_PLAY_PAUSE = 14
HWND_BROADCAST              = 0xFFFF

_user32 = ctypes.windll.user32

# JavaScript executed in Lune's renderer to trigger next/prev.
# Tries several strategies: title attr → aria-label → positional fallback
_JS_CLICK = """
(function(action) {
  // 1. Try by title attribute (if Lune adds them)
  var sel = action === 'next'
    ? '[title*="Next"],[title*="next"],[title*="Следующий"],[aria-label*="next"],[aria-label*="Next"]'
    : '[title*="Prev"],[title*="prev"],[title*="Previous"],[title*="Предыдущий"],[aria-label*="prev"],[aria-label*="Prev"]';
  var btn = document.querySelector(sel);
  if (btn) { btn.click(); return 'by-attr'; }

  // 2. Positional: player control buttons are ordered
  //    [shuffle][prev][play/pause][next][loop]
  //    Find them by looking for the biggest cluster of sibling buttons
  var allBtns = Array.from(document.querySelectorAll('button'));
  // Find play/pause by checking which button has two different SVG states
  // (it's the tallest/widest control button in the cluster)
  // Instead: walk from the play/pause area.
  // The play/pause button is near center; find it by looking at button widths.
  // Heuristic: sort by vertical position (bottom of page = player bar),
  // then find groups of 5 consecutive buttons.
  var byY = allBtns
    .map(function(b) { var r = b.getBoundingClientRect(); return {b:b, y:r.top, x:r.left}; })
    .filter(function(o) { return o.y > window.innerHeight * 0.7; }) // bottom 30%
    .sort(function(a,b) { return a.x - b.x; });

  if (byY.length >= 4) {
    // Heuristic: prev is index 1, next is index 3 in the bottom row
    var idx = action === 'next' ? 3 : 1;
    if (byY[idx]) { byY[idx].b.click(); return 'by-pos-' + idx; }
  }
  return 'not-found';
})('{ACTION}')
"""


# ── CDP helpers ────────────────────────────────────────────────────────────────

def _cdp_available() -> bool:
    try:
        requests.get(f"http://localhost:{_CDP_PORT}/json", timeout=1)
        return True
    except Exception:
        return False


def _cdp_eval(js: str) -> str | None:
    """Execute JS in Lune's renderer. Returns result as string or None on error."""
    try:
        resp = requests.get(f"http://localhost:{_CDP_PORT}/json", timeout=2)
        targets = resp.json()
        page = next((t for t in targets if t.get("type") == "page"), None)
        if not page:
            logger.log_system("[Lune] CDP: no page target found")
            return None
        ws_url = page["webSocketDebuggerUrl"]
        ws = websocket.create_connection(ws_url, timeout=3)
        ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": js, "returnByValue": True},
        }))
        raw = ws.recv()
        ws.close()
        result = json.loads(raw)
        val = result.get("result", {}).get("result", {}).get("value")
        logger.log_system(f"[Lune] CDP eval result: {val!r}")
        return str(val) if val is not None else None
    except Exception as exc:
        logger.log_system(f"[Lune] CDP error: {exc}")
        return None


def _cdp_action(action: str) -> bool:
    """Trigger 'next' or 'previous' in Lune via CDP DOM click."""
    js = _JS_CLICK.replace("{ACTION}", action)
    result = _cdp_eval(js)
    return result is not None and result != "not-found"


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
    _user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, lparam)
    logger.log_system("[Lune] WM_APPCOMMAND play/pause broadcast")


# ── Window helpers ────────────────────────────────────────────────────────────

def _kill_lune() -> None:
    """Kill Lune process(es) by name."""
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", "Lune.exe"],
            capture_output=True, timeout=5,
        )
        time.sleep(0.5)
    except Exception:
        pass


def _is_running() -> bool:
    try:
        wins = gw.getWindowsWithTitle(_LUNE_TITLE)
        return any(w.title for w in wins)
    except Exception:
        return False


def _launch(with_cdp: bool = True) -> bool:
    """Launch Lune, optionally with Chrome remote debugging enabled."""
    exe = Path(_LUNE_EXE)
    cdp_flag = f"--remote-debugging-port={_CDP_PORT}"

    if exe.exists():
        cmd = [str(exe), cdp_flag] if with_cdp else [str(exe)]
        subprocess.Popen(cmd)
    else:
        # .lnk launch can't pass flags — launch exe directly from the LNK target
        subprocess.Popen(["cmd", "/c", "start", "", _LUNE_LNK], shell=False)
        with_cdp = False  # can't guarantee CDP when using .lnk

    deadline = time.time() + 6.0
    while time.time() < deadline:
        time.sleep(0.4)
        if _is_running():
            if with_cdp:
                time.sleep(1.0)  # allow Electron to start debug server
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
    Controls Lune via the two available external mechanisms:

    play/pause  → WM_APPCOMMAND (Chromium built-in <audio> control)
    next/prev   → Chrome DevTools Protocol, executing JS to click the DOM button

    Lune is launched with --remote-debugging-port=9222 so CDP is available.
    If Lune is already running without that flag, it is restarted.
    """

    def ensure_open(self) -> bool:
        if _is_running():
            if not _cdp_available():
                # Lune is running but without CDP — restart it
                logger.log_system("[Lune] restarting with --remote-debugging-port")
                _kill_lune()
                time.sleep(0.8)
                return _launch(with_cdp=True)
            return True
        return _launch(with_cdp=True)

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
        if not _cdp_action("next"):
            logger.log_system("[Lune] CDP next failed — no button found")

    def prev_track(self) -> None:
        self.ensure_open()
        if not _cdp_action("prev"):
            logger.log_system("[Lune] CDP prev failed — no button found")

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
