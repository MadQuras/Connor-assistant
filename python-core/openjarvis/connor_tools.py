"""
connor_tools.py — JSON Schema tools для Gemma 4 / Ollama function calling.

execute_tool() → (category, arg) для dispatch, или ("__HANDLED__", "") если уже выполнено.
"""

from __future__ import annotations

import re
import subprocess
import urllib.parse
from typing import Any, Optional, Tuple

from core import logger
from core.storage.notes_db import NotesDB
from openjarvis.connor_ui import show_connor, speak_connor, speak_direct

# ── Ollama / OpenAI-style tool definitions ──────────────────────────────────

CONNOR_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "open_app",
            "description": "Открыть программу на ПК (Chrome, Steam, Discord, блокнот, диспетчер задач и т.д.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Название приложения или exe."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_folder",
            "description": "Открыть папку: загрузки, документы, рабочая папка или путь.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "enum": ["downloads", "documents", "working", "custom"],
                        "description": "Тип папки.",
                    },
                    "path": {"type": "string", "description": "Путь, если folder=custom."},
                },
                "required": ["folder"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_time",
            "description": "Текущее время и дата на ПК пользователя.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_stats",
            "description": "Загрузка CPU и RAM (мониторинг ресурсов ПК).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "smart_home",
            "description": "Умный дом: шторы/жалюзи — открыть, закрыть, процент, по расписанию.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device": {"type": "string", "description": "Устройство, напр. curtains."},
                    "action": {"type": "string", "enum": ["open", "close", "set_percent"]},
                    "percent": {"type": "integer", "description": "0–100 для set_percent."},
                    "at_time": {"type": "string", "description": "ISO время для отложенного действия."},
                },
                "required": ["device", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "play_music",
            "description": "Включить музыку или конкретный трек (Яндекс.Музыка / Lune).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Название трека или пусто для просто «музыка»."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "music_control",
            "description": "Пауза, продолжить, следующий или предыдущий трек.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["pause", "resume", "next", "prev"]},
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "volume_control",
            "description": "Громкость системы: громче, тише или процент.",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["up", "down"]},
                    "percent": {"type": "integer", "description": "0–100, если задан явно."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Поиск в Google по запросу.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Погода по городу (открывает подробный прогноз).",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "Город, напр. Москва."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_youtube",
            "description": "Поиск или открытие видео на YouTube.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_website",
            "description": "Краткая сводка содержимого сайта по URL (как Gemini overview).",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_note",
            "description": "Добавить заметку / напоминание.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "Напоминание с текстом и временем (ISO или «через N секунд»).",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "time": {"type": "string", "description": "ISO datetime или offset секунд."},
                },
                "required": ["text", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lock_pc",
            "description": "Заблокировать компьютер.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "shutdown_pc",
            "description": "Выключить компьютер.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

_HANDLED = ("__HANDLED__", "")


def _system_stats_text() -> str:
    cpu = ram = "—"
    try:
        import psutil  # type: ignore
        cpu = f"{psutil.cpu_percent(interval=0.3):.0f}%"
        mem = psutil.virtual_memory()
        ram = f"{mem.percent:.0f}% ({mem.used // (1024**3)} / {mem.total // (1024**3)} ГБ)"
    except Exception:
        try:
            out = subprocess.check_output(
                ["wmic", "cpu", "get", "loadpercentage"],
                text=True, timeout=5,
            )
            lines = [l.strip() for l in out.splitlines() if l.strip().isdigit()]
            if lines:
                cpu = f"{lines[0]}%"
        except Exception:
            pass
    return f"CPU: {cpu}, RAM: {ram}"


def _fetch_url_text(url: str, max_chars: int = 12000) -> str:
    import requests
    r = requests.get(url, timeout=15, headers={"User-Agent": "Connor-RK800/1.0"})
    r.raise_for_status()
    html = r.text
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def execute_tool(name: str, args: dict[str, Any], original_text: str = "") -> Tuple[str, str]:
    """Маппинг tool → category/arg или прямое выполнение."""
    a = args or {}
    logger.log_system(f"Tool: {name}({a})")

    if name == "open_app":
        target = str(a.get("name", "")).strip()
        low = target.lower()
        if any(x in low for x in ("диспетчер", "task manager", "taskmgr")):
            target = "taskmgr"
        return "APPS", target

    if name == "open_folder":
        folder = a.get("folder", "custom")
        if folder == "downloads":
            return "APPS", "открой загрузки"
        if folder == "documents":
            return "APPS", "открой документы"
        if folder == "working":
            return "APPS", "открой рабочую папку"
        path = str(a.get("path", "")).strip()
        return "APPS", path or original_text

    if name == "get_time":
        return "TIME", ""

    if name == "get_system_stats":
        stats = _system_stats_text()
        speak_connor("SYSTEM", original_text, context=stats)
        return _HANDLED

    if name == "smart_home":
        pct = a.get("percent")
        action = a.get("action", "")
        dev = a.get("device", "шторы")
        ctx = f"{dev} → {action}"
        if pct is not None:
            ctx += f", {pct}%"
        if a.get("at_time"):
            ctx += f", время {a['at_time']}"
        ctx += " (умный дом — фаза 2, пока заглушка)"
        speak_connor("PLANS", original_text, context=ctx)
        return _HANDLED

    if name == "play_music":
        q = str(a.get("query", "")).strip()
        return "MUSIC", q or "включи музыку"

    if name == "music_control":
        act = a.get("action", "")
        mapping = {
            "pause": "пауза",
            "resume": "продолжи",
            "next": "следующий трек",
            "prev": "предыдущий трек",
        }
        return "MUSIC", mapping.get(str(act), str(act))

    if name == "volume_control":
        if a.get("percent") is not None:
            return "VOLUME", str(int(a["percent"]))
        d = a.get("direction", "up")
        return "VOLUME", "up" if d == "up" else "down"

    if name == "web_search":
        return "SEARCH", str(a.get("query", ""))

    if name == "get_weather":
        from core.weather_service import extract_city, fetch_weather

        city = str(a.get("city", "") or "").strip() or extract_city(original_text)
        from openjarvis.handlers import weather

        weather.handle(city, original_text=original_text)
        data = fetch_weather(city)  # cache hit после handle
        ctx = f"Город: {city}"
        if data:
            ctx = (
                f"{data.get('city')}: {data.get('temp')}°C, {data.get('desc')}, "
                f"ветер {data.get('wind_kmh')} км/ч, влажность {data.get('humidity')}%"
            )
        speak_connor("WEATHER", original_text, context=ctx)
        return _HANDLED

    if name == "open_youtube":
        q = urllib.parse.quote(str(a.get("query", "")))
        url = f"https://www.youtube.com/results?search_query={q}"
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)
        return "SEARCH", str(a.get("query", ""))

    if name == "summarize_website":
        url = str(a.get("url", "")).strip()
        if not url:
            return "UNKNOWN", ""
        try:
            body = _fetch_url_text(url)
            from openjarvis.llm_client import generate_text
            prompt = (
                f"Сделай краткую сводку сайта на русском (5–7 пунктов, суть).\n"
                f"URL: {url}\n\nТекст страницы:\n{body[:8000]}"
            )
            summary = generate_text(prompt, timeout=45.0)
            if summary:
                speak_direct(summary, auto_hide_ms=12000)
            else:
                speak_connor("UNKNOWN", original_text, context="Не удалось составить сводку сайта")
        except Exception as e:
            logger.log_error(f"summarize_website: {e}")
            speak_connor("UNKNOWN", original_text, context=f"Ошибка загрузки сайта: {e}")
        return _HANDLED

    if name == "add_note":
        title = str(a.get("title", "")).strip()
        content = str(a.get("content", "")).strip()
        text = f"{title}: {content}" if title else content
        NotesDB().add(text)
        speak_connor("PLANS", original_text, context=f"Записано: {text}")
        return _HANDLED

    if name == "set_reminder":
        text = str(a.get("text", "")).strip()
        when = str(a.get("time", "")).strip()
        NotesDB().add(text, remind_at=when or None)
        speak_connor("PLANS", original_text, context=f"Напоминание: {text}. Время: {when}")
        return _HANDLED

    if name == "lock_pc":
        return "LOCK", ""

    if name == "shutdown_pc":
        return "SHUTDOWN", ""

    logger.log_system(f"Unknown tool: {name}")
    return "UNKNOWN", ""


def tool_route_from_calls(calls: list[tuple[str, dict[str, Any]]], original_text: str) -> Optional[Tuple[str, str]]:
    """Первый успешный tool call → route tuple."""
    for name, args in calls:
        cat, arg = execute_tool(name, args, original_text=original_text)
        if cat == "__HANDLED__":
            return _HANDLED
        if cat != "UNKNOWN":
            return cat, arg
    return None
