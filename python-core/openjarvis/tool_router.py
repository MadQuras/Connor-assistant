"""
tool_router.py — маршрутизация команд через Ollama + function calling (Gemma 4).
"""

from __future__ import annotations

from typing import Optional, Tuple

from core import logger
from core.config_loader import load_config
from openjarvis.connor_prompts import LANGUAGE_RULES, TTS_SPEECH_RULES, sanitize_connor_reply
from openjarvis.connor_tools import CONNOR_TOOLS, tool_route_from_calls
from openjarvis.ollama_client import chat, parse_tool_calls

_SYSTEM = """\
Ты — Коннор, голосовой ассистент на Windows. Пользователь говорит на русском.

ДВА РЕЖИМА — выбери один:

1) КОМАНДА (действие на ПК) → вызови ровно одну функцию (tool) через function calling.
   Не пиши код и не имитируй вызов текстом — только реальный tool call.

2) РАЗГОВОР (бытовой диалог) → ответь коротко текстом БЕЗ tool:
   привет, как дела, спасибо, шутка, «кто ты», болтовня, эмоции, философия.

Если сомневаешься между режимами — для фраз без явного действия выбирай РАЗГОВОР (текст).

Команды → tools:
- открыть программу / диспетчер задач → open_app
- загрузки / документы → open_folder
- время / дата → get_time
- CPU, RAM → get_system_stats
- шторы → smart_home
- музыка → play_music; пауза/след/пред → music_control
- громче/тише → volume_control
- поиск → web_search
- погода → get_weather
- ютуб → open_youtube
- сводка сайта → summarize_website
- заметка / напоминание → add_note / set_reminder
- блокировка / выключение → lock_pc / shutdown_pc

""" + LANGUAGE_RULES + """

""" + TTS_SPEECH_RULES


def route_with_ollama_tools(text: str) -> Optional[Tuple[str, str]]:
    if not text.strip():
        return None

    cfg = load_config()
    timeout = float(cfg.get("ollama_timeout_sec", 45))

    message = chat(
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": text.strip()},
        ],
        tools=CONNOR_TOOLS,
        timeout=timeout,
    )
    if not message:
        logger.log_system("Ollama tools: пустой ответ")
        return None

    calls = parse_tool_calls(message)
    if not calls:
        content = sanitize_connor_reply(message.get("content") or "")
        if content:
            logger.log_system(f"Ollama text reply: {content[:120]!r}")
            return "__SPEAK__", content
        return None

    routed = tool_route_from_calls(calls, original_text=text)
    if routed:
        cat, arg = routed
        if cat != "__HANDLED__":
            logger.log_route(cat, arg, via="ollama-tool")
        else:
            logger.log_system("Ollama tool: handled inline")
    return routed
