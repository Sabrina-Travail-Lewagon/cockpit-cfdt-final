import { useState } from 'react';
import { Site } from '../types';
import { Button } from '../components/Button';
import { PhpMyAdminModal } from '../components/PhpMyAdminModal';
import { EditSiteModal } from '../components/EditSiteModal';
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
            <h2>📝 Journal des interventions</h2>
            {site.interventions.length === 0 ? (
              <p className="empty-message">Aucune intervention enregistrée</p>
            ) : (
              <div className="interventions-timeline">
                {site.interventions.map((intervention, index) => (
                  <div key={index} className="intervention-item">
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
            <h2>✅ Checklist</h2>
            {site.checklist.length === 0 ? (
              <p className="empty-message">Aucune tâche</p>
            ) : (
              <div className="checklist">
                {site.checklist.map((item, index) => (
                  <label key={index} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklistItem(index)}
                    />
                    <span className={item.done ? 'done' : ''}>{item.task}</span>
                    {item.date && <span className="checklist-date">{item.date}</span>}
                  </label>
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
    </div>
  );
};
