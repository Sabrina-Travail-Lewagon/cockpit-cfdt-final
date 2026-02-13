// Types TypeScript pour Cockpit CFDT
// Correspondent exactement aux structures Rust dans storage.rs

export interface AppData {
  sites: Site[];
  settings: AppSettings;
}

export interface Site {
  id: string;
  name: string;
  enabled: boolean;
  urls: SiteUrls;
  enpass_refs: EnpassRefs;
  admintools_login: string | null;
  server: ServerInfo;
  tech: TechInfo;
  analytics: AnalyticsInfo | null;
  joomla_accounts: JoomlaAccount[];
  extensions: Extension[];
  checklist: ChecklistItem[];
  interventions: Intervention[];
  contacts: Contact[];
  notes: string;
  last_update: string;
}

export interface JoomlaAccount {
  username: string;
  role: string;
  enpass_ref: string | null;
}

export interface Extension {
  name: string;
  version: string | null;
  critical: boolean;
}

export interface SiteUrls {
  frontend: string;
  backend: string;
  phpmyadmin: string;
}

export interface EnpassRefs {
  backend_protection: string | null;
  joomla_admin: string;
  mysql_su: string;
  mysql_std: string | null;
  editors: string[];
}

// Resultat d'une commande enpass-cli
export interface EnpassEntry {
  title: string;
  username: string;
  password: string;
  url: string;
  note: string;
}

// Statut d'une operation enpass-cli
export interface EnpassResult {
  success: boolean;
  message: string;
  data?: string;
}

export interface ServerInfo {
  mysql_host: string;
  database: string;
  prefix: string;
  ovh_vps: string;
}

export interface TechInfo {
  joomla_version: string;
  php_version: string;
  template: string;
}

export interface AnalyticsInfo {
  ga_id: string | null;
  gtm_id: string | null;
  cookie_solution: string | null;
  looker_report_url: string | null;
}

export interface ChecklistItem {
  task: string;
  done: boolean;
  date: string | null;
}

export interface Intervention {
  date: string;
  type_intervention: string;
  description: string;
  duration: string;
  result: string;
}

export interface Contact {
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
}

export interface AppSettings {
  auto_lock_minutes: number;
  auto_backup: boolean;
  backup_keep_days: number;
  enpass_cli_path: string;
  enpass_vault_path: string;
  enpass_use_separate_password: boolean;
}

// Types pour l'état de l'application
export type AppStatus = 'locked' | 'unlocked' | 'initializing';

export interface AppState {
  status: AppStatus;
  data: AppData | null;
  currentSiteId: string | null;
}
