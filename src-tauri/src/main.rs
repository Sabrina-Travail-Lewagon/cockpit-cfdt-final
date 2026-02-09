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
    storage.initialize(&password).map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

#[tauri::command]
fn unlock(password: String, state: State<AppState>) -> Result<AppData, String> {
    let storage_guard = state.storage_manager.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage non initialisé")?;
    let data = storage.load(&password).map_err(|e| format!("Erreur: {}", e))?;
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
    storage.save(&data, &password, true).map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = Some(data);
    Ok(())
}

#[tauri::command]
fn get_data(state: State<AppState>) -> Result<AppData, String> {
    let data_guard = state.app_data.lock().unwrap();
    data_guard.as_ref().ok_or("Application verrouillée".to_string()).cloned()
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
    storage.restore_backup(&backup_name).map_err(|e| format!("Erreur: {}", e))?;
    *state.app_data.lock().unwrap() = None;
    *state.is_locked.lock().unwrap() = true;
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
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
