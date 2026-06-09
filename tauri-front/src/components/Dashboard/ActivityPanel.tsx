import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type SystemStats = {
  cpu: number;
  ram_pct: number;
  ram_used_gb: number;
  ram_total_gb: number;
};

type LogEntry = { ts?: string; type?: string; text?: string };

function Gauge({ label, value, max, unit, color }: {
  label: string; value: number; max: number; unit: string; color: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="activity-gauge">
      <div className="activity-gauge-hd">
        <span>{label}</span>
        <span style={{ color }}>{value}{unit}</span>
      </div>
      <div className="activity-bar-track">
        <div
          className="activity-bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

export function ActivityPanel() {
  const [stats, setStats] = useState<SystemStats>({ cpu: 0, ram_pct: 0, ram_used_gb: 0, ram_total_gb: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await invoke<SystemStats>('get_system_stats');
        setStats(s);
      } catch { /* ignore */ }
      try {
        const l = await invoke<LogEntry[]>('read_logs');
        setLogs(l ?? []);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, []);

  const routeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of logs) {
      if (e.type !== 'ROUTE') continue;
      const m = (e.text ?? '').match(/^(\w+)/);
      const cat = m?.[1] ?? 'OTHER';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [logs]);

  const maxRoute = routeCounts[0]?.[1] ?? 1;

  return (
    <div className="glass-card activity-card">
      <div className="glass-hd">
        <div className="glass-title">АКТИВНОСТЬ</div>
        <div className="glass-badge">LIVE</div>
      </div>

      <Gauge label="CPU" value={stats.cpu} max={100} unit="%" color="var(--cyan)" />
      <Gauge label="RAM" value={stats.ram_pct} max={100} unit="%" color="#cba6f7" />
      <div className="glass-muted" style={{ marginTop: -4, marginBottom: 8, fontSize: 9 }}>
        {stats.ram_used_gb} / {stats.ram_total_gb} ГБ
      </div>

      <div className="activity-section-label">КОМАНДЫ (СЕССИЯ)</div>
      {routeCounts.length === 0 ? (
        <div className="glass-muted">Нет маршрутов в логе</div>
      ) : (
        <div className="activity-routes">
          {routeCounts.map(([cat, n]) => (
            <div className="activity-route" key={cat}>
              <div className="activity-route-hd">
                <span>{cat}</span>
                <span>{n}</span>
              </div>
              <div className="activity-bar-track">
                <div
                  className="activity-bar-fill"
                  style={{
                    width: `${(n / maxRoute) * 100}%`,
                    background: 'linear-gradient(90deg, rgba(var(--cyan-rgb),0.35), var(--cyan))',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
