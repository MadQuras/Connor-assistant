"""
memory_store.py — работа с models/memory.json.

class MemoryStore:
  load() -> dict
  save() -> None
  get_user_name() -> str
  set_first_run(False)
  increment_wake_count()
  set_last_app(name), get_apps_cache() -> list

Поля doc: first_run, user_name, wake_count, last_app, last_search, apps_cache, preferences
"""

from __future__ import annotations

import json
from typing import Any, List

from core.constants import MODELS_DIR


class MemoryStore:
    def __init__(self) -> None:
        self.path = MODELS_DIR / "memory.json"

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save(self, data: dict[str, Any]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_user_name(self) -> str:
        return self.load().get("user_name", "Лейтенант")

    def increment_wake_count(self) -> None:
        d = self.load()
        d["wake_count"] = d.get("wake_count", 0) + 1
        self.save(d)

    def get_apps_cache(self) -> List[str]:
        return list(self.load().get("apps_cache", []))
