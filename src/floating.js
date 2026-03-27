const led = document.getElementById('led') || document.getElementById('statusLed');
const statusText = document.getElementById('statusText');
const transcriptEl = document.getElementById('transcript') || document.getElementById('transcriptText');
const commandEl = document.getElementById('commandPreview') || document.getElementById('commandText');

let commandTimer = null;

function setListening(listening) {
  const on = !!listening;
  if (led) led.classList.toggle('listening', on);
  if (statusText) statusText.textContent = on ? '🎤 Слушаю...' : 'Ожидание';
}

function setTranscriptText(transcript) {
  if (!transcriptEl) return;
  const t = typeof transcript === 'string' ? transcript.trim() : '';
  transcriptEl.textContent = t ? t : '—';
}

function showCommand(command) {
  if (!commandEl) return;
  const cmd = String(command || '').trim();
  commandEl.textContent = cmd ? cmd : '';
  commandEl.classList.add('visible');

  if (commandTimer) clearTimeout(commandTimer);
  commandTimer = setTimeout(() => {
    try {
      commandEl.classList.remove('visible');
      commandEl.textContent = '';
    } catch {}
  }, 3000);
}

window.api?.onVoiceStatus?.((data) => {
  try {
    setListening(!!data?.listening);
    setTranscriptText(data?.transcript || '—');
  } catch {}
});

window.api?.onVoiceCommand?.((data) => {
  try {
    // Показываем распознанную команду отдельно от транскрипта.
    showCommand(data?.result || (data?.command ? `⚡ ${data.command}` : data?.rawTranscript));
  } catch {}
});

setListening(false);
setTranscriptText('—');
if (commandEl) commandEl.classList.remove('visible');

