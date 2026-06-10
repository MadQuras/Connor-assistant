import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ConnorConfig } from '../lib/tauri';
import { applyAccentColor, loadConfig, saveConfig, startPythonCore } from '../lib/tauri';

type ConfigContextValue = {
  config: Partial<ConnorConfig>;
  setConfig: Dispatch<SetStateAction<Partial<ConnorConfig>>>;
  status: string;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  startCore: () => Promise<void>;
  ready: boolean;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Partial<ConnorConfig>>({});
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const cfg = await loadConfig();
      setConfig(cfg);
      if (cfg.accent_color) applyAccentColor(cfg.accent_color);
      setStatus('');
    } catch (e) {
      setStatus(`Ошибка: ${String(e)}`);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    try {
      await saveConfig(config);
      if (config.accent_color) applyAccentColor(config.accent_color);
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

  const value = useMemo(
    () => ({ config, setConfig, status, save, reload, startCore, ready }),
    [config, status, save, reload, startCore, ready],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return ctx;
}
