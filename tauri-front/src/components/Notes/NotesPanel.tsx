import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MemoryData {
  apps?: Record<string, string>;
  last_scan?: string;
  next_scan?: string;
}

interface Note {
  id: number;
  text: string;
  created_at: string;
}

export function NotesPanel() {
  const [memory, setMemory] = useState<MemoryData>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const mem = await invoke<MemoryData>('read_memory');
      setMemory(mem);
    } catch {
      setLoadError('memory.json недоступен — запустите ядро');
    }
    try {
      const ns = await invoke<Note[]>('read_notes');
      setNotes(ns);
    } catch {
      // notes.db пуст или не создан — ок
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRescan = async () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); loadData(); }, 2000);
  };

  const apps = Object.entries(memory.apps || {});

  return (
    <>
      {/* APPS CACHE */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">КЭШИРОВАННЫЕ ПРИЛОЖЕНИЯ</div>
          <div className="sec-line" />
          <button className="scan-btn" onClick={handleRescan}>
            {scanning ? 'СКАНИРОВАНИЕ...' : '↺ ОБНОВИТЬ КЭШ'}
          </button>
        </div>
        {loadError ? (
          <div className="info-r" style={{ justifyContent: 'center', color: 'rgba(0,180,216,0.3)' }}>
            {loadError}
          </div>
        ) : apps.length === 0 ? (
          <div className="info-r" style={{ justifyContent: 'center', color: 'rgba(0,180,216,0.3)' }}>
            КЭШ ПУСТ — запустите сканирование
          </div>
        ) : (
          <div className="info-grid">
            {apps.map(([name, path]) => (
              <div className="info-r" key={name}>
                <div className="info-k">{name}</div>
                <div className="info-v" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {path}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOTES */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ЗАМЕТКИ И ПЛАНЫ</div>
          <div className="sec-line" />
          <div className="sec-badge">{notes.length} ЗАПИСЕЙ</div>
        </div>
        {notes.length === 0 ? (
          <div className="info-r" style={{ justifyContent: 'center', color: 'rgba(0,180,216,0.3)' }}>
            Скажите «Коннор, запомни...» чтобы добавить запись
          </div>
        ) : (
          <div className="info-grid">
            {notes.map((n) => (
              <div className="info-r" key={n.id}>
                <div className="info-k" style={{ maxWidth: 420 }}>{n.text}</div>
                <div className="info-v" style={{ fontSize: 9, color: 'rgba(0,180,216,0.25)' }}>
                  {n.created_at?.slice(0, 16) || '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SCAN PARAMS */}
      <div>
        <div className="sec-hd">
          <div className="sec-title">ПАРАМЕТРЫ ПАМЯТИ</div>
          <div className="sec-line" />
        </div>
        <div className="info-grid">
          <div className="info-r">
            <div className="info-k">ПОСЛЕДНЕЕ СКАНИРОВАНИЕ</div>
            <div className="info-v">{memory.last_scan || '—'}</div>
          </div>
          <div className="info-r">
            <div className="info-k">СЛЕДУЮЩЕЕ СКАНИРОВАНИЕ</div>
            <div className="info-v">{memory.next_scan || '—'}</div>
          </div>
          <div className="info-r">
            <div className="info-k">ФАЙЛ ПАМЯТИ</div>
            <div className="info-v">models/memory.json</div>
          </div>
          <div className="info-r">
            <div className="info-k">БАЗА ЗАМЕТОК</div>
            <div className="info-v">models/notes.db</div>
          </div>
        </div>
      </div>
    </>
  );
}
