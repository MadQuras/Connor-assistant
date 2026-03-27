const path = require('path');
const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain, session, clipboard, screen, dialog, shell } = require('electron');
const { default: Store } = require('electron-store');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
let autoUpdater = null;
try {
  // eslint-disable-next-line global-require
  ({ autoUpdater } = require('electron-updater'));
} catch {}
let updaterLog = null;
try {
  // eslint-disable-next-line global-require
  updaterLog = require('electron-log');
} catch {}

const si = require('systeminformation');
let yts = null;
try {
  // eslint-disable-next-line global-require
  yts = require('youtube-search');
} catch {}
let NodeID3 = null;
try {
  // eslint-disable-next-line global-require
  NodeID3 = require('node-id3');
} catch {}
async function getActiveWindow() {
  return null;
}

// Проверяем наличие Vosk модели (отладка для принудительного офлайн-режима).
const voskModelPath = path.join(__dirname, 'models', 'vosk-ru');
try {
  // eslint-disable-next-line no-console
  console.log('🔍 Проверка Vosk модели:', voskModelPath);
  // eslint-disable-next-line no-console
  console.log('📁 Модель существует:', fs.existsSync(voskModelPath));
} catch {}

const store = new Store({
  defaults: {
    autoLaunch: false,
    theme: 'neon',
    hotkeyEnabled: true,
    hotkeys: {
      toggleWindow: 'Control+Shift+T',
      toggleMuteSound: 'Control+Shift+M',
      openBrowser: 'Control+Shift+B',
      voiceStart: 'Control+Shift+R',
      exit: 'Control+Shift+Q',
    },
    macros: [],
    reminders: [],
    deepseek: {
      apiKey: '',
      activeChatId: null,
      chats: [],
    },
    casino: {
      wallet: 1000,
      history: [],
    },
    music: {
      volume: 0.7,
      playlists: [
        {
          id: 'playlist_1',
          name: 'Мои треки',
          tracks: [],
        },
      ],
      activePlaylistId: 'playlist_1',
      activeTrackIndex: 0,
    },
    musicTracks: [],
    musicFavorites: [],
    musicReleasesCache: {
      ts: 0,
      items: [],
    },
    connorFloating: { x: null, y: null },
    floatingBounds: { x: null, y: null },
    autoUpdateEnabled: true,
    onboardingCompleted: false,
    userName: '',
    onboarding: {
      scanFolders: true,
      findGames: false,
    },
    ttsEnabled: true,
    ttsRate: 1.0,
    ttsVolume: 0.8,
    language: 'ru',
    systemCommands: {
      noConfirmPower: false,
    },
    notes: [],
    clipboardHistory: [],
  },
});

let mainWindow = null;
let casinoWindow = null;
let connorFloatingWindow = null;
let onboardingWindow = null;
let musicScannerWindow = null;
let systemConfirmWindow = null;
let plannerWindow = null;
let timeWindow = null;
let notesWindow = null;
let musicPlayerFullWindow = null;
let systemPendingAction = null;
let systemConfirmInterval = null;
const CONNOR_FLOAT_W = 320;
const CONNOR_FLOAT_H = 120;
const CONNOR_FLOAT_MARGIN = 16;
let screenshotController = null;
let tray = null;
let isQuitting = false;
let systemTimer = null;
let voiceController = null;
let systemCommands = null;
let macroController = null;
let reminderController = null;
let timerController = null;
let deepseekController = null;
let notesController = null;
let voiceNetworkBlockActive = false;
let voiceNetworkBlockerInitialized = false;
let robotjsMissingNotified = false;
let voskModelMissingNotified = false;
let nodeScheduleMissingNotified = false;

const connorCachePath = path.join(app.getPath('userData'), 'connor-cache.json');

function getOnboardingRoots() {
  const home = app.getPath('home');
  const roots = [
    path.join(home, 'Documents'),
    path.join(home, 'Downloads'),
    path.join(home, 'Music'),
    path.join(home, 'Videos'),
    path.join(home, 'Desktop'),
  ];
  return roots.filter((p) => fs.existsSync(p));
}

async function scanOnboardingCache({ scanFolders = true, findGames = false } = {}) {
  const prev = readConnorCacheSync();
  const roots = getOnboardingRoots();
  const folderBuckets = [];
  let totalEntries = 0;

  if (scanFolders) {
    for (const root of roots) {
      try {
        const entries = await fs.promises.readdir(root, { withFileTypes: true });
        const sample = entries.slice(0, 250).map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
        }));
        totalEntries += sample.length;
        folderBuckets.push({ root, entries: sample });
      } catch {
        folderBuckets.push({ root, entries: [] });
      }
    }
  }

  const gameHints = [];
  if (findGames) {
    const pf = process.env.ProgramFiles;
    const pfx86 = process.env['ProgramFiles(x86)'];
    const gameRoots = [pf, pfx86].filter(Boolean).map((v) => path.join(v, 'Steam'));
    for (const p of gameRoots) {
      if (fs.existsSync(p)) gameHints.push(p);
    }
  }

  const payload = {
    ts: new Date().toISOString(),
    roots,
    scanFolders: !!scanFolders,
    findGames: !!findGames,
    totalEntries,
    folderBuckets,
    gameHints,
    customFolders: Array.isArray(prev?.customFolders) ? prev.customFolders : [],
  };

  await fs.promises.mkdir(path.dirname(connorCachePath), { recursive: true });
  await fs.promises.writeFile(connorCachePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function readConnorCacheSync() {
  try {
    if (!fs.existsSync(connorCachePath)) {
      return { folderBuckets: [], customFolders: [] };
    }
    const raw = fs.readFileSync(connorCachePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      ...parsed,
      folderBuckets: Array.isArray(parsed?.folderBuckets) ? parsed.folderBuckets : [],
      customFolders: Array.isArray(parsed?.customFolders) ? parsed.customFolders : [],
    };
  } catch {
    return { folderBuckets: [], customFolders: [] };
  }
}

async function writeConnorCache(cache) {
  await fs.promises.mkdir(path.dirname(connorCachePath), { recursive: true });
  await fs.promises.writeFile(connorCachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function normalizeNameKey(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/gi, '');
}

function collectFolderCandidatesFromCache(cache) {
  const out = [];
  const pushUnique = (item) => {
    if (!item?.path) return;
    const id = String(item.path).toLowerCase();
    if (out.some((x) => String(x.path).toLowerCase() === id)) return;
    out.push(item);
  };

  const custom = Array.isArray(cache?.customFolders) ? cache.customFolders : [];
  for (const c of custom) {
    pushUnique({
      name_ru: c.name_ru || c.name || '',
      name_en: c.name_en || '',
      displayName: c.displayName || c.name_ru || c.name_en || path.basename(String(c.path || '')),
      path: c.path,
      source: 'custom',
    });
  }

  const buckets = Array.isArray(cache?.folderBuckets) ? cache.folderBuckets : [];
  for (const b of buckets) {
    const root = String(b?.root || '');
    const entries = Array.isArray(b?.entries) ? b.entries : [];
    for (const e of entries) {
      if (e?.type !== 'dir') continue;
      const nm = String(e?.name || '').trim();
      if (!nm) continue;
      pushUnique({
        name_ru: nm,
        name_en: nm,
        displayName: nm,
        path: path.join(root, nm),
        source: 'scan',
      });
    }
  }

  return out;
}

async function rememberFolderInCache(name, folderPath) {
  const cache = readConnorCacheSync();
  const custom = Array.isArray(cache.customFolders) ? cache.customFolders : [];
  const existingIdx = custom.findIndex((x) => String(x.path || '').toLowerCase() === String(folderPath || '').toLowerCase());
  const entry = {
    name_ru: String(name || '').trim(),
    name_en: String(name || '').trim(),
    displayName: String(name || '').trim(),
    path: String(folderPath || '').trim(),
    ts: Date.now(),
  };
  if (existingIdx >= 0) custom[existingIdx] = { ...custom[existingIdx], ...entry };
  else custom.push(entry);
  cache.customFolders = custom;
  cache.ts = new Date().toISOString();
  await writeConnorCache(cache);
  return entry;
}

function notifyOnce(title, body) {
  try {
    new Notification({ title, body }).show();
  } catch {}
}

function logVoiceError(message, err, context) {
  try {
    const logDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'voice-error.log');
    const payload = {
      ts: new Date().toISOString(),
      message: String(message || 'voice-error'),
      error: err ? (err.stack || err.message || String(err)) : null,
      context: context && typeof context === 'object' ? context : null,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {}
}

function logVoiceTrace(event, payload) {
  try {
    const logDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'voice-trace.log');
    const row = {
      ts: new Date().toISOString(),
      event: String(event || 'voice-trace'),
      payload: payload && typeof payload === 'object' ? payload : payload ?? null,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {}
}

function logSystemError(message, err, context) {
  try {
    const logDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'system-error.log');
    const payload = {
      ts: new Date().toISOString(),
      message: String(message || 'system-error'),
      error: err ? (err.stack || err.message || String(err)) : null,
      context: context && typeof context === 'object' ? context : null,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {}
}

function initVoiceNetworkBlocker() {
  if (voiceNetworkBlockerInitialized) return;
  voiceNetworkBlockerInitialized = true;

  // Отключаем сетевой блокировщик для голосового модуля.
  // Он может провоцировать нестабильные сетевые ошибки вида "OnSizeReceived failed with Error: -2"
  // (особенно когда в приложении параллельно есть другие сетевые операции: DeepSeek, обновления, музыка и т.п.).
  // В новом Vosk-PCM режиме микрофон оффлайн, блокировка сети не нужна.
}

const HOTKEYS_DEFS = {
  toggleWindow: { label: 'Показать/скрыть окно', default: 'Control+Shift+T' },
  toggleMuteSound: { label: 'Звук: вкл/выкл', default: 'Control+Shift+M' },
  openBrowser: { label: 'Открыть браузер', default: 'Control+Shift+B' },
  voiceStart: { label: 'Запустить распознавание', default: 'Control+Shift+R' },
  exit: { label: 'Выход', default: 'Control+Shift+Q' },
};

function normalizeAccelerator(acc) {
  if (typeof acc !== 'string') return '';
  return acc.trim()
    .replace(/\bCtrl\b/gi, 'Control')
    .replace(/\bAlt\b/gi, 'Alt')
    .replace(/\bShift\b/gi, 'Shift')
    .replace(/\bCmd\b/gi, 'Command');
}

function getHotkeysFromStore() {
  const h = store.get('hotkeys') || {};
  return {
    toggleWindow: normalizeAccelerator(h.toggleWindow || HOTKEYS_DEFS.toggleWindow.default),
    toggleMuteSound: normalizeAccelerator(h.toggleMuteSound || HOTKEYS_DEFS.toggleMuteSound.default),
    openBrowser: normalizeAccelerator(h.openBrowser || HOTKEYS_DEFS.openBrowser.default),
    voiceStart: normalizeAccelerator(h.voiceStart || HOTKEYS_DEFS.voiceStart.default),
    exit: normalizeAccelerator(h.exit || HOTKEYS_DEFS.exit.default),
  };
}

function resolveAssetPath(relative) {
  return path.join(__dirname, relative);
}

function getRootPathForDisk() {
  if (process.platform === 'win32') {
    const sysDrive = process.env.SystemDrive || 'C:';
    return `${sysDrive}\\`;
  }
  return '/';
}

function normalizeRuText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class VoiceController {
  constructor({
    mainWindowGetter,
    wakeWord = 'коннор',
    voskModelPath = process.env.VOSK_MODEL_PATH || path.join(__dirname, 'models', 'vosk-ru'),
    voskModelPathEn = process.env.VOSK_MODEL_PATH_EN || path.join(__dirname, 'models', 'vosk-en'),
    sampleRate = 16000,
  } = {}) {
    this.mainWindowGetter = mainWindowGetter;
    this.language = String(store.get('language') || 'ru').toLowerCase() === 'en' ? 'en' : 'ru';
    this.wakeWords = ['коннор', 'connor'];
    this.wakeWordNormalized = normalizeRuText(wakeWord);
    this._configuredVoskModelPath = voskModelPath;
    this._configuredVoskModelPathEn = voskModelPathEn;
    this.voskModelPath = null;
    this.sampleRate = sampleRate;

    this._callbacks = new Set();

    this._listening = false;
    this._awaitingCommandAfterWakeWord = false;
    this._lastEmitted = { command: null, ts: 0 };

    // Node/Vosk state
    this._voskModel = null;
    this._recognizer = null;
    this._pythonLastError = null;
    this._pythonProc = null;
    this._pythonReady = false;
    this._pythonLastError = null;
    this._pcmFrames = 0;
    this._pcmReported = false;
    this._audioStream = null;
    this._micInstance = null;
    this._arecordProc = null;

    this._webSpeechFallbackTriggered = false;
  }

  normalizeText(text) {
    let normalized = String(text || '').toLowerCase().trim();
    if (this.language === 'ru') normalized = normalized.replace(/ё/g, 'е');
    return normalized
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isWakeWord(text) {
    const lower = this.normalizeText(text);
    return this.wakeWords.some((w) => lower.includes(String(w).toLowerCase()));
  }

  refreshLanguage() {
    const prev = this.language;
    this.language = String(store.get('language') || 'ru').toLowerCase() === 'en' ? 'en' : 'ru';
    if (prev !== this.language && this._listening) {
      try {
        this.stopListening();
      } catch {}
      setTimeout(() => {
        try {
          this.startListening();
        } catch {}
      }, 120);
    }
  }

  startListening() {
    if (this._listening) return;
    this._listening = true;
    this._awaitingCommandAfterWakeWord = false;
    this._webSpeechFallbackTriggered = false;
    logVoiceTrace('listening:start', { sampleRate: this.sampleRate, wakeWord: this.wakeWordNormalized });

    // Перекидываем в следующий тик, чтобы не блокировать рендер и UI.
    setImmediate(() => {
      this._startListeningFlow().catch((err) => {
        logVoiceError('startListeningFlow failed', err, { stage: 'startListeningFlow' });
        if (!this._listening) return;
        // VOSK-only режим: Web Speech fallback не включаем.
      });
    });
  }

  isVoskReady() {
    return !!this._recognizer || !!this._pythonReady;
  }

  _stopPythonVosk() {
    this._pythonReady = false;
    this._pythonLastError = null;
    try {
      if (this._pythonProc?.stdin && !this._pythonProc.stdin.destroyed) {
        this._pythonProc.stdin.end();
      }
    } catch {}
    try {
      this._pythonProc?.kill?.();
    } catch {}
    this._pythonProc = null;
  }

  async _tryStartPythonVosk(modelDir) {
    try {
      this._stopPythonVosk();
    } catch {}

    this._pythonReady = false;
    const pyScriptCandidates = [
      path.join(__dirname, 'vosk_stream.py'),
      path.join(process.resourcesPath, 'vosk_stream.py'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'vosk_stream.py'),
      path.join(process.cwd(), 'vosk_stream.py'),
    ];
    const pyScript = pyScriptCandidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || pyScriptCandidates[0];
    const spawnArgs = [pyScript, '--model', modelDir, '--sample-rate', String(this.sampleRate)];
    // eslint-disable-next-line no-console
    console.log('🐍 Python path:', process.env.PATH);
    // eslint-disable-next-line no-console
    console.log('📁 Model dir:', modelDir);
    // eslint-disable-next-line no-console
    console.log('📜 Script:', pyScript);
    // eslint-disable-next-line no-console
    console.log('📦 resourcesPath:', process.resourcesPath);
    // eslint-disable-next-line no-console
    console.log('📂 cwd:', process.cwd());
    // eslint-disable-next-line no-console
    console.log('🧩 __dirname:', __dirname);

    if (!fs.existsSync(pyScript)) {
      // eslint-disable-next-line no-console
      console.log('❌ Python vosk script not found:', pyScript);
      return false;
    }
    const pythonCandidates = [
      process.env.PYTHON || 'python',
      'py',
    ];

    const { spawn } = require('child_process');
    let spawnErr = null;
    for (const candidate of pythonCandidates) {
      const cmd = String(candidate || '').trim();
      if (!cmd) continue;
      const args = cmd.toLowerCase() === 'py' ? ['-3', ...spawnArgs] : spawnArgs;
      try {
        logVoiceTrace('python-vosk:spawn', { pythonBin: cmd, args: args.slice(0, 4), script: pyScript, modelDir });
        this._pythonProc = spawn(cmd, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        spawnErr = null;
        break;
      } catch (err) {
        spawnErr = err;
      }
    }
    if (!this._pythonProc) {
      logVoiceError('Python spawn failed', spawnErr, { stage: '_tryStartPythonVosk' });
      return false;
    }

    let stdoutBuf = '';

    this._pythonProc.stdout.on('data', (chunk) => {
      try {
        stdoutBuf += chunk.toString('utf8');
        let idx;
        while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
          const line = stdoutBuf.slice(0, idx).trim();
          stdoutBuf = stdoutBuf.slice(idx + 1);
          if (!line) continue;

          if (line === 'READY') {
            this._pythonReady = true;
            logVoiceTrace('python-vosk:ready', {});
            try {
              sendToConnorFloating('voice:status', { listening: true, transcript: 'Python Vosk READY' });
            } catch {}
            continue;
          }
          if (line.startsWith('PYTHON_')) {
            // eslint-disable-next-line no-console
            console.log('PYTHON VOSK:', line);
            this._pythonLastError = line;
            logVoiceTrace('python-vosk:error-line', { line });
            logVoiceError('Python Vosk message', new Error(line), { stage: '_tryStartPythonVosk(stdout)' });
            continue;
          }

          // JSON: {"text":"..."}
          try {
            const obj = JSON.parse(line);
            const text = obj?.text;
            if (typeof text === 'string' && this._listening) {
              logVoiceTrace('python-vosk:text', { text: text.slice(0, 180) });
              this.handleTranscript(text);
            }
          } catch {}
        }
      } catch {}
    });

    let stderrBuf = '';
    this._pythonProc.stderr.on('data', (chunk) => {
      try {
        const s = chunk.toString('utf8');
        stderrBuf += s;
        const compact = String(s || '').trim();
        if (compact) this._pythonLastError = `PYTHON_VOSK_STDERR:${compact.slice(0, 280)}`;
      } catch {}
    });
    this._pythonProc.once('exit', (code) => {
      if (this._pythonReady) return;
      const tail = String(stderrBuf || '').trim();
      this._pythonLastError = `PYTHON_VOSK_PROCESS_EXIT:${code}${tail ? `:${tail.slice(0, 220)}` : ''}`;
    });

    // ждём READY
    const ready = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 20000);
      const onExit = () => resolve(false);
      this._pythonProc.once('exit', onExit);

      const check = () => {
        if (this._pythonReady) {
          clearTimeout(timeout);
          this._pythonProc.off('exit', onExit);
          resolve(true);
          return;
        }
        setTimeout(check, 150);
      };
      check();
    });

    return ready;
  }

  async _startListeningFlow() {
    // Пробуем офлайн-Vosk. Если не получилось — Web Speech fallback НЕ включаем (VOSK-only режим).
    let ok = false;
    try {
      ok = await this._tryStartNodeVosk();
    } catch (err) {
      logVoiceError('Vosk start failed', err, { stage: '_tryStartNodeVosk' });
      ok = false;
    }

    if (!this._listening) return;
    if (!ok) {
      if (!this._webSpeechFallbackTriggered) {
        this._webSpeechFallbackTriggered = true;
        try {
          new Notification({
            title: 'Connor',
            body: 'Офлайн-голос (Vosk) недоступен. Нужна установка Python Vosk (pip install vosk).',
          }).show();
        } catch {}
      }
      return;
    }
  }

  stopListening() {
    this._listening = false;
    this._awaitingCommandAfterWakeWord = false;
    voiceNetworkBlockActive = false;
    this._pcmFrames = 0;
    this._pcmReported = false;
    logVoiceTrace('listening:stop', {});

    try {
      this._audioStream?.removeAllListeners?.('data');
    } catch {}
    try {
      this._micInstance?.stop?.();
    } catch {}
    try {
      this._arecordProc?.kill?.();
    } catch {}

    this._audioStream = null;
    this._micInstance = null;
    this._arecordProc = null;
    this._recognizer = null;
    this._voskModel = null;
    try {
      this._stopPythonVosk();
    } catch {}

    const win = this.mainWindowGetter?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('voice:fallback:stop');
    }
  }

  onCommand(callback) {
    if (typeof callback !== 'function') return () => {};
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  _isSafeLocalPath(p) {
    if (typeof p !== 'string') return false;
    const s = p.trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s)) return false;
    return true;
  }

  _modelLooksValid(modelDir) {
    if (!modelDir || typeof modelDir !== 'string') return false;
    try {
      // В разных сборках Vosk конфиг бывает как в корне, так и в conf/model.conf.
      const hasModelConf = fs.existsSync(path.join(modelDir, 'model.conf'))
        || fs.existsSync(path.join(modelDir, 'conf', 'model.conf'))
        || fs.existsSync(path.join(modelDir, 'conf', 'mfcc.conf'));
      const hasGraphDir = fs.existsSync(path.join(modelDir, 'graph'));
      const hasGraphFst = fs.existsSync(path.join(modelDir, 'graph', 'HCLG.fst'))
        || fs.existsSync(path.join(modelDir, 'graph', 'disambig_tid.int'));
      const hasAmDir = fs.existsSync(path.join(modelDir, 'am'));
      const hasIvectors = fs.existsSync(path.join(modelDir, 'ivector'));
      const hasReadme = fs.existsSync(path.join(modelDir, 'README'));

      // Для Vosk достаточно иметь несколько "якорных" файлов/папок.
      const score = [
        hasModelConf,
        hasGraphDir || hasGraphFst,
        hasAmDir,
        hasIvectors,
        hasReadme,
      ].filter(Boolean).length;

      return score >= 2;
    } catch {
      return false;
    }
  }

  _getModelCandidates(lang = 'ru') {
    const isEn = String(lang || '').toLowerCase() === 'en';
    const preferred = isEn ? 'vosk-en' : 'vosk-ru';
    const fallback = isEn ? 'vosk-ru' : 'vosk-en';
    const configuredPreferred = isEn ? this._configuredVoskModelPathEn : this._configuredVoskModelPath;
    const configuredFallback = isEn ? this._configuredVoskModelPath : this._configuredVoskModelPathEn;
    return [
      path.join(process.resourcesPath, 'models', preferred),
      path.join(__dirname, 'models', preferred),
      path.join(process.cwd(), 'models', preferred),
      configuredPreferred,
      // fallback model in case preferred language model is absent
      path.join(process.resourcesPath, 'models', fallback),
      path.join(__dirname, 'models', fallback),
      path.join(process.cwd(), 'models', fallback),
      configuredFallback,
    ];
  }

  _resolveLocalVoskModelDir(lang = 'ru') {
    const candidates = this._getModelCandidates(lang);

    for (const dir of candidates) {
      if (!this._isSafeLocalPath(dir)) continue;
      if (fs.existsSync(dir) && this._modelLooksValid(dir)) {
        return dir;
      }
    }

    return null;
  }

  handleTranscript(text) {
    if (!this._listening) return;

    const normalized = this.normalizeText(text);
    if (!normalized) return;
    logVoiceTrace('stt:transcript', { raw: String(text || '').slice(0, 180), normalized: normalized.slice(0, 180) });

    // Показываем "что слышит" в основном UI и mini-оверлее.
    try {
      const win = this.mainWindowGetter?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('voice:status', { listening: true, transcript: String(text || '').trim() });
      }
    } catch {}
    try {
      sendToConnorFloating('voice:status', { listening: true, transcript: String(text || '').trim() });
    } catch {}

    // Допускаем варианты распознавания wake-word (частая проблема у STT):
    // "коннор", "конор", "конар", "connor"
    const wakeVariants = [this.wakeWordNormalized, ...this.wakeWords, 'конор', 'конар'];
    let wakeIdx = -1;
    let wakeUsed = '';
    for (const w of wakeVariants) {
      const i = normalized.indexOf(w);
      if (i !== -1) {
        wakeIdx = i;
        wakeUsed = w;
        break;
      }
    }
    if (wakeIdx !== -1) {
      const afterWake = normalized.slice(wakeIdx + wakeUsed.length).trim();
      this._awaitingCommandAfterWakeWord = !afterWake;
      logVoiceTrace('wakeword:hit', { wakeUsed, afterWake: afterWake.slice(0, 180), awaiting: this._awaitingCommandAfterWakeWord });
      if (afterWake) this._emitCommand(afterWake, text);
      return;
    }

    if (this._awaitingCommandAfterWakeWord) {
      this._awaitingCommandAfterWakeWord = false;
      logVoiceTrace('wakeword:next-phrase-command', { cmd: normalized.slice(0, 180) });
      this._emitCommand(normalized, text);
      return;
    }

    // Резерв: если wake-word не услышан, но в фразе явно есть известная команда —
    // выполняем её напрямую (чтобы пользователь не застревал из-за акцента/шума).
    const directCommandHints = [
      'врем',
      'дат',
      'систем',
      'информац',
      'погод',
      'обнов',
      'назад',
      'вперед',
      'вперёд',
      'скрин',
      'экран',
      'напом',
      'deepseek',
      'депсик',
      'дипсик',
      'чат',
      'тест',
      'микро',
      'time',
      'date',
      'weather',
      'open',
      'search',
      'timer',
      'remind',
      'lock',
      'shutdown',
      'restart',
    ];
    if (directCommandHints.some((h) => normalized.includes(h))) {
      logVoiceTrace('direct-command:fallback', { cmd: normalized.slice(0, 180) });
      this._emitCommand(normalized, text);
    }
  }

  _emitCommand(command, rawTranscript) {
    const now = Date.now();
    if (this._lastEmitted.command === command && now - this._lastEmitted.ts < 1200) return;
    this._lastEmitted = { command, ts: now };
    logVoiceTrace('command:emit', { command: String(command || '').slice(0, 180) });

    for (const cb of this._callbacks) {
      try {
        cb({ command, rawTranscript, ts: now });
      } catch {}
    }
  }

  feedPcmInt16LE(pcmInt16) {
    if (!this._listening) return;
    if (!pcmInt16 || !pcmInt16.buffer) return;
    this._pcmFrames += 1;
    const buf = Buffer.from(pcmInt16.buffer, pcmInt16.byteOffset, pcmInt16.byteLength);

    // 1) Node-vosk path
    if (this._recognizer) {
      try {
        // Vosk ожидает PCM S16_LE байты.
        const finalized = this._recognizer.acceptWaveform(buf);
        if (!finalized) return;

        const res = JSON.parse(this._recognizer.result() || '{}');
        if (res?.text) {
          // eslint-disable-next-line no-console
          console.log('🎤 Vosk распознал:', res.text);
          this.handleTranscript(res.text);
        }
      } catch (err) {
        logVoiceError('Vosk acceptWaveform failed', err, { stage: 'feedPcmInt16LE(node)' });
      }
      return;
    }

    // 2) Python-vosk path
    if (this._pythonReady && this._pythonProc?.stdin && !this._pythonProc.stdin.destroyed) {
      try {
        this._pythonProc.stdin.write(buf);
      } catch (err) {
        logVoiceError('Vosk python stdin write failed', err, { stage: 'feedPcmInt16LE(python)' });
      }
    }
  }

  _enableWebSpeechFallback() {
    const win = this.mainWindowGetter?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('voice:fallback:start');
    }
  }

  async _tryStartNodeVosk() {
    try {
      initVoiceNetworkBlocker();

      const modelDir = this._resolveLocalVoskModelDir(this.language);
      if (!modelDir) {
        this.voskModelPath = null;
        // eslint-disable-next-line no-console
        console.log('❌ Vosk модель не найдена (локально).');
        logVoiceError('Vosk model not found locally', null, {
          stage: 'resolveLocalVoskModelDir',
          candidates: [
            ...this._getModelCandidates(this.language),
          ],
        });

        if (!voskModelMissingNotified) {
          voskModelMissingNotified = true;
          notifyOnce('Vosk модель не найдена', 'Офлайн распознавание недоступно. Web Speech fallback отключён.');
        }
        return false;
      }

      // eslint-disable-next-line no-console
      console.log('✅ Vosk модель найдена:', modelDir);
      this.voskModelPath = modelDir;

      let voskPkg = null;
      try {
        voskPkg = require('vosk');
        // eslint-disable-next-line no-console
        console.log('✅ Vosk пакет загружен');
      } catch (err) {
        // Node-vosk часто не поднимается в Electron (native bindings). Это не критично,
        // если Python Vosk настроен — используем его.
        // eslint-disable-next-line no-console
        console.log('❌ Cannot require vosk (node native). Using Python fallback if available.', err?.message || String(err));
        // eslint-disable-next-line no-console
        console.log('❌ Не удалось загрузить vosk (node native). Пробуем Python Vosk...');

        try {
          const okPy = await this._tryStartPythonVosk(this.voskModelPath);
          if (okPy) return true;
        } catch {}

        return false;
      }

      const { Model, KaldiRecognizer } = voskPkg || {};
      if (!Model || !KaldiRecognizer) return false;

      this._voskModel = new Model(this.voskModelPath);
      this._recognizer = new KaldiRecognizer(this._voskModel, this.sampleRate);
      // Микрофон будем получать из renderer как PCM (int16, 16000 Гц, mono)
      // и кормить распознавателю через ipcMain ('voice:vosk:pcm').
      return true;
    } catch (err) {
      logVoiceError('Vosk init error', err, {
        stage: '_tryStartNodeVosk',
        modelDir: this.voskModelPath,
      });
      return false;
    }
  }

  async _isNodeMicrophoneAvailable() {
    if (process.platform === 'win32') {
      try {
        let micPkg = null;
        try {
          micPkg = require('node-microphone');
        } catch {
          return false;
        }

        let micInstance = null;
        if (typeof micPkg === 'function') {
          micInstance = micPkg({ rate: this.sampleRate, channels: 1 });
        } else if (micPkg?.Microphone) {
          micInstance = new micPkg.Microphone({ rate: this.sampleRate, channels: 1 });
        }
        if (!micInstance) return false;

        const stream = micInstance.getAudioStream ? micInstance.getAudioStream() : micInstance;
        const ok = !!stream && typeof stream.on === 'function';

        try {
          micInstance.stop?.();
        } catch {}
        return ok;
      } catch (err) {
        logVoiceError('Node microphone check error', err, { stage: '_isNodeMicrophoneAvailable(win32)' });
        return false;
      }
    }

    // Linux/macOS: проверяем наличие `arecord`.
    return await new Promise((resolve) => {
      try {
        const proc = spawn('arecord', ['-V']);
        let resolved = false;
        const finish = (v) => {
          if (resolved) return;
          resolved = true;
          resolve(v);
        };
        proc.once('error', () => finish(false));
        proc.once('close', () => finish(true));
        setTimeout(() => finish(false), 1200);
      } catch {
        resolve(false);
      }
    });
  }

  _startNodeMicrophoneVosk() {
    // Стараемся использовать node-microphone. Если API пакета отличается или пакета нет — fallback.
    return new Promise((resolve) => {
      let micPkg = null;
      try {
        // eslint-disable-next-line no-console
        console.log('🎤 Запуск Vosk через node-microphone...');
        micPkg = require('node-microphone');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log('❌ node-microphone не установлен/недоступен');
        logVoiceError('Cannot require node-microphone', err, { stage: '_startNodeMicrophoneVosk' });
        return resolve(false);
      }

      try {
        let micInstance = null;
        if (typeof micPkg === 'function') {
          micInstance = micPkg({ rate: this.sampleRate, channels: 1 });
        } else if (micPkg?.Microphone) {
          micInstance = new micPkg.Microphone({ rate: this.sampleRate, channels: 1 });
        }
        if (!micInstance) return resolve(false);

        const audioStream = micInstance.getAudioStream ? micInstance.getAudioStream() : micInstance;
        if (!audioStream || typeof audioStream.on !== 'function') return resolve(false);

        this._micInstance = micInstance;
        this._audioStream = audioStream;
        // eslint-disable-next-line no-console
        console.log('✅ node-microphone аудиопоток получен');

        audioStream.on('error', (err) => {
          logVoiceError('Vosk audioStream error', err, { stage: '_startNodeMicrophoneVosk' });
        });

        audioStream.on('data', (data) => {
          if (!this._listening || !this._recognizer) return;
          try {
            const finalized = this._recognizer.acceptWaveform(data);
            if (!finalized) return;
            const res = JSON.parse(this._recognizer.result() || '{}');
            if (res?.text) {
              // eslint-disable-next-line no-console
              console.log('🎤 Vosk распознал:', res.text);
              this.handleTranscript(res.text);
            }
          } catch (err) {
            logVoiceError('Vosk acceptWaveform/result parse error', err, { stage: 'audioStream.on(data)' });
          }
        });

        if (micInstance.start) micInstance.start();
        resolve(true);
      } catch (err) {
        logVoiceError('node-microphone init error', err, { stage: '_startNodeMicrophoneVosk' });
        resolve(false);
      }
    });
  }

  _startArecordVosk() {
    // Для Linux/macOS используем arecord, чтобы получить PCM 16-bit little-endian.
    return new Promise((resolve) => {
      let proc = null;
      try {
        proc = spawn('arecord', ['-f', 'S16_LE', '-r', String(this.sampleRate), '-c', '1']);
      } catch (err) {
        logVoiceError('spawn arecord failed', err, { stage: '_startArecordVosk' });
        return resolve(false);
      }

      if (!proc?.stdout) return resolve(false);
      this._arecordProc = proc;

      proc.stdout.on('data', (data) => {
        if (!this._listening || !this._recognizer) return;
        try {
          const finalized = this._recognizer.acceptWaveform(data);
          if (!finalized) return;
          const res = JSON.parse(this._recognizer.result() || '{}');
          if (res?.text) this.handleTranscript(res.text);
        } catch (err) {
          logVoiceError('Vosk arecord acceptWaveform/result parse error', err, { stage: 'arecord stdout data' });
        }
      });

      proc.once('error', (err) => {
        logVoiceError('arecord process error', err, { stage: 'arecord' });
        resolve(false);
      });

      resolve(true);
    });
  }
}

