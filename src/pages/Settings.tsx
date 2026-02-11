import { useState, useRef, useEffect } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { changePassword, getDataLocation, setDataLocation } from '../utils/tauri';
import { exportToExcel, downloadTemplate, importFromExcel } from '../utils/importExport';
import { open } from '@tauri-apps/api/dialog';
import { AppData, Site } from '../types';
import './Settings.css';

interface SettingsProps {
  onBack: () => void;
  onPasswordChanged: (newPassword: string) => void;
  appData: AppData;
  onImportSites: (sites: Site[]) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, onPasswordChanged, appData, onImportSites }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Gestion de l'emplacement des données
  const [dataLocation, setDataLocationState] = useState<string>('');
  const [storageError, setStorageError] = useState('');
  const [storageSuccess, setStorageSuccess] = useState('');

  // Charger l'emplacement actuel au montage
  useEffect(() => {
    async function loadDataLocation() {
      try {
        const location = await getDataLocation();
        setDataLocationState(location);
      } catch (err) {
        console.error('Erreur chargement emplacement:', err);
      }
    }
    loadDataLocation();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Veuillez entrer votre mot de passe actuel');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Mot de passe modifié avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged(newPassword);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportToExcel(appData);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    try {
      const sites = await importFromExcel(file);
      onImportSites(sites);
      setImportSuccess(`${sites.length} site(s) importé(s) avec succès !`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setImportError(errorMessage || 'Erreur lors de l\'import');
    }

    // Reset le input file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChooseDataLocation = async () => {
    setStorageError('');
    setStorageSuccess('');

    try {
      // Ouvrir le dialogue pour choisir un dossier
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choisir l\'emplacement de stockage des données',
      });

      if (selected && typeof selected === 'string') {
        // Mettre à jour l'emplacement
        await setDataLocation(selected);
        setDataLocationState(selected);
        setStorageSuccess('Emplacement modifié ! Redémarrez l\'application pour appliquer les changements.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStorageError(errorMessage || 'Erreur lors du changement d\'emplacement');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          ← Retour
        </button>
        <h1>Paramètres</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>Sécurité</h2>

          <div className="settings-card">
            <h3>Changer le mot de passe maître</h3>
            <p className="settings-description">
              Le mot de passe maître protège toutes vos données. Choisissez un mot de passe fort et unique.
            </p>

            <form onSubmit={handleChangePassword} className="password-form">
              <Input
                type="password"
                label="Mot de passe actuel"
                placeholder="Entrez votre mot de passe actuel"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                icon="🔒"
              />

              <Input
                type="password"
                label="Nouveau mot de passe"
                placeholder="Au moins 8 caractères"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon="🔐"
              />

              <Input
                type="password"
                label="Confirmer le nouveau mot de passe"
                placeholder="Répétez le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon="🔐"
              />

              {error && <p className="form-error">{error}</p>}
              {success && <p className="form-success">{success}</p>}

              <Button type="submit" variant="primary" loading={loading}>
                Modifier le mot de passe
              </Button>
            </form>
          </div>
        </section>

        <section className="settings-section">
          <h2>Import / Export</h2>

          <div className="settings-card">
            <h3>Exporter les données</h3>
            <p className="settings-description">
              Exportez tous vos sites et leurs informations dans un fichier Excel.
            </p>
            <div className="export-actions">
              <Button variant="primary" onClick={handleExport} icon="📥">
                Exporter vers Excel
              </Button>
            </div>
          </div>

          <div className="settings-card">
            <h3>Importer des sites</h3>
            <p className="settings-description">
              Importez des sites depuis un fichier Excel. Les sites existants avec le même ID seront mis à jour.
            </p>
            <div className="import-actions">
              <Button variant="secondary" onClick={handleDownloadTemplate} icon="📄">
                Télécharger le modèle
              </Button>
              <Button variant="primary" onClick={handleImportClick} icon="📤">
                Importer un fichier
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            {importError && <p className="form-error">{importError}</p>}
            {importSuccess && <p className="form-success">{importSuccess}</p>}
          </div>
        </section>

        <section className="settings-section">
          <h2>Stockage</h2>

          <div className="settings-card">
            <h3>Emplacement des données</h3>
            <p className="settings-description">
              Choisissez où stocker vos données. Vous pouvez utiliser un SSD USB pour synchroniser vos données entre plusieurs PC.
            </p>
            
            <div className="storage-info">
              <p><strong>Emplacement actuel :</strong></p>
              <code className="storage-path">{dataLocation || 'Chargement...'}</code>
            </div>

            <div className="storage-actions">
              <Button variant="primary" onClick={handleChooseDataLocation} icon="📁">
                Choisir un nouvel emplacement
              </Button>
            </div>

            {storageError && <p className="form-error">{storageError}</p>}
            {storageSuccess && (
              <div className="form-success">
                <p>{storageSuccess}</p>
                <p className="storage-warning">
                  ⚠️ Important : Les données existantes ne seront pas déplacées automatiquement. Vous devrez copier manuellement le dossier "data" vers le nouvel emplacement.
                </p>
              </div>
            )}

            <div className="storage-tips">
              <h4>💡 Conseils :</h4>
              <ul>
                <li><strong>SSD USB :</strong> Idéal pour utiliser l'application sur plusieurs PC (Windows et Mac)</li>
                <li><strong>Disque local :</strong> Plus rapide, mais données uniquement sur ce PC</li>
                <li><strong>Sécurité :</strong> Chiffrez votre SSD USB avec BitLocker (Windows) ou FileVault (Mac)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>À propos</h2>

          <div className="settings-card">
            <div className="about-info">
              <p><strong>Cockpit CFDT</strong></p>
              <p>Version 1.0.0</p>
              <p className="about-security">
                🔐 Vos données sont chiffrées avec AES-256-GCM
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
