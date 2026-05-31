import { useState, useEffect, useCallback } from 'react';
import { Shell } from './components/Layout/Shell';
import { Dashboard } from './components/Dashboard/Dashboard';
import { CommandsList } from './components/Commands/CommandsList';
import { NotesScreen } from './components/Notes/NotesScreen';
import { DevicesStub } from './components/Devices/DevicesStub';
import { SettingsForm } from './components/Settings/SettingsForm';
import { GreetingScreen } from './components/Greeting/GreetingScreen';
import { BootScreen } from './components/Boot/BootScreen';
import { loadConfig, applyAccentColor } from './lib/tauri';

type Scene = 'greeting' | 'boot' | 'main';

export default function App() {
  const [scene, setScene]       = useState<Scene | null>(null);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg.accent_color) applyAccentColor(cfg.accent_color);
      if (cfg.user_name) setUserName(cfg.user_name);
      setScene('greeting');
    }).catch(() => {
      setScene('greeting');
    });
  }, []);

  const handleGreetingFinish = useCallback(() => setScene('boot'), []);
  const handleBootFinish     = useCallback(() => setScene('main'), []);

  if (scene === null) return null;
  if (scene === 'greeting') return <GreetingScreen onFinish={handleGreetingFinish} userName={userName} />;
  if (scene === 'boot')     return <BootScreen onFinish={handleBootFinish} />;

  // scene === 'main'
  return (
    <>
      <Shell onOpenNotes={() => setShowNotes(true)}>
        {(tab) => {
          switch (tab) {
            case 'dashboard': return <Dashboard />;
            case 'commands':  return <CommandsList />;
            case 'devices':   return <DevicesStub />;
            case 'settings':  return <SettingsForm />;
            default:          return null;
          }
        }}
      </Shell>
      {showNotes && <NotesScreen onClose={() => setShowNotes(false)} />}
    </>
  );
}
