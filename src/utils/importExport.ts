import * as XLSX from 'xlsx';
import { AppData, Site, Extension, ChecklistItem, Intervention, JoomlaAccount, Contact } from '../types';

/**
 * Export les donnees de l'application vers un fichier Excel
 */
export function exportToExcel(data: AppData, filename: string = 'cockpit-cfdt-export.xlsx'): void {
  const workbook = XLSX.utils.book_new();

  // Feuille 1: Sites (informations principales)
  const sitesData = data.sites.map(site => ({
    id: site.id,
    name: site.name,
    enabled: site.enabled ? 'Oui' : 'Non',
    frontend_url: site.urls.frontend,
    backend_url: site.urls.backend,
    phpmyadmin_url: site.urls.phpmyadmin,
    admintools_login: site.admintools_login || '',
    mysql_host: site.server.mysql_host,
    database: site.server.database,
    prefix: site.server.prefix,
    ovh_vps: site.server.ovh_vps,
    joomla_version: site.tech.joomla_version,
    php_version: site.tech.php_version,
    template: site.tech.template,
    ga_id: site.analytics?.ga_id || '',
    gtm_id: site.analytics?.gtm_id || '',
    cookie_solution: site.analytics?.cookie_solution || '',
    looker_report_url: site.analytics?.looker_report_url || '',
    enpass_backend_protection: site.enpass_refs.backend_protection || '',
    enpass_joomla_admin: site.enpass_refs.joomla_admin,
    enpass_mysql_su: site.enpass_refs.mysql_su,
    enpass_mysql_std: site.enpass_refs.mysql_std || '',
    notes: site.notes
  }));
  const sitesSheet = XLSX.utils.json_to_sheet(sitesData);
  XLSX.utils.book_append_sheet(workbook, sitesSheet, 'Sites');

  // Feuille 2: Comptes Joomla (avec guard null)
  const accountsData: Record<string, string>[] = [];
  data.sites.forEach(site => {
    (site.joomla_accounts || []).forEach(account => {
      accountsData.push({
        site_id: site.id,
        site_name: site.name,
        username: account.username,
        role: account.role,
        enpass_ref: account.enpass_ref || ''
      });
    });
  });
  const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
  XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Comptes Joomla');

  // Feuille 3: Extensions (avec guard null)
  const extensionsData: Record<string, string>[] = [];
  data.sites.forEach(site => {
    (site.extensions || []).forEach(ext => {
      extensionsData.push({
        site_id: site.id,
        site_name: site.name,
        name: ext.name,
        version: ext.version || '',
        critical: ext.critical ? 'Oui' : 'Non'
      });
    });
  });
  const extensionsSheet = XLSX.utils.json_to_sheet(extensionsData);
  XLSX.utils.book_append_sheet(workbook, extensionsSheet, 'Extensions');

  // Feuille 4: Checklist (avec guard null)
  const checklistData: Record<string, string>[] = [];
  data.sites.forEach(site => {
    (site.checklist || []).forEach(item => {
      checklistData.push({
        site_id: site.id,
        site_name: site.name,
        task: item.task,
        done: item.done ? 'Oui' : 'Non',
        date: item.date || ''
      });
    });
  });
  const checklistSheet = XLSX.utils.json_to_sheet(checklistData);
  XLSX.utils.book_append_sheet(workbook, checklistSheet, 'Checklist');

  // Feuille 5: Interventions (avec guard null)
  const interventionsData: Record<string, string>[] = [];
  data.sites.forEach(site => {
    (site.interventions || []).forEach(intervention => {
      interventionsData.push({
        site_id: site.id,
        site_name: site.name,
        date: intervention.date,
        type: intervention.type_intervention,
        description: intervention.description,
        duration: intervention.duration,
        result: intervention.result
      });
    });
  });
  const interventionsSheet = XLSX.utils.json_to_sheet(interventionsData);
  XLSX.utils.book_append_sheet(workbook, interventionsSheet, 'Interventions');

  // Feuille 6: Contacts (avec guard null)
  const contactsData: Record<string, string>[] = [];
  data.sites.forEach(site => {
    (site.contacts || []).forEach(contact => {
      contactsData.push({
        site_id: site.id,
        site_name: site.name,
        name: contact.name,
        role: contact.role,
        email: contact.email || '',
        phone: contact.phone || ''
      });
    });
  });
  const contactsSheet = XLSX.utils.json_to_sheet(contactsData);
  XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contacts');

  // Telecharger le fichier
  XLSX.writeFile(workbook, filename);
}

/**
 * Genere un fichier modele Excel vide avec les bonnes colonnes
 */
