function formatGB(value) {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  // Стараемся сделать строку читабельной: без лишних нулей.
  const decimals = value >= 10 ? 0 : 2;
  return `${value.toFixed(decimals)} GB`;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

// Подключает подписку на “system:update” и отдаёт готовые строки в UI.
export function startSystemMonitoring({ onUiUpdate } = {}) {
  const handler = (snapshot) => {
    const cpuText = typeof snapshot?.cpuPercent === 'number' ? `${Math.round(snapshot.cpuPercent)}%` : '—';
    const cpuPercent = typeof snapshot?.cpuPercent === 'number' && isFinite(snapshot.cpuPercent) ? snapshot.cpuPercent : null;

    const ramTotal = snapshot?.ram?.totalGB;
    const ramUsed = snapshot?.ram?.usedGB;
    const ramFree = snapshot?.ram?.freeGB;
    const ramUsedPercent =
      typeof ramUsed === 'number' && typeof ramTotal === 'number' && ramTotal > 0 ? (ramUsed / ramTotal) * 100 : null;

    const ramValue =
      typeof ramUsed === 'number' && typeof ramTotal === 'number'
        ? `${formatGB(ramUsed)} / ${formatGB(ramTotal)}`
        : '—';

    const ramSub = typeof ramFree === 'number' ? `Свободно: ${formatGB(ramFree)}` : '—';

    const diskTotal = snapshot?.disk?.totalGB;
    const diskFree = snapshot?.disk?.freeGB;
    const diskUsedPercent =
      typeof snapshot?.disk?.usedGB === 'number' && typeof diskTotal === 'number' && diskTotal > 0
        ? (snapshot.disk.usedGB / diskTotal) * 100
        : typeof diskFree === 'number' && typeof diskTotal === 'number' && diskTotal > 0
          ? ((diskTotal - diskFree) / diskTotal) * 100
          : null;

    const diskValue =
      typeof diskFree === 'number' && typeof diskTotal === 'number' ? `${formatGB(diskFree)} / ${formatGB(diskTotal)}` : '—';
    const diskSub = typeof diskFree === 'number' ? `Свободно: ${formatGB(diskFree)}` : '—';

    const activeTitle = snapshot?.activeWindow?.title || '—';
    const activeOwner = snapshot?.activeWindow?.owner || '—';
    const updatedAt = formatTime(snapshot?.timestamp);

    if (onUiUpdate) {
      onUiUpdate({
        cpuText,
        cpuPercent,
        ramValue,
        ramSub,
        ramUsedPercent,
        diskValue,
        diskSub,
        diskUsedPercent,
        activeTitle,
        activeOwner,
        updatedAt,
      });
    }
  };

  // Подписка на события из preload.
  if (window.api?.onSystemUpdate) {
    window.api.onSystemUpdate(handler);
  }

  // Запрашиваем “снимок” сразу.
  if (window.api?.refreshSystem) {
    window.api.refreshSystem().catch(() => {});
  }
}