let systemCommandsElevatedRequested = false;

class SystemCommands {
  constructor({ logger } = {}) {
    this.logger = logger || null;
    this._robot = null;
  }

  _logError(message, err, context) {
    if (!this.logger) {
      // Не падать из-за логирования.
      try {
        // eslint-disable-next-line no-console
        console.error(message, err, context || {});
      } catch {}
      return;
    }
    try {
      this.logger(message, err, context);
    } catch {}
  }

  _getRobot() {
    return null;
  }

  async _isAdminWindows() {
    if (process.platform !== 'win32') return true;
    try {
      // net session: 0 -> админ, иначе ошибка.
      const res = spawnSync('net', ['session'], { windowsHide: true, stdio: 'ignore' });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  async _requestUacElevation() {
    if (systemCommandsElevatedRequested) return false;
    systemCommandsElevatedRequested = true;

    // Перезапускаем Electron с UAC (runas) и выходим.
    try {
      const exe = process.execPath;
      const args = process.argv.slice(1);
      const psExe = String(exe).replace(/'/g, "''");
      const psArgs = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(',');

      const cmd = `Start-Process -FilePath '${psExe}' -Verb RunAs -ArgumentList @(${psArgs})`;
      spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
        detached: true,
        stdio: 'ignore',
      });
    } catch (err) {
      this._logError('UAC elevation failed', err, { stage: '_requestUacElevation' });
      return false;
    }

    app.quit();
    return false;
  }

  async _ensureAdminIfNeeded({ requireAdmin } = {}) {
    if (!requireAdmin) return true;
    const isAdmin = await this._isAdminWindows();
    if (isAdmin) return true;
    return this._requestUacElevation();
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _focusActiveWindow() {
    try {
      await getActiveWindow();
      return true;
    } catch {
      return true;
    }
  }

  async windowMinimizeActive() {
    await this._focusActiveWindow();
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('space', 'alt');
    await this._sleep(60);
    robot.keyTap('n'); // minimize
    return true;
  }

  async windowRestoreActive() {
    await this._focusActiveWindow();
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('space', 'alt');
    await this._sleep(60);
    robot.keyTap('r'); // restore
    return true;
  }

  async windowMaximizeActive() {
    await this._focusActiveWindow();
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('space', 'alt');
    await this._sleep(60);
    robot.keyTap('x'); // maximize
    return true;
  }

  async windowCloseActive() {
    await this._focusActiveWindow();
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    // Alt+F4 закрывает активное окно.
    robot.keyTap('f4', 'alt');
    return true;
  }

  async appOpen({ app: appName } = {}) {
    const target = String(appName || '').toLowerCase();
    if (!target) throw new Error('app name is required');

    if (target === 'calculator' || target === 'calc' || target === 'калькулятор') {
      spawn('calc.exe', [], { windowsHide: true });
      return true;
    }

    if (target === 'explorer' || target === 'проводник' || target === 'файлы') {
      spawn('explorer.exe', [], { windowsHide: true });
      return true;
    }

    if (target === 'browser' || target === 'браузер' || target === 'chrome' || target === 'edge') {
      const candidates = [];
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      // Edge
      candidates.push(path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      // Chrome
      candidates.push(path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'));

      const first = candidates.find((p) => fs.existsSync(p));
      if (first) {
        spawn(first, [], { windowsHide: true });
        return true;
      }
      // Fallback: открыть браузер по ассоциации через cmd start.
      spawn('cmd', ['/c', 'start', '""', 'https://example.com'], { windowsHide: true });
      return true;
    }

    throw new Error(`unknown app: ${appName}`);
  }

  async volumeUp() {
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('audio_vol_up');
    return true;
  }

  async volumeDown() {
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('audio_vol_down');
    return true;
  }

  async volumeMute() {
    const robot = this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_missing' };
    robot.keyTap('audio_mute');
    return true;
  }

  _brightnessWmiSetCommand(percent) {
    const p = Math.max(0, Math.min(100, Number(percent)));
    // Включаем одно устройство (InstanceIndex=1). Для большинства систем подходит.
    // WmiMonitorBrightnessMethods: WmiSetBrightness(Timeout, Brightness).
    return `
$b=${p};
$m=Get-WmiObject -Namespace root\\WMI -Class WmiMonitorBrightnessMethods;
if($m -and $m.Length -gt 0){
  $m[0].WmiSetBrightness(1,$b) | Out-Null
} else {
  (Get-WmiObject -Namespace root\\WMI -Class WmiMonitorBrightnessMethods | Select-Object -First 1).WmiSetBrightness(1,$b) | Out-Null
}
`;
  }

  async brightnessSet({ percent } = {}) {
    const ok = await this._ensureAdminIfNeeded({ requireAdmin: true });
    if (!ok) return { ok: false, reason: 'elevation_requested' };
    const cmd = this._brightnessWmiSetCommand(percent);
    const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd];
    const p = spawn('powershell', psArgs, { windowsHide: true });
    return await new Promise((resolve, reject) => {
      p.once('error', reject);
      p.once('exit', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`brightnessSet exit code ${code}`));
      });
    });
  }

