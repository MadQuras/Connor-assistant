"""
camb_voice_clone.py — клон голоса Коннора через Camb.ai create-custom-voice.

Референс: models/connor_ref_f5.wav (короткий клип) или обрезка connor_voice.wav.
Метаданные: models/camb_connor_voice.json
"""

from __future__ import annotations

import json
import wave
from pathlib import Path
from typing import Any, Optional

import requests

from core import logger
from core.config_loader import load_config
from core.constants import MODELS_DIR
from core.proxy_guard import no_proxy_ctx

_CREATE_URL = "https://client.camb.ai/apis/create-custom-voice"
_META_PATH = MODELS_DIR / "camb_connor_voice.json"
_CONNOR_VOICE = MODELS_DIR / "connor_voice.wav"
_CONNOR_REF = MODELS_DIR / "connor_ref_f5.wav"
_TRIM_PATH = MODELS_DIR / "connor_voice_camb_ref.wav"
_MAX_REF_SEC = 28.0


def _api_key() -> str:
    return (load_config().get("camb_api_key") or "").strip()


def load_connor_voice_meta() -> Optional[dict[str, Any]]:
    if not _META_PATH.is_file():
        return None
    try:
        return json.loads(_META_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_connor_voice_meta(meta: dict[str, Any]) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    _META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return _META_PATH


def resolve_voice_id(cfg: Optional[dict] = None) -> int:
    """voice_id: config → camb_connor_voice.json → дефолт."""
    c = cfg or load_config()
    vid = c.get("camb_voice_id")
    if vid is not None:
        try:
            n = int(vid)
            if n > 0:
                return n
        except (TypeError, ValueError):
            pass
    meta = load_connor_voice_meta()
    if meta and meta.get("voice_id"):
        return int(meta["voice_id"])
    return 147320


def _trim_wav(src: Path, dst: Path, max_sec: float) -> Path:
    with wave.open(str(src), "rb") as w:
        rate = w.getframerate()
        nch = w.getnchannels()
        samp = w.getsampwidth()
        max_frames = int(rate * max_sec)
        frames = w.readframes(max_frames)
    dst.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dst), "wb") as out:
        out.setnchannels(nch)
        out.setsampwidth(samp)
        out.setframerate(rate)
        out.writeframes(frames)
    return dst


def prepare_upload_ref() -> Path:
    """Файл для загрузки в Camb (10–30 с)."""
    if _CONNOR_REF.is_file() and _CONNOR_REF.stat().st_size > 1000:
        return _CONNOR_REF
    if not _CONNOR_VOICE.is_file():
        raise FileNotFoundError(
            f"Нет {_CONNOR_REF.name} и {_CONNOR_VOICE.name} в {MODELS_DIR}"
        )
    logger.log_system(f"[Camb] обрезка {_CONNOR_VOICE.name} → {_TRIM_PATH.name}")
    return _trim_wav(_CONNOR_VOICE, _TRIM_PATH, _MAX_REF_SEC)


def create_connor_clone(
    *,
    voice_name: str = "Connor RK800",
    language: str = "ru-ru",
    force: bool = False,
) -> dict[str, Any]:
    """
    Загрузить референс в Camb, сохранить voice_id в camb_connor_voice.json.
    force=True — пересоздать даже если метаданные уже есть.
    """
    key = _api_key()
    if not key:
        raise RuntimeError("camb_api_key не задан в config.json")

    if not force:
        existing = load_connor_voice_meta()
        if existing and existing.get("voice_id"):
            logger.log_system(f"[Camb] клон уже есть: voice_id={existing['voice_id']}")
            return existing

    ref = prepare_upload_ref()
    cfg = load_config()
    lang = (cfg.get("camb_language") or language).strip() or language
    name = (cfg.get("camb_voice_name") or voice_name).strip() or voice_name

    with ref.open("rb") as f:
        with no_proxy_ctx():
            r = requests.post(
                _CREATE_URL,
                headers={"x-api-key": key},
                files={"file": (ref.name, f, "audio/wav")},
                data={
                    "voice_name": name,
                    "gender": "1",
                    "description": "Connor RK800 android voice clone",
                    "language": lang,
                    "enhance_audio": "true",
                },
                timeout=180,
            )
    if r.status_code >= 400:
        raise RuntimeError(f"Camb create-custom-voice HTTP {r.status_code}: {r.text[:500]}")

    data = r.json()
    voice_id = data.get("voice_id")
    if not voice_id:
        raise RuntimeError(f"Camb не вернул voice_id: {data}")

    meta = {
        "voice_id": int(voice_id),
        "voice_name": name,
        "language": lang,
        "reference_file": ref.name,
        "source": "connor_voice.wav",
    }
    save_connor_voice_meta(meta)
    logger.log_system(f"[Camb] клон Коннора создан: voice_id={voice_id}")
    return meta


def apply_to_config(voice_id: int, voice_name: str = "Connor RK800") -> None:
    """Записать voice_id в config.json рядом с проектом."""
    from core.config_loader import save_config

    save_config(
        {
            "camb_voice_id": int(voice_id),
            "camb_voice_name": voice_name,
            "use_camb_tts": True,
            "tts_backend": "camb",
        }
    )
