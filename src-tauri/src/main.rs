// src-tauri/src/main.rs
// Point d'entree principal de Cockpit CFDT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cockpit_cfdt::{AppData, ConfigManager, StorageManager};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Etat interne de l'application, protege par un seul Mutex
/// pour eviter les inconsistances entre champs
struct AppStateInner {
    storage_manager: Option<StorageManager>,
    app_data: Option<AppData>,
    is_locked: bool,
    config_manager: Option<ConfigManager>,
}

pub struct AppState {
    inner: Mutex<AppStateInner>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(AppStateInner {
                storage_manager: None,
                app_data: None,
                is_locked: true,
                config_manager: None,
            }),
        }
    }
}

/// Helper pour verrouiller le mutex sans paniquer sur un mutex empoisonne
fn lock_state(state: &AppState) -> Result<std::sync::MutexGuard<'_, AppStateInner>, String> {
    state
        .inner
        .lock()
        .map_err(|_| "Erreur interne: etat de l'application corrompu".to_string())
}

#[tauri::command]
fn initialize_storage(app_dir: String, state: State<AppState>) -> Result<bool, String> {
    let path = PathBuf::from(&app_dir);
    let storage = StorageManager::new(&path).map_err(|e| format!("Erreur: {}", e))?;
    let exists = storage.exists();

    let config = ConfigManager::new(&path).map_err(|e| format!("Erreur config: {}", e))?;

    let mut inner = lock_state(&state)?;
    inner.storage_manager = Some(storage);
    inner.config_manager = Some(config);

    Ok(exists)
}