export function downloadTemplate(): void {
  const workbook = XLSX.utils.book_new();

  // Feuille Sites avec exemple
  const sitesExample = [{
    id: 'cfdt-exemple',
    name: 'CFDT Exemple',
    enabled: 'Oui',
    frontend_url: 'https://www.cfdt-exemple.fr',
    backend_url: 'https://www.cfdt-exemple.fr/administrator',
    phpmyadmin_url: 'https://phpmyadmin.server.net',
    admintools_login: 'sectionsu',
    mysql_host: 'sqlprive-xxx.eu.clouddb.ovh.net:35315',
    database: 'cfdt-exemple',
    prefix: 'jos_',
    ovh_vps: 'sqlprive-xxx - ancien',
    joomla_version: '5.4.2',
    php_version: '8.2.9',
    template: 'CFDT',
    ga_id: 'G-XXXXXXXXXX',
    gtm_id: 'GTM-XXXXXXXX',
    cookie_solution: 'Tarteaucitron',
    looker_report_url: 'https://lookerstudio.google.com/s/xxx',
    enpass_backend_protection: '[CFDT-Exemple] Backend Protection',
    enpass_joomla_admin: '[Exemple] Joomla Admin',
    enpass_mysql_su: '[Exemple] MySQL Root',
    enpass_mysql_std: '',
    notes: 'Notes sur le site'
  }];
  const sitesSheet = XLSX.utils.json_to_sheet(sitesExample);
  XLSX.utils.book_append_sheet(workbook, sitesSheet, 'Sites');

  // Feuille Comptes Joomla
  const accountsExample = [{
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    username: 'admin',
    role: 'Super Administrateur',
    enpass_ref: '[Exemple] Joomla Admin'
  }, {
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    username: 'editeur',
    role: 'Editeur',
    enpass_ref: '[Exemple] Editeur 1'
  }];
  const accountsSheet = XLSX.utils.json_to_sheet(accountsExample);
  XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Comptes Joomla');

  // Feuille Extensions
  const extensionsExample = [{
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    name: 'Akeeba Backup',
    version: '10.2.2',
    critical: 'Oui'
  }, {
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    name: 'JCE',
    version: '2.9.45',
    critical: 'Non'
  }];
  const extensionsSheet = XLSX.utils.json_to_sheet(extensionsExample);
  XLSX.utils.book_append_sheet(workbook, extensionsSheet, 'Extensions');

  // Feuille Checklist
  const checklistExample = [{
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    task: 'Mise a jour Joomla',
    done: 'Oui',
    date: '2025-01-15'
  }];
  const checklistSheet = XLSX.utils.json_to_sheet(checklistExample);
  XLSX.utils.book_append_sheet(workbook, checklistSheet, 'Checklist');

  // Feuille Interventions
  const interventionsExample = [{
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    date: '2025-01-20',
    type: 'Mise a jour Joomla',
    description: 'Mise a jour de Joomla 5.3 vers 5.4',
    duration: '30 min',
    result: 'Succes'
  }];
  const interventionsSheet = XLSX.utils.json_to_sheet(interventionsExample);
  XLSX.utils.book_append_sheet(workbook, interventionsSheet, 'Interventions');

  // Feuille Contacts
  const contactsExample = [{
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    name: 'Jean Dupont',
    role: 'Responsable Communication',
    email: 'jean.dupont@cfdt.fr',
    phone: '06 12 34 56 78'
  }];
  const contactsSheet = XLSX.utils.json_to_sheet(contactsExample);
  XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contacts');

  XLSX.writeFile(workbook, 'cockpit-cfdt-template.xlsx');
}

/** Interface pour les lignes brutes de l'Excel */
interface SiteRow {
  id?: string;
  name?: string;
  enabled?: string | boolean;
  frontend_url?: string;
  backend_url?: string;
  phpmyadmin_url?: string;
  admintools_login?: string;
  mysql_host?: string;
  database?: string;
  prefix?: string;
  ovh_vps?: string;
  joomla_version?: string;
  php_version?: string;
  template?: string;
  ga_id?: string;
  gtm_id?: string;
  cookie_solution?: string;
  looker_report_url?: string;
  enpass_backend_protection?: string;
  dashlane_backend_protection?: string;
  enpass_joomla_admin?: string;
  dashlane_joomla_admin?: string;
  enpass_mysql_su?: string;
  dashlane_mysql_su?: string;
  enpass_mysql_std?: string;
  dashlane_mysql_std?: string;
  notes?: string;
}

interface AccountRow {
  site_id?: string;
  username?: string;
  role?: string;
  enpass_ref?: string;
  dashlane_ref?: string;
}

interface ExtensionRow {
  site_id?: string;
  name?: string;
  version?: string;
  critical?: string | boolean;
}

interface ChecklistRow {
  site_id?: string;
  task?: string;
  done?: string | boolean;
  date?: string;
}

interface InterventionRow {
  site_id?: string;
  date?: string;
  type?: string;
  description?: string;
  duration?: string;
  result?: string;
}

