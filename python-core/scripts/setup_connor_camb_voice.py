"""
setup_connor_camb_voice.py — клон голоса Коннора в Camb.ai.

Копирует референс из models/connor_voice.wav (или connor_ref_f5.wav),
загружает в Camb create-custom-voice, пишет camb_connor_voice.json и config.json.

  py -3.11 python-core/scripts/setup_connor_camb_voice.py
  py -3.11 python-core/scripts/setup_connor_camb_voice.py --force
  py -3.11 python-core/scripts/setup_connor_camb_voice.py --play
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.camb_voice_clone import apply_to_config, create_connor_clone, load_connor_voice_meta
from core.config_loader import load_config
from core.tts_engine import speak_text


def main() -> int:
    load_config()
    force = "--force" in sys.argv
    play = "--play" in sys.argv

    print("Клон голоса Коннора (Camb.ai)…")
    try:
        meta = create_connor_clone(force=force)
    except Exception as e:
        print(f"\n❌ {e}")
        return 1

    apply_to_config(meta["voice_id"], meta.get("voice_name", "Connor RK800"))
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"\n✓ voice_id={meta['voice_id']} — записан в config.json")

    if play:
        print("Воспроизведение…")
        speak_text("Коннор на связи, лейтенант. Готов к выполнению приказов.", block=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
