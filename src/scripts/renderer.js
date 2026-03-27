import { startSystemMonitoring } from './system-bridge.js';
import { initMusicPlayer } from './music-player.js';

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', !!hidden);
}

function applyTheme(theme) {
  // Класс на body определяет палитру.
  document.body.classList.toggle('theme-classic', theme === 'classic');
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function updateListeningUi({
  listening,
  btnToggleListening,
  statusText,
  voiceHint,
  voiceViz,
  statusPulse,
  voiceStateIcon,
}) {
  if (!btnToggleListening || !statusText || !voiceHint || !voiceViz || !statusPulse) return;

  voiceViz.dataset.state = listening ? 'on' : 'off';
  statusPulse.dataset.state = listening ? 'on' : 'idle';
  if (voiceStateIcon) {
    voiceStateIcon.dataset.state = listening ? 'on' : 'pause';
  }

  if (listening) {
    statusText.textContent = 'Прослушивание активировано';
    voiceHint.textContent = 'Прослушивание: вкл';
    btnToggleListening.querySelector('.btn-sub').textContent = 'Пауза/выкл.';
    btnToggleListening.querySelector('.btn-title').textContent = 'Слушать';
  } else {
    statusText.textContent = 'Ожидание команд';
    voiceHint.textContent = 'Прослушивание: выкл';
    btnToggleListening.querySelector('.btn-sub').textContent = 'Пауза/вкл.';
    btnToggleListening.querySelector('.btn-title').textContent = 'Слушать';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const el = {
    chipVersion: document.getElementById('chip-version'),
    statusText: document.getElementById('statusText'),
    statusPulse: document.getElementById('statusPulse'),
    voiceHint: document.getElementById('voiceHint'),
    voiceViz: document.getElementById('voiceViz'),
    voiceStateIcon: document.getElementById('voiceStateIcon'),

    btnToggleListening: document.getElementById('btnToggleListening'),
    btnRefreshSystem: document.getElementById('btnRefreshSystem'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnTestNotification: document.getElementById('btnTestNotification'),
    btnQuickTheme: document.getElementById('btnQuickTheme'),
    btnOpenCasino: document.getElementById('btnOpenCasino'),
    btnQuitApp: document.getElementById('btnQuitApp'),

    mainView: document.getElementById('mainView'),
    musicView: document.getElementById('musicView'),
    settingsView: document.getElementById('settingsView'),
    btnBackFromSettings: document.getElementById('btnBackFromSettings'),

    toggleAutoLaunch: document.getElementById('toggleAutoLaunch'),
    toggleNeonTheme: document.getElementById('toggleNeonTheme'),
    toggleHotkey: document.getElementById('toggleHotkey'),
    toggleNoConfirmPower: document.getElementById('toggleNoConfirmPower'),
    skipConfirm: document.getElementById('skipConfirm'),
    ttsEnabled: document.getElementById('ttsEnabled'),
    ttsRate: document.getElementById('ttsRate'),
    ttsVolume: document.getElementById('ttsVolume'),
    appLanguage: document.getElementById('appLanguage'),
    autoUpdateEnabled: document.getElementById('autoUpdateEnabled'),
    btnCheckUpdates: document.getElementById('btnCheckUpdates'),
    updateStatus: document.getElementById('updateStatus'),
    updateProgress: document.getElementById('updateProgress'),
    updateProgressFill: document.getElementById('updateProgressFill'),
    updateProgressText: document.getElementById('updateProgressText'),

    hkToggleWindow: document.getElementById('hk-toggleWindow'),
    hkToggleMuteSound: document.getElementById('hk-toggleMuteSound'),
    hkOpenBrowser: document.getElementById('hk-openBrowser'),
    hkVoiceStart: document.getElementById('hk-voiceStart'),
    hkExit: document.getElementById('hk-exit'),
    btnApplyHotkeys: document.getElementById('btnApplyHotkeys'),
    btnRequestMicPermission: document.getElementById('btnRequestMicPermission'),

    // Macros UI.
    macroList: document.getElementById('macroList'),
    macroName: document.getElementById('macroName'),
    macroSteps: document.getElementById('macroSteps'),
    macroStatus: document.getElementById('macroStatus'),
    btnMacroRecord: document.getElementById('btnMacroRecord'),
    btnMacroStop: document.getElementById('btnMacroStop'),
    btnMacroPlay: document.getElementById('btnMacroPlay'),
    btnMacroSave: document.getElementById('btnMacroSave'),
    macroRepeatTimes: document.getElementById('macroRepeatTimes'),
    macroLoop: document.getElementById('macroLoop'),

    // Tabs.
    tabMain: document.getElementById('tabMain'),
    tabDeepseek: document.getElementById('tabDeepseek'),
    tabMusic: document.getElementById('tabMusic'),
    tabSettings: document.getElementById('tabSettings'),

    // DeepSeek UI.
    deepseekChatSelect: document.getElementById('deepseekChatSelect'),
    btnDeepNewChat: document.getElementById('btnDeepNewChat'),
    btnDeepDeleteChat: document.getElementById('btnDeepDeleteChat'),
    deepseekMessages: document.getElementById('deepseekMessages'),
    deepseekInput: document.getElementById('deepseekInput'),
    btnDeepSend: document.getElementById('btnDeepSend'),
    deepseekAutoSpeak: document.getElementById('deepseekAutoSpeak'),
    btnDeepSpeak: document.getElementById('btnDeepSpeak'),
    btnDeepStopSpeak: document.getElementById('btnDeepStopSpeak'),
    deepseekStatus: document.getElementById('deepseekStatus'),

    // DeepSeek settings.
    deepseekApiKeyInput: document.getElementById('deepseekApiKeyInput'),
    btnSaveDeepseekApiKey: document.getElementById('btnSaveDeepseekApiKey'),
    userNameInput: document.getElementById('userNameInput'),
    btnSaveUserName: document.getElementById('btnSaveUserName'),
    btnClearCache: document.getElementById('btnClearCache'),
    btnRescanCache: document.getElementById('btnRescanCache'),
  };

  const cpuValue = document.getElementById('cpuValue');
  const cpuSub = document.getElementById('cpuSub');
  const cpuBarFill = document.getElementById('cpuBarFill');
  const ramValue = document.getElementById('ramValue');
  const ramSub = document.getElementById('ramSub');
  const ramBarFill = document.getElementById('ramBarFill');
  const diskValue = document.getElementById('diskValue');
  const diskSub = document.getElementById('diskSub');
  const diskBarFill = document.getElementById('diskBarFill');
  const activeWindowTitle = document.getElementById('activeWindowTitle');
  const activeWindowOwner = document.getElementById('activeWindowOwner');
  const updatedAtEl = document.getElementById('systemUpdatedAt');
  const remindersList = document.getElementById('remindersList');

  // Music player (separate UI module).
  try {
    initMusicPlayer();
  } catch {}

  // Минималистичный режим: отключаем визуальные “анимации”/прогресс-печать.
  const prefersReducedMotion = true;

  const particlesContainer = document.getElementById('particlesContainer');
  const bootOverlayEl = document.getElementById('androidBootAnimation');
  const bootTextEl = bootOverlayEl?.querySelector?.('.boot-text') || null;
  const bootProgressFillEl = document.getElementById('bootProgressFill');
  const bootPercentEl = document.getElementById('bootPercent');

  let bootRaf = null;
  let bootHideTimer = null;

  function createParticles() {
    if (!particlesContainer) return;
    particlesContainer.innerHTML = '';
    if (prefersReducedMotion) return;

    const count = 50;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'particle-dot';
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.animationDuration = `${5 + Math.random() * 10}s`;
      dot.style.animationDelay = `${Math.random() * 4}s`;
      particlesContainer.appendChild(dot);
    }
  }

  function showBootAnimation({ text = null } = {}) {
    if (!bootOverlayEl || prefersReducedMotion) return;

    if (bootHideTimer) clearTimeout(bootHideTimer);
    if (bootRaf) cancelAnimationFrame(bootRaf);

    bootOverlayEl.classList.remove('hidden');
    bootOverlayEl.style.opacity = '1';
    if (bootTextEl && text) bootTextEl.textContent = String(text);
    if (bootProgressFillEl) bootProgressFillEl.style.transform = 'scaleX(0)';
    if (bootPercentEl) bootPercentEl.textContent = '0%';

    const durationMs = 950;
    const start = performance.now();

    const step = (now) => {
      const t = now - start;
      const p = Math.max(0, Math.min(1, t / durationMs));
      if (bootProgressFillEl) bootProgressFillEl.style.transform = `scaleX(${p})`;
      if (bootPercentEl) bootPercentEl.textContent = `${Math.round(p * 100)}%`;

      if (p < 1) {
        bootRaf = requestAnimationFrame(step);
      } else {
        if (bootProgressFillEl) bootProgressFillEl.style.transform = 'scaleX(1)';
        if (bootPercentEl) bootPercentEl.textContent = '100%';
        bootHideTimer = setTimeout(() => {
          bootOverlayEl.style.opacity = '0';
          setTimeout(() => {
            bootOverlayEl.classList.add('hidden');
            bootOverlayEl.style.opacity = '1';
          }, 240);
        }, 260);
      }
    };

    bootRaf = requestAnimationFrame(step);
  }

  if (particlesContainer && !prefersReducedMotion) createParticles();
  // Инициальная “детройт” загрузка (короткая).
  showBootAnimation({ text: 'RK800 SYSTEM BOOT' });

  // Версия приложения.
  try {
    const v = await window.api.getVersion();
    const chip = document.getElementById('chip-version');
    if (chip) chip.textContent = `v${v}`;
  } catch {
    if (el.chipVersion) el.chipVersion.textContent = 'v—';
  }

  let settings = await window.api.getSettings().catch(() => null);
  if (!settings) settings = { autoLaunch: false, theme: 'neon', hotkeyEnabled: true };

  applyTheme(settings.theme);
  if (el.toggleAutoLaunch) el.toggleAutoLaunch.checked = !!settings.autoLaunch;
  if (el.toggleNeonTheme) el.toggleNeonTheme.checked = settings.theme === 'neon';
  if (el.toggleHotkey) el.toggleHotkey.checked = !!settings.hotkeyEnabled;
  if (el.toggleNoConfirmPower) el.toggleNoConfirmPower.checked = !!settings.noConfirmPower;
  if (el.skipConfirm) el.skipConfirm.checked = !!settings.noConfirmPower;
  if (el.ttsEnabled) el.ttsEnabled.checked = settings.ttsEnabled !== false;
  if (el.ttsRate) el.ttsRate.value = String(clamp(settings.ttsRate ?? 1.0, 0.5, 2.0));
  if (el.ttsVolume) el.ttsVolume.value = String(clamp(settings.ttsVolume ?? 0.8, 0, 1));
  if (el.appLanguage) el.appLanguage.value = settings.language === 'en' ? 'en' : 'ru';
  if (el.autoUpdateEnabled) el.autoUpdateEnabled.checked = settings.autoUpdateEnabled !== false;

  try {
    if (el.deepseekApiKeyInput) {
      if (settings?.deepseekApiKeySet) el.deepseekApiKeyInput.placeholder = 'Ключ установлен (можно обновить)';
      else el.deepseekApiKeyInput.placeholder = 'Bearer token';
    }
    if (el.userNameInput) {
      el.userNameInput.value = settings?.userName || '';
    }
  } catch {}

  const DEFAULT_HOTKEYS = {
    toggleWindow: 'Control+Shift+T',
    toggleMuteSound: 'Control+Shift+M',
    openBrowser: 'Control+Shift+B',
    voiceStart: 'Control+Shift+R',
    exit: 'Control+Shift+Q',
  };

  const hotkeys = settings?.hotkeys || {};
  if (el.hkToggleWindow) el.hkToggleWindow.value = hotkeys.toggleWindow || DEFAULT_HOTKEYS.toggleWindow;
  if (el.hkToggleMuteSound) el.hkToggleMuteSound.value = hotkeys.toggleMuteSound || DEFAULT_HOTKEYS.toggleMuteSound;
  if (el.hkOpenBrowser) el.hkOpenBrowser.value = hotkeys.openBrowser || DEFAULT_HOTKEYS.openBrowser;
  if (el.hkVoiceStart) el.hkVoiceStart.value = hotkeys.voiceStart || DEFAULT_HOTKEYS.voiceStart;
  if (el.hkExit) el.hkExit.value = hotkeys.exit || DEFAULT_HOTKEYS.exit;

  function eventToAccelerator(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Command');

    const k = e.key;
    if (!k) return '';
    if (k === 'Control' || k === 'Shift' || k === 'Alt' || k === 'Meta') return '';
    if (k === 'Escape') return '';
    if (k === ' ') parts.push('Space');
    else if (k.length === 1) parts.push(k.toUpperCase());
    else {
      // Arrow keys, F1.. etc
      const map = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        Enter: 'Enter',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Tab: 'Tab',
        Home: 'Home',
        End: 'End',
        PageUp: 'PageUp',
        PageDown: 'PageDown',
        Insert: 'Insert',
      };
      parts.push(map[k] || k);
    }

    return parts.join('+');
  }

  function setupHotkeyInputCapture(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', (e) => {
      // Предотвращаем ввод в поле.
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        inputEl.value = '';
        return;
      }

      const acc = eventToAccelerator(e);
      if (!acc) return;
      inputEl.value = acc;
    });
  }

  setupHotkeyInputCapture(el.hkToggleWindow);
  setupHotkeyInputCapture(el.hkToggleMuteSound);
  setupHotkeyInputCapture(el.hkOpenBrowser);
  setupHotkeyInputCapture(el.hkVoiceStart);
  setupHotkeyInputCapture(el.hkExit);

  // Маршрутизация (настройки/главный экран).
  function setActiveTab(tabKey) {
    if (el.tabMain) el.tabMain.classList.toggle('active', tabKey === 'main');
    if (el.tabDeepseek) el.tabDeepseek.classList.toggle('active', tabKey === 'chat');
    if (el.tabMusic) el.tabMusic.classList.toggle('active', tabKey === 'music');
    if (el.tabSettings) el.tabSettings.classList.toggle('active', tabKey === 'settings');
  }

  function showMainView() {
    setHidden(el.settingsView, true);
    setHidden(el.mainView, false);
    setHidden(el.musicView, true);
    setHidden(document.getElementById('deepseekView'), true);
    setActiveTab('main');
  }

  function showSettingsView() {
    setHidden(el.mainView, true);
    setHidden(el.settingsView, false);
    setHidden(el.musicView, true);
    setHidden(document.getElementById('deepseekView'), true);
    setActiveTab('settings');
  }

  function showMusicView() {
    setHidden(el.mainView, true);
    setHidden(el.settingsView, true);
    setHidden(el.musicView, false);
    setHidden(document.getElementById('deepseekView'), true);
    setActiveTab('music');
  }

  function showDeepSeekView() {
    setHidden(el.settingsView, true);
    setHidden(el.mainView, true);
    setHidden(el.musicView, true);
    setHidden(document.getElementById('deepseekView'), false);
    setActiveTab('chat');
  }

  el.btnBackFromSettings?.addEventListener('click', () => showMainView());
  el.btnOpenSettings?.addEventListener('click', () => showSettingsView());

  el.tabMain?.addEventListener('click', () => showMainView());
  el.tabDeepseek?.addEventListener('click', () => showDeepSeekView());
  el.tabMusic?.addEventListener('click', () => showMusicView());
  el.tabSettings?.addEventListener('click', () => showSettingsView());

  setActiveTab('main');

  // Обновления темы от главного процесса.
  if (window.api?.onThemeUpdate) {
    window.api.onThemeUpdate(({ theme }) => {
      applyTheme(theme);
      if (el.toggleNeonTheme) el.toggleNeonTheme.checked = theme === 'neon';
    });
  }

  // Переключение “прослушивания” (реальный голос + fallback).
  let listening = false;
  updateListeningUi({
    listening,
    btnToggleListening: el.btnToggleListening,
    statusText: el.statusText,
    voiceHint: el.voiceHint,
    voiceViz: el.voiceViz,
    statusPulse: el.statusPulse,
    voiceStateIcon: el.voiceStateIcon,
  });

  function setListening(next) {
    listening = !!next;
    updateListeningUi({
      listening,
      btnToggleListening: el.btnToggleListening,
      statusText: el.statusText,
      voiceHint: el.voiceHint,
      voiceViz: el.voiceViz,
      statusPulse: el.statusPulse,
      voiceStateIcon: el.voiceStateIcon,
    });
  }

  el.btnToggleListening?.addEventListener('click', async () => {
    const next = !listening;
    try {
      if (next) {
        // Проверяем доступность микрофона перед стартом распознавания.
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Тут же освобождаем доступ, нам нужен только факт доступности.
            stream?.getTracks?.().forEach((t) => {
              try { t.stop(); } catch {}
            });
          } else {
            throw new Error('mediaDevices_not_available');
          }
        } catch (err) {
          setListening(false);
          if (el.statusText) el.statusText.textContent = 'Микрофон недоступен (разрешите доступ к аудио).';
          if (el.voiceHint) el.voiceHint.textContent = 'Прослушивание: нет доступа к микрофону';
          if (el.statusPulse) el.statusPulse.dataset.state = 'idle';
          if (el.voiceViz) el.voiceViz.dataset.state = 'off';
          if (el.voiceStateIcon) el.voiceStateIcon.dataset.state = 'pause';
          return;
        }

        // UI: режим загрузки до первого результата.
        if (el.statusText) el.statusText.textContent = 'Запуск распознавания…';
        if (el.voiceHint) el.voiceHint.textContent = 'Прослушивание: загрузка';
        if (el.statusPulse) el.statusPulse.dataset.state = 'loading';
        if (el.voiceViz) el.voiceViz.dataset.state = 'loading';
        if (el.voiceStateIcon) el.voiceStateIcon.dataset.state = 'loading';
        if (el.btnToggleListening) {
          el.btnToggleListening.querySelector('.btn-title').textContent = 'Стоп';
          el.btnToggleListening.querySelector('.btn-sub').textContent = 'Загрузка…';
        }

        // Запускаем распознавание в main (Vosk или fallback).
        // PCM-поток стартуем сразу, чтобы подтвердить что микрофон захватывается.
        await window.api.startVoiceListening();

        // Стрим PCM сразу — feed в main пойдет в node-vosk или python-vosk, когда они будут готовы.
        try {
          await startVoskPcmStream();
          window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'PCM: running' });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Vosk PCM stream start failed:', err);
          window.api?.showNotification?.({ title: 'Connor', body: 'Не удалось запустить оффлайн микрофон (PCM).' });
          window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'PCM: error' });
        }

        // Параллельно проверяем готовность оффлайн STT.
        try {
          const startAt = Date.now();
          while (Date.now() - startAt < 15000) {
            const st = await window.api?.voskIsReady?.();
            if (st?.ok && st?.ready) {
              window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'Vosk: ready' });
              break;
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 200));
          }
          // Если за время не поднялся — оставляем подсказку пользователю.
          const st = await window.api?.voskIsReady?.();
          if (st?.ok && !st?.ready) {
            const err = st?.error ? ` (${String(st.error).replace(/^PYTHON_VOSK_/, '').trim()})` : '';
            window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: `Vosk: not ready${err}` });
          }
        } catch {}
      } else {
        // Останавливаем PCM до остановки голоса, чтобы освободить микрофон.
        try {
          stopVoskPcmStream();
        } catch {}
        const stopResp = await window.api.stopVoiceListening();
        if (!stopResp?.ok) {
          throw new Error(stopResp?.reason || stopResp?.error || 'voice_stop_failed');
        }
      }
      setListening(next);
    } catch {
      // Если IPC/голос недоступны — оставляем UI в безопасном состоянии.
      setListening(false);
      if (el.statusText) el.statusText.textContent = 'Голос недоступен';
    }
  });

  // ==================== ГОЛОСОВОЕ УПРАВЛЕНИЕ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ====================
  let speechRecognition = null;
  let isMicActive = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 3;
  let latestMicLevel = 0;

  // ==================== OFFLINE VOSK PCM STREAM (WebAudio) ====================
  let voskPcmActive = false;
  let voskStream = null;
  let voskAudioCtx = null;
  let voskSource = null;
  let voskProcessor = null;
  let voskReadyForPcm = false;
  let voskReadyPollTimer = null;
  let lastNotReadyStatusAt = 0;

  const VOSK_TARGET_SAMPLE_RATE = 16000;

  function float32ToInt16LE(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = float32[i];
      // clamp to [-1, 1]
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  function resampleFloat32(input, inRate, outRate) {
    if (inRate === outRate) return input;
    const ratio = outRate / inRate;
    const outLen = Math.max(1, Math.floor(input.length * ratio));
    const output = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIndex = i / ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = srcIndex - i0;
      output[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return output;
  }

  async function startVoskPcmStream() {
    if (voskPcmActive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia недоступен');
    }
    if (!window.api?.sendVoicePcmFrame) {
      throw new Error('sendVoicePcmFrame недоступен');
    }

    // Получаем stream один раз и дальше гоняем PCM в main.
    // Важно: для части Windows-драйверов "жесткие" constraints дают нулевой сигнал.
    // Поэтому используем мягкие настройки (или системные дефолты).
    const tryMic = async () => {
      const variants = [
        {
          audio: {
            channelCount: { ideal: 1 },
            echoCancellation: { ideal: false },
            noiseSuppression: { ideal: false },
            autoGainControl: { ideal: false },
          },
          video: false,
        },
        {
          audio: {
            channelCount: { ideal: 1 },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
          video: false,
        },
        { audio: true, video: false },
      ];
      let lastErr = null;
      for (const constraints of variants) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const s = await navigator.mediaDevices.getUserMedia(constraints);
          return s;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('microphone_unavailable');
    };
    voskStream = await tryMic();

    voskPcmActive = true;
    voskReadyForPcm = false;

    // Микро-индикатор: оцениваем громкость (RMS) и шлём во floating-окно.
    let micLevelSmooth = 0;
    let lastMicLevelSentAt = 0;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    // Не форсируем 16k в самом AudioContext — на ряде систем это ломает вход (получаем нули).
    // Вместо этого вручную ресемплим в 16k перед отправкой в main.
    voskAudioCtx = new AudioContextCtor();
    try {
      if (voskAudioCtx.state !== 'running') {
        await voskAudioCtx.resume();
      }
    } catch {}

    voskSource = voskAudioCtx.createMediaStreamSource(voskStream);
    voskProcessor = voskAudioCtx.createScriptProcessor(4096, 1, 1);

    // Базовый сигнал “микрофон захвачен”, чтобы UI не был полностью статичен.
    try {
      window.api?.sendVoiceMicLevel?.(0.08);
    } catch {}

    let silentChunks = 0;
    voskProcessor.onaudioprocess = (e) => {
      if (!voskPcmActive) return;
      if (!voskReadyForPcm) {
        const now = Date.now();
        if (now - lastNotReadyStatusAt > 2000) {
          lastNotReadyStatusAt = now;
          window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'Vosk: not ready (PCM hold)' });
        }
        return;
      }
      const input = e.inputBuffer.getChannelData(0); // Float32

      // level в диапазоне 0..1 (очень грубо, но достаточно для UI-индикатора).
      try {
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          const x = input[i];
          sumSq += x * x;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, input.length));
        // Повышенная чувствительность для визуального индикатора.
        const level = Math.min(1, rms * 20);
        if (rms < 0.00002) silentChunks += 1;
        else silentChunks = 0;

        const now = Date.now();
        if (now - lastMicLevelSentAt > 100) {
          micLevelSmooth = micLevelSmooth * 0.6 + level * 0.4;
          latestMicLevel = micLevelSmooth;
          if (el.voiceViz) {
            el.voiceViz.style.setProperty('--voice-level', String(Math.max(0, Math.min(1, latestMicLevel))));
            const hue = Math.round(190 + Math.min(1, latestMicLevel) * 120);
            el.voiceViz.style.setProperty('--voice-hue', String(hue));
          }
          window.api?.sendVoiceMicLevel?.(micLevelSmooth);
          lastMicLevelSentAt = now;

          // Диагностика: если долго абсолютная тишина, явно показываем в статусе.
          if (silentChunks > 120) {
            window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'Mic input: silence (check Windows input device)' });
          }
        }
      } catch {}

      const inRate = voskAudioCtx?.sampleRate || VOSK_TARGET_SAMPLE_RATE;
      const resampled = resampleFloat32(input, inRate, VOSK_TARGET_SAMPLE_RATE);
      const pcm16 = float32ToInt16LE(resampled);
      try {
        // eslint-disable-next-line no-console
        // console.log('🎤 PCM chunk', pcm16.length);
        window.api?.sendVoicePcmFrame?.(pcm16);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('sendVoicePcmFrame failed:', err);
      }
    };

    // Подключаем граф, чтобы onaudioprocess начал приходить данные.
    voskSource.connect(voskProcessor);
    voskProcessor.connect(voskAudioCtx.destination);

    // Периодически проверяем, готов ли Vosk, чтобы не слать PCM в пустоту.
    const pollReady = async () => {
      try {
        const st = await window.api?.voskIsReady?.();
        voskReadyForPcm = !!st?.ok && !!st?.ready;
      } catch {
        voskReadyForPcm = false;
      }
    };
    await pollReady();
    voskReadyPollTimer = setInterval(pollReady, 1500);
  }

  function stopVoskPcmStream() {
    voskPcmActive = false;
    voskReadyForPcm = false;
    if (voskReadyPollTimer) {
      clearInterval(voskReadyPollTimer);
      voskReadyPollTimer = null;
    }
    latestMicLevel = 0;
    if (el.voiceViz) {
      el.voiceViz.style.setProperty('--voice-level', '0');
      el.voiceViz.style.setProperty('--voice-hue', '190');
    }
    try {
      window.api?.sendVoiceMicLevel?.(0);
    } catch {}

    try {
      voskProcessor?.disconnect?.();
    } catch {}
    try {
      voskSource?.disconnect?.();
    } catch {}

    try {
      voskStream?.getTracks?.().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    } catch {}

    voskSource = null;
    voskProcessor = null;
    voskStream = null;

    try {
      voskAudioCtx?.close?.();
    } catch {}
    voskAudioCtx = null;
  }

  async function checkMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      return true;
    } catch {
      return false;
    }
  }

  function stopFallbackSpeech() {
    isMicActive = false;
    if (speechRecognition) {
      try {
        speechRecognition.stop();
      } catch {}
      speechRecognition = null;
    }

    if (el.statusText) el.statusText.textContent = 'Ожидание команд';
    if (el.voiceHint) el.voiceHint.textContent = 'Голос выключен';
    if (el.statusPulse) el.statusPulse.dataset.state = 'idle';
    window.api?.sendVoiceStatusUpdate?.({ listening: false, transcript: '' });
  }

  function processCommand(rawCommand) {
    const cmd = String(rawCommand || '').trim().toLowerCase();
    if (!cmd) return '';
    if (cmd === 'what can you do') return 'что ты умеешь';
    if (cmd === 'shutdown computer') return 'выключи компьютер';
    if (cmd === 'restart computer') return 'перезагрузи компьютер';
    if (cmd === 'lock screen') return 'заблокируй экран';
    if (cmd === 'unlock screen') return 'разблокируй экран';
    if (cmd === 'open youtube') return 'открой youtube';
    if (cmd === 'documents') return 'открой документы';
    if (cmd === 'downloads') return 'открой загрузки';
    if (cmd === 'desktop') return 'открой рабочий стол';
    if (cmd === 'music') return 'открой музыку';
    if (cmd === 'videos') return 'открой видео';
    if (cmd === 'stop timer') return 'останови таймер';
    if (cmd === 'что ты умеешь') return 'что ты умеешь';
    if (cmd === 'выключи компьютер') return 'выключи компьютер';
    if (cmd === 'перезагрузи компьютер') return 'перезагрузи компьютер';
    if (cmd === 'заблокируй экран') return 'заблокируй экран';
    if (cmd === 'разблокируй экран') return 'разблокируй экран';
    if (cmd === 'открой youtube') return 'открой youtube';
    if (cmd === 'документы') return 'открой документы';
    if (cmd === 'загрузки') return 'открой загрузки';
    if (cmd === 'рабочий стол') return 'открой рабочий стол';
    if (cmd === 'музыка') return 'открой музыку';
    if (cmd.includes('какая сегодня погода') || cmd.includes('погода сегодня') || cmd.includes('погода')) return 'погода сегодня';
    if (cmd.includes('ютуб') || cmd.includes('youtube')) return 'открой youtube';
    if (cmd.includes('что нового') || cmd.includes('новости') || cmd.includes('лента')) return 'что нового';
    const mGoogle = cmd.match(/найди\s+(.+)\s+в\s+гугл/i);
    if (mGoogle) return `найди ${mGoogle[1].trim()} в гугл`;
    const mTimer = cmd.match(/таймер\s+на\s+(\d+)\s+минут/i);
    if (mTimer) return `таймер на ${mTimer[1]} минут`;
    const mTimerEn = cmd.match(/timer\s+for\s+(\d+)\s+minutes?/i);
    if (mTimerEn) return `таймер на ${mTimerEn[1]} минут`;
    const mGoogleEn = cmd.match(/search\s+(.+)/i);
    if (mGoogleEn) return `найди ${mGoogleEn[1].trim()}`;
    const m = cmd.match(/найди\s+(.+)/i);
    if (m) return `найди ${m[1].trim()}`;
    if (cmd.startsWith('поиск ')) return `найди ${cmd.replace(/^поиск\s+/, '')}`.trim();
    return cmd;
  }

  async function startFallbackSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (el.statusText) el.statusText.textContent = '❌ Голос не поддерживается';
      return;
    }

    if (speechRecognition) return;

    // Проверяем микрофон
    const micOk = await checkMicrophone();
    if (!micOk) {
      if (el.statusText) el.statusText.textContent = '❌ Микрофон недоступен';
      return;
    }

    isMicActive = true;
    reconnectAttempts = 0;

    if (el.statusText) el.statusText.textContent = '🎤 Слушаю... Скажите "Коннор"';
    if (el.voiceHint) el.voiceHint.textContent = 'Слушаю...';
    if (el.statusPulse) el.statusPulse.dataset.state = 'on';

    window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: '' });

    function createRecognition() {
      const rec = new SpeechRecognition();
      rec.lang = settings?.language === 'en' ? 'en-US' : 'ru-RU';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        // eslint-disable-next-line no-console
        console.log('🎤 SpeechRecognition запущен');
        if (el.statusText) el.statusText.textContent = '🎤 Слушаю...';
        reconnectAttempts = 0;
      };

      rec.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        transcript = String(transcript || '').trim();
        // eslint-disable-next-line no-console
        console.log('🎤 Распознано:', transcript);

        window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript });

        if (el.voiceHint) el.voiceHint.textContent = `"${transcript.substring(0, 40)}"`;

        const lower = transcript.toLowerCase();
        if (lower.includes('коннор') || lower.includes('connor')) {
          const command = processCommand(lower.replace('коннор', '').replace('connor', '').trim());
          if (command && window.api?.sendVoiceFallbackTranscript) {
            // eslint-disable-next-line no-console
            console.log('🎤 Команда:', command);
            window.api.sendVoiceFallbackTranscript(command);
            window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: `⚡ ${command}` });
            if (el.voiceHint) el.voiceHint.textContent = `✅ ${command}`;
          }
        }
      };

      rec.onerror = (event) => {
        const code = event?.error;
        // eslint-disable-next-line no-console
        console.log('SpeechRecognition ошибка:', code);

        if (code === 'no-speech') {
          if (el.voiceHint) el.voiceHint.textContent = 'Говорите...';
          return;
        }

        if (code === 'not-allowed') {
          if (el.statusText) el.statusText.textContent = '❌ Доступ к микрофону запрещён';
          stopFallbackSpeech();
        } else if (code === 'network') {
          if (el.statusText) el.statusText.textContent = '⚠️ Ошибка сети, переподключение...';
          if (reconnectAttempts < MAX_RECONNECT) {
            reconnectAttempts += 1;
            setTimeout(() => {
              if (isMicActive) {
                try {
                  rec.start();
                } catch {}
              }
            }, 1000);
          }
        }
      };

      rec.onend = () => {
        // eslint-disable-next-line no-console
        console.log('🎤 SpeechRecognition остановлен');
        if (!isMicActive) return;
        setTimeout(() => {
          if (isMicActive && speechRecognition) {
            try {
              speechRecognition.start();
            } catch {}
          }
        }, 200);
      };

      return rec;
    }

    speechRecognition = createRecognition();
    try {
      speechRecognition.start();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Ошибка запуска:', err);
      stopFallbackSpeech();
    }
  }

  // Подписка на fallback
  if (window.api?.onVoiceFallbackStart) {
    window.api.onVoiceFallbackStart(() => {
      // Если Vosk недоступен — освобождаем микрофон, чтобы fallback работал стабильно.
      try {
        stopVoskPcmStream();
      } catch {}
      if (!isMicActive) startFallbackSpeech();
    });
  }

  if (window.api?.onVoiceFallbackStop) {
    window.api.onVoiceFallbackStop(() => {
      stopFallbackSpeech();
    });
  }

  // Получаем команды от main (после wake word — или напрямую из fallback)
  if (window.api?.onVoiceCommand) {
    window.api.onVoiceCommand(({ command }) => {
      const lowerCmd = String(command || '').trim().toLowerCase();
      const isEn = settings?.language === 'en';
      // Runtime voice settings controls (renderer-side TTS).
      if (lowerCmd === 'коннор, говори громче' || lowerCmd === 'говори громче' || lowerCmd === 'speak louder') {
        const next = clamp((Number(settings.ttsVolume) || 0.8) + 0.1, 0, 1);
        settings.ttsVolume = next;
        if (el.ttsVolume) el.ttsVolume.value = String(next);
        void updateSettings({ ttsVolume: next });
        speak(isEn ? 'Voice volume increased' : 'Громкость голоса увеличена');
      } else if (lowerCmd === 'коннор, говори тише' || lowerCmd === 'говори тише' || lowerCmd === 'speak quieter') {
        const next = clamp((Number(settings.ttsVolume) || 0.8) - 0.1, 0, 1);
        settings.ttsVolume = next;
        if (el.ttsVolume) el.ttsVolume.value = String(next);
        void updateSettings({ ttsVolume: next });
        speak(isEn ? 'Voice volume decreased' : 'Громкость голоса уменьшена');
      } else if (lowerCmd === 'коннор, говори быстрее' || lowerCmd === 'говори быстрее' || lowerCmd === 'speak faster') {
        const next = clamp((Number(settings.ttsRate) || 1.0) + 0.1, 0.5, 2.0);
        settings.ttsRate = next;
        if (el.ttsRate) el.ttsRate.value = String(next);
        void updateSettings({ ttsRate: next });
        speak(isEn ? 'Speech rate increased' : 'Скорость речи увеличена');
      } else if (lowerCmd === 'коннор, говори медленнее' || lowerCmd === 'говори медленнее' || lowerCmd === 'speak slower') {
        const next = clamp((Number(settings.ttsRate) || 1.0) - 0.1, 0.5, 2.0);
        settings.ttsRate = next;
        if (el.ttsRate) el.ttsRate.value = String(next);
        void updateSettings({ ttsRate: next });
        speak(isEn ? 'Speech rate decreased' : 'Скорость речи уменьшена');
      } else if (lowerCmd === 'коннор, не озвучивай' || lowerCmd === 'не озвучивай' || lowerCmd === 'disable voice responses') {
        settings.ttsEnabled = false;
        if (el.ttsEnabled) el.ttsEnabled.checked = false;
        void updateSettings({ ttsEnabled: false });
      } else if (lowerCmd === 'что ты умеешь' || lowerCmd === 'what can you do') {
        const skills = [
          'Голосовые команды',
          'Музыкальный плеер',
          'Казино рулетка',
          'Скриншоты с OCR',
          'Напоминания и таймеры',
          'Системные метрики',
          'Управление громкостью',
          'Открытие папок',
          'Поиск в Google',
        ];
        window.api?.showNotification?.({
          title: 'Connor Assistant',
          body: skills.join(', '),
        });
        speak(isEn
          ? 'I can handle voice commands, music, screenshots, timers, and Google search.'
          : 'Я умею: голосовые команды, музыку, скриншоты, таймеры и поиск в Google.');
      } else if (lowerCmd.startsWith('таймер на ')) {
        speak(isEn ? `Timer started. ${command}` : `Таймер запущен. ${command}`);
      } else if (lowerCmd === 'останови таймер' || lowerCmd === 'стоп таймер' || lowerCmd === 'stop timer') {
        speak(isEn ? 'Timers stopped' : 'Таймеры остановлены');
      } else if (lowerCmd.startsWith('открой ')) {
        speak(isEn ? `Executing: ${command}` : `Выполняю: ${command}`);
      } else if (lowerCmd.startsWith('найди ')) {
        speak(isEn ? `Searching: ${command.replace(/^найди\s+/i, '')}` : `Ищу: ${command.replace(/^найди\s+/i, '')}`);
      }

      // eslint-disable-next-line no-console
      console.log('🎤 Команда от main:', command);
      if (el.statusText) el.statusText.textContent = `Команда: ${command}`;
      if (el.voiceHint) el.voiceHint.textContent = `✅ ${command}`;
      window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: `⚡ ${command}` });
      // Wake-word/command hit visual expansion.
      if (el.voiceViz) {
        el.voiceViz.classList.remove('wake-hit');
        // force reflow
        void el.voiceViz.offsetWidth;
        el.voiceViz.classList.add('wake-hit');
      }
      setTimeout(() => {
        if (!isMicActive) return;
        if (el.voiceHint && !el.voiceHint.textContent.includes('Слушаю')) {
          el.voiceHint.textContent = 'Слушаю...';
        }
      }, 2000);
    });
  }

  async function runMicTest({ seconds = 2 } = {}) {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        window.api?.showNotification?.({ title: 'Микрофон', body: 'getUserMedia недоступен в этом окружении.' });
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        window.api?.showNotification?.({ title: 'Микрофон', body: 'MediaRecorder недоступен в этом окружении.' });
        return;
      }

      stopFallbackSpeech();

      if (el.statusText) el.statusText.textContent = '🎤 Тест микрофона: говорите...';
      window.api?.sendVoiceStatusUpdate?.({ listening: true, transcript: 'Тест микрофона...' });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        try {
          if (e?.data?.size > 0) chunks.push(e.data);
        } catch {}
      };

      const stopped = new Promise((resolve) => {
        recorder.onstop = () => resolve(true);
      });

      recorder.start();
      setTimeout(() => {
        try {
          recorder.stop();
        } catch {}
      }, Math.max(0.5, seconds) * 1000);

      await stopped;

      try {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      } catch {}

      if (!chunks.length) throw new Error('no_audio_chunks');
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.onended = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      };

      await audio.play().catch(() => {});
      window.api?.showNotification?.({ title: 'Тест микрофона', body: 'Проигрывание завершено.' });
      if (el.statusText) el.statusText.textContent = 'Готово';
      window.api?.sendVoiceStatusUpdate?.({ listening: false });
    } catch (err) {
      if (el.statusText) el.statusText.textContent = `❌ Тест микрофона: ошибка`;
      window.api?.showNotification?.({ title: 'Тест микрофона', body: err?.message || String(err) });
      try {
        window.api?.sendVoiceStatusUpdate?.({ listening: false });
      } catch {}
    }
  }

  if (window.api?.onMicTest) {
    window.api.onMicTest(() => {
      void runMicTest({ seconds: 2 });
    });
  }

  // Быстрое обновление системы.
  el.btnRefreshSystem?.addEventListener('click', async () => {
    if (el.statusText) el.statusText.textContent = 'Обновляю показатели…';
    try {
      await window.api.refreshSystem();
    } finally {
      // Возвращаем статус, чтобы UI не “зависал”.
      updateListeningUi({
        listening,
        btnToggleListening: el.btnToggleListening,
        statusText: el.statusText,
        voiceHint: el.voiceHint,
        voiceViz: el.voiceViz,
        statusPulse: el.statusPulse,
      });
    }
  });

  // Уведомления.
  el.btnTestNotification?.addEventListener('click', () => {
    window.api.showNotification({
      title: 'CONNOR Assistant',
      body: 'Тест уведомления. Неон продолжает работать.',
    });
  });

  // Быстрая смена темы.
  el.btnQuickTheme?.addEventListener('click', async () => {
    const newTheme = settings.theme === 'neon' ? 'classic' : 'neon';
    settings.theme = newTheme;
    applyTheme(newTheme);
    if (el.toggleNeonTheme) el.toggleNeonTheme.checked = newTheme === 'neon';
    await window.api.setSettings({ theme: newTheme });
  });

  // Открыть окно казино.
  el.btnOpenCasino?.addEventListener('click', async () => {
    try {
      if (window.api?.openCasino) await window.api.openCasino();
    } catch {
      window.api?.showNotification?.({ title: 'Casino', body: 'Не удалось открыть казино.' });
    }
  });

  // Выход из приложения.
  el.btnQuitApp?.addEventListener('click', () => {
    // Quit в главном процессе.
    if (window.api?.quitAppInMain) window.api.quitAppInMain();
    else window.close();
  });

  // Настройки: автозапуск.
  let isUpdatingSettings = false;
  async function updateSettings(partial) {
    if (isUpdatingSettings) return;
    isUpdatingSettings = true;
    try {
      await window.api.setSettings(partial);
      settings = { ...settings, ...partial };
    } finally {
      isUpdatingSettings = false;
    }
  }

  el.btnApplyHotkeys?.addEventListener('click', () => {
    const nextHotkeys = {
      toggleWindow: el.hkToggleWindow?.value || '',
      toggleMuteSound: el.hkToggleMuteSound?.value || '',
      openBrowser: el.hkOpenBrowser?.value || '',
      voiceStart: el.hkVoiceStart?.value || '',
      exit: el.hkExit?.value || '',
    };

    setStatusText('Применяю горячие клавиши…');
    updateSettings({ hotkeys: nextHotkeys }).catch(() => {
      setStatusText('Не удалось сохранить горячие клавиши');
    });
  });

  function setStatusText(msg) {
    if (el.statusText) el.statusText.textContent = msg;
  }

  // ----------------------------
  // DeepSeek Chat (UI + IPC)
  // ----------------------------
  function setDeepseekStatus(msg) {
    if (!el.deepseekStatus) return;
    const s = String(msg || '');
    el.deepseekStatus.textContent = s;
    const processing = /^PROCESSING/i.test(s);
    el.deepseekStatus.classList.toggle('processing', processing);
  }

  function stopTts() {
    try {
      window.speechSynthesis?.cancel?.();
    } catch {}
  }

  let currentVoice = null;
  function getBestVoice(lang) {
    try {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (!voices.length) return null;
      const priority = ['Google', 'Microsoft', 'Yandex'];
      const langCode = lang === 'en' ? 'en-us' : 'ru-ru';
      for (const p of priority) {
        const found = voices.find((v) => String(v.lang || '').toLowerCase() === langCode && String(v.name || '').includes(p));
        if (found) return found;
      }
      return voices.find((v) => String(v.lang || '').toLowerCase() === langCode) || null;
    } catch {
      return null;
    }
  }

  function speak(text) {
    const t = String(text || '').trim();
    if (!t) return;
    if (settings?.ttsEnabled === false) return;
    try {
      if (!('speechSynthesis' in window)) return;
      stopTts();
      const u = new SpeechSynthesisUtterance(t);
      const lang = settings?.language === 'en' ? 'en' : 'ru';
      u.lang = lang === 'en' ? 'en-US' : 'ru-RU';
      currentVoice = currentVoice || getBestVoice(lang);
      if (currentVoice) u.voice = currentVoice;
      u.rate = clamp(Number(settings?.ttsRate ?? 1.0), 0.5, 2.0);
      u.volume = clamp(Number(settings?.ttsVolume ?? 0.8), 0, 1);
      window.speechSynthesis.speak(u);
    } catch {}
  }

  const speakText = speak;
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        currentVoice = getBestVoice(settings?.language === 'en' ? 'en' : 'ru');
      };
    }
  } catch {}

  function renderMessages(messages) {
    if (!el.deepseekMessages) return;
    el.deepseekMessages.innerHTML = '';
    if (!Array.isArray(messages)) return;

    for (const m of messages) {
      const msg = document.createElement('div');
      msg.className = `deepseek-msg ${m.role === 'assistant' ? 'assistant' : 'user'}`;

      const avatar = document.createElement('div');
      avatar.className = `deepseek-avatar ${m.role === 'assistant' ? 'assistant' : 'user'}`;
      avatar.textContent = m.role === 'assistant' ? 'C' : 'U';
      msg.appendChild(avatar);

      const meta = document.createElement('div');
      meta.className = 'deepseek-meta';
      meta.textContent = m.role === 'assistant' ? 'DeepSeek' : 'Вы';

      const body = document.createElement('div');
      body.textContent = m.text || '';

      msg.appendChild(meta);
      msg.appendChild(body);
      el.deepseekMessages.appendChild(msg);
    }

    el.deepseekMessages.scrollTop = el.deepseekMessages.scrollHeight;
  }

  let deepseekTypingToken = 0;

  function getLastAssistantBodyEl() {
    if (!el.deepseekMessages) return null;
    const nodes = Array.from(el.deepseekMessages.querySelectorAll('.deepseek-msg.assistant'));
    if (!nodes.length) return null;
    const last = nodes[nodes.length - 1];
    // В структуре: avatar -> meta -> body. Нам нужен последний.
    const body = last.querySelector('div:last-child');
    return body;
  }

  async function typeAssistantText(fullText) {
    const text = String(fullText || '');
    const body = getLastAssistantBodyEl();
    if (!body) return;

    if (prefersReducedMotion || !text) {
      body.textContent = text;
      return;
    }

    deepseekTypingToken += 1;
    const token = deepseekTypingToken;

    body.textContent = '';
    const totalMs = Math.max(900, Math.min(5200, text.length * 18));
    const start = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        if (token !== deepseekTypingToken) return resolve();

        const p = Math.max(0, Math.min(1, (now - start) / totalMs));
        const count = Math.floor(p * text.length);

        const blink = Math.floor(now / 220) % 2 === 0;
        const cursor = p < 1 ? (blink ? '▍' : '') : '';

        body.textContent = text.slice(0, count) + cursor;

        el.deepseekMessages.scrollTop = el.deepseekMessages.scrollHeight;

        if (p < 1) requestAnimationFrame(step);
        else {
          body.textContent = text;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  async function refreshDeepseekChats() {
    try {
      const chats = (await window.api?.deepseekListChats?.()) || [];
      if (!el.deepseekChatSelect) return;
      el.deepseekChatSelect.innerHTML = '';

      if (!chats.length) {
        // Если диалогов нет — создаём первый, чтобы UI сразу работал.
        const created = await window.api?.deepseekNewChat?.({ title: 'Новый чат' });
        if (created?.ok) {
          const updated = (await window.api?.deepseekListChats?.()) || [];
          // Повторим рендер ниже.
          for (const c of updated) {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            opt.textContent = c.title || c.id;
            el.deepseekChatSelect.appendChild(opt);
          }

          const first = (updated || [])[0];
          if (first) {
            el.deepseekChatSelect.value = String(first.id);
            await window.api?.deepseekSelectChat?.(first.id);
            await loadDeepseekChat(first.id);
          }
          return;
        }
      }

      for (const c of chats) {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.title || c.id;
        el.deepseekChatSelect.appendChild(opt);
      }

      if (chats[0]) {
        el.deepseekChatSelect.value = String(chats[0].id);
        await window.api?.deepseekSelectChat?.(chats[0].id);
        await loadDeepseekChat(chats[0].id);
      }
    } catch (err) {
      setDeepseekStatus(`DeepSeek chats error: ${err?.message || String(err)}`);
    }
  }

  async function loadDeepseekChat(chatId) {
    try {
      const resp = await window.api?.deepseekGetChat?.(chatId);
      if (!resp?.ok) return;
      const chat = resp.chat;
      renderMessages(chat.messages || []);
      return chat;
    } catch (err) {
      setDeepseekStatus(`DeepSeek load error: ${err?.message || String(err)}`);
      return null;
    }
  }

  async function handleSend(text) {
    const msgText = String(text || '').trim();
    if (!msgText) return;
    stopTts();
    setDeepseekStatus('PROCESSING...');
    showBootAnimation({ text: 'RK800 SYSTEM BOOT' });

    const sendBtn = el.btnDeepSend;
    const oldDisabled = !!sendBtn?.disabled;
    const oldTitle = sendBtn?.querySelector?.('.btn-title')?.textContent;
    const oldSub = sendBtn?.querySelector?.('.btn-sub')?.textContent;

    const chatId = el.deepseekChatSelect?.value || null;
    try {
      if (sendBtn) {
        sendBtn.disabled = true;
        if (sendBtn.querySelector?.('.btn-title')) sendBtn.querySelector('.btn-title').textContent = '⏳ Отправка';
        if (sendBtn.querySelector?.('.btn-sub')) sendBtn.querySelector('.btn-sub').textContent = '';
      }

      // Проверяем ключ перед отправкой.
      try {
        const st = await window.api?.deepseekGetState?.();
        if (st && !st.apiKeySet) {
          setDeepseekStatus('Ключ DeepSeek не задан.');
          if (window.api?.showNotification) {
            window.api.showNotification({ title: 'DeepSeek', body: 'Сначала укажите API ключ в настройках.' });
          }
          showSettingsView();
          return;
        }
      } catch {}

      const resp = await window.api?.deepseekSend?.({
        chatId,
        message: msgText,
      });

      if (!resp?.ok) {
        const err = resp?.error || 'error';
        setDeepseekStatus(`Ошибка: ${err}`);
        if (err === 'api_key_missing') {
          showSettingsView();
        }
        return;
      }

      // renderer ожидает messages как chat.messages
      const messages = resp.messages || [];
      let lastAssistantIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'assistant') {
          lastAssistantIndex = i;
          break;
        }
      }

      const assistantFullText = String(resp.assistantText || messages[lastAssistantIndex]?.text || '');

      const messagesForRender = messages.map((m, idx) => {
        if (idx !== lastAssistantIndex) return m;
        return { ...m, text: '' };
      });

      renderMessages(messagesForRender);
      setDeepseekStatus('DeepSeek: печатает…');

      await typeAssistantText(assistantFullText);
      setDeepseekStatus('Готово');

      if (el.deepseekAutoSpeak?.checked) speakText(assistantFullText);
    } catch (err) {
      setDeepseekStatus(`Ошибка: ${err?.message || String(err)}`);
    } finally {
      if (sendBtn && !oldDisabled) {
        sendBtn.disabled = false;
        if (sendBtn.querySelector?.('.btn-title') && typeof oldTitle === 'string') sendBtn.querySelector('.btn-title').textContent = oldTitle;
        if (sendBtn.querySelector?.('.btn-sub') && typeof oldSub === 'string') sendBtn.querySelector('.btn-sub').textContent = oldSub;
      }
    }
  }

  el.btnSaveDeepseekApiKey?.addEventListener('click', async () => {
    if (!el.deepseekApiKeyInput) return;
    const key = String(el.deepseekApiKeyInput.value || '').trim();
    if (!key) return;
    try {
      setDeepseekStatus('Сохраняю ключ…');
      await updateSettings({ deepseekApiKey: key });
      setDeepseekStatus('Ключ сохранен');
      el.deepseekApiKeyInput.value = '';
    } catch (err) {
      setDeepseekStatus(`Ошибка: ${err?.message || String(err)}`);
    }
  });

  el.btnSaveUserName?.addEventListener('click', async () => {
    try {
      const name = String(el.userNameInput?.value || '').trim();
      const resp = await window.api?.setSettings?.({ userName: name });
      if (!resp?.ok) throw new Error(resp?.error || 'save_name_failed');
      if (el.statusText) el.statusText.textContent = name ? `Имя сохранено: ${name}` : 'Имя очищено';
    } catch (err) {
      if (el.statusText) el.statusText.textContent = `Ошибка имени: ${err?.message || String(err)}`;
    }
  });

  el.btnClearCache?.addEventListener('click', async () => {
    try {
      const resp = await window.api?.cacheClear?.();
      if (!resp?.ok) throw new Error(resp?.error || 'clear_cache_failed');
      if (el.statusText) el.statusText.textContent = 'Кэш очищен';
    } catch (err) {
      if (el.statusText) el.statusText.textContent = `Ошибка кэша: ${err?.message || String(err)}`;
    }
  });

  el.btnRescanCache?.addEventListener('click', async () => {
    try {
      const resp = await window.api?.cacheRescan?.();
      if (!resp?.ok) throw new Error(resp?.error || 'rescan_failed');
      if (el.statusText) el.statusText.textContent = 'Пересканирование завершено';
    } catch (err) {
      if (el.statusText) el.statusText.textContent = `Ошибка сканирования: ${err?.message || String(err)}`;
    }
  });

  el.deepseekChatSelect?.addEventListener('change', async () => {
    const id = el.deepseekChatSelect?.value;
    if (!id) return;
    try {
      await window.api?.deepseekSelectChat?.(id);
    } catch {}
    await loadDeepseekChat(id);
  });

  el.btnDeepNewChat?.addEventListener('click', async () => {
    try {
      setDeepseekStatus('Создаю чат…');
      const resp = await window.api?.deepseekNewChat?.({ title: 'Новый чат' });
      if (!resp?.ok) {
        setDeepseekStatus(`Ошибка: ${resp?.error || 'unknown'}`);
        return;
      }
      await refreshDeepseekChats();
    } catch (err) {
      setDeepseekStatus(`Ошибка: ${err?.message || String(err)}`);
    }
  });

  el.btnDeepDeleteChat?.addEventListener('click', async () => {
    try {
      const chatId = el.deepseekChatSelect?.value;
      if (!chatId) return;
      const ok = confirm('Удалить текущий чат?');
      if (!ok) return;
      setDeepseekStatus('Удаляю чат…');
      const resp = await window.api?.deepseekDeleteChat?.(chatId);
      if (!resp?.ok) {
        setDeepseekStatus(`Ошибка: ${resp?.error || 'unknown'}`);
        return;
      }
      await refreshDeepseekChats();
    } catch (err) {
      setDeepseekStatus(`Ошибка: ${err?.message || String(err)}`);
    }
  });

  el.btnDeepSend?.addEventListener('click', async () => {
    const val = el.deepseekInput?.value || '';
    el.deepseekInput.value = '';
    await handleSend(val);
  });

  el.deepseekInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const val = el.deepseekInput?.value || '';
      el.deepseekInput.value = '';
      void handleSend(val);
    }
  });

  el.btnDeepSpeak?.addEventListener('click', () => {
    const lastAssistant = Array.from(el.deepseekMessages?.querySelectorAll?.('.deepseek-msg.assistant') || []).pop();
    const text = lastAssistant?.querySelector?.('div:last-child')?.textContent || '';
    speakText(text);
  });

  el.btnDeepStopSpeak?.addEventListener('click', () => stopTts());

  if (window.api?.onDeepseekAssistantMessage) {
    window.api.onDeepseekAssistantMessage((data) => {
      try {
        // При голосовом запуске показываем вкладку DeepSeek.
        showDeepSeekView();
        void (async () => {
          showBootAnimation({ text: 'RK800 SYSTEM BOOT' });

          const messages = data?.messages || null;
          if (Array.isArray(messages) && messages.length) {
            let lastAssistantIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i]?.role === 'assistant') {
                lastAssistantIndex = i;
                break;
              }
            }

            const assistantFullText = String(data?.assistantText || messages[lastAssistantIndex]?.text || '');
            const messagesForRender = messages.map((m, idx) => {
              if (idx !== lastAssistantIndex) return m;
              return { ...m, text: '' };
            });

            renderMessages(messagesForRender);
            setDeepseekStatus('DeepSeek: печатает…');

            await typeAssistantText(assistantFullText);
            setDeepseekStatus('Готово');
            if (el.deepseekAutoSpeak?.checked) speakText(assistantFullText);
          } else {
            if (data?.assistantText && el.deepseekAutoSpeak?.checked) speakText(data.assistantText);
            setDeepseekStatus('DeepSeek: ответ получен');
          }
        })();
      } catch {}
    });
  }

  // Инициализация: список диалогов.
  refreshDeepseekChats().catch(() => {});

  // ----------------------------
  // Macros UI & recording logic
  // ----------------------------
  let macroCache = [];
  let currentMacroId = null;
  let macroRecording = false;
  let macroListenersAttached = false;
  let macroOnMouseDown = null;
  let macroOnKeyDown = null;

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setMacroStatus(msg) {
    if (!el.macroStatus) return;
    const s = String(msg || '');
    if (!macroRecording) {
      el.macroStatus.textContent = s;
      return;
    }
    el.macroStatus.innerHTML = `<span class="rec-indicator"><span class="rec-dot" aria-hidden="true"></span>REC</span><span class="macro-status-text">${escapeHtml(
      s
    )}</span>`;
  }

  function isInMacroPanel(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('#macroPanel');
  }

  function isTextField(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  async function refreshMacros() {
    try {
      macroCache = (await window.api?.macroGetAll?.()) || [];
    } catch {
      macroCache = [];
    }

    if (!el.macroList) return;
    el.macroList.innerHTML = '';

    const sorted = macroCache.slice().sort((a, b) => Number(a?.id) - Number(b?.id));
    for (const m of sorted) {
      const opt = document.createElement('option');
      opt.value = String(m.id);
      opt.textContent = `${m.id}. ${m.name || 'Macro'}`;
      el.macroList.appendChild(opt);
    }

    if (!currentMacroId && sorted[0]) currentMacroId = sorted[0].id;
    if (currentMacroId) el.macroList.value = String(currentMacroId);
    syncMacroEditor();
  }

  function syncMacroEditor() {
    if (!el.macroList) return;
    if (!currentMacroId) return;
    const macro = macroCache.find((m) => Number(m?.id) === Number(currentMacroId)) || null;
    if (!macro) return;

    if (el.macroName) el.macroName.value = macro.name || `Macro ${macro.id}`;
    if (el.macroSteps) el.macroSteps.value = JSON.stringify(macro.steps || [], null, 2);
    setMacroStatus(`Выбран макрос #${macro.id}`);
  }

  function normalizeKeyForRecording(e) {
    const key = e.key;
    if (key === ' ') return ' ';
    if (key === 'Spacebar') return ' ';
    if (key === 'Escape') return 'escape';
    if (key === 'Enter') return 'enter';
    if (key === 'Backspace') return 'backspace';
    if (key === 'Delete') return 'delete';
    if (key === 'Tab') return 'tab';
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    if (/^F\d{1,2}$/i.test(key)) return key.toLowerCase();
    if (key && key.length === 1) return key.toLowerCase();
    return String(key || '').toLowerCase();
  }

  function attachMacroListeners() {
    if (macroListenersAttached) return;
    if (!window.api?.macroRecordEvent) return;

    const onMouseDown = (e) => {
      if (!macroRecording) return;
      if (isInMacroPanel(e.target)) return;
      if (!Number.isFinite(e.screenX) || !Number.isFinite(e.screenY)) return;
      const btn =
        e.button === 0 ? 'left' : e.button === 1 ? 'middle' : e.button === 2 ? 'right' : 'left';
      window.api.macroRecordEvent({
        type: 'click',
        x: Math.round(e.screenX),
        y: Math.round(e.screenY),
        button: btn,
        ts: Date.now(),
      });
    };

    const onKeyDown = (e) => {
      if (!macroRecording) return;
      if (isInMacroPanel(e.target)) return;
      if (isTextField(e.target)) return;
      if (e.repeat) return;

      // Игнорируем только модификаторы — иначе будет много лишних шагов.
      if (['control', 'shift', 'alt', 'meta'].includes(String(e.key || '').toLowerCase())) return;

      const key = normalizeKeyForRecording(e);
      if (!key) return;

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('control');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('command');

      window.api.macroRecordEvent({
        type: 'key',
        key,
        modifiers,
        ts: Date.now(),
      });
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);

    macroOnMouseDown = onMouseDown;
    macroOnKeyDown = onKeyDown;
    macroListenersAttached = true;
  }

  function detachMacroListeners() {
    if (!macroListenersAttached) return;
    try {
      if (macroOnMouseDown) document.removeEventListener('mousedown', macroOnMouseDown, true);
      if (macroOnKeyDown) document.removeEventListener('keydown', macroOnKeyDown, true);
    } catch {}
    macroListenersAttached = false;
    macroOnMouseDown = null;
    macroOnKeyDown = null;
  }

  if (el.macroList) {
    el.macroList.addEventListener('change', () => {
      const id = Number(el.macroList.value);
      if (Number.isFinite(id)) {
        currentMacroId = id;
        syncMacroEditor();
      }
    });
  }

  el.btnMacroRecord?.addEventListener('click', async () => {
    try {
      if (!window.api?.macroStartRecording) return;
      if (macroRecording) return;
      setMacroStatus('Запуск записи…');

      // Запускаем новую запись (main создаст новый macroId).
      const resp = await window.api.macroStartRecording({
        name: el.macroName?.value ? String(el.macroName.value) : 'Macro',
      });
      if (!resp?.ok && resp?.error) {
        setMacroStatus(`Ошибка записи: ${resp.error}`);
        return;
      }

      macroRecording = true;
      currentMacroId = resp.macroId;
      setMacroStatus('Запись… нажимайте действия');
      await refreshMacros();

      // Сразу синхронизируем редактор под новый macroId.
      if (el.macroList) el.macroList.value = String(currentMacroId);
      syncMacroEditor();

      attachMacroListeners();
    } catch (err) {
      setMacroStatus(`Ошибка записи: ${err?.message || String(err)}`);
    }
  });

  el.btnMacroStop?.addEventListener('click', async () => {
    if (!macroRecording) return;
    try {
      macroRecording = false;
      detachMacroListeners();
      const resp = await window.api?.macroStopRecording?.();
      if (!resp?.ok) setMacroStatus(`Ошибка стопа: ${resp?.error || 'unknown'}`);
      await refreshMacros();
      if (currentMacroId && el.macroList) el.macroList.value = String(currentMacroId);
      syncMacroEditor();
    } catch (err) {
      setMacroStatus(`Ошибка стопа: ${err?.message || String(err)}`);
    }
  });

  el.btnMacroSave?.addEventListener('click', async () => {
    if (!currentMacroId) return;
    try {
      const raw = el.macroSteps?.value || '[]';
      const parsed = JSON.parse(raw);
      const steps = Array.isArray(parsed) ? parsed : parsed?.steps;
      if (!Array.isArray(steps)) {
        setMacroStatus('Шаги должны быть массивом');
        return;
      }

      const resp = await window.api?.macroUpdate?.({
        id: currentMacroId,
        name: el.macroName?.value || `Macro ${currentMacroId}`,
        steps,
      });

      if (!resp?.ok) {
        setMacroStatus(`Ошибка сохранения: ${resp?.error || 'unknown'}`);
        return;
      }
      setMacroStatus(`Сохранено: #${currentMacroId}`);
      await refreshMacros();
      syncMacroEditor();
    } catch (err) {
      setMacroStatus(`Ошибка JSON: ${err?.message || String(err)}`);
    }
  });

  el.btnMacroPlay?.addEventListener('click', async () => {
    if (!currentMacroId) return;
    try {
      const repeatTimes = Number(el.macroRepeatTimes?.value || 1);
      const loop = !!el.macroLoop?.checked;

      setMacroStatus(`Запуск макроса #${currentMacroId}…`);
      const resp = await window.api?.macroPlay?.({
        id: currentMacroId,
        repeatTimes,
        loop,
      });

      if (!resp?.ok) setMacroStatus(`Ошибка запуска: ${resp?.error || 'unknown'}`);
      else setMacroStatus(`Выполнено (#${currentMacroId})`);
    } catch (err) {
      setMacroStatus(`Ошибка запуска: ${err?.message || String(err)}`);
    }
  });

  // Первый рендер списка.
  refreshMacros();

  el.toggleAutoLaunch?.addEventListener('change', () => {
    updateSettings({ autoLaunch: el.toggleAutoLaunch.checked }).catch(() => {});
  });

  el.toggleNeonTheme?.addEventListener('change', () => {
    const newTheme = el.toggleNeonTheme.checked ? 'neon' : 'classic';
    updateSettings({ theme: newTheme }).catch(() => {});
  });

  el.toggleHotkey?.addEventListener('change', () => {
    updateSettings({ hotkeyEnabled: el.toggleHotkey.checked }).catch(() => {});
  });

  el.toggleNoConfirmPower?.addEventListener('change', () => {
    const checked = !!el.toggleNoConfirmPower.checked;
    if (el.skipConfirm) el.skipConfirm.checked = checked;
    updateSettings({ noConfirmPower: checked }).catch(() => {});
  });

  el.skipConfirm?.addEventListener('change', () => {
    const checked = !!el.skipConfirm.checked;
    if (el.toggleNoConfirmPower) el.toggleNoConfirmPower.checked = checked;
    updateSettings({ noConfirmPower: checked }).catch(() => {});
  });

  el.ttsEnabled?.addEventListener('change', () => {
    const checked = !!el.ttsEnabled.checked;
    settings.ttsEnabled = checked;
    updateSettings({ ttsEnabled: checked }).catch(() => {});
  });

  el.ttsRate?.addEventListener('input', () => {
    const rate = clamp(Number(el.ttsRate.value || 1.0), 0.5, 2.0);
    settings.ttsRate = rate;
  });
  el.ttsRate?.addEventListener('change', () => {
    const rate = clamp(Number(el.ttsRate.value || 1.0), 0.5, 2.0);
    settings.ttsRate = rate;
    updateSettings({ ttsRate: rate }).catch(() => {});
  });

  el.ttsVolume?.addEventListener('input', () => {
    const volume = clamp(Number(el.ttsVolume.value || 0.8), 0, 1);
    settings.ttsVolume = volume;
  });
  el.ttsVolume?.addEventListener('change', () => {
    const volume = clamp(Number(el.ttsVolume.value || 0.8), 0, 1);
    settings.ttsVolume = volume;
    updateSettings({ ttsVolume: volume }).catch(() => {});
  });

  el.appLanguage?.addEventListener('change', () => {
    const language = el.appLanguage.value === 'en' ? 'en' : 'ru';
    settings.language = language;
    currentVoice = null;
    updateSettings({ language }).catch(() => {});
  });

  el.autoUpdateEnabled?.addEventListener('change', () => {
    const enabled = !!el.autoUpdateEnabled.checked;
    settings.autoUpdateEnabled = enabled;
    updateSettings({ autoUpdateEnabled: enabled }).catch(() => {});
  });

  el.btnCheckUpdates?.addEventListener('click', () => {
    if (el.updateStatus) {
      el.updateStatus.textContent = '🔍 Проверка обновлений...';
      el.updateStatus.style.color = '#2dd4bf';
    }
    window.api?.checkForUpdates?.();
  });

  window.api?.onUpdateStatus?.((data) => {
    if (!el.updateStatus) return;
    const msg = String(data?.message || 'Статус неизвестен');
    el.updateStatus.textContent = `📡 ${msg}`;
    el.updateStatus.style.color = data?.status === 'error' ? '#ef4444' : '#2dd4bf';
    if (data?.status === 'update-available') {
      try {
        window.api?.showNotification?.({
          title: 'Обновление',
          body: data?.version ? `Доступна версия ${data.version}` : 'Найдена новая версия',
        });
      } catch {}
    }
  });

  window.api?.onUpdateProgress?.((data) => {
    const p = Math.max(0, Math.min(100, Number(data?.percent || 0)));
    if (el.updateProgress) el.updateProgress.style.display = 'block';
    if (el.updateProgressFill) el.updateProgressFill.style.width = `${p}%`;
    if (el.updateProgressText) el.updateProgressText.textContent = `Загрузка: ${p}%`;
    if (el.updateStatus) el.updateStatus.textContent = `📥 Загрузка: ${p}%`;
  });

  window.api?.onUpdateDownloaded?.(() => {
    if (el.updateStatus) {
      el.updateStatus.textContent = '✅ Обновление загружено! Перезапустите приложение.';
      el.updateStatus.style.color = '#10b981';
    }
    const restart = confirm('Обновление загружено. Перезапустить приложение для установки?');
    if (restart) window.api?.quitAndInstall?.();
  });

  // Маршрут из трея.
  if (window.api?.onRouteChange) {
    window.api.onRouteChange((data) => {
      const view = data?.view;
      if (view === 'settings') showSettingsView();
      if (view === 'main') showMainView();
      if (view === 'deepseek') showDeepSeekView();
    });
  }

  // Подключаем системный мониторинг.
  const activeWindowBlock = document.getElementById('activeWindowBlock');
  let lastActiveTitle = '';
  function pulseMetric(elNode) {
    if (!elNode) return;
    elNode.classList.remove('updating');
    // eslint-disable-next-line no-unused-expressions
    void elNode.offsetHeight;
    elNode.classList.add('updating');
  }
  startSystemMonitoring({
    onUiUpdate: (snapshotUi) => {
      if (cpuValue && cpuValue.textContent !== snapshotUi.cpuText) {
        cpuValue.textContent = snapshotUi.cpuText;
        pulseMetric(cpuValue);
      }
      if (cpuSub) cpuSub.textContent = 'Загрузка (CPU)';
      if (cpuBarFill && Number.isFinite(snapshotUi.cpuPercent)) {
        cpuBarFill.style.width = `${clamp(snapshotUi.cpuPercent, 0, 100)}%`;
      }

      if (ramValue && ramValue.textContent !== snapshotUi.ramValue) {
        ramValue.textContent = snapshotUi.ramValue;
        pulseMetric(ramValue);
      }
      if (ramSub) ramSub.textContent = snapshotUi.ramSub;
      if (ramBarFill && Number.isFinite(snapshotUi.ramUsedPercent)) {
        ramBarFill.style.width = `${clamp(snapshotUi.ramUsedPercent, 0, 100)}%`;
      }

      if (diskValue && diskValue.textContent !== snapshotUi.diskValue) {
        diskValue.textContent = snapshotUi.diskValue;
        pulseMetric(diskValue);
      }
      if (diskSub) diskSub.textContent = snapshotUi.diskSub;
      if (diskBarFill && Number.isFinite(snapshotUi.diskUsedPercent)) {
        diskBarFill.style.width = `${clamp(snapshotUi.diskUsedPercent, 0, 100)}%`;
      }

      if (activeWindowTitle) activeWindowTitle.textContent = snapshotUi.activeTitle;
      if (activeWindowOwner) activeWindowOwner.textContent = snapshotUi.activeOwner;

      if (activeWindowBlock && snapshotUi?.activeTitle && snapshotUi.activeTitle !== lastActiveTitle) {
        // Перезапуск анимации без задержек.
        activeWindowBlock.classList.remove('beat');
        // eslint-disable-next-line no-unused-expressions
        void activeWindowBlock.offsetHeight;
        activeWindowBlock.classList.add('beat');
        lastActiveTitle = snapshotUi.activeTitle;
      }

      if (updatedAtEl) updatedAtEl.textContent = `Обновление: ${snapshotUi.updatedAt}`;
    },
  });

  async function refreshReminders() {
    try {
      const items = (await window.api?.remindersGetAll?.()) || [];
      if (!remindersList) return;
      remindersList.innerHTML = '';

      if (!items.length) {
        const empty = document.createElement('div');
        empty.style.opacity = '0.7';
        empty.style.fontSize = '13px';
        empty.textContent = 'Активных напоминаний нет';
        remindersList.appendChild(empty);
        return;
      }

      for (const r of items) {
        const item = document.createElement('div');
        item.className = 'reminder-item';
        item.classList.add('reminder-enter');

        const msg = document.createElement('div');
        msg.className = 'reminder-msg';
        msg.textContent = r.message || '';

        const time = document.createElement('div');
        time.className = 'reminder-time';
        const rep = r.repeat ? ` • ${r.repeat}` : '';
        time.textContent = `${r.nextRun || '—'}${rep}`;

        item.appendChild(msg);
        item.appendChild(time);
        remindersList.appendChild(item);
      }
    } catch {}
  }

  refreshReminders().catch(() => {});
  if (window.api?.onRemindersUpdate) {
    window.api.onRemindersUpdate(() => refreshReminders().catch(() => {}));
  }
});

