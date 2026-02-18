import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { changePassword, getDataLocation, setDataLocation } from '../utils/tauri';
import { exportToExcel, downloadTemplate, importFromExcel } from '../utils/importExport';
import { checkSetup, syncWebDav, debugSearch } from '../utils/enpass';
import { invoke } from '@tauri-apps/api/tauri';
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
  pcloudPassword: string;
  onPcloudPasswordChange: (password: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, onPasswordChanged, appData, onDataChange, onImportSites, password, enpassSeparatePassword, onEnpassSeparatePasswordChange, pcloudPassword, onPcloudPasswordChange }) => {
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
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Debug search
  const [debugSearchTerm, setDebugSearchTerm] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<{ success: boolean; message: string; data?: string } | null>(null);

  // Gestion de l'emplacement des donnees
  const [dataLocation, setDataLocationState] = useState<string>('');
  const [storageError, setStorageError] = useState('');
  const [storageSuccess, setStorageSuccess] = useState('');

  // (saveSettingsDebounced supprime - la sauvegarde est geree par App.tsx via onDataChange)

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

  // La sauvegarde est geree directement par onDataChange -> App.tsx (debounce 500ms)

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

  const isWebDavMode = appData.settings.enpass_vault_mode === 'webdav';

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

      if (isWebDavMode) {
        if (!appData.settings.enpass_webdav_url) {
          setEnpassTestResult({
            success: false,
            message: 'Veuillez indiquer l\'URL WebDAV pCloud.',
          });
          return;
        }
        if (!appData.settings.enpass_pcloud_username || !pcloudPassword) {
          setEnpassTestResult({
            success: false,
            message: 'Veuillez renseigner votre email pCloud et votre mot de passe pCloud.',
          });
          return;
        }
      } else {
        if (!appData.settings.enpass_vault_path) {
          setEnpassTestResult({
            success: false,
            message: 'Veuillez indiquer le chemin vers le vault Enpass.',
          });
          return;
        }
      }

      const result = await checkSetup(
        appData.settings.enpass_vault_path,
        effectivePassword,
        appData.settings,
        pcloudPassword
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

  const handleSyncWebDav = async () => {
    setSyncLoading(true);
    setSyncResult(null);

    try {
      if (!appData.settings.enpass_webdav_url) {
        setSyncResult({ success: false, message: 'URL WebDAV non configuree.' });
        return;
      }
      if (!appData.settings.enpass_pcloud_username || !pcloudPassword) {
        setSyncResult({ success: false, message: 'Identifiants pCloud requis.' });
        return;
      }

      const result = await syncWebDav(
        appData.settings.enpass_webdav_url,
        appData.settings.enpass_pcloud_username,
        pcloudPassword
      );
      setSyncResult(result);
    } catch (err) {
      setSyncResult({
        success: false,
        message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDebugSearch = async () => {
    if (!debugSearchTerm.trim()) return;

    setDebugLoading(true);
    setDebugResult(null);

    try {
      const effectivePassword = appData.settings.enpass_use_separate_password
        ? enpassSeparatePassword
        : password;

      if (!effectivePassword) {
        setDebugResult({
          success: false,
          message: 'Mot de passe Enpass requis.',
        });
        return;
      }

      const result = await debugSearch(
        appData.settings.enpass_vault_path,
        debugSearchTerm,
        effectivePassword,
        appData.settings,
        pcloudPassword
      );
      setDebugResult(result);
    } catch (err) {
      setDebugResult({
        success: false,
        message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setDebugLoading(false);
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
            <h3>Configuration du vault Enpass</h3>
            <p className="settings-description">
              Cockpit lit directement votre vault Enpass (pas besoin d'installer enpass-cli).
            </p>

            <div className="enpass-config">
              {/* Selecteur de mode */}
              <div className="form-group">
                <label>Mode de stockage du vault</label>
                <div className="vault-mode-selector">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="vault-mode"
                      value=""
                      checked={!isWebDavMode}
                      onChange={() => {
                        onDataChange({
                          ...appData,
                          settings: { ...appData.settings, enpass_vault_mode: '' }
                        });
                        setEnpassTestResult(null);
                      }}
                    />
                    Local (vault sur ce PC)
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="vault-mode"
                      value="webdav"
                      checked={isWebDavMode}
                      onChange={() => {
                        onDataChange({
                          ...appData,
                          settings: { ...appData.settings, enpass_vault_mode: 'webdav' }
                        });
                        setEnpassTestResult(null);
                      }}
                    />
                    pCloud WebDAV (vault dans le cloud)
                  </label>
                </div>
              </div>

              {/* Mode Local */}
              {!isWebDavMode && (
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
                      placeholder="Cliquez 'Detecter' ou 'Parcourir'"
                      className="settings-input"
                    />
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const vaults = await invoke<string[]>('enpass_detect_vaults');
                          if (vaults.length === 1) {
                            onDataChange({
                              ...appData,
                              settings: { ...appData.settings, enpass_vault_path: vaults[0] }
                            });
                          } else if (vaults.length > 1) {
                            const primary = vaults.find(v => v.includes('primary')) ?? vaults[0];
                            onDataChange({
                              ...appData,
                              settings: { ...appData.settings, enpass_vault_path: primary }
                            });
                          } else {
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
                          }
                        } catch {
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
                        }
                      }}
                    >
                      Detecter
                    </Button>
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
                  <span className="input-info">Le dossier contenant vault.enpassdb + vault.json</span>
                </div>
              )}

              {/* Mode WebDAV / pCloud */}
              {isWebDavMode && (
                <>
                  <div className="form-group">
                    <label>URL WebDAV pCloud</label>
                    <input
                      type="text"
                      value={appData.settings.enpass_webdav_url}
                      onChange={(e) => {
                        onDataChange({
                          ...appData,
                          settings: { ...appData.settings, enpass_webdav_url: e.target.value }
                        });
                      }}
                      placeholder="https://ewebdav.pcloud.com/Enpass/"
                      className="settings-input"
                    />
                    <span className="input-info">
                      L'URL du dossier contenant vault.enpassdbsync sur pCloud
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Email pCloud</label>
                    <input
                      type="email"
                      value={appData.settings.enpass_pcloud_username}
                      onChange={(e) => {
                        onDataChange({
                          ...appData,
                          settings: { ...appData.settings, enpass_pcloud_username: e.target.value }
                        });
                      }}
                      placeholder="votre@email.com"
                      className="settings-input"
                    />
                    <span className="input-info">
                      Votre identifiant pCloud (sauvegarde dans les parametres)
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Mot de passe pCloud</label>
                    <input
                      type="password"
                      value={pcloudPassword}
                      onChange={(e) => onPcloudPasswordChange(e.target.value)}
                      placeholder="Mot de passe de votre compte pCloud"
                      className="settings-input"
                    />
                    <span className="input-info">
                      Non sauvegarde. Demande a chaque session pour telecharger le vault.
                    </span>
                  </div>

                  <div className="enpass-test-section">
                    <Button
                      variant="secondary"
                      loading={syncLoading}
                      onClick={handleSyncWebDav}
                    >
                      Synchroniser le vault depuis pCloud
                    </Button>

                    {syncResult && (
                      <p className={syncResult.success ? 'form-success' : 'form-error'}>
                        {syncResult.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Mot de passe separe Enpass */}
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
                  {enpassTestResult.success
                    ? (isWebDavMode
                      ? 'Connexion reussie ! Cockpit peut lire votre vault Enpass depuis pCloud.'
                      : 'Connexion reussie ! Cockpit peut lire votre vault Enpass.')
                    : enpassTestResult.message}
                </p>
              )}
            </div>

            {/* Outil de diagnostic pour la recherche */}
            <div className="enpass-test-section">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={debugSearchTerm}
                  onChange={(e) => setDebugSearchTerm(e.target.value)}
                  placeholder="Ex: [CFDT-[O2]] Backend Protection"
                  className="settings-input"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="secondary"
                  loading={debugLoading}
                  onClick={handleDebugSearch}
                >
                  Diagnostiquer
                </Button>
              </div>
              <span className="input-info">
                Entrez le nom exact d'une entree Enpass pour diagnostiquer pourquoi elle n'est pas trouvee
              </span>
              {debugResult && (
                <pre className={debugResult.success ? 'form-success' : 'form-error'} style={{ whiteSpace: 'pre-wrap', fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                  {debugResult.data || debugResult.message}
                </pre>
              )}
            </div>

            <div className="storage-tips">
              <h4>Comment configurer :</h4>
              {!isWebDavMode ? (
                <ul>
                  <li><strong>1.</strong> Cliquez <strong>Detecter</strong> pour trouver automatiquement votre vault Enpass</li>
                  <li><strong>2.</strong> Ou cliquez <strong>Parcourir</strong> pour selectionner manuellement le dossier du vault</li>
                  <li><strong>3.</strong> Si votre vault Enpass utilise un mot de passe different de Cockpit, cochez la case ci-dessus</li>
                  <li><strong>4.</strong> Cliquez <strong>Tester la connexion</strong> pour verifier</li>
                </ul>
              ) : (
                <ul>
                  <li><strong>1.</strong> Selectionnez le mode <strong>pCloud WebDAV</strong> ci-dessus</li>
                  <li><strong>2.</strong> Entrez l'URL WebDAV (ex: <code>https://ewebdav.pcloud.com/Enpass/</code>)</li>
                  <li><strong>3.</strong> Entrez votre email pCloud et votre mot de passe pCloud</li>
                  <li><strong>4.</strong> Cliquez <strong>Synchroniser</strong> pour telecharger le vault</li>
                  <li><strong>5.</strong> Si votre vault Enpass utilise un mot de passe different de Cockpit, cochez la case</li>
                  <li><strong>6.</strong> Cliquez <strong>Tester la connexion</strong> pour verifier</li>
                </ul>
              )}
              <p className="input-info" style={{ marginTop: '8px' }}>
                {isWebDavMode
                  ? 'Note : en mode pCloud, le vault est en lecture seule. La creation d\'entrees n\'est pas supportee.'
                  : 'Si votre vault est stocke sur pCloud, selectionnez le mode "pCloud WebDAV".'}
              </p>
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
                Integration Enpass (lecture directe du vault)
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
