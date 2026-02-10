import { useState } from 'react';
import { Site } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import './EditSiteModal.css';

interface EditSiteModalProps {
  site: Site;
  onSave: (site: Site) => void;
  onClose: () => void;
  onDelete: () => void;
}

export const EditSiteModal: React.FC<EditSiteModalProps> = ({
  site,
  onSave,
  onClose,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    name: site.name,
    enabled: site.enabled,
    frontendUrl: site.urls.frontend,
    backendUrl: site.urls.backend,
    phpmyadminUrl: site.urls.phpmyadmin,
    mysqlHost: site.server.mysql_host,
    database: site.server.database,
    prefix: site.server.prefix,
    ovhVps: site.server.ovh_vps,
    joomlaVersion: site.tech.joomla_version,
    phpVersion: site.tech.php_version,
    template: site.tech.template,
    admintoolsLogin: site.admintools_login || '',
    backendProtection: site.dashlane_refs.backend_protection || '',
    joomlaAdmin: site.dashlane_refs.joomla_admin,
    mysqlSu: site.dashlane_refs.mysql_su,
    notes: site.notes,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedSite: Site = {
      ...site,
      name: formData.name,
      enabled: formData.enabled,
      urls: {
        frontend: formData.frontendUrl,
        backend: formData.backendUrl,
        phpmyadmin: formData.phpmyadminUrl,
      },
      admintools_login: formData.admintoolsLogin || null,
      server: {
        mysql_host: formData.mysqlHost,
        database: formData.database,
        prefix: formData.prefix,
        ovh_vps: formData.ovhVps,
      },
      tech: {
        joomla_version: formData.joomlaVersion,
        php_version: formData.phpVersion,
        template: formData.template,
      },
      dashlane_refs: {
        ...site.dashlane_refs,
        backend_protection: formData.backendProtection || null,
        joomla_admin: formData.joomlaAdmin,
        mysql_su: formData.mysqlSu,
      },
      notes: formData.notes,
      last_update: new Date().toISOString(),
    };

    onSave(updatedSite);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Modifier le site</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-section">
            <h3>Informations générales</h3>

            <Input
              label="Nom du site"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
              Site actif
            </label>
          </div>

          <div className="form-section">
            <h3>URLs</h3>

            <Input
              label="URL Frontend"
              value={formData.frontendUrl}
              onChange={(e) => handleChange('frontendUrl', e.target.value)}
            />

            <Input
              label="URL Backend (Admin)"
              value={formData.backendUrl}
              onChange={(e) => handleChange('backendUrl', e.target.value)}
            />

            <Input
              label="URL phpMyAdmin"
              value={formData.phpmyadminUrl}
              onChange={(e) => handleChange('phpmyadminUrl', e.target.value)}
            />
          </div>

          <div className="form-section">
            <h3>Serveur</h3>

            <Input
              label="Serveur OVH VPS"
              value={formData.ovhVps}
              onChange={(e) => handleChange('ovhVps', e.target.value)}
              placeholder="Ex: VPS 1 (OVH)"
            />

            <Input
              label="Hôte MySQL"
              value={formData.mysqlHost}
              onChange={(e) => handleChange('mysqlHost', e.target.value)}
              placeholder="Ex: localhost:3306"
            />

            <Input
              label="Base de données"
              value={formData.database}
              onChange={(e) => handleChange('database', e.target.value)}
            />

            <Input
              label="Préfixe tables"
              value={formData.prefix}
              onChange={(e) => handleChange('prefix', e.target.value)}
              placeholder="Ex: jos_"
            />
          </div>

          <div className="form-section">
            <h3>Technique</h3>

            <div className="form-row">
              <Input
                label="Version Joomla"
                value={formData.joomlaVersion}
                onChange={(e) => handleChange('joomlaVersion', e.target.value)}
                placeholder="Ex: 4.4.2"
              />

              <Input
                label="Version PHP"
                value={formData.phpVersion}
                onChange={(e) => handleChange('phpVersion', e.target.value)}
                placeholder="Ex: 8.1"
              />
            </div>

            <Input
              label="Template"
              value={formData.template}
              onChange={(e) => handleChange('template', e.target.value)}
              placeholder="Ex: Helix Ultimate"
            />
          </div>

          <div className="form-section">
            <h3>🛡️ Protection Backend (AdminTools)</h3>

            <Input
              label="Login AdminTools"
              value={formData.admintoolsLogin}
              onChange={(e) => handleChange('admintoolsLogin', e.target.value)}
              placeholder="Ex: sectionsu"
            />

            <Input
              label="Référence Dashlane Backend Protection"
              value={formData.backendProtection}
              onChange={(e) => handleChange('backendProtection', e.target.value)}
              placeholder="Ex: [CFDT-O2] Backend Protection"
            />
          </div>

          <div className="form-section">
            <h3>Références Dashlane</h3>

            <Input
              label="Joomla Admin"
              value={formData.joomlaAdmin}
              onChange={(e) => handleChange('joomlaAdmin', e.target.value)}
              placeholder="Nom de l'entrée Dashlane"
            />

            <Input
              label="MySQL Super User"
              value={formData.mysqlSu}
              onChange={(e) => handleChange('mysqlSu', e.target.value)}
              placeholder="Nom de l'entrée Dashlane"
            />
          </div>

          <div className="form-section">
            <h3>Notes</h3>
            <textarea
              className="notes-textarea"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              placeholder="Notes sur ce site..."
            />
          </div>

          <div className="modal-actions">
            <div className="actions-left">
              {!showDeleteConfirm ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Supprimer
                </Button>
              ) : (
                <div className="delete-confirm">
                  <span>Confirmer ?</span>
                  <Button type="button" variant="danger" onClick={onDelete}>
                    Oui, supprimer
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Non
                  </Button>
                </div>
              )}
            </div>
            <div className="actions-right">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Sauvegarder
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
