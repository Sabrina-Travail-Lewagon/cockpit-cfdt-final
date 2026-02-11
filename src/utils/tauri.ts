// Utilitaires pour communiquer avec le backend Rust via Tauri
import { invoke } from '@tauri-apps/api/tauri';
import { AppData } from '../types';

/**
 * Initialise le gestionnaire de stockage
 */
export async function initializeStorage(appDir: string): Promise<boolean> {
  return await invoke<boolean>('initialize_storage', { appDir });
}

/**
 * Crée le fichier de données initial (première utilisation)
 */
export async function createInitialData(password: string): Promise<void> {
  return await invoke('create_initial_data', { password });
}

/**
 * Déverrouille l'application
 */
export async function unlock(password: string): Promise<AppData> {
  return await invoke<AppData>('unlock', { password });
}

/**
 * Verrouille l'application
 */
export async function lock(): Promise<void> {
  return await invoke('lock');
}

/**
 * Vérifie si l'application est verrouillée
 */
export async function isLocked(): Promise<boolean> {
  return await invoke<boolean>('is_locked');
}

/**
 * Sauvegarde les données
 */
export async function saveData(password: string, data: AppData): Promise<void> {
  return await invoke('save_data', { password, data });
}

/**
 * Récupère les données actuelles
 */
export async function getData(): Promise<AppData> {
  return await invoke<AppData>('get_data');
}

/**
 * Liste les backups disponibles
 */
export async function listBackups(): Promise<string[]> {
  return await invoke<string[]>('list_backups');
}

/**
 * Restaure depuis un backup
 */
export async function restoreBackup(backupName: string): Promise<void> {
  return await invoke('restore_backup', { backupName });
}

/**
 * Change le mot de passe maître
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return await invoke('change_password', { oldPassword, newPassword });
}

/**
 * Récupère l'emplacement actuel des données
 */
export async function getDataLocation(): Promise<string> {
  return await invoke<string>('get_data_location');
}

/**
 * Change l'emplacement des données
 */
export async function setDataLocation(newPath: string): Promise<void> {
  return await invoke('set_data_location', { newPath });
}
