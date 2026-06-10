"""Системные медиа-клавиши Windows (WM_APPCOMMAND)."""

from __future__ import annotations

import ctypes

from core import logger

APPCOMMAND_MEDIA_PLAY_PAUSE = 14
APPCOMMAND_MEDIA_NEXTTRACK = 11
APPCOMMAND_MEDIA_PREVIOUSTRACK = 12

HWND_BROADCAST = 0xFFFF


def broadcast_media(appcommand: int) -> None:
    try:
        ctypes.windll.user32.SendNotifyMessageW(
            HWND_BROADCAST,
            0x0319,
            0,
            appcommand << 16,
        )
    except Exception as exc:
        logger.log_error(f"[WinMedia] WM_APPCOMMAND failed: {exc}")
