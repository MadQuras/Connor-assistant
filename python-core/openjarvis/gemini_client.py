"""
gemini_client.py — единый клиент Google Gemini (google-genai).

API:
  get_client() -> genai.Client
  generate_text(prompt: str, timeout: float = 5.0) -> str | None

Пакет: pip install google-genai
  from google import genai
  client.models.generate_content(model='gemini-2.0-flash', contents=prompt)

НЕ использовать google.generativeai (устарел).

Используется: wake_detector, route (роутинг JSON).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Optional

from core.config_loader import load_config
from core.constants import GEMINI_MODEL
from core.exceptions import GeminiError


def get_client():
    key = load_config().get("gemini_api_key", "").strip()
    if not key:
        raise GeminiError("gemini_api_key missing in config.json")
    from google import genai
    return genai.Client(api_key=key)


def generate_text(prompt: str, timeout: float = 5.0) -> Optional[str]:
    def _run() -> str:
        client = get_client()
        r = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        return (r.text or "").strip()

    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_run).result(timeout=timeout)
    except FuturesTimeout:
        print("[Gemini] timeout")
        return None
    except Exception as e:
        print(f"[Gemini] {e}")
        return None
