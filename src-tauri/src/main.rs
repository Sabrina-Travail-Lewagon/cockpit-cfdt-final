// src-tauri/src/main.rs
// Point d'entrée principal de Cockpit CFDT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cockpit_cfdt::*;

fn main() {
    tauri::Builder::default()
        // Initialiser l'état de l'application
        .manage(AppState::new())
        // Enregistrer les commands disponibles depuis le frontend
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
