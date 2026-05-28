from __future__ import annotations

import sys

sys.path.insert(0, r"C:\Users\CompX\Connor-assistant\python-core")

from openjarvis.fallback_router import route

# All phrases as Unicode escapes to avoid terminal encoding issues
CASES = [
    ("\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438", "APPS"),                                      # загрузки
    ("\u043e\u0442\u043a\u0440\u043e\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438", "APPS"),  # открой загрузки
    ("\u043e\u0442\u043a\u0440\u043e\u0439 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b", "APPS"),  # открой документы
    ("\u0440\u0430\u0431\u043e\u0447\u0430\u044f \u043f\u0430\u043f\u043a\u0430", "APPS"),              # рабочая папка
    ("\u043e\u0447\u0438\u0441\u0442\u0438 \u043a\u043e\u0440\u0437\u0438\u043d\u0443", "APPS"),        # очисти корзину
    ("\u043d\u0430\u0439\u0434\u0438 detroit become human", "SEARCH"),                                   # найди detroit
    ("\u043a\u0430\u043a\u0430\u044f \u043f\u043e\u0433\u043e\u0434\u0430", "WEATHER"),                 # какая погода
    ("\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438", "TIME"),  # сколько времени
    ("\u0437\u0430\u043f\u043e\u043c\u043d\u0438 \u043a\u0443\u043f\u0438\u0442\u044c \u0432\u043e\u0434\u0443", "PLANS"),  # запомни купить воду
    ("\u043d\u0430\u043f\u043e\u043c\u043d\u0438 \u043f\u0440\u043e \u0432\u0441\u0442\u0440\u0435\u0447\u0443", "PLANS"),  # напомни про встречу
    ("\u0432\u043a\u043b\u044e\u0447\u0438 \u043c\u0443\u0437\u044b\u043a\u0443", "MUSIC"),             # включи музыку
    ("\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0442\u0440\u0435\u043a", "MUSIC"),       # следующий трек
    ("\u0441\u0434\u0435\u043b\u0430\u0439 \u0433\u0440\u043e\u043c\u0447\u0435", "VOLUME"),            # сделай громче
    ("\u0442\u0438\u0448\u0435", "VOLUME"),                                                              # тише
    ("\u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u0443\u0439 \u043a\u043e\u043c\u043f\u044c\u044e\u0442\u0435\u0440", "LOCK"),      # заблокируй компьютер
    ("\u0432\u044b\u043a\u043b\u044e\u0447\u0438 \u043a\u043e\u043c\u043f\u044c\u044e\u0442\u0435\u0440", "SHUTDOWN"),  # выключи компьютер
]


def run_once(idx: int) -> None:
    for phrase, expected in CASES:
        cat, _arg = route(phrase)
        if cat != expected:
            raise AssertionError(f"run {idx}: expected {expected!r}, got {cat!r}")


def main() -> None:
    for i in range(1, 11):
        run_once(i)
        print(f"run {i}: {len(CASES)} cases ok")
    print(f"all 10 routing runs passed ({len(CASES)} phrases)")


if __name__ == "__main__":
    main()
