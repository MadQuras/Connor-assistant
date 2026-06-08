"""
ollama_client.py — локальный LLM через Ollama (gemma4:e4b и др.).

API: http://127.0.0.1:11434
  POST /api/chat   — чат + tools (function calling)
  POST /api/generate — простой текст
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any, Optional

import requests

from core import logger
from core.config_loader import load_config
from openjarvis.connor_prompts import ADDRESSING_RULES, LANGUAGE_RULES, TTS_SPEECH_RULES


def _base_url() -> str:
    return load_config().get("ollama_url", "http://127.0.0.1:11434").rstrip("/")


def _model() -> str:
    return load_config().get("ollama_model", "gemma4:e4b")


def list_models(timeout: float = 3.0) -> list[str]:
    try:
        r = requests.get(f"{_base_url()}/api/tags", timeout=timeout)
        r.raise_for_status()
        models = r.json().get("models") or []
        return [str(m.get("name", "")) for m in models if m.get("name")]
    except Exception:
        return []


_CONNOR_SYSTEM = (
    "Ты — Коннор, андроид RK800 из Detroit: Become Human. "
    "Голосовой ассистент на Windows. "
    "Отвечай кратко на русском, без markdown и без пояснений. "
    + ADDRESSING_RULES
    + " "
    + LANGUAGE_RULES
    + " "
    + TTS_SPEECH_RULES
)


def is_available(timeout: float = 2.0) -> bool:
    try:
        r = requests.get(f"{_base_url()}/api/tags", timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def generate_text(prompt: str, timeout: float = 30.0) -> Optional[str]:
    """Текстовый ответ через /api/chat (Gemma 4)."""

    def _run() -> str:
        msg = chat(
            messages=[
                {"role": "system", "content": _CONNOR_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            timeout=timeout,
        )
        text = (msg.get("content") or "").strip() if msg else ""
        if text:
            from openjarvis.connor_prompts import sanitize_connor_reply
            text = sanitize_connor_reply(text)
            logger.log_system(f"[Gemma] ответ ({len(text)} симв.): {text[:100]!r}")
        return text

    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_run).result(timeout=timeout + 2)
    except FuturesTimeout:
        logger.log_system("[Gemma] timeout (generate)")
        return None
    except Exception as e:
        logger.log_error(f"[Gemma] {e}")
        return None


def chat(
    messages: list[dict[str, Any]],
    tools: Optional[list[dict[str, Any]]] = None,
    timeout: float = 45.0,
) -> Optional[dict[str, Any]]:
    """
    POST /api/chat. Возвращает message dict (может содержать tool_calls).
    """

    def _run() -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": _model(),
            "messages": messages,
            "stream": False,
            "think": load_config().get("ollama_think", False),
        }
        if tools:
            payload["tools"] = tools
        r = requests.post(f"{_base_url()}/api/chat", json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json().get("message") or {}

    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_run).result(timeout=timeout + 2)
    except FuturesTimeout:
        logger.log_system("[Ollama] timeout (chat)")
        return None
    except Exception as e:
        logger.log_error(f"[Ollama] {e}")
        return None


def parse_tool_calls(message: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Извлекает [(name, args), ...] из ответа Ollama."""
    out: list[tuple[str, dict[str, Any]]] = []
    for tc in message.get("tool_calls") or []:
        fn = tc.get("function") or {}
        name = fn.get("name")
        if not name:
            continue
        raw = fn.get("arguments") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw) if raw.strip() else {}
            except json.JSONDecodeError:
                raw = {"raw": raw}
        out.append((str(name), dict(raw)))
    if out:
        return out
    return _parse_text_tool_calls(message.get("content") or "")


def _parse_text_tool_calls(content: str) -> list[tuple[str, dict[str, Any]]]:
    """Fallback: модель иногда пишет open_app(name=\"chrome\") или get_time{} текстом."""
    import re
    text = content.strip()
    if not text:
        return []
    m = re.match(
        r"^([a-z_][a-z0-9_]*)\s*(\(\s*(.*?)\s*\)|\{\s*(.*?)\s*\})\s*$",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if not m:
        return []
    name = m.group(1).lower()
    args_raw = (m.group(2) or m.group(3) or "").strip()
    args: dict[str, Any] = {}
    if args_raw:
        for part in re.findall(
            r'([a-zA-Z_][\w]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^,\)]+))',
            args_raw,
        ):
            key, v1, v2, v3 = part
            val = v1 or v2 or (v3.strip() if v3 else "")
            if val.isdigit():
                args[key] = int(val)
            else:
                args[key] = val
    return [(name, args)]
