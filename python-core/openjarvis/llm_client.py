"""
llm_client.py — единая точка LLM (Gemini cloud / Ollama local Gemma 4).

config.json:
  llm_backend: "ollama" | "gemini"
  ollama_model, ollama_url, ollama_think, ollama_timeout_sec
  use_ollama_tools, use_ollama_wake, use_ollama_responses
  gemini_api_key, use_gemini_route, use_gemini_wake
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from core.config_loader import load_config


def backend() -> str:
    return (load_config().get("llm_backend") or "ollama").strip().lower()


def _ollama_timeout(cfg: dict | None = None) -> float:
    c = cfg or load_config()
    return float(c.get("ollama_timeout_sec", 45))


def generate_text(prompt: str, timeout: float = 5.0) -> Optional[str]:
    cfg = load_config()
    if backend() == "ollama":
        from openjarvis.ollama_client import generate_text as ollama_gen
        # Локальная Gemma медленнее облака — не резать ниже ollama_timeout_sec
        effective = max(float(timeout or 0), _ollama_timeout(cfg))
        return ollama_gen(prompt, timeout=effective)

    from openjarvis.gemini_client import generate_text as gemini_gen
    return gemini_gen(prompt, timeout=timeout)


def llm_enabled_for_route() -> bool:
    cfg = load_config()
    if backend() == "ollama":
        return bool(cfg.get("use_ollama_tools", True))
    return bool(cfg.get("use_gemini_route", True))


def llm_enabled_for_wake() -> bool:
    cfg = load_config()
    if backend() == "ollama":
        return bool(cfg.get("use_ollama_wake", True))
    return bool(cfg.get("use_gemini_wake", True))


def llm_enabled_for_responses() -> bool:
    cfg = load_config()
    if backend() == "ollama":
        return bool(cfg.get("use_ollama_responses", True))
    return True


def llm_enabled_for_chat() -> bool:
    cfg = load_config()
    if backend() == "ollama":
        return bool(cfg.get("use_ollama_chat", True))
    return False


def verify_gemma_connection(full_test: bool = True) -> dict[str, Any]:
    """Проверка Ollama + тестовая генерация. Пишет models/gemma_status.json."""
    cfg = load_config()
    from openjarvis.ollama_client import generate_text as ollama_gen, is_available, list_models

    model = cfg.get("ollama_model", "gemma4:e4b")
    url = cfg.get("ollama_url", "http://127.0.0.1:11434")
    status: dict[str, Any] = {
        "ok": False,
        "backend": backend(),
        "model": model,
        "url": url,
        "available": False,
        "model_installed": False,
        "test_reply": None,
        "error": None,
        "checked_at": datetime.now().isoformat(timespec="seconds"),
    }

    if backend() != "ollama":
        status["error"] = f"llm_backend={backend()}, не ollama"
        _write_status(status)
        return status

    status["available"] = is_available()
    if not status["available"]:
        status["error"] = "Ollama не отвечает на /api/tags"
        _write_status(status)
        return status

    installed = list_models()
    status["model_installed"] = any(
        model in m or m.startswith(model.split(":")[0])
        for m in installed
    )
    if not status["model_installed"]:
        status["error"] = f"Модель {model!r} не найдена. Установите: ollama pull {model}"
        _write_status(status)
        return status

    if full_test:
        reply = ollama_gen(
            "Ответь одной короткой фразой на русском от лица андроида Коннора RK800: "
            "подтверди, что ты подключён к голосовому ассистенту Лейтенанта.",
            timeout=_ollama_timeout(cfg),
        )
        status["test_reply"] = reply
        if not reply:
            status["error"] = "Модель вернула пустой ответ"
            _write_status(status)
            return status

    status["ok"] = True
    _write_status(status)
    return status


def _write_status(status: dict[str, Any]) -> None:
    try:
        from core.constants import MODELS_DIR
        path = Path(MODELS_DIR) / "gemma_status.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
