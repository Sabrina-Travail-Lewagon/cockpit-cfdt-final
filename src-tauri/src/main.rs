// src-tauri/src/main.rs
// Point d'entree principal de Cockpit CFDT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cockpit_cfdt::{AppData, ConfigManager, StorageManager};
use std::path::PathBuf;
use std::process::Command;
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
// Commandes Enpass CLI
// =========================================================================

use std::time::Duration;

/// Timeout pour les commandes enpass-cli (15 secondes)
const ENPASS_CLI_TIMEOUT: Duration = Duration::from_secs(15);

/// Resultat d'une commande enpass-cli
#[derive(serde::Serialize)]
struct EnpassCliResult {
    success: bool,
    message: String,
    data: Option<String>,
}

/// Resout et valide le chemin de enpasscli.exe
fn resolve_enpass_cli(cli_path: &str) -> Result<String, String> {
    if cli_path == "auto" || cli_path.is_empty() {
        Ok("enpasscli".to_string())
    } else {
        let path = std::path::Path::new(cli_path);
        if !path.exists() {
            return Err(format!(
                "enpass-cli introuvable a l'emplacement: {}. Verifiez le chemin dans les parametres.",
                cli_path
            ));
        }
        Ok(cli_path.to_string())
    }
}

/// Fonction helper pour executer une commande enpass-cli
fn run_enpass_cli(
    cli_path: &str,
    vault_path: &str,
    master_password: &str,
    args: &[&str],
) -> Result<(bool, String, String), String> {
    let cli = resolve_enpass_cli(cli_path)?;

    let vault_arg = format!("-vault={}", vault_path);
    let mut full_args: Vec<&str> = vec![&vault_arg, "-nonInteractive"];
    full_args.extend_from_slice(args);

    let mut child = Command::new(&cli)
        .args(&full_args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Erreur lancement enpass-cli: {}. Verifiez que enpasscli est installe et accessible.",
                e
            )
        })?;

    // Envoyer le master password via stdin
    {
        use std::io::Write;
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "Impossible d'ouvrir stdin pour enpass-cli".to_string())?;
        writeln!(stdin, "{}", master_password)
            .map_err(|e| format!("Erreur envoi mot de passe a enpass-cli: {}", e))?;
    }

    // Attendre avec timeout
    let output = wait_with_timeout(&mut child, ENPASS_CLI_TIMEOUT)?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let success = output.status.success();

    Ok((success, stdout, stderr))
}

/// Attend la fin d'un process enfant avec un timeout
fn wait_with_timeout(
    child: &mut std::process::Child,
    timeout: Duration,
) -> Result<std::process::Output, String> {
    let start = std::time::Instant::now();
    let poll_interval = Duration::from_millis(100);

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                return child
                    .wait_with_output()
                    .map_err(|e| format!("Erreur lecture sortie enpass-cli: {}", e));
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    return Err(format!(
                        "enpass-cli n'a pas repondu dans les {} secondes. Le vault est peut-etre verrouille ou inaccessible.",
                        timeout.as_secs()
                    ));
                }
                std::thread::sleep(poll_interval);
            }
            Err(e) => {
                return Err(format!("Erreur attente enpass-cli: {}", e));
            }
        }
    }
}

/// Recupere le mot de passe d'une entree Enpass
#[tauri::command]
fn enpass_get_password(
    vault_path: String,
    entry_name: String,
    master_password: String,
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let (success, stdout, stderr) = run_enpass_cli(
        &cli_path,
        &vault_path,
        &master_password,
        &["pass", &entry_name],
    )?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: "Mot de passe recupere".to_string(),
            data: Some(stdout),
        })
    } else {
        Ok(EnpassCliResult {
            success: false,
            message: format!(
                "Erreur enpass-cli: {}",
                if !stderr.is_empty() { &stderr } else { &stdout }
            ),
            data: None,
        })
    }
}

/// Affiche les details d'une entree Enpass (login + password + url)
#[tauri::command]
fn enpass_show_entry(
    vault_path: String,
    entry_name: String,
    master_password: String,
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let (success, stdout, stderr) = run_enpass_cli(
        &cli_path,
        &vault_path,
        &master_password,
        &["-json", "show", &entry_name],
    )?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: "Entree trouvee".to_string(),
            data: Some(stdout),
        })
    } else {
        Ok(EnpassCliResult {
            success: false,
            message: format!(
                "Erreur: {}",
                if !stderr.is_empty() { &stderr } else { &stdout }
            ),
            data: None,
        })
    }
}

/// Copie le mot de passe dans le presse-papiers via enpass-cli
#[tauri::command]
fn enpass_copy_password(
    vault_path: String,
    entry_name: String,
    master_password: String,
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let (success, stdout, stderr) = run_enpass_cli(
        &cli_path,
        &vault_path,
        &master_password,
        &["copy", &entry_name],
    )?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: "Mot de passe copie dans le presse-papiers".to_string(),
            data: None,
        })
    } else {
        Ok(EnpassCliResult {
            success: false,
            message: format!(
                "Erreur: {}",
                if !stderr.is_empty() { &stderr } else { &stdout }
            ),
            data: None,
        })
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
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let title_arg = format!("-title={}", title);
    let login_arg = format!("-login={}", login);
    let pass_arg = format!("-password={}", password);
    let url_arg = format!("-url={}", url);

    let (success, stdout, stderr) = run_enpass_cli(
        &cli_path,
        &vault_path,
        &master_password,
        &["create", &title_arg, &login_arg, &pass_arg, &url_arg],
    )?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: format!("Entree '{}' creee dans Enpass", title),
            data: None,
        })
    } else {
        Ok(EnpassCliResult {
            success: false,
            message: format!(
                "Erreur creation: {}",
                if !stderr.is_empty() { &stderr } else { &stdout }
            ),
            data: None,
        })
    }
}

/// Liste les entrees Enpass correspondant a un filtre
#[tauri::command]
fn enpass_list_entries(
    vault_path: String,
    filter: String,
    master_password: String,
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let (success, stdout, stderr) = run_enpass_cli(
        &cli_path,
        &vault_path,
        &master_password,
        &["-json", "list", &filter],
    )?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: "Liste recuperee".to_string(),
            data: Some(stdout),
        })
    } else {
        Ok(EnpassCliResult {
            success: false,
            message: format!(
                "Erreur: {}",
                if !stderr.is_empty() { &stderr } else { &stdout }
            ),
            data: None,
        })
    }
}

/// Verifie que enpass-cli est accessible et le vault est valide
#[tauri::command]
fn enpass_check_setup(
    vault_path: String,
    master_password: String,
    cli_path: String,
) -> Result<EnpassCliResult, String> {
    let (success, stdout, stderr) =
        run_enpass_cli(&cli_path, &vault_path, &master_password, &["list", ""])?;

    if success {
        Ok(EnpassCliResult {
            success: true,
            message: "Enpass CLI configure correctement".to_string(),
            data: None,
        })
    } else {
        let error_detail = if !stderr.is_empty() { &stderr } else { &stdout };
        Ok(EnpassCliResult {
            success: false,
            message: format!("Erreur configuration: {}", error_detail),
            data: None,
        })
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
            // Commandes Enpass CLI
            enpass_get_password,
            enpass_show_entry,
            enpass_copy_password,
            enpass_create_entry,
            enpass_list_entries,
            enpass_check_setup,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
