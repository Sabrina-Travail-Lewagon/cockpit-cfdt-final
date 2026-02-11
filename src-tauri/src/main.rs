// src-tauri/src/main.rs
// Point d'entrée principal de Cockpit CFDT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cockpit_cfdt::{AppData, ConfigManager, StorageManager};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    storage_manager: Mutex<Option<StorageManager>>,
    app_data: Mutex<Option<AppData>>,
    is_locked: Mutex<bool>,
    config_manager: Mutex<Option<ConfigManager>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            storage_manager: Mutex::new(None),
            app_data: Mutex::new(None),
            is_locked: Mutex::new(true),
            config_manager: Mutex::new(None),
        }
    }
}

#[tauri::command]
fn initialize_storage(app_dir: String, state: State<AppState>) -> Result<bool, String> {
    let path = PathBuf::from(&app_dir);
    let storage = StorageManager::new(&path).map_err(|e| format!("Erreur: {}", e))?;
    let exists = storage.exists();
    *state.storage_manager.lock().unwrap() = Some(storage);

    // Initialiser le ConfigManager avec le même répertoire
    let config = ConfigManager::new(&path).map_err(|e| format!("Erreur config: {}", e))?;
    *state.config_manager.lock().unwrap() = Some(config);

    Ok(exists)
}

#[tauri::command]
fn create_initial_data(password: String, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage
        .initialize(&password)
        .map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

#[tauri::command]
fn unlock(password: String, state: State<AppState>) -> Result<AppData, String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    let data = storage
        .load(&password)
        .map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = Some(data.clone());
    *state.is_locked.lock().unwrap() = false;
    Ok(data)
}

#[tauri::command]
fn lock(state: State<AppState>) -> Result<(), String> {
    *state.app_data.lock().unwrap() = None;
    *state.is_locked.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
fn is_locked(state: State<AppState>) -> Result<bool, String> {
    Ok(*state.is_locked.lock().unwrap())
}

#[tauri::command]
fn save_data(password: String, data: AppData, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage
        .save(&data, &password, true)
        .map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = Some(data);
    Ok(())
}

#[tauri::command]
fn get_data(state: State<AppState>) -> Result<AppData, String> {
    let data_guard = state.app_data.lock().unwrap();
    data_guard
        .as_ref()
        .ok_or("Application verrouillée".to_string())
        .cloned()
}

#[tauri::command]
fn change_password(
    old_password: String,
    new_password: String,
    state: State<AppState>,
) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;

    // Vérifier l'ancien mot de passe en chargeant les données
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
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;

    // Récupérer le chemin actuel depuis le storage manager
    let path = storage.get_data_dir();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn set_data_location(new_path: String, state: State<AppState>) -> Result<(), String> {
    use std::fs;

    let new_dir = PathBuf::from(&new_path);

    // Vérifier que le dossier existe
    if !new_dir.exists() {
        return Err(format!("Le dossier '{}' n'existe pas", new_path));
    }

    // Récupérer l'ancien emplacement
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    let old_dir = storage.get_data_dir().to_path_buf();

    // Vérifier que ce n'est pas le même dossier
    if old_dir == new_dir {
        return Err("Le nouvel emplacement est identique à l'ancien".to_string());
    }

    drop(storage_guard); // Libérer le lock

    // Déplacer sites.encrypted s'il existe
    let old_data_file = old_dir.join("sites.encrypted");
    let new_data_file = new_dir.join("sites.encrypted");

    if old_data_file.exists() {
        fs::copy(&old_data_file, &new_data_file)
            .map_err(|e| format!("Erreur lors de la copie de sites.encrypted: {}", e))?;
    }

    // Déplacer le dossier backups s'il existe
    let old_backup_dir = old_dir.join("backups");
    let new_backup_dir = new_dir.join("backups");

    if old_backup_dir.exists() {
        // Créer le dossier backups dans le nouveau dossier
        if !new_backup_dir.exists() {
            fs::create_dir_all(&new_backup_dir)
                .map_err(|e| format!("Erreur lors de la création du dossier backups: {}", e))?;
        }

        // Copier tous les fichiers de backup
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
    let config_guard = state.config_manager.lock().unwrap();
    if let Some(config) = config_guard.as_ref() {
        config
            .set_custom_data_location(Some(new_path))
            .map_err(|e| format!("Erreur lors de la sauvegarde de la config: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn list_backups(state: State<AppState>) -> Result<Vec<String>, String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage.list_backups().map_err(|e| format!("Erreur: {}", e))
}

#[tauri::command]
fn restore_backup(backup_name: String, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage
        .restore_backup(&backup_name)
        .map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = None;
    *state.is_locked.lock().unwrap() = true;
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
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
