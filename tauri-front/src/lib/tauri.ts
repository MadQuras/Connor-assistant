import { invoke } from '@tauri-apps/api/core';

export interface ConnorConfig {
  gemini_api_key: string;
  whisper_model: string;
  music_backend: string;
  yandex_music_url: string;
  command_timeout_sec: number;
  user_name: string;
  allow_shutdown?: boolean;
  auto_confirm_dangerous_commands?: boolean;
  working_folder_path?: string;
  accent_color?: string;
  first_launch?: boolean;
  // UI-only extras stored in config
  overlay_opacity?: number;
  typewriter_speed?: number;
}

export async function loadConfig(): Promise<ConnorConfig> {
  return invoke<ConnorConfig>('load_config');
}

export async function saveConfig(cfg: Partial<ConnorConfig>): Promise<void> {
  await invoke('save_config', { config: cfg });
}

export async function startPythonCore(): Promise<void> {
  await invoke('start_python_core');
}

/** Apply the accent color as a CSS variable on :root, instantly.
 *  Setting --cyan-rgb is all that's needed — every rgba(var(--cyan-rgb),X)
 *  in styles.css will update automatically with no derived vars required. */
export function applyAccentColor(hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Single source of truth — the CSS derives everything else from this
  document.documentElement.style.setProperty('--cyan-rgb', `${r}, ${g}, ${b}`);
  document.documentElement.style.setProperty('--cyan', hex);
}
