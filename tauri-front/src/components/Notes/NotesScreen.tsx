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
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const h   = String(d.getHours()).padStart(2, '0');
    const m   = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon}.${d.getFullYear()} ${h}:${m}`;
  } catch {
    return iso.slice(0, 16);
  }
}

const STYLE = `
@keyframes ns-in  { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:none; } }
@keyframes ns-out { from { opacity:1; transform:none; } to { opacity:0; transform:scale(0.97) translateY(12px); } }
@keyframes ns-card-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
@keyframes ns-corner-h { from { width:0; } to { width:28px; } }
@keyframes ns-corner-v { from { height:0; } to { height:28px; } }

.ns-corner { position:absolute; width:28px; height:28px; pointer-events:none; }
.ns-corner::before, .ns-corner::after {
  content:''; position:absolute;
  background: rgba(var(--cyan-rgb),0.55);
}
.ns-corner::before { height:2px; width:28px;
  animation: ns-corner-h 0.4s cubic-bezier(.22,1,.36,1) 0.1s both; }
.ns-corner::after  { width:2px; height:28px;
  animation: ns-corner-v 0.4s cubic-bezier(.22,1,.36,1) 0.1s both; }
.ns-corner.tl { top:20px; left:20px; }
.ns-corner.tl::before { top:0; left:0; }
.ns-corner.tl::after  { top:0; left:0; }
.ns-corner.tr { top:20px; right:20px; }
.ns-corner.tr::before { top:0; right:0; }
.ns-corner.tr::after  { top:0; right:0; }
.ns-corner.bl { bottom:20px; left:20px; }
.ns-corner.bl::before { bottom:0; left:0; }
.ns-corner.bl::after  { bottom:0; left:0; }
.ns-corner.br { bottom:20px; right:20px; }
.ns-corner.br::before { bottom:0; right:0; }
.ns-corner.br::after  { bottom:0; right:0; }

