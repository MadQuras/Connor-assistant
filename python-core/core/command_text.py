"""Нормализация текста команды: снятие wake-слова с начала и конца."""

from __future__ import annotations

import re

_WAKE_TOKENS = (
    r"коннор|конор|конер|конне|конно|коно|гонор|кано|канор|ко[\-\s]нор|"
    r"кон[\-\s]нор|connor|conner|cannor|conor|кон|кoн"
)

_WAKE_PREFIX_RE = re.compile(
    rf"^({_WAKE_TOKENS})[\s,\.\-!?:;]*",
    re.IGNORECASE,
)

_WAKE_SUFFIX_RE = re.compile(
    rf"[\s,\.\-!?:;]*({_WAKE_TOKENS})\s*$",
    re.IGNORECASE,
)


def strip_wake_marks(text: str) -> str:
    """«Спасибо, Конор» → «спасибо», «Коннор, погода» → «погода»."""
    t = (text or "").strip()
    for _ in range(4):
        m = _WAKE_PREFIX_RE.match(t)
        if m:
            t = t[m.end() :].strip()
            continue
        m = _WAKE_SUFFIX_RE.search(t)
        if m:
            t = t[: m.start()].strip()
            continue
        break
    return t
