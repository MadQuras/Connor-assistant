"""
proxy_guard.py — контекстный менеджер для временного отключения системного прокси.

На машинах с SOCKS4/5-прокси в переменных окружения (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY)
httpx (используемый внутри huggingface_hub и google-genai) пытается туннелировать
запросы через прокси и падает с «Unknown scheme for proxy URL».

Решение: перед каждым сетевым вызовом временно убирать proxy-переменные
и восстанавливать их после.  Применяется в stt_worker, gemini_client и lune (CDP).
"""

from __future__ import annotations

import os
from contextlib import contextmanager

_PROXY_VARS = (
    "HTTP_PROXY",  "HTTPS_PROXY",  "ALL_PROXY",
    "http_proxy",  "https_proxy",  "all_proxy",
)


@contextmanager
def no_proxy_ctx():
    """
    Context manager: removes all proxy env-vars for the duration of the block,
    sets NO_PROXY=* so any library that still reads it skips proxying,
    then restores original values on exit.

    Usage:
        with no_proxy_ctx():
            requests.get("https://...")
    """
    saved = {k: os.environ.pop(k, None) for k in _PROXY_VARS}
    os.environ["NO_PROXY"] = "*"
    os.environ["no_proxy"] = "*"
    try:
        yield
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v
        os.environ.pop("NO_PROXY", None)
        os.environ.pop("no_proxy", None)
