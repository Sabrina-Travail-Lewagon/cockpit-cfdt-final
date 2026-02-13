import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { changePassword, getDataLocation, setDataLocation } from '../utils/tauri';
import { exportToExcel, downloadTemplate, importFromExcel } from '../utils/importExport';
import { checkSetup } from '../utils/enpass';
import { open } from '@tauri-apps/api/dialog';
import { AppData, Site } from '../types';
import './Settings.css';

interface SettingsProps {
  onBack: () => void;
  onPasswordChanged: (newPassword: string) => void;
  appData: AppData;
  onDataChange: (data: AppData) => void;
  onImportSites: (sites: Site[]) => void;
  password: string;
  enpassSeparatePassword: string;
  onEnpassSeparatePasswordChange: (password: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, onPasswordChanged, appData, onDataChange, onImportSites, password, enpassSeparatePassword, onEnpassSeparatePasswordChange }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Enpass
  const [enpassTestLoading, setEnpassTestLoading] = useState(false);
  const [enpassTestResult, setEnpassTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Gestion de l'emplacement des donnees
  const [dataLocation, setDataLocationState] = useState<string>('');
  const [storageError, setStorageError] = useState('');
  const [storageSuccess, setStorageSuccess] = useState('');

  // Debounce timer pour les settings Enpass
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, []);

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