  async brightnessGetCurrent() {
    try {
      const cmd = `
$v=(Get-WmiObject -Namespace root\\WMI -Class WmiMonitorBrightness -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentBrightness);
if($null -eq $v){ $v=50 }
[int]$v
`;
      const p = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
        windowsHide: true,
        encoding: 'utf8',
      });
      const out = String(p.stdout || '').trim();
      const n = Number(out);
      if (!Number.isFinite(n)) return 50;
      return Math.max(0, Math.min(100, n));
    } catch (err) {
      this._logError('brightnessGetCurrent failed', err, { stage: 'brightnessGetCurrent' });
      return 50;
    }
  }

  async brightnessUp({ step = 10 } = {}) {
    const current = await this.brightnessGetCurrent();
    return this.brightnessSet({ percent: current + Number(step) });
  }

  async brightnessDown({ step = 10 } = {}) {
    const current = await this.brightnessGetCurrent();
    return this.brightnessSet({ percent: current - Number(step) });
  }

  async processKillByName({ name } = {}) {
    if (!name) throw new Error('process name is required');
    const requireAdmin = true; // taskkill для некоторых процессов может требовать админ.
    const ok = await this._ensureAdminIfNeeded({ requireAdmin });
    if (!ok) return { ok: false, reason: 'elevation_requested' };
    const procName = String(name).trim();
    const p = spawn('taskkill', ['/IM', procName, '/F'], { windowsHide: true });
    return await new Promise((resolve, reject) => {
      p.once('error', reject);
      p.once('exit', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`taskkill exit code ${code}`));
      });
    });
  }

  async computerLock() {
    // LockWorkStation обычно не требует админа.
    const p = spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { windowsHide: true });
    return await new Promise((resolve, reject) => {
      p.once('error', reject);
      p.once('exit', (code) => (code === 0 ? resolve(true) : reject(new Error(`lock exit code ${code}`))));
    });
  }

  async computerUnlock() {
    // Программная "разблокировка" без ввода пароля недоступна в нормальной модели безопасности Windows.
    // Здесь делаем "разбудить" попыткой лёгкого действия (не гарантируется).
    const robot = this._getRobot();
    if (robot) {
      robot.keyTap('shift');
    }
    return { ok: false, reason: 'unlock_requires_user_credentials' };
  }

  async execute(action, payload) {
    const a = String(action || '').toLowerCase();
    if (!a) throw new Error('action is required');

    switch (a) {
      case 'window:minimize': return this.windowMinimizeActive();
      case 'window:restore': return this.windowRestoreActive();
      case 'window:maximize': return this.windowMaximizeActive();
      case 'window:close': return this.windowCloseActive();

      case 'app:open': return this.appOpen(payload || {});

      case 'volume:up': return this.volumeUp();
      case 'volume:down': return this.volumeDown();
      case 'volume:mute': return this.volumeMute();

      case 'brightness:set': return this.brightnessSet(payload || {});
      case 'brightness:up': return this.brightnessUp(payload || {});
      case 'brightness:down': return this.brightnessDown(payload || {});

      case 'process:killByName': return this.processKillByName(payload || {});

      case 'computer:lock': return this.computerLock();
      case 'computer:unlock': return this.computerUnlock();

      default:
        throw new Error(`unknown action: ${action}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class MacroController {
  constructor({ logger, store } = {}) {
    this.logger = logger || null;
    this.store = store;

    this._recording = null; // { macroId, steps, lastTs, startedTs, targetWindow }
    this._playToken = 0;
  }

  _log(message, err, context) {
    if (this.logger) {
      try {
        this.logger(message, err, context);
        return;
      } catch {}
    }
    try {
      // eslint-disable-next-line no-console
      console.error(message, err, context || {});
    } catch {}
  }

  _getMacros() {
    const macros = this.store?.get('macros');
    if (!Array.isArray(macros)) return [];
    return macros;
  }

  _setMacros(macros) {
    this.store?.set('macros', Array.isArray(macros) ? macros : []);
  }

  _nextMacroId() {
    const macros = this._getMacros();
    let maxId = 0;
    for (const m of macros) {
      const id = Number(m?.id);
      if (Number.isFinite(id) && id > maxId) maxId = id;
    }
    return maxId + 1;
  }

  _normalizeSteps(steps) {
    if (!Array.isArray(steps)) return [];

    const out = [];
    for (const s of steps) {
      if (!s || typeof s !== 'object') continue;
      const type = String(s.type || '');
      if (!['delay', 'click', 'key'].includes(type)) continue;

      if (type === 'delay') {
        const ms = Number(s.ms);
        if (!Number.isFinite(ms) || ms < 0) continue;
        out.push({ type: 'delay', ms });
      }

      if (type === 'click') {
        const x = Number(s.x);
        const y = Number(s.y);
        const button = String(s.button || 'left');
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push({ type: 'click', x, y, button: ['left', 'right', 'middle'].includes(button) ? button : 'left' });
      }

      if (type === 'key') {
        const key = String(s.key || '').trim();
        if (!key) continue;
        const modifiers = Array.isArray(s.modifiers) ? s.modifiers.map((m) => String(m)).filter(Boolean) : [];
        out.push({ type: 'key', key, modifiers });
      }
    }
    return out;
  }

  async startRecording({ macroName } = {}) {
    if (this._recording) return { ok: false, error: 'already_recording' };

    const macroId = this._nextMacroId();
    const startedTs = Date.now();

    let targetWindow = null;
    try {
      targetWindow = await getActiveWindow();
    } catch {}

    this._recording = {
      macroId,
      steps: [],
      lastTs: startedTs,
      startedTs,
      targetWindow,
      macroName: String(macroName || `Macro ${macroId}`),
    };

    return { ok: true, macroId };
  }

  async stopRecording() {
    if (!this._recording) return { ok: false, error: 'not_recording' };
    const rec = this._recording;
    this._recording = null;

    const steps = this._normalizeSteps(rec.steps);
    const entry = {
      id: rec.macroId,
      name: rec.macroName,
      steps,
      targetWindow: rec.targetWindow || null,
      updatedAt: Date.now(),
    };

    const macros = this._getMacros();
    const idx = macros.findIndex((m) => Number(m?.id) === Number(entry.id));
    if (idx >= 0) macros[idx] = entry;
    else macros.push(entry);

    this._setMacros(macros);
    return { ok: true, macro: entry };
  }

  recordEvent(eventPayload) {
    if (!this._recording) return { ok: false, error: 'not_recording' };
    const payload = eventPayload || {};
    const ts = Number(payload.ts || Date.now());
    if (!Number.isFinite(ts)) return { ok: false, error: 'bad_ts' };

    const dt = ts - this._recording.lastTs;
    if (dt > 15) {
      this._recording.steps.push({ type: 'delay', ms: Math.round(dt) });
    } else if (dt > 0) {
      this._recording.steps.push({ type: 'delay', ms: 1 });
    }

    const type = String(payload.type || '');
    if (type === 'click') {
      const x = Number(payload.x);
      const y = Number(payload.y);
      const button = String(payload.button || 'left');
      if (Number.isFinite(x) && Number.isFinite(y)) {
        this._recording.steps.push({
          type: 'click',
          x,
          y,
          button: ['left', 'right', 'middle'].includes(button) ? button : 'left',
        });
      }
    } else if (type === 'key') {
      const key = String(payload.key || '').trim();
      if (key) {
        const modifiers = Array.isArray(payload.modifiers) ? payload.modifiers : [];
        this._recording.steps.push({
          type: 'key',
          key,
          modifiers,
        });
      }
    }

    this._recording.lastTs = ts;
    return { ok: true };
  }

  async updateMacro({ id, name, steps } = {}) {
    const macroId = Number(id);
    if (!Number.isFinite(macroId) || macroId <= 0) return { ok: false, error: 'bad_macro_id' };

    const normalizedSteps = this._normalizeSteps(steps);
    const macros = this._getMacros();
    const idx = macros.findIndex((m) => Number(m?.id) === macroId);
    if (idx < 0) return { ok: false, error: 'macro_not_found' };

    const prev = macros[idx];
    macros[idx] = {
      ...prev,
      id: macroId,
      name: String(name || prev?.name || `Macro ${macroId}`),
      steps: normalizedSteps,
      updatedAt: Date.now(),
    };

    this._setMacros(macros);
    return { ok: true, macro: macros[idx] };
  }

  getMacroById(id) {
    const macroId = Number(id);
    if (!Number.isFinite(macroId) || macroId <= 0) return null;
    const macros = this._getMacros();
    return macros.find((m) => Number(m?.id) === macroId) || null;
  }

  async _getRobot() {
    return null;
  }

  _robotKeyMap(key) {
    const k = String(key || '').trim();
    if (!k) return null;
    const lower = k.toLowerCase();

    const map = {
      ' ': 'space',
      'enter': 'enter',
      'escape': 'escape',
      'backspace': 'backspace',
      'delete': 'delete',
      'del': 'delete',
      'tab': 'tab',
      'up': 'up',
      'down': 'down',
      'left': 'left',
      'right': 'right',
      'pgup': 'pageup',
      'pageup': 'pageup',
      'pgdn': 'pagedown',
      'pagedown': 'pagedown',
      'home': 'home',
      'end': 'end',
    };

    // letters/numbers
    if (lower.length === 1 && /[a-z0-9]/i.test(lower)) return lower;
    if (map[lower]) return map[lower];

    // F1..F12
    if (/^f\d{1,2}$/i.test(lower)) return lower;

    // fallback: return lower
    return lower;
  }

  _robotModifiers(modifiers) {
    if (!Array.isArray(modifiers)) return [];
    const out = [];
    for (const m of modifiers) {
      const s = String(m || '').toLowerCase();
      if (s === 'control' || s === 'ctrl') out.push('control');
      else if (s === 'shift') out.push('shift');
      else if (s === 'alt') out.push('alt');
      else if (s === 'command' || s === 'meta' || s === 'win') out.push('command');
    }
    return out;
  }

  async _ensureTargetWindow(robot, targetWindow) {
    if (!robot || !targetWindow) return;
    let targetTitle = String(targetWindow?.title || '').trim();
    if (!targetTitle) return;

    const approxMatch = (title) => {
      const t = String(title || '');
      if (!t) return false;
      return t.toLowerCase().includes(targetTitle.toLowerCase().slice(0, 22));
    };

    try {
      const current = await getActiveWindow();
      if (approxMatch(current?.title)) return;
    } catch {}

    // Альт+Таб несколько раз, пока не найдём похожее окно.
    for (let i = 0; i < 8; i++) {
      try {
        robot.keyTap('tab', 'alt');
      } catch {}
      await sleep(420);
      try {
        const now = await getActiveWindow();
        if (approxMatch(now?.title)) break;
      } catch {}
    }
  }

  async playMacro({ id, repeatTimes = 1, loop = false } = {}) {
    const macroId = Number(id);
    if (!Number.isFinite(macroId) || macroId <= 0) return { ok: false, error: 'bad_macro_id' };

    const robot = await this._getRobot();
    if (!robot) return { ok: false, error: 'robotjs_not_available' };

    const macro = this.getMacroById(macroId);
    if (!macro) return { ok: false, error: 'macro_not_found' };

    const steps = this._normalizeSteps(macro.steps);
    const targetWindow = macro.targetWindow || null;

    const token = (this._playToken += 1);
    let iterations = 0;

    const maxIterations = loop ? Infinity : Math.max(1, Number(repeatTimes) || 1);

    const runOnce = async () => {
      await this._ensureTargetWindow(robot, targetWindow);

      for (const step of steps) {
        if (token !== this._playToken) return false; // canceled by another play

        if (step.type === 'delay') {
          await sleep(step.ms);
        } else if (step.type === 'click') {
          try {
            robot.moveMouseSmooth?.(step.x, step.y);
          } catch {}
          try {
            robot.mouseClick(step.x, step.y, step.button || 'left');
          } catch {}
        } else if (step.type === 'key') {
          const key = this._robotKeyMap(step.key);
          const modifiers = this._robotModifiers(step.modifiers);
          if (!key) continue;
          try {
            if (modifiers.length) robot.keyTap(key, modifiers);
            else robot.keyTap(key);
          } catch {}
        }
      }
      return true;
    };

    if (loop) {
      // В цикле нельзя ждать бесконечно — запускаем “в фоне” и сразу возвращаем управление UI.
      void (async () => {
        try {
          while (token === this._playToken) {
            iterations += 1;
            const ok = await runOnce();
            if (!ok) break;
          }
        } catch (err) {
          this._log('macro playback failed (loop)', err, { macroId, token });
        }
      })();

      return { ok: true, macroId, loop: true, iterations: 0 };
    }

    try {
      while (token === this._playToken && iterations < maxIterations) {
        iterations += 1;
        const ok = await runOnce();
        if (!ok) break;
      }
    } catch (err) {
      this._log('macro playback failed', err, { macroId, token });
      return { ok: false, error: err?.message || String(err) };
    }

    return { ok: true, macroId, loop: false, iterations: Math.min(iterations, maxIterations) };
  }

  async tryRunFromSpoken(command) {
    if (!command) return { ok: false, reason: 'no_command' };
    const text = normalizeRuText(command);

    // макрос 1 / макрос 02
    const m = text.match(/макрос\s*(\d+)/i);
    if (m?.[1]) {
      const n = Number(m[1]);
      // Пробуем по id, иначе по порядку.
      const byId = this.getMacroById(n);
      if (byId) return this.playMacro({ id: byId.id, repeatTimes: 1, loop: false });

      const macros = this._getMacros();
      const sorted = macros.slice().sort((a, b) => Number(a?.id) - Number(b?.id));
      const byIndex = sorted[n - 1];
      if (byIndex) return this.playMacro({ id: byIndex.id, repeatTimes: 1, loop: false });
    }

    // макрос один/два/три...
    const mapRu = {
      один: 1,
      два: 2,
      три: 3,
      четыре: 4,
      пять: 5,
      шесть: 6,
      семь: 7,
      восемь: 8,
      девять: 9,
      десять: 10,
    };
    const m2 = text.match(/макрос\s*(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)/i);
    if (m2?.[1]) {
      const n = mapRu[m2[1].toLowerCase()];
      if (n) return this.playMacro({ id: n, repeatTimes: 1, loop: false });
    }

    return { ok: false, reason: 'not_a_macro_command' };
  }
}

class ScreenshotController {
  constructor({ logger, clipboard } = {}) {
    this.logger = logger || null;
    this.clipboard = clipboard || null;

    this._screenshotLib = null;
    this._tesseract = null;
    this._workerPromise = null;
    this._busy = false;
    this._regionInProgress = false;
  }

  _log(message, err, context) {
    if (this.logger) {
      try {
        this.logger(message, err, context);
        return;
      } catch {}
    }
    try {
      // eslint-disable-next-line no-console
      console.error(message, err, context || {});
    } catch {}
  }

  async _getScreenshotLib() {
    if (this._screenshotLib) return this._screenshotLib;
    try {
      // eslint-disable-next-line global-require
      this._screenshotLib = require('screenshot-node');
      return this._screenshotLib;
    } catch (err) {
      this._log('screenshot-node require failed', err, { stage: 'require(screenshot-node)' });
      throw err;
    }
  }

  async _getTesseractWorker() {
    if (this._workerPromise) return this._workerPromise;

    this._workerPromise = (async () => {
      try {
        // eslint-disable-next-line global-require
        this._tesseract = require('tesseract.js');
        const worker = await this._tesseract.createWorker({
          // Тихий логгер — чтобы не спамить консоль
          logger: () => {},
        });

        // Язык по умолчанию: русский
        await worker.loadLanguage('rus');
        await worker.initialize('rus');
        return worker;
      } catch (err) {
        this._log('tesseract worker init failed', err, { stage: 'tesseract init' });
        this._workerPromise = null;
        throw err;
      }
    })();

    return this._workerPromise;
  }

  _makeScreenshotDir() {
    const dir = path.join(__dirname, 'screenshots');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    return dir;
  }

  _formatStamp(ts = Date.now()) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  async _saveScreenshot({ x, y, width, height }) {
    const screenshotLib = await this._getScreenshotLib();
    const dir = this._makeScreenshotDir();
    const filePath = path.join(dir, `screenshot_${this._formatStamp()}.png`);

    await new Promise((resolve, reject) => {
      try {
        screenshotLib.saveScreenshot(x, y, width, height, filePath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });

    return filePath;
  }

  async _ocrFile(filePath) {
    const worker = await this._getTesseractWorker();
    const res = await worker.recognize(filePath);
    const text = res?.data?.text || '';
    return String(text).trim();
  }

  _copyText(text) {
    try {
      if (this.clipboard && typeof this.clipboard.writeText === 'function') {
        this.clipboard.writeText(text);
      }
    } catch (err) {
      this._log('clipboard.writeText failed', err, { stage: '_copyText' });
    }
  }

  async takeFullScreenshot({ doOcr = true } = {}) {
    if (this._busy) return { ok: false, error: 'busy' };
    this._busy = true;

    try {
      const filePath = await this._saveScreenshot({ x: 0, y: 0, width: 0, height: 0 });
      let text = '';
      if (doOcr) {
        try {
          text = await this._ocrFile(filePath);
        } catch (err) {
          this._log('OCR failed for full screenshot', err, { filePath });
        }
      }

      if (text) this._copyText(text);
      return { ok: true, filePath, text };
    } catch (err) {
      this._log('takeFullScreenshot failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    } finally {
      this._busy = false;
    }
  }

  async takeRegionScreenshotInteractive({ doOcr = true } = {}) {
    if (this._busy || this._regionInProgress) return { ok: false, error: 'busy' };
    this._busy = true;
    this._regionInProgress = true;

    let overlayWindow = null;

    const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const overlayHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin:0; padding:0; width:100%; height:100%; background: rgba(0,0,0,0); cursor: crosshair; }
      #sel { position: fixed; border: 2px solid rgba(124,247,255,0.9); background: rgba(124,247,255,0.12); display:none; z-index: 999999; }
    </style>
  </head>
  <body>
    <div id="sel"></div>
    <script>
      const sel = document.getElementById('sel');
      let start = null;
      let cur = null;

      function render() {
        if (!start || !cur) return;
        const x1 = Math.min(start.screenX, cur.screenX);
        const y1 = Math.min(start.screenY, cur.screenY);
        const x2 = Math.max(start.screenX, cur.screenX);
        const y2 = Math.max(start.screenY, cur.screenY);
        sel.style.left = x1 + 'px';
        sel.style.top = y1 + 'px';
        sel.style.width = (x2 - x1) + 'px';
        sel.style.height = (y2 - y1) + 'px';
        sel.style.display = 'block';
      }

      window.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        start = { screenX: e.screenX, screenY: e.screenY };
        cur = { screenX: e.screenX, screenY: e.screenY };
        render();
      }, { capture: true });

      window.addEventListener('mousemove', (e) => {
        if (!start) return;
        cur = { screenX: e.screenX, screenY: e.screenY };
        render();
      }, { capture: true });

      window.addEventListener('mouseup', (e) => {
        if (!start) return;
        const end = { screenX: e.screenX, screenY: e.screenY };
        const x = Math.min(start.screenX, end.screenX);
        const y = Math.min(start.screenY, end.screenY);
        const w = Math.abs(end.screenX - start.screenX);
        const h = Math.abs(end.screenY - start.screenY);
        start = null;
        cur = null;
        sel.style.display = 'none';
        try {
          if (w > 5 && h > 5) window.api?.submitScreenshotRegion?.({ requestId: ${JSON.stringify(requestId)}, rect: { x, y, width: w, height: h } });
          else window.api?.cancelScreenshotRegion?.({ requestId: ${JSON.stringify(requestId)} });
        } catch {}
      }, { capture: true });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          try { window.api?.cancelScreenshotRegion?.({ requestId: ${JSON.stringify(requestId)} }); } catch {}
        }
      });
    </script>
  </body>
</html>
    `;

    const union = screen.getAllDisplays().reduce(
      (acc, d) => {
        const b = d.bounds;
        const x1 = Math.min(acc.x1, b.x);
        const y1 = Math.min(acc.y1, b.y);
        const x2 = Math.max(acc.x2, b.x + b.width);
        const y2 = Math.max(acc.y2, b.y + b.height);
        return { x1, y1, x2, y2 };
      },
      { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
    );
    const bounds = {
      x: union.x1,
      y: union.y1,
      width: union.x2 - union.x1,
      height: union.y2 - union.y1,
    };

    const rect = await new Promise((resolve) => {
      ipcMain.once('screenshot:region:submit', (_event, payload) => {
        try {
          if (payload?.requestId !== requestId) return resolve(null);
          const r = payload?.rect || {};
          const x = Math.round(Number(r.x));
          const y = Math.round(Number(r.y));
          const w = Math.round(Number(r.width));
          const h = Math.round(Number(r.height));
          if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 5 || h <= 5) return resolve(null);
          return resolve({ x, y, width: w, height: h });
        } catch {
          resolve(null);
        }
      });

      ipcMain.once('screenshot:region:cancel', (_event, payload) => {
        try {
          if (payload?.requestId && payload.requestId !== requestId) return resolve(null);
        } catch {}
        return resolve(null);
      });

      overlayWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transparent: true,
        frame: false,
        resizable: false,
        movable: false,
        fullscreenable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: true,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);

      overlayWindow.once('ready-to-show', () => {
        try {
          overlayWindow.showInactive();
        } catch {
          try { overlayWindow.show(); } catch {}
        }
      });
    });

    try {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    } catch {}

    if (!rect) {
      return { ok: false, error: 'cancelled' };
    }

    try {
      const filePath = await this._saveScreenshot(rect);
      let text = '';
      if (doOcr) {
        try {
          text = await this._ocrFile(filePath);
        } catch (err) {
          this._log('OCR failed for region screenshot', err, { filePath, rect });
        }
      }
      if (text) this._copyText(text);
      return { ok: true, filePath, text };
    } catch (err) {
      this._log('takeRegionScreenshotInteractive failed', err, { rect });
      return { ok: false, error: err?.message || String(err) };
    } finally {
      this._busy = false;
      this._regionInProgress = false;
    }
  }
}

class ReminderController {
  constructor({ store, logger, notificationFn } = {}) {
    this.store = store;
    this.logger = logger || null;
    this.notificationFn = notificationFn || null;

    this._jobs = new Map(); // id -> job
  }

  _log(message, err, context) {
    if (this.logger) {
      try {
        this.logger(message, err, context);
        return;
      } catch {}
    }
    try {
      // eslint-disable-next-line no-console
      console.error(message, err, context || {});
    } catch {}
  }

  _getReminders() {
    const list = this.store?.get('reminders');
    if (!Array.isArray(list)) return [];
    return list;
  }

  _setReminders(list) {
    this.store?.set('reminders', Array.isArray(list) ? list : []);
  }

  _formatNextRun(ts) {
    try {
      if (!Number.isFinite(ts)) return null;
      return new Date(ts).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    } catch {
      return null;
    }
  }

  getAllForUi() {
    const list = this._getReminders();
    return list
      .slice()
      .sort((a, b) => Number(a?.nextRun) - Number(b?.nextRun))
      .map((r) => ({
        id: r.id,
        message: r.message,
        repeat: r.repeat || null,
        nextRun: this._formatNextRun(r.nextRun),
        nextRunTs: r.nextRun,
      }));
  }

