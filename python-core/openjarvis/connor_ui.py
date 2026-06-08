"""
connor_ui.py — единое текстовое окно Коннора (левая панель, tag КОННОР).

Весь вывод Gemma / LLM-ответов идёт сюда; технические теги (СВОДКА, ПАМЯТЬ…) не используются.
"""

from __future__ import annotations

import threading
from typing import Optional

from core.config_loader import load_config
from core.overlay import get_overlay

CONNOR_TAG = "КОННОР"


def connor_llm_active() -> bool:
    """Локальный Ollama — ответы через Gemma, без дублирующих overlay в handlers."""
    return (load_config().get("llm_backend") or "gemini").strip().lower() == "ollama"


def show_connor(text: str, auto_hide_ms: int = 8000) -> None:
    """Показать текст в панели Коннора (потокобезопасно)."""
    if not text or not str(text).strip():
        return
    get_overlay().show_text(str(text).strip(), tag=CONNOR_TAG, auto_hide_ms=auto_hide_ms)


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


def speak_direct(text: str, auto_hide_ms: int = 10000) -> None:
    """Прямой текст Gemma (без второй персонализации) → панель Коннора."""
    show_connor(text, auto_hide_ms=auto_hide_ms)
