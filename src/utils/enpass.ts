// Utilitaires pour interagir avec le vault Enpass
// Lecture directe du vault SQLCipher (local ou via pCloud WebDAV)

import { invoke } from '@tauri-apps/api/tauri';
import { EnpassResult, AppSettings } from '../types';

interface EnpassCliResult {
  success: boolean;
  message: string;
  data: string | null;
}

/** Delai avant effacement automatique du presse-papiers (30 secondes) */
const CLIPBOARD_CLEAR_DELAY_MS = 30_000;

/** Timer actuel pour l'effacement du clipboard */
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Efface le presse-papiers apres un delai pour ne pas laisser trainer les mots de passe.
 * Annule le timer precedent si un nouveau mot de passe est copie.
 */
function scheduleClipboardClear(): void {
  // Annuler le timer precedent
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
  }

  clipboardClearTimer = setTimeout(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // Ignorer les erreurs de clipboard (fenetre hors focus, etc.)
    }
    clipboardClearTimer = null;
  }, CLIPBOARD_CLEAR_DELAY_MS);
}

/**
 * Construit les parametres WebDAV a passer aux commandes Tauri
 * si le mode WebDAV est active dans les settings
 */
function getWebDavParams(settings: AppSettings, pcloudPassword: string) {
  if (settings.enpass_vault_mode === 'webdav') {
    return {
      vaultMode: 'webdav',
      webdavUrl: settings.enpass_webdav_url,
      pcloudUsername: settings.enpass_pcloud_username,
      pcloudPassword: pcloudPassword,
    };
  }
  return {
    vaultMode: '',
    webdavUrl: '',
    pcloudUsername: '',
    pcloudPassword: '',
  };
}

/**
 * Recupere le mot de passe d'une entree Enpass et le copie dans le presse-papiers
 */
export async function copyPasswordToClipboard(
  vaultPath: string,
  entryName: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_copy_password', {
      vaultPath,
      entryName,
      masterPassword,
      ...webdav,
    });

    if (result.success && result.data) {
      await navigator.clipboard.writeText(result.data);
      scheduleClipboardClear();
      return { success: true, message: 'Mot de passe copie dans le presse-papiers (efface dans 30s)' };
    }

    return { success: false, message: result.message };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Recupere le mot de passe d'une entree Enpass (retourne en string)
 */
export async function getPassword(
  vaultPath: string,
  entryName: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_get_password', {
      vaultPath,
      entryName,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
      data: result.data ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Recupere les details complets d'une entree Enpass (login, password, url)
 */
export async function showEntry(
  vaultPath: string,
  entryName: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_show_entry', {
      vaultPath,
      entryName,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
      data: result.data ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Copie le login d'une entree Enpass dans le presse-papiers
 * Recupere les details via show, parse le JSON, puis copie le username
 */
export async function copyLoginToClipboard(
  vaultPath: string,
  entryName: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_show_entry', {
      vaultPath,
      entryName,
      masterPassword,
      ...webdav,
    });

    if (result.success && result.data) {
      try {
        // Le backend retourne un objet JSON plat avec les champs de l'entree
        const entry = JSON.parse(result.data);

        // Chercher le login dans plusieurs champs possibles
        const login = entry.login ?? entry.username ?? entry.subtitle ?? '';
        if (login) {
          await navigator.clipboard.writeText(login);
          return { success: true, message: 'Login copie dans le presse-papiers' };
        }

        // Fallback : si c'est un tableau (ancien format)
        if (Array.isArray(entry) && entry.length > 0) {
          const firstLogin = entry[0].login ?? entry[0].username ?? '';
          if (firstLogin) {
            await navigator.clipboard.writeText(firstLogin);
            return { success: true, message: 'Login copie dans le presse-papiers' };
          }
        }

        return { success: false, message: 'Login non trouve dans l\'entree Enpass' };
      } catch {
        // Si ce n'est pas du JSON, essayer de parser en texte
        const lines = result.data.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('login') || line.toLowerCase().includes('username')) {
            const value = line.split(':').slice(1).join(':').trim();
            if (value) {
              await navigator.clipboard.writeText(value);
              return { success: true, message: 'Login copie dans le presse-papiers' };
            }
          }
        }
        return { success: false, message: 'Impossible de parser le login' };
      }
    }

    return { success: false, message: result.message };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Cree une nouvelle entree dans le vault Enpass
 */
export async function createEntry(
  vaultPath: string,
  title: string,
  login: string,
  password: string,
  url: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_create_entry', {
      vaultPath,
      title,
      login,
      password,
      url,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Liste les entrees Enpass correspondant a un filtre
 */
export async function listEntries(
  vaultPath: string,
  filter: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_list_entries', {
      vaultPath,
      filter,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
      data: result.data ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Verifie que le vault Enpass est accessible
 */
export async function checkSetup(
  vaultPath: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_check_setup', {
      vaultPath,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Synchronise le vault depuis pCloud WebDAV (force le re-telechargement)
 */
export async function syncWebDav(
  webdavUrl: string,
  pcloudUsername: string,
  pcloudPassword: string
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_sync_webdav', {
      webdavUrl,
      pcloudUsername,
      pcloudPassword,
    });

    return {
      success: result.success,
      message: result.message,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Diagnostic de recherche Enpass : aide a comprendre pourquoi une entree n'est pas trouvee
 */
export async function debugSearch(
  vaultPath: string,
  searchTerm: string,
  masterPassword: string,
  settings?: AppSettings,
  pcloudPassword?: string
): Promise<EnpassResult> {
  try {
    const webdav = settings ? getWebDavParams(settings, pcloudPassword || '') : { vaultMode: '', webdavUrl: '', pcloudUsername: '', pcloudPassword: '' };

    const result = await invoke<EnpassCliResult>('enpass_debug_search', {
      vaultPath,
      searchTerm,
      masterPassword,
      ...webdav,
    });

    return {
      success: result.success,
      message: result.message,
      data: result.data ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
