import { useState, useCallback, useEffect } from 'react';
import { Shell } from './components/Layout/Shell';
import { Dashboard } from './components/Dashboard/Dashboard';
import { CommandsList } from './components/Commands/CommandsList';
import { NotesScreen } from './components/Notes/NotesScreen';
import { DevicesStub } from './components/Devices/DevicesStub';
import { SettingsForm } from './components/Settings/SettingsForm';
import { GreetingScreen } from './components/Greeting/GreetingScreen';
import { BootScreen } from './components/Boot/BootScreen';
import { ConfigProvider, useConfig } from './hooks/useConfig';

type Scene = 'greeting' | 'boot' | 'main';

function AppInner() {
  const { config, ready } = useConfig();
  const [scene, setScene] = useState<Scene | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (ready && scene === null) {
      setScene('greeting');
    }
  }, [ready, scene]);

  const handleGreetingFinish = useCallback(() => setScene('boot'), []);
  const handleBootFinish = useCallback(() => setScene('main'), []);

  if (!ready || scene === null) return null;
  if (scene === 'greeting') {
    return <GreetingScreen onFinish={handleGreetingFinish} userName={config.user_name} />;
  }
  if (scene === 'boot') return <BootScreen onFinish={handleBootFinish} />;

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

export default function App() {
  return (
    <ConfigProvider>
      <AppInner />
    </ConfigProvider>
  );
}
