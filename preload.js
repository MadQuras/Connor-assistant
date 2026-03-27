const { contextBridge, ipcRenderer } = require('electron');

// Внимание: никакого прямого доступа к Node.js в рендерере.
contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSetting: async (key, defaultValue) => {
    const all = await ipcRenderer.invoke('settings:get');
    if (!all || typeof all !== 'object') return defaultValue;
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : defaultValue;
  },
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', { [key]: value }),

  refreshSystem: () => ipcRenderer.invoke('system:refresh'),
  showNotification: (payload) => ipcRenderer.invoke('notify:show', payload),

  quitAppInMain: () => ipcRenderer.send('app:quit'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),

  // Голос: управление из renderer.
  startVoiceListening: () => ipcRenderer.invoke('voice:startListening'),
  stopVoiceListening: () => ipcRenderer.invoke('voice:stopListening'),

  // Голос: события от главного процесса.
  onVoiceCommand: (callback) => ipcRenderer.on('voice:command', (_event, data) => callback(data)),
  onVoiceStatus: (callback) => ipcRenderer.on('voice:status', (_event, data) => callback(data)),
  onVoiceFallbackStart: (callback) => ipcRenderer.on('voice:fallback:start', (_event, data) => callback(data)),
  onVoiceFallbackStop: (callback) => ipcRenderer.on('voice:fallback:stop', (_event, data) => callback(data)),
  onVoiceMicLevel: (callback) => ipcRenderer.on('voice:mic:level', (_event, data) => callback(data)),

  // Голос: оффлайн Vosk по PCM (int16 PCM LE).
  // Важно: PCM должен быть частотой 16000 Гц, моно.
  sendVoicePcmFrame: (pcmInt16Array) => {
    // structured clone для TypedArray в Electron работает.
    ipcRenderer.send('voice:vosk:pcm', { pcm: pcmInt16Array });
  },

  // Голос: индикатор активности микрофона (уровень 0..1).
  sendVoiceMicLevel: (level) => {
    const v = Number(level);
    ipcRenderer.send('voice:mic:level', { level: Number.isFinite(v) ? v : 0 });
  },

  // Голос fallback: SpeechRecognition присылает финальные транскрипты.
  sendVoiceFallbackTranscript: (text) => ipcRenderer.send('voice:fallback:transcript', { text }),
  // Голос fallback: ошибки SpeechRecognition (для логирования).
  sendVoiceFallbackError: (payload) => ipcRenderer.send('voice:fallback:error', payload),

  // Обновление статуса floating-окна (например, interim transcript Web Speech).
  sendVoiceStatusUpdate: (payload) => ipcRenderer.send('voice:status:update', payload),

  // Микрофон: тест (запрос от main).
  onMicTest: (callback) => ipcRenderer.on('mic:test', (_event) => callback()),

  // Состояние офлайн-Vosk (для renderer/PCM стрима).
  voskIsReady: () => ipcRenderer.invoke('voice:voskReady'),

  // Подписка на события от главного процесса.
  onSystemUpdate: (callback) => ipcRenderer.on('system:update', (_event, data) => callback(data)),
  onThemeUpdate: (callback) => ipcRenderer.on('settings:theme', (_event, data) => callback(data)),
  onRouteChange: (callback) => ipcRenderer.on('ui:route', (_event, data) => callback(data)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, data) => callback(data)),

  // Открыть страницу настроек через главный процесс (например, из трея).
  openSettingsInMain: () => ipcRenderer.send('ui:open-settings'),

  // Casino.
  casinoGetState: () => ipcRenderer.invoke('casino:getState'),
  casinoSpin: (payload) => ipcRenderer.invoke('casino:spin', payload),
  casinoReset: () => ipcRenderer.invoke('casino:reset'),
  openCasino: () => ipcRenderer.invoke('casino:open'),

  // Macros.
  macroGetAll: () => ipcRenderer.invoke('macro:getAll'),
  macroStartRecording: (payload) => ipcRenderer.invoke('macro:startRecording', payload),
  macroStopRecording: () => ipcRenderer.invoke('macro:stopRecording'),
  macroUpdate: (payload) => ipcRenderer.invoke('macro:update', payload),
  macroPlay: (payload) => ipcRenderer.invoke('macro:play', payload),
  macroRecordEvent: (payload) => ipcRenderer.send('macro:recordEvent', payload),

  // Screenshots + OCR.
  screenshotFull: () => ipcRenderer.invoke('screenshot:full'),
  screenshotRegion: () => ipcRenderer.invoke('screenshot:region'),

  // Region overlay (internal).
  submitScreenshotRegion: (rect) => ipcRenderer.send('screenshot:region:submit', rect),
  cancelScreenshotRegion: (payload) => ipcRenderer.send('screenshot:region:cancel', payload),

  // Reminders.
  remindersGetAll: () => ipcRenderer.invoke('reminders:getAll'),
  remindersCancel: (id) => ipcRenderer.invoke('reminders:cancel', id),
  onRemindersUpdate: (callback) => ipcRenderer.on('reminders:update', (_event, data) => callback(data)),

  // DeepSeek Chat.
  deepseekGetState: () => ipcRenderer.invoke('deepseek:getState'),
  deepseekListChats: () => ipcRenderer.invoke('deepseek:listChats'),
  deepseekNewChat: (payload) => ipcRenderer.invoke('deepseek:newChat', payload),
  deepseekSelectChat: (chatId) => ipcRenderer.invoke('deepseek:selectChat', chatId),
  deepseekGetChat: (chatId) => ipcRenderer.invoke('deepseek:getChat', chatId),
  deepseekSend: (payload) => ipcRenderer.invoke('deepseek:send', payload),
  deepseekDeleteChat: (chatId) => ipcRenderer.invoke('deepseek:deleteChat', chatId),
  onDeepseekAssistantMessage: (callback) => ipcRenderer.on('deepseek:assistantMessage', (_event, data) => callback(data)),

  // Music player.
  musicGetState: () => ipcRenderer.invoke('music:getState'),
  musicAddTrack: () => ipcRenderer.invoke('music:addTrack'),
  musicSetVolume: (volume) => ipcRenderer.invoke('music:setVolume', volume),
  musicSetActiveTrack: (index) => ipcRenderer.invoke('music:setActiveTrack', index),

  // Music scan + playlist mgmt.
  musicScan: () => ipcRenderer.invoke('music:scan'),
  musicGetTracks: () => ipcRenderer.invoke('music:getTracks'),
  openMusicScanner: () => ipcRenderer.invoke('music:openScanner'),
  playlistGetAll: () => ipcRenderer.invoke('playlist:getAll'),
  playlistCreate: (name) => ipcRenderer.invoke('playlist:create', name),
  playlistRename: (payload) => ipcRenderer.invoke('playlist:rename', payload),
  playlistDelete: (playlistId) => ipcRenderer.invoke('playlist:delete', playlistId),
  playlistSetActive: (playlistId) => ipcRenderer.invoke('playlist:setActive', playlistId),
  playlistAddTrack: (playlistId, track) => ipcRenderer.invoke('playlist:addTrack', playlistId, track),
  playlistAddTrackByName: (payload) => ipcRenderer.invoke('playlist:addTrackByName', payload),
  playlistRemoveTrack: (playlistId, trackPath) => ipcRenderer.invoke('playlist:removeTrack', playlistId, trackPath),
  musicSearch: (query, limit) => ipcRenderer.invoke('music:search', query, limit),
  musicPlayUrl: (url) => ipcRenderer.invoke('music:play-url', url),
  musicGetReleases: (payload) => ipcRenderer.invoke('music:getReleases', payload),
  musicFavoritesGet: () => ipcRenderer.invoke('music:favorites:get'),
  musicFavoritesToggle: (payload) => ipcRenderer.invoke('music:favorites:toggle', payload),

  onMusicStateChanged: (callback) => ipcRenderer.on('music:state-changed', (_event, data) => callback(data)),
  onMusicPlayUrl: (callback) => ipcRenderer.on('music:play-url', (_event, data) => callback(data)),

  // Onboarding + cache.
  onboardingGetState: () => ipcRenderer.invoke('onboarding:getState'),
  onboardingComplete: (payload) => ipcRenderer.invoke('onboarding:complete', payload),
  cacheRescan: (payload) => ipcRenderer.invoke('cache:rescan', payload),
  cacheClear: () => ipcRenderer.invoke('cache:clear'),

  // System confirm window.
  onSystemConfirmState: (callback) => ipcRenderer.on('system:confirm:state', (_event, data) => callback(data)),
  systemConfirmAction: (actionKey) => ipcRenderer.invoke('system:confirmAction', { actionKey }),
  systemCancelPending: () => ipcRenderer.invoke('system:cancelPending'),

  // Planner + time window.
  plannerOpen: () => ipcRenderer.invoke('planner:open'),
  plannerGetState: () => ipcRenderer.invoke('planner:getState'),
  plannerAddTimer: (payload) => ipcRenderer.invoke('planner:addTimer', payload),
  plannerAddAlarm: (payload) => ipcRenderer.invoke('planner:addAlarm', payload),
  plannerStopTimer: (payload) => ipcRenderer.invoke('planner:stopTimer', payload),
  plannerClearTimers: () => ipcRenderer.invoke('planner:clearTimers'),
  onPlannerUpdate: (callback) => ipcRenderer.on('planner:update', (_event, data) => callback(data)),
  onTimeUpdate: (callback) => ipcRenderer.on('time:update', (_event, data) => callback(data)),

  // Notes + clipboard window.
  notesOpen: () => ipcRenderer.invoke('notes:open'),
  notesGetState: () => ipcRenderer.invoke('notes:getState'),
  notesAdd: (payload) => ipcRenderer.invoke('notes:add', payload),
  notesUpdate: (payload) => ipcRenderer.invoke('notes:update', payload),
  notesRemove: (payload) => ipcRenderer.invoke('notes:remove', payload),
  notesCopy: (payload) => ipcRenderer.invoke('notes:copy', payload),
  onNotesUpdate: (callback) => ipcRenderer.on('notes:update', (_event, data) => callback(data)),

  // Full music player window.
  musicOpenPlayerWindow: () => ipcRenderer.invoke('music:openPlayerWindow'),
  onMusicVoiceCommand: (callback) => ipcRenderer.on('music:voiceCommand', (_event, data) => callback(data)),
});

