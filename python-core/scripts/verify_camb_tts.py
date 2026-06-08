"""
verify_camb_tts.py — проверка Camb.ai TTS.

  py -3.11 python-core/scripts/verify_camb_tts.py
  py -3.11 python-core/scripts/verify_camb_tts.py --play
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.config_loader import load_config
from core.tts_engine import speak_text, verify_camb


def main() -> int:
    load_config()
    play = "--play" in sys.argv
    print("Проверка Camb TTS…")
    status = verify_camb()
    print(json.dumps(status, ensure_ascii=False, indent=2))
    if not status.get("ok"):
        print("\n❌ Camb TTS не работает. Задайте camb_api_key и camb_voice_id в config.json")
        print("   Ключ: https://studio.camb.ai → API Keys")
        return 1
    print("\n✓ Camb TTS OK")
    if play:
        print("Воспроизведение…")
        speak_text("Коннор на связи, лейтенант.", block=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
