const PLANNED = [
  { name: 'Освещение', desc: 'Arduino relay — управление светом голосом', status: 'ПЛАНИРУЕТСЯ' },
  { name: 'Шторы', desc: 'сервопривод — «Коннор, открой шторы»', status: 'ПЛАНИРУЕТСЯ' },
  { name: 'Температура', desc: 'датчик DHT22 — мониторинг помещения', status: 'ПЛАНИРУЕТСЯ' },
  { name: 'USB-хаб', desc: 'управление питанием периферии', status: 'ПЛАНИРУЕТСЯ' },
];

export function DevicesStub() {
  return (
    <>
      <div>
        <div className="sec-hd">
          <div className="sec-title">МОДУЛЬ УМНОГО ДОМА</div>
          <div className="sec-line" />
          <div className="sec-badge">В РАЗРАБОТКЕ</div>
        </div>
        <div className="stub-section">
          <div className="stub-icon">⬡</div>
          <div className="stub-title">ARDUINO · RK800</div>
          <div className="stub-desc">
            Модуль управления умным домом в разработке.<br />
            Голосовые команды для управления освещением, шторами и микроклиматом
            появятся в следующей фазе проекта.
          </div>
          <div className="stub-chip">ПРОТОКОЛ: Serial USB · 9600 baud</div>
        </div>
      </div>

      <div>
        <div className="sec-hd">
          <div className="sec-title">ЗАПЛАНИРОВАННЫЕ УСТРОЙСТВА</div>
          <div className="sec-line" />
        </div>
        <div className="info-grid">
          {PLANNED.map((d) => (
            <div className="info-r" key={d.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="info-k">{d.name}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>{d.desc}</div>
              </div>
              <div className="info-v" style={{ fontSize: 9, color: 'rgba(0,180,216,0.3)', letterSpacing: 1 }}>
                {d.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="sec-hd">
          <div className="sec-title">СИСТЕМНАЯ ИНФОРМАЦИЯ</div>
          <div className="sec-line" />
        </div>
        <div className="info-grid">
          <div className="info-r">
            <div className="info-k">ПРОТОКОЛ СВЯЗИ</div>
            <div className="info-v">Serial / USB</div>
          </div>
          <div className="info-r">
            <div className="info-k">ИНТЕГРАЦИЯ</div>
            <div className="info-v">pyserial</div>
          </div>
          <div className="info-r">
            <div className="info-k">ПЛАНИРУЕМАЯ ДАТА</div>
            <div className="info-v">Фаза 2 · 2026</div>
          </div>
        </div>
      </div>
    </>
  );
}
