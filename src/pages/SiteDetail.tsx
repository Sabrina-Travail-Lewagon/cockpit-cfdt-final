import React, { useState, useEffect, useRef } from 'react';
import { Site, ChecklistItem, Intervention, Extension, JoomlaAccount, AppSettings } from '../types';
import { Button } from '../components/Button';
import { PhpMyAdminModal } from '../components/PhpMyAdminModal';
import { EditSiteModal } from '../components/EditSiteModal';
import { ChecklistModal } from '../components/ChecklistModal';
import { InterventionModal } from '../components/InterventionModal';
import { ExtensionModal } from '../components/ExtensionModal';
import { JoomlaAccountModal } from '../components/JoomlaAccountModal';
import { copyPasswordToClipboard, copyLoginToClipboard } from '../utils/enpass';
import './SiteDetail.css';

interface SiteDetailProps {
  site: Site;
  settings: AppSettings;
  enpassMasterPassword: string;
  pcloudPassword?: string;
  onBack: () => void;
  onUpdate: (site: Site) => void;
  onDelete: (siteId: string) => void;
}

export const SiteDetail: React.FC<SiteDetailProps> = ({ site, settings, enpassMasterPassword, pcloudPassword, onBack, onUpdate, onDelete }) => {
  const [showPhpMyAdminModal, setShowPhpMyAdminModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklistIndex, setEditingChecklistIndex] = useState<number | null>(null);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [editingInterventionIndex, setEditingInterventionIndex] = useState<number | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [editingExtensionIndex, setEditingExtensionIndex] = useState<number | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountIndex, setEditingAccountIndex] = useState<number | null>(null);
  const [enpassStatus, setEnpassStatus] = useState<string | null>(null);
  const [enpassLoading, setEnpassLoading] = useState<string | null>(null);

  // Ref pour le timer du toast enpass
  const enpassToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup du timer au demontage
  useEffect(() => {
    return () => {
      if (enpassToastTimerRef.current) {
        clearTimeout(enpassToastTimerRef.current);
      }
    };
  }, []);

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

  const showEnpassMessage = (message: string) => {
    setEnpassStatus(message);
    // Annuler le timer precedent
    if (enpassToastTimerRef.current) {
      clearTimeout(enpassToastTimerRef.current);
    }
    const isError = !message.includes('copie');
    enpassToastTimerRef.current = setTimeout(() => {
      setEnpassStatus(null);
      enpassToastTimerRef.current = null;
    }, isError ? 5000 : 4000);
  };

  const validateEnpassConfig = (): boolean => {
    if (!settings.enpass_vault_path) {
      showEnpassMessage('Configurez le chemin du vault Enpass dans les parametres');
      return false;
    }
    if (!enpassMasterPassword) {
      showEnpassMessage('Mot de passe Enpass requis. Configurez-le dans les parametres.');
      return false;
    }
    return true;
  };

  const handleCopyPassword = async (entryRef: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!validateEnpassConfig()) return;

    setEnpassLoading(entryRef);
    setEnpassStatus(null);

    try {
      const result = await copyPasswordToClipboard(
        settings.enpass_vault_path,
        entryRef,
        enpassMasterPassword,
        settings,
        pcloudPassword
      );
      showEnpassMessage(result.message);
    } catch (err) {
      showEnpassMessage(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnpassLoading(null);
    }
  };

  const handleCopyLogin = async (entryRef: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!validateEnpassConfig()) return;

    setEnpassLoading(entryRef + '_login');
    setEnpassStatus(null);

    try {
      const result = await copyLoginToClipboard(
        settings.enpass_vault_path,
        entryRef,
        enpassMasterPassword,
        settings,
        pcloudPassword
      );
      showEnpassMessage(result.message);
    } catch (err) {
      showEnpassMessage(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnpassLoading(null);
    }
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
      updatedChecklist = [...site.checklist];
      updatedChecklist[editingChecklistIndex] = item;
    } else {
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
      updatedInterventions = [...site.interventions];
      updatedInterventions[editingInterventionIndex] = intervention;
    } else {
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
      updatedExtensions = [...extensions];
      updatedExtensions[editingExtensionIndex] = extension;
    } else {
      updatedExtensions = [...extensions, extension];
    }

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

  // Gestion des comptes Joomla
  const handleAddAccount = () => {
    setEditingAccountIndex(null);
    setShowAccountModal(true);
  };

  const handleEditAccount = (index: number) => {
    setEditingAccountIndex(index);
    setShowAccountModal(true);
  };

  const handleSaveAccount = (account: JoomlaAccount) => {
    const accounts = site.joomla_accounts || [];
    let updatedAccounts: JoomlaAccount[];

    if (editingAccountIndex !== null) {
      updatedAccounts = [...accounts];
      updatedAccounts[editingAccountIndex] = account;
    } else {
      updatedAccounts = [...accounts, account];
    }

    onUpdate({
      ...site,
      joomla_accounts: updatedAccounts,
      last_update: new Date().toISOString(),
    });
    setShowAccountModal(false);
  };

  const handleDeleteAccount = () => {
    if (editingAccountIndex === null) return;

    const accounts = site.joomla_accounts || [];
    const updatedAccounts = accounts.filter((_, i) => i !== editingAccountIndex);
    onUpdate({
      ...site,
      joomla_accounts: updatedAccounts,
      last_update: new Date().toISOString(),
    });
    setShowAccountModal(false);
  };

  // Extensions triees pour l'affichage
  const sortedExtensions = [...(site.extensions || [])].sort((a, b) => {
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const criticalExtensions = sortedExtensions.filter(e => e.critical);
  const otherExtensions = sortedExtensions.filter(e => !e.critical);

  // Trouver l'index original d'une extension par identite stricte (nom + version + critical)
  const findOriginalExtensionIndex = (ext: Extension): number => {
    const extensions = site.extensions || [];
    // Chercher par reference stricte en utilisant l'index dans le tableau trie
    // puis mapper vers l'index original
    for (let i = 0; i < extensions.length; i++) {
      if (
        extensions[i].name === ext.name &&
        extensions[i].version === ext.version &&
        extensions[i].critical === ext.critical
      ) {
        return i;
      }
    }
    return -1;
  };

  return (
    <div className="site-detail">
      {enpassStatus && (
        <div className={`enpass-toast ${enpassStatus.includes('copie') ? 'success' : 'error'}`}>
          {enpassStatus}
        </div>
      )}
      <div className="detail-header">
        <Button variant="ghost" onClick={onBack} icon="←">
          Retour
        </Button>

        <div className="header-title">
          <h1>{site.name}</h1>
          <span className="site-status">
            {site.enabled ? 'Actif' : 'Archive'}
          </span>
        </div>

        <Button variant="primary" onClick={() => setShowEditModal(true)}>
          Modifier
        </Button>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-section">
            <h2>Acces Web</h2>
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

          {(site.admintools_login || site.enpass_refs.backend_protection) && (
            <section className="detail-section protection-section">
              <h2>Protection Backend (AdminTools)</h2>
              <div className="protection-grid">
                {site.admintools_login && (
                  <div className="protection-item">
                    <span className="protection-label">Login</span>
                    <span className="protection-value">{site.admintools_login}</span>
                  </div>
                )}
                {site.enpass_refs.backend_protection && (
                  <div className="protection-item with-action">
                    <div className="protection-info">
                      <span className="protection-label">Enpass</span>
                      <span className="protection-value">{site.enpass_refs.backend_protection}</span>
                    </div>
                    <div className="enpass-actions">
                      <button
                        className="enpass-btn"
                        onClick={() => handleCopyLogin(site.enpass_refs.backend_protection!)}
                        disabled={enpassLoading !== null}
                        title="Copier le login"
                      >
                        {enpassLoading === site.enpass_refs.backend_protection + '_login' ? '...' : 'Login'}
                      </button>
                      <button
                        className="enpass-btn"
                        onClick={() => handleCopyPassword(site.enpass_refs.backend_protection!)}
                        disabled={enpassLoading !== null}
                        title="Copier le mot de passe"
                      >
                        {enpassLoading === site.enpass_refs.backend_protection ? '...' : 'MdP'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="detail-section">
            <h2>Base de donnees</h2>
            <div className="db-grid">
              <div className="db-info">
                <span className="db-label">Hote MySQL</span>
                <span className="db-value">{site.server.mysql_host}</span>
              </div>
              <div className="db-info">
                <span className="db-label">Base de donnees</span>
                <span className="db-value">{site.server.database}</span>
              </div>
              <div className="db-info">
                <span className="db-label">Prefixe</span>
                <span className="db-value">{site.server.prefix}</span>
              </div>
            </div>

            <div className="db-actions">
              <Button
                variant="primary"
                onClick={() => setShowPhpMyAdminModal(true)}
                icon="DB"
              >
                Connexion guidee phpMyAdmin
              </Button>
              
              {site.enpass_refs.mysql_su && (
                <div className="enpass-db-actions">
                  <Button
                    variant="secondary"
                    onClick={() => handleCopyLogin(site.enpass_refs.mysql_su)}
                    disabled={enpassLoading !== null}
                  >
                    {enpassLoading === site.enpass_refs.mysql_su + '_login' ? 'Copie...' : 'Copier login MySQL'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleCopyPassword(site.enpass_refs.mysql_su)}
                    disabled={enpassLoading !== null}
                  >
                    {enpassLoading === site.enpass_refs.mysql_su ? 'Copie...' : 'Copier MdP MySQL'}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-header">
              <h2>Journal des interventions</h2>
              <Button variant="secondary" onClick={handleAddIntervention} icon="+">
                Ajouter
              </Button>
            </div>
            {site.interventions.length === 0 ? (
              <p className="empty-message">Aucune intervention enregistree</p>
            ) : (
              <div className="interventions-timeline">
                {site.interventions.map((intervention, index) => (
                  <div
                    key={`intervention-${site.id}-${index}-${intervention.date}`}
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
                        <span>{intervention.duration}</span>
                        <span>- {intervention.result}</span>
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
            <h2>Informations</h2>
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
              <h2>Comptes Joomla</h2>
              <Button variant="secondary" onClick={handleAddAccount} icon="+">
                Ajouter
              </Button>
            </div>
            {(!site.joomla_accounts || site.joomla_accounts.length === 0) ? (
              <p className="empty-message">Aucun compte enregistre</p>
            ) : (
              <div className="accounts-list">
                {site.joomla_accounts.map((account, index) => (
                  <div
                    key={`account-${site.id}-${index}-${account.username}`}
                    className="account-item clickable"
                    onClick={() => handleEditAccount(index)}
                    title="Cliquer pour modifier"
                  >
                    <div className="account-info">
                      <div className="account-username">{account.username}</div>
                      <div className="account-role">{account.role}</div>
                    </div>
                    {account.enpass_ref && (
                      <div className="enpass-actions">
                        <button
                          className="enpass-btn"
                          onClick={(e) => handleCopyLogin(account.enpass_ref!, e)}
                          disabled={enpassLoading !== null}
                          title={`Copier le login (${account.enpass_ref})`}
                        >
                          {enpassLoading === account.enpass_ref + '_login' ? '...' : 'Login'}
                        </button>
                        <button
                          className="enpass-btn"
                          onClick={(e) => handleCopyPassword(account.enpass_ref!, e)}
                          disabled={enpassLoading !== null}
                          title={`Copier le mot de passe (${account.enpass_ref})`}
                        >
                          {enpassLoading === account.enpass_ref ? '...' : 'MdP'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {site.analytics && (
            <section className="detail-section">
              <h2>Analytics & Tracking</h2>
              <div className="analytics-list">
                {site.analytics.ga_id && (
                  <div className="analytics-item">
                    <div className="analytics-label">Google Analytics</div>
                    <div className="analytics-value">{site.analytics.ga_id}</div>
                  </div>
                )}
                {site.analytics.gtm_id && (
                  <div className="analytics-item">
                    <div className="analytics-label">Google Tag Manager</div>
                    <div className="analytics-value">{site.analytics.gtm_id}</div>
                  </div>
                )}
                {site.analytics.cookie_solution && (
                  <div className="analytics-item">
                    <div className="analytics-label">Cookie Consent</div>
                    <div className="analytics-value">{site.analytics.cookie_solution}</div>
                  </div>
                )}
                {site.analytics.looker_report_url && (
                  <div className="analytics-item">
                    <div className="analytics-label">Rapport Looker</div>
                    <a
                      href={site.analytics.looker_report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="analytics-link"
                    >
                      Voir le rapport
                    </a>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="detail-section">
            <div className="section-header">
              <h2>Extensions</h2>
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
                        const originalIndex = findOriginalExtensionIndex(ext);
                        return (
                          <li
                            key={`crit-ext-${site.id}-${ext.name}-${ext.version || 'unknown'}-${index}`}
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
                        const originalIndex = findOriginalExtensionIndex(ext);
                        return (
                          <li
                            key={`ext-${site.id}-${ext.name}-${ext.version || 'unknown'}-${index}`}
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
              <h2>Checklist</h2>
              <Button variant="secondary" onClick={handleAddChecklist} icon="+">
                Ajouter
              </Button>
            </div>
            {site.checklist.length === 0 ? (
              <p className="empty-message">Aucune tache</p>
            ) : (
              <div className="checklist">
                {site.checklist.map((item, index) => (
                  <div key={`checklist-${site.id}-${index}-${item.task.substring(0, 20)}`} className="checklist-item">
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
              <h2>Contacts</h2>
              <div className="contacts">
                {site.contacts.map((contact, index) => (
                  <div key={`contact-${site.id}-${index}-${contact.name}`} className="contact-item">
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
              <h2>Notes</h2>
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

      {showAccountModal && (
        <JoomlaAccountModal
          account={editingAccountIndex !== null ? (site.joomla_accounts || [])[editingAccountIndex] : null}
          onSave={handleSaveAccount}
          onDelete={editingAccountIndex !== null ? handleDeleteAccount : undefined}
          onClose={() => setShowAccountModal(false)}
        />
      )}
    </div>
  );
};
