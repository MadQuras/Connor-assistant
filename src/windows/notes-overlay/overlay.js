(function () {
  const statusEl = document.getElementById('recordingStatus');
  const currentEl = document.getElementById('currentText');
  const listEl = document.getElementById('todayList');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveBtn = document.getElementById('saveBtn');
  const hideBtn = document.getElementById('hideBtn');

  let notesFolder = '';
  let isRecording = false;
  let todayKey = new Date().toLocaleDateString('ru-RU');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = `Статус: ${text}`;
  }

  async function resolveFolder() {
    if (notesFolder) return notesFolder;
    try {
      const cfg = await window.api?.getSettings?.();
      const fromSettings = String(cfg?.voiceNotesFolder || '').trim();
      if (fromSettings) {
        notesFolder = fromSettings;
        return notesFolder;
      }
    } catch {}
    return '';
  }

  async function refreshToday() {
    const folder = await resolveFolder();
    const notes = (await window.api?.notesGetAll?.(folder)) || [];
    const today = notes.filter((n) => String(n?.date || '').includes(todayKey));
    if (!listEl) return;
    if (!today.length) {
      listEl.innerHTML = '<div class="item">Сегодня сохраненных конспектов нет</div>';
      return;
    }
    listEl.innerHTML = today
      .map((n) => `<div class="item">${String(n?.name || 'Конспект')}</div>`)
      .join('');
  }

  async function startRecording() {
    const folder = await resolveFolder();
    if (!folder) return;
    const resp = await window.api?.notesStart?.(folder);
    if (resp?.success) {
      isRecording = true;
      setStatus('идет запись');
    }
  }

  async function stopRecording() {
    const resp = await window.api?.notesStop?.();
    if (resp?.success) {
      isRecording = false;
      setStatus('остановлено');
      await refreshToday();
    }
  }

  startBtn?.addEventListener('click', () => {
    void startRecording();
  });
  stopBtn?.addEventListener('click', () => {
    void stopRecording();
  });
  saveBtn?.addEventListener('click', () => {
    void stopRecording();
  });
  hideBtn?.addEventListener('click', () => {
    void window.api?.hideNotesOverlay?.();
  });

  window.api?.onNotesRecording?.((payload) => {
    const event = String(payload?.event || '');
    const data = payload?.data;
    if (event === 'recording_started') {
      isRecording = true;
      setStatus('идет запись');
    } else if (event === 'transcript_update') {
      if (currentEl) currentEl.textContent = String(data?.text || '').trim() || '—';
    } else if (event === 'recording_stopped') {
      isRecording = false;
      setStatus('сохранено');
      void refreshToday();
    } else if (event === 'recording_cancelled') {
      isRecording = false;
      setStatus('отменено');
    }
  });

  setStatus(isRecording ? 'идет запись' : 'не записываю');
  void refreshToday();
})();
