(function () {
  function fileUrl(p) {
    const s = String(p || '');
    if (!s) return '';
    const n = s.replace(/\\/g, '/');
    if (n.startsWith('file://')) return n;
    if (/^[a-zA-Z]:\//.test(n)) return `file:///${n}`;
    return `file://${n}`;
  }

  const favPaths = (tracks) => {
    const set = new Set();
    (tracks || []).forEach((t) => {
      if (t?.path) set.add(t.path);
    });
    return set;
  };

  class MusicPlayerNew {
    constructor() {
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.currentTrackMeta = null;
      this.seeking = false;

      this.state = {
        playlists: [],
        activePlaylistId: null,
        tracks: [],
        activeTrackIndex: 0,
        volume: 0.7,
        favorites: [],
      };
      this.libraryTracks = [];
      this.favoritePathSet = new Set();

      this._onTimeUpdate = () => this.onAudioTimeUpdate();
      this._onLoadedMeta = () => this.onAudioLoadedMetadata();
      this._onEnded = () => this.onAudioEnded();
      this._onPlay = () => this.setPlayUi(true);
      this._onPause = () => this.setPlayUi(false);
      this._onError = () => {
        if (this.trackArtistSpan) this.trackArtistSpan.textContent = 'Ошибка воспроизведения';
        this.setPlayUi(false);
      };

      this.audio.addEventListener('timeupdate', this._onTimeUpdate);
      this.audio.addEventListener('loadedmetadata', this._onLoadedMeta);
      this.audio.addEventListener('ended', this._onEnded);
      this.audio.addEventListener('play', this._onPlay);
      this.audio.addEventListener('pause', this._onPause);
      this.audio.addEventListener('error', this._onError);

      this.initElements();
      this.bindEvents();
      this.loadData();
    }

    initElements() {
      this.playPauseBtn = document.getElementById('playPauseBtn');
      this.prevBtn = document.getElementById('prevBtn');
      this.nextBtn = document.getElementById('nextBtn');
      this.progressBar = document.getElementById('progressBar');
      this.volumeSlider = document.getElementById('volumeSlider');
      this.currentTimeSpan = document.getElementById('currentTime');
      this.totalTimeSpan = document.getElementById('totalTime');
      this.trackTitleSpan = document.getElementById('trackTitle');
      this.trackArtistSpan = document.getElementById('trackArtist');
      this.artworkEl = document.getElementById('artwork');

      this.playlistsGrid = document.getElementById('playlistsGrid');
      this.favoritesList = document.getElementById('favoritesList');
      this.searchResults = document.getElementById('searchResults');
      this.libraryList = document.getElementById('libraryList');
    }

    bindEvents() {
      this.playPauseBtn.onclick = () => this.togglePlayPause();
      this.prevBtn.onclick = () => void this.prev();
      this.nextBtn.onclick = () => void this.next();

      this.progressBar.addEventListener('pointerdown', () => {
        this.seeking = true;
      });
      this.progressBar.addEventListener('pointerup', () => {
        this.seeking = false;
      });
      this.progressBar.addEventListener('input', (e) => this.seek(e.target.value));

      this.volumeSlider.oninput = (e) => this.setVolume(e.target.value);

      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.onclick = () => this.switchView(btn.dataset.view);
      });

      document.getElementById('searchBtn').onclick = () => this.search();
      document.getElementById('searchInput').onkeypress = (e) => {
        if (e.key === 'Enter') this.search();
      };
      document.getElementById('scanBtn').onclick = () => this.scanLibrary();
      document.getElementById('createPlaylistBtn').onclick = () => this.createPlaylist();

      this.playlistsGrid?.addEventListener('click', (e) => {
        const card = e.target.closest('.playlist-card');
        if (!card?.dataset?.id) return;
        void this.selectPlaylist(card.dataset.id);
      });

      const favList = this.favoritesList;
      const searchList = this.searchResults;
      const libList = this.libraryList;
      [favList, searchList, libList].forEach((list) => {
        list?.addEventListener('click', (e) => {
          const playBtn = e.target.closest('.play-track');
          const favBtn = e.target.closest('.fav-track');
          const row = e.target.closest('.track-item');
          if (!row?.dataset?.path) return;
          if (favBtn) {
            e.stopPropagation();
            void this.toggleFavorite(row.dataset.path);
            return;
          }
          if (playBtn) {
            void this.playTrackByPath(row.dataset.path);
          }
        });
      });

      window.api?.onMusicStateChanged?.(() => this.loadData());
      window.api?.onMusicVoiceCommand?.((payload) => this.handleVoice(payload));
    }

    onAudioTimeUpdate() {
      if (this.seeking) return;
      const dur = this.audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const p = Math.max(0, Math.min(100, (this.audio.currentTime / dur) * 100));
      if (this.progressBar) this.progressBar.value = String(Math.round(p));
      if (this.currentTimeSpan) this.currentTimeSpan.textContent = this.formatTime(this.audio.currentTime);
    }

    onAudioLoadedMetadata() {
      if (this.totalTimeSpan) {
        this.totalTimeSpan.textContent = this.formatTime(this.audio.duration || 0);
      }
    }

    onAudioEnded() {
      this.setPlayUi(false);
      setTimeout(() => void this.next(), 0);
    }


    updateTrackInfo(track) {
      if (this.trackTitleSpan) this.trackTitleSpan.textContent = track?.title || 'Не выбрано';
      if (this.trackArtistSpan) this.trackArtistSpan.textContent = track?.artist || 'Локальный MP3';
      if (this.artworkEl) {
        if (track?.thumbnail) {
          const u = String(track.thumbnail).replace(/[<>"']/g, '');
          this.artworkEl.innerHTML = u
            ? `<img src="${u}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
            : '<i class="fas fa-music" aria-hidden="true"></i>';
        } else {
          this.artworkEl.innerHTML = '<i class="fas fa-music" aria-hidden="true"></i>';
        }
      }
    }

    async loadData() {
      const st = await window.api?.musicGetState?.();
      if (!st) return;
      this.state = st;
      this.libraryTracks = (await window.api?.musicGetTracks?.()) || [];
      this.favoritePathSet = favPaths(st.favorites);

      const vol = typeof st.volume === 'number' ? st.volume : 0.7;
      this.state.volume = vol;
      if (this.volumeSlider) this.volumeSlider.value = String(Math.round(vol * 100));
      this.audio.volume = vol;

      this.renderPlaylists();
      this.renderFavorites();
      this.renderLibrary();
      this.highlightActivePlaylist();
    }

    highlightActivePlaylist() {
      const id = String(this.state.activePlaylistId || '');
      document.querySelectorAll('.playlist-card').forEach((c) => {
        c.classList.toggle('active-pl', c.dataset.id === id);
      });
    }

    renderPlaylists() {
      if (!this.playlistsGrid) return;
      const playlists = this.state.playlists || [];
      this.playlistsGrid.innerHTML = playlists
        .map(
          (pl) => `
        <button type="button" class="playlist-card" data-id="${escapeAttr(pl.id)}">
          ${String(pl.id) === 'demo_playlist'
            ? '<i class="fas fa-star" aria-hidden="true" style="color: #2dd4bf;"></i>'
            : '<i class="fas fa-compact-disc" aria-hidden="true"></i>'}
          <h3>${escapeHtml(pl.name || pl.id)}</h3>
          <p>${(pl.tracks || []).length} треков</p>
        </button>`,
        )
        .join('');
      this.highlightActivePlaylist();
    }

    renderFavorites() {
      if (!this.favoritesList) return;
      const tracks = this.state.favorites || [];
      if (!tracks.length) {
        this.favoritesList.innerHTML = '<div class="loading-inline">Нет избранных — нажмите ♥ у трека.</div>';
        return;
      }
      this.favoritesList.innerHTML = tracks.map((t) => this.renderTrackRow(t, true)).join('');
    }

    renderLibrary() {
      if (!this.libraryList) return;
      const tracks = this.libraryTracks || [];
      if (!tracks.length) {
        this.libraryList.innerHTML =
          '<div class="loading-inline">Библиотека пуста. Нажмите «Сканировать» или добавьте треки в плейлист из главного окна.</div>';
        return;
      }
      this.favoritePathSet = favPaths(this.state.favorites);
      this.libraryList.innerHTML = tracks.map((t) => this.renderTrackRow(t, this.favoritePathSet.has(t.path))).join('');
    }

    renderTrackRow(track, isFav) {
      const path = track.path || '';
      const title = escapeHtml(track.title || 'Трек');
      const artist = escapeHtml(track.artist || 'Локальный MP3');
      return `
        <div class="track-item" data-path="${escapeAttr(path)}">
          <div class="track-col">
            <div class="track-title">${title}</div>
            <div class="track-artist">${artist}</div>
          </div>
          <div class="track-actions">
            <button type="button" class="play-track" title="Играть"><i class="fas fa-play" aria-hidden="true"></i></button>
            <button type="button" class="fav-track ${isFav ? 'fav-on' : ''}" title="Избранное"><i class="fas fa-heart" aria-hidden="true"></i></button>
          </div>
        </div>`;
    }

    async selectPlaylist(playlistId) {
      await window.api?.playlistSetActive?.(playlistId);
      await this.loadData();
      this.switchView('library');
    }

    async toggleFavorite(trackPath) {
      await window.api?.musicToggleFavorite?.(trackPath);
      await this.loadData();
    }

    async playTrackByPath(trackPath) {
      const tracks = this.state.tracks || [];
      const idx = tracks.findIndex((t) => t.path === trackPath);
      if (idx >= 0) {
        await this.playIndex(idx);
        return;
      }
      const libIdx = this.libraryTracks.findIndex((t) => t.path === trackPath);
      if (libIdx < 0) return;
      const t = this.libraryTracks[libIdx];
      const plId = this.state.activePlaylistId;
      await window.api?.playlistAddTrack?.(plId, t);
      await this.loadData();
      const newIdx = (this.state.tracks || []).findIndex((x) => x.path === trackPath);
      if (newIdx >= 0) await this.playIndex(newIdx);
    }

    /**
     * Загрузка и воспроизведение трека на одном глобальном Audio (без Howl).
     */
    async playTrack(track) {
      if (!track?.path) return;
      this.currentTrackMeta = track;
      this.updateTrackInfo(track);

      const url = fileUrl(track.path);
      const vol = typeof this.state.volume === 'number' ? this.state.volume : 0.7;
      this.audio.volume = vol;

      this.audio.pause();
      this.audio.src = url;
      this.audio.load();

      try {
        await this.audio.play();
      } catch (err) {
        if (this.trackArtistSpan) this.trackArtistSpan.textContent = 'Не удалось воспроизвести файл';
        this.setPlayUi(false);
        return;
      }

      this.setPlayUi(true);
      this.renderFavorites();
      this.renderLibrary();
    }

    async playIndex(index) {
      const tracks = this.state.tracks || [];
      if (!tracks.length || index < 0 || index >= tracks.length) return;
      const resp = await window.api?.musicSetActiveTrack?.(index);
      const resolved = Number.isFinite(Number(resp?.activeTrackIndex))
        ? Number(resp.activeTrackIndex)
        : index;
      const idx = Math.max(0, Math.min(resolved, tracks.length - 1));
      this.state.activeTrackIndex = idx;
      const tr = tracks[idx];
      await this.playTrack(tr);
    }

    setPlayUi(playing) {
      const icon = this.playPauseBtn?.querySelector('i');
      if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
    }

    togglePlayPause() {
      if (!this.currentTrackMeta) {
        void this.playIndex(this.state.activeTrackIndex || 0);
        return;
      }
      if (this.audio.paused) {
        void this.audio.play().catch(() => {});
      } else {
        this.audio.pause();
      }
    }

    async next() {
      const tracks = this.state.tracks || [];
      if (!tracks.length) return;
      const nextIdx = this.state.activeTrackIndex + 1 >= tracks.length ? 0 : this.state.activeTrackIndex + 1;
      await this.playIndex(nextIdx);
    }

    async prev() {
      const tracks = this.state.tracks || [];
      if (!tracks.length) return;
      const prevIdx = this.state.activeTrackIndex - 1 < 0 ? tracks.length - 1 : this.state.activeTrackIndex - 1;
      await this.playIndex(prevIdx);
    }

    seek(value) {
      const dur = this.audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      this.audio.currentTime = (Number(value) / 100) * dur;
      if (this.currentTimeSpan) this.currentTimeSpan.textContent = this.formatTime(this.audio.currentTime);
    }

    setVolume(value) {
      const v = Math.max(0, Math.min(1, Number(value) / 100));
      this.state.volume = v;
      this.audio.volume = v;
      void window.api?.musicSetVolume?.(v);
    }

    formatTime(seconds) {
      const s = Number(seconds) || 0;
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    switchView(view) {
      document.querySelectorAll('.view-pane').forEach((pane) => pane.classList.remove('active'));
      const pane = document.getElementById(`${view}-view`);
      if (pane) pane.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });
    }

    async search() {
      const input = document.getElementById('searchInput');
      const q = String(input?.value || '').trim();
      if (!q || !this.searchResults) return;
      this.searchResults.innerHTML = '<div class="loading-inline">Поиск…</div>';
      const results = (await window.api?.musicSearch?.(q, 40)) || [];
      this.favoritePathSet = favPaths(this.state.favorites);
      if (!results.length) {
        this.searchResults.innerHTML = '<div class="loading-inline">Ничего не найдено.</div>';
        return;
      }
      this.searchResults.innerHTML = results
        .map((t) => this.renderTrackRow(t, this.favoritePathSet.has(t.path)))
        .join('');
    }

    async scanLibrary() {
      if (!this.libraryList) return;
      this.libraryList.innerHTML = '<div class="loading-inline">Сканирование…</div>';
      await window.api?.musicScan?.();
      await this.loadData();
    }

    async createPlaylist() {
      const name = window.prompt('Название плейлиста:');
      if (!name) return;
      await window.api?.playlistCreate?.(name);
      await this.loadData();
    }

    async handleVoice(payload) {
      const action = String(payload?.action || '');
      if (action === 'next') return this.next();
      if (action === 'prev') return this.prev();
      if (action === 'pause') {
        if (!this.audio.paused) this.audio.pause();
        return;
      }
      if (action === 'resume') {
        if (this.currentTrackMeta && this.audio.paused) {
          void this.audio.play().catch(() => {});
        } else {
          void this.playIndex(this.state.activeTrackIndex || 0);
        }
        return;
      }
      if (action === 'playByQuery' && payload.query) {
        const q = String(payload.query).toLowerCase();
        const tracks = this.state.tracks || [];
        const idx = tracks.findIndex((t) => String(t.title || '').toLowerCase().includes(q));
        if (idx >= 0) void this.playIndex(idx);
      }
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayerNew();
  });
})();