  _broadcastUpdate() {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reminders:update', this.getAllForUi());
      }
    } catch {}
  }

  _notify(title, body) {
    try {
      if (typeof this.notificationFn === 'function') {
        this.notificationFn(title, body);
        return;
      }
    } catch {}
    try {
      if (tray && typeof tray.displayBalloon === 'function') {
        tray.displayBalloon({
          title: String(title || ''),
          content: String(body || ''),
        });
        return;
      }
    } catch {}
    try {
      new Notification({ title, body }).show();
    } catch {}
  }

  _scheduleOne({ reminder, nodeSchedule }) {
    const ts = Number(reminder.nextRun);
    if (!Number.isFinite(ts)) return;
    const id = reminder.id;

    // fallback: если node-schedule нет, используем setTimeout
    const scheduleWithTimeout = !nodeSchedule || typeof nodeSchedule.scheduleJob !== 'function';

    const job = scheduleWithTimeout
      ? setTimeout(async () => {
      try {
        this._notify('Напоминание', reminder.message || '...');
      } catch {}

      // Обработка календаря (best-effort)
      try {
        if (process.env.CONNOR_CALENDAR_ENABLED === 'true') {
          await this._createCalendarEventFromReminder(reminder).catch(() => {});
        }
      } catch {}

      // Для повторяющихся: сдвигаем nextRun и сохраняем, затем перепланируем.
      try {
        const baseTs = Number(reminder.nextRun);
        if (reminder.repeat === 'daily') {
          reminder.nextRun = baseTs + 24 * 60 * 60 * 1000;
        } else if (reminder.repeat === 'weekly') {
          reminder.nextRun = baseTs + 7 * 24 * 60 * 60 * 1000;
        } else {
          // Убираем одноразовый.
          const list = this._getReminders();
          this._setReminders(list.filter((x) => String(x.id) !== String(reminder.id)));
          this._jobs.delete(String(id));
          this._broadcastUpdate();
          return;
        }

        // Для повторяющихся обновляем и сохраняем.
        const list = this._getReminders();
        const idx = list.findIndex((x) => String(x.id) === String(reminder.id));
        if (idx >= 0) {
          list[idx] = reminder;
          this._setReminders(list);
        }
        this._broadcastUpdate();
      } catch (err) {
        this._log('reminder reschedule failed', err, { reminderId: id });
      }

      // Перепланируем следующий запуск.
      try {
        this._scheduleOne({ reminder, nodeSchedule: null });
      } catch {}
    }, Math.max(0, ts - Date.now()))
      : nodeSchedule.scheduleJob(new Date(ts), async () => {
          try {
            this._notify('Напоминание', reminder.message || '...');
          } catch {}

          // Обработка календаря (best-effort)
          try {
            if (process.env.CONNOR_CALENDAR_ENABLED === 'true') {
              await this._createCalendarEventFromReminder(reminder).catch(() => {});
            }
          } catch {}

          // Для повторяющихся: сдвигаем nextRun и сохраняем, затем перепланируем.
          try {
            const baseTs = Number(reminder.nextRun);
            if (reminder.repeat === 'daily') {
              reminder.nextRun = baseTs + 24 * 60 * 60 * 1000;
            } else if (reminder.repeat === 'weekly') {
              reminder.nextRun = baseTs + 7 * 24 * 60 * 60 * 1000;
            } else {
              const list = this._getReminders();
              this._setReminders(list.filter((x) => String(x.id) !== String(reminder.id)));
              this._jobs.delete(String(id));
              this._broadcastUpdate();
              return;
            }

            const list = this._getReminders();
            const idx = list.findIndex((x) => String(x.id) === String(reminder.id));
            if (idx >= 0) {
              list[idx] = reminder;
              this._setReminders(list);
            }
            this._broadcastUpdate();
          } catch (err) {
            this._log('reminder reschedule failed', err, { reminderId: id });
          }

          // Перепланируем следующий запуск.
          try {
            this._scheduleOne({ reminder, nodeSchedule });
          } catch {}
        });

    this._jobs.set(String(id), job);
  }

  start() {
    try {
      let nodeSchedule = null;
      try {
        nodeSchedule = require('node-schedule');
      } catch (err) {
        if (!nodeScheduleMissingNotified) {
          nodeScheduleMissingNotified = true;
          try {
            new Notification({
              title: 'node-schedule не установлен',
              body: 'Напоминания будут работать в режиме setTimeout (ограниченно).',
            }).show();
          } catch {}
        }
        nodeSchedule = null;
      }

      const list = this._getReminders();
      for (const r of list) {
        const next = Number(r?.nextRun);
        if (!Number.isFinite(next)) continue;
        if (next < Date.now() - 30000) continue; // пропускаем сильно просроченные
        if (this._jobs.has(String(r.id))) continue;
        this._scheduleOne({ reminder: { ...r }, nodeSchedule });
      }
    } catch (err) {
      this._log('reminders start failed', err, {});
    }
  }

  async _createCalendarEventFromReminder(reminder) {
    // Minimal integration stub with Microsoft Graph if token is present.
    // Требует: CONNOR_GRAPH_ACCESS_TOKEN (OAuth token) и необязательно календарь по умолчанию.
    // В противном случае делаем no-op.
    const token = process.env.CONNOR_GRAPH_ACCESS_TOKEN;
    if (!token) return;

    try {
      const start = new Date(Number(reminder.nextRun));
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const eventPayload = {
        subject: reminder.message || 'Reminder',
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      };

      if (reminder.repeat === 'daily') {
        eventPayload.recurrence = {
          pattern: { type: 'daily', interval: 1 },
          range: { type: 'noEnd', startDate: start.toISOString().slice(0, 10) },
        };
      }
      if (reminder.repeat === 'weekly') {
        const day = start.getDay(); // 0 Sun..6 Sat
        const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        eventPayload.recurrence = {
          pattern: { type: 'weekly', interval: 1, daysOfWeek: [map[day] || 'monday'] },
          range: { type: 'noEnd', startDate: start.toISOString().slice(0, 10) },
        };
      }

      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });
      // swallow response
      void res;
    } catch (err) {
      this._log('calendar event create failed', err, { reminderId: reminder?.id });
    }
  }

  _parseFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const normalized = normalizeRuText(raw);
    if (!normalized.includes('напомни')) return null;

    const repeat = normalized.includes('ежеднев') ? 'daily' : normalized.includes('еженедель') ? 'weekly' : null;

    // через N минут/часов/секунд
    const mDelay = normalized.match(/напомни.*?через\s*(\d+)\s*(секунд|секунда|секунды|минут|минута|минуты|час|часа|часов)/i);
    let delayMs = null;
    if (mDelay?.[1] && mDelay?.[2]) {
      const n = Number(mDelay[1]);
      const unit = mDelay[2];
      if (Number.isFinite(n) && n >= 0) {
        if (unit.includes('секунд')) delayMs = n * 1000;
        else if (unit.includes('минут')) delayMs = n * 60 * 1000;
        else delayMs = n * 60 * 60 * 1000; // hours
      }
    }

    // message: после "про ..." или "об ..."
    let message = null;
    const mMsg = raw.match(/(?:про|об)\s+(.+)/i);
    if (mMsg?.[1]) message = mMsg[1].trim();
    if (!message) {
      message = raw.replace(/.*напомни/i, '').trim();
    }
    if (!message) message = 'Напоминание';

    if (!delayMs || delayMs <= 0) {
      return { repeat, delayMs: 5 * 60 * 1000, message }; // fallback: 5 минут
    }

    return { repeat, delayMs, message };
  }

  async createFromVoiceText(text) {
    const parsed = this._parseFromText(text);
    if (!parsed) return { ok: false, error: 'not_a_reminder' };

    const list = this._getReminders();
    const id = `rem_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const nextRun = Date.now() + parsed.delayMs;
    const entry = {
      id,
      message: parsed.message,
      createdAt: Date.now(),
      nextRun,
      repeat: parsed.repeat,
    };

    list.push(entry);
    this._setReminders(list);
    this._broadcastUpdate();

    // планируем сразу
    try {
      const nodeSchedule = require('node-schedule');
      this._scheduleOne({ reminder: { ...entry }, nodeSchedule });
    } catch (err) {
      this._log('reminder scheduling failed', err, { entry });
    }

    // календарь best-effort (если нужно заранее)
    try {
      if (process.env.CONNOR_CALENDAR_ENABLED === 'true') {
        await this._createCalendarEventFromReminder(entry).catch(() => {});
      }
    } catch {}

    return { ok: true, reminder: entry, ui: this.getAllForUi() };
  }

  cancel(id) {
    try {
      const list = this._getReminders();
      const next = list.filter((r) => String(r.id) !== String(id));
      this._setReminders(next);
      const job = this._jobs.get(String(id));
      if (job) {
        if (typeof job.cancel === 'function') job.cancel();
        else {
          try {
            clearTimeout(job);
          } catch {}
        }
      }
      this._jobs.delete(String(id));
      this._broadcastUpdate();
      return { ok: true };
    } catch (err) {
      this._log('reminder cancel failed', err, { id });
      return { ok: false, error: err?.message || String(err) };
    }
  }
}

class TimerController {
  constructor({ storeRef, logger } = {}) {
    this.store = storeRef;
    this.logger = logger || null;
    this.activeTimers = new Map(); // id -> { id, label, endTs, timeout }
    this.alarms = Array.isArray(this.store.get('alarms')) ? this.store.get('alarms') : [];
    this._alarmTick = null;
  }

  _log(message, err, context) {
    try {
      this.logger?.(message, err, context);
    } catch {}
  }

  start() {
    if (this._alarmTick) clearInterval(this._alarmTick);
    this._alarmTick = setInterval(() => this._checkAlarms(), 60 * 1000);
    this._checkAlarms();
  }

  stop() {
    if (this._alarmTick) clearInterval(this._alarmTick);
    this._alarmTick = null;
    for (const t of this.activeTimers.values()) {
      try {
        clearTimeout(t.timeout);
      } catch {}
    }
    this.activeTimers.clear();
  }

  _checkAlarms() {
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const current = `${hh}:${mm}`;
      const today = now.toDateString();
      let changed = false;
      for (const a of this.alarms) {
        if (!a || a.time !== current) continue;
        const key = `alarmLastDay:${a.id}`;
        if (a.lastDay === today) continue;
        a.lastDay = today;
        changed = true;
        try {
          new Notification({ title: 'Будильник', body: `Сработал будильник ${a.time}` }).show();
        } catch {}
      }
      if (changed) this.store.set('alarms', this.alarms);
    } catch (err) {
      this._log('alarm tick failed', err, {});
    }
  }

  getState() {
    const timers = Array.from(this.activeTimers.values()).map((t) => ({
      id: t.id,
      label: t.label,
      endTs: t.endTs,
      remainingSec: Math.max(0, Math.ceil((t.endTs - Date.now()) / 1000)),
    }));
    return { timers, alarms: this.alarms };
  }

  addTimer(minutes, label = '') {
    const mins = Math.max(1, Number(minutes) || 0);
    const id = `timer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const endTs = Date.now() + mins * 60 * 1000;
    const timeout = setTimeout(() => {
      this.activeTimers.delete(id);
      try {
        new Notification({ title: 'Таймер', body: `Таймер ${mins} мин завершён` }).show();
      } catch {}
      sendPlannerUpdate();
    }, mins * 60 * 1000);
    this.activeTimers.set(id, { id, label: label || `Таймер ${mins} мин`, endTs, timeout });
    sendPlannerUpdate();
    return { ok: true, id, endTs };
  }

  stopTimer(id) {
    const first = this.activeTimers.values().next().value;
    const target = id ? this.activeTimers.get(String(id)) : first;
    if (!target) return { ok: false, error: 'no_active_timer' };
    try {
      clearTimeout(target.timeout);
    } catch {}
    this.activeTimers.delete(target.id);
    sendPlannerUpdate();
    return { ok: true };
  }

  clearTimers() {
    for (const t of this.activeTimers.values()) {
      try {
        clearTimeout(t.timeout);
      } catch {}
    }
    this.activeTimers.clear();
    sendPlannerUpdate();
    return { ok: true };
  }

  addAlarm(timeHHMM) {
    const t = String(timeHHMM || '').trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return { ok: false, error: 'invalid_time_format' };
    const [h, m] = t.split(':').map((v) => Number(v));
    if (h < 0 || h > 23 || m < 0 || m > 59) return { ok: false, error: 'invalid_time' };
    const id = `alarm_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.alarms.push({ id, time: t, lastDay: null });
    this.store.set('alarms', this.alarms);
    sendPlannerUpdate();
    return { ok: true, id, time: t };
  }
}

class NotesController {
  constructor({ storeRef } = {}) {
    this.store = storeRef;
  }

  _getNotes() {
    const v = this.store.get('notes');
    return Array.isArray(v) ? v : [];
  }

  _setNotes(arr) {
    this.store.set('notes', Array.isArray(arr) ? arr : []);
  }

  _getClipboardHistory() {
    const v = this.store.get('clipboardHistory');
    return Array.isArray(v) ? v : [];
  }

  _setClipboardHistory(arr) {
    this.store.set('clipboardHistory', Array.isArray(arr) ? arr : []);
  }

  list() {
    return this._getNotes();
  }

  add(text) {
    const t = String(text || '').trim();
    if (!t) return { ok: false, error: 'empty_text' };
    const arr = this._getNotes();
    arr.unshift({ id: `note_${Date.now()}_${Math.floor(Math.random() * 1000)}`, text: t, ts: Date.now() });
    this._setNotes(arr.slice(0, 300));
    return { ok: true };
  }

  update(id, text) {
    const idStr = String(id || '');
    const t = String(text || '').trim();
    const arr = this._getNotes();
    const idx = arr.findIndex((n) => String(n.id) === idStr);
    if (idx < 0) return { ok: false, error: 'not_found' };
    arr[idx] = { ...arr[idx], text: t, updatedTs: Date.now() };
    this._setNotes(arr);
    return { ok: true };
  }

  remove(id) {
    const idStr = String(id || '');
    const arr = this._getNotes().filter((n) => String(n.id) !== idStr);
    this._setNotes(arr);
    return { ok: true };
  }

  pushClipboard(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const arr = this._getClipboardHistory().filter((x) => String(x || '') !== t);
    arr.unshift(t);
    this._setClipboardHistory(arr.slice(0, 10));
  }

  getState() {
    return {
      notes: this._getNotes(),
      clipboardHistory: this._getClipboardHistory(),
    };
  }
}

class DeepSeekController {
  constructor({ store, logger } = {}) {
    this.store = store;
    this.logger = logger || null;
    this.model = 'deepseek-chat';
    this.systemPrompt = 'Ты полезный ассистент. Отвечай по-русски и максимально конкретно.';
  }

  _log(message, err, context) {
    try {
      if (this.logger) return this.logger(message, err, context);
    } catch {}
    try {
      // eslint-disable-next-line no-console
      console.error(message, err, context || {});
    } catch {}
  }

  _getDeepseek() {
    const d = this.store?.get('deepseek');
    return d && typeof d === 'object' ? d : { apiKey: '', activeChatId: null, chats: [] };
  }

  _setDeepseek(deepseek) {
    this.store?.set('deepseek', deepseek);
  }

  _ensureChatExists() {
    const deepseek = this._getDeepseek();
    if (deepseek.activeChatId && deepseek.chats?.some((c) => String(c.id) === String(deepseek.activeChatId))) {
      return deepseek;
    }
    const firstChat = this._createChat('Новый чат');
    deepseek.activeChatId = firstChat.id;
    deepseek.chats = firstChat.chats;
    this._setDeepseek(deepseek);
    return deepseek;
  }

  _createChat(title) {
    const deepseek = this._getDeepseek();
    const id = `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const chat = {
      id,
      title: String(title || id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    deepseek.chats = Array.isArray(deepseek.chats) ? deepseek.chats : [];
    deepseek.chats.push(chat);
    return { id, chats: deepseek.chats };
  }

  getStateForUi() {
    const d = this._getDeepseek();
    return {
      apiKeySet: !!d.apiKey,
      activeChatId: d.activeChatId || null,
    };
  }

  listChatsForUi() {
    const d = this._getDeepseek();
    const chats = Array.isArray(d.chats) ? d.chats : [];
    return chats
      .slice()
      .sort((a, b) => Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt))
      .map((c) => {
        const last = Array.isArray(c.messages) && c.messages.length ? c.messages[c.messages.length - 1] : null;
        return {
          id: c.id,
          title: c.title || c.id,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastPreview: last?.text ? String(last.text).slice(0, 70) : '',
          lastRole: last?.role || null,
        };
      });
  }

  getChat(chatId) {
    const d = this._getDeepseek();
    const chats = Array.isArray(d.chats) ? d.chats : [];
    const chat = chats.find((c) => String(c.id) === String(chatId));
    if (!chat) return null;
    return chat;
  }

  selectChat(chatId) {
    const d = this._ensureChatExists();
    d.activeChatId = String(chatId);
    this._setDeepseek(d);
    return { ok: true, activeChatId: d.activeChatId };
  }

  newChat({ title } = {}) {
    const deepseek = this._getDeepseek();
    const t = String(title || 'Новый чат');
    const created = this._createChat(t);
    deepseek.activeChatId = created.id;
    deepseek.chats = created.chats;
    this._setDeepseek(deepseek);
    return { ok: true, chatId: created.id };
  }

  _buildTitleFromFirstUserMessage(userText) {
    const raw = String(userText || '').trim();
    if (!raw) return 'Чат';
    return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw;
  }

  async sendMessage({ chatId, message } = {}) {
    const text = String(message || '').trim();
    if (!text) return { ok: false, error: 'empty_message' };

    const deepseek = this._ensureChatExists();
    const effectiveChatId = chatId ? String(chatId) : String(deepseek.activeChatId);
    const chat = (deepseek.chats || []).find((c) => String(c.id) === effectiveChatId);
    if (!chat) return { ok: false, error: 'chat_not_found' };

    if (!deepseek.apiKey) {
      return { ok: false, error: 'api_key_missing' };
    }

    // Добавляем сообщение пользователя в чат и сохраняем.
    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    const userEntry = { role: 'user', text, ts: Date.now() };
    chat.messages.push(userEntry);
    chat.updatedAt = Date.now();

    // Обновляем заголовок (если это первое сообщение).
    if (!chat.title || chat.title === 'Новый чат') {
      chat.title = this._buildTitleFromFirstUserMessage(text);
    }

    this._setDeepseek(deepseek);

    // Готовим запрос к DeepSeek.
    const apiMessages = [
      { role: 'system', content: this.systemPrompt },
      ...chat.messages.slice(-20).map((m) => ({ role: m.role, content: m.text })),
    ];

    const controller = new AbortController();
    const timeoutMs = 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startedAt = Date.now();
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseek.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: apiMessages,
          stream: false,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);
      this._log('DeepSeek fetch finished', null, { status: res.status, ms: Date.now() - startedAt });
      if (!res.ok) {
        const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      // DeepSeek возвращает content обычно в `choices[0].message.content`, но изредка
      // формат может отличаться (например `choices[0].text`).
      const assistantTextRaw =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        data?.output_text ??
        data?.text ??
        null;

      const assistant = String(assistantTextRaw || '').trim();

      if (!assistant) {
        this._log('DeepSeek parse: empty assistant response', null, {
          // Не логируем API-ключ, только форму ответа.
          hasChoices: Array.isArray(data?.choices),
          choiceKeys: data?.choices?.[0] ? Object.keys(data.choices[0]) : null,
        });
        throw new Error('empty_assistant_response');
      }

      const assistantEntry = { role: 'assistant', text: assistant, ts: Date.now() };
      chat.messages.push(assistantEntry);
      chat.updatedAt = Date.now();
      this._setDeepseek(deepseek);

      return { ok: true, chatId: chat.id, assistantText: assistant, messages: chat.messages };
    } catch (err) {
      this._log('deepseek send failed', err, { chatId: chat.id });
      return { ok: false, error: err?.message || String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }

  deleteChat(chatId) {
    const deepseek = this._getDeepseek();
    const chats = Array.isArray(deepseek.chats) ? deepseek.chats : [];
    const idStr = String(chatId);

    const exists = chats.some((c) => String(c.id) === idStr);
    if (!exists) return { ok: false, error: 'chat_not_found' };

    const nextChats = chats.filter((c) => String(c.id) !== idStr);
    if (!nextChats.length) {
      const created = this._createChat('Новый чат');
      deepseek.activeChatId = created.id;
      deepseek.chats = created.chats;
      this._setDeepseek(deepseek);
      return { ok: true, activeChatId: created.id };
    }

    deepseek.chats = nextChats;
    if (String(deepseek.activeChatId) === idStr) {
      deepseek.activeChatId = nextChats[0]?.id || null;
    }
    this._setDeepseek(deepseek);
    return { ok: true, activeChatId: deepseek.activeChatId };
  }
}

async function collectSystemSnapshot() {
  const [load, mem, fs, aw] = await Promise.all([
    si.currentLoad().catch(() => null),
    si.mem().catch(() => null),
    si.fsSize(getRootPathForDisk()).catch(() => null),
    Promise.resolve(null),
  ]);

  let cpuPercent = null;
  if (load) {
    if (typeof load.currentload === 'number') cpuPercent = load.currentload;
    else if (load.currentLoad && typeof load.currentLoad.currentLoad === 'number') cpuPercent = load.currentLoad.currentLoad;
    else if (typeof load.currentLoad === 'number') cpuPercent = load.currentLoad;
  }

  let ramTotalGB = null;
  let ramUsedGB = null;
  let ramFreeGB = null;
  if (mem && typeof mem.total === 'number' && typeof mem.free === 'number') {
    ramTotalGB = mem.total / (1024 ** 3);
    ramFreeGB = mem.free / (1024 ** 3);
    ramUsedGB = (mem.total - mem.free) / (1024 ** 3);
  }

  let diskTotalGB = null;
  let diskUsedGB = null;
  let diskFreeGB = null;
  const entries = Array.isArray(fs) ? fs : null;
  if (entries && entries.length > 0) {
    const rootPath = getRootPathForDisk().toLowerCase();
    let entry = entries.find((e) => (e.mount && e.mount.toLowerCase() === rootPath)) ||
                entries.find((e) => (e.fs && e.fs.toLowerCase() === rootPath)) ||
                entries[0];

    if (entry && typeof entry.size === 'number') diskTotalGB = entry.size / (1024 ** 3);
    if (entry && typeof entry.used === 'number') diskUsedGB = entry.used / (1024 ** 3);
    if (entry && typeof entry.available === 'number') diskFreeGB = entry.available / (1024 ** 3);
  }

  let activeWindowTitle = null;
  let activeWindowOwner = null;
  if (aw) {
    activeWindowTitle = aw.title || null;
    activeWindowOwner = aw.owner?.name || null;
  }

  return {
    timestamp: Date.now(),
    cpuPercent,
    ram: { totalGB: ramTotalGB, usedGB: ramUsedGB, freeGB: ramFreeGB },
    disk: { totalGB: diskTotalGB, usedGB: diskUsedGB, freeGB: diskFreeGB },
    activeWindow: { title: activeWindowTitle, owner: activeWindowOwner },
  };
}

function sendSystemUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  collectSystemSnapshot()
    .then((snapshot) => {
      mainWindow.webContents.send('system:update', snapshot);
    })
    .catch(() => {});
}

function startSystemMonitoring() {
  if (systemTimer) clearInterval(systemTimer);
  systemTimer = setInterval(sendSystemUpdate, 2000);
  sendSystemUpdate();
}

