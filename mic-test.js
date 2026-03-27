// mic-test.js — простой тест микрофона без Electron UI
// Запуск: `node mic-test.js`
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background: #0f0f12;
          color: white;
          padding: 20px;
        }
        .status { padding: 15px; border-radius: 12px; margin: 10px 0; background: #1a1a1f; }
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .listening { color: #f59e0b; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        button { background: #3b82f6; border: none; padding: 12px 24px; border-radius: 12px; color: white; cursor: pointer; margin: 5px; }
      </style>
    </head>
    <body>
      <h2>🎤 ТЕСТ МИКРОФОНА</h2>
      <button id="start">▶ НАЧАТЬ</button>
      <button id="stop" disabled>⏹ СТОП</button>
      <div id="status" class="status">⚡ Готов</div>
      <div id="result"></div>
      <script>
        let recognition = null;
        let listening = false;

        function setStatusHtml(html) {
          document.getElementById('status').innerHTML = html;
        }

        function safeStopTracks(stream) {
          try {
            stream?.getTracks?.().forEach(t => t.stop());
          } catch {}
        }

        document.getElementById('start').onclick = async () => {
          try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia недоступен');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            safeStopTracks(stream);
            setStatusHtml('<div class="success">✅ Микрофон работает!</div>');
          } catch(e) {
            setStatusHtml('<div class="error">❌ ' + (e?.message || String(e)) + '</div>');
            return;
          }

          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) {
            setStatusHtml('<div class="error">❌ SpeechRecognition не поддерживается</div>');
            return;
          }

          recognition = new SpeechRecognition();
          recognition.lang = 'ru-RU';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onstart = () => {
            listening = true;
            setStatusHtml('<div class="listening">🎤 СЛУШАЮ...</div>');
            document.getElementById('start').disabled = true;
            document.getElementById('stop').disabled = false;
          };

          recognition.onresult = (e) => {
            let text = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              text += e.results[i][0].transcript;
            }
            text = String(text || '').trim();
            document.getElementById('result').textContent = text ? ('"' + text + '"') : '';

            if (text.toLowerCase().includes('коннор')) {
              setStatusHtml('<div class="success">✅ КОННОР УСЛЫШАЛ!</div>');
            }
          };

          recognition.onerror = (e) => {
            if (e.error !== 'no-speech') {
              setStatusHtml('<div class="error">❌ ' + (e?.error || 'error') + '</div>');
            }
          };

          recognition.onend = () => {
            if (listening) {
              setTimeout(() => {
                try { recognition?.start(); } catch {}
              }, 100);
            }
          };

          try { recognition.start(); } catch {}
        };

        document.getElementById('stop').onclick = () => {
          try { recognition?.stop?.(); } catch {}
          listening = false;
          document.getElementById('start').disabled = false;
          document.getElementById('stop').disabled = true;
          setStatusHtml('⚡ Остановлено');
        };
      </script>
    </body>
    </html>
  `);
});

