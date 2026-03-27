function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSeconds) {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function filePathToFileUrl(filePath) {
  if (!filePath) return '';
  const p = String(filePath);
  if (p.startsWith('file://')) return p;
  const normalized = p.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) return `file:///${normalized}`;
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file://${normalized}`;
}

function titleFromPath(p) {
  try {
    const s = String(p || '');
    const extIdx = s.lastIndexOf('.');
    const base = extIdx > 0 ? s.slice(0, extIdx) : s;
    const slashIdx = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
    return base.slice(slashIdx + 1) || 'Track';
  } catch {
    return 'Track';
  }
}

function promptPickTrack(tracks, { previewLimit = 50 } = {}) {
  if (!tracks.length) return null;
  const preview = tracks.slice(0, previewLimit);
  const text = preview.map((t, i) => `${i + 1}. ${t.title || titleFromPath(t.path)}`).join('\n');
  const ans = prompt(`Выберите трек номером:\n${text}\n\nВведите число (1-${preview.length}):`);
  const idx = Number(ans);
  if (!Number.isFinite(idx)) return null;
  const realIdx = idx - 1;
  if (realIdx < 0 || realIdx >= preview.length) return null;
  return preview[realIdx] || null;
}

export function initMusicPlayer() {
  const els = {
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    currentTime: document.getElementById('currentTime'),
    progressBar: document.getElementById('progressBar'),
    totalTime: document.getElementById('totalTime'),
    trackList: document.getElementById('trackList'),
    addTrackBtn: document.getElementById('addTrackBtn'),
    scanMusicBtn: document.getElementById('scanMusicBtn'),
    musicTracksCount: document.getElementById('musicTracksCount'),
    playlistSelect: document.getElementById('playlistSelect'),
    newPlaylistBtn: document.getElementById('newPlaylistBtn'),
    deletePlaylistBtn: document.getElementById('deletePlaylistBtn'),
  };

  if (!els.playPauseBtn || !els.trackList || !els.progressBar || !els.volumeSlider || !window.api?.musicGetState) return;

  const audio = new Audio();
  audio.preload = 'metadata';

  let playlists = [];
  let activePlaylistId = null;
  let tracks = [];
  let activeTrackIndex = 0;

  let discoveredTracks = [];
  let volume = 0.7;

  let isSeeking = false;
  let isRefreshing = false;

  function setPlayUi() {
    els.playPauseBtn.textContent = audio.paused ? '▶' : '⏸';
  }

  function syncTrackActiveClasses() {
    els.trackList.querySelectorAll('.track-item').forEach((n) => {
      const idx = Number(n.dataset.index);
      n.classList.toggle('active', Number.isFinite(idx) && idx === activeTrackIndex);
    });
  }

  function loadTrack(index, { autoplay = false, persist = true } = {}) {
    if (!tracks.length) return;
    const i = clamp(index, 0, tracks.length - 1);
    activeTrackIndex = i;

    const track = tracks[i];
    if (!track?.path) return;

    if (persist && window.api?.musicSetActiveTrack) void window.api.musicSetActiveTrack(i).catch(() => {});
    if (audio) audio.volume = volume;
    audio.src = filePathToFileUrl(track.path);

    els.currentTime.textContent = '0:00';
    els.totalTime.textContent = '0:00';
    els.progressBar.value = '0';

    syncTrackActiveClasses();
    if (autoplay) void audio.play().catch(() => {});
  }

  function renderPlaylists() {
    if (!els.playlistSelect) return;
    els.playlistSelect.innerHTML = '';
    for (const p of playlists) {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.name || `Плейлист ${p.id}`;
      els.playlistSelect.appendChild(opt);
    }
    els.playlistSelect.value = activePlaylistId != null ? String(activePlaylistId) : String(playlists[0]?.id || '');
  }

  function renderTracks() {
    els.trackList.innerHTML = '';
    if (!tracks.length) {
      const empty = document.createElement('div');
      empty.className = 'track-empty';
      empty.textContent = 'Пока нет треков в плейлисте.';
      els.trackList.appendChild(empty);
      return;
    }

    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'track-item';
      row.dataset.index = String(idx);
      if (idx === activeTrackIndex) row.classList.add('active');

      const title = document.createElement('div');
      title.className = 'track-title';
      title.textContent = t?.title || `Трек ${idx + 1}`;
      title.title = t?.title || '';

      const actions = document.createElement('div');
      actions.style.display = 'inline-flex';
      actions.style.gap = '10px';
      actions.style.alignItems = 'center';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track-play-btn';
      btn.textContent = idx === activeTrackIndex && !audio.paused ? '⏸' : '▶';
      btn.addEventListener('click', () => {
        loadTrack(idx, { autoplay: true });
        setPlayUi();
      });

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'track-remove-btn';
      rm.textContent = '✖';
      rm.title = 'Удалить из плейлиста';
      rm.addEventListener('click', async () => {
        try {
          if (!window.api?.playlistRemoveTrack) return;
          await window.api.playlistRemoveTrack(activePlaylistId, t?.path);
          await refreshAll({ preserveActiveTrack: true });
        } catch {}
      });

      actions.appendChild(btn);
      actions.appendChild(rm);

      row.appendChild(title);
      row.appendChild(actions);
      els.trackList.appendChild(row);
    });
  }

  function seekToPercent(pct) {
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const percent = clamp(pct, 0, 100) / 100;
    audio.currentTime = percent * d;
  }

  async function refreshDiscoveredTracks({ autoScan = false } = {}) {
    const list = await window.api.musicGetTracks().catch(() => []);
    discoveredTracks = Array.isArray(list) ? list : [];
    if (els.musicTracksCount) els.musicTracksCount.textContent = `${discoveredTracks.length} MP3`;

    if (autoScan && !discoveredTracks.length && window.api?.musicScan) {
      if (els.musicTracksCount) els.musicTracksCount.textContent = 'Сканирую…';
      const scanned = await window.api.musicScan().catch(() => []);
      discoveredTracks = Array.isArray(scanned) ? scanned : [];
      if (els.musicTracksCount) els.musicTracksCount.textContent = `${discoveredTracks.length} MP3`;
    }
  }

  async function refreshAll({ preserveActiveTrack = false } = {}) {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const st = await window.api.musicGetState().catch(() => null);
      if (!st) return;
      volume = typeof st.volume === 'number' ? st.volume : 0.7;
      playlists = Array.isArray(st.playlists) ? st.playlists : [];
      activePlaylistId = st.activePlaylistId;
      tracks = Array.isArray(st.tracks) ? st.tracks : [];
      activeTrackIndex = Number.isFinite(Number(st.activeTrackIndex)) ? Number(st.activeTrackIndex) : 0;

      audio.volume = volume;
      if (els.volumeSlider) els.volumeSlider.value = String(Math.round(volume * 100));
      renderPlaylists();
      renderTracks();

      const desiredTrack = tracks[activeTrackIndex];
      const desiredSrc = desiredTrack?.path ? filePathToFileUrl(desiredTrack.path) : '';
      const currentSrc = audio?.src || '';

      // Если активный трек тот же — не перезагружаем аудио, чтобы не ронять воспроизведение.
      const shouldReload = !!desiredTrack?.path && (!preserveActiveTrack || !currentSrc || currentSrc !== desiredSrc);
      if (shouldReload) {
        loadTrack(activeTrackIndex, { autoplay: false, persist: false });
      }
    } finally {
      isRefreshing = false;
    }
  }

  // Controls.
  els.playPauseBtn.addEventListener('click', async () => {
    if (!tracks.length) return;
    if (!audio.src && tracks[activeTrackIndex]?.path) loadTrack(activeTrackIndex, { persist: false });
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {}
    setPlayUi();
  });

  els.prevBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    const nextIndex = activeTrackIndex - 1 < 0 ? tracks.length - 1 : activeTrackIndex - 1;
    loadTrack(nextIndex, { autoplay: true });
    setPlayUi();
  });

  els.nextBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    const nextIndex = activeTrackIndex + 1 >= tracks.length ? 0 : activeTrackIndex + 1;
    loadTrack(nextIndex, { autoplay: true });
    setPlayUi();
  });

  els.volumeSlider.addEventListener('input', (e) => {
    const v = clamp(e?.target?.value, 0, 100);
    audio.volume = v / 100;
  });
  els.volumeSlider.addEventListener('change', (e) => {
    const v = clamp(e?.target?.value, 0, 100);
    volume = v / 100;
    void window.api?.musicSetVolume?.(volume).catch(() => {});
  });

  els.progressBar.addEventListener('input', (e) => {
    isSeeking = true;
    const v = e?.target?.value;
    els.currentTime.textContent = formatTime((Number(v) / 100) * (audio.duration || 0));
  });
  els.progressBar.addEventListener('change', (e) => {
    if (!isSeeking) return;
    isSeeking = false;
    seekToPercent(e?.target?.value);
  });

  audio.addEventListener('loadedmetadata', () => {
    els.totalTime.textContent = formatTime(audio.duration);
    setPlayUi();
  });

  audio.addEventListener('timeupdate', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (isSeeking) return;
    const pct = clamp((audio.currentTime / audio.duration) * 100, 0, 100);
    els.progressBar.value = String(Math.round(pct));
    els.currentTime.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('play', () => {
    setPlayUi();
    renderTracks();
  });
  audio.addEventListener('pause', () => {
    setPlayUi();
    renderTracks();
  });

  audio.addEventListener('ended', () => {
    if (!tracks.length) return;
    const nextIndex = activeTrackIndex + 1 >= tracks.length ? 0 : activeTrackIndex + 1;
    loadTrack(nextIndex, { autoplay: true });
  });

  // Scan + playlists.
  els.scanMusicBtn?.addEventListener('click', async () => {
    try {
      els.scanMusicBtn.disabled = true;
      els.scanMusicBtn.textContent = '⏳ Открываю сканер...';
      if (window.api?.openMusicScanner) await window.api.openMusicScanner().catch(() => {});
    } finally {
      els.scanMusicBtn.disabled = false;
      els.scanMusicBtn.textContent = '📁 Сканировать';
    }
  });

  els.playlistSelect?.addEventListener('change', async () => {
    try {
      const id = els.playlistSelect?.value;
      if (!id) return;
      await window.api?.playlistSetActive?.(id);
      await refreshAll();
    } catch {}
  });

  els.newPlaylistBtn?.addEventListener('click', async () => {
    try {
      const name = prompt('Название плейлиста:');
      if (!name) return;
      await window.api?.playlistCreate?.(name);
      await refreshAll();
    } catch {}
  });

  els.deletePlaylistBtn?.addEventListener('click', async () => {
    try {
      if (!activePlaylistId) return;
      const ok = confirm('Удалить текущий плейлист?');
      if (!ok) return;
      await window.api?.playlistDelete?.(activePlaylistId);
      await refreshAll();
    } catch {}
  });

  els.addTrackBtn?.addEventListener('click', async () => {
    try {
      if (!activePlaylistId) return;

      if (!discoveredTracks.length && window.api?.musicScan) {
        els.addTrackBtn.disabled = true;
        const scanned = await window.api.musicScan().catch(() => []);
        discoveredTracks = Array.isArray(scanned) ? scanned : [];
      }
      const candidates = discoveredTracks.filter((t) => !tracks.some((x) => x?.path === t?.path));
      const picked = promptPickTrack(candidates, { previewLimit: 50 });
      if (!picked) return;
      await window.api?.playlistAddTrack?.(activePlaylistId, picked);
      await refreshAll({ preserveActiveTrack: true });
    } catch {}
    finally {
      try {
        els.addTrackBtn.disabled = false;
      } catch {}
    }
  });

  // Initial load.
  void (async () => {
    await refreshDiscoveredTracks({ autoScan: true });
    await refreshAll();
  })();

  // Обновления из других окон (например, сканер добавил треки).
  window.api?.onMusicStateChanged?.(() => {
    void refreshAll({ preserveActiveTrack: true });
  });
}