async function testMicrophoneCaptureAndPlayback({ seconds = 2, sampleRate = 16000 } = {}) {
  // На Windows делаем запись через node-microphone и проигрываем WAV через System.Media.SoundPlayer.
  if (process.platform !== 'win32') {
    new Notification({ title: 'Микрофон', body: 'Проверка микрофона доступна только на Windows в этой сборке.' }).show();
    return { ok: false };
  }

  let micPkg = null;
  try {
    micPkg = require('node-microphone');
  } catch {
    new Notification({ title: 'Микрофон', body: 'Модуль node-microphone не установлен.' }).show();
    return { ok: false };
  }

  new Notification({ title: 'Тест микрофона', body: 'Говорите 2 секунды…' }).show();

  return new Promise((resolve) => {
    try {
      let micInstance = null;
      if (typeof micPkg === 'function') micInstance = micPkg({ rate: sampleRate, channels: 1 });
      else if (micPkg?.Microphone) micInstance = new micPkg.Microphone({ rate: sampleRate, channels: 1 });
      if (!micInstance) return resolve({ ok: false });

      const audioStream = micInstance.getAudioStream ? micInstance.getAudioStream() : micInstance;
      if (!audioStream || typeof audioStream.on !== 'function') return resolve({ ok: false });

      const frames = [];
      const onData = (data) => {
        try {
          frames.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        } catch {}
      };

      audioStream.on('data', onData);
      if (micInstance.start) micInstance.start();

      setTimeout(() => {
        try {
          audioStream.off?.('data', onData);
        } catch {}
        try {
          micInstance.stop?.();
        } catch {}

        const raw = Buffer.concat(frames);
        const dataSize = raw.length;
        const numChannels = 1;
        const bitsPerSample = 16;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const byteRate = sampleRate * blockAlign;

        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + dataSize, 4);
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20); // PCM
        wavHeader.writeUInt16LE(numChannels, 22);
        wavHeader.writeUInt32LE(sampleRate, 24);
        wavHeader.writeUInt32LE(byteRate, 28);
        wavHeader.writeUInt16LE(blockAlign, 32);
        wavHeader.writeUInt16LE(bitsPerSample, 34);
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(dataSize, 40);

        const outPath = path.join(app.getPath('temp'), `connor-mic-test-${Date.now()}.wav`);
        fs.writeFileSync(outPath, Buffer.concat([wavHeader, raw]));

        // Воспроизведение синхронно.
        try {
          const escaped = outPath.replace(/'/g, "''");
          const ps = `$p=New-Object System.Media.SoundPlayer '${escaped}'; $p.PlaySync();`;
          spawnSync('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { stdio: 'ignore' });
        } catch (err) {
          logSystemError('mic test playback failed', err, {});
        }

        new Notification({ title: 'Тест микрофона', body: 'Проигрывание завершено.' }).show();
        resolve({ ok: true, filePath: outPath });
      }, Math.max(0.5, seconds) * 1000);
    } catch (err) {
      logSystemError('mic test capture failed', err, {});
      resolve({ ok: false });
    }
  });
}

function syncAutoLaunch() {
  if (process.platform !== 'win32') return;
  const enabled = !!store.get('autoLaunch');
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: [],
    });
  } catch (e) {}
}

function registerOrUnregisterHotkeys() {
  try {
    globalShortcut.unregisterAll();
  } catch {}

  const enabled = !!store.get('hotkeyEnabled');
  if (!enabled) return;

  const hotkeys = getHotkeysFromStore();
  const used = new Map(); // acc -> actionKey

  const registerOne = (actionKey, accelerator, handler) => {
    const acc = normalizeAccelerator(accelerator);
    if (!acc) return { ok: true, skipped: true };
    if (used.has(acc)) {
      // Конфликт внутри приложения: один и тот же хоткей назначен разным командам.
      try {
        new Notification({ title: 'Hotkeys', body: `Конфликт горячих клавиш: ${acc}` }).show();
      } catch {}
      return { ok: false, conflict: true };
    }
    used.set(acc, actionKey);

    let registered = false;
    try {
      registered = globalShortcut.register(acc, handler);
    } catch {}

    if (!registered) {
      // Скорее всего, конфликт с системной комбинацией (Electron/OS не даёт перехватить).
      try {
        new Notification({ title: 'Hotkeys', body: `Не удалось назначить: ${acc}` }).show();
      } catch {}
      used.delete(acc);
      return { ok: false, registerFailed: true };
    }

    return { ok: true };
  };

  registerOne('toggleWindow', hotkeys.toggleWindow, () => toggleWindowFromTray());

  registerOne('toggleMuteSound', hotkeys.toggleMuteSound, () => {
    try {
      systemCommands?.volumeMute?.();
    } catch {}
  });

  registerOne('openBrowser', hotkeys.openBrowser, () => {
    try {
      systemCommands?.appOpen?.({ app: 'browser' }).catch?.(() => {});
    } catch {}
  });

  registerOne('voiceStart', hotkeys.voiceStart, () => {
    try {
      if (!voiceController) {
        try {
          new Notification({ title: 'Hotkeys', body: 'Голосовой модуль ещё не готов.' }).show();
        } catch {}
        return;
      }
      voiceController.startListening();
      try {
        mainWindow?.webContents?.send('voice:status', { listening: true });
      } catch {}
      sendToConnorFloating('voice:status', { listening: true });
    } catch {}
  });

  registerOne('exit', hotkeys.exit, () => {
    try {
      isQuitting = true;
      app.quit();
    } catch {}
  });
}

function toggleWindowFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = resolveAssetPath(path.join('assets', 'icon.png'));

  tray = new Tray(iconPath);
  tray.setToolTip('Connor Assistant');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Показать/Скрыть', click: () => toggleWindowFromTray() },
    { type: 'separator' },
    { label: 'Открыть настройки', click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (!mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        }
        mainWindow.webContents.send('ui:route', { view: 'settings' });
      }
    },
    { label: 'Выход', click: () => {
        isQuitting = true;
        app.quit();
      }
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => toggleWindowFromTray());
}

function createMainWindow() {
  const indexPath = path.join(__dirname, 'src', 'index.html');

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 520,
    frame: true,
    titleBarStyle: 'default',
    resizable: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(indexPath);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('settings:theme', { theme: store.get('theme') });
    if (!voiceController) {
      voiceController = new VoiceController({
        mainWindowGetter: () => mainWindow,
        wakeWord: 'Коннор',
      });
      voiceController.onCommand(async ({ command, rawTranscript, ts }) => {
        const spoken = normalizeRuText(command);
        const hasAny = (...parts) => parts.some((p) => spoken.includes(p));
        logVoiceTrace('command:received', { command: String(command || '').slice(0, 180), spoken: spoken.slice(0, 180) });

        const openExternal = async (url, title = 'Connor', body = 'Открываю ссылку') => {
          try {
            await shell.openExternal(url);
            try {
              new Notification({ title, body }).show();
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: body });
            return true;
          } catch (err) {
            logSystemError('voice openExternal failed', err, { url, command, rawTranscript });
            return false;
          }
        };

        const openFolderPath = async (folderPath, okText = 'Открываю папку') => {
          try {
            if (!folderPath || !fs.existsSync(folderPath)) {
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Папка не найдена' });
              return false;
            }
            const errText = await shell.openPath(folderPath);
            if (errText) {
              logSystemError('openPath failed', null, { folderPath, errText });
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Не удалось открыть папку' });
              return false;
            }
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `${okText}: ${path.basename(folderPath)}` });
            return true;
          } catch (err) {
            logSystemError('openFolderPath failed', err, { folderPath });
            return false;
          }
        };

        // Notes + clipboard voice commands.
        {
          const raw = String(rawTranscript || command || '').trim();
          const mCopy = raw.match(/скопируй\s+(.+)/i);
          if (mCopy && mCopy[1]) {
            const text = String(mCopy[1]).trim();
            try {
              clipboard.writeText(text);
              notesController?.pushClipboard?.(text);
              sendNotesUpdate();
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Текст скопирован' });
            } catch {
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Не удалось скопировать' });
            }
            return;
          }

          if (hasAny('вставь', 'вставить')) {
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Вставка временно отключена' });
            return;
          }

          const mSaveNote = raw.match(/сохрани\s+(.+?)\s+в\s+заметки/i);
          if (mSaveNote && mSaveNote[1]) {
            const text = String(mSaveNote[1]).trim();
            const resp = notesController?.add?.(text);
            sendNotesUpdate();
            sendToConnorFloating('voice:command', {
              command,
              rawTranscript,
              ts,
              result: resp?.ok ? 'Сохранил в заметки' : 'Не удалось сохранить заметку',
            });
            return;
          }

          if (hasAny('покажи заметки', 'открой заметки', 'заметки')) {
            createNotesWindow();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Открываю заметки' });
            return;
          }

          const mPlayTrack = raw.match(/поставь\s+(.+)/i);
          if (mPlayTrack && mPlayTrack[1]) {
            const query = String(mPlayTrack[1]).trim();
            createMusicPlayerFullWindow();
            try {
              musicPlayerFullWindow?.webContents?.send('music:voiceCommand', { action: 'playByQuery', query });
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `Ищу трек: ${query}` });
            return;
          }

          if (hasAny('следующий трек', 'следующий')) {
            createMusicPlayerFullWindow();
            try {
              musicPlayerFullWindow?.webContents?.send('music:voiceCommand', { action: 'next' });
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Следующий трек' });
            return;
          }

          if (hasAny('предыдущий трек', 'предыдущий')) {
            createMusicPlayerFullWindow();
            try {
              musicPlayerFullWindow?.webContents?.send('music:voiceCommand', { action: 'prev' });
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Предыдущий трек' });
            return;
          }

          if (hasAny('пауза')) {
            try {
              musicPlayerFullWindow?.webContents?.send('music:voiceCommand', { action: 'pause' });
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Пауза' });
            return;
          }

          if (hasAny('продолжить', 'продолжай', 'играй')) {
            createMusicPlayerFullWindow();
            try {
              musicPlayerFullWindow?.webContents?.send('music:voiceCommand', { action: 'resume' });
            } catch {}
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Продолжаю' });
            return;
          }
        }

        // Файлы и папки: системные команды.
        if (hasAny('открой документы', 'открой документ', 'open documents', 'open document', 'documents')) {
          void openFolderPath(app.getPath('documents'), 'Открываю Документы');
          return;
        }
        if (hasAny('открой загрузки', 'открой загрузку', 'open downloads', 'downloads')) {
          void openFolderPath(app.getPath('downloads'), 'Открываю Загрузки');
          return;
        }
        if (hasAny('открой рабочий стол', 'открой стол', 'open desktop', 'desktop')) {
          void openFolderPath(app.getPath('desktop'), 'Открываю Рабочий стол');
          return;
        }
        if (hasAny('открой музыку', 'open music', 'music') && !hasAny('музыка онлайн', 'spotify', 'online music')) {
          createMusicPlayerFullWindow();
          sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Открываю музыку' });
          return;
        }
        if (hasAny('открой видео', 'открой виде', 'open videos', 'videos')) {
          void openFolderPath(app.getPath('videos'), 'Открываю Видео');
          return;
        }

        // "Коннор, создай папку [имя] на рабочем столе"
        {
          const raw = String(rawTranscript || command || '').trim();
          const mCreate = raw.match(/создай\s+папк[ауи]\s+(.+?)\s+на\s+рабочем\s+стол[еуа]/i);
          if (mCreate && mCreate[1]) {
            const folderName = String(mCreate[1]).trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
            if (folderName) {
              try {
                const full = path.join(app.getPath('desktop'), folderName);
                fs.mkdirSync(full, { recursive: true });
                sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `Папка создана: ${folderName}` });
                try {
                  new Notification({ title: 'Connor', body: `Создана папка: ${folderName}` }).show();
                } catch {}
              } catch (err) {
                logSystemError('create folder on desktop failed', err, { folderName });
                sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Не удалось создать папку' });
              }
              return;
            }
          }
        }

        // "Коннор, запомни папку [имя] по пути [путь]"
        {
          const raw = String(rawTranscript || command || '').trim();
          const mRemember = raw.match(/запомни\s+папк[ауи]\s+(.+?)\s+по\s+пути\s+(.+)/i);
          if (mRemember && mRemember[1] && mRemember[2]) {
            const alias = String(mRemember[1]).trim();
            const rawPath = String(mRemember[2]).trim().replace(/^["']|["']$/g, '');
            if (alias && rawPath) {
              try {
                if (!fs.existsSync(rawPath)) {
                  sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Путь не найден' });
                  return;
                }
                await rememberFolderInCache(alias, rawPath);
                sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `Запомнил папку: ${alias}` });
              } catch (err) {
                logSystemError('remember folder failed', err, { alias, rawPath });
                sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Не удалось запомнить папку' });
              }
              return;
            }
          }
        }

        // "Коннор, открой папку [имя]"
        {
          const raw = String(rawTranscript || command || '').trim();
          const mOpenFolder = raw.match(/открой\s+папк[ауи]\s+(.+)/i);
          if (mOpenFolder && mOpenFolder[1]) {
            const query = String(mOpenFolder[1]).trim();
            const qKey = normalizeNameKey(query);
            const cache = readConnorCacheSync();
            const candidates = collectFolderCandidatesFromCache(cache).filter((c) => {
              const ru = normalizeNameKey(c.name_ru || c.displayName || '');
              const en = normalizeNameKey(c.name_en || c.displayName || '');
              return ru.includes(qKey) || en.includes(qKey);
            });

            if (!candidates.length) {
              sendToConnorFloating('voice:command', {
                command,
                rawTranscript,
                ts,
                result: `Папка "${query}" не найдена. Скажи: запомни папку ${query} по пути ...`,
              });
              return;
            }

            if (candidates.length === 1) {
              void openFolderPath(candidates[0].path, 'Открываю папку');
              return;
            }

            try {
              const top = candidates.slice(0, 8);
              const labels = top.map((x) => `${x.displayName} — ${x.path}`);
              const pick = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                title: 'Выбор папки',
                message: `Найдено несколько папок для "${query}"`,
                buttons: [...top.map((x) => x.displayName), 'Отмена'],
                defaultId: 0,
                cancelId: top.length,
                detail: labels.join('\n'),
              });
              if (pick.response >= 0 && pick.response < top.length) {
                void openFolderPath(top[pick.response].path, 'Открываю папку');
              }
            } catch (err) {
              logSystemError('folder choose dialog failed', err, { query });
            }
            return;
          }
        }

        // Web actions (новые команды).
        if (hasAny('какая сегодня погода', 'погода сегодня', 'погоду', 'weather today', 'weather')) {
          void openExternal('https://yandex.ru/pogoda', 'Connor', 'Открываю погоду');
          return;
        }
        if (hasAny('открой youtube', 'ютуб', 'youtube', 'open youtube')) {
          void openExternal('https://youtube.com', 'Connor', 'Открываю YouTube');
          return;
        }
        if (hasAny('что нового', 'новости', 'лента новостей', 'what s new', 'news')) {
          void openExternal('https://lenta.ru', 'Connor', 'Открываю новости');
          return;
        }
        if (hasAny('открой github', 'github', 'гитхаб')) {
          void openExternal('https://github.com', 'Connor', 'Открываю GitHub');
          return;
        }
        if (hasAny('открой почту', 'почта', 'gmail')) {
          void openExternal('https://mail.google.com', 'Connor', 'Открываю почту');
          return;
        }
        if (hasAny('открой карты', 'карты', 'map')) {
          void openExternal('https://maps.google.com', 'Connor', 'Открываю карты');
          return;
        }
        if (hasAny('открой переводчик', 'переводчик', 'translate')) {
          void openExternal('https://translate.google.com', 'Connor', 'Открываю переводчик');
          return;
        }
        if (hasAny('музыка онлайн', 'spotify')) {
          void openExternal('https://open.spotify.com', 'Connor', 'Открываю музыку');
          return;
        }
        if (hasAny('открой календарь', 'календарь')) {
          void openExternal('https://calendar.google.com', 'Connor', 'Открываю календарь');
          return;
        }
        if (hasAny('открой погоду', 'прогноз погоды')) {
          void openExternal('https://open-meteo.com', 'Connor', 'Открываю Open-Meteo');
          return;
        }
        if (hasAny('открой калькулятор', 'калькулятор')) {
          void openExternal('https://www.desmos.com/scientific', 'Connor', 'Открываю калькулятор');
          return;
        }
        if (hasAny('как меня зовут', 'мое имя', 'моё имя')) {
          const userName = String(store.get('userName') || '').trim();
          const result = userName ? `Тебя зовут ${userName}` : 'Имя пока не задано';
          sendToConnorFloating('voice:command', { command, rawTranscript, ts, result });
          try {
            new Notification({ title: 'Connor', body: result }).show();
          } catch {}
          return;
        }
        if (hasAny('что ты умеешь', 'what can you do')) {
          const list = [
            'Голосовые команды',
            'Музыка',
            'Казино',
            'Скриншоты OCR',
            'Таймеры и напоминания',
            'Системные команды',
            'Поиск в Google',
          ];
          try {
            new Notification({ title: 'Connor Assistant', body: list.join(', ') }).show();
          } catch {}
          sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Показываю список возможностей' });
          return;
        }
        // Системные команды.
        if (hasAny('выключи компьютер', 'выключи пк', 'выключи систему', 'shutdown computer')) {
          if (getSystemNoConfirmPower()) {
            void executeSystemAction('shutdown');
          } else {
            void requestSystemConfirm('shutdown', 'Выключить компьютер');
          }
          return;
        }
        if (hasAny('перезагрузи компьютер', 'перезагрузка компьютера', 'перезапусти компьютер', 'restart computer')) {
          if (getSystemNoConfirmPower()) {
            void executeSystemAction('restart');
          } else {
            void requestSystemConfirm('restart', 'Перезагрузить компьютер');
          }
          return;
        }
        if (hasAny('в спящий режим', 'спящий режим', 'усыпи компьютер', 'sleep mode', 'sleep computer')) {
          if (getSystemNoConfirmPower()) {
            void executeSystemAction('sleep');
          } else {
            void requestSystemConfirm('sleep', 'Перевести в спящий режим');
          }
          return;
        }
        if (hasAny('заблокируй экран', 'заблокируй компьютер', 'блокировка экрана', 'lock screen')) {
          void executeSystemAction('lock');
          return;
        }
        if (hasAny('очисти корзину', 'очистить корзину', 'empty recycle bin')) {
          void executeSystemAction('recycle-clear');
          return;
        }
        if (hasAny('открой диспетчер задач', 'диспетчер задач')) {
          void executeSystemAction('taskmgr');
          return;
        }
        if (hasAny('покажи свойства системы', 'свойства системы')) {
          void executeSystemAction('sysprops');
          return;
        }
        if (hasAny('открой панель управления', 'панель управления')) {
          void executeSystemAction('control');
          return;
        }
        if (hasAny('найди ', 'поиск ', 'поиск', 'search ', 'find ')) {
          try {
            let q = spoken;
            q = q.replace(/^коннор[\s,]*/i, '');
            q = q.replace(/^найди\s+/i, '');
            q = q.replace(/^поиск\s+/i, '');
            q = q.replace(/^search\s+/i, '');
            q = q.replace(/^find\s+/i, '');
            q = q.trim();
            if (q) {
              const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
              void openExternal(url, 'Connor', `Ищу: ${q}`);
              return;
            }
            void openExternal('https://www.google.com', 'Connor', 'Открываю поиск');
            return;
          } catch {}
        }

        // Сразу показываем распознанную команду в mini-оверлее.
        // Дальше отдельными ветками мы можем обновить это же сообщение результатом.
        sendToConnorFloating('voice:command', { command, rawTranscript, ts });

        // Навигационные команды (в Electron-окне).
        if (hasAny('обнови', 'обновить', 'обнов', 'refresh', 'перезагрузи')) {
          try {
            mainWindow?.webContents?.reload();
            new Notification({ title: 'Connor', body: 'Страница обновляется' }).show();
          } catch {}
          return;
        }

        // "Новая вкладка" (в приложении нет chrome-tabs, поэтому открываем нужную вкладку UI).
        if (hasAny('новая вкладка', 'открой вкладку', 'открой вкладки', 'новую вкладку')) {
          try {
            mainWindow?.webContents?.send('ui:route', { view: 'deepseek' });
            new Notification({ title: 'Connor', body: 'Открываю DeepSeek Chat' }).show();
          } catch {}
          return;
        }

        if (hasAny('закрой вкладку', 'закрыть вкладку')) {
          try {
            mainWindow?.webContents?.send('ui:route', { view: 'main' });
            new Notification({ title: 'Connor', body: 'Возврат на главную' }).show();
          } catch {}
          return;
        }

        if (hasAny('назад', 'вернуться', 'назат')) {
          try {
            mainWindow?.webContents?.goBack();
            new Notification({ title: 'Connor', body: 'Назад' }).show();
          } catch {}
          return;
        }

        if (hasAny('вперёд', 'вперед', 'впереди')) {
          try {
            mainWindow?.webContents?.goForward();
            new Notification({ title: 'Connor', body: 'Вперёд' }).show();
          } catch {}
          return;
        }

        // Voice: "Коннор, покажи системную информацию"
        if (hasAny('системную информацию', 'системная информация', 'системную инфо', 'система', 'информац')) {
          (async () => {
            try {
              const snapshot = await collectSystemSnapshot();
              const cpu = typeof snapshot?.cpuPercent === 'number' ? `${Math.round(snapshot.cpuPercent)}%` : '—';
              const ramUsed =
                typeof snapshot?.ram?.usedGB === 'number' && typeof snapshot?.ram?.totalGB === 'number'
                  ? `${snapshot.ram.usedGB.toFixed(1)}/${snapshot.ram.totalGB.toFixed(1)} GB`
                  : '—';
              const diskUsed =
                typeof snapshot?.disk?.usedGB === 'number' && typeof snapshot?.disk?.totalGB === 'number'
                  ? `${snapshot.disk.usedGB.toFixed(1)}/${snapshot.disk.totalGB.toFixed(1)} GB`
                  : '—';

              new Notification({
                title: 'Системная информация',
                body: `CPU: ${cpu}\nRAM: ${ramUsed}\nDisk: ${diskUsed}`,
              }).show();
              sendToConnorFloating('voice:command', {
                command,
                rawTranscript,
                ts,
                result: `CPU ${cpu} | RAM ${ramUsed} | Disk ${diskUsed}`,
              });
            } catch (err) {
              logSystemError('voice system info failed', err, { command, rawTranscript });
            }
          })();
          return;
        }

        // Voice: "Коннор, сколько времени"
        if (hasAny('сколько времени', 'которое время', 'который час', 'врем')) {
          try {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            new Notification({ title: 'Время', body: time }).show();
            createTimeWindow();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `Время: ${time}` });
          } catch {}
          return;
        }

        // Planner commands: timers/alarms/reminders.
        {
          const raw = String(rawTranscript || command || '').trim();
          const timerMatch = raw.match(/таймер\s+на\s+(\d+)\s+мин/i);
          if (timerMatch) {
            const mins = Math.max(1, Number(timerMatch[1]) || 1);
            const resp = timerController?.addTimer?.(mins, `Таймер ${mins} мин`);
            createPlannerWindow();
            sendPlannerUpdate();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: resp?.ok ? `Таймер на ${mins} мин запущен` : 'Не удалось запустить таймер' });
            return;
          }

          const alarmMatch = raw.match(/будильник\s+на\s+(\d{1,2}):(\d{2})/i);
          if (alarmMatch) {
            const hh = String(Number(alarmMatch[1])).padStart(2, '0');
            const mm = String(Number(alarmMatch[2])).padStart(2, '0');
            const t = `${hh}:${mm}`;
            const resp = timerController?.addAlarm?.(t);
            createPlannerWindow();
            sendPlannerUpdate();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: resp?.ok ? `Будильник установлен на ${t}` : 'Не удалось установить будильник' });
            return;
          }

          if (hasAny('останови таймер', 'стоп таймер')) {
            const resp = timerController?.stopTimer?.();
            sendPlannerUpdate();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: resp?.ok ? 'Таймер остановлен' : 'Нет активного таймера' });
            return;
          }

          if (hasAny('отмени все таймеры', 'сбрось все таймеры', 'очисти таймеры')) {
            timerController?.clearTimers?.();
            sendPlannerUpdate();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: 'Все таймеры отменены' });
            return;
          }

          if (hasAny('что у меня сегодня', 'мои напоминания сегодня', 'напоминания сегодня')) {
            const all = reminderController?.getAllForUi?.() || [];
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth();
            const day = d.getDate();
            const todayList = all.filter((r) => {
              const dt = new Date(Number(r?.ts || r?.time || 0));
              return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day;
            });
            const msg = todayList.length
              ? `На сегодня ${todayList.length} напоминаний`
              : 'На сегодня напоминаний нет';
            createPlannerWindow();
            sendPlannerUpdate();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: msg });
            try {
              new Notification({ title: 'Напоминания', body: msg }).show();
            } catch {}
            return;
          }
        }

        // Voice: "Коннор, какая сегодня дата"
        if (hasAny('какая сегодня дата', 'сегодня дата', 'дата', 'дат')) {
          try {
            const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
            new Notification({ title: 'Дата', body: date }).show();
            sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: `Дата: ${date}` });
          } catch {}
          return;
        }

        // Voice: "Коннор, погода в ..." (online via Open-Meteo)
        if (hasAny('погода', 'погод')) {
          (async () => {
            try {
              const idx = spoken.indexOf('погода');
              let after = idx >= 0 ? spoken.slice(idx + 'погода'.length).trim() : '';
              after = after.replace(/^в\s+/, '').trim();
              const city = after || 'москва';

              const weatherCodeMap = {
                0: 'ясно',
                1: 'в основном ясно',
                2: 'переменная облачность',
                3: 'пасмурно',
                45: 'туман',
                48: 'изморозь',
                51: 'слабая морось',
                53: 'умеренная морось',
                55: 'густая морось',
                56: 'слабый ледяной дождь',
                57: 'ледяной дождь',
                61: 'небольшой дождь',
                63: 'умеренный дождь',
                65: 'сильный дождь',
                66: 'ледяной дождь',
                67: 'сильный ледяной дождь',
                71: 'слабый снег',
                73: 'умеренный снег',
                75: 'сильный снег',
                77: 'снежные зерна',
                80: 'небольшие ливни',
                81: 'умеренные ливни',
                82: 'сильные ливни',
                85: 'слабый снегопад',
                86: 'сильный снегопад',
                95: 'гроза',
                96: 'гроза с небольшим градом',
                99: 'гроза с сильным градом',
              };

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 12000);

              // 1) Поиск координат по названию города
              const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                city
              )}&count=1&language=ru&format=json`;
              const geoRes = await fetch(geoUrl, { signal: controller.signal });
              const geoData = await geoRes.json().catch(() => ({}));
              const lat = geoData?.results?.[0]?.latitude;
              const lon = geoData?.results?.[0]?.longitude;

              if (typeof lat !== 'number' || typeof lon !== 'number') throw new Error('city_not_found');

              // 2) Текущая погода
              const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
                String(lat)
              )}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,weather_code&timezone=auto`;
              const wxRes = await fetch(wxUrl, { signal: controller.signal });
              const wxData = await wxRes.json().catch(() => ({}));
              const temp = wxData?.current?.temperature_2m;
              const code = wxData?.current?.weather_code;

              clearTimeout(timeout);
              if (typeof temp !== 'number' || typeof code !== 'number') throw new Error('weather_parse_failed');

              const desc = weatherCodeMap[code] || `код ${code}`;
              const resultText = `Погода в ${city}: ${temp}°C, ${desc}`;

              new Notification({ title: 'Погода', body: resultText }).show();
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: resultText });
            } catch (err) {
              clearTimeout(timeout);
              const msg = 'Погода недоступна (ошибка сети/город не найден).';
              new Notification({ title: 'Погода', body: msg }).show();
              sendToConnorFloating('voice:command', { command, rawTranscript, ts, result: msg });
            }
          })();
          return;
        }

        // Voice: "Коннор, проверь микрофон"
        if (hasAny('проверь микрофон', 'проверить микрофон', 'микрофон', 'микро')) {
          (async () => {
            try {
              try {
                voiceController?.stopListening?.();
              } catch {}
              try {
                mainWindow?.webContents?.send('mic:test', { seconds: 2 });
              } catch {}
            } catch (err) {
              logSystemError('voice mic test failed', err, { command, rawTranscript });
            }
          })();
          return;
        }

        // Voice: "Коннор, запусти тест"
        if (hasAny('запусти тест', 'запусти проверку', 'тест')) {
          (async () => {
            try {
              new Notification({ title: 'Тест', body: 'Системная информация + проверка микрофона.' }).show();
              const snapshot = await collectSystemSnapshot();
              const cpu = typeof snapshot?.cpuPercent === 'number' ? `${Math.round(snapshot.cpuPercent)}%` : '—';
              new Notification({ title: 'CPU', body: cpu }).show();
              try {
                voiceController?.stopListening?.();
              } catch {}
              try {
                mainWindow?.webContents?.send('mic:test', { seconds: 2 });
              } catch {}
            } catch (err) {
              logSystemError('voice test failed', err, { command, rawTranscript });
            }
          })();
          return;
        }

        // Голос: "Коннор, спроси у DeepSeek..."
        if (
          (hasAny('deepseek', 'депсик', 'дипсик', 'дисик', 'чат')) &&
          deepseekController
        ) {
          (async () => {
            try {
              // Берём текст после слова deepseek.
              const idx = spoken.indexOf('deepseek');
              let question = '';
              if (idx >= 0) {
                question = spoken.slice(idx + 'deepseek'.length).trim();
              }

              // Иногда распознавание: "у deepseek ..." => убрать leading "у".
              question = question.replace(/^у\s+/, '').trim();
              if (!question) {
                question = String(command || '').trim();
              }

              if (!question) return;

              // Показываем вкладку DeepSeek.
              try {
                mainWindow?.webContents?.send('ui:route', { view: 'deepseek' });
              } catch {}

              const resp = await deepseekController.sendMessage({
                chatId: null,
                message: question,
              });

              if (!resp?.ok) return;

              try {
                const resultText = String(resp?.assistantText || '').trim();
                if (resultText) {
                  sendToConnorFloating('voice:command', {
                    command,
                    rawTranscript,
                    ts,
                    result: `DeepSeek: ${resultText.slice(0, 90)}${resultText.length > 90 ? '…' : ''}`,
                  });
                }
              } catch {}

              try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('deepseek:assistantMessage', resp);
                }
              } catch {}

            } catch (err) {
              logSystemError('deepseek voice send failed', err, { command, rawTranscript });
            }
          })();

          return;
        }

        // Голос: "Коннор, напомни через 5 минут про встречу"
        if (hasAny('напомни', 'напом')) {
          (async () => {
            try {
              if (!reminderController) return;
              const resp = await reminderController.createFromVoiceText(command);
              if (resp?.ok) {
                try {
                  new Notification({
                    title: 'Напоминание',
                    body: resp.reminder?.message || 'Добавлено',
                  }).show();
                } catch {}
              }
            } catch (err) {
              logSystemError('voice reminder failed', err, { command, rawTranscript });
            }
          })();
          return;
        }

        // Голос: "Коннор, сделай скриншот" (полный или область)
        if (hasAny('скриншот', 'скрин', 'экран')) {
          const wantsRegion = hasAny('область', 'выдел', 'част');
          (async () => {
            try {
              if (!screenshotController) return;
              const resp = wantsRegion
                ? await screenshotController.takeRegionScreenshotInteractive({ doOcr: true })
                : await screenshotController.takeFullScreenshot({ doOcr: true });
              if (resp?.ok && resp.filePath) {
                try {
                  new Notification({
                    title: 'Screenshot',
                    body: resp.text ? resp.text.slice(0, 120) : `Сохранено: ${resp.filePath}`,
                  }).show();
                } catch {}
              }
            } catch (err) {
              logSystemError('voice screenshot failed', err, { command, rawTranscript });
            }
          })();
          return;
        }

        // Voice: "Коннор, запусти макрос 1"
        try {
          if (macroController) {
            macroController
              .tryRunFromSpoken(command)
              .then((r) => {
                if (r?.ok) return;
              })
              .catch((err) => logSystemError('macro from voice failed', err, { command, rawTranscript }));
          }
        } catch {}

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('voice:command', { command, rawTranscript, ts });
        }
        // Всегда дублируем команду в floating-окно Коннора.
        sendToConnorFloating('voice:command', { command, rawTranscript, ts });
      });
    }
  });
}