.ns-root {
  position:fixed; inset:0; z-index:9000;
  background: var(--bg, #040d11);
  display:flex; flex-direction:column;
  font-family: var(--font-mono,'Share Tech Mono',monospace);
}

.ns-header {
  display:flex; align-items:center; gap:12px;
  padding: 28px 48px 0 48px;
  flex-shrink:0;
}
.ns-header-label {
  font-family: var(--font-ui,'Rajdhani',sans-serif);
  font-size:9px; font-weight:700; letter-spacing:.5em;
  color: rgba(var(--cyan-rgb),.4);
}
.ns-header-title {
  font-family: var(--font-ui,'Rajdhani',sans-serif);
  font-size:22px; font-weight:700; letter-spacing:.22em;
  color: var(--cyan);
}
.ns-header-sep { flex:1; height:1px; background:rgba(var(--cyan-rgb),.12); }
.ns-close-btn {
  background:transparent;
  border:1px solid rgba(var(--cyan-rgb),.25);
  color:rgba(var(--cyan-rgb),.55);
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size:11px; letter-spacing:.2em;
  padding:5px 14px; border-radius:4px; cursor:pointer;
  transition: border-color .18s, color .18s;
}
.ns-close-btn:hover { border-color:rgba(var(--cyan-rgb),.6); color:var(--cyan); }

.ns-body {
  flex:1; display:flex; flex-direction:column;
  padding: 24px 48px 28px 48px;
  overflow:hidden;
}

.ns-add {
  display:flex; gap:8px; margin-bottom:16px; flex-shrink:0;
}
.ns-input {
  flex:1;
  background: rgba(var(--cyan-rgb),.04);
  border:1px solid rgba(var(--cyan-rgb),.20);
  border-radius:6px;
  color:rgba(224,247,255,.85);
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size:12px; padding:9px 14px; outline:none;
  transition: border-color .2s;
}
.ns-input:focus { border-color:rgba(var(--cyan-rgb),.55); }
.ns-input::placeholder { color:rgba(var(--cyan-rgb),.22); }

.ns-btn {
  background:transparent;
  border:1px solid rgba(var(--cyan-rgb),.28);
  color:rgba(var(--cyan-rgb),.70);
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size:9px; letter-spacing:.18em;
  padding:5px 14px; border-radius:4px; cursor:pointer;
  transition: border-color .18s, color .18s;
  white-space:nowrap;
}
.ns-btn:hover { border-color:rgba(var(--cyan-rgb),.6); color:var(--cyan); }
.ns-btn:disabled { opacity:.35; cursor:default; }
.ns-btn.active { border-color:rgba(var(--cyan-rgb),.7); color:var(--cyan); }

.ns-filters {
  display:flex; gap:6px; margin-bottom:16px; flex-shrink:0;
}
.ns-count {
  font-size:9px; letter-spacing:.2em;
  color:rgba(var(--cyan-rgb),.35);
  border:1px solid rgba(var(--cyan-rgb),.15);
  border-radius:4px; padding:2px 8px; align-self:center;
}

.ns-list {
  flex:1; overflow-y:auto;
  display:flex; flex-direction:column; gap:7px;
}
.ns-list::-webkit-scrollbar { width:3px; }
.ns-list::-webkit-scrollbar-thumb { background:rgba(var(--cyan-rgb),.22); border-radius:2px; }

.ns-card {
  display:flex; align-items:flex-start; gap:12px;
  background:rgba(var(--cyan-rgb),.035);
  border:1px solid rgba(var(--cyan-rgb),.13);
  border-radius:8px; padding:12px 14px;
  animation: ns-card-in .22s ease both;
  transition: border-color .18s, background .18s;
}
.ns-card:hover { border-color:rgba(var(--cyan-rgb),.28); background:rgba(var(--cyan-rgb),.065); }
.ns-card.done { opacity:.4; }
.ns-card.done .ns-card-text { text-decoration:line-through; }

.ns-card-body { flex:1; min-width:0; }
.ns-card-text {
  font-family: var(--font-mono,'Share Tech Mono',monospace);
  font-size:12px; color:rgba(224,247,255,.88);
  line-height:1.55; word-break:break-word;
}
.ns-card-date {
  margin-top:5px; font-size:9px; letter-spacing:.15em;
  color:rgba(var(--cyan-rgb),.28);
}
.ns-card-actions { display:flex; flex-direction:column; gap:4px; flex-shrink:0; }
.ns-icon-btn {
  background:transparent;
  border:1px solid rgba(var(--cyan-rgb),.18);
  color:rgba(var(--cyan-rgb),.45);
  border-radius:4px; cursor:pointer;
  width:28px; height:28px;
  font-size:12px;
  display:flex; align-items:center; justify-content:center;
  transition: border-color .16s, color .16s, background .16s;
}
.ns-icon-btn:hover { border-color:rgba(var(--cyan-rgb),.6); color:var(--cyan); background:rgba(var(--cyan-rgb),.08); }
.ns-icon-btn.del:hover { border-color:rgba(255,80,80,.5); color:rgba(255,100,100,.85); background:rgba(255,60,60,.07); }

.ns-empty {
  flex:1; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:10px;
  color:rgba(var(--cyan-rgb),.22); font-size:11px; letter-spacing:.2em;
}
.ns-empty-icon { font-size:32px; opacity:.3; }
`;

function injectStyle() {
  if (document.getElementById('ns-style')) return;
  const el = document.createElement('style');
  el.id = 'ns-style';
  el.textContent = STYLE;
  document.head.appendChild(el);
}

export interface NotesScreenProps {
  onClose: () => void;
}

export function NotesScreen({ onClose }: NotesScreenProps) {
  const [notes, setNotes]     = useState<Note[]>([]);
  const [filter, setFilter]   = useState<Filter>('active');
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState(false);
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  injectStyle();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ns = await invoke<Note[]>('read_notes');
      setNotes(ns);
    } catch { /* DB not created yet */ } finally {
      setLoading(false);
    }
  }, []);

  // Load once on open — no polling interval
  useEffect(() => { refresh(); }, [refresh]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 350);
  };

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

  const visible     = notes.filter(n => filter === 'active' ? n.done === 0 : filter === 'done' ? n.done === 1 : true);
  const activeCount = notes.filter(n => n.done === 0).length;
  const doneCount   = notes.filter(n => n.done === 1).length;

  return (
    <div
      className="ns-root"
      style={{ animation: exiting ? 'ns-out 0.35s ease forwards' : 'ns-in 0.35s cubic-bezier(.22,1,.36,1) both' }}
    >
      {/* Background decorations */}
      <div className="grid-bg" style={{ zIndex: 0, position: 'absolute', inset: 0 }} />
      <div className="scanline" />
      <div className="ns-corner tl" />
      <div className="ns-corner tr" />
      <div className="ns-corner bl" />
      <div className="ns-corner br" />

      {/* Header */}
      <div className="ns-header" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <div className="ns-header-label">СИСТЕМА КОННОРА · ПАМЯТЬ</div>
          <div className="ns-header-title">ЗАМЕТКИ И ПЛАНЫ</div>
        </div>
        <div className="ns-header-sep" />
        {activeCount > 0 && (
          <div className="ns-count">{activeCount} АКТИВНЫХ</div>
        )}
        <button className="ns-btn" onClick={refresh} disabled={loading}>
          {loading ? '...' : '↺ ОБНОВИТЬ'}
        </button>
        <button className="ns-close-btn" onClick={handleClose}>
          ✕ ЗАКРЫТЬ
        </button>
      </div>

      {/* Body */}
      <div className="ns-body" style={{ position: 'relative', zIndex: 1 }}>
        {/* Add input */}
        <div className="ns-add">
          <input
            ref={inputRef}
            className="ns-input"
            placeholder="Добавить заметку вручную..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            maxLength={300}
          />
          <button className="ns-btn" onClick={handleAdd} disabled={adding || !newText.trim()}>
            {adding ? '...' : '+ ДОБАВИТЬ'}
          </button>
        </div>

        {/* Filters */}
        <div className="ns-filters">
          {(['active', 'done', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              className={`ns-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'active' ? `АКТИВНЫЕ (${activeCount})` : f === 'done' ? `ВЫПОЛНЕНО (${doneCount})` : 'ВСЕ'}
            </button>
          ))}
        </div>

        {/* Notes list */}
        <div className="ns-list">
          {visible.length === 0 ? (
            <div className="ns-empty">
              <div className="ns-empty-icon">◈</div>
              <div>
                {filter === 'active' ? 'НЕТ АКТИВНЫХ ЗАМЕТОК'
                  : filter === 'done' ? 'НЕТ ВЫПОЛНЕННЫХ' : 'СПИСОК ПУСТ'}
              </div>
              {filter === 'active' && (
                <div style={{ fontSize: 9, opacity: 0.6 }}>
                  Скажите «Коннор, запомни...» чтобы добавить
                </div>
              )}
            </div>
          ) : (
            visible.map(n => (
              <div key={n.id} className={`ns-card${n.done ? ' done' : ''}`}>
                <div className="ns-card-body">
                  <div className="ns-card-text">{n.text}</div>
                  <div className="ns-card-date">{fmt(n.created_at)}</div>
                </div>
                <div className="ns-card-actions">
                  {n.done === 0 && (
                    <button className="ns-icon-btn" title="Отметить выполненным" onClick={() => handleDone(n.id)}>✓</button>
                  )}
                  <button className="ns-icon-btn del" title="Удалить" onClick={() => handleDelete(n.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
