const COMMANDS = [
  { phrase: 'Коннор', desc: 'активация ассистента', audio: 'audio_34', on: true },
  { phrase: 'Коннор, открой [прил.]', desc: 'запуск из кэша памяти', audio: 'audio_03–05', on: true },
  { phrase: 'Коннор, включи музыку', desc: 'Yandex Music в браузере', audio: 'audio_21–23', on: true },
  { phrase: 'Коннор, следующий трек', desc: 'медиаклавиша pyautogui', audio: 'audio_32', on: true },
  { phrase: 'Коннор, стоп / пауза', desc: 'пауза воспроизведения', audio: 'audio_33', on: true },
  { phrase: 'Коннор, найди [запрос]', desc: 'поиск в браузере', audio: 'audio_14–16', on: true },
  { phrase: 'Коннор, какая погода', desc: 'данные Weather API', audio: 'audio_12–13', on: true },
  { phrase: 'Коннор, сколько времени', desc: 'текущее время системы', audio: 'audio_06–08', on: true },
  { phrase: 'Коннор, о чём я просил', desc: 'заметки из notes.db', audio: 'audio_09–11', on: true },
  { phrase: 'Коннор, громче / тише', desc: 'управление звуком pycaw', audio: 'audio_27–31', on: true },
  { phrase: 'Коннор, заблокируй', desc: 'блокировка рабочей станции', audio: 'audio_19', on: true },
  { phrase: 'Коннор, выключи ПК', desc: 'shutdown с подтверждением', audio: 'audio_19–20', on: true },
  { phrase: 'Коннор, очисти корзину', desc: 'PowerShell Clear-RecycleBin', audio: 'audio_25', on: true },
  { phrase: 'Коннор, открой загрузки', desc: 'проводник на Downloads', audio: 'audio_03', on: true },
  { phrase: 'Коннор, спи', desc: 'переход в режим ожидания', audio: 'audio_35', on: true },
];

const CATS: Record<string, string[]> = {
  'ВЗАИМОДЕЙСТВИЕ': ['Коннор', 'Коннор, спи'],
  'ПРИЛОЖЕНИЯ': ['Коннор, открой [прил.]', 'Коннор, открой загрузки', 'Коннор, очисти корзину'],
  'МУЗЫКА': ['Коннор, включи музыку', 'Коннор, следующий трек', 'Коннор, стоп / пауза'],
  'ИНФОРМАЦИЯ': ['Коннор, найди [запрос]', 'Коннор, какая погода', 'Коннор, сколько времени', 'Коннор, о чём я просил'],
  'СИСТЕМА': ['Коннор, громче / тише', 'Коннор, заблокируй', 'Коннор, выключи ПК'],
};

export function CommandsList() {
  return (
    <>
      {Object.entries(CATS).map(([cat, phrases]) => {
        const items = COMMANDS.filter((c) => phrases.includes(c.phrase));
        return (
          <div key={cat}>
            <div className="sec-hd">
              <div className="sec-title">{cat}</div>
              <div className="sec-line" />
              <div className="sec-badge">{items.length} АКТИВНЫХ</div>
            </div>
            <div className="cmd-list">
              {items.map((c) => (
                <div className="cmd-item" key={c.phrase}>
                  <div className="cmd-phrase">{c.phrase}</div>
                  <div className="cmd-sep">→</div>
                  <div className="cmd-desc">{c.desc}</div>
                  <div className="cmd-audio">{c.audio}</div>
                  <div className={`cmd-ind ${c.on ? 'on' : 'off'}`} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
