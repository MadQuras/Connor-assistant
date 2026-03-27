function fileUrl(p) {
  const s = String(p || '');
  if (!s) return '';
  const n = s.replace(/\\/g, '/');
  if (n.startsWith('file://')) return n;
  if (/^[a-zA-Z]:\//.test(n)) return `file:///${n}`;
  return `file://${n}`;
}

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const PRESETS = {
  normal: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [5, 5, 4, 3, 1, 0, -1, -2, -2, -2],
  treble: [-2, -2, -1, 0, 0, 2, 3, 4, 5, 5],
  classic: [3, 2, 1, 0, 0, 0, 1, 2, 3, 4],
  rock: [4, 3, 2, 1, -1, -1, 1, 2, 3, 4],
  electronic: [4, 3, 1, 0, -1, 1, 3, 4, 3, 2],
};

const el = {
  navBtns: Array.from(document.querySelectorAll('.nav-btn')),
  tabs: Array.from(document.querySelectorAll('.tab-content')),
  playlistSelect: document.getElementById('playlistSelect'),
  btnNewPlaylist: document.getElementById('btnNewPlaylist'),
  btnRenamePlaylist: document.getElementById('btnRenamePlaylist'),
  btnDeletePlaylist: document.getElementById('btnDeletePlaylist'),
  btnAddLocalTrack: document.getElementById('btnAddLocalTrack'),
  btnScan: document.getElementById('btnScan'),
  playlistTracks: document.getElementById('playlistTracks'),
  favoritesTracks: document.getElementById('favoritesTracks'),
  btnFavoritesToPlaylist: document.getElementById('btnFavoritesToPlaylist'),
  searchInput: document.getElementById('searchInput'),
  btnSearch: document.getElementById('btnSearch'),
  searchResults: document.getElementById('searchResults'),
  newTracks: document.getElementById('newTracks'),
  btnRefreshNew: document.getElementById('btnRefreshNew'),
  accountName: document.getElementById('accountName'),
  accountPlaylists: document.getElementById('accountPlaylists'),
  accountFavorites: document.getElementById('accountFavorites'),
  nowCover: document.getElementById('nowCover'),
  nowTitle: document.getElementById('nowTitle'),
  nowArtist: document.getElementById('nowArtist'),
  btnPrev: document.getElementById('btnPrev'),
  btnPlay: document.getElementById('btnPlay'),
  btnNext: document.getElementById('btnNext'),
  progress: document.getElementById('progress'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  volume: document.getElementById('volume'),
  btnEq: document.getElementById('btnEq'),
  eqModal: document.getElementById('eqModal'),
  btnEqClose: document.getElementById('btnEqClose'),
  btnEqReset: document.getElementById('btnEqReset'),
  eqBands: document.getElementById('eqBands'),
  presetBtns: Array.from(document.querySelectorAll('.preset')),
};

const audio = new Audio();
audio.preload = 'metadata';
let ctx = null;
let srcNode = null;
let filterChain = [];
let eqValues = EQ_FREQUENCIES.map(() => 0);
let state = { playlists: [], tracks: [], favorites: [], activePlaylistId: null, activeTrackIndex: 0, volume: 0.7, releases: { items: [] }, account: { userName: 'Connor User' } };
let playingQueue = [];
let playingIndex = -1;
let currentTrack = null;

function fmtTime(sec) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function ensureAudioGraph() {
  if (ctx) return;
  ctx = new AudioContext();
  srcNode = ctx.createMediaElementSource(audio);
  let prev = srcNode;
  filterChain = EQ_FREQUENCIES.map((freq) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.0;
    filter.gain.value = 0;
    prev.connect(filter);
    prev = filter;
    return filter;
  });
  prev.connect(ctx.destination);
}

function applyEq() {
  for (let i = 0; i < filterChain.length; i++) {
    filterChain[i].gain.value = eqValues[i] || 0;
  }
}

function renderEq() {
  el.eqBands.innerHTML = '';
  EQ_FREQUENCIES.forEach((f, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'eq-band';
    const label = document.createElement('small');
    label.textContent = f >= 1000 ? `${f / 1000}k` : `${f}`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '-12';
    input.max = '12';
    input.step = '1';
    input.value = String(eqValues[i] || 0);
    input.addEventListener('input', () => {
      eqValues[i] = Number(input.value || 0);
      applyEq();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    el.eqBands.appendChild(wrap);
  });
}

function setActiveTab(tab) {
  el.navBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  el.tabs.forEach((t) => t.classList.toggle('active', t.id === `${tab}-tab`));
}

function isFavorite(track) {
  const key = String(track?.id || track?.path || track?.url || '');
  return state.favorites.some((x) => String(x?.id || x?.path || x?.url || '') === key);
}

function buildTrackRow(track, onPlay) {
  const row = document.createElement('div');
  row.className = 'track-row';
  const img = document.createElement('img');
  img.src = track?.thumbnail || '';
  img.alt = '';
  const text = document.createElement('div');
  text.innerHTML = `<div>${track?.title || 'Track'}</div><small>${track?.artist || ''}</small>`;
  const actions = document.createElement('div');
  actions.className = 'track-actions';
  const play = document.createElement('button');
  play.textContent = '▶';
  play.addEventListener('click', onPlay);
  const fav = document.createElement('button');
  fav.textContent = isFavorite(track) ? '❤️' : '🤍';
  fav.addEventListener('click', async () => {
    await window.api?.musicFavoritesToggle?.({ track });
    await refreshState();
  });
  const add = document.createElement('button');
  add.textContent = '+';
  add.title = 'Добавить в плейлист';
  add.addEventListener('click', async () => {
    const selected = prompt('Название плейлиста:');
    if (!selected) return;
    await window.api?.playlistAddTrackByName?.({ playlistName: selected, track });
    await refreshState();
  });
  actions.append(play, fav, add);
  row.append(img, text, actions);
  return row;
}

function renderPlaylists() {
  el.playlistSelect.innerHTML = '';
  (state.playlists || []).forEach((p) => {
    const o = document.createElement('option');
    o.value = String(p.id);
    o.textContent = p.name || p.id;
    el.playlistSelect.appendChild(o);
  });
  el.playlistSelect.value = String(state.activePlaylistId || '');
}

function renderPlaylistTracks() {
  el.playlistTracks.innerHTML = '';
  const tracks = state.tracks || [];
  tracks.forEach((track, idx) => {
    el.playlistTracks.appendChild(buildTrackRow(track, () => {
      playTrack(track, tracks, idx);
      window.api?.musicSetActiveTrack?.(idx);
    }));
  });
}

function renderFavorites() {
  el.favoritesTracks.innerHTML = '';
  (state.favorites || []).forEach((track, idx) => {
    el.favoritesTracks.appendChild(buildTrackRow(track, () => playTrack(track, state.favorites, idx)));
  });
}

function renderReleases() {
  el.newTracks.innerHTML = '';
  const items = state.releases?.items || [];
  items.forEach((track, idx) => {
    el.newTracks.appendChild(buildTrackRow(track, () => playTrack(track, items, idx)));
  });
}

function renderAccount() {
  el.accountName.textContent = state.account?.userName || 'Connor User';
  el.accountPlaylists.textContent = String((state.playlists || []).length);
  el.accountFavorites.textContent = String((state.favorites || []).length);
}

async function refreshState() {
  const st = await window.api?.musicGetState?.();
  if (!st) return;
  state = st;
  el.volume.value = String(Math.round((Number(state.volume || 0.7)) * 100));
  audio.volume = Number(state.volume || 0.7);
  renderPlaylists();
  renderPlaylistTracks();
  renderFavorites();
  renderReleases();
  renderAccount();
}

async function searchTracks() {
  const query = String(el.searchInput.value || '').trim();
  if (!query) return;
  const resp = await window.api?.musicSearch?.(query, 20);
  const items = Array.isArray(resp?.items) ? resp.items : [];
  el.searchResults.innerHTML = '';
  items.forEach((track, idx) => {
    el.searchResults.appendChild(buildTrackRow(track, () => playTrack(track, items, idx)));
  });
}

async function refreshReleases(force = false) {
  const resp = await window.api?.musicGetReleases?.({ force });
  if (resp?.ok) {
    state.releases = { ts: resp.ts || Date.now(), items: resp.items || [] };
    renderReleases();
  }
}

function updateNowPlaying(track) {
  currentTrack = track || null;
  el.nowTitle.textContent = track?.title || '—';
  el.nowArtist.textContent = track?.artist || '';
  el.nowCover.src = track?.thumbnail || '';
}

function setPlayUi(playing) {
  el.btnPlay.textContent = playing ? '⏸' : '▶';
}

function trackToSrc(track) {
  if (track?.url) return track.url;
  if (track?.path) return fileUrl(track.path);
  return '';
}

async function playTrack(track, queue = [], idx = 0) {
  const src = trackToSrc(track);
  if (!src) return;
  ensureAudioGraph();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
  playingQueue = Array.isArray(queue) ? queue.slice() : [track];
  playingIndex = Number(idx) >= 0 ? Number(idx) : 0;
  updateNowPlaying(track);
  audio.src = src;
  audio.play().catch(() => {});
  setPlayUi(true);
}

function playNext() {
  if (!playingQueue.length) return;
  const next = (playingIndex + 1) % playingQueue.length;
  playTrack(playingQueue[next], playingQueue, next);
}

function playPrev() {
  if (!playingQueue.length) return;
  const prev = (playingIndex - 1 + playingQueue.length) % playingQueue.length;
  playTrack(playingQueue[prev], playingQueue, prev);
}

audio.addEventListener('loadedmetadata', () => {
  el.totalTime.textContent = fmtTime(audio.duration || 0);
});

audio.addEventListener('timeupdate', () => {
  const dur = audio.duration || 0;
  if (dur > 0) {
    const percent = Math.max(0, Math.min(100, (audio.currentTime / dur) * 100));
    el.progress.value = String(percent);
  }
  el.currentTime.textContent = fmtTime(audio.currentTime || 0);
});

audio.addEventListener('ended', () => {
  // If playlist ended, fallback to favorites if available.
  if (playingQueue.length && playingIndex === playingQueue.length - 1 && (state.favorites || []).length) {
    playTrack(state.favorites[0], state.favorites, 0);
    return;
  }
  playNext();
});

el.navBtns.forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab || 'playlists'));
});

