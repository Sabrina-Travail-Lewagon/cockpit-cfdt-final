import { useState } from 'react';
import { Site } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import './AddSiteModal.css';

interface AddSiteModalProps {
  onAdd: (site: Site) => void;
  onClose: () => void;
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('https://');
  const [backendUrl, setBackendUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
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

    const newSite: Site = {
      id: `${id}-${Date.now()}`,
      name: name.trim(),
      enabled: true,
      urls: {
        frontend: frontendUrl.trim(),
        backend: backendUrl.trim() || `${frontendUrl.trim()}/administrator`,
        phpmyadmin: '',
      },
      dashlane_refs: {
        backend_protection: null,
        joomla_admin: '',
        mysql_su: '',
        mysql_std: null,
        editors: [],
      },
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

          {error && name && frontendUrl !== 'https://' && (
            <p className="form-error">{error}</p>
          )}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary">
              Ajouter le site
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
