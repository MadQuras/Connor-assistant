from __future__ import annotations

from core import audio_catalog
from core import logger
from core.overlay import get_overlay


def _change_volume(direction: str) -> int:
    """
    Try pycaw first (precise Windows COM volume control).
    Fall back to simulated media keys via pyautogui if pycaw fails.
    Returns new volume percent (or -1 if unknown after fallback).
    """
    delta = 0.1 if direction == "up" else -0.1
    try:
        from core.system.volume_control import set_volume_relative
        return set_volume_relative(delta)
    except Exception as e:
        logger.log_error(f"pycaw volume failed: {e} — using key fallback")

    # Key fallback: 5 taps = ~5 steps on most Windows setups
    try:
        import pyautogui
        key = "volumeup" if direction == "up" else "volumedown"
        for _ in range(5):
            pyautogui.press(key)
    except Exception as e2:
        logger.log_error(f"key volume fallback failed: {e2}")
    return -1


def _set_volume_pct(percent: int) -> None:
    try:
        from core.system.volume_control import set_volume_percent
        set_volume_percent(percent)
    except Exception as e:
        logger.log_error(f"pycaw set_volume_percent failed: {e}")


def handle(arg: str, original_text: str = "") -> None:
    ov = get_overlay()
    # arg comes from router as "up" / "down" / a number string
    # original_text has the raw user phrase ("тише", "громче", "убавь" etc.)
    raw = (original_text or arg or "").lower().strip()
    arg_low = (arg or "").lower().strip()

    if arg_low.isdigit():
        pct = int(arg_low)
        _set_volume_pct(pct)
        ov.show_text(f"Громкость установлена: {pct}%", tag="КОННОР", auto_hide_ms=6000)
        audio_catalog.play_key("volume")
        return

    direction = "up"
    if arg_low in ("down", "тише") or any(x in raw for x in ("тише", "убавь", "уменьш", "потише")):
        direction = "down"
    elif arg_low in ("up", "громче") or any(x in raw for x in ("громче", "прибавь", "увеличь", "погромче")):
        direction = "up"

    pct = _change_volume(direction)
    label = "Громче" if direction == "up" else "Тише"
    if pct >= 0:
        ov.show_text(f"{label} — {pct}%", tag="КОННОР", auto_hide_ms=5000)
    else:
        ov.show_text(label, tag="КОННОР", auto_hide_ms=5000)
    audio_catalog.play_key("volume")