#[tauri::command]
fn create_initial_data(password: String, state: State<AppState>) -> Result<(), String> {
    let inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    storage
        .initialize(&password)
        .map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

#[tauri::command]
fn unlock(password: String, state: State<AppState>) -> Result<AppData, String> {
    let mut inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    let data = storage
        .load(&password)
        .map_err(|e| format!("Erreur: {}", e))?;
    // Mise a jour atomique des deux champs
    inner.app_data = Some(data.clone());
    inner.is_locked = false;
    Ok(data)
}

#[tauri::command]
fn lock(state: State<AppState>) -> Result<(), String> {
    let mut inner = lock_state(&state)?;
    inner.app_data = None;
    inner.is_locked = true;
    Ok(())
}

#[tauri::command]
fn is_locked(state: State<AppState>) -> Result<bool, String> {
    let inner = lock_state(&state)?;
    Ok(inner.is_locked)
}

#[tauri::command]
fn save_data(password: String, data: AppData, state: State<AppState>) -> Result<(), String> {
    let mut inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    storage
        .save(&data, &password, true)
        .map_err(|e| format!("Erreur: {}", e))?;
    inner.app_data = Some(data);
    Ok(())
}

#[tauri::command]
fn get_data(state: State<AppState>) -> Result<AppData, String> {
    let inner = lock_state(&state)?;
    inner
        .app_data
        .as_ref()
        .ok_or("Application verrouillee".to_string())
        .cloned()
}

#[tauri::command]
fn change_password(
    old_password: String,
    new_password: String,
    state: State<AppState>,
) -> Result<(), String> {
    let inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;

    // Verifier l'ancien mot de passe en chargeant les donnees
    let data = storage
        .load(&old_password)
        .map_err(|_| "Ancien mot de passe incorrect")?;

    // Sauvegarder avec le nouveau mot de passe
    storage
        .save(&data, &new_password, true)
        .map_err(|e| format!("Erreur: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_data_location(state: State<AppState>) -> Result<String, String> {
    let inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    let path = storage.get_data_dir();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn set_data_location(new_path: String, state: State<AppState>) -> Result<(), String> {
    use std::fs;

    let new_dir = PathBuf::from(&new_path);

    // Valider que le chemin est un repertoire existant et accessible
    if !new_dir.exists() {
        return Err(format!("Le dossier '{}' n'existe pas", new_path));
    }
    if !new_dir.is_dir() {
        return Err(format!("'{}' n'est pas un dossier", new_path));
    }

    // Canonicaliser le chemin pour resoudre les symlinks et ..
    let new_dir = new_dir
        .canonicalize()
        .map_err(|e| format!("Chemin invalide: {}", e))?;

    let mut inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    let old_dir = storage.get_data_dir().to_path_buf();

    // Verifier que ce n'est pas le meme dossier
    let old_canonical = old_dir.canonicalize().unwrap_or_else(|_| old_dir.clone());
    if old_canonical == new_dir {
        return Err("Le nouvel emplacement est identique a l'ancien".to_string());
    }

    // Deplacer sites.encrypted s'il existe
    let old_data_file = old_dir.join("sites.encrypted");
    let new_data_file = new_dir.join("sites.encrypted");

    if old_data_file.exists() {
        fs::copy(&old_data_file, &new_data_file)
            .map_err(|e| format!("Erreur lors de la copie de sites.encrypted: {}", e))?;
    }

    // Deplacer le dossier backups s'il existe
    let old_backup_dir = old_dir.join("backups");
    let new_backup_dir = new_dir.join("backups");

    if old_backup_dir.exists() {
        if !new_backup_dir.exists() {
            fs::create_dir_all(&new_backup_dir)
                .map_err(|e| format!("Erreur lors de la creation du dossier backups: {}", e))?;
        }

        for entry in fs::read_dir(&old_backup_dir)
            .map_err(|e| format!("Erreur lors de la lecture des backups: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Erreur: {}", e))?;
            let file_name = entry.file_name();
            let old_file = old_backup_dir.join(&file_name);
            let new_file = new_backup_dir.join(&file_name);

            if old_file.is_file() {
                fs::copy(&old_file, &new_file).map_err(|e| {
                    format!(
                        "Erreur lors de la copie de {}: {}",
                        file_name.to_string_lossy(),
                        e
                    )
                })?;
            }
        }
    }

    // Sauvegarder le nouvel emplacement dans la config
    if let Some(config) = inner.config_manager.as_ref() {
        config
            .set_custom_data_location(Some(new_dir.to_string_lossy().to_string()))
            .map_err(|e| format!("Erreur lors de la sauvegarde de la config: {}", e))?;
    }

    // Re-initialiser le StorageManager avec le nouveau chemin
    let new_storage = StorageManager::new(&new_dir)
        .map_err(|e| format!("Erreur re-initialisation du storage: {}", e))?;
    inner.storage_manager = Some(new_storage);

    Ok(())
}

#[tauri::command]
fn list_backups(state: State<AppState>) -> Result<Vec<String>, String> {
    let inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    storage.list_backups().map_err(|e| format!("Erreur: {}", e))
}

#[tauri::command]
fn restore_backup(backup_name: String, state: State<AppState>) -> Result<(), String> {
    let mut inner = lock_state(&state)?;
    let storage = inner
        .storage_manager
        .as_ref()
        .ok_or("Storage non initialise")?;
    storage
        .restore_backup(&backup_name)
        .map_err(|e| format!("Erreur: {}", e))?;
    inner.app_data = None;
    inner.is_locked = true;
    Ok(())
}

#[tauri::command]
fn get_custom_data_location(config_dir: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&config_dir);
    let config = ConfigManager::new(&path)
        .map_err(|e| format!("Erreur lors de l'initialisation de la config: {}", e))?;

    config
        .get_custom_data_location()
        .map_err(|e| format!("Erreur lors de la lecture de la config: {}", e))
}

// =========================================================================
// Commandes Enpass (lecture directe du vault SQLCipher, local ou WebDAV)
// =========================================================================

use cockpit_cfdt::enpass;

/// Resultat d'une commande Enpass
#[derive(serde::Serialize)]
struct EnpassCliResult {
    success: bool,
    message: String,
    data: Option<String>,
}

/// Construit un VaultConfig a partir des parametres de la commande
fn build_vault_config<'a>(
    vault_path: &'a str,
    vault_mode: &'a str,
    webdav_url: &'a str,
    pcloud_username: &'a str,
    pcloud_password: &'a str,
) -> enpass::VaultConfig<'a> {
    enpass::VaultConfig {
        vault_path,
        mode: vault_mode,
        webdav_url,
        pcloud_username,
        pcloud_password,
    }
}

/// Recupere le mot de passe d'une entree Enpass
#[tauri::command]
fn enpass_get_password(
    vault_path: String,
    entry_name: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::get_password_with_config(&config, &entry_name, &master_password) {
        Ok(password) => Ok(EnpassCliResult {
            success: true,
            message: "Mot de passe recupere".to_string(),
            data: Some(password),
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur: {}", e),
            data: None,
        }),
    }
}

/// Affiche les details d'une entree Enpass (login + password + url)
#[tauri::command]
fn enpass_show_entry(
    vault_path: String,
    entry_name: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::show_entry_with_config(&config, &entry_name, &master_password) {
        Ok(json_data) => Ok(EnpassCliResult {
            success: true,
            message: "Entree trouvee".to_string(),
            data: Some(json_data),
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur: {}", e),
            data: None,
        }),
    }
}

