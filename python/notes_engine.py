"""Голосовые конспекты — логика зеркалируется в main-процессе Electron (Node.js)."""

from pathlib import Path
from datetime import datetime
from typing import Callable, List, Optional


class NotesEngine:
    def __init__(self, voice_engine):
        self.voice = voice_engine
        self.is_recording = False
        self.current_folder: Optional[Path] = None
        self.recorded_lines: List[str] = []
        self.callback: Optional[Callable[[str, object], None]] = None

    def set_callback(self, callback: Optional[Callable[[str, object], None]]):
        """Callback для отправки статуса в Electron."""
        self.callback = callback

    def start_recording(self, folder_path: str) -> bool:
        try:
            full_path = Path(folder_path)
            full_path.mkdir(parents=True, exist_ok=True)
            self.current_folder = full_path
            self.is_recording = True
            self.recorded_lines = []
            self.voice.on_transcript(self._on_transcript)
            self._notify('recording_started', {'folder': str(full_path)})
            return True
        except Exception as e:
            self._notify('error', str(e))
            return False

    def stop_recording(self) -> Optional[str]:
        if not self.is_recording:
            return None

        self.is_recording = False
        self.voice.remove_transcript_callback(self._on_transcript)

        if not self.recorded_lines:
            self.current_folder = None
            self._notify('recording_cancelled', 'Нет текста')
            return None

        filename = datetime.now().strftime("%d.%m.%Y") + ".txt"
        filepath = self.current_folder / filename

        content = f"Конспект от {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}\n"
        content += "=" * 50 + "\n\n"
        for line in self.recorded_lines:
            content += line + "\n"

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        result = str(filepath)
        self.current_folder = None
        self.recorded_lines = []
        self._notify('recording_stopped', {'filepath': result})
        return result

    def cancel_recording(self):
        self.is_recording = False
        self.voice.remove_transcript_callback(self._on_transcript)
        self.current_folder = None
        self.recorded_lines = []
        self._notify('recording_cancelled', 'Отменено пользователем')

    def _on_transcript(self, text: str):
        if self.is_recording and text:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.recorded_lines.append(f"[{timestamp}] {text}")
            self._notify('transcript_update', {'text': text, 'timestamp': timestamp})

    def _notify(self, event, data):
        if self.callback:
            self.callback(event, data)
