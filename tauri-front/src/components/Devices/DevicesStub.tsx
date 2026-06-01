const FUTURE_DEVICES = [
  {
    icon: '◈',
    name: 'Умное освещение',
    desc: 'Включение, выключение и регулировка яркости голосом',
    tag: 'Arduino · relay',
  },
  {
    icon: '◫',
    name: 'Управление шторами',
    desc: '«Коннор, открой шторы» — сервопривод MG996R',
    tag: 'Arduino · servo',
  },
  {
    icon: '◎',
    name: 'Датчик микроклимата',
    desc: 'Температура, влажность и CO₂ в реальном времени',
    tag: 'DHT22 · MQ-135',
  },
  {
    icon: '⬡',
    name: 'Управление питанием',
    desc: 'Включение и отключение периферии по голосу',
    tag: 'USB-хаб · relay',
  },
];

export function DevicesStub() {
  return (
    <>
      {/* HERO */}
      <div className="stub-section" style={{ marginBottom: 0 }}>
        <div className="stub-icon" style={{ fontSize: 36, marginBottom: 12 }}>⬡</div>
        <div className="stub-title">УМНЫЙ ДОМ · ФАЗА 2</div>
        <div className="stub-desc" style={{ maxWidth: 380 }}>
          Модуль расширения для голосового управления физическими устройствами.
          Интеграция через Arduino и Serial USB — без облака, без задержек.
        </div>
        <div className="stub-chip">ПРОТОКОЛ: Serial USB · 9600 baud · pyserial</div>
      </div>

      {/* DEVICES */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ЗАПЛАНИРОВАННЫЕ УСТРОЙСТВА</div>
          <div className="sec-line" />
          <div className="sec-badge">СКОРО</div>
        </div>
        <div className="cmd-list">
          {FUTURE_DEVICES.map((d) => (
            <div className="cmd-item" key={d.name} style={{ alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  fontSize: 20,
                  color: 'var(--accent)',
                  opacity: 0.6,
                  minWidth: 28,
                  lineHeight: 1.4,
                }}
              >
                {d.icon}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div className="cmd-phrase" style={{ fontSize: 11 }}>{d.name}</div>
                <div className="cmd-desc" style={{ fontSize: 9, opacity: 0.55 }}>{d.desc}</div>
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: 'rgba(var(--cyan-rgb),0.3)',
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                  alignSelf: 'center',
                }}
              >
                {d.tag}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ПРИМЕРЫ КОМАНД */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ПРИМЕРЫ БУДУЩИХ КОМАНД</div>
          <div className="sec-line" />
        </div>
        <div className="cmd-list">
          {[
            ['Коннор, включи свет', 'Arduino GPIO relay HIGH'],
            ['Коннор, открой шторы', 'Servo position 0°'],
            ['Коннор, какая температура', 'DHT22 · Serial read'],
            ['Коннор, выключи всё', 'All relay channels OFF'],
          ].map(([phrase, action]) => (
            <div className="cmd-item" key={phrase}>
              <div className="cmd-phrase">{phrase}</div>
              <div className="cmd-sep">→</div>
              <div className="cmd-desc" style={{ opacity: 0.5 }}>{action}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