/// Recupere le mot de passe d'une entree (alias pour copy - le frontend
/// gere le presse-papiers via navigator.clipboard.writeText)
#[tauri::command]
fn enpass_copy_password(
    vault_path: String,
    entry_name: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::get_password_with_config(&config, &entry_name, &master_password) {
        Ok(password) => Ok(EnpassCliResult {
            success: true,
            message: "Mot de passe recupere".to_string(),
            data: Some(password),
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur: {}", e),
            data: None,
        }),
    }
}

/// Cree une nouvelle entree dans le vault Enpass
#[tauri::command]
fn enpass_create_entry(
    vault_path: String,
    title: String,
    login: String,
    password: String,
    url: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::create_entry_with_config(
        &config,
        &title,
        &login,
        &password,
        &url,
        &master_password,
    ) {
        Ok(uuid) => Ok(EnpassCliResult {
            success: true,
            message: format!("Entree '{}' creee dans Enpass ({})", title, uuid),
            data: None,
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur creation: {}", e),
            data: None,
        }),
    }
}

/// Liste les entrees Enpass correspondant a un filtre
#[tauri::command]
fn enpass_list_entries(
    vault_path: String,
    filter: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::list_entries_with_config(&config, &filter, &master_password) {
        Ok(entries) => {
            let json = serde_json::to_string(&entries)
                .map_err(|e| format!("Erreur serialisation: {}", e))?;
            Ok(EnpassCliResult {
                success: true,
                message: "Liste recuperee".to_string(),
                data: Some(json),
            })
        }
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur: {}", e),
            data: None,
        }),
    }
}

/// Detecte automatiquement les vaults Enpass sur la machine
#[tauri::command]
fn enpass_detect_vaults() -> Result<Vec<String>, String> {
    Ok(enpass::detect_vaults())
}

/// Verifie que le vault Enpass est accessible
#[tauri::command]
fn enpass_check_setup(
    vault_path: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::check_setup_with_config(&config, &master_password) {
        Ok(()) => Ok(EnpassCliResult {
            success: true,
            message: "Vault Enpass accessible et configure correctement".to_string(),
            data: None,
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur configuration: {}", e),
            data: None,
        }),
    }
}

/// Diagnostic de recherche Enpass : aide a comprendre pourquoi une entree n'est pas trouvee
#[tauri::command]
fn enpass_debug_search(
    vault_path: String,
    search_term: String,
    master_password: String,
    vault_mode: Option<String>,
    webdav_url: Option<String>,
    pcloud_username: Option<String>,
    pcloud_password: Option<String>,
) -> Result<EnpassCliResult, String> {
    let mode = vault_mode.unwrap_or_default();
    let wurl = webdav_url.unwrap_or_default();
    let puser = pcloud_username.unwrap_or_default();
    let ppass = pcloud_password.unwrap_or_default();
    let config = build_vault_config(&vault_path, &mode, &wurl, &puser, &ppass);

    match enpass::debug_search_with_config(&config, &search_term, &master_password) {
        Ok(info) => Ok(EnpassCliResult {
            success: true,
            message: "Diagnostic termine".to_string(),
            data: Some(info),
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur diagnostic: {}", e),
            data: None,
        }),
    }
}

/// Synchronise le vault Enpass depuis pCloud WebDAV (force le re-telechargement)
#[tauri::command]
fn enpass_sync_webdav(
    webdav_url: String,
    pcloud_username: String,
    pcloud_password: String,
) -> Result<EnpassCliResult, String> {
    match enpass::sync_webdav_vault(&webdav_url, &pcloud_username, &pcloud_password) {
        Ok(msg) => Ok(EnpassCliResult {
            success: true,
            message: msg,
            data: None,
        }),
        Err(e) => Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur synchronisation: {}", e),
            data: None,
        }),
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            initialize_storage,
            create_initial_data,
            unlock,
            lock,
            is_locked,
            save_data,
            get_data,
            list_backups,
            restore_backup,
            change_password,
            get_data_location,
            set_data_location,
            get_custom_data_location,
            // Commandes Enpass (lecture directe du vault, local ou WebDAV)
            enpass_get_password,
            enpass_show_entry,
            enpass_copy_password,
            enpass_create_entry,
            enpass_list_entries,
            enpass_check_setup,
            enpass_detect_vaults,
            enpass_sync_webdav,
            enpass_debug_search,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
