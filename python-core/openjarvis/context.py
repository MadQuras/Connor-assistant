"""
context.py — контекст одной голосовой команды.

@dataclass CommandContext:
  original_text: str      # полная фраза STT
  arg: str                # аргумент от роутера
  category: str
  trace_id: str           # uuid для логов

Передаётся в handlers.handle(ctx) при рефакторинге.
Пока handlers используют (arg, original_text) — совместимость.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import uuid


@dataclass
class CommandContext:
    original_text: str = ""
    arg: str = ""
    category: str = ""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
