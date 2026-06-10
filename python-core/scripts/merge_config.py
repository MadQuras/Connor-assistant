#!/usr/bin/env python3
"""
merge_config.py — дописать в config.json недостающие ключи из config.example.json.

Не затирает существующие значения пользователя.
Если camb_api_key задан (не placeholder) — включает use_camb_tts.

Usage:
  py python-core/scripts/merge_config.py
  py python-core/scripts/merge_config.py --root "C:\\...\\Connor RK800"
  py python-core/scripts/merge_config.py --write --quiet
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_PLACEHOLDERS = frozenset({
    "",
    "YOUR_GEMINI_API_KEY_HERE",
    "YOUR_CAMB_API_KEY_HERE",
})


def _detect_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    # python-core/scripts/merge_config.py → repo root
    return Path(__file__).resolve().parents[2]


def merge_config(root: Path, *, write: bool = True) -> tuple[dict, list[str]]:
    example_path = root / "config.example.json"
    config_path = root / "config.json"

    if not example_path.is_file():
        raise FileNotFoundError(f"config.example.json not found: {example_path}")

    with open(example_path, encoding="utf-8") as f:
        defaults = json.load(f)

    if config_path.is_file():
        with open(config_path, encoding="utf-8") as f:
            cfg = json.load(f)
    else:
        cfg = {}

    added: list[str] = []
    for key, value in defaults.items():
        if key not in cfg:
            cfg[key] = value
            added.append(key)

    camb_key = str(cfg.get("camb_api_key") or "").strip()
    if camb_key and camb_key not in _PLACEHOLDERS and not cfg.get("use_camb_tts"):
        cfg["use_camb_tts"] = True
        if "use_camb_tts" not in added:
            added.append("use_camb_tts (auto: camb key present)")

    if write and (added or not config_path.is_file()):
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return cfg, added


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge config.example.json into config.json")
    parser.add_argument("--root", help="Connor project root (default: auto)")
    parser.add_argument("--write", action="store_true", default=True)
    parser.add_argument("--dry-run", action="store_true", help="Show keys only, do not write")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    root = _detect_root(args.root)
    try:
        _, added = merge_config(root, write=not args.dry_run)
    except FileNotFoundError as exc:
        print(f"[merge_config] ERROR: {exc}", file=sys.stderr)
        return 1

    if not args.quiet:
        if added:
            print(f"[merge_config] {root / 'config.json'}")
            print(f"[merge_config] Added {len(added)} key(s):")
            for k in added:
                print(f"  + {k}")
        else:
            print(f"[merge_config] OK — no missing keys ({root / 'config.json'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
