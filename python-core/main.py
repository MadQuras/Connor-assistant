from __future__ import annotations

import os
import sys
import traceback

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core import audio_catalog
from core.config_loader import load_config


def _write_flag(ready: bool) -> None:
    try:
        from pathlib import Path
        flag = Path(__file__).parent / "models" / "python_ready.flag"
        flag.parent.mkdir(parents=True, exist_ok=True)
        flag.write_text("1" if ready else "0")
    except Exception:
        pass


def main() -> None:
    load_config()

    # Reset flag from any previous run
    _write_flag(False)

    # ── Phase 0b: Gemma 4 (Ollama) ───────────────────────────────────────────
    try:
        from openjarvis.llm_client import backend, verify_gemma_connection
        if backend() == "ollama":
            print("[Connor] Проверка Gemma 4 (Ollama)…", flush=True)
            gemma = verify_gemma_connection(full_test=True)
            if gemma.get("ok"):
                print(f"[Connor] ✓ Gemma подключена: {gemma.get('model')}", flush=True)
                if gemma.get("test_reply"):
                    print(f"[Connor]   Тест: {gemma['test_reply']}", flush=True)
            else:
                print(f"[Connor] ✗ Gemma: {gemma.get('error')}", flush=True)
    except Exception as exc:
        print(f"[Connor] Gemma verify skip: {exc}", flush=True)

    # ── Phase 0: Auto-detect music player ─────────────────────────────────────
    # Updates config["music_backend"] if not already set by user.
    try:
        from core.player_detector import detect_and_apply as _detect_player
        _detect_player()
    except Exception:
        pass

    # ── Phase 1: Play time greeting immediately (before Whisper loads) ────────
    # Audio runs via pygame, independent of ctranslate2 — safe to call first.
    audio_catalog.play_time_greeting(block=False)

    # ── Phase 2: Load Whisper in main thread (before Qt) ──────────────────────
    # ctranslate2 conflicts with Qt threading when loaded concurrently.
    # Loading synchronously here avoids the Access Violation.
    from core.stt_worker import STTWorker
    stt = STTWorker()
    try:
        print("[Connor] Загрузка Whisper (base)…", flush=True)
        stt._load()
        print("[Connor] Whisper готов.", flush=True)
    except Exception:
        traceback.print_exc()

    # ── Phase 2: Create pipeline ───────────────────────────────────────────────
    from core.pipeline import VoicePipeline
    pipeline = VoicePipeline(stt=stt)
    pipeline._stt_ready.set()

    # ── Phase 3: Start Qt overlay ──────────────────────────────────────────────
    from core.overlay import get_overlay
    overlay = get_overlay()

    # ── Phase 4: Start VAD + signal ready (background thread) ─────────────────
    import threading

    def _boot_pipeline() -> None:
        try:
            # Scan Start Menu shortcuts so launch_app() can find installed apps.
            # Runs in background so it doesn't block VAD startup.
            try:
                from core.scanner.window_scanner import scan_apps_to_memory
                scan_apps_to_memory()
            except Exception:
                pass

            pipeline.start()
            pipeline._pipeline_ready.wait(timeout=30)
            _write_flag(True)
        except Exception:
            traceback.print_exc()
            _write_flag(False)

    threading.Thread(target=_boot_pipeline, name="connor-boot", daemon=True).start()

    try:
        overlay.run_loop()
    finally:
        pipeline.stop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception:
        try:
            from pathlib import Path
            crash = Path(__file__).parent / "models" / "crash.log"
            crash.write_text(traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass
        sys.exit(1)
