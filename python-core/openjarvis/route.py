from __future__ import annotations

import json
import re
from typing import Tuple

from core.config_loader import load_config
from core.constants import GEMINI_ROUTE_TIMEOUT_SEC
from core import wake_detector
from core import logger
from openjarvis import fallback_router
from openjarvis import dispatch as _dispatch
from openjarvis.gemini_client import generate_text


# ── Gemini STT correction prompt ──────────────────────────────────────────────
# Gemini's job: take possibly-garbled STT text and return the closest known
# command phrase. It acts as a fuzzy-match corrector, NOT a router.
_CORRECT_PROMPT = """\
Голосовой ассистент получил текст от системы распознавания речи (STT).
Текст STT: "{text}"

Известные команды ассистента:
- "сколько времени" / "который час"
- "открой [приложение]" / "запусти [приложение]"
- "найди [запрос]" / "загугли [запрос]"
- "какая погода"
- "громче" / "тише" / "убавь" / "прибавь"
- "выключи компьютер"
- "заблокируй"
- "включи музыку" / "следующий трек" / "пауза"

Если текст STT явно искажён и похож на одну из команд — верни исправленный текст команды.
Если это осмысленный запрос, не похожий ни на одну команду — верни его как есть (дословно).
Верни ТОЛЬКО исправленный/оригинальный текст, без объяснений, без кавычек."""

# ── Fallback: Gemini as direct router (if correction still gives UNKNOWN) ─────
_ROUTE_PROMPT = """\
Команда пользователя: '{text}'
Определи категорию и аргумент.
Категории:
APPS — открыть приложение/папку (аргумент: название)
MUSIC — музыка/трек (аргумент: название или пусто)
SEARCH — найти/поиск (аргумент: запрос)
WEATHER — погода (аргумент: пусто)
SHUTDOWN — выключить ПК (аргумент: пусто)
LOCK — заблокировать (аргумент: пусто)
PLANS — заметки/напоминания (аргумент: текст)
VOLUME — громкость (аргумент: up/down/число)
TIME — время (аргумент: пусто)
UNKNOWN — не понятно
Ответ СТРОГО JSON: {{"category": "APPS", "arg": "chrome"}}"""


def is_wake_word(text: str) -> bool:
    return wake_detector.is_wake(text)


def route_command(text: str) -> Tuple[str, str]:
    logger.log_system(f'Команда получена: "{text}"')

    # ── Stage 1: fast local router ────────────────────────────────────────────
    local = fallback_router.route(text)
    logger.log_route(local[0], local[1], via="local")
    if local[0] != "UNKNOWN":
        return local

    # ── Stage 2: Gemini corrects STT → re-run local router ───────────────────
    cfg = load_config()
    if not cfg.get("use_gemini_route", True):
        logger.log_system("Gemini отключён в конфиге")
        return local

    try:
        corrected = generate_text(
            _CORRECT_PROMPT.format(text=text),
            timeout=min(GEMINI_ROUTE_TIMEOUT_SEC, 3.0),
        )
        if corrected:
            corrected = corrected.strip().strip('"').strip("'")
            logger.log_system(f"Gemini коррекция STT: {text!r} → {corrected!r}")

            if corrected.lower() != text.lower():
                # Try local router on corrected text
                fixed = fallback_router.route(corrected)
                if fixed[0] != "UNKNOWN":
                    logger.log_route(fixed[0], fixed[1], via="gemini-corrected")
                    return fixed

            # ── Stage 3: Gemini as direct router (last resort) ───────────────
            route_text = corrected if corrected else text
            answer = generate_text(
                _ROUTE_PROMPT.format(text=route_text),
                timeout=min(GEMINI_ROUTE_TIMEOUT_SEC, 2.0),
            )
            if answer:
                parsed = _parse_json(answer)
                if parsed and parsed[0] != "UNKNOWN":
                    logger.log_route(parsed[0], parsed[1], via="gemini-route")
                    return parsed
                logger.log_system(f"Gemini route ответил: {answer!r}")

    except Exception as e:
        logger.log_error(f"Gemini: {e}")

    logger.log_route("UNKNOWN", "", via="no-match")
    return "UNKNOWN", ""


def _parse_json(answer: str) -> Tuple[str, str] | None:
    m = re.search(r"\{[^{}]+\}", answer, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group())
        category = str(data.get("category", "UNKNOWN")).upper()
        arg = str(data.get("arg", "") or "")
        return category, arg
    except json.JSONDecodeError:
        return None


def dispatch(category: str, arg: str, original_text: str = "") -> None:
    _dispatch.dispatch(category, arg, original_text)