  // Helper pour sauvegarder les settings avec debounce
  const saveSettingsDebounced = (newSettings: typeof appData.settings) => {
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }
    settingsSaveTimerRef.current = setTimeout(() => {
      onDataChange({
        ...appData,
        settings: newSettings,
      });
    }, 800);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Veuillez entrer votre mot de passe actuel');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Mot de passe modifie avec succes !');
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
      setImportSuccess(`${sites.length} site(s) importe(s) avec succes !`);
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
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choisir l\'emplacement de stockage des donnees',
      });

      if (selected && typeof selected === 'string') {
        await setDataLocation(selected);
        setDataLocationState(selected);
        setStorageSuccess('Emplacement modifie ! Redemarrez l\'application pour appliquer les changements.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStorageError(errorMessage || 'Erreur lors du changement d\'emplacement');
    }
  };

  const handleEnpassTest = async () => {
    setEnpassTestLoading(true);
    setEnpassTestResult(null);

    try {
      const effectivePassword = appData.settings.enpass_use_separate_password
        ? enpassSeparatePassword
        : password;

      if (!effectivePassword) {
        setEnpassTestResult({
          success: false,
          message: 'Mot de passe Enpass requis. ' + (appData.settings.enpass_use_separate_password
            ? 'Entrez votre mot de passe Enpass ci-dessus.'
            : 'Le mot de passe Cockpit est vide.'),
        });
        return;
      }

      if (!appData.settings.enpass_vault_path) {
        setEnpassTestResult({
          success: false,
          message: 'Veuillez indiquer le chemin vers le vault Enpass.',
        });
        return;
      }

      const result = await checkSetup(
        appData.settings.enpass_vault_path,
        effectivePassword,
        appData.settings.enpass_cli_path
      );
      setEnpassTestResult(result);
    } catch (err) {
      setEnpassTestResult({
        success: false,
        message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setEnpassTestLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          ← Retour
        </button>
        <h1>Parametres</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>Securite</h2>

          <div className="settings-card">
            <h3>Changer le mot de passe maitre</h3>
            <p className="settings-description">
              Le mot de passe maitre protege toutes vos donnees. Choisissez un mot de passe fort et unique.
            </p>

            <form onSubmit={handleChangePassword} className="password-form">
              <Input
                type="password"
                label="Mot de passe actuel"
                placeholder="Entrez votre mot de passe actuel"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />

              <Input
                type="password"
                label="Nouveau mot de passe"
                placeholder="Au moins 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                type="password"
                label="Confirmer le nouveau mot de passe"
                placeholder="Repetez le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            <h3>Exporter les donnees</h3>
            <p className="settings-description">
              Exportez tous vos sites et leurs informations dans un fichier Excel.
            </p>
            <div className="export-actions">
              <Button variant="primary" onClick={handleExport}>
                Exporter vers Excel
              </Button>
            </div>
          </div>

          <div className="settings-card">
            <h3>Importer des sites</h3>
            <p className="settings-description">
              Importez des sites depuis un fichier Excel. Les sites existants avec le meme ID seront mis a jour.
            </p>
            <div className="import-actions">
              <Button variant="secondary" onClick={handleDownloadTemplate}>
                Telecharger le modele
              </Button>
              <Button variant="primary" onClick={handleImportClick}>
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
            <h3>Emplacement des donnees</h3>
            <p className="settings-description">
              Choisissez ou stocker vos donnees. Vous pouvez utiliser un SSD USB pour synchroniser vos donnees entre plusieurs PC.
            </p>
            
            <div className="storage-info">
              <p><strong>Emplacement actuel :</strong></p>
              <code className="storage-path">{dataLocation || 'Chargement...'}</code>
            </div>

            <div className="storage-actions">
              <Button variant="primary" onClick={handleChooseDataLocation}>
                Choisir un nouvel emplacement
              </Button>
            </div>

            {storageError && <p className="form-error">{storageError}</p>}
            {storageSuccess && (
              <div className="form-success">
                <p>{storageSuccess}</p>
                <p className="storage-warning">
                  Important : Les donnees existantes ne seront pas deplacees automatiquement. Vous devrez copier manuellement le dossier "data" vers le nouvel emplacement.
                </p>
              </div>
            )}

            <div className="storage-tips">
              <h4>Conseils :</h4>
              <ul>
                <li><strong>SSD USB :</strong> Ideal pour utiliser l'application sur plusieurs PC (Windows et Mac)</li>
                <li><strong>Disque local :</strong> Plus rapide, mais donnees uniquement sur ce PC</li>
                <li><strong>Securite :</strong> Chiffrez votre SSD USB avec BitLocker (Windows) ou FileVault (Mac)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Enpass (Gestionnaire de mots de passe)</h2>

          <div className="settings-card">
            <h3>Configuration Enpass CLI</h3>
            <p className="settings-description">
              Configurez enpass-cli pour copier les identifiants directement depuis Cockpit.
              Telechargez enpass-cli depuis <a href="https://github.com/hazcod/enpass-cli/releases" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>

            <div className="enpass-config">
              <div className="form-group">
                <label>Chemin vers enpasscli.exe</label>
                <div className="input-with-browse">
                  <input
                    type="text"
                    value={appData.settings.enpass_cli_path}
                    onChange={(e) => {
                      const newSettings = { ...appData.settings, enpass_cli_path: e.target.value };
                      // Mettre a jour l'etat local immediatement
                      onDataChange({ ...appData, settings: newSettings });
                    }}
                    onBlur={() => {
                      // Sauvegarder au blur plutot qu'a chaque frappe
                      saveSettingsDebounced(appData.settings);
                    }}
                    placeholder="auto (cherche dans le PATH)"
                    className="settings-input"
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const selected = await open({
                          multiple: false,
                          filters: [{ name: 'Executable', extensions: ['exe'] }],
                          title: 'Selectionner enpasscli.exe',
                        });
                        if (selected && typeof selected === 'string') {
                          onDataChange({
                            ...appData,
                            settings: { ...appData.settings, enpass_cli_path: selected }
                          });
                        }
                      } catch { /* annule */ }
                    }}
                  >
                    Parcourir
                  </Button>
                </div>
                <span className="input-info">Laissez "auto" si enpasscli est dans le PATH</span>
              </div>

              <div className="form-group">
                <label>Chemin vers le vault Enpass</label>
                <div className="input-with-browse">
                  <input
                    type="text"
                    value={appData.settings.enpass_vault_path}
                    onChange={(e) => {
                      onDataChange({
                        ...appData,
                        settings: { ...appData.settings, enpass_vault_path: e.target.value }
                      });
                    }}
                    onBlur={() => {
                      saveSettingsDebounced(appData.settings);
                    }}
                    placeholder="C:\Users\...\Documents\Enpass\Vaults\primary"
                    className="settings-input"
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                          title: 'Selectionner le dossier du vault Enpass',
                        });
                        if (selected && typeof selected === 'string') {
                          onDataChange({
                            ...appData,
                            settings: { ...appData.settings, enpass_vault_path: selected }
                          });
                        }
                      } catch { /* annule */ }
                    }}
                  >
                    Parcourir
                  </Button>
                </div>
                <span className="input-info">Le dossier contenant votre vault Enpass (.walletx)</span>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={appData.settings.enpass_use_separate_password}
                    onChange={(e) => {
                      onDataChange({
                        ...appData,
                        settings: { ...appData.settings, enpass_use_separate_password: e.target.checked }
                      });
                      if (!e.target.checked) {
                        onEnpassSeparatePasswordChange('');
                      }
                    }}
                  />
                  Utiliser un mot de passe Enpass different du mot de passe Cockpit
                </label>
                <span className="input-info">
                  Par defaut, le mot de passe maitre Cockpit est utilise pour deverrouiller le vault Enpass.
                  Cochez cette case si votre vault Enpass a un mot de passe different.
                </span>
              </div>

              {appData.settings.enpass_use_separate_password && (
                <div className="form-group">
                  <label>Mot de passe maitre Enpass</label>
                  <div className="input-with-info">
                    <input
                      type="password"
                      value={enpassSeparatePassword}
                      onChange={(e) => onEnpassSeparatePasswordChange(e.target.value)}
                      placeholder="Mot de passe de votre vault Enpass"
                      className="settings-input"
                    />
                    <span className="input-info">
                      Ce mot de passe n'est pas sauvegarde. Il sera demande a chaque session.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="enpass-test-section">
              <Button
                variant="secondary"
                loading={enpassTestLoading}
                onClick={handleEnpassTest}
              >
                Tester la connexion Enpass
              </Button>

              {enpassTestResult && (
                <p className={enpassTestResult.success ? 'form-success' : 'form-error'}>
                  {enpassTestResult.success ? 'Connexion reussie ! enpass-cli fonctionne correctement.' : enpassTestResult.message}
                </p>
              )}
            </div>

            <div className="storage-tips">
              <h4>Installation :</h4>
              <ul>
                <li><strong>1.</strong> Telechargez <a href="https://github.com/hazcod/enpass-cli/releases" target="_blank" rel="noopener noreferrer">enpasscli.exe</a> depuis GitHub</li>
                <li><strong>2.</strong> Placez-le dans un dossier accessible (ex: C:\Tools\)</li>
                <li><strong>3.</strong> Ajoutez ce dossier au PATH Windows ou indiquez le chemin complet ci-dessus</li>
                <li><strong>4.</strong> Indiquez le chemin vers votre vault Enpass (generalement dans Documents\Enpass\Vaults\primary)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>A propos</h2>

          <div className="settings-card">
            <div className="about-info">
              <p><strong>Cockpit CFDT</strong></p>
              <p>Version 1.1.0</p>
              <p className="about-security">
                Vos donnees sont chiffrees avec AES-256-GCM
              </p>
              <p className="about-security">
                Integration Enpass via enpass-cli
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
