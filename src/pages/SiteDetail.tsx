import { useState } from 'react';
import { Site, ChecklistItem, Intervention, Extension } from '../types';
import { Button } from '../components/Button';
import { PhpMyAdminModal } from '../components/PhpMyAdminModal';
import { EditSiteModal } from '../components/EditSiteModal';
import { ChecklistModal } from '../components/ChecklistModal';
import { InterventionModal } from '../components/InterventionModal';
import { ExtensionModal } from '../components/ExtensionModal';
import './SiteDetail.css';

interface SiteDetailProps {
  site: Site;
  onBack: () => void;
  onUpdate: (site: Site) => void;
  onDelete: (siteId: string) => void;
}

export const SiteDetail: React.FC<SiteDetailProps> = ({ site, onBack, onUpdate, onDelete }) => {
  const [showPhpMyAdminModal, setShowPhpMyAdminModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklistIndex, setEditingChecklistIndex] = useState<number | null>(null);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [editingInterventionIndex, setEditingInterventionIndex] = useState<number | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [editingExtensionIndex, setEditingExtensionIndex] = useState<number | null>(null);

  const handleToggleChecklistItem = (index: number) => {
    const updatedChecklist = [...site.checklist];
    updatedChecklist[index] = {
      ...updatedChecklist[index],
      done: !updatedChecklist[index].done,
      date: !updatedChecklist[index].done ? new Date().toISOString().split('T')[0] : null,
    };

    onUpdate({
      ...site,
      checklist: updatedChecklist,
      last_update: new Date().toISOString(),
    });
  };

  const openDashlaneUrl = (ref: string) => {
    // En mode dev, juste un log
    console.log('Ouverture Dashlane:', ref);
    alert(`Dashlane CLI : ${ref}\n(Fonctionnalité disponible dans la version finale)`);
  };

  // Gestion de la checklist
  const handleAddChecklist = () => {
    setEditingChecklistIndex(null);
    setShowChecklistModal(true);
  };

  const handleEditChecklist = (index: number) => {
    setEditingChecklistIndex(index);
    setShowChecklistModal(true);
  };

  const handleSaveChecklist = (item: ChecklistItem) => {
    let updatedChecklist: ChecklistItem[];

    if (editingChecklistIndex !== null) {
      // Édition
      updatedChecklist = [...site.checklist];
      updatedChecklist[editingChecklistIndex] = item;
    } else {
      // Ajout
      updatedChecklist = [...site.checklist, item];
    }

    onUpdate({
      ...site,
      checklist: updatedChecklist,
      last_update: new Date().toISOString(),
    });
    setShowChecklistModal(false);
  };

  const handleDeleteChecklist = () => {
    if (editingChecklistIndex === null) return;

    const updatedChecklist = site.checklist.filter((_, i) => i !== editingChecklistIndex);
    onUpdate({
      ...site,
      checklist: updatedChecklist,
      last_update: new Date().toISOString(),
    });
    setShowChecklistModal(false);
  };

  // Gestion des interventions
  const handleAddIntervention = () => {
    setEditingInterventionIndex(null);
    setShowInterventionModal(true);
  };

  const handleEditIntervention = (index: number) => {
    setEditingInterventionIndex(index);
    setShowInterventionModal(true);
  };

  const handleSaveIntervention = (intervention: Intervention) => {
    let updatedInterventions: Intervention[];

    if (editingInterventionIndex !== null) {
      // Édition
      updatedInterventions = [...site.interventions];
      updatedInterventions[editingInterventionIndex] = intervention;
    } else {
      // Ajout (en début de liste pour avoir les plus récentes en premier)
      updatedInterventions = [intervention, ...site.interventions];
    }

    onUpdate({
      ...site,
      interventions: updatedInterventions,
      last_update: new Date().toISOString(),
    });
    setShowInterventionModal(false);
  };

  const handleDeleteIntervention = () => {
    if (editingInterventionIndex === null) return;

    const updatedInterventions = site.interventions.filter((_, i) => i !== editingInterventionIndex);
    onUpdate({
      ...site,
      interventions: updatedInterventions,
      last_update: new Date().toISOString(),
    });
    setShowInterventionModal(false);
  };

  // Gestion des extensions
  const handleAddExtension = () => {
    setEditingExtensionIndex(null);
    setShowExtensionModal(true);
  };

  const handleEditExtension = (index: number) => {
    setEditingExtensionIndex(index);
    setShowExtensionModal(true);
  };

  const handleSaveExtension = (extension: Extension) => {
    const extensions = site.extensions || [];
    let updatedExtensions: Extension[];

    if (editingExtensionIndex !== null) {
      // Édition
      updatedExtensions = [...extensions];
      updatedExtensions[editingExtensionIndex] = extension;
    } else {
      // Ajout
      updatedExtensions = [...extensions, extension];
    }

    // Trier: critiques en premier, puis par nom
    updatedExtensions.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    onUpdate({
      ...site,
      extensions: updatedExtensions,
      last_update: new Date().toISOString(),
    });
    setShowExtensionModal(false);
  };

  const handleDeleteExtension = () => {
    if (editingExtensionIndex === null) return;

    const extensions = site.extensions || [];
    const updatedExtensions = extensions.filter((_, i) => i !== editingExtensionIndex);
    onUpdate({
      ...site,
      extensions: updatedExtensions,
      last_update: new Date().toISOString(),
    });
    setShowExtensionModal(false);
  };

  // Extensions triées pour l'affichage
  const sortedExtensions = [...(site.extensions || [])].sort((a, b) => {
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const criticalExtensions = sortedExtensions.filter(e => e.critical);
  const otherExtensions = sortedExtensions.filter(e => !e.critical);

  return (
    <div className="site-detail">
      <div className="detail-header">
        <Button variant="ghost" onClick={onBack} icon="←">
          Retour
        </Button>

        <div className="header-title">
          <h1>{site.name}</h1>
          <span className="site-status">
            {site.enabled ? '✅ Actif' : '⏸️ Archivé'}
          </span>
        </div>

        <Button variant="primary" onClick={() => setShowEditModal(true)}>
          Modifier
        </Button>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-section">
            <h2>🌐 Accès Web</h2>
            <div className="access-grid">
              <div className="access-card">
                <div className="access-label">Frontend</div>
                <a href={site.urls.frontend} target="_blank" rel="noopener noreferrer" className="access-link">
                  {site.urls.frontend}
                </a>
              </div>
              <div className="access-card">
                <div className="access-label">Backend Joomla</div>
                <a href={site.urls.backend} target="_blank" rel="noopener noreferrer" className="access-link">
                  {site.urls.backend}
                </a>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <h2>🗄️ Base de données</h2>
            <div className="db-grid">
              <div className="db-info">
                <span className="db-label">Hôte MySQL</span>
                <span className="db-value">{site.server.mysql_host}</span>
              </div>
              <div className="db-info">
                <span className="db-label">Base de données</span>
                <span className="db-value">{site.server.database}</span>
              </div>
              <div className="db-info">
                <span className="db-label">Préfixe</span>
                <span className="db-value">{site.server.prefix}</span>
              </div>
            </div>

            <div className="db-actions">
              <Button
                variant="primary"
                onClick={() => setShowPhpMyAdminModal(true)}
                icon="🔧"
              >
                Connexion guidée phpMyAdmin
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => openDashlaneUrl(site.dashlane_refs.mysql_su)}
                icon="🔑"
              >
                Credentials MySQL (Dashlane)
              </Button>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-header">
              <h2>📝 Journal des interventions</h2>
              <Button variant="secondary" onClick={handleAddIntervention} icon="+">
                Ajouter
              </Button>
            </div>
            {site.interventions.length === 0 ? (
              <p className="empty-message">Aucune intervention enregistrée</p>
            ) : (
              <div className="interventions-timeline">
                {site.interventions.map((intervention, index) => (
                  <div
                    key={index}
                    className="intervention-item clickable"
                    onClick={() => handleEditIntervention(index)}
                    title="Cliquer pour modifier"
                  >
                    <div className="intervention-date">
                      {new Date(intervention.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="intervention-content">
                      <div className="intervention-type">{intervention.type_intervention}</div>
                      <div className="intervention-description">{intervention.description}</div>
                      <div className="intervention-meta">
                        <span>⏱️ {intervention.duration}</span>
                        <span>• {intervention.result}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar">
          <section className="detail-section">
            <h2>ℹ️ Informations</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Joomla</span>
                <span className="info-value">{site.tech.joomla_version}</span>
              </div>
              <div className="info-item">
                <span className="info-label">PHP</span>
                <span className="info-value">{site.tech.php_version}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Template</span>
                <span className="info-value">{site.tech.template}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Serveur</span>
                <span className="info-value">{site.server.ovh_vps}</span>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-header">
              <h2>🧩 Extensions</h2>
              <Button variant="secondary" onClick={handleAddExtension} icon="+">
                Ajouter
              </Button>
            </div>
            {sortedExtensions.length === 0 ? (
              <p className="empty-message">Aucune extension</p>
            ) : (
              <div className="extensions-list">
                {criticalExtensions.length > 0 && (
                  <div className="extensions-group">
                    <div className="extensions-group-label">Extensions critiques :</div>
                    <ul className="extensions-items">
                      {criticalExtensions.map((ext, index) => {
                        const originalIndex = (site.extensions || []).findIndex(
                          e => e.name === ext.name && e.version === ext.version
                        );
                        return (
                          <li
                            key={index}
                            className="extension-item critical clickable"
                            onClick={() => handleEditExtension(originalIndex)}
                            title="Cliquer pour modifier"
                          >
                            <span className="extension-name">{ext.name}</span>
                            {ext.version && <span className="extension-version">: {ext.version}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {otherExtensions.length > 0 && (
                  <div className="extensions-group">
                    {criticalExtensions.length > 0 && (
                      <div className="extensions-group-label">Autres extensions :</div>
                    )}
                    <ul className="extensions-items">
                      {otherExtensions.map((ext, index) => {
                        const originalIndex = (site.extensions || []).findIndex(
                          e => e.name === ext.name && e.version === ext.version
                        );
                        return (
                          <li
                            key={index}
                            className="extension-item clickable"
                            onClick={() => handleEditExtension(originalIndex)}
                            title="Cliquer pour modifier"
                          >
                            <span className="extension-name">{ext.name}</span>
                            {ext.version && <span className="extension-version">: {ext.version}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="detail-section">
            <div className="section-header">
              <h2>✅ Checklist</h2>
              <Button variant="secondary" onClick={handleAddChecklist} icon="+">
                Ajouter
              </Button>
            </div>
            {site.checklist.length === 0 ? (
              <p className="empty-message">Aucune tâche</p>
            ) : (
              <div className="checklist">
                {site.checklist.map((item, index) => (
                  <div key={index} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklistItem(index)}
                    />
                    <span
                      className={`checklist-task ${item.done ? 'done' : ''}`}
                      onClick={() => handleEditChecklist(index)}
                      title="Cliquer pour modifier"
                    >
                      {item.task}
                    </span>
                    {item.date && <span className="checklist-date">{item.date}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {site.contacts.length > 0 && (
            <section className="detail-section">
              <h2>👥 Contacts</h2>
              <div className="contacts">
                {site.contacts.map((contact, index) => (
                  <div key={index} className="contact-item">
                    <div className="contact-name">{contact.name}</div>
                    <div className="contact-role">{contact.role}</div>
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="contact-link">
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <div className="contact-phone">{contact.phone}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {site.notes && (
            <section className="detail-section">
              <h2>📋 Notes</h2>
              <p className="notes-text">{site.notes}</p>
            </section>
          )}
        </aside>
      </div>

      {showPhpMyAdminModal && (
        <PhpMyAdminModal
          site={site}
          onClose={() => setShowPhpMyAdminModal(false)}
        />
      )}

      {showEditModal && (
        <EditSiteModal
          site={site}
          onSave={(updatedSite) => {
            onUpdate(updatedSite);
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
          onDelete={() => {
            onDelete(site.id);
            setShowEditModal(false);
          }}
        />
      )}

      {showChecklistModal && (
        <ChecklistModal
          item={editingChecklistIndex !== null ? site.checklist[editingChecklistIndex] : null}
          onSave={handleSaveChecklist}
          onDelete={editingChecklistIndex !== null ? handleDeleteChecklist : undefined}
          onClose={() => setShowChecklistModal(false)}
        />
      )}

      {showInterventionModal && (
        <InterventionModal
          intervention={editingInterventionIndex !== null ? site.interventions[editingInterventionIndex] : null}
          onSave={handleSaveIntervention}
          onDelete={editingInterventionIndex !== null ? handleDeleteIntervention : undefined}
          onClose={() => setShowInterventionModal(false)}
        />
      )}

      {showExtensionModal && (
        <ExtensionModal
          extension={editingExtensionIndex !== null ? (site.extensions || [])[editingExtensionIndex] : null}
          onSave={handleSaveExtension}
          onDelete={editingExtensionIndex !== null ? handleDeleteExtension : undefined}
          onClose={() => setShowExtensionModal(false)}
        />
      )}
    </div>
  );
};
