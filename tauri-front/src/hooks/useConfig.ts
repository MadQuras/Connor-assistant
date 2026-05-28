import { useCallback, useEffect, useState } from 'react';
import type { ConnorConfig } from '../lib/tauri';
import { loadConfig, saveConfig, startPythonCore } from '../lib/tauri';

export function useConfig() {
  const [config, setConfig] = useState<Partial<ConnorConfig>>({});
  const [status, setStatus] = useState('');

  const reload = useCallback(async () => {
    try {
      const cfg = await loadConfig();
      setConfig(cfg);
      setStatus('');
    } catch (e) {
      setStatus(`Ошибка: ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    try {
      await saveConfig(config);
      setStatus('Настройки сохранены');
      setTimeout(() => setStatus(''), 3000);
    } catch (e) {
      setStatus(`Ошибка сохранения: ${String(e)}`);
    }
  }, [config]);

  const startCore = useCallback(async () => {
    try {
      await startPythonCore();
      setStatus('Голосовое ядро запущено');
      setTimeout(() => setStatus(''), 5000);
    } catch (e) {
      setStatus(`Ошибка запуска: ${String(e)}`);
    }
  }, []);

  return { config, setConfig, status, save, reload, startCore };
}
