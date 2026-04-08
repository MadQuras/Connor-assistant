const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { generatePronunciations } = require('./pronunciation-generator');

class SystemScanner {
  constructor() {
    const userProfile = process.env.USERPROFILE || '';
    this.commonFolders = [
      app.getPath('documents'),
      app.getPath('downloads'),
      app.getPath('desktop'),
      app.getPath('music'),
      app.getPath('pictures'),
      app.getPath('videos'),
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      userProfile ? path.join(userProfile, 'AppData', 'Local') : '',
    ].filter(Boolean);

    this.commonGames = ['steam', 'epic games', 'gog galaxy', 'battle.net', 'ubisoft', 'origin', 'minecraft', 'roblox'];
  }

  async pathExists(targetPath) {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async scanDirectories() {
    const results = { folders: [], games: [], shortcuts: [] };
    const seenGames = new Set();

    for (const folder of this.commonFolders) {
      try {
        if (!(await this.pathExists(folder))) continue;
        results.folders.push({ path: folder, name: path.basename(folder) || folder, isExecutable: false });

        const items = await fs.readdir(folder).catch(() => []);
        for (const item of items) {
          const fullPath = path.join(folder, item);
          const stat = await fs.stat(fullPath).catch(() => null);
          if (!stat?.isDirectory()) continue;
          const lower = item.toLowerCase();
          for (const gameKey of this.commonGames) {
            if (!lower.includes(gameKey)) continue;
            const key = `${item.toLowerCase()}|${fullPath.toLowerCase()}`;
            if (seenGames.has(key)) continue;
            seenGames.add(key);
            results.games.push({ name: item, path: fullPath, launcher: gameKey, isExecutable: false });
          }
        }
      } catch {}
    }

    for (const pf of ['C:\\Program Files', 'C:\\Program Files (x86)']) {
      try {
        const dirs = await fs.readdir(pf).catch(() => []);
        for (const dir of dirs) {
          const exePath = path.join(pf, dir, `${dir}.exe`);
          if (!(await this.pathExists(exePath))) continue;
          const key = `${dir.toLowerCase()}|${exePath.toLowerCase()}`;
          if (seenGames.has(key)) continue;
          seenGames.add(key);
          results.games.push({ name: dir, path: exePath, launcher: 'standalone', isExecutable: true });
        }
      } catch {}
    }

    const knownGames = [
      { name: 'Steam', path: 'C:\\Program Files (x86)\\Steam\\Steam.exe', launcher: 'known', isExecutable: true },
      { name: 'Discord', path: path.join(process.env.LOCALAPPDATA || '', 'Discord', 'Update.exe'), launcher: 'known', isExecutable: true },
      { name: 'Spotify', path: path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'), launcher: 'known', isExecutable: true },
    ];
    for (const g of knownGames) {
      try {
        if (!g.path) continue;
        if (!(await this.pathExists(g.path))) continue;
        const key = `${String(g.name || '').toLowerCase()}|${String(g.path || '').toLowerCase()}`;
        if (seenGames.has(key)) continue;
        seenGames.add(key);
        results.games.push(g);
      } catch {}
    }

    for (const game of results.games) {
      game.pronunciations = generatePronunciations(game.name);
    }
    for (const folder of results.folders) {
      folder.pronunciations = generatePronunciations(folder.name);
    }

    return results;
  }

  async saveToStore(store) {
    const data = await this.scanDirectories();
    store.set('systemScan', {
      folders: data.folders,
      games: data.games,
      shortcuts: data.shortcuts,
      lastScan: Date.now(),
    });
    return data;
  }
}

module.exports = { SystemScanner };
