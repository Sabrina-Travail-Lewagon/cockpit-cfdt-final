import { useState } from 'react';
import { Site, AppSettings } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { createEntry } from '../utils/enpass';
import './AddSiteModal.css';

interface AddSiteModalProps {
  onAdd: (site: Site) => void;
  onClose: () => void;
  settings?: AppSettings;
  enpassMasterPassword?: string;
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({ onAdd, onClose, settings, enpassMasterPassword }) => {
  const [name, setName] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('https://');
  const [backendUrl, setBackendUrl] = useState('');
  const [error, setError] = useState('');
  const [createInEnpass, setCreateInEnpass] = useState(true);
  const [enpassStatus, setEnpassStatus] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Le nom du site est requis');
      return;
    }

    if (!frontendUrl.trim() || frontendUrl === 'https://') {
      setError("L'URL du site est requise");
      return;
    }

    // Générer un ID unique
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const siteName = name.trim();
    const siteUrl = frontendUrl.trim();

    // Creer automatiquement les entrees dans Enpass si demande
    if (createInEnpass && settings?.enpass_vault_path && enpassMasterPassword) {
      setCreating(true);
      setEnpassStatus('Creation des entrees dans Enpass...');

      try {
        // Creer l'entree Joomla Admin
        const joomlaRef = `[${siteName}] Joomla Admin`;
        await createEntry(
          settings.enpass_vault_path,
          joomlaRef,
          'admin',
          '', // Le mot de passe sera rempli manuellement dans Enpass
          `${siteUrl}/administrator`,
          enpassMasterPassword,
          settings.enpass_cli_path
        );

        // Creer l'entree MySQL
        const mysqlRef = `[${siteName}] MySQL Root`;
        await createEntry(
          settings.enpass_vault_path,
          mysqlRef,
          'root',
          '',
          siteUrl,
          enpassMasterPassword,
          settings.enpass_cli_path
        );

        setEnpassStatus('Entrees creees dans Enpass !');
      } catch (err) {
        setEnpassStatus(`Erreur Enpass: ${err}`);
      }

      setCreating(false);
    }

    const joomlaAdminRef = createInEnpass ? `[${siteName}] Joomla Admin` : '';
    const mysqlSuRef = createInEnpass ? `[${siteName}] MySQL Root` : '';

    const newSite: Site = {
      id: `${id}-${Date.now()}`,
      name: siteName,
      enabled: true,
      urls: {
        frontend: siteUrl,
        backend: backendUrl.trim() || `${siteUrl}/administrator`,
        phpmyadmin: '',
      },
      enpass_refs: {
        backend_protection: null,
        joomla_admin: joomlaAdminRef,
        mysql_su: mysqlSuRef,
        mysql_std: null,
        editors: [],
      },
      admintools_login: null,
      server: {
        mysql_host: '',
        database: '',
        prefix: 'jos_',
        ovh_vps: '',
      },
      tech: {
        joomla_version: '',
        php_version: '',
        template: '',
      },
      analytics: null,
      joomla_accounts: [],
      extensions: [],
      checklist: [],
      interventions: [],
      contacts: [],
      notes: '',
      last_update: new Date().toISOString(),
    };

    onAdd(newSite);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ajouter un nouveau site</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <Input
            label="Nom du site"
            placeholder="Ex: CFDT Transport"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error && !name ? error : ''}
            autoFocus
          />

          <Input
            label="URL du site (frontend)"
            placeholder="https://mon-site.fr"
            value={frontendUrl}
            onChange={(e) => setFrontendUrl(e.target.value)}
            error={error && frontendUrl === 'https://' ? error : ''}
          />

          <Input
            label="URL admin (backend)"
            placeholder="https://mon-site.fr/administrator"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />

          {settings?.enpass_vault_path && (
            <div className="enpass-create-option">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={createInEnpass}
                  onChange={(e) => setCreateInEnpass(e.target.checked)}
                />
                Creer automatiquement les entrees dans Enpass (Joomla Admin + MySQL)
              </label>
              {enpassStatus && (
                <p className={`enpass-create-status ${enpassStatus.includes('Erreur') ? 'error' : 'success'}`}>
                  {enpassStatus}
                </p>
              )}
            </div>
          )}

          {error && name && frontendUrl !== 'https://' && (
            <p className="form-error">{error}</p>
          )}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creation en cours...' : 'Ajouter le site'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
