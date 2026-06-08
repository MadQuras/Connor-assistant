"""
connor_response.py — Gemini-powered response generator with Connor's personality.

Usage:
    from openjarvis.connor_response import respond

    respond("TIME", original_text="который час")
    # → shows Gemini text in overlay, plays audio with 10 % probability
"""
from __future__ import annotations

import threading
from typing import Optional

from core import logger

# Categories where the handler's own visual output IS the answer — no Gemini text.
# TIME  → big clock in overlay
# VOLUME → volume-level readout
_VISUAL_ONLY = {"TIME", "VOLUME"}

# Categories excluded from random audio (their handlers call maybe_play themselves).
_NO_AUDIO = {"UNKNOWN", "APPS", "MUSIC", "SEARCH", "WEATHER", "PLANS"}

_PROMPT = """\
Ты — Коннор, андроид-детектив RK800 из Detroit: Become Human. \
Ты голосовой ассистент Лейтенанта. Действие уже выполнено.

ПРАВИЛА ОТВЕТА:
- Всегда обращайся к пользователю «Лейтенант» (в ответе хотя бы раз)
- Ровно 1-2 предложения, без лишних слов
- НИКОГДА не повторяй одни и те же фразы — каждый ответ уникален
- Иногда добавляй сухой андроидный юмор или холодную констатацию факта
- Только текст на русском, без кавычек, скобок и пояснений

КАТЕГОРИЯ: {category}
СКАЗАЛ ПОЛЬЗОВАТЕЛЬ: "{text}"

ПРИМЕРЫ ПО КАТЕГОРИЯМ (не копируй дословно, варьируй):

SEARCH — поиск информации:
  «Ищу данные, Лейтенант.»
  «Запрос обрабатывается. Результат появится в браузере.»
  «Информация найдена, Лейтенант. Открываю.»
  «Поиск выполнен. Как всегда точно.»

APPS — запуск приложения:
  «Приложение запущено, Лейтенант.»
  «Выполнено. Программа открыта.»
  «Запускаю. Займёт секунду.»
  «Готово, Лейтенант. Приложение активно.»

MUSIC — управление музыкой:
  «Включаю музыку, Лейтенант.»
  «Плейлист запущен.»
  «Музыка переключена, Лейтенант.»
  «Как вы и просили. Музыка играет.»

WEATHER — погода:
  «Получаю данные о погоде, Лейтенант.»
  «Прогноз актуален. Смотрите.»
  «Погодные условия отображены.»

PLANS — заметки и планы:
  «Записал, Лейтенант. Ничего не забуду.»
  «Напоминание сохранено.»
  «Данные обновлены, Лейтенант.»
  «Ваши заметки перед вами.»

TIME — время и дата:
  «Текущее время, Лейтенант.»
  «Вот точное время.»

LOCK — блокировка экрана:
  «Экран заблокирован, Лейтенант.»
  «Доступ ограничен. Выполнено.»

SHUTDOWN — выключение:
  «Завершаю работу, Лейтенант.»
  «Система будет остановлена.»
  «Выключаю по вашему приказу.»

VOLUME — громкость:
  «Громкость изменена, Лейтенант.»
  «Параметр скорректирован.»

SYSTEM — загрузка CPU/RAM:
  «Текущая нагрузка системы, Лейтенант: …»
  «Мониторинг завершён. Показатели в норме — или нет.»

UNKNOWN — команда не распознана:
  «Не удалось интерпретировать приказ, Лейтенант. Повторите.»
  «Запрос вне моих текущих протоколов, Лейтенант.»

Ответь сейчас одной репликой Коннора — коротко, по-деловому, с лёгкой холодностью андроида."""

_CONTEXT_SUFFIX = """

ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ (включи в ответ кратко и по делу):
{context}"""


def generate_connor_reply(
    category: str,
    original_text: str = "",
    context: str = "",
    timeout: float | None = None,
) -> Optional[str]:
    from openjarvis.llm_client import generate_text, backend
    t = timeout if timeout is not None else (45.0 if backend() == "ollama" else 3.5)
    prompt = _PROMPT.format(text=original_text or category, category=category.upper())
    if context.strip():
        prompt += _CONTEXT_SUFFIX.format(context=context.strip())
    try:
        raw = generate_text(prompt, timeout=t)
        if raw:
            return raw.strip().strip('"').strip("'")
    except Exception as e:
        logger.log_error(f"connor_response llm: {e}")
    return None


def _llm_text(category: str, original_text: str, timeout: float = 3.5) -> Optional[str]:
    from openjarvis.llm_client import backend
    t = 45.0 if backend() == "ollama" else timeout
    return generate_connor_reply(category, original_text, timeout=t)



def respond(category: str, original_text: str = "") -> None:
    """
    Called after the handler has completed its action.
    Runs in a background thread so it never blocks the VAD loop.
    """
    from openjarvis.llm_client import llm_enabled_for_responses, backend

    if not llm_enabled_for_responses():
        return

    def _run() -> None:
        cat = category.upper()

        if cat not in _VISUAL_ONLY:
            text = _llm_text(cat, original_text)
            if text:
                from openjarvis.connor_ui import show_connor
                show_connor(text)
                logger.log_system(
                    f"[Gemma→КОННОР] {cat}: {text[:80]!r} (backend={backend()})"
                )
            else:
                logger.log_system(f"connor_response: пустой ответ Gemma для {cat}")

        # 10% audio — only for categories not handled by their own handler
        # (SHUTDOWN, LOCK, VOLUME, TIME). Uses maybe_play for consistent counter.
        if cat not in _NO_AUDIO:
            from core import audio_catalog as _ac
            if cat == "SHUTDOWN":
                _ac.maybe_play("resp_shutdown", "shutdown_do", block=False)
            elif cat == "LOCK":
                _ac.maybe_play("resp_lock", "lock", block=False)
            elif cat == "VOLUME":
                _ac.maybe_play("resp_volume", "app_executing", block=False)

    threading.Thread(target=_run, name="connor-response", daemon=True).start()
