import { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, AppStatus } from './types';
import { initializeStorage, isLocked, saveData, lock } from './utils/tauri';
import { UnlockScreen } from './pages/UnlockScreen';
import { MainLayout } from './pages/MainLayout';
import './App.css';

function App() {
  const [status, setStatus] = useState<AppStatus>('initializing');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dataFileExists, setDataFileExists] = useState(false);
  const [password, setPassword] = useState<string>('');
  const [initError, setInitError] = useState<string>('');

  // Ref pour eviter les stale closures sur le password
  const passwordRef = useRef<string>('');
  // Ref pour le timer de debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref pour eviter les sauvegardes concurrentes
  const isSavingRef = useRef(false);

  // Sync passwordRef avec le state
  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  useEffect(() => {
    async function init() {
      try {
        console.log('Initialisation...');
        const appDir = await getAppDirectory();
        console.log('Dossier app:', appDir);

        const exists = await initializeStorage(appDir);
        console.log('Storage initialise, fichier existe:', exists);
        setDataFileExists(exists);

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

  // Cleanup du timer au demontage
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleUnlock = (data: AppData, pwd: string) => {
    setAppData(data);
    setPassword(pwd);
    setStatus('unlocked');
  };

  const handleLock = async () => {
    try {
      await lock();
    } catch (error) {
      console.error('Erreur verrouillage:', error);
    }
    setAppData(null);
    setPassword('');
    setStatus('locked');
  };

  // Sauvegarder les donnees avec debounce (500ms) pour eviter les ecritures excessives
  const handleDataChange = useCallback(async (newData: AppData) => {
    setAppData(newData);

    // Annuler le timer precedent
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce: sauvegarder apres 500ms d'inactivite
    saveTimerRef.current = setTimeout(async () => {
      const currentPassword = passwordRef.current;
      if (!currentPassword) return;
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      try {
        await saveData(currentPassword, newData);
        console.log('Donnees sauvegardees');
      } catch (error) {
        console.error('Erreur sauvegarde:', error);
      } finally {
        isSavingRef.current = false;
      }
    }, 500);
  }, []);

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

  if (!appData) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des donnees...</p>
      </div>
    );
  }

  return (
    <MainLayout
      appData={appData}
      onDataChange={handleDataChange}
      onLock={handleLock}
      onPasswordChanged={setPassword}
      password={password}
    />
  );
}

// Utilitaire pour obtenir le dossier de l'application
async function getAppDirectory(): Promise<string> {
  if (import.meta.env.DEV) {
    // Mode developpement
    const platform = navigator.userAgent.toLowerCase();
    const isMac = platform.includes('mac');
    return isMac ? '/tmp/cockpit-cfdt-dev' : 'C:\\temp\\cockpit-cfdt-dev';
  }

  const pathModule = await import('@tauri-apps/api/path');
  const fsModule = await import('@tauri-apps/api/fs');
  
  let configDir: string;
  
  try {
    const platform = navigator.userAgent.toLowerCase();
    const isMac = platform.includes('mac');
    
    let portableBasePath: string;
    if (isMac) {
      const resourcePath = await pathModule.resourceDir();
      const appPath = await pathModule.dirname(await pathModule.dirname(await pathModule.dirname(resourcePath)));
      portableBasePath = await pathModule.dirname(appPath);
    } else {
      portableBasePath = await pathModule.resourceDir();
    }
    
    const portableMarkerPath = await pathModule.join(portableBasePath, '.portable');
    
    const isPortable = await fsModule.exists(portableMarkerPath);
    
    if (isPortable) {
      console.log('Mode portable detecte');
      console.log('Portable path:', portableBasePath);
      configDir = portableBasePath;
    } else {
      configDir = await pathModule.appDataDir();
    }
  } catch (error) {
    console.log('Pas en mode portable, utilisation AppData:', error);
    configDir = await pathModule.appDataDir();
  }

  try {
    const { getCustomDataLocation } = await import('./utils/tauri');
    const customLocation = await getCustomDataLocation(configDir);
    
    if (customLocation) {
      console.log('Emplacement personnalise trouve:', customLocation);
      return customLocation;
    }
  } catch (error) {
    console.log('Pas d\'emplacement personnalise:', error);
  }

  console.log('Utilisation de l\'emplacement par defaut:', configDir);
  return configDir;
}

export default App;
