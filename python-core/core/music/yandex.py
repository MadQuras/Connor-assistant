"""
yandex.py — управление Яндекс Музыкой (десктоп-приложение или браузерная вкладка).

pause() / resume() / next_track() / prev_track():
  Используют WM_APPCOMMAND broadcast — работают без фокуса на конкретном окне
  и НЕ открывают браузер.

search_and_play():
  Работает только если окно Яндекс Музыки уже открыто.  Если нет —
  показывает overlay-подсказку и возвращает False (браузер не открывает).
"""

from __future__ import annotations

import ctypes
import time

import pyautogui

from core import logger
from core.ocr.find_click import find_text_click_point

WINDOW_HINTS = ("yandex", "яндекс", "music.yandex", "музыка", "яндекс музыка")

# WM_APPCOMMAND constants
WM_APPCOMMAND = 0x0319
APPCOMMAND_MEDIA_PLAY_PAUSE = 14
APPCOMMAND_MEDIA_NEXTTRACK  = 11
APPCOMMAND_MEDIA_PREVIOUSTRACK = 12

HWND_BROADCAST = 0xFFFF


def _broadcast_media(appcommand: int) -> None:
    """Broadcast WM_APPCOMMAND to all top-level windows.

    Uses SendNotifyMessageW (not SendMessageW) so the call returns immediately
    without waiting for every window to process the message.  SendMessageW with
    HWND_BROADCAST blocks until ALL windows reply, which can take 10-30 s when
    any window is busy — freezing the STT dispatch thread and filling the queue.
    """
    try:
        ctypes.windll.user32.SendNotifyMessageW(
            HWND_BROADCAST,
            WM_APPCOMMAND,
            0,
            appcommand << 16,
        )
    except Exception as exc:
        logger.log_error(f"[YandexMusic] WM_APPCOMMAND broadcast failed: {exc}")


class YandexMusicPlayer:
    supports_track_skip = True

    def _focus_window(self) -> bool:
        """Try to bring a Yandex Music window to the foreground.

        Returns True if found and activated.  Does NOT open a new window.
        """
        try:
            import pygetwindow as gw

            for w in gw.getAllWindows():
                title = (w.title or "").lower()
                if any(h in title for h in WINDOW_HINTS):
                    w.activate()
                    time.sleep(0.4)
                    return True
        except Exception as exc:
            logger.log_error(f"[YandexMusic] focus_window: {exc}")
        return False

    # ── Playback control — no browser, no ensure_open ─────────────────────────

    def play_pause(self) -> None:
        _broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def pause(self) -> None:
        _broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def resume(self) -> None:
        _broadcast_media(APPCOMMAND_MEDIA_PLAY_PAUSE)

    def next_track(self) -> bool:
        _broadcast_media(APPCOMMAND_MEDIA_NEXTTRACK)
        return True

    def prev_track(self) -> bool:
        _broadcast_media(APPCOMMAND_MEDIA_PREVIOUSTRACK)
        return True

    # ── Search — only within already-open window ──────────────────────────────

    def search_and_play(self, query: str) -> bool:
        if not query.strip():
            return False

        if not self._focus_window():
            logger.log_system(
                "[YandexMusic] search_and_play: окно не найдено — браузер не открываем"
            )
            try:
                from core.overlay import get_overlay
                get_overlay().show_text(
                    "Откройте Яндекс Музыку, затем повторите команду",
                    tag="СИСТЕМА",
                    auto_hide_ms=6000,
                )
            except Exception:
                pass
            return False

        # Yandex Music desktop app — Ctrl+F opens search bar
        pyautogui.hotkey("ctrl", "f")
        time.sleep(0.4)
        pyautogui.typewrite(query, interval=0.04)
        time.sleep(0.3)
        pyautogui.press("enter")
        time.sleep(1.0)

        # Try to click the first "play" result via OCR; fall back to Enter
        pt = find_text_click_point("слушать", "play", "воспроиз", "трек")
        if pt:
            pyautogui.click(pt[0], pt[1])
        else:
            pyautogui.press("enter")

        return True
