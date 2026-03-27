function fileUrl(p) {
  const s = String(p || '');
  if (!s) return '';
  const n = s.replace(/\\/g, '/');
  if (n.startsWith('file://')) return n;
  if (/^[a-zA-Z]:\//.test(n)) return `file:///${n}`;
  return `file://${n}`;
}

const el = {
  searchInput: document.getElementById('searchInput'),
  btnScan: document.getElementById('btnScan'),
  btnAdd: document.getElementById('btnAdd'),
  nowTitle: document.getElementById('nowTitle'),
  progress: document.getElementById('progress'),
  btnPrev: document.getElementById('btnPrev'),
  btnPlay: document.getElementById('btnPlay'),
  btnNext: document.getElementById('btnNext'),
  playlistSelect: document.getElementById('playlistSelect'),
  btnNewPlaylist: document.getElementById('btnNewPlaylist'),
  btnDeletePlaylist: document.getElementById('btnDeletePlaylist'),
  trackList: document.getElementById('trackList'),
  queueList: document.getElementById('queueList'),
};

let state = { playlists: [], activePlaylistId: null, tracks: [], activeTrackIndex: 0, volume: 0.7 };
let filtered = [];
let howl = null;

function stopCurrent() {
  try {
    howl?.stop?.();
    howl?.unload?.();
  } catch {}
  howl = null;
}

function setPlayUi(isPlaying) {
  el.btnPlay.textContent = isPlaying ? '⏸' : '▶';
}

async function refreshState() {
  const st = await window.api?.musicGetState?.();
  if (!st) return;
  state = st;
  renderPlaylists();
  applyFilter();
  renderQueue();
}

function renderPlaylists() {
  el.playlistSelect.innerHTML = '';
  for (const p of state.playlists || []) {
    const o = document.createElement('option');
    o.value = String(p.id);
    o.textContent = p.name || p.id;
    el.playlistSelect.appendChild(o);
  }
  el.playlistSelect.value = String(state.activePlaylistId || '');
}

function applyFilter() {
  const q = String(el.searchInput.value || '').toLowerCase().trim();
  const tracks = Array.isArray(state.tracks) ? state.tracks : [];
  filtered = q ? tracks.filter((t) => String(t.title || '').toLowerCase().includes(q)) : tracks.slice();
  renderTracks();
}

function renderTracks() {
  el.trackList.innerHTML = '';
  for (const t of filtered) {
    const i = (state.tracks || []).findIndex((x) => x.path === t.path);
    const row = document.createElement('div');
    row.className = `track ${i === state.activeTrackIndex ? 'active' : ''}`;
    const title = document.createElement('div');
    title.textContent = t.title || 'Track';
    const btn = document.createElement('button');
    btn.textContent = '▶';
    btn.addEventListener('click', () => playIndex(i));
    row.appendChild(title);
    row.appendChild(btn);
    el.trackList.appendChild(row);
  }
}

function renderQueue() {
  el.queueList.innerHTML = '';
  const tracks = state.tracks || [];
  if (!tracks.length) return;
  for (let i = 1; i <= 6; i++) {
    const idx = (state.activeTrackIndex + i) % tracks.length;
    const d = document.createElement('div');
    d.textContent = `${i}. ${tracks[idx]?.title || 'Track'}`;
    el.queueList.appendChild(d);
  }
}

async function playIndex(index) {
  const tracks = state.tracks || [];
  if (!tracks.length || index < 0 || index >= tracks.length) return;
  await window.api?.musicSetActiveTrack?.(index);
  state.activeTrackIndex = index;
  const tr = tracks[index];
  el.nowTitle.textContent = tr?.title || '—';
  stopCurrent();
  howl = new Howl({
    src: [fileUrl(tr.path)],
    html5: true,
    volume: typeof state.volume === 'number' ? state.volume : 0.7,
    onplay: () => setPlayUi(true),
    onpause: () => setPlayUi(false),
    onend: () => nextTrack(),
    onload: () => {
      const dur = howl.duration() || 0;
      if (dur > 0) {
        const loop = () => {
          if (!howl || !howl.playing()) return;
          const p = Math.max(0, Math.min(100, (howl.seek() / dur) * 100));
          el.progress.value = String(Math.round(p));
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    },
  });
  howl.play();
  renderTracks();
  renderQueue();
}

async function nextTrack() {
  const tracks = state.tracks || [];
  if (!tracks.length) return;
  const next = state.activeTrackIndex + 1 >= tracks.length ? 0 : state.activeTrackIndex + 1;
  await playIndex(next);
}

async function prevTrack() {
  const tracks = state.tracks || [];
  if (!tracks.length) return;
  const prev = state.activeTrackIndex - 1 < 0 ? tracks.length - 1 : state.activeTrackIndex - 1;
  await playIndex(prev);
}

function pauseOrResume() {
  if (!howl) {
    playIndex(state.activeTrackIndex || 0);
    return;
  }
  if (howl.playing()) howl.pause();
  else howl.play();
}

el.searchInput.addEventListener('input', applyFilter);
el.btnScan.addEventListener('click', async () => {
  await window.api?.musicScan?.();
  await refreshState();
});
el.btnAdd.addEventListener('click', async () => {
  await window.api?.musicAddTrack?.();
  await refreshState();
});
el.playlistSelect.addEventListener('change', async () => {
  await window.api?.playlistSetActive?.(el.playlistSelect.value);
  await refreshState();
});
el.btnNewPlaylist.addEventListener('click', async () => {
  const name = prompt('Имя плейлиста:');
  if (!name) return;
  await window.api?.playlistCreate?.(name);
  await refreshState();
});
el.btnDeletePlaylist.addEventListener('click', async () => {
  if (!el.playlistSelect.value) return;
  await window.api?.playlistDelete?.(el.playlistSelect.value);
  await refreshState();
});
el.btnPrev.addEventListener('click', prevTrack);
el.btnNext.addEventListener('click', nextTrack);
el.btnPlay.addEventListener('click', pauseOrResume);
el.progress.addEventListener('change', () => {
  if (!howl) return;
  const dur = howl.duration() || 0;
  if (dur <= 0) return;
  howl.seek((Number(el.progress.value || 0) / 100) * dur);
});

window.api?.onMusicStateChanged?.(() => refreshState());

window.api?.onMusicVoiceCommand?.(async (payload) => {
    const action = String(payload?.action || '');
    if (action === 'next') return nextTrack();
    if (action === 'prev') return prevTrack();
    if (action === 'pause') {
      if (howl?.playing()) howl.pause();
      return;
    }
    if (action === 'resume') {
      if (howl && !howl.playing()) howl.play();
      else if (!howl) playIndex(state.activeTrackIndex || 0);
      return;
    }
    if (action === 'playByQuery') {
      const q = String(payload?.query || '').toLowerCase().trim();
      if (!q) return;
      const idx = (state.tracks || []).findIndex((t) => String(t.title || '').toLowerCase().includes(q));
      if (idx >= 0) await playIndex(idx);
    }
  });

refreshState();
