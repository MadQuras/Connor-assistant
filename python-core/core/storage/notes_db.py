from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import List, Optional, Tuple

from core.constants import MODELS_DIR


class NotesDB:
    def __init__(self) -> None:
        self.path = MODELS_DIR / "notes.db"
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    def _init_schema(self) -> None:
        conn = self._conn()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                remind_at TEXT,
                done INTEGER DEFAULT 0
            )
            """
        )
        conn.commit()
        conn.close()

    def add(self, text: str, remind_at: Optional[str] = None) -> int:
        conn = self._conn()
        cur = conn.execute(
            "INSERT INTO notes (text, created_at, remind_at, done) VALUES (?, ?, ?, 0)",
            (text.strip(), datetime.now().isoformat(), remind_at),
        )
        conn.commit()
        row_id = int(cur.lastrowid)
        conn.close()
        return row_id

    def list_active(self, limit: int = 8) -> List[Tuple[str, str]]:
        conn = self._conn()
        rows = conn.execute(
            "SELECT text, created_at FROM notes WHERE done = 0 ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [(str(t), str(c)) for t, c in rows]

    def mark_done(self, note_id: int) -> None:
        conn = self._conn()
        conn.execute("UPDATE notes SET done = 1 WHERE id = ?", (note_id,))
        conn.commit()
        conn.close()
