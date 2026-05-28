# Connor demo script (10 stable scenarios)

1) Wake: say `Коннор` -> assistant answers and opens command window.
2) `Открой загрузки`
3) `Открой документы`
4) `Открой рабочую папку`
5) `Очисти корзину`
6) `Найди Detroit Become Human`
7) `Какая погода`
8) `Сколько времени`
9) `О чем я просил напомнить`
10) `Включи музыку`
11) `Заблокируй компьютер`
12) `Выключи компьютер` (confirm mode depends on settings)

## Fallback demo notes
- If Gemini is unavailable, fallback router still handles all 10 scenarios.
- If Yandex OCR click misses first result, media keys still control playback.
- If STT returns empty text, Connor gives retry phrase and remains in command window.

## Rehearsal check
Run:
`py -3.11 python-core/demo_hardening_10x.py`

Expected output: `run 1..10: ok` and `all 10 demo routing runs passed`.
