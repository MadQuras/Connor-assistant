const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const transcriptEl = document.getElementById('transcript');
const micVolumeBar = document.getElementById('micVolumeBar');

function setListening(listening) {
  const on = !!listening;
  if (statusDot) statusDot.classList.toggle('on', on);
  if (statusText) statusText.textContent = on ? 'Слушаю' : 'Ожидание';
}

function setTranscript(text) {
  if (!transcriptEl) return;
  const t = typeof text === 'string' ? text.trim() : '';
  transcriptEl.textContent = t ? t : '—';
}

function setMicLevel(payload) {
  if (!micVolumeBar) return;
  const raw = typeof payload === 'number' ? payload : Number(payload?.level);
  const v = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
  micVolumeBar.style.width = `${v * 100}%`;
}

window.api?.onVoiceStatus?.((data) => {
  try {
    setListening(!!data?.listening);
    setTranscript(data?.transcript);
  } catch {}
});

window.api?.onVoiceMicLevel?.((payload) => {
  try {
    setMicLevel(payload);
  } catch {}
});

setListening(false);
setTranscript('—');
setMicLevel(0);
