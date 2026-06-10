"""
spotify.py — управление Spotify (десктоп-приложение Windows).

pause / next / prev — WM_APPCOMMAND (глобально, без фокуса на окне).
search_and_play — Ctrl+L в окне Spotify (при необходимости запускает приложение).
"""

from __future__ import annotations

import ctypes
import os
import subprocess
import time
from pathlib import Path

import pyautogui

from core import logger
from core.music.win_media import (
    APPCOMMAND_MEDIA_NEXTTRACK,
    APPCOMMAND_MEDIA_PLAY_PAUSE,
    APPCOMMAND_MEDIA_PREVIOUSTRACK,
    broadcast_media,
)

_WINDOW_HINTS = ("spotify",)


def _spotify_exe() -> Path | None:
    exe = Path(os.environ.get("APPDATA", "")) / "Spotify" / "Spotify.exe"
    return exe if exe.is_file() else None


def _paste_unicode(text: str) -> None:
    """Вставка кириллицы в поле поиска (typewrite не поддерживает Unicode)."""
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        CF_UNICODETEXT = 13
        GMEM_MOVEABLE = 0x0002

        if not user32.OpenClipboard(0):
            raise OSError("OpenClipboard failed")
        try:
            user32.EmptyClipboard()
            raw = (text + "\0").encode("utf-16-le")
            h_global = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(raw))
            if not h_global:
                raise OSError("GlobalAlloc failed")
            locked = kernel32.GlobalLock(h_global)
            ctypes.memmove(locked, raw, len(raw))
            kernel32.GlobalUnlock(h_global)
            if not user32.SetClipboardData(CF_UNICODETEXT, h_global):
                raise OSError("SetClipboardData failed")
        finally:
            user32.CloseClipboard()
        pyautogui.hotkey("ctrl", "v")
    except Exception as exc:
        logger.log_error(f"[Spotify] clipboard paste: {exc}")
        pyautogui.typewrite(text, interval=0.04)


def _type_query(query: str) -> None:
    if query.isascii():
        pyautogui.typewrite(query, interval=0.04)
    else:
        _paste_unicode(query)


class SpotifyMusicPlayer:
    supports_track_skip = True

    def _focus_window(self) -> bool:
        try:
            import pygetwindow as gw

            for w in gw.getAllWindows():
                title = (w.title or "").lower()
                if any(h in title for h in _WINDOW_HINTS):
                    w.activate()
                    time.sleep(0.45)
                    return True
        except Exception as exc:
            logger.log_error(f"[Spotify] focus_window: {exc}")
        return False

    def ensure_open(self) -> bool:
        if self._focus_window():
            return True
        exe = _spotify_exe()
        if not exe:
            logger.log_system("[Spotify] Spotify.exe не найден в %APPDATA%\\Spotify")
            return False
        try:
            subprocess.Popen([str(exe)], shell=False)
        except Exception as exc:
            logger.log_error(f"[Spotify] launch: {exc}")
            return False
        for _ in range(12):
            time.sleep(0.5)
            if self._focus_window():
                return True
        return False

    def play_pause(self) -> None:
        broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def pause(self) -> None:
        broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def resume(self) -> None:
        broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def next_track(self) -> bool:
        broadcast_media(APPCOMMAND_MEDIA_NEXTTRACK)
        return True

    def prev_track(self) -> bool:
        broadcast_media(APPCOMMAND_MEDIA_PREVIOUSTRACK)
        return True

    def search_and_play(self, query: str) -> bool:
        if not query.strip():
            return False

        if not self.ensure_open():
            try:
                from core.overlay import get_overlay

                get_overlay().show_text(
                    "Установите Spotify или откройте его вручную",
                    tag="СИСТЕМА",
                    auto_hide_ms=6000,
                )
            except Exception:
                pass
            return False

        pyautogui.hotkey("ctrl", "l")
        time.sleep(0.45)
        pyautogui.hotkey("ctrl", "a")
        time.sleep(0.1)
        _type_query(query.strip())
        time.sleep(0.35)
        pyautogui.press("enter")
        time.sleep(0.8)
        pyautogui.press("enter")
        return True
