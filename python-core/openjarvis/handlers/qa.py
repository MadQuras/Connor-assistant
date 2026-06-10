"""qa.py — краткий голосовой ответ или Google при нехватке данных."""

from __future__ import annotations

from openjarvis.connor_ui import speak_direct
from openjarvis.qa_service import QAResultKind, resolve_question


def _fallback_google(question: str, original_text: str = "") -> None:
    from openjarvis.handlers import search

    search.handle(question, original_text=original_text)
    speak_direct("Открою Google — там будет подробный ответ")


def handle(arg: str, original_text: str = "") -> None:
    question = (arg or original_text or "").strip()
    result = resolve_question(question)

    if result.kind == QAResultKind.ANSWER and result.text:
        speak_direct(result.text)
    else:
        _fallback_google(result.query or question, original_text=original_text)
