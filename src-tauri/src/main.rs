// src-tauri/src/main.rs
// Point d'entrée principal de Cockpit CFDT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cockpit_cfdt::{AppData, StorageManager};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    storage_manager: Mutex<Option<StorageManager>>,
    app_data: Mutex<Option<AppData>>,
    is_locked: Mutex<bool>,
    data_location: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            storage_manager: Mutex::new(None),
            app_data: Mutex::new(None),
            is_locked: Mutex::new(true),
            data_location: Mutex::new(None),
        }
    }
}

#[tauri::command]
fn initialize_storage(app_dir: String, state: State<AppState>) -> Result<bool, String> {
    let path = PathBuf::from(&app_dir);
    let storage = StorageManager::new(&path).map_err(|e| format!("Erreur: {}", e))?;
    let exists = storage.exists();
    *state.storage_manager.lock().unwrap() = Some(storage);
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
    let path = PathBuf::from(&new_path);

    // Vérifier que le dossier existe
    if !path.exists() {
        return Err(format!("Le dossier '{}' n'existe pas", new_path));
    }

    // Sauvegarder le nouvel emplacement dans l'état
    *state.data_location.lock().unwrap() = Some(path.clone());

    // Note: L'emplacement sera utilisé au prochain démarrage
    // Il faudrait idéalement le sauvegarder dans un fichier de config
    Ok(())
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
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
