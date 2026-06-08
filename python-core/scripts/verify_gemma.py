"""
verify_gemma.py — проверка подключения Gemma 4 (Ollama) к Коннору.

Запуск из корня проекта:
  py -3.11 python-core/scripts/verify_gemma.py
  py -3.11 python-core/scripts/verify_gemma.py --show   # + реплика в панели Коннора
  py -3.11 python-core/scripts/verify_gemma.py --e2e    # полный цикл respond(WEATHER)
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.config_loader import load_config
from openjarvis.llm_client import backend, verify_gemma_connection


def main() -> int:
    load_config()
    show = "--show" in sys.argv
    e2e = "--e2e" in sys.argv

    print(f"LLM backend: {backend()}")
    print("Проверка Ollama…")

    status = verify_gemma_connection(full_test=True)
    print(json.dumps(status, ensure_ascii=False, indent=2))

    if not status.get("ok"):
        print("\n❌ Gemma НЕ подключена. Запустите: ollama serve && ollama run gemma4:e4b")
        return 1

    print(f"\n✓ Gemma OK — модель {status.get('model')}")
    if status.get("test_reply"):
        print(f"  Тестовая реплика: {status['test_reply']}")

    if show or e2e:
        # Qt нужен для overlay
        from openjarvis.connor_ui import show_connor
        if show and status.get("test_reply"):
            show_connor(status["test_reply"], auto_hide_ms=10000)
            print("  → реплика отправлена в панель КОННОР")

    if e2e:
        print("\nE2E: generate_connor_reply(WEATHER, «какая погода»)…")
        from openjarvis.connor_response import generate_connor_reply
        reply = generate_connor_reply("WEATHER", "какая погода", timeout=60)
        if reply:
            print(f"  Ответ Коннора: {reply}")
            from openjarvis.connor_ui import show_connor
            show_connor(reply, auto_hide_ms=10000)
            if show or e2e:
                from core.overlay import get_overlay
                print("  → откройте overlay (окно Коннора слева). Ctrl+C для выхода.")
                get_overlay().run_loop()
        else:
            print("  ❌ Пустой ответ")
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
