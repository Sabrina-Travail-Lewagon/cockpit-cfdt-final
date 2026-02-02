import { useState, useEffect } from 'react';
import { AppData, AppStatus } from './types';
import { initializeStorage, isLocked } from './utils/tauri';
import { UnlockScreen } from './pages/UnlockScreen';
import { MainLayout } from './pages/MainLayout';
import './App.css';

function App() {
  const [status, setStatus] = useState<AppStatus>('initializing');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dataFileExists, setDataFileExists] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Déterminer le dossier de l'app (mode portable)
        const appDir = await getAppDirectory();
        
        // Initialiser le storage
        const exists = await initializeStorage(appDir);
        setDataFileExists(exists);
        
        // Vérifier si verrouillé
        const locked = await isLocked();
        setStatus(locked ? 'locked' : 'unlocked');
      } catch (error) {
        console.error('Erreur initialisation:', error);
        setStatus('locked');
      }
    }
    
    init();
  }, []);

  const handleUnlock = (data: AppData) => {
    setAppData(data);
    setStatus('unlocked');
  };

  const handleLock = () => {
    setAppData(null);
    setStatus('locked');
  };

  if (status === 'initializing') {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <UnlockScreen
        dataFileExists={dataFileExists}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <MainLayout
      appData={appData!}
      onDataChange={setAppData}
      onLock={handleLock}
    />
  );
}

// Utilitaire pour obtenir le dossier de l'application
async function getAppDirectory(): Promise<string> {
  // En mode portable, on utilise le dossier où se trouve l'exécutable
  // Pour le développement, on utilise un dossier temporaire
  
  if (import.meta.env.DEV) {
    // Mode développement : utiliser un dossier temp
    return '/tmp/cockpit-cfdt-dev';
  }
  
  // Mode production : détection automatique du dossier
  // Tauri fournit le chemin de l'app
  const { appDir } = await import('@tauri-apps/api/path');
  return await appDir();
}

export default App;
