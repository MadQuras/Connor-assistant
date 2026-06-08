"""
connor_ui.py — единое текстовое окно Коннора (левая панель, tag КОННОР).

Весь вывод Gemma / LLM-ответов идёт сюда; технические теги (СВОДКА, ПАМЯТЬ…) не используются.
"""

from __future__ import annotations

import threading
from typing import Optional

from core.config_loader import load_config
from core.overlay import get_overlay
from openjarvis.connor_prompts import sanitize_connor_reply

CONNOR_TAG = "КОННОР"
DEFAULT_HIDE_MS = 7000


def connor_llm_active() -> bool:
    """Локальный Ollama — ответы через Gemma, без дублирующих overlay в handlers."""
    return (load_config().get("llm_backend") or "gemini").strip().lower() == "ollama"


def _panel_hide_ms(fallback_ms: int) -> int:
    cfg = load_config()
    return int(cfg.get("connor_panel_hide_ms", fallback_ms))


def _show_with_tts(clean: str, auto_hide_ms: int) -> None:
    """Текст сразу; фиксированный таймер ~7 с после готовности TTS."""
    overlay = get_overlay()
    hide_ms = _panel_hide_ms(auto_hide_ms)
    overlay.show_text(clean, tag=CONNOR_TAG, auto_hide_ms=0)

    def _run() -> None:
        from core import camb_tts

        path = camb_tts.synthesize(clean)
        overlay.start_auto_hide(hide_ms)
        if path:
            camb_tts.play_path(path, block=False)

    threading.Thread(target=_run, name="connor-tts-panel", daemon=True).start()


def show_connor(text: str, auto_hide_ms: int = DEFAULT_HIDE_MS, *, speak: bool = True) -> None:
    """Показать текст в панели Коннора (потокобезопасно)."""
    if not text or not str(text).strip():
        return
    clean = sanitize_connor_reply(str(text))
    if not clean:
        return

    if speak:
        from core.tts_engine import tts_enabled

        if tts_enabled():
            _show_with_tts(clean, auto_hide_ms)
            return

    get_overlay().show_text(clean, tag=CONNOR_TAG, auto_hide_ms=_panel_hide_ms(auto_hide_ms))


def speak_connor(
    category: str,
    original_text: str = "",
    context: str = "",
    *,
    block: bool = False,
) -> Optional[str]:
    """
    Сгенерировать реплику Коннора через LLM и показать в панели.
    По умолчанию в фоне (block=False).
    """
    def _run() -> Optional[str]:
        from openjarvis.connor_response import generate_connor_reply
        reply = generate_connor_reply(category, original_text, context=context)
        if reply:
            show_connor(reply)
        return reply

    if block:
        return _run()
    threading.Thread(target=_run, name="connor-speak", daemon=True).start()
    return None


def speak_direct(text: str, auto_hide_ms: int = DEFAULT_HIDE_MS) -> None:
    """Прямой текст Gemma (без второй персонализации) → панель Коннора."""
    show_connor(text, auto_hide_ms=auto_hide_ms)
