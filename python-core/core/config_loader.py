"""
config_loader.py — чтение и запись config.json (единая точка).

Публичный API:
  - load_config() -> dict
  - save_config(updates: dict) -> None
  - get_config_path() -> str | None  # какой файл загрузили

Поля config (см. корневой config.json):
  gemini_api_key, whisper_model, music_backend, yandex_music_url,
  command_timeout_sec, user_name, use_gemini_wake, use_gemini_route

Советы:
  - encoding=utf-8, merge при save (не затирайте неизвестные ключи)
  - Лог: print(f"[Config] Loaded: {path}")
"""

from __future__ import annotations

import json
from typing import Any

from core.constants import CONFIG_PATHS


_cached: dict | None = None
_loaded_path: str | None = None


def get_config_path() -> str | None:
    return _loaded_path


def load_config(force_reload: bool = False) -> dict[str, Any]:
    """
    Ищет config.json по CONFIG_PATHS.
    Кэширует в _cached если force_reload=False.
    """
    global _cached, _loaded_path
    if _cached is not None and not force_reload:
        return _cached.copy()

    for p in CONFIG_PATHS:
        path = p.resolve() if hasattr(p, "resolve") else p
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _cached = json.load(f)
            _loaded_path = str(path)
            print(f"[Config] Loaded: {_loaded_path}")
            return _cached.copy()

    print("[Config] Not found!")
    _cached = {}
    _loaded_path = None
    return {}


def save_config(updates: dict[str, Any]) -> None:
    """
    Обновляет config.json (первый найденный путь или PROJECT_ROOT/config.json).
    """
    global _cached, _loaded_path
    cfg = load_config(force_reload=True)
    cfg.update(updates)
    target = _loaded_path or str(CONFIG_PATHS[0])
    with open(target, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    _cached = cfg
    print(f"[Config] Saved: {target}")
