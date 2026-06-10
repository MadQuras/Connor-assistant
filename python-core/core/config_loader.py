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

from pathlib import Path

from core.constants import CONFIG_PATHS, PROJECT_ROOT

_PLACEHOLDERS = frozenset({
    "",
    "YOUR_GEMINI_API_KEY_HERE",
    "YOUR_CAMB_API_KEY_HERE",
})

_cached: dict | None = None
_loaded_path: str | None = None


def get_config_path() -> str | None:
    return _loaded_path


def example_config_path() -> Path | None:
    for base in (PROJECT_ROOT, Path(__file__).resolve().parents[2]):
        p = base / "config.example.json"
        if p.is_file():
            return p
    return None


def load_example_defaults() -> dict[str, Any]:
    p = example_config_path()
    if not p:
        return {}
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def merge_config_defaults(cfg: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Дописать недостающие ключи из config.example.json (не перезаписывая user)."""
    defaults = load_example_defaults()
    added: list[str] = []
    for key, value in defaults.items():
        if key not in cfg:
            cfg[key] = value
            added.append(key)

    camb_key = str(cfg.get("camb_api_key") or "").strip()
    if camb_key and camb_key not in _PLACEHOLDERS and not cfg.get("use_camb_tts"):
        cfg["use_camb_tts"] = True
        if "use_camb_tts" not in added:
            added.append("use_camb_tts")

    return cfg, added


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
                cfg = json.load(f)
            merged, added = merge_config_defaults(cfg)
            _loaded_path = str(path)
            if added:
                _cached = merged
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(merged, f, ensure_ascii=False, indent=2)
                        f.write("\n")
                    print(f"[Config] Merged {len(added)} missing key(s) from config.example.json")
                except OSError as exc:
                    print(f"[Config] Merge save failed: {exc}")
                    _cached = cfg
            else:
                _cached = cfg
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
