"""
screen_text.py — полный OCR экрана (pytesseract).

capture_screen_text() -> str
  - py -3.14 helper script
  - screenshot PNG -> image_to_string rus+eng

get_context_summary() -> str — первые 20 строк для LLM (будущее)

Использование: НЕ на каждую команду; music fallback, «что на экране» позже.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile

_OCR_SCRIPT = '''
import json, sys
import pyautogui
import pytesseract

img = pyautogui.screenshot()
text = pytesseract.image_to_string(img, lang="rus+eng")
print(json.dumps({"text": text.strip()[:4000]}, ensure_ascii=False))
'''


def capture_screen_text(timeout: float = 30.0) -> str:
    script = os.path.join(tempfile.gettempdir(), "connor_ocr_screen.py")
    with open(script, "w", encoding="utf-8") as f:
        f.write(_OCR_SCRIPT)
    try:
        proc = subprocess.run(
            f'py -3.14 "{script}"',
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
        )
        if proc.returncode != 0:
            print(f"[OCR] {proc.stderr}")
            return ""
        line = proc.stdout.strip().splitlines()[-1]
        return json.loads(line).get("text", "")
    except Exception as e:
        print(f"[OCR] {e}")
        return ""
    finally:
        if os.path.exists(script):
            try:
                os.remove(script)
            except OSError:
                pass


def get_context_summary() -> str:
    text = capture_screen_text()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()][:20]
    return " | ".join(lines)
