"""
tts_engine.py — озвучка реплик Коннора (Camb.ai / без TTS).

Pre-recorded WAV для команд — по-прежнему audio_catalog + tts_player.
Здесь только синтез текста от Gemma / чата.
"""

from __future__ import annotations

import threading
from typing import Optional

from core import logger
from core.config_loader import load_config


def tts_enabled() -> bool:
    cfg = load_config()
    if not cfg.get("use_camb_tts", False):
        return False
    backend = (cfg.get("tts_backend") or "camb").strip().lower()
    return backend in ("camb", "both")


def speak_text(text: str, *, block: bool = False) -> bool:
    """Озвучить текст. True если воспроизведено."""
    if not text or not str(text).strip():
        return False
    if not tts_enabled():
        return False

    from core import camb_tts
    if camb_tts.speak(text, block=block):
        return True

    backend = (load_config().get("tts_backend") or "camb").strip().lower()
    if backend == "both":
        logger.log_system("[TTS] Camb недоступен, fallback wav — только для клипов")
    return False


def speak_text_async(text: str) -> None:
    """Фоновое воспроизведение — не блокирует pipeline."""

    def _run() -> None:
        speak_text(text, block=True)

    threading.Thread(target=_run, name="connor-tts", daemon=True).start()


def verify_camb() -> dict:
    """Проверка Camb API (короткая фраза)."""
    from core import camb_tts

    from core.camb_voice_clone import load_connor_voice_meta, resolve_voice_id

    cfg = load_config()
    meta = load_connor_voice_meta() or {}
    result = {
        "ok": False,
        "configured": camb_tts.is_configured(),
        "voice_id": resolve_voice_id(cfg),
        "voice_name": cfg.get("camb_voice_name") or meta.get("voice_name"),
        "language": cfg.get("camb_language", "ru-ru"),
        "error": None,
        "cache_file": None,
    }
    if not result["configured"]:
        result["error"] = "camb_api_key не задан"
        return result

    path = camb_tts.synthesize(
        "Коннор на связи, лейтенант.",
        use_cache=True,
    )
    if path:
        result["ok"] = True
        result["cache_file"] = str(path)
    else:
        result["error"] = "синтез не удался — проверьте ключ и voice_id"
    return result
