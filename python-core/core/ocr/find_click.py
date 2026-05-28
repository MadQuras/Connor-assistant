"""
find_click.py — OCR координат слова на экране для pyautogui.click.

find_text_click_point(*keywords) -> (x, y) | None
  - pytesseract image_to_data
  - match keywords (слушать, play, …)

Запуск через py -3.14 inline script (см. реализацию в скелете ниже).
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from typing import Optional, Tuple

_CLICK_SCRIPT = '''
import json, sys
import pyautogui
import pytesseract

keywords = sys.argv[1].lower().split("|")
data = pytesseract.image_to_data(pyautogui.screenshot(), lang="rus+eng",
    output_type=pytesseract.Output.DICT)
best = None
for i, word in enumerate(data["text"]):
    w = (word or "").strip().lower()
    if not w: continue
    for kw in keywords:
        if kw in w or w in kw:
            conf = int(data["conf"][i]) if str(data["conf"][i]).isdigit() else 0
            if conf < 40: continue
            x = data["left"][i] + data["width"][i] // 2
            y = data["top"][i] + data["height"][i] // 2
            if not best or conf > best[0]:
                best = (conf, x, y)
if best:
    print(json.dumps({"x": best[1], "y": best[2]}))
else:
    print(json.dumps({"x": None, "y": None}))
'''


def find_text_click_point(*keywords: str, timeout: float = 25.0) -> Optional[Tuple[int, int]]:
    if not keywords:
        return None
    script = os.path.join(tempfile.gettempdir(), "connor_ocr_click.py")
    with open(script, "w", encoding="utf-8") as f:
        f.write(_CLICK_SCRIPT)
    kw = "|".join(k.lower() for k in keywords)
    try:
        proc = subprocess.run(
            f'py -3.14 "{script}" "{kw}"',
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
        )
        line = proc.stdout.strip().splitlines()[-1]
        data = json.loads(line)
        x, y = data.get("x"), data.get("y")
        if x is not None and y is not None:
            return int(x), int(y)
    except Exception as e:
        print(f"[OCR click] {e}")
    finally:
        if os.path.exists(script):
            try:
                os.remove(script)
            except OSError:
                pass
    return None
