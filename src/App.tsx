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
  const [initError, setInitError] = useState<string>(''); // Erreur d'initialisation

  useEffect(() => {
    async function init() {
      try {
        // Déterminer le dossier de l'app (mode portable)
        console.log('Initialisation...');
        const appDir = await getAppDirectory();
        console.log('Dossier app:', appDir);

        // Initialiser le storage
        const exists = await initializeStorage(appDir);
        console.log('Storage initialisé, fichier existe:', exists);
        setDataFileExists(exists);

        // Vérifier si verrouillé
        const locked = await isLocked();
        setStatus(locked ? 'locked' : 'unlocked');
      } catch (error) {
        console.error('Erreur initialisation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setInitError(errorMessage);
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
        initError={initError}
      />
    );
  }

  return (
    <MainLayout
      appData={appData!}
      onDataChange={handleDataChange}
      onLock={handleLock}
      onPasswordChanged={setPassword}
    />
  );
}

// Utilitaire pour obtenir le dossier de l'application
async function getAppDirectory(): Promise<string> {
  // En mode portable, on utilise le dossier où se trouve l'exécutable
  // Pour le développement, on utilise un dossier temporaire

  if (import.meta.env.DEV) {
    // Mode développement : utiliser un dossier temp
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return isMac ? '/tmp/cockpit-cfdt-dev' : 'C:\\temp\\cockpit-cfdt-dev';
  }

  const pathModule = await import('@tauri-apps/api/path');
  const fsModule = await import('@tauri-apps/api/fs');
  
  // Détecter le mode portable : chercher un fichier .portable à côté de l'exe/app
  try {
    // Sur macOS : l'app est dans un bundle .app, on cherche à côté du bundle
    // Sur Windows : l'exe est dans le dossier racine
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    let portableBasePath: string;
    if (isMac) {
      // Sur macOS, remonter de Contents/MacOS vers le dossier parent du .app
      const resourcePath = await pathModule.resourceDir();
      const appPath = await pathModule.dirname(await pathModule.dirname(await pathModule.dirname(resourcePath)));
      portableBasePath = await pathModule.dirname(appPath);
    } else {
      // Sur Windows, utiliser le dossier de l'exécutable
      portableBasePath = await pathModule.resourceDir();
    }
    
    const portableMarkerPath = await pathModule.join(portableBasePath, '.portable');
    
    // Vérifier si le marqueur portable existe
    const isPortable = await fsModule.exists(portableMarkerPath);
    
    if (isPortable) {
      console.log('Mode portable détecté');
      console.log('Portable path:', portableBasePath);
      return portableBasePath;
    }
  } catch (error) {
    console.log('Pas en mode portable, utilisation AppData:', error);
  }

  // Mode installation classique : utiliser le dossier AppData de Tauri
  const appDataPath = await pathModule.appDataDir();
  console.log('AppData path:', appDataPath);
  return appDataPath;
}

export default App;
