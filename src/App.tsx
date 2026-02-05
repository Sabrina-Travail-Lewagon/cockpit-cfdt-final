import { useState, useEffect, useCallback } from 'react';
import { AppData, AppStatus } from './types';
import { initializeStorage, isLocked, saveData, lock } from './utils/tauri';
import { UnlockScreen } from './pages/UnlockScreen';
import { MainLayout } from './pages/MainLayout';
import './App.css';

function App() {
  const [status, setStatus] = useState<AppStatus>('initializing');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dataFileExists, setDataFileExists] = useState(false);
  const [password, setPassword] = useState<string>(''); // Garder le mot de passe pour sauvegarder

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

  const handleUnlock = (data: AppData, pwd: string) => {
    setAppData(data);
    setPassword(pwd); // Stocker le mot de passe pour les sauvegardes
    setStatus('unlocked');
  };

  const handleLock = async () => {
    try {
      await lock(); // Appeler le backend pour verrouiller
    } catch (error) {
      console.error('Erreur verrouillage:', error);
    }
    setAppData(null);
    setPassword(''); // Effacer le mot de passe de la mémoire
    setStatus('locked');
  };

  // Sauvegarder les données quand elles changent
  const handleDataChange = useCallback(async (newData: AppData) => {
    setAppData(newData);

    // Sauvegarder dans le fichier chiffré
    if (password) {
      try {
        await saveData(password, newData);
        console.log('Données sauvegardées');
      } catch (error) {
        console.error('Erreur sauvegarde:', error);
        // TODO: Afficher une notification d'erreur à l'utilisateur
      }
    }
  }, [password]);

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
      onDataChange={handleDataChange}
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

  // Mode production : utiliser le dossier AppData de Tauri
  const pathModule = await import('@tauri-apps/api/path');
  const appDataPath = await pathModule.appDataDir();

  // S'assurer que le dossier existe
  const fsModule = await import('@tauri-apps/api/fs');
  const exists = await fsModule.exists(appDataPath);
  if (!exists) {
    await fsModule.createDir(appDataPath, { recursive: true });
  }

  return appDataPath;
}

export default App;
