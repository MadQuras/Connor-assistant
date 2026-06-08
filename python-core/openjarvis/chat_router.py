"""
chat_router.py — бытовой диалог с Gemma 4 (без tools).

Приветствия, «как дела», шутки, вопросы о Конноре — не команды, а разговор.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

from core import logger
from core.config_loader import load_config
from openjarvis.ollama_client import chat

# ── Быстрая эвристика: явно не команда, а разговор ───────────────────────────

_CHAT_PATTERNS = (
    r"\b(привет|здравств|добр(ый|ое|ая)\s+(утр|ден|вечер)|хай|hello|hi)\b",
    r"\b(как\s+дела|как\s+ты|как\s+сам|что\s+нового|как\s+жизнь|как\s+настроение)\b",
    r"\b(спасибо|благодар|молодец|отлично|круто|класс|супер)\b",
    r"\b(пока|до\s+свид|увидимся|goodbye|bye)\b",
    r"\b(кто\s+ты|что\s+ты|ты\s+кто|расскажи\s+о\s+себе|ты\s+бот|ты\s+андроид|ты\s+живой)\b",
    r"\b(шутк|анекдот|пошути|рассмеши|юмор)\b",
    r"\b(скучно|грустно|устал|не\s+спится)\b",
    r"\b(любишь|ненавид|думаешь\s+о|мнение|считаешь)\b",
    r"\b(помоги\s+совет|поговор|поболта|пообща)\b",
    r"^(коннор|connor)[\s,]*$",  # просто имя без команды
)

_CHAT_KW = frozenset({
    "привет", "здравствуй", "здравствуйте", "хай", "hello",
    "как дела", "как ты", "спасибо", "благодарю", "пока",
    "кто ты", "расскажи", "анекдот", "шутку", "пошути",
    "скучно", "устал", "любишь", "думаешь", "поговорим",
})

_CHAT_SYSTEM = """\
Ты — Коннор, андроид-детектив RK800 из Detroit: Become Human.
Голосовой ассистент Лейтенанта на Windows. Сейчас режим обычного разговора — НЕ команда.

ПРАВИЛА:
- Обращайся «Лейтенант» (хотя бы раз)
- 1–3 предложения на русском, живо но сдержанно — холодный андроидный тон
- Можно сухой юмор и отсылки к Detroit / протоколам / deviant
- Не выдумывай факты о реальном мире в реальном времени (погоду, новости) — скажи, что можешь найти по команде
- Не предлагай список команд, если не просят
- Если просят действие (открыть, включить, найти) — кратко: «Приказ принят» или «Сформулируйте как команду, Лейтенант»
- Только текст ответа, без кавычек и markdown
"""


def is_likely_chat(text: str) -> bool:
    """Быстро: похоже на бытовой диалог, а не на команду."""
    low = text.lower().strip()
    if not low or len(low) < 2:
        return False

    # Короткие фразы без глаголов действия — часто болтовня
    action_verbs = (
        "открой", "запусти", "найди", "включи", "выключи", "громче", "тише",
        "пауза", "запомни", "напомни", "заблок", "погода", "время", "музык",
    )
    if len(low.split()) <= 6 and not any(v in low for v in action_verbs):
        for pat in _CHAT_PATTERNS:
            if re.search(pat, low, re.IGNORECASE):
                return True
        for kw in _CHAT_KW:
            if kw in low:
                return True

    for pat in _CHAT_PATTERNS:
        if re.search(pat, low, re.IGNORECASE):
            return True

    return False


def chat_with_gemma(text: str) -> Optional[str]:
    """Gemma 4 — разговорный ответ без function calling."""
    if not text.strip():
        return None

    cfg = load_config()
    timeout = float(cfg.get("ollama_timeout_sec", 45))
    user_name = cfg.get("user_name", "Лейтенант")

    message = chat(
        messages=[
            {"role": "system", "content": _CHAT_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Лейтенант ({user_name}) говорит: {text.strip()}\n"
                    f"Ответь как Коннор в обычном диалоге."
                ),
            },
        ],
        tools=None,
        timeout=timeout,
    )
    if not message:
        return None

    content = (message.get("content") or "").strip()
    if content:
        logger.log_system(f"[Gemma/chat] {content[:120]!r}")
    return content or None


def route_with_ollama_chat(text: str) -> Optional[Tuple[str, str]]:
    """→ (__SPEAK__, reply) для pipeline."""
    reply = chat_with_gemma(text)
    if reply:
        logger.log_route("__SPEAK__", "chat", via="ollama-chat")
        return "__SPEAK__", reply
    return None
