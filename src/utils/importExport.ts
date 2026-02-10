import * as XLSX from 'xlsx';
import { AppData, Site, Extension, ChecklistItem, Intervention, JoomlaAccount, Contact } from '../types';

/**
 * Export les données de l'application vers un fichier Excel
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
    dashlane_backend_protection: site.dashlane_refs.backend_protection || '',
    dashlane_joomla_admin: site.dashlane_refs.joomla_admin,
    dashlane_mysql_su: site.dashlane_refs.mysql_su,
    dashlane_mysql_std: site.dashlane_refs.mysql_std || '',
    notes: site.notes
  }));
  const sitesSheet = XLSX.utils.json_to_sheet(sitesData);
  XLSX.utils.book_append_sheet(workbook, sitesSheet, 'Sites');

  // Feuille 2: Comptes Joomla
  const accountsData: any[] = [];
  data.sites.forEach(site => {
    (site.joomla_accounts || []).forEach(account => {
      accountsData.push({
        site_id: site.id,
        site_name: site.name,
        username: account.username,
        role: account.role,
        dashlane_ref: account.dashlane_ref || ''
      });
    });
  });
  const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
  XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Comptes Joomla');

  // Feuille 3: Extensions
  const extensionsData: any[] = [];
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

  // Feuille 4: Checklist
  const checklistData: any[] = [];
  data.sites.forEach(site => {
    site.checklist.forEach(item => {
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

  // Feuille 5: Interventions
  const interventionsData: any[] = [];
  data.sites.forEach(site => {
    site.interventions.forEach(intervention => {
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

  // Feuille 6: Contacts
  const contactsData: any[] = [];
  data.sites.forEach(site => {
    site.contacts.forEach(contact => {
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

  // Télécharger le fichier
  XLSX.writeFile(workbook, filename);
}

/**
 * Génère un fichier modèle Excel vide avec les bonnes colonnes
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
    dashlane_backend_protection: '',
    dashlane_joomla_admin: '[Exemple] Joomla Admin',
    dashlane_mysql_su: '[Exemple] MySQL Root',
    dashlane_mysql_std: '',
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
    dashlane_ref: '[Exemple] Joomla Admin'
  }, {
    site_id: 'cfdt-exemple',
    site_name: 'CFDT Exemple',
    username: 'editeur',
    role: 'Éditeur',
    dashlane_ref: '[Exemple] Éditeur 1'
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
    task: 'Mise à jour Joomla',
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
    type: 'Mise à jour Joomla',
    description: 'Mise à jour de Joomla 5.3 vers 5.4',
    duration: '30 min',
    result: 'Succès'
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

/**
 * Import des données depuis un fichier Excel
 */
export async function importFromExcel(file: File): Promise<Site[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Lire la feuille Sites
        const sitesSheet = workbook.Sheets['Sites'];
        if (!sitesSheet) {
          throw new Error('Feuille "Sites" non trouvée dans le fichier');
        }
        const sitesRaw = XLSX.utils.sheet_to_json<any>(sitesSheet);

        // Lire les autres feuilles
        const accountsSheet = workbook.Sheets['Comptes Joomla'];
        const accountsRaw = accountsSheet ? XLSX.utils.sheet_to_json<any>(accountsSheet) : [];

        const extensionsSheet = workbook.Sheets['Extensions'];
        const extensionsRaw = extensionsSheet ? XLSX.utils.sheet_to_json<any>(extensionsSheet) : [];

        const checklistSheet = workbook.Sheets['Checklist'];
        const checklistRaw = checklistSheet ? XLSX.utils.sheet_to_json<any>(checklistSheet) : [];

        const interventionsSheet = workbook.Sheets['Interventions'];
        const interventionsRaw = interventionsSheet ? XLSX.utils.sheet_to_json<any>(interventionsSheet) : [];

        const contactsSheet = workbook.Sheets['Contacts'];
        const contactsRaw = contactsSheet ? XLSX.utils.sheet_to_json<any>(contactsSheet) : [];

        // Construire les sites
        const sites: Site[] = sitesRaw.map((row: any) => {
          const siteId = row.id || `site-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Récupérer les données liées à ce site
          const siteAccounts: JoomlaAccount[] = accountsRaw
            .filter((a: any) => a.site_id === siteId)
            .map((a: any) => ({
              username: a.username || '',
              role: a.role || 'Éditeur',
              dashlane_ref: a.dashlane_ref || null
            }));

          const siteExtensions: Extension[] = extensionsRaw
            .filter((e: any) => e.site_id === siteId)
            .map((e: any) => ({
              name: e.name || '',
              version: e.version || null,
              critical: e.critical === 'Oui' || e.critical === true
            }));

          const siteChecklist: ChecklistItem[] = checklistRaw
            .filter((c: any) => c.site_id === siteId)
            .map((c: any) => ({
              task: c.task || '',
              done: c.done === 'Oui' || c.done === true,
              date: c.date || null
            }));

          const siteInterventions: Intervention[] = interventionsRaw
            .filter((i: any) => i.site_id === siteId)
            .map((i: any) => ({
              date: i.date || new Date().toISOString().split('T')[0],
              type_intervention: i.type || 'Autre',
              description: i.description || '',
              duration: i.duration || 'Non spécifié',
              result: i.result || 'Non spécifié'
            }));

          const siteContacts: Contact[] = contactsRaw
            .filter((c: any) => c.site_id === siteId)
            .map((c: any) => ({
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
            dashlane_refs: {
              backend_protection: row.dashlane_backend_protection || null,
              joomla_admin: row.dashlane_joomla_admin || '',
              mysql_su: row.dashlane_mysql_su || '',
              mysql_std: row.dashlane_mysql_std || null,
              editors: []
            },
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
