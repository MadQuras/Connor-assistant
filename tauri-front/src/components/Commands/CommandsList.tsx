const COMMANDS = [
  // АКТИВАЦИЯ
  { phrase: 'Коннор',                      desc: 'Активация ассистента',                   cat: 'АКТИВАЦИЯ' },
  { phrase: 'Коннор, спи',                  desc: 'Переход в режим ожидания',               cat: 'АКТИВАЦИЯ' },
  // ПРИЛОЖЕНИЯ
  { phrase: 'Коннор, открой [приложение]',  desc: 'Запуск из кэша или Start Menu',          cat: 'ПРИЛОЖЕНИЯ' },
  { phrase: 'Коннор, открой загрузки',      desc: 'Папка Загрузки в проводнике',            cat: 'ПРИЛОЖЕНИЯ' },
  { phrase: 'Коннор, очисти корзину',       desc: 'Удаление файлов из корзины',             cat: 'ПРИЛОЖЕНИЯ' },
  // МУЗЫКА
  { phrase: 'Коннор, включи музыку',        desc: 'Открыть музыкальный плеер',              cat: 'МУЗЫКА' },
  { phrase: 'Коннор, включи [трек]',        desc: 'Поиск и воспроизведение трека',          cat: 'МУЗЫКА' },
  { phrase: 'Коннор, пауза / возобнови',    desc: 'Пауза или продолжение воспроизведения',  cat: 'МУЗЫКА' },
  { phrase: 'Коннор, следующий трек',       desc: 'Переключить на следующий трек',          cat: 'МУЗЫКА' },
  { phrase: 'Коннор, предыдущий трек',      desc: 'Переключить на предыдущий трек',         cat: 'МУЗЫКА' },
  // ИНФОРМАЦИЯ
  { phrase: 'Коннор, найди [запрос]',       desc: 'Поиск в браузере по запросу',            cat: 'ИНФОРМАЦИЯ' },
  { phrase: 'Коннор, какая погода',         desc: 'Текущие погодные условия',               cat: 'ИНФОРМАЦИЯ' },
  { phrase: 'Коннор, сколько времени',      desc: 'Текущее время и дата',                   cat: 'ИНФОРМАЦИЯ' },
  { phrase: 'Коннор, о чём я просил',       desc: 'Список заметок из памяти',               cat: 'ИНФОРМАЦИЯ' },
  { phrase: 'Коннор, запомни [текст]',      desc: 'Сохранить заметку в память',             cat: 'ИНФОРМАЦИЯ' },
  // СИСТЕМА
  { phrase: 'Коннор, громче / тише',        desc: 'Регулировка громкости системы',          cat: 'СИСТЕМА' },
  { phrase: 'Коннор, заблокируй',           desc: 'Блокировка рабочей станции',             cat: 'СИСТЕМА' },
  { phrase: 'Коннор, выключи ПК',           desc: 'Завершение работы с подтверждением',     cat: 'СИСТЕМА' },
];

const CATS = ['АКТИВАЦИЯ', 'ПРИЛОЖЕНИЯ', 'МУЗЫКА', 'ИНФОРМАЦИЯ', 'СИСТЕМА'];

export function CommandsList() {
  return (
    <>
      {CATS.map((cat) => {
        const items = COMMANDS.filter((c) => c.cat === cat);
        return (
          <div key={cat}>
            <div className="sec-hd">
              <div className="sec-title">{cat}</div>
              <div className="sec-line" />
              <div className="sec-badge">{items.length}</div>
            </div>
            <div className="cmd-list">
              {items.map((c) => (
                <div className="cmd-item" key={c.phrase}>
                  <div className="cmd-phrase">{c.phrase}</div>
                  <div className="cmd-sep">→</div>
                  <div className="cmd-desc">{c.desc}</div>
                  <div className="cmd-ind on" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
