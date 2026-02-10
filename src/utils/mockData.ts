// Données de test pour le mode développement
import { AppData, Site } from '../types';

export function getMockData(): AppData {
  const now = new Date().toISOString();

  const mockSites: Site[] = [
    {
      id: 'cfdt-ulogistique',
      name: 'CFDT Ulogistique',
      enabled: true,
      urls: {
        frontend: 'https://cfdt-ulogistique.fr',
        backend: 'https://cfdt-ulogistique.fr/administrator',
        phpmyadmin: 'https://phpmyadmin.vps1.ovh.net',
      },
      dashlane_refs: {
        backend_protection: '[ULog] Protection Admin',
        joomla_admin: '[ULog] Joomla Super Admin',
        mysql_su: '[ULog] MySQL Root',
        mysql_std: '[ULog] MySQL Standard',
        editors: ['[ULog] Éditeur 1', '[ULog] Éditeur 2'],
      },
      admintools_login: 'sectionsu',
      server: {
        mysql_host: 'mysql.vps1.ovh.net:3306',
        database: 'cfdt_ulog',
        prefix: 'jos_',
        ovh_vps: 'VPS 1 (OVH)',
      },
      tech: {
        joomla_version: '4.4.2',
        php_version: '8.1.27',
        template: 'Helix Ultimate',
      },
      analytics: {
        ga_id: 'G-1BW025Z89J',
        gtm_id: 'GTM-5HW7T884',
        cookie_solution: 'Tarteaucitron',
        looker_report_url: 'https://lookerstudio.google.com/s/oDWshSBmPag',
      },
      joomla_accounts: [
        { username: 'admin', role: 'Super Administrateur', dashlane_ref: '[ULog] Joomla Super Admin' },
        { username: 'editeur1', role: 'Éditeur', dashlane_ref: '[ULog] Éditeur 1' },
        { username: 'editeur2', role: 'Éditeur', dashlane_ref: '[ULog] Éditeur 2' },
      ],
      extensions: [
        { name: 'Akeeba Backup', version: '10.2.2', critical: true },
        { name: 'AdminTools', version: '7.8.5', critical: true },
        { name: 'DJ-ImageSlider', version: null, critical: false },
        { name: 'DJ-MegaMenu', version: null, critical: false },
        { name: 'JCE', version: '2.9.45', critical: false },
      ],
      checklist: [
        { task: 'Mise à jour Joomla 4.4.2', done: true, date: '2025-01-15' },
        { task: 'Backup mensuel', done: true, date: '2025-01-20' },
        { task: 'Vérifier extensions obsolètes', done: false, date: null },
        { task: 'Optimiser base de données', done: false, date: null },
      ],
      interventions: [
        {
          date: '2025-01-20',
          type_intervention: 'Mise à jour',
          description: 'Mise à jour Joomla 4.3.4 → 4.4.2',
          duration: '45 min',
          result: 'Succès - Site fonctionnel',
        },
        {
          date: '2025-01-10',
          type_intervention: 'Maintenance',
          description: 'Nettoyage cache et optimisation',
          duration: '20 min',
          result: 'Performance améliorée',
        },
      ],
      contacts: [
        {
          name: 'Marie Dubois',
          role: 'Responsable Communication',
          email: 'marie.dubois@cfdt-ulog.fr',
          phone: '06 12 34 56 78',
        },
      ],
      notes: 'Site principal avec fort trafic. Attention aux mises à jour en production.',
      last_update: now,
    },
    {
      id: 'cfdt-transport',
      name: 'CFDT Transport Réunion',
      enabled: true,
      urls: {
        frontend: 'https://cfdt-transport-reunion.re',
        backend: 'https://cfdt-transport-reunion.re/administrator',
        phpmyadmin: 'https://phpmyadmin.vps2.ovh.net',
      },
      dashlane_refs: {
        backend_protection: null,
        joomla_admin: '[Transport] Joomla Admin',
        mysql_su: '[Transport] MySQL Root',
        mysql_std: null,
        editors: ['[Transport] Rédacteur'],
      },
      admintools_login: null,
      server: {
        mysql_host: 'mysql.vps2.ovh.net:3306',
        database: 'cfdt_transport',
        prefix: 'jml_',
        ovh_vps: 'VPS 2 (OVH)',
      },
      tech: {
        joomla_version: '4.3.4',
        php_version: '8.1.25',
        template: 'Cassiopeia',
      },
      analytics: null,
      joomla_accounts: [
        { username: 'admin', role: 'Super Administrateur', dashlane_ref: '[Transport] Joomla Admin' },
      ],
      extensions: [
        { name: 'Akeeba Backup', version: '9.8.1', critical: true },
        { name: 'Regular Sourcerer', version: null, critical: false },
      ],
      checklist: [
        { task: 'Mise à jour Joomla urgente', done: false, date: null },
        { task: 'Revoir template', done: false, date: null },
      ],
      interventions: [
        {
          date: '2024-12-15',
          type_intervention: 'Correction',
          description: 'Fix affichage menu mobile',
          duration: '30 min',
          result: 'Résolu',
        },
      ],
      contacts: [
        {
          name: 'Jean Martin',
          role: 'Secrétaire Général',
          email: 'contact@cfdt-transport.re',
          phone: null,
        },
      ],
      notes: 'Mise à jour Joomla en retard - à planifier',
      last_update: now,
    },
    {
      id: 'cfdt-sante',
      name: 'CFDT Santé Sociaux',
      enabled: true,
      urls: {
        frontend: 'https://cfdt-sante-sociaux.fr',
        backend: 'https://cfdt-sante-sociaux.fr/admin',
        phpmyadmin: 'https://phpmyadmin.vps1.ovh.net',
      },
      dashlane_refs: {
        backend_protection: '[Santé] Htpasswd Admin',
        joomla_admin: '[Santé] Joomla Super Admin',
        mysql_su: '[Santé] MySQL Root',
        mysql_std: '[Santé] MySQL App',
        editors: ['[Santé] Éditeur Principal'],
      },
      admintools_login: 'sectionsu',
      server: {
        mysql_host: 'mysql.vps1.ovh.net:3306',
        database: 'cfdt_sante',
        prefix: 'jos_',
        ovh_vps: 'VPS 1 (OVH)',
      },
      tech: {
        joomla_version: '4.4.2',
        php_version: '8.2.15',
        template: 'Astroid Framework',
      },
      analytics: {
        ga_id: null,
        gtm_id: 'GTM-ABC123',
        cookie_solution: 'Tarteaucitron',
        looker_report_url: null,
      },
      joomla_accounts: [
        { username: 'admin', role: 'Super Administrateur', dashlane_ref: '[Santé] Joomla Super Admin' },
        { username: 'webmaster', role: 'Webmaster', dashlane_ref: '[Santé] Éditeur Principal' },
      ],
      extensions: [
        { name: 'Akeeba Backup', version: '10.2.2', critical: true },
        { name: 'AdminTools', version: '7.8.5', critical: true },
        { name: 'DropFiles', version: '5.3.0', critical: false },
        { name: 'JCE', version: '2.9.45', critical: false },
        { name: 'SP Page Builder', version: '5.0.1', critical: false },
      ],
      checklist: [
        { task: 'Backup hebdomadaire', done: true, date: '2025-01-27' },
        { task: 'Test formulaire contact', done: true, date: '2025-01-25' },
        { task: 'Mise à jour extensions', done: true, date: '2025-01-22' },
      ],
      interventions: [
        {
          date: '2025-01-27',
          type_intervention: 'Backup',
          description: 'Backup hebdomadaire automatique',
          duration: '5 min',
          result: 'OK - 2.1 GB',
        },
        {
          date: '2025-01-22',
          type_intervention: 'Mise à jour',
          description: 'Mise à jour de toutes les extensions',
          duration: '1h 15min',
          result: 'Toutes les extensions à jour',
        },
      ],
      contacts: [
        {
          name: 'Sophie Laurent',
          role: 'Webmaster',
          email: 'sophie.laurent@cfdt-sante.fr',
          phone: '06 98 76 54 32',
        },
        {
          name: 'Pierre Rousseau',
          role: 'Président',
          email: 'president@cfdt-sante.fr',
          phone: null,
        },
      ],
      notes: 'Site bien maintenu, à jour. Bonnes pratiques en place.',
      last_update: now,
    },
    {
      id: 'cfdt-metallurgie',
      name: 'CFDT Métallurgie',
      enabled: false,
      urls: {
        frontend: 'https://cfdt-metallurgie-archive.fr',
        backend: 'https://cfdt-metallurgie-archive.fr/administrator',
        phpmyadmin: 'https://phpmyadmin.vps3.ovh.net',
      },
      dashlane_refs: {
        backend_protection: null,
        joomla_admin: '[Métallurgie] Joomla Admin',
        mysql_su: '[Métallurgie] MySQL Root',
        mysql_std: null,
        editors: [],
      },
      admintools_login: null,
      server: {
        mysql_host: 'mysql.vps3.ovh.net:3306',
        database: 'cfdt_metal',
        prefix: 'jml_',
        ovh_vps: 'VPS 3 (OVH)',
      },
      tech: {
        joomla_version: '3.10.12',
        php_version: '7.4.33',
        template: 'Protostar',
      },
      analytics: null,
      joomla_accounts: [],
      extensions: [],
      checklist: [],
      interventions: [
        {
          date: '2024-06-15',
          type_intervention: 'Archivage',
          description: 'Site mis en archive (fusion régionale)',
          duration: '2h',
          result: 'Site archivé - accès maintenu',
        },
      ],
      contacts: [],
      notes: 'Site archivé depuis juin 2024 suite à fusion régionale.',
      last_update: '2024-06-15T10:00:00Z',
    },
  ];

  return {
    sites: mockSites,
    settings: {
      auto_lock_minutes: 5,
      auto_backup: true,
      backup_keep_days: 30,
      dashlane_cli_path: 'auto',
    },
  };
}
