"""List Camb.ai voices — helper script."""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import requests
from core.config_loader import load_config
from core.proxy_guard import no_proxy_ctx

KEY = sys.argv[1] if len(sys.argv) > 1 else load_config().get("camb_api_key", "")

with no_proxy_ctx():
    r = requests.get(
        "https://client.camb.ai/apis/list-voices",
        headers={"x-api-key": KEY.strip()},
        timeout=30,
    )
print("status:", r.status_code)
data = r.json()
voices = data if isinstance(data, list) else data.get("voices") or data.get("data") or []
print("total:", len(voices))
for v in voices:
    if not isinstance(v, dict):
        continue
    blob = json.dumps(v, ensure_ascii=False).lower()
    if "ru" in blob or "rus" in blob or "russian" in blob:
        print(json.dumps(v, ensure_ascii=False))