function createOnboardingWindow() {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) return onboardingWindow;

  const onboardingPath = path.join(__dirname, 'src', 'onboarding.html');
  onboardingWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    title: 'Connor — Onboarding',
    backgroundColor: '#050510',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  onboardingWindow.setMenuBarVisibility(false);
  onboardingWindow.loadFile(onboardingPath);
  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow?.show();
    onboardingWindow?.focus();
  });
  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });
  return onboardingWindow;
}

function getSystemNoConfirmPower() {
  return !!store.get('systemCommands.noConfirmPower');
}

function _broadcastSystemConfirmState() {
  if (!systemConfirmWindow || systemConfirmWindow.isDestroyed()) return;
  const now = Date.now();
  const remainingMs = systemPendingAction ? Math.max(0, (systemPendingAction.deadlineTs || 0) - now) : 0;
  systemConfirmWindow.webContents.send('system:confirm:state', {
    pending: !!systemPendingAction,
    actionKey: systemPendingAction?.actionKey || null,
    label: systemPendingAction?.label || '',
    remainingSec: Math.ceil(remainingMs / 1000),
  });
}

function _clearSystemConfirmTimer() {
  if (systemConfirmInterval) {
    clearInterval(systemConfirmInterval);
    systemConfirmInterval = null;
  }
}

