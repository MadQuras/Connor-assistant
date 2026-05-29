import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Note {
  id: number;
  text: string;
  created_at: string;
  done: number;
}

type Filter = 'active' | 'done' | 'all';

function fmt(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day  = String(d.getDate()).padStart(2, '0');
    const mon  = String(d.getMonth() + 1).padStart(2, '0');
    const yr   = d.getFullYear();
    const h    = String(d.getHours()).padStart(2, '0');
    const m    = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon}.${yr} ${h}:${m}`;
  } catch {
    return iso.slice(0, 16);
  }
}

const STYLES = `
.np-root { display: flex; flex-direction: column; gap: 0; height: 100%; }

.np-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 0 0 16px 0; flex-shrink: 0;
}
.np-title {
  font-family: var(--font-ui,'Rajdhani',sans-serif);
  font-size: 11px; font-weight: 700; letter-spacing: 0.36em;
  color: var(--cyan); flex: 1;
}
.np-badge {
  font-size: 9px; letter-spacing: 0.2em;
  color: rgba(var(--cyan-rgb),0.45);
  border: 1px solid rgba(var(--cyan-rgb),0.20);
  border-radius: 4px; padding: 2px 7px;
}
.np-btn {
  background: transparent;
  border: 1px solid rgba(var(--cyan-rgb),0.28);
  color: rgba(var(--cyan-rgb),0.70);
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size: 9px; letter-spacing: 0.18em;
  padding: 4px 10px; border-radius: 4px; cursor: pointer;
  transition: border-color .18s, color .18s;
}
.np-btn:hover { border-color: rgba(var(--cyan-rgb),0.6); color: var(--cyan); }
.np-btn:active { opacity: 0.7; }
.np-btn.active { border-color: rgba(var(--cyan-rgb),0.7); color: var(--cyan); }

.np-add {
  display: flex; gap: 8px; padding: 0 0 14px 0; flex-shrink: 0;
}
.np-input {
  flex: 1;
  background: rgba(var(--cyan-rgb),0.04);
  border: 1px solid rgba(var(--cyan-rgb),0.20);
  border-radius: 6px;
  color: rgba(224,247,255,0.85);
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size: 11px;
  padding: 8px 12px;
  outline: none;
  transition: border-color .2s;
}
.np-input:focus { border-color: rgba(var(--cyan-rgb),0.55); }
.np-input::placeholder { color: rgba(var(--cyan-rgb),0.25); }

.np-filters {
  display: flex; gap: 6px; padding: 0 0 14px 0; flex-shrink: 0;
}

.np-list {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
}
.np-list::-webkit-scrollbar { width: 3px; }
.np-list::-webkit-scrollbar-thumb { background: rgba(var(--cyan-rgb),0.22); border-radius: 2px; }

.np-card {
  display: flex; align-items: flex-start; gap: 10px;
  background: rgba(var(--cyan-rgb),0.04);
  border: 1px solid rgba(var(--cyan-rgb),0.14);
  border-radius: 8px;
  padding: 11px 12px;
  transition: border-color .18s, background .18s;
  animation: np-in .22s ease both;
}
.np-card:hover { border-color: rgba(var(--cyan-rgb),0.30); background: rgba(var(--cyan-rgb),0.07); }
.np-card.done-card { opacity: 0.45; }
.np-card.done-card .np-card-text { text-decoration: line-through; }

@keyframes np-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.np-card-body { flex: 1; min-width: 0; }
.np-card-text {
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size: 12px; color: rgba(224,247,255,0.88);
  line-height: 1.5; word-break: break-word;
}
.np-card-date {
  margin-top: 5px;
  font-size: 9px; letter-spacing: 0.15em;
  color: rgba(var(--cyan-rgb),0.28);
}

.np-card-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.np-icon-btn {
  background: transparent;
  border: 1px solid rgba(var(--cyan-rgb),0.18);
  color: rgba(var(--cyan-rgb),0.45);
  border-radius: 4px; cursor: pointer;
  width: 26px; height: 26px;
  font-size: 12px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  transition: border-color .16s, color .16s, background .16s;
}
.np-icon-btn:hover { border-color: rgba(var(--cyan-rgb),0.6); color: var(--cyan); background: rgba(var(--cyan-rgb),0.08); }
.np-icon-btn.del:hover { border-color: rgba(255,80,80,0.5); color: rgba(255,100,100,0.85); background: rgba(255,60,60,0.07); }
.np-icon-btn:active { opacity: 0.6; }

