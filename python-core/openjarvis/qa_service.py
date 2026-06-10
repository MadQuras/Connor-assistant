"""
qa_service.py — краткие фактические ответы голосом (как строка в Google).

Приоритет:
  1. Gemini + Google Search grounding (если есть gemini_api_key)
  2. Ollama + сниппеты DuckDuckGo

Если ответа нет или нужен развёрнутый ответ → fallback в Google (см. resolve_question).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional
from urllib.parse import quote_plus

from core import logger
from core.config_loader import load_config
from openjarvis.connor_prompts import sanitize_connor_reply, QA_ANSWER_RULES

_QA_KW = {
    "что такое", "кто такой", "кто такая", "когда", "где", "сколько",
    "почему", "зачем", "какой", "какая", "какие", "как долго", "во сколько",
    "скажи про", "расскажи про", "расскажи о", "скажи о",
    "анонс", "дата выхода", "дата релиза", "когда выйдет", "когда выходит",
    "сколько стоит", "сколько лет", "сколько km", "сколько км",
    "в каком году", "как называется",
}

_EXCLUDE_QA = (
    "сколько времени", "который час", "какое время", "какой час",
    "какая погода", "что с погодой", "прогноз погоды",
    "погода", "погоду", "погод",
    "кто ты", "что ты", "ты кто", "расскажи о себе",
    "как дела", "как ты", "привет", "здравствуй", "спасибо", "пока",
)

# Сразу открываем Google — нужен развёрнутый ответ
_DETAILED_KW = (
    "подробно", "развернуто", "развёрнуто", "детально", "полностью",
    "объясни", "объяснение", "расскажи всё", "расскажи все", "полный ответ",
    "как работает", "как устроен", "как устроена", "как устроено",
    "пошагово", "инструкция", "руководство", "история ",
    "в чём смысл", "в чем смысл", "почему так", "зачем нужен",
    "сравни", "сравнение", "отличия", "разница между",
)

_NO_INFO_RE = re.compile(
    r"не\s+(удалось|знаю|могу|найден|нашёл|нашел|уверен)"
    r"|нет\s+(точной|актуальной|информации|данных|сведений)"
    r"|не\s+найден"
    r"|информация\s+недоступн"
    r"|не\s+могу\s+ответ",
    re.IGNORECASE,
)


class QAResultKind(str, Enum):
    ANSWER = "answer"
    WEB = "web"


@dataclass
class QAResult:
    kind: QAResultKind
    text: Optional[str] = None
    query: str = ""


def is_factual_question(text: str) -> bool:
    """Вопрос, на который нужен короткий фактический ответ (не команда)."""
    low = text.lower().strip()
    if not low or len(low) < 4:
        return False
    if any(p in low for p in _EXCLUDE_QA):
        return False
    if "погод" in low:
        return False
    if needs_web_search(text):
        return True
    if "?" in text:
        return True
    if any(kw in low for kw in _QA_KW):
        return True
    if re.match(r"^(когда|где|сколько|какой|какая|какие|почему|зачем)\b", low):
        return True
    return False


def needs_web_search(question: str) -> bool:
    """Вопрос требует развёрнутого ответа — сразу Google."""
    low = question.lower().strip()
    return any(kw in low for kw in _DETAILED_KW)


def is_unanswerable(answer: Optional[str]) -> bool:
    if not answer or not answer.strip():
        return True
    if answer.strip().upper() == "GOOGLE":
        return True
    return bool(_NO_INFO_RE.search(answer))


def _qa_enabled() -> bool:
    return bool(load_config().get("use_qa", True))


def _max_words() -> int:
    return int(load_config().get("qa_max_words", 25))


def _gemini_key_ok() -> bool:
    key = (load_config().get("gemini_api_key") or "").strip()
    return bool(key) and key != "YOUR_GEMINI_API_KEY_HERE"


def _web_snippets(query: str, max_chars: int = 2500) -> str:
    """Краткие сниппеты из DuckDuckGo Lite (без API-ключа)."""
    try:
        import requests

        url = f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}"
        r = requests.get(
            url,
            timeout=12,
            headers={"User-Agent": "Connor-RK800/1.0"},
        )
        r.raise_for_status()
        html = r.text
        text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
        text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:max_chars]
    except Exception as e:
        logger.log_error(f"QA web snippets: {e}")
        return ""


def _trim_answer(text: str) -> str:
    clean = sanitize_connor_reply(text)
    if not clean:
        return ""
    words = clean.split()
    limit = _max_words()
    if len(words) > limit:
        return ""  # слишком длинно — пусть Google
    return clean


def _generate_short_answer(question: str) -> Optional[str]:
    """Попытка короткого ответа через LLM."""
    q = (question or "").strip()
    if not q:
        return None

    cfg = load_config()
    use_grounding = bool(cfg.get("qa_use_gemini_grounding", True))

    if use_grounding and _gemini_key_ok():
        try:
            from openjarvis.gemini_client import answer_with_grounding

            timeout = float(cfg.get("qa_timeout_sec", 15))
            ans = answer_with_grounding(q, timeout=timeout)
            if ans:
                result = _trim_answer(ans)
                if result:
                    logger.log_system(f"[QA/Gemini] {result[:100]!r}")
                    return result
                if ans.strip().upper() == "GOOGLE":
                    return "GOOGLE"
        except Exception as e:
            logger.log_error(f"QA Gemini: {e}")

    snippets = _web_snippets(q)
    context = f"\n\nКонтекст из поиска:\n{snippets}" if snippets else ""
    prompt = (
        f"{QA_ANSWER_RULES}\n\n"
        f"Вопрос: {q}{context}\n\n"
        f"Ответ (одно предложение, максимум {_max_words()} слов, или GOOGLE):"
    )
    try:
        from openjarvis.llm_client import generate_text

        timeout = float(cfg.get("ollama_timeout_sec", 60))
        ans = generate_text(prompt, timeout=timeout)
        if ans:
            if ans.strip().upper() == "GOOGLE":
                return "GOOGLE"
            result = _trim_answer(ans)
            if result:
                logger.log_system(f"[QA/LLM] {result[:100]!r}")
                return result
    except Exception as e:
        logger.log_error(f"QA LLM: {e}")

    return None


def answer_question(question: str) -> Optional[str]:
    """Короткий ответ или None (legacy API)."""
    result = resolve_question(question)
    if result.kind == QAResultKind.ANSWER and result.text:
        return result.text
    return None


def resolve_question(question: str) -> QAResult:
    """Короткий ответ голосом или указание открыть Google."""
    q = (question or "").strip()
    if not q or not _qa_enabled():
        return QAResult(QAResultKind.WEB, query=q)

    if needs_web_search(q):
        logger.log_system(f"[QA] развёрнутый вопрос → Google: {q[:80]!r}")
        return QAResult(QAResultKind.WEB, query=q)

    ans = _generate_short_answer(q)
    if ans and not is_unanswerable(ans):
        return QAResult(QAResultKind.ANSWER, text=ans, query=q)

    logger.log_system(f"[QA] нет краткого ответа → Google: {q[:80]!r}")
    return QAResult(QAResultKind.WEB, query=q)
