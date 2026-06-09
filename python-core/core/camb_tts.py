"""
camb_tts.py — синтез речи через Camb.ai (POST /tts-stream).

Документация: https://docs.camb.ai/api-reference/endpoint/create-tts-stream
"""

from __future__ import annotations

import hashlib
import re
import threading
from pathlib import Path
from typing import Optional

import requests

from core import logger
from core.config_loader import load_config
from core.constants import MODELS_DIR

_API_URL = "https://client.camb.ai/apis/tts-stream"
_CACHE_DIR = MODELS_DIR / "tts_cache"
_inflight: dict[str, threading.Event] = {}
_inflight_lock = threading.Lock()


def _api_key() -> str:
    return (load_config().get("camb_api_key") or "").strip()


def is_configured() -> bool:
    return bool(_api_key())


def _normalize_text(text: str) -> str:
    from openjarvis.connor_prompts import sanitize_connor_reply

    t = sanitize_connor_reply(re.sub(r"\s+", " ", (text or "").strip()))
    if len(t) < 3:
        t = (t + " …").strip()[:3000]
    return t[:3000]


def _cache_path(text: str, voice_id: int, language: str, model: str) -> Path:
    key = f"{voice_id}|{language}|{model}|{text}"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR / f"camb_{digest}.wav"


def _cache_key(norm: str, voice_id: int, language: str, model: str) -> str:
    return f"{voice_id}|{language}|{model}|{norm}"


def synthesize(text: str, *, use_cache: bool = True) -> Optional[Path]:
    """Синтез → WAV на диск. None при ошибке. Дедуп параллельных запросов."""
    if not is_configured():
        logger.log_system("[Camb] camb_api_key не задан")
        return None

    cfg = load_config()
    from core.camb_voice_clone import resolve_voice_id

    voice_id = resolve_voice_id(cfg)
    language = cfg.get("camb_language", "ru-ru")
    model = cfg.get("camb_speech_model", "mars-8.1-flash-beta")
    sample_rate = int(cfg.get("camb_sample_rate", 44100))

    norm = _normalize_text(text)
    if not norm:
        return None

    out = _cache_path(norm, voice_id, language, model)
    if use_cache and out.is_file() and out.stat().st_size > 44:
        logger.log_system(f"[Camb] cache hit ({len(norm)} симв.)")
        return out

    ck = _cache_key(norm, voice_id, language, model)
    waiter: Optional[threading.Event] = None
    with _inflight_lock:
        ev = _inflight.get(ck)
        if ev is not None:
            waiter = ev
        else:
            _inflight[ck] = threading.Event()

    if waiter is not None:
        waiter.wait(timeout=float(cfg.get("camb_timeout_sec", 60)) + 5)
        if out.is_file() and out.stat().st_size > 44:
            return out
        return None

    try:
        payload = {
            "text": norm,
            "voice_id": voice_id,
            "language": language,
            "speech_model": model,
            "output_configuration": {"format": "wav", "sample_rate": sample_rate},
        }
        timeout = float(cfg.get("camb_timeout_sec", 60))
        from core.proxy_guard import no_proxy_ctx
        with no_proxy_ctx():
            r = requests.post(
                _API_URL,
                headers={
                    "x-api-key": _api_key(),
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout,
                stream=True,
            )
        r.raise_for_status()
        tmp = out.with_suffix(".part")
        with tmp.open("wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
        if tmp.stat().st_size < 44:
            tmp.unlink(missing_ok=True)
            logger.log_system("[Camb] пустой аудиопоток")
            return None
        tmp.replace(out)
        logger.log_system(f"[Camb] синтез OK ({len(norm)} симв., {out.stat().st_size} байт)")
        return out
    except Exception as e:
        logger.log_error(f"[Camb] synthesize: {e}")
        out.with_suffix(".part").unlink(missing_ok=True)
        return None
    finally:
        with _inflight_lock:
            ev = _inflight.pop(ck, None)
        if ev:
            ev.set()


def wav_duration_ms(path: Path) -> int:
    import wave

    try:
        with wave.open(str(path), "rb") as w:
            rate = w.getframerate()
            if rate <= 0:
                return 0
            return int(1000 * w.getnframes() / rate)
    except Exception:
        return 0


def play_path(path: Path, *, block: bool = False) -> bool:
    from core import tts_player

    tts_player.play_file(str(path), block=block)
    return True


def speak(text: str, *, block: bool = False) -> bool:
    path = synthesize(text)
    if not path:
        return False
    return play_path(path, block=block)
