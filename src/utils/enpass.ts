// Utilitaires pour interagir avec Enpass via enpass-cli
// enpass-cli: https://github.com/hazcod/enpass-cli

import { invoke } from '@tauri-apps/api/tauri';
import { EnpassResult } from '../types';

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
 * Recupere le mot de passe d'une entree Enpass et le copie dans le presse-papiers
 */
export async function copyPasswordToClipboard(
  vaultPath: string,
  entryName: string,
  masterPassword: string,
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    // D'abord essayer la commande copy native de enpass-cli
    const result = await invoke<EnpassCliResult>('enpass_copy_password', {
      vaultPath,
      entryName,
      masterPassword,
      cliPath,
    });

    if (result.success) {
      scheduleClipboardClear();
      return { success: true, message: 'Mot de passe copie dans le presse-papiers (efface dans 30s)' };
    }

    // Fallback: recuperer le password et copier manuellement
    const passResult = await invoke<EnpassCliResult>('enpass_get_password', {
      vaultPath,
      entryName,
      masterPassword,
      cliPath,
    });

    if (passResult.success && passResult.data) {
      await navigator.clipboard.writeText(passResult.data);
      scheduleClipboardClear();
      return { success: true, message: 'Mot de passe copie dans le presse-papiers (efface dans 30s)' };
    }

    return { success: false, message: passResult.message };
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
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_get_password', {
      vaultPath,
      entryName,
      masterPassword,
      cliPath,
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
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_show_entry', {
      vaultPath,
      entryName,
      masterPassword,
      cliPath,
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
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_show_entry', {
      vaultPath,
      entryName,
      masterPassword,
      cliPath,
    });

    if (result.success && result.data) {
      try {
        // enpass-cli -json retourne un tableau JSON
        const entries = JSON.parse(result.data);
        if (Array.isArray(entries) && entries.length > 0) {
          const login = entries[0].login ?? entries[0].username ?? '';
          if (login) {
            await navigator.clipboard.writeText(login);
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
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_create_entry', {
      vaultPath,
      title,
      login,
      password,
      url,
      masterPassword,
      cliPath,
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
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_list_entries', {
      vaultPath,
      filter,
      masterPassword,
      cliPath,
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
 * Verifie que enpass-cli est installe et le vault est accessible
 */
export async function checkSetup(
  vaultPath: string,
  masterPassword: string,
  cliPath: string = 'auto'
): Promise<EnpassResult> {
  try {
    const result = await invoke<EnpassCliResult>('enpass_check_setup', {
      vaultPath,
      masterPassword,
      cliPath,
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