async function executeSystemAction(actionKey) {
  const key = String(actionKey || '').toLowerCase();
  if (key === 'shutdown') {
    spawn('shutdown', ['/s', '/t', '10'], { windowsHide: true });
    return { ok: true, message: 'Выключение через 10 секунд' };
  }
  if (key === 'restart') {
    spawn('shutdown', ['/r', '/t', '10'], { windowsHide: true });
    return { ok: true, message: 'Перезагрузка через 10 секунд' };
  }
  if (key === 'sleep') {
    spawn('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { windowsHide: true });
    return { ok: true, message: 'Перевожу в спящий режим' };
  }
  if (key === 'lock') {
    await systemCommands?.computerLock?.();
    return { ok: true, message: 'Экран заблокирован' };
  }
  if (key === 'recycle-clear') {
    spawn('powershell', ['-NoProfile', '-Command', 'Clear-RecycleBin -Force'], { windowsHide: true });
    return { ok: true, message: 'Корзина очищается' };
  }
  if (key === 'taskmgr') {
    spawn('taskmgr.exe', [], { windowsHide: true });
    return { ok: true, message: 'Открываю диспетчер задач' };
  }
  if (key === 'sysprops') {
    spawn('control.exe', ['sysdm.cpl'], { windowsHide: true });
    return { ok: true, message: 'Открываю свойства системы' };
  }
  if (key === 'control') {
    spawn('control.exe', [], { windowsHide: true });
    return { ok: true, message: 'Открываю панель управления' };
  }
  return { ok: false, message: 'Неизвестная системная команда' };
}

function createSystemConfirmWindow() {
  if (systemConfirmWindow && !systemConfirmWindow.isDestroyed()) return systemConfirmWindow;
  const p = path.join(__dirname, 'src', 'system-confirm.html');
  systemConfirmWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    title: 'Подтверждение действия',
    backgroundColor: '#050510',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  systemConfirmWindow.setMenuBarVisibility(false);
  systemConfirmWindow.loadFile(p);
  systemConfirmWindow.once('ready-to-show', () => {
    systemConfirmWindow?.show();
    _broadcastSystemConfirmState();
  });
  systemConfirmWindow.on('closed', () => {
    systemConfirmWindow = null;
  });
  return systemConfirmWindow;
}

async function requestSystemConfirm(actionKey, label) {
  systemPendingAction = {
    actionKey,
    label,
    deadlineTs: Date.now() + 10000,
  };
  createSystemConfirmWindow();
  _clearSystemConfirmTimer();
  _broadcastSystemConfirmState();
  systemConfirmInterval = setInterval(async () => {
    if (!systemPendingAction) {
      _clearSystemConfirmTimer();
      return;
    }
    const left = (systemPendingAction.deadlineTs || 0) - Date.now();
    if (left <= 0) {
      const action = systemPendingAction;
      systemPendingAction = null;
      _clearSystemConfirmTimer();
      try {
        await executeSystemAction(action.actionKey);
      } catch {}
      try {
        systemConfirmWindow?.close();
      } catch {}
      return;
    }
    _broadcastSystemConfirmState();
  }, 250);
}

function sendToConnorFloating(channel, payload) {
  try {
    if (!connorFloatingWindow || connorFloatingWindow.isDestroyed()) return;
    connorFloatingWindow.webContents.send(channel, payload);
  } catch {}
}

function positionConnorFloatingWindow({ forceDefault = false } = {}) {
  try {
    if (!connorFloatingWindow || connorFloatingWindow.isDestroyed()) return;

    const bounds = screen.getPrimaryDisplay().bounds;
    const margin = CONNOR_FLOAT_MARGIN;

    const saved = store.get('floatingBounds') || store.get('connorFloating') || {};
    let x = typeof saved?.x === 'number' ? saved.x : NaN;
    let y = typeof saved?.y === 'number' ? saved.y : NaN;

    const defaultX = bounds.x + bounds.width - CONNOR_FLOAT_W - margin;
    const defaultY = bounds.y + bounds.height - CONNOR_FLOAT_H - margin;

    if (forceDefault || !Number.isFinite(x) || !Number.isFinite(y)) {
      x = defaultX;
      y = defaultY;
    } else {
      const minX = bounds.x + margin;
      const minY = bounds.y + margin;
      const maxX = bounds.x + bounds.width - CONNOR_FLOAT_W - margin;
      const maxY = bounds.y + bounds.height - CONNOR_FLOAT_H - margin;
      x = Math.max(minX, Math.min(maxX, x));
      y = Math.max(minY, Math.min(maxY, y));
    }

    connorFloatingWindow.setPosition(Math.round(x), Math.round(y));
  } catch {}
}

function createConnorFloatingWindow() {
  const floatingPath = path.join(__dirname, 'src', 'floating.html');
  connorFloatingWindow = new BrowserWindow({
    width: CONNOR_FLOAT_W,
    height: CONNOR_FLOAT_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: true,
    resizable: false,
    title: 'Connor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    connorFloatingWindow.loadFile(floatingPath);
  } catch {}

  connorFloatingWindow.on('closed', () => {
    connorFloatingWindow = null;
  });

  let lastSave = 0;
  connorFloatingWindow.on('move', () => {
    try {
      const now = Date.now();
      if (now - lastSave < 350) return;
      lastSave = now;
      const b = connorFloatingWindow.getBounds();
      store.set('floatingBounds', { x: b.x, y: b.y });
      // На всякий случай сохраняем и старый ключ, чтобы не терять позицию при откате логики.
      try {
        store.set('connorFloating', { x: b.x, y: b.y });
      } catch {}
    } catch {}
  });

  try {
    connorFloatingWindow.setVisibleOnAllWorkspaces(true);
  } catch {}

  connorFloatingWindow.webContents.on('did-finish-load', () => {
    positionConnorFloatingWindow();
  });

  // На случай изменения конфигурации мониторов.
  try {
    screen.on('display-metrics-changed', () => positionConnorFloatingWindow());
  } catch {}
}

function createMusicScannerWindow() {
  if (musicScannerWindow && !musicScannerWindow.isDestroyed()) return musicScannerWindow;

  const scannerPath = path.join(__dirname, 'src', 'music-scanner.html');
  musicScannerWindow = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    backgroundColor: '#000000',
    title: 'Music Scanner',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  musicScannerWindow.loadFile(scannerPath);
  musicScannerWindow.on('closed', () => {
    musicScannerWindow = null;
  });

  musicScannerWindow.webContents.on('did-finish-load', () => {
    try {
      musicScannerWindow.show();
      musicScannerWindow.focus();
    } catch {}
  });

  return musicScannerWindow;
}

function createCasinoWindow() {
  const casinoPath = path.join(__dirname, 'src', 'casino', 'casino.html');

  casinoWindow = new BrowserWindow({
    width: 980,
    height: 720,
    show: false,
    backgroundColor: '#050510',
    title: 'Casino - Connor Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  casinoWindow.loadFile(casinoPath);
  casinoWindow.on('closed', () => {
    casinoWindow = null;
  });
}

function createPlannerWindow() {
  if (plannerWindow && !plannerWindow.isDestroyed()) return plannerWindow;
  const plannerPath = path.join(__dirname, 'src', 'planner.html');
  plannerWindow = new BrowserWindow({
    width: 800,
    height: 500,
    show: false,
    backgroundColor: '#050510',
    title: 'Planner - Connor Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  plannerWindow.loadFile(plannerPath);
  plannerWindow.on('closed', () => {
    plannerWindow = null;
  });
  plannerWindow.webContents.on('did-finish-load', () => {
    try {
      plannerWindow.show();
      plannerWindow.focus();
      sendPlannerUpdate();
    } catch {}
  });
  return plannerWindow;
}

function createTimeWindow() {
  if (timeWindow && !timeWindow.isDestroyed()) return timeWindow;
  const p = path.join(__dirname, 'src', 'time-window.html');
  timeWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    resizable: false,
    backgroundColor: '#050510',
    title: 'Время',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  timeWindow.loadFile(p);
  timeWindow.on('closed', () => {
    timeWindow = null;
  });
  timeWindow.webContents.on('did-finish-load', () => {
    try {
      const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      timeWindow.webContents.send('time:update', { now });
      timeWindow.show();
      timeWindow.focus();
    } catch {}
  });
  return timeWindow;
}

function createNotesWindow() {
  if (notesWindow && !notesWindow.isDestroyed()) return notesWindow;
  const p = path.join(__dirname, 'src', 'notes.html');
  notesWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    backgroundColor: '#050510',
    title: 'Notes - Connor Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  notesWindow.loadFile(p);
  notesWindow.on('closed', () => {
    notesWindow = null;
  });
  notesWindow.webContents.on('did-finish-load', () => {
    try {
      notesWindow.show();
      notesWindow.focus();
      const st = notesController?.getState?.() || { notes: [], clipboardHistory: [] };
      notesWindow.webContents.send('notes:update', st);
    } catch {}
  });
  return notesWindow;
}

function sendNotesUpdate() {
  try {
    if (!notesWindow || notesWindow.isDestroyed()) return;
    const st = notesController?.getState?.() || { notes: [], clipboardHistory: [] };
    notesWindow.webContents.send('notes:update', st);
  } catch {}
}

function createMusicPlayerFullWindow() {
  if (musicPlayerFullWindow && !musicPlayerFullWindow.isDestroyed()) return musicPlayerFullWindow;
  const p = path.join(__dirname, 'src', 'music-player-window.html');
  musicPlayerFullWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#050510',
    title: 'Music Player - Connor Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  musicPlayerFullWindow.loadFile(p);
  musicPlayerFullWindow.on('closed', () => {
    musicPlayerFullWindow = null;
  });
  musicPlayerFullWindow.webContents.on('did-finish-load', async () => {
    try {
      const tracks = Array.isArray(store.get('musicTracks')) ? store.get('musicTracks') : [];
      if (!tracks.length) {
        const userProfile = process.env.USERPROFILE || '';
        const roots = [
          userProfile ? path.join(userProfile, 'Music') : null,
          userProfile ? path.join(userProfile, 'Downloads') : null,
          'C:\\Music',
        ].filter(Boolean);
        const discovered = await scanMp3FilesFromRoots(roots, { maxFiles: 5000 }).catch(() => []);
        if (Array.isArray(discovered) && discovered.length) store.set('musicTracks', discovered);
      }
    } catch {}
    try {
      musicPlayerFullWindow.show();
      musicPlayerFullWindow.focus();
    } catch {}
  });
  return musicPlayerFullWindow;
}

function emitMusicStateChanged(reason = 'update') {
  try {
    mainWindow?.webContents?.send('music:state-changed', { reason });
  } catch {}
  try {
    musicPlayerFullWindow?.webContents?.send('music:state-changed', { reason });
  } catch {}
}

function sendPlannerUpdate() {
  try {
    if (!plannerWindow || plannerWindow.isDestroyed()) return;
    const timers = timerController?.getState?.() || { timers: [], alarms: [] };
    const reminders = reminderController?.getAllForUi?.() || [];
    plannerWindow.webContents.send('planner:update', { timers, reminders });
  } catch {}
}

async function scanMp3FilesFromRoots(roots, { maxFiles = 5000 } = {}) {
  const extensions = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg']);
  const results = [];
  const visited = new Set();

  async function walkDir(dir) {
    if (results.length >= maxFiles) return;
    if (visited.has(dir)) return;
    visited.add(dir);

    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;

      results.push({
        path: fullPath,
        title: path.basename(entry.name, ext),
        duration: 0,
        thumbnail: '',
      });
    }
  }

  for (const root of roots) {
    if (results.length >= maxFiles) break;
    if (!root || typeof root !== 'string') continue;
    if (!fs.existsSync(root)) continue;
    await walkDir(root);
  }

  return results;
}

function tryReadEmbeddedCoverDataUrl(filePath) {
  try {
    if (!NodeID3 || !filePath) return '';
    const tags = NodeID3.read(filePath);
    const imageBuffer = tags?.image?.imageBuffer;
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) return '';
    const mime = tags?.image?.mime || 'image/jpeg';
    return `data:${mime};base64,${imageBuffer.toString('base64')}`;
  } catch {
    return '';
  }
}

class MusicSearchController {
  async searchTracks(query, limit = 20) {
    const q = String(query || '').trim();
    const max = Math.max(1, Math.min(50, Number(limit) || 20));
    if (!q || !yts) return [];

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY || '';
    return new Promise((resolve) => {
      yts(
        q,
        {
          maxResults: max,
          type: 'video',
          key: apiKey || undefined,
        },
        (err, results) => {
          if (err || !Array.isArray(results)) {
            resolve([]);
            return;
          }
          const items = results.map((video) => ({
            id: String(video.id || ''),
            title: String(video.title || 'Unknown title'),
            artist: String(video.channelTitle || video.channel || 'Unknown artist'),
            duration: String(video.duration || ''),
            thumbnail: String(video?.thumbnails?.high?.url || video?.thumbnails?.default?.url || ''),
            url: `https://youtube.com/watch?v=${String(video.id || '')}`,
            source: 'youtube',
          })).filter((x) => x.id);
          resolve(items);
        },
      );
    });
  }

  async getTrending(limit = 20) {
    // Lightweight fallback query for "new music".
    return this.searchTracks('new music this week', limit);
  }
}

const musicSearchController = new MusicSearchController();

function registerIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('settings:get', () => {
    const deepseek = store.get('deepseek') || {};
    return {
      autoLaunch: !!store.get('autoLaunch'),
      theme: store.get('theme') || 'neon',
      hotkeyEnabled: !!store.get('hotkeyEnabled'),
      hotkeys: store.get('hotkeys') || {},
      deepseekApiKeySet: !!deepseek?.apiKey,
      userName: String(store.get('userName') || ''),
      noConfirmPower: !!store.get('systemCommands.noConfirmPower'),
      ttsEnabled: store.get('ttsEnabled') !== false,
      ttsRate: Number.isFinite(Number(store.get('ttsRate'))) ? Number(store.get('ttsRate')) : 1.0,
      ttsVolume: Number.isFinite(Number(store.get('ttsVolume'))) ? Number(store.get('ttsVolume')) : 0.8,
      language: String(store.get('language') || 'ru').toLowerCase() === 'en' ? 'en' : 'ru',
      autoUpdateEnabled: store.get('autoUpdateEnabled') !== false,
    };
  });

  // DeepSeek chat.
  ipcMain.handle('deepseek:getState', () => {
    try {
      return deepseekController ? deepseekController.getStateForUi() : { apiKeySet: false, activeChatId: null };
    } catch {
      return { apiKeySet: false, activeChatId: null };
    }
  });

  ipcMain.handle('deepseek:listChats', () => {
    try {
      return deepseekController ? deepseekController.listChatsForUi() : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('deepseek:newChat', async (_event, payload) => {
    try {
      if (!deepseekController) return { ok: false, error: 'not_ready' };
      return deepseekController.newChat(payload || {});
    } catch (err) {
      logSystemError('deepseek:newChat failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('deepseek:selectChat', async (_event, chatId) => {
    try {
      if (!deepseekController) return { ok: false, error: 'not_ready' };
      return deepseekController.selectChat(chatId);
    } catch (err) {
      logSystemError('deepseek:selectChat failed', err, { chatId });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('deepseek:getChat', async (_event, chatId) => {
    try {
      if (!deepseekController) return { ok: false, error: 'not_ready' };
      const chat = deepseekController.getChat(chatId);
      if (!chat) return { ok: false, error: 'chat_not_found' };
      return { ok: true, chat };
    } catch (err) {
      logSystemError('deepseek:getChat failed', err, { chatId });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('deepseek:send', async (_event, payload) => {
    try {
      if (!deepseekController) return { ok: false, error: 'not_ready' };
      return await deepseekController.sendMessage(payload || {});
    } catch (err) {
      logSystemError('deepseek:send failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('deepseek:deleteChat', async (_event, chatId) => {
    try {
      if (!deepseekController) return { ok: false, error: 'not_ready' };
      return deepseekController.deleteChat(chatId);
    } catch (err) {
      logSystemError('deepseek:deleteChat failed', err, { chatId });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Reminders.
  ipcMain.handle('reminders:getAll', () => {
    try {
      return reminderController ? reminderController.getAllForUi() : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('reminders:cancel', (_event, id) => {
    try {
      if (!reminderController) return { ok: false, error: 'not_ready' };
      return reminderController.cancel(id);
    } catch (err) {
      logSystemError('reminders:cancel failed', err, { id });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('screenshot:full', async () => {
    try {
      if (!screenshotController) return { ok: false, error: 'screenshot_not_ready' };
      return await screenshotController.takeFullScreenshot({ doOcr: true });
    } catch (err) {
      logSystemError('screenshot:full failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('screenshot:region', async () => {
    try {
      if (!screenshotController) return { ok: false, error: 'screenshot_not_ready' };
      return await screenshotController.takeRegionScreenshotInteractive({ doOcr: true });
    } catch (err) {
      logSystemError('screenshot:region failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Macros.
  ipcMain.handle('macro:getAll', () => {
    try {
      if (!macroController) return [];
      return macroController._getMacros();
    } catch {
      return [];
    }
  });

  ipcMain.handle('macro:startRecording', async (_event, payload) => {
    try {
      if (!macroController) return { ok: false, error: 'macro_controller_not_ready' };
      const name = payload?.name || payload?.macroName;
      return await macroController.startRecording({ macroName: name });
    } catch (err) {
      logSystemError('macro:startRecording failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('macro:stopRecording', async () => {
    try {
      if (!macroController) return { ok: false, error: 'macro_controller_not_ready' };
      return await macroController.stopRecording();
    } catch (err) {
      logSystemError('macro:stopRecording failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.on('macro:recordEvent', (_event, payload) => {
    try {
      macroController?.recordEvent?.(payload);
    } catch (err) {
      logSystemError('macro:recordEvent failed', err, { payload });
    }
  });

  ipcMain.handle('macro:update', async (_event, payload) => {
    try {
      if (!macroController) return { ok: false, error: 'macro_controller_not_ready' };
      return await macroController.updateMacro(payload || {});
    } catch (err) {
      logSystemError('macro:update failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('macro:play', async (_event, payload) => {
    try {
      if (!macroController) return { ok: false, error: 'macro_controller_not_ready' };
      return await macroController.playMacro(payload || {});
    } catch (err) {
      logSystemError('macro:play failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('casino:getState', () => {
    const casino = store.get('casino') || {};
    const wallet = typeof casino.wallet === 'number' ? casino.wallet : 1000;
    const history = Array.isArray(casino.history) ? casino.history : [];
    return {
      wallet,
      history: history.slice(-50),
    };
  });

  ipcMain.handle('casino:open', () => {
    try {
      if (!casinoWindow || casinoWindow.isDestroyed()) {
        createCasinoWindow();
      }
      if (casinoWindow && !casinoWindow.isDestroyed()) {
        if (!casinoWindow.isVisible()) casinoWindow.show();
        casinoWindow.focus();
      }
      return { ok: true };
    } catch (err) {
      logSystemError('casino:open failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('casino:reset', () => {
    store.set('casino', { wallet: 1000, history: [] });
    return { ok: true, wallet: 1000, history: [] };
  });

  function getRouletteColor(n) {
    const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    if (n === 0) return 'green';
    return red.has(n) ? 'red' : 'black';
  }

  function getRouletteOrder() {
    // Европейская раскладка колеса (0..36)
    return [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  }

  ipcMain.handle('casino:spin', async (_event, payload) => {
    try {
      const betType = String(payload?.betType || '').toLowerCase();
      const stake = Number(payload?.stake);
      const number = payload?.number != null ? Number(payload.number) : null;

      if (!['red', 'black', 'number', 'even', 'odd'].includes(betType)) {
        return { ok: false, error: 'invalid_betType' };
      }
      if (!Number.isFinite(stake) || stake <= 0) {
        return { ok: false, error: 'invalid_stake' };
      }

      if (betType === 'number') {
        if (number == null || !Number.isFinite(number) || number < 0 || number > 36) {
          return { ok: false, error: 'invalid_number' };
        }
      }

      const casino = store.get('casino') || {};
      let wallet = typeof casino.wallet === 'number' ? casino.wallet : 1000;
      const history = Array.isArray(casino.history) ? casino.history : [];

      if (wallet < stake) {
        return { ok: false, error: 'insufficient_funds', wallet };
      }

      const { randomInt } = require('crypto');
      const resultNumber = randomInt(0, 37);

      let win = false;
      let payoutMultiplier = 0;
      const resultColor = getRouletteColor(resultNumber);

      if (betType === 'red') {
        win = resultColor === 'red';
        payoutMultiplier = 2;
      } else if (betType === 'black') {
        win = resultColor === 'black';
        payoutMultiplier = 2;
      } else if (betType === 'even') {
        win = resultNumber !== 0 && resultNumber % 2 === 0;
        payoutMultiplier = 2;
      } else if (betType === 'odd') {
        win = resultNumber % 2 === 1;
        payoutMultiplier = 2;
      } else if (betType === 'number') {
        win = resultNumber === number;
        payoutMultiplier = 36;
      }

      wallet -= stake;
      let payout = 0;
      if (win) {
        payout = stake * payoutMultiplier;
        wallet += payout;
      }

      const entry = {
        ts: Date.now(),
        resultNumber,
        color: resultColor,
        betType,
        stake,
        win,
        payout,
      };

      history.push(entry);
      const trimmed = history.slice(-30);
      store.set('casino', { wallet, history: trimmed });

      return {
        ok: true,
        resultNumber,
        color: entry.color,
        win,
        stake,
        payout,
        wallet,
        history: trimmed,
        wheelOrder: getRouletteOrder(),
      };
    } catch (err) {
      logSystemError('casino:spin failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('system:execute', async (_event, payload) => {
    try {
      const action = payload?.action;
      const args = payload?.payload || payload?.args || {};
      if (!action) return { ok: false, error: 'action_required' };
      if (!systemCommands) return { ok: false, error: 'system_commands_not_ready' };

      const result = await systemCommands.execute(action, args);
      return { ok: true, result };
    } catch (err) {
      logSystemError('system:execute failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Голос: управление прослушиванием из renderer.
  ipcMain.handle('voice:startListening', () => {
    if (!voiceController) return { ok: false, reason: 'voice_not_ready' };
    try {
      voiceController.startListening();
      try {
        mainWindow?.webContents?.send('voice:status', { listening: true });
      } catch {}
      sendToConnorFloating('voice:status', { listening: true });
      return { ok: true };
    } catch (err) {
      logVoiceError('voice:startListening failed', err, { stage: 'ipc voice:startListening' });
      return { ok: false, reason: 'start_listening_failed' };
    }
  });

  ipcMain.handle('voice:stopListening', () => {
    if (!voiceController) return { ok: false, reason: 'voice_not_ready' };
    try {
      voiceController.stopListening();
      try {
        mainWindow?.webContents?.send('voice:status', { listening: false });
      } catch {}
      sendToConnorFloating('voice:status', { listening: false });
      return { ok: true };
    } catch (err) {
      logVoiceError('voice:stopListening failed', err, { stage: 'ipc voice:stopListening' });
      return { ok: false, reason: 'stop_listening_failed' };
    }
  });

  // Для renderer: готов ли Vosk recognizer (реально ли можно кормить PCM)?
  ipcMain.handle('voice:voskReady', () => {
    try {
      if (!voiceController) return { ok: false, ready: false };
      const ready = !!voiceController.isVoskReady?.();
      const error = voiceController._pythonLastError ? String(voiceController._pythonLastError) : null;
      return { ok: true, ready, error };
    } catch {
      return { ok: false, ready: false };
    }
  });

  // Голос fallback: присылаем финальные транскрипты от SpeechRecognition.
  ipcMain.on('voice:fallback:transcript', (_event, payload) => {
    const text = payload?.text;
    if (typeof text !== 'string') return;
    try {
      const controller = voiceController;
      if (!controller) return;

      const normalized = controller.normalizeText(text);
      // Если рендерер прислал "команду без wake word" — эмитим команду напрямую.
      const hasWake = controller.isWakeWord?.(normalized);
      if (normalized && !hasWake) {
        if (typeof controller._emitCommand === 'function') controller._emitCommand(normalized, text);
        return;
      }

      controller.handleTranscript(text);
    } catch (err) {
      logVoiceError('handleTranscript(fallback) failed', err, { stage: 'voice:fallback:transcript' });
    }
  });

  // Голос: оффлайн Vosk через PCM (int16 LE) из renderer.
  ipcMain.on('voice:vosk:pcm', (_event, payload) => {
    try {
      const controller = voiceController;
      if (!controller) return;
      const raw = payload?.pcm;
      if (!raw) return;

      let pcm = null;
      if (raw instanceof Int16Array) {
        pcm = raw;
      } else if (ArrayBuffer.isView(raw) && raw?.buffer) {
        pcm = new Int16Array(raw.buffer, raw.byteOffset || 0, Math.floor((raw.byteLength || 0) / 2));
      } else if (raw instanceof ArrayBuffer) {
        pcm = new Int16Array(raw);
      } else if (Array.isArray(raw)) {
        pcm = Int16Array.from(raw.map((v) => Number(v) || 0));
      } else if (typeof raw === 'object') {
        // На случай, если structured clone превратил TypedArray в plain object {0:...,1:...}
        const keys = Object.keys(raw)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b));
        if (keys.length) {
          const arr = keys.map((k) => Number(raw[k]) || 0);
          pcm = Int16Array.from(arr);
        }
      }

      if (!pcm || !pcm.length) return;
      controller.feedPcmInt16LE(pcm);
      if (controller._pcmFrames % 60 === 0) {
        let rms = 0;
        try {
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) {
            const v = Number(pcm[i]) || 0;
            sum += v * v;
          }
          rms = Math.sqrt(sum / Math.max(1, pcm.length)) / 32768;
        } catch {}
        logVoiceTrace('pcm:chunk', { frames: controller._pcmFrames, samples: pcm.length, sttReady: !!controller.isVoskReady?.() });
        logVoiceTrace('pcm:level', { rms: Number(rms.toFixed(5)) });
      }

      // Небольшая телеметрия в overlay: подтверждает, что main получает PCM.
      if (!controller._pcmReported && controller._pcmFrames > 0 && controller._pcmFrames % 120 === 0) {
        controller._pcmReported = true;
        sendToConnorFloating('voice:status', {
          listening: true,
          transcript: `PCM connected${controller.isVoskReady?.() ? ' | STT ready' : ''}`,
        });
      }
    } catch (err) {
      logVoiceTrace('pcm:error', { error: err?.message || String(err) });
      logVoiceError('voice:vosk:pcm failed', err, { stage: 'ipcMain.on voice:vosk:pcm' });
    }
  });

  ipcMain.on('voice:fallback:error', (_event, payload) => {
    try {
      logVoiceError('Web Speech fallback error', null, {
        stage: 'voice:fallback:error',
        payload,
      });
    } catch {}
  });

  // Обновление статуса floating-окна (прослушивание + interim transcript).
  ipcMain.on('voice:status:update', (_event, payload) => {
    try {
      const listening = !!payload?.listening;
      const transcript = typeof payload?.transcript === 'string' ? payload.transcript : undefined;
      sendToConnorFloating('voice:status', { listening, transcript });
    } catch {}
  });

  // Индикатор активности микрофона для floating-окна.
  ipcMain.on('voice:mic:level', (_event, payload) => {
    try {
      const level = Number(payload?.level);
      if (!Number.isFinite(level)) return;
      sendToConnorFloating('voice:mic:level', { level });
    } catch {}
  });

  ipcMain.handle('settings:set', async (_event, patch) => {
    if (!patch || typeof patch !== 'object') return { ok: false };

    const prevTheme = store.get('theme');
    const prevHotkeyEnabled = store.get('hotkeyEnabled');
    const prevHotkeys = store.get('hotkeys');
    const prevAutoLaunch = store.get('autoLaunch');

    for (const [k, v] of Object.entries(patch)) {
      if (k === 'autoLaunch') store.set('autoLaunch', !!v);
      if (k === 'autoUpdateEnabled') store.set('autoUpdateEnabled', !!v);
      if (k === 'theme') store.set('theme', v);
      if (k === 'hotkeyEnabled') store.set('hotkeyEnabled', !!v);
      if (k === 'hotkeys') store.set('hotkeys', v);
      if (k === 'deepseekApiKey') store.set('deepseek.apiKey', v ? String(v) : '');
      if (k === 'userName') store.set('userName', String(v || '').trim());
      if (k === 'noConfirmPower') store.set('systemCommands.noConfirmPower', !!v);
      if (k === 'ttsEnabled') store.set('ttsEnabled', !!v);
      if (k === 'ttsRate') store.set('ttsRate', Math.max(0.5, Math.min(2.0, Number(v) || 1.0)));
      if (k === 'ttsVolume') store.set('ttsVolume', Math.max(0, Math.min(1, Number(v) || 0.8)));
      if (k === 'language') store.set('language', String(v).toLowerCase() === 'en' ? 'en' : 'ru');
    }

    try {
      voiceController?.refreshLanguage?.();
    } catch {}

    if (store.get('autoLaunch') !== prevAutoLaunch) syncAutoLaunch();
    const nextHotkeyEnabled = store.get('hotkeyEnabled');
    const nextHotkeys = store.get('hotkeys');
    if (nextHotkeyEnabled !== prevHotkeyEnabled || JSON.stringify(nextHotkeys) !== JSON.stringify(prevHotkeys)) {
      registerOrUnregisterHotkeys();
    }

    if (store.get('theme') !== prevTheme && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:theme', { theme: store.get('theme') });
    }

    return { ok: true };
  });

  ipcMain.handle('onboarding:getState', () => {
    return {
      onboardingCompleted: !!store.get('onboardingCompleted'),
      userName: String(store.get('userName') || ''),
      options: store.get('onboarding') || { scanFolders: true, findGames: false },
    };
  });

  ipcMain.handle('onboarding:complete', async (_event, payload) => {
    try {
      const userName = String(payload?.name || '').trim();
      const scanFolders = payload?.scanFolders !== false;
      const findGames = !!payload?.findGames;
      if (userName) store.set('userName', userName);
      store.set('onboarding', { scanFolders, findGames });
      await scanOnboardingCache({ scanFolders, findGames });
      store.set('onboardingCompleted', true);

      try {
        onboardingWindow?.close();
      } catch {}
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      return { ok: true };
    } catch (err) {
      logSystemError('onboarding:complete failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('cache:rescan', async (_event, payload) => {
    try {
      const options = payload && typeof payload === 'object'
        ? payload
        : (store.get('onboarding') || { scanFolders: true, findGames: false });
      const result = await scanOnboardingCache({
        scanFolders: options.scanFolders !== false,
        findGames: !!options.findGames,
      });
      return { ok: true, result };
    } catch (err) {
      logSystemError('cache:rescan failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('cache:clear', async () => {
    try {
      if (fs.existsSync(connorCachePath)) {
        await fs.promises.unlink(connorCachePath);
      }
      return { ok: true };
    } catch (err) {
      logSystemError('cache:clear failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('system:confirmAction', async (_event, payload) => {
    try {
      const key = String(payload?.actionKey || '');
      if (!systemPendingAction || key !== String(systemPendingAction.actionKey || '')) {
        return { ok: false, error: 'no_pending_action' };
      }
      systemPendingAction = null;
      _clearSystemConfirmTimer();
      const resp = await executeSystemAction(key);
      try {
        systemConfirmWindow?.close();
      } catch {}
      return { ok: !!resp?.ok, result: resp };
    } catch (err) {
      logSystemError('system:confirmAction failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('system:cancelPending', async () => {
    try {
      systemPendingAction = null;
      _clearSystemConfirmTimer();
      try {
        spawn('shutdown', ['/a'], { windowsHide: true });
      } catch {}
      try {
        new Notification({ title: 'Connor', body: 'Выключение отменено' }).show();
      } catch {}
      try {
        systemConfirmWindow?.close();
      } catch {}
      return { ok: true };
    } catch (err) {
      logSystemError('system:cancelPending failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('system:refresh', async () => {
    const snapshot = await collectSystemSnapshot();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:update', snapshot);
    }
    return { ok: true };
  });

  ipcMain.handle('planner:open', () => {
    try {
      createPlannerWindow();
      return { ok: true };
    } catch (err) {
      logSystemError('planner:open failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('planner:getState', () => {
    try {
      const timers = timerController?.getState?.() || { timers: [], alarms: [] };
      const reminders = reminderController?.getAllForUi?.() || [];
      return { ok: true, timers, reminders };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('planner:addTimer', (_event, payload) => {
    try {
      const mins = Number(payload?.minutes);
      const label = String(payload?.label || '');
      const resp = timerController?.addTimer?.(mins, label) || { ok: false, error: 'timer_not_ready' };
      sendPlannerUpdate();
      return resp;
    } catch (err) {
      logSystemError('planner:addTimer failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('planner:addAlarm', (_event, payload) => {
    try {
      const resp = timerController?.addAlarm?.(payload?.time) || { ok: false, error: 'timer_not_ready' };
      sendPlannerUpdate();
      return resp;
    } catch (err) {
      logSystemError('planner:addAlarm failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('planner:stopTimer', (_event, payload) => {
    try {
      const resp = timerController?.stopTimer?.(payload?.id) || { ok: false, error: 'timer_not_ready' };
      sendPlannerUpdate();
      return resp;
    } catch (err) {
      logSystemError('planner:stopTimer failed', err, { payload });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('planner:clearTimers', () => {
    try {
      const resp = timerController?.clearTimers?.() || { ok: false, error: 'timer_not_ready' };
      sendPlannerUpdate();
      return resp;
    } catch (err) {
      logSystemError('planner:clearTimers failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('notes:open', () => {
    try {
      createNotesWindow();
      return { ok: true };
    } catch (err) {
      logSystemError('notes:open failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('notes:getState', () => {
    try {
      const st = notesController?.getState?.() || { notes: [], clipboardHistory: [] };
      return { ok: true, ...st };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), notes: [], clipboardHistory: [] };
    }
  });

  ipcMain.handle('notes:add', (_event, payload) => {
    const resp = notesController?.add?.(payload?.text) || { ok: false, error: 'notes_not_ready' };
    sendNotesUpdate();
    return resp;
  });

  ipcMain.handle('notes:update', (_event, payload) => {
    const resp = notesController?.update?.(payload?.id, payload?.text) || { ok: false, error: 'notes_not_ready' };
    sendNotesUpdate();
    return resp;
  });

  ipcMain.handle('notes:remove', (_event, payload) => {
    const resp = notesController?.remove?.(payload?.id) || { ok: false, error: 'notes_not_ready' };
    sendNotesUpdate();
    return resp;
  });

  ipcMain.handle('notes:copy', (_event, payload) => {
    try {
      const text = String(payload?.text || '').trim();
      clipboard.writeText(text);
      notesController?.pushClipboard?.(text);
      sendNotesUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('music:openPlayerWindow', () => {
    try {
      createMusicPlayerFullWindow();
      return { ok: true };
    } catch (err) {
      logSystemError('music:openPlayerWindow failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Music player (playlist + volume).
  ipcMain.handle('music:getState', () => {
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const activePlaylistId = music.activePlaylistId || (playlists[0]?.id || 'playlist_1');
    const activeTrackIndexRaw = Number.isFinite(Number(music.activeTrackIndex)) ? Number(music.activeTrackIndex) : 0;
    const volume = typeof music.volume === 'number' ? music.volume : 0.7;

    const activePlaylist = playlists.find((p) => p?.id === activePlaylistId) || playlists[0] || { id: activePlaylistId, name: 'Мои треки', tracks: [] };
    const tracks = Array.isArray(activePlaylist.tracks) ? activePlaylist.tracks : [];
    const activeTrackIndex = tracks.length ? Math.max(0, Math.min(activeTrackIndexRaw, tracks.length - 1)) : 0;
    const favorites = Array.isArray(store.get('musicFavorites')) ? store.get('musicFavorites') : [];
    const releases = store.get('musicReleasesCache') || { ts: 0, items: [] };

    return {
      volume,
      playlists,
      activePlaylistId,
      activeTrackIndex,
      activePlaylistName: activePlaylist.name || 'Мои треки',
      tracks,
      favorites,
      releases: {
        ts: Number(releases?.ts) || 0,
        items: Array.isArray(releases?.items) ? releases.items : [],
      },
      account: {
        userName: String(store.get('userName') || 'Connor User'),
      },
    };
  });

  ipcMain.handle('music:search', async (_event, query, limit) => {
    try {
      const items = await musicSearchController.searchTracks(query, limit);
      return { ok: true, items };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), items: [] };
    }
  });

  ipcMain.handle('music:getReleases', async (_event, payload) => {
    try {
      const force = !!payload?.force;
      const cache = store.get('musicReleasesCache') || { ts: 0, items: [] };
      const now = Date.now();
      const fresh = (now - (Number(cache?.ts) || 0)) < (24 * 60 * 60 * 1000);
      if (!force && fresh && Array.isArray(cache?.items) && cache.items.length) {
        return { ok: true, items: cache.items, ts: cache.ts, cached: true };
      }
      const items = await musicSearchController.getTrending(20);
      store.set('musicReleasesCache', { ts: now, items });
      return { ok: true, items, ts: now, cached: false };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), items: [] };
    }
  });

  ipcMain.handle('music:play-url', (_event, url) => {
    try {
      const u = String(url || '').trim();
      if (!u) return { ok: false, error: 'url_required' };
      if (musicPlayerFullWindow && !musicPlayerFullWindow.isDestroyed()) {
        musicPlayerFullWindow.webContents.send('music:play-url', { url: u });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('music:setVolume', (_event, volume) => {
    const v = typeof volume === 'number' ? volume : Number(volume);
    if (!Number.isFinite(v)) return { ok: false, error: 'invalid_volume' };
    const clamped = Math.max(0, Math.min(1, v));
    store.set('music.volume', clamped);
    emitMusicStateChanged('music:setVolume');
    return { ok: true, volume: clamped };
  });

  ipcMain.handle('music:setActiveTrack', (_event, index) => {
    const i = Number(index);
    if (!Number.isFinite(i)) return { ok: false, error: 'invalid_index' };
    store.set('music.activeTrackIndex', i);
    emitMusicStateChanged('music:setActiveTrack');
    return { ok: true, activeTrackIndex: i };
  });

  ipcMain.handle('music:addTrack', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Music', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
      ],
    });
    if (res?.canceled) return { ok: false, error: 'canceled' };
    const filePath = res?.filePaths?.[0];
    if (!filePath) return { ok: false, error: 'no_file' };

    const title = path.basename(filePath).replace(/\.[^.]+$/, '');
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const activePlaylistId = music.activePlaylistId || (playlists[0]?.id || 'playlist_1');
    let activeIndex = playlists.findIndex((p) => p?.id === activePlaylistId);
    if (activeIndex < 0) activeIndex = 0;
    if (!playlists[activeIndex]) {
      playlists[activeIndex] = { id: activePlaylistId, name: 'Мои треки', tracks: [] };
    }
    if (!Array.isArray(playlists[activeIndex].tracks)) playlists[activeIndex].tracks = [];

    const thumbnail = tryReadEmbeddedCoverDataUrl(filePath);
    playlists[activeIndex].tracks.push({ path: filePath, title, thumbnail });
    const nextTrackIndex = playlists[activeIndex].tracks.length - 1;

    store.set('music.playlists', playlists);
    store.set('music.activePlaylistId', playlists[activeIndex].id);
    store.set('music.activeTrackIndex', nextTrackIndex);
    emitMusicStateChanged('music:addTrack');

    return { ok: true, added: { path: filePath, title, thumbnail }, activeTrackIndex: nextTrackIndex };
  });

  ipcMain.handle('music:openScanner', () => {
    try {
      createMusicScannerWindow();
      return { ok: true };
    } catch (err) {
      logSystemError('music:openScanner failed', err, {});
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Music scan (MP3) + discovery list.
  ipcMain.handle('music:scan', async () => {
    const userProfile = process.env.USERPROFILE || '';
    const roots = [
      userProfile ? path.join(userProfile, 'Music') : null,
      userProfile ? path.join(userProfile, 'Downloads') : null,
      'C:\\Music',
    ].filter(Boolean);

    const discovered = await scanMp3FilesFromRoots(roots, { maxFiles: 5000 }).catch(() => []);

    const existing = Array.isArray(store.get('musicTracks')) ? store.get('musicTracks') : [];
    const merged = [...existing, ...discovered];
    const map = new Map();
    for (const t of merged) {
      if (!t?.path) continue;
      map.set(t.path, {
        path: t.path,
        title: t.title || path.basename(t.path, path.extname(t.path)),
        duration: typeof t.duration === 'number' ? t.duration : 0,
        thumbnail: String(t.thumbnail || ''),
      });
    }
    const unique = [...map.values()];
    store.set('musicTracks', unique);
    emitMusicStateChanged('music:scan');
    return unique;
  });

  ipcMain.handle('music:getTracks', () => {
    return Array.isArray(store.get('musicTracks')) ? store.get('musicTracks') : [];
  });

  // Playlist CRUD.
  ipcMain.handle('playlist:getAll', () => {
    const music = store.get('music') || {};
    return Array.isArray(music.playlists) ? music.playlists : [];
  });

  ipcMain.handle('playlist:create', (_event, name) => {
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const title = String(name || '').trim() || 'Новый плейлист';
    const id = `pl_${Date.now()}`;
    const next = { id, name: title, tracks: [] };
    playlists.push(next);
    store.set('music.playlists', playlists);
    store.set('music.activePlaylistId', id);
    store.set('music.activeTrackIndex', 0);
    emitMusicStateChanged('playlist:create');
    return next;
  });

  ipcMain.handle('playlist:rename', (_event, payload) => {
    const id = String(payload?.id || '');
    const name = String(payload?.name || '').trim();
    if (!id || !name) return { ok: false, error: 'invalid_payload' };
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const target = playlists.find((p) => String(p?.id) === id);
    if (!target) return { ok: false, error: 'playlist_not_found' };
    target.name = name;
    store.set('music.playlists', playlists);
    emitMusicStateChanged('playlist:rename');
    return { ok: true };
  });

  ipcMain.handle('playlist:delete', (_event, playlistId) => {
    const music = store.get('music') || {};
    let playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const idStr = String(playlistId);

    playlists = playlists.filter((p) => String(p?.id) !== idStr);
    if (!playlists.length) {
      playlists = [{ id: 'playlist_1', name: 'Мои треки', tracks: [] }];
    }

    const activeId = String(music.activePlaylistId || '');
    const nextActive = playlists.some((p) => String(p?.id) === activeId) ? activeId : playlists[0]?.id;

    store.set('music.playlists', playlists);
    store.set('music.activePlaylistId', nextActive);
    store.set('music.activeTrackIndex', 0);
    emitMusicStateChanged('playlist:delete');
    return playlists;
  });

  ipcMain.handle('playlist:setActive', (_event, playlistId) => {
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const idStr = String(playlistId);
    const exists = playlists.some((p) => String(p?.id) === idStr);
    if (!exists) return { ok: false, error: 'playlist_not_found' };
    store.set('music.activePlaylistId', playlistId);
    store.set('music.activeTrackIndex', 0);
    emitMusicStateChanged('playlist:setActive');
    return { ok: true };
  });

  ipcMain.handle('playlist:addTrack', (_event, playlistId, track) => {
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const idStr = String(playlistId);
    const pl = playlists.find((p) => String(p?.id) === idStr);
    if (!pl) return { ok: false, error: 'playlist_not_found' };

    const trackPath = track?.path ? String(track.path) : '';
    if (!trackPath) return { ok: false, error: 'invalid_track' };

    if (!Array.isArray(pl.tracks)) pl.tracks = [];
    if (pl.tracks.some((t) => t?.path === trackPath)) return { ok: true };

    const ext = path.extname(trackPath);
    const title = String(track?.title || track?.name || path.basename(trackPath, ext)).trim() || 'Track';
    pl.tracks.push({
      path: trackPath,
      title,
      duration: typeof track?.duration === 'number' ? track.duration : 0,
      thumbnail: String(track?.thumbnail || tryReadEmbeddedCoverDataUrl(trackPath) || ''),
      artist: String(track?.artist || ''),
      url: String(track?.url || ''),
      id: String(track?.id || ''),
    });

    store.set('music.playlists', playlists);

    // Если это активный плейлист — ставим активный индекс на новый трек.
    if (String(music.activePlaylistId) === idStr) {
      // Не трогаем activeTrackIndex: добавление трека не должно переключать воспроизведение.
      // activeTrackIndex можно обновлять только при явном выборе трека пользователем.
    }

    emitMusicStateChanged('playlist:addTrack');
    return { ok: true };
  });

  ipcMain.handle('playlist:addTrackByName', (_event, payload) => {
    const playlistName = String(payload?.playlistName || '').trim().toLowerCase();
    const track = payload?.track || {};
    if (!playlistName) return { ok: false, error: 'playlist_name_required' };
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const pl = playlists.find((p) => String(p?.name || '').trim().toLowerCase() === playlistName);
    if (!pl) return { ok: false, error: 'playlist_not_found' };
    const tp = String(track?.path || track?.url || '').trim();
    if (!tp) return { ok: false, error: 'invalid_track' };
    if (!Array.isArray(pl.tracks)) pl.tracks = [];
    if (!pl.tracks.some((t) => String(t?.path || t?.url || '') === tp)) {
      pl.tracks.push({
        id: String(track?.id || ''),
        path: String(track?.path || ''),
        url: String(track?.url || ''),
        title: String(track?.title || 'Track'),
        artist: String(track?.artist || ''),
        duration: track?.duration || 0,
        thumbnail: String(track?.thumbnail || ''),
      });
      store.set('music.playlists', playlists);
      emitMusicStateChanged('playlist:addTrackByName');
    }
    return { ok: true };
  });

  ipcMain.handle('music:favorites:get', () => {
    return Array.isArray(store.get('musicFavorites')) ? store.get('musicFavorites') : [];
  });

  ipcMain.handle('music:favorites:toggle', (_event, payload) => {
    const track = payload?.track || {};
    const key = String(track?.id || track?.path || track?.url || '').trim();
    if (!key) return { ok: false, error: 'invalid_track' };
    let favorites = Array.isArray(store.get('musicFavorites')) ? store.get('musicFavorites') : [];
    const idx = favorites.findIndex((t) => String(t?.id || t?.path || t?.url || '') === key);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      store.set('musicFavorites', favorites);
      emitMusicStateChanged('favorites:remove');
      return { ok: true, favorite: false, favorites };
    }
    favorites.push({
      ...track,
      addedAt: Date.now(),
    });
    store.set('musicFavorites', favorites);
    emitMusicStateChanged('favorites:add');
    return { ok: true, favorite: true, favorites };
  });

  ipcMain.handle('playlist:removeTrack', (_event, playlistId, trackPath) => {
    const music = store.get('music') || {};
    const playlists = Array.isArray(music.playlists) ? music.playlists : [];
    const idStr = String(playlistId);
    const pl = playlists.find((p) => String(p?.id) === idStr);
    if (!pl) return { ok: false, error: 'playlist_not_found' };

    const tp = trackPath ? String(trackPath) : '';
    if (!tp) return { ok: false, error: 'invalid_trackPath' };

    if (!Array.isArray(pl.tracks)) pl.tracks = [];
    pl.tracks = pl.tracks.filter((t) => t?.path !== tp);

    store.set('music.playlists', playlists);

    if (String(music.activePlaylistId) === idStr) {
      const rawIndex = Number.isFinite(Number(music.activeTrackIndex)) ? Number(music.activeTrackIndex) : 0;
      const nextIndex = pl.tracks.length ? Math.max(0, Math.min(rawIndex, pl.tracks.length - 1)) : 0;
      store.set('music.activeTrackIndex', nextIndex);
    }

    try {
      mainWindow?.webContents?.send('music:state-changed', { reason: 'playlist:removeTrack', playlistId: idStr });
    } catch {}
    return { ok: true };
  });

  ipcMain.handle('notify:show', (_event, payload) => {
    const title = payload?.title || 'Connor Assistant';
    const body = payload?.body || '';
    new Notification({ title, body }).show();
    return { ok: true };
  });

  ipcMain.on('app:quit', () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.handle('check-for-updates', async () => {
    checkForUpdates(true);
    return { ok: true };
  });

  ipcMain.on('quit-and-install', () => {
    try {
      autoUpdater?.quitAndInstall?.();
    } catch {}
  });

  ipcMain.on('ui:open-settings', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    mainWindow.webContents.send('ui:route', { view: 'settings' });
  });
}

function sendUpdateStatus(data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('update-status', data);
  } catch {}
}

function sendUpdateProgress(data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('update-progress', data);
  } catch {}
}

function setupAutoUpdater() {
  if (!autoUpdater) return;

  try {
    if (updaterLog) {
      autoUpdater.logger = updaterLog;
      autoUpdater.logger.transports.file.level = 'info';
      updaterLog.info('App starting...');
    }
  } catch {}

  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking', message: 'Проверка обновлений...' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ status: 'update-available', message: `Доступна версия ${info?.version || ''}`, version: info?.version });
    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Доступно обновление',
      message: `Версия ${info?.version || ''} доступна`,
      detail: `Текущая версия: ${app.getVersion()}\nХотите загрузить обновление?`,
      buttons: ['Загрузить', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        sendUpdateStatus({ status: 'downloading', message: 'Загрузка обновления...' });
        autoUpdater.downloadUpdate().catch(() => {});
      } else {
        sendUpdateStatus({ status: 'deferred', message: 'Обновление отложено' });
      }
    }).catch(() => {});
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ status: 'no-updates', message: 'У вас последняя версия' });
  });

  autoUpdater.on('error', (err) => {
    const message = `Ошибка: ${err?.message || String(err)}`;
    sendUpdateStatus({ status: 'error', message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(Number(progressObj?.percent || 0));
    sendUpdateProgress({
      percent,
      bytesPerSecond: progressObj?.bytesPerSecond || 0,
      transferred: progressObj?.transferred || 0,
      total: progressObj?.total || 0,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    try {
      new Notification({
        title: 'Connor Assistant',
        body: 'Обновление загружено! Перезапустите приложение для установки.',
      }).show();
    } catch {}
    sendUpdateStatus({ status: 'downloaded', message: 'Обновление загружено. Перезапустите для установки.' });
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      mainWindow.webContents.send('update-downloaded', { message: 'Обновление загружено. Перезапустите для установки.' });
    } catch {}
  });
}

function checkForUpdates(_manual = true) {
  if (!autoUpdater) return;
  sendUpdateStatus({ status: 'checking', message: 'Проверка обновлений...' });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  createMainWindow();
  createConnorFloatingWindow();
  // Создаём casinoWindow заранее (без показа), чтобы кнопка “Казино” работала стабильно.
  try {
    createCasinoWindow();
  } catch {}
  screenshotController = new ScreenshotController({ logger: logSystemError, clipboard });
  systemCommands = new SystemCommands({ logger: logSystemError });
  macroController = new MacroController({ logger: logSystemError, store });
  reminderController = new ReminderController({ store, logger: logSystemError });
  reminderController.start();
  timerController = new TimerController({ storeRef: store, logger: logSystemError });
  timerController.start();
  notesController = new NotesController({ storeRef: store });
  deepseekController = new DeepSeekController({ store, logger: logSystemError });
  createTray();
  registerIpc();

  syncAutoLaunch();
  registerOrUnregisterHotkeys();
  startSystemMonitoring();

  setupAutoUpdater();
  setTimeout(() => {
    const autoUpdateEnabled = store.get('autoUpdateEnabled') !== false;
    if (autoUpdateEnabled) checkForUpdates(false);
  }, 5000);

  new Notification({
    title: 'CONNOR Assistant',
    body: `Приложение запущено (v${app.getVersion()}). Мониторинг активен.`,
  }).show();
  const onboardingCompleted = !!store.get('onboardingCompleted');
  if (onboardingCompleted) {
    mainWindow.show();
  } else {
    createOnboardingWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}

  try {
    voiceController?.stopListening();
  } catch {}
  try {
    timerController?.stop?.();
  } catch {}
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    toggleWindowFromTray();
  });
}