.np-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: rgba(var(--cyan-rgb),0.25);
  font-size: 11px; letter-spacing: 0.2em;
}
.np-empty-icon { font-size: 28px; opacity: 0.35; }

.np-sep { height: 1px; background: rgba(var(--cyan-rgb),0.10); margin: 0 0 14px 0; flex-shrink: 0; }
`;

function injectStyles() {
  if (document.getElementById('np-styles')) return;
  const el = document.createElement('style');
  el.id = 'np-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  injectStyles();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ns = await invoke<Note[]>('read_notes');
      setNotes(ns);
    } catch {
      // DB not yet created — show empty
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + auto-refresh every 6 seconds
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleAdd = async () => {
    const t = newText.trim();
    if (!t) return;
    setAdding(true);
    try {
      await invoke('add_note', { text: t });
      setNewText('');
      await refresh();
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  };

  const handleDone = async (id: number) => {
    try {
      await invoke('mark_note_done', { id });
      setNotes(prev => prev.map(n => n.id === id ? { ...n, done: 1 } : n));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_note', { id });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  };

  const visible = notes.filter(n => {
    if (filter === 'active') return n.done === 0;
    if (filter === 'done')   return n.done === 1;
    return true;
  });

  const activeCount = notes.filter(n => n.done === 0).length;
  const doneCount   = notes.filter(n => n.done === 1).length;

  return (
    <div className="np-root">
      {/* Toolbar */}
      <div className="np-toolbar">
        <div className="np-title">ЗАМЕТКИ И ПЛАНЫ</div>
        {activeCount > 0 && (
          <div className="np-badge">{activeCount} АКТИВНЫХ</div>
        )}
        <button
          className="np-btn"
          onClick={refresh}
          title="Обновить список"
          disabled={loading}
        >
          {loading ? '...' : '↺ ОБНОВИТЬ'}
        </button>
      </div>

      {/* Add-note input */}
      <div className="np-add">
        <input
          ref={inputRef}
          className="np-input"
          placeholder="Добавить заметку вручную..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          maxLength={300}
        />
        <button
          className="np-btn"
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
        >
          {adding ? '...' : '+ ДОБАВИТЬ'}
        </button>
      </div>

      <div className="np-sep" />

      {/* Filter tabs */}
      <div className="np-filters">
        {(['active', 'done', 'all'] as Filter[]).map(f => (
          <button
            key={f}
            className={`np-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'active' ? `АКТИВНЫЕ (${activeCount})` : f === 'done' ? `ВЫПОЛНЕНО (${doneCount})` : 'ВСЕ'}
          </button>
        ))}
      </div>

      {/* Notes list */}
      <div className="np-list">
        {visible.length === 0 ? (
          <div className="np-empty">
            <div className="np-empty-icon">◈</div>
            <div>
              {filter === 'active'
                ? 'НЕТ АКТИВНЫХ ЗАМЕТОК'
                : filter === 'done'
                  ? 'НЕТ ВЫПОЛНЕННЫХ'
                  : 'СПИСОК ПУСТ'}
            </div>
            {filter === 'active' && (
              <div style={{ fontSize: 9, opacity: 0.6 }}>
                Скажите «Коннор, запомни...» чтобы добавить
              </div>
            )}
          </div>
        ) : (
          visible.map(n => (
            <div
              key={n.id}
              className={`np-card${n.done ? ' done-card' : ''}`}
            >
              <div className="np-card-body">
                <div className="np-card-text">{n.text}</div>
                <div className="np-card-date">{fmt(n.created_at)}</div>
              </div>
              <div className="np-card-actions">
                {n.done === 0 && (
                  <button
                    className="np-icon-btn"
                    title="Отметить выполненным"
                    onClick={() => handleDone(n.id)}
                  >
                    ✓
                  </button>
                )}
                <button
                  className="np-icon-btn del"
                  title="Удалить"
                  onClick={() => handleDelete(n.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
