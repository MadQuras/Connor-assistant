from __future__ import annotations

from openjarvis.handlers.registry import get_handler
from openjarvis.connor_response import respond

# Categories whose handlers manage their own response entirely (wake, startup).
_SELF_RESPONDING = {"WAKE"}


def dispatch(category: str, arg: str, original_text: str = "") -> None:
    cat = category.upper()
    handler = get_handler(cat)
    handler(arg, original_text=original_text)

    # Generate Gemini Connor response + maybe play audio (10 % chance).
    # Skipped for self-responding categories (wake phrase is handled by pipeline).
    if cat not in _SELF_RESPONDING:
        respond(cat, original_text=original_text)