interface ContactRow {
  site_id?: string;
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

/**
 * Import des donnees depuis un fichier Excel
 */
export async function importFromExcel(file: File): Promise<Site[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        // Validation du resultat de lecture
        if (!e.target?.result || !(e.target.result instanceof ArrayBuffer)) {
          throw new Error('Erreur de lecture du contenu du fichier');
        }

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Lire la feuille Sites
        const sitesSheet = workbook.Sheets['Sites'];
        if (!sitesSheet) {
          throw new Error('Feuille "Sites" non trouvee dans le fichier');
        }
        const sitesRaw = XLSX.utils.sheet_to_json<SiteRow>(sitesSheet);

        // Lire les autres feuilles
        const accountsSheet = workbook.Sheets['Comptes Joomla'];
        const accountsRaw: AccountRow[] = accountsSheet ? XLSX.utils.sheet_to_json<AccountRow>(accountsSheet) : [];

        const extensionsSheet = workbook.Sheets['Extensions'];
        const extensionsRaw: ExtensionRow[] = extensionsSheet ? XLSX.utils.sheet_to_json<ExtensionRow>(extensionsSheet) : [];

        const checklistSheet = workbook.Sheets['Checklist'];
        const checklistRaw: ChecklistRow[] = checklistSheet ? XLSX.utils.sheet_to_json<ChecklistRow>(checklistSheet) : [];

        const interventionsSheet = workbook.Sheets['Interventions'];
        const interventionsRaw: InterventionRow[] = interventionsSheet ? XLSX.utils.sheet_to_json<InterventionRow>(interventionsSheet) : [];

        const contactsSheet = workbook.Sheets['Contacts'];
        const contactsRaw: ContactRow[] = contactsSheet ? XLSX.utils.sheet_to_json<ContactRow>(contactsSheet) : [];

        // Construire les sites
        const sites: Site[] = sitesRaw.map((row: SiteRow) => {
          // Generer un ID unique avec crypto.randomUUID si disponible
          const siteId = row.id || (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `site-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);

          // Recuperer les donnees liees a ce site
          const siteAccounts: JoomlaAccount[] = accountsRaw
            .filter((a: AccountRow) => a.site_id === siteId)
            .map((a: AccountRow) => ({
              username: a.username || '',
              role: a.role || 'Editeur',
              enpass_ref: a.enpass_ref || a.dashlane_ref || null
            }));

          const siteExtensions: Extension[] = extensionsRaw
            .filter((ext: ExtensionRow) => ext.site_id === siteId)
            .map((ext: ExtensionRow) => ({
              name: ext.name || '',
              version: ext.version || null,
              critical: ext.critical === 'Oui' || ext.critical === true
            }));

          const siteChecklist: ChecklistItem[] = checklistRaw
            .filter((c: ChecklistRow) => c.site_id === siteId)
            .map((c: ChecklistRow) => ({
              task: c.task || '',
              done: c.done === 'Oui' || c.done === true,
              date: c.date || null
            }));

          const siteInterventions: Intervention[] = interventionsRaw
            .filter((i: InterventionRow) => i.site_id === siteId)
            .map((i: InterventionRow) => ({
              date: i.date || new Date().toISOString().split('T')[0],
              type_intervention: i.type || 'Autre',
              description: i.description || '',
              duration: i.duration || 'Non specifie',
              result: i.result || 'Non specifie'
            }));

          const siteContacts: Contact[] = contactsRaw
            .filter((c: ContactRow) => c.site_id === siteId)
            .map((c: ContactRow) => ({
              name: c.name || '',
              role: c.role || '',
              email: c.email || null,
              phone: c.phone || null
            }));

          return {
            id: siteId,
            name: row.name || 'Site sans nom',
            enabled: row.enabled === 'Oui' || row.enabled === true,
            urls: {
              frontend: row.frontend_url || '',
              backend: row.backend_url || '',
              phpmyadmin: row.phpmyadmin_url || ''
            },
            enpass_refs: {
              backend_protection: row.enpass_backend_protection || row.dashlane_backend_protection || null,
              joomla_admin: row.enpass_joomla_admin || row.dashlane_joomla_admin || '',
              mysql_su: row.enpass_mysql_su || row.dashlane_mysql_su || '',
              mysql_std: row.enpass_mysql_std || row.dashlane_mysql_std || null,
              editors: []
            },
            admintools_login: row.admintools_login || null,
            server: {
              mysql_host: row.mysql_host || '',
              database: row.database || '',
              prefix: row.prefix || 'jos_',
              ovh_vps: row.ovh_vps || ''
            },
            tech: {
              joomla_version: row.joomla_version || '',
              php_version: row.php_version || '',
              template: row.template || ''
            },
            analytics: (row.ga_id || row.gtm_id || row.cookie_solution || row.looker_report_url) ? {
              ga_id: row.ga_id || null,
              gtm_id: row.gtm_id || null,
              cookie_solution: row.cookie_solution || null,
              looker_report_url: row.looker_report_url || null
            } : null,
            joomla_accounts: siteAccounts,
            extensions: siteExtensions,
            checklist: siteChecklist,
            interventions: siteInterventions,
            contacts: siteContacts,
            notes: row.notes || '',
            last_update: new Date().toISOString()
          };
        });

        resolve(sites);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}
