"""
base.py — базовый класс handler (опционально).

Каждый handler может быть функцией handle(arg, original_text="")
или классом:
  class AppsHandler(BaseHandler):
      category = "APPS"
      def run(self, ctx: CommandContext) -> None: ...

Общие шаги в run():
  1. overlay.show_text + audio_catalog.phrase
  2. play_key стартовый WAV
  3. выполнить действие
  4. play_key финальный WAV
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from openjarvis.context import CommandContext


class BaseHandler(ABC):
    category: str = "UNKNOWN"

    @abstractmethod
    def run(self, ctx: CommandContext) -> None:
        ...

    def __call__(self, arg: str, original_text: str = "") -> None:
        self.run(CommandContext(original_text=original_text or arg, arg=arg, category=self.category))
