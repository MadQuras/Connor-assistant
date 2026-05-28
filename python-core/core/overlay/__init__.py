"""
Пакет overlay — PyQt5 UI поверх рабочего стола.

Импорт для main.py:
  from core.overlay import OverlayController, get_overlay

Компоненты:
  controller — singleton, run_loop() в main thread
  text_panel — слева, ответы LLM и Коннора
  wave_panel — волна при активации
  status_bar — CONNOR — слушаю / ожидание
  boot_splash — загрузка Silero/Whisper
"""

from core.overlay.controller import OverlayController, get_overlay

__all__ = ["OverlayController", "get_overlay"]
