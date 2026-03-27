import argparse
import json
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=int, default=16000)
    args = parser.parse_args()

    try:
        from vosk import Model, KaldiRecognizer
    except Exception as e:
        # Сообщаем Node, что Vosk на Python стороне не доступен.
        sys.stdout.write(f"PYTHON_VOSK_IMPORT_ERROR:{e}\n")
        sys.stdout.flush()
        return 2

    model_path = args.model
    sample_rate = args.sample_rate

    try:
        model = Model(model_path)
        rec = KaldiRecognizer(model, sample_rate)
        try:
            rec.SetWords(True)
        except Exception:
            pass
        try:
            rec.SetPartialWords(True)
        except Exception:
            pass
    except Exception as e:
        sys.stdout.write(f"PYTHON_VOSK_INIT_ERROR:{e}\n")
        sys.stdout.flush()
        return 3

    # Сигнал готовности
    sys.stdout.write("READY\n")
    sys.stdout.flush()

    last_partial = ""
    last_partial_ts = 0.0

    # Читаем PCM S16_LE моно (байты) из stdin.
    # Пакеты приходят “как есть” — Vosk сам буферизирует до конца фраз.
    while True:
        data = sys.stdin.buffer.read(4096)
        if not data:
            break

        try:
            # accept_waveform возвращает True, когда распознана законченная фраза
            finalized = rec.AcceptWaveform(data)

            if finalized:
                res = rec.Result()
                try:
                    obj = json.loads(res)
                except Exception:
                    obj = {}
                text = obj.get("text", "").strip()
                if text:
                    sys.stdout.write(json.dumps({"text": text}) + "\n")
                    sys.stdout.flush()
            else:
                # Частичный результат полезен для wake-word
                now = time.time()
                if now - last_partial_ts > 0.2:
                    part = rec.PartialResult()
                    try:
                        pobj = json.loads(part)
                    except Exception:
                        pobj = {}
                    partial = (pobj.get("partial") or "").strip()
                    if partial and partial != last_partial:
                        last_partial = partial
                        last_partial_ts = now
                        sys.stdout.write(json.dumps({"text": partial}) + "\n")
                        sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(f"PYTHON_VOSK_RUNTIME_ERROR:{e}\n")
            sys.stdout.flush()
            return 4

    # EOF: финальный слив
    try:
        final_res = rec.FinalResult()
        try:
            fobj = json.loads(final_res)
        except Exception:
            fobj = {}
        text = (fobj.get("text") or "").strip()
        if text:
            sys.stdout.write(json.dumps({"text": text}) + "\n")
            sys.stdout.flush()
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

