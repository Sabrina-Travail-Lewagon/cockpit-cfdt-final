import { useState } from 'react';
import { AppData } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { unlock, createInitialData } from '../utils/tauri';
import { getMockData } from '../utils/mockData';
import './UnlockScreen.css';

interface UnlockScreenProps {
  dataFileExists: boolean;
  onUnlock: (data: AppData) => void;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({
  dataFileExists,
  onUnlock,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(!dataFileExists);

  // MODE DÉVELOPPEMENT : Utiliser des données mockées
  const isDevelopment = import.meta.env.DEV;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // MODE DEV : Skip le backend, utiliser mock data
      if (isDevelopment) {
        console.log('🔓 Mode développement : Utilisation de données mockées');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simule chargement
        const mockData = getMockData();
        onUnlock(mockData);
        return;
      }

      // MODE PRODUCTION : Utiliser le vrai backend
      if (isFirstTime) {
        // Première utilisation : créer le fichier
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          return;
        }
        if (password.length < 8) {
          setError('Le mot de passe doit contenir au moins 8 caractères');
          return;
        }

        await createInitialData(password);
        const data = await unlock(password);
        onUnlock(data);
      } else {
        // Déverrouillage normal
        const data = await unlock(password);
        onUnlock(data);
      }
    } catch (err) {
      console.error('Erreur déverrouillage:', err);
      setError(isFirstTime ? 'Erreur lors de la création' : 'Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="unlock-screen">
      <div className="unlock-background"></div>
      
      <div className="unlock-card">
        <div className="unlock-header">
          <div className="unlock-icon">
            ✈️
          </div>
          <h1>Cockpit CFDT</h1>
          <p className="unlock-subtitle">
            {isFirstTime
              ? 'Première utilisation - Créer un mot de passe maître'
              : 'Déverrouiller votre Cockpit'}
          </p>
          {isDevelopment && (
            <div className="dev-badge">
              🚧 Mode Développement
            </div>
          )}
        </div>

        <form onSubmit={handleUnlock} className="unlock-form">
          <Input
            type="password"
            label={isFirstTime ? 'Mot de passe maître' : 'Mot de passe'}
            placeholder="Entrez votre mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            icon="🔒"
            autoFocus
          />

          {isFirstTime && (
            <Input
              type="password"
              label="Confirmer le mot de passe"
              placeholder="Confirmez votre mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon="🔒"
            />
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="unlock-button"
          >
            {isFirstTime ? 'Créer et déverrouiller' : 'Déverrouiller'}
          </Button>

          {isDevelopment && (
            <p className="dev-hint">
              💡 Mode dev : Cliquez sur déverrouiller (mot de passe ignoré)
            </p>
          )}
        </form>

        {!isFirstTime && (
          <button
            type="button"
            className="unlock-link"
            onClick={() => setIsFirstTime(true)}
          >
            Première utilisation ? Créer un nouveau fichier
          </button>
        )}

        <div className="unlock-footer">
          <p>🔐 Chiffré avec AES-256-GCM</p>
          <p>Vos données sont sécurisées</p>
        </div>
      </div>
    </div>
  );
};