el.btnSearch.addEventListener('click', () => { void searchTracks(); });
el.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void searchTracks();
});

el.btnScan.addEventListener('click', async () => {
  await window.api?.musicScan?.();
  await refreshState();
});
el.btnAddLocalTrack.addEventListener('click', async () => {
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
el.btnRenamePlaylist.addEventListener('click', async () => {
  const id = el.playlistSelect.value;
  if (!id) return;
  const name = prompt('Новое имя плейлиста:');
  if (!name) return;
  await window.api?.playlistRename?.({ id, name });
  await refreshState();
});
el.btnDeletePlaylist.addEventListener('click', async () => {
  if (!el.playlistSelect.value) return;
  await window.api?.playlistDelete?.(el.playlistSelect.value);
  await refreshState();
});

el.btnFavoritesToPlaylist.addEventListener('click', async () => {
  const name = prompt('Имя нового плейлиста из любимых:');
  if (!name) return;
  const pl = await window.api?.playlistCreate?.(name);
  for (const track of (state.favorites || [])) {
    await window.api?.playlistAddTrack?.(pl.id, track);
  }
  await refreshState();
});

el.btnPrev.addEventListener('click', playPrev);
el.btnPlay.addEventListener('click', () => {
  if (!audio.src) {
    const tracks = state.tracks || [];
    if (tracks.length) playTrack(tracks[0], tracks, 0);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
  setPlayUi(!audio.paused);
});
el.btnNext.addEventListener('click', playNext);
el.progress.addEventListener('input', () => {
  const dur = audio.duration || 0;
  if (dur <= 0) return;
  audio.currentTime = (Number(el.progress.value || 0) / 100) * dur;
});
el.volume.addEventListener('input', async () => {
  const v = Math.max(0, Math.min(1, Number(el.volume.value || 70) / 100));
  audio.volume = v;
  await window.api?.musicSetVolume?.(v);
});

el.btnEq.addEventListener('click', () => el.eqModal.classList.remove('hidden'));
el.btnEqClose.addEventListener('click', () => el.eqModal.classList.add('hidden'));
el.btnEqReset.addEventListener('click', () => {
  eqValues = PRESETS.normal.slice();
  renderEq();
  applyEq();
});
el.presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.preset;
    if (!k || !PRESETS[k]) return;
    eqValues = PRESETS[k].slice();
    renderEq();
    applyEq();
  });
});

window.api?.onMusicPlayUrl?.(({ url }) => {
  if (!url) return;
  playTrack({ url, title: 'YouTube Track', artist: 'YouTube' }, [{ url }], 0);
});

window.api?.onMusicVoiceCommand?.(async (payload) => {
  const action = String(payload?.action || '');
  if (action === 'next') playNext();
  if (action === 'prev') playPrev();
  if (action === 'pause') audio.pause();
  if (action === 'resume' && audio.src) audio.play().catch(() => {});
  if (action === 'playByQuery') {
    const q = String(payload?.query || '').toLowerCase().trim();
    const idx = (state.tracks || []).findIndex((t) => String(t.title || '').toLowerCase().includes(q));
    if (idx >= 0) playTrack(state.tracks[idx], state.tracks, idx);
  }
  setPlayUi(!audio.paused);
});

window.api?.onMusicStateChanged?.(() => {
  void refreshState();
});

el.btnRefreshNew.addEventListener('click', () => {
  void refreshReleases(true);
});

renderEq();
ensureAudioGraph();
applyEq();
refreshState().then(() => refreshReleases(false));
