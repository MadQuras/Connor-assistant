"""Фразы «отойди пока» / «вернись» — режим без ответов до явного возврата."""

from __future__ import annotations

_DISMISS_PHRASES = (
    "отойди пока",
    "уйди пока",
    "отойди на время",
    "не мешай",
    "не мешай мне",
    "оставь меня",
    "оставь меня одного",
    "оставь меня одной",
    "отстань",
    "отключись",
    "замолчи",
    "go away",
    "leave me alone",
    "отойди",
)

_RETURN_PHRASES = (
    "вернись",
    "возвращайся",
    "вернулся",
    "снова на связи",
    "я готов",
    "можешь вернуться",
    "come back",
    "вернись ко мне",
    "возвращайся ко мне",
)


def is_dismiss_phrase(text: str) -> bool:
    low = text.lower().strip()
    if not low:
        return False
    return any(p in low for p in _DISMISS_PHRASES)


def is_return_phrase(text: str) -> bool:
    low = text.lower().strip()
    if not low:
        return False
    if any(p in low for p in _RETURN_PHRASES):
        return True
    # «вернись» может быть единственным словом команды
    return low in ("вернись", "возвращайся", "come back")


def strip_return_phrase(text: str) -> str:
    """Текст после «вернись» для инлайн-команды «Коннор, вернись, сколько времени»."""
    low = text.lower().strip()
    for p in _RETURN_PHRASES:
        idx = low.find(p)
        if idx != -1:
            return text[idx + len(p):].strip(" ,.")
    return text.strip()
