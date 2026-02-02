// Cockpit CFDT - Bibliothèque principale
// Force rebuild: 2025-02-02-09:15:00-FINAL

pub mod crypto;
pub mod storage;

use storage::{AppData, StorageManager};
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::State;

pub struct AppState {
    storage_manager: Mutex<Option<StorageManager>>,
    app_data: Mutex<Option<AppData>>,
    is_locked: Mutex<bool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            storage_manager: Mutex::new(None),
            app_data: Mutex::new(None),
            is_locked: Mutex::new(true),
        }
    }
}

#[tauri::command]
pub fn initialize_storage(app_dir: String, state: State<AppState>) -> Result<bool, String> {
    let path = PathBuf::from(&app_dir);
    let storage = StorageManager::new(&path).map_err(|e| format!("Erreur: {}", e))?;
    let exists = storage.exists();
    *state.storage_manager.lock().unwrap() = Some(storage);
    Ok(exists)
}

#[tauri::command]
pub fn create_initial_data(password: String, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage.initialize(&password).map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn unlock(password: String, state: State<AppState>) -> Result<AppData, String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    let data = storage.load(&password).map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = Some(data.clone());
    *state.is_locked.lock().unwrap() = false;
    Ok(data)
}

#[tauri::command]
pub fn lock(state: State<AppState>) -> Result<(), String> {
    *state.app_data.lock().unwrap() = None;
    *state.is_locked.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
pub fn is_locked(state: State<AppState>) -> Result<bool, String> {
    Ok(*state.is_locked.lock().unwrap())
}

#[tauri::command]
pub fn save_data(password: String, data: AppData, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage.save(&data, &password, true).map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = Some(data);
    Ok(())
}

#[tauri::command]
pub fn get_data(state: State<AppState>) -> Result<AppData, String> {
    let data_guard = state.app_data.lock().unwrap();
    data_guard.as_ref().ok_or("Application verrouillée".to_string()).cloned()
}

#[tauri::command]
pub fn list_backups(state: State<AppState>) -> Result<Vec<String>, String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage.list_backups().map_err(|e| format!("Erreur: {}", e))
}

#[tauri::command]
pub fn restore_backup(backup_name: String, state: State<AppState>) -> Result<(), String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    storage.restore_backup(&backup_name).map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = None;
    *state.is_locked.lock().unwrap() = true;
    Ok(())
}
