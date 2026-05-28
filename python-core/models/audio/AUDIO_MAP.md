# Карта аудио Connor RK800

Источник истины: `AUDIO_MAP.json` (фразы + `handler_keys` для кода).

## startup/

| Файл | Реплика |
|------|---------|
| audio_25.wav | Готов к работе. Жду ваши команды |
| audio_26.wav | Все модули в норме. Чем могу помочь сегодня? |
| audio_27.wav | Доброе утро, Лейтенант… |
| audio_28.wav | Добрый день, Лейтенант… |
| audio_29.wav | Добрый вечер, Лейтенант… |
| audio_30.wav | А разве уже не ночь?… |
| audio_34.wav | Да, чем я могу вам помочь |

## commands/

| audio_02 | Выполняю, хотя андроиды справились бы лучше |
| audio_03 | Приложение найдено. Открываю |
| audio_04 | Выполняю. Займет пару секунд |
| audio_05 | Готово. Приложение запущено |
| audio_17 | Игра найдена. Запускаю |
| audio_18 | Запускаю. Статистика прошлой сессии… |

## music/

| audio_21–23 | Запуск плеера |
| audio_24 | Воспроизведение / управление |
| audio_31 | Golden Brown |

## search/ — audio_14–16 · weather/ — audio_12–13 · shutdown/ — audio_19–20

## plans/

| audio_09 | Напоминания найдены |
| audio_10 | Расписание |
| audio_11 | **О чём просили напомнить** |

## errors/ — audio_06–08 · system/ — audio_01 (блокировка), audio_34 (wake)

## Использование в коде

```python
from core.audio_catalog import play_key, phrase, play_time_greeting

play_key('wake')
play_key('plans_recall')
play_time_greeting()
```
