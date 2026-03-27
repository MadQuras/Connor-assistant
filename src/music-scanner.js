const content = document.getElementById('content');
const metaText = document.getElementById('metaText');
const btnClose = document.getElementById('btnClose');

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function dirname(p) {
  const s = normalizePath(p);
  const idx = s.lastIndexOf('/');
  if (idx <= 0) return '';
  return s.slice(0, idx);
}

function basename(p) {
  const s = normalizePath(p);
  const idx = s.lastIndexOf('/');
  if (idx < 0) return s;
  return s.slice(idx + 1);
}

function folderDisplayName(dirPath) {
  if (!dirPath) return 'Корень';
  const parts = dirPath.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'Корень';
}

function renderGroups(groups) {
  content.innerHTML = '';

  const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ru'));
  for (const key of groupKeys) {
    const folder = document.createElement('div');
    folder.className = 'folder';

    const title = document.createElement('div');
    title.className = 'folder-title';
    title.textContent = folderDisplayName(key);
    folder.appendChild(title);

    for (const t of groups[key]) {
      const row = document.createElement('div');
      row.className = 'track-row';

      const left = document.createElement('div');
      left.className = 'track-title';
      left.textContent = t.title || basename(t.path);

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'plus-btn';
      plus.textContent = '+';
      plus.title = 'Добавить в плейлист';
      plus.addEventListener('click', async () => {
        try {
          plus.disabled = true;
          const st = await window.api.musicGetState();
          const playlistId = st?.activePlaylistId;
          if (!playlistId) return;
          const isInPlaylist = Array.isArray(st?.tracks) && st.tracks.some((x) => x?.path === t.path);
          const payloadTrack = { path: t.path, title: t.title || basename(t.path), duration: t.duration || 0 };

          if (isInPlaylist) {
            await window.api.playlistRemoveTrack(playlistId, t.path);
            plus.textContent = '−';
          } else {
            await window.api.playlistAddTrack(playlistId, payloadTrack);
            plus.textContent = '✓';
          }
          setTimeout(() => {
            plus.textContent = '+';
            plus.disabled = false;
          }, 1100);
        } catch {}
        finally {
          try {
            plus.disabled = false;
          } catch {}
        }
      });

      row.appendChild(left);
      row.appendChild(plus);
      folder.appendChild(row);
    }

    content.appendChild(folder);
  }
}

async function loadScan() {
  try {
    btnClose.disabled = true;
    metaText.textContent = 'Сканирование…';
    const tracks = (await window.api.musicScan()) || [];

    if (!Array.isArray(tracks) || !tracks.length) {
      metaText.textContent = 'Ничего не найдено';
      content.innerHTML = '';
      return;
    }

    metaText.textContent = `Найдено MP3: ${tracks.length}`;

    const groups = {};
    for (const t of tracks) {
      const dir = dirname(t.path);
      const key = dir || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
    }

    renderGroups(groups);
  } catch (err) {
    metaText.textContent = 'Ошибка сканирования';
    // eslint-disable-next-line no-console
    console.error(err);
  } finally {
    btnClose.disabled = false;
  }
}

btnClose?.addEventListener('click', () => {
  try {
    window.close();
  } catch {}
  try {
    // Закрываем через main (по возможности).
    window.api?.quitAppInMain?.();
  } catch {}
});

void loadScan();

