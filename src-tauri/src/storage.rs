// src-tauri/src/storage.rs
// Module de stockage securise pour Cockpit CFDT
// Gere la lecture/ecriture du fichier sites.encrypted

use crate::crypto::{CryptoEngine, EncryptedData};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Resultat d'une operation de storage
pub type StorageResult<T> = Result<T, Box<dyn Error + Send + Sync>>;

/// Structure complete des donnees de l'application
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppData {
    /// Liste de tous les sites CFDT
    pub sites: Vec<Site>,

    /// Parametres de l'application
    pub settings: AppSettings,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            sites: Vec::new(),
            settings: AppSettings::default(),
        }
    }
}

/// Representation d'un site CFDT
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Site {
    /// Identifiant unique (ex: "cfdt-ulogistique")
    pub id: String,

    /// Nom d'affichage (ex: "CFDT Ulogistique")
    pub name: String,

    /// Site actif ou archive
    pub enabled: bool,

    /// URLs d'acces
    pub urls: SiteUrls,

    /// References vers les credentials Enpass
    #[serde(alias = "dashlane_refs")]
    pub enpass_refs: EnpassRefs,

    /// Login AdminTools protection backend
    #[serde(default)]
    pub admintools_login: Option<String>,

    /// Informations serveur
    pub server: ServerInfo,

    /// Informations techniques
    pub tech: TechInfo,

    /// Analytics
    pub analytics: Option<AnalyticsInfo>,

    /// Comptes Joomla additionnels
    #[serde(default)]
    pub joomla_accounts: Vec<JoomlaAccount>,

    /// Extensions Joomla installees
    #[serde(default)]
    pub extensions: Vec<Extension>,

    /// Checklist de taches
    pub checklist: Vec<ChecklistItem>,

    /// Journal des interventions
    pub interventions: Vec<Intervention>,

    /// Contacts
    pub contacts: Vec<Contact>,

    /// Notes libres
    pub notes: String,

    /// Date de derniere modification
    pub last_update: String,
}

/// URLs d'un site
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SiteUrls {
    pub frontend: String,
    pub backend: String,
    pub phpmyadmin: String,
}

/// References Enpass
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EnpassRefs {
    pub backend_protection: Option<String>,
    pub joomla_admin: String,
    pub mysql_su: String,
    pub mysql_std: Option<String>,
    pub editors: Vec<String>,
}

/// Informations serveur
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerInfo {
    pub mysql_host: String,
    pub database: String,
    pub prefix: String,
    pub ovh_vps: String,
}

/// Informations techniques
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TechInfo {
    pub joomla_version: String,
    pub php_version: String,
    pub template: String,
}

/// Informations Analytics
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnalyticsInfo {
    pub ga_id: Option<String>,
    pub gtm_id: Option<String>,
    #[serde(default)]
    pub cookie_solution: Option<String>,
    #[serde(default)]
    pub looker_report_url: Option<String>,
}

/// Compte Joomla additionnel
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JoomlaAccount {
    pub username: String,
    pub role: String,
    #[serde(alias = "dashlane_ref")]
    pub enpass_ref: Option<String>,
}

/// Extension Joomla
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Extension {
    pub name: String,
    pub version: Option<String>,
    pub critical: bool,
}

/// Item de checklist
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChecklistItem {
    pub task: String,
    pub done: bool,
    pub date: Option<String>,
}

/// Intervention sur un site
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Intervention {
    pub date: String,
    pub type_intervention: String,
    pub description: String,
    pub duration: String,
    pub result: String,
}

/// Contact pour un site
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Contact {
    pub name: String,
    pub role: String,
    pub email: Option<String>,
    pub phone: Option<String>,
}

/// Parametres de l'application
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    /// Auto-lock apres X minutes d'inactivite
    pub auto_lock_minutes: u32,

    /// Backup automatique avant modification
    pub auto_backup: bool,

    /// Nombre de jours de retention des backups
    pub backup_keep_days: u32,

    /// Ancien champ enpass_cli_path - conserve pour compatibilite avec les donnees existantes
    /// mais ignore a l'utilisation (lecture directe du vault)
    #[serde(default, skip_serializing)]
    pub enpass_cli_path: String,

    /// Chemin vers le vault Enpass (repertoire contenant vault.enpassdb + vault.json)
    #[serde(default)]
    pub enpass_vault_path: String,

    /// Utiliser un mot de passe Enpass distinct du mot de passe maitre Cockpit
    #[serde(default)]
    pub enpass_use_separate_password: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_minutes: 5,
            auto_backup: true,
            backup_keep_days: 30,
            enpass_cli_path: String::new(),
            enpass_vault_path: String::new(),
            enpass_use_separate_password: false,
        }
    }
}

/// Gestionnaire de stockage
pub struct StorageManager {
    data_path: PathBuf,
    backup_path: PathBuf,
}

impl StorageManager {
    /// Cree un nouveau gestionnaire de stockage
    ///
    /// # Arguments
    /// * `app_dir` - Repertoire de l'application
    pub fn new(app_dir: &Path) -> StorageResult<Self> {
        let data_path = app_dir.join("sites.encrypted");
        let backup_path = app_dir.join("backups");

        // Creer le dossier backups s'il n'existe pas
        if !backup_path.exists() {
            fs::create_dir_all(&backup_path)?;
        }

        Ok(Self {
            data_path,
            backup_path,
        })
    }

    /// Verifie si le fichier de donnees existe
    pub fn exists(&self) -> bool {
        self.data_path.exists()
    }

    /// Recupere le repertoire des donnees
    pub fn get_data_dir(&self) -> &Path {
        self.data_path.parent().unwrap_or(Path::new("."))
    }

    /// Charge les donnees depuis le fichier chiffre
    ///
    /// # Arguments
    /// * `password` - Mot de passe maitre
    pub fn load(&self, password: &str) -> StorageResult<AppData> {
        let encrypted_json = fs::read_to_string(&self.data_path)?;
        let encrypted: EncryptedData = serde_json::from_str(&encrypted_json)?;
        let decrypted_json = CryptoEngine::decrypt(&encrypted, password)?;
        let app_data: AppData = serde_json::from_str(&decrypted_json)?;
        Ok(app_data)
    }

    /// Sauvegarde les donnees dans le fichier chiffre (ecriture atomique)
    ///
    /// # Arguments
    /// * `data` - Donnees de l'application
    /// * `password` - Mot de passe maitre
    /// * `create_backup` - Creer un backup avant d'ecraser
    pub fn save(&self, data: &AppData, password: &str, create_backup: bool) -> StorageResult<()> {
        // Backup si demande et si le fichier existe deja
        if create_backup && self.exists() {
            self.create_backup()?;
        }

        // Serialiser les donnees en JSON
        let json = serde_json::to_string_pretty(data)?;

        // Chiffrer
        let encrypted = CryptoEngine::encrypt(&json, password)?;

        // Serialiser les metadonnees de chiffrement
        let encrypted_json = serde_json::to_string_pretty(&encrypted)?;

        // Ecriture atomique: ecrire dans un fichier temporaire puis renommer
        let tmp_path = self.data_path.with_extension("tmp");
        fs::write(&tmp_path, &encrypted_json)?;
        fs::rename(&tmp_path, &self.data_path).map_err(|e| {
            // Si le rename echoue, essayer de nettoyer le fichier temp
            let _ = fs::remove_file(&tmp_path);
            e
        })?;

        Ok(())
    }

    /// Cree un fichier de donnees initial (premiere utilisation)
    pub fn initialize(&self, password: &str) -> StorageResult<()> {
        let initial_data = AppData::default();
        self.save(&initial_data, password, false)?;
        Ok(())
    }

    /// Cree un backup du fichier actuel
    fn create_backup(&self) -> StorageResult<()> {
        if !self.exists() {
            return Ok(());
        }

        // Nom du backup avec timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let backup_name = format!("sites-{}.encrypted", timestamp);
        let backup_file = self.backup_path.join(backup_name);

        // Copier le fichier
        fs::copy(&self.data_path, &backup_file)?;

        // Nettoyer les vieux backups (garder les 50 derniers)
        let _ = self.cleanup_old_backups(50);

        Ok(())
    }

    /// Liste les backups disponibles
    pub fn list_backups(&self) -> StorageResult<Vec<String>> {
        let mut backups = Vec::new();

        if !self.backup_path.exists() {
            return Ok(backups);
        }

        for entry in fs::read_dir(&self.backup_path)? {
            let entry = entry?;
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with("sites-") && name.ends_with(".encrypted") {
                    backups.push(name.to_string());
                }
            }
        }

        // Trier par ordre decroissant (plus recent en premier)
        backups.sort_by(|a, b| b.cmp(a));

        Ok(backups)
    }

    /// Restaure depuis un backup (avec validation du nom)
    pub fn restore_backup(&self, backup_name: &str) -> StorageResult<()> {
        // Valider le nom du backup contre le path traversal
        if backup_name.contains('/')
            || backup_name.contains('\\')
            || backup_name.contains("..")
            || backup_name.is_empty()
        {
            return Err("Nom de backup invalide".into());
        }

        // Verifier que le nom correspond au format attendu
        if !backup_name.starts_with("sites-") || !backup_name.ends_with(".encrypted") {
            return Err("Format de nom de backup invalide".into());
        }

        let backup_file = self.backup_path.join(backup_name);

        // Verifier que le fichier resolu est bien dans le dossier backups
        let canonical_backup = backup_file
            .canonicalize()
            .map_err(|_| "Backup introuvable")?;
        let canonical_backup_dir = self
            .backup_path
            .canonicalize()
            .map_err(|_| "Dossier backups introuvable")?;
        if !canonical_backup.starts_with(&canonical_backup_dir) {
            return Err("Acces non autorise".into());
        }

        if !backup_file.exists() {
            return Err("Backup introuvable".into());
        }

        // Creer un backup du fichier actuel avant restauration
        if self.exists() {
            self.create_backup()?;
        }

        // Copier le backup (ecriture atomique)
        let tmp_path = self.data_path.with_extension("tmp");
        fs::copy(&backup_file, &tmp_path)?;
        fs::rename(&tmp_path, &self.data_path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            e
        })?;

        Ok(())
    }

    /// Nettoie les vieux backups (garde les N plus recents)
    pub fn cleanup_old_backups(&self, keep_count: usize) -> StorageResult<()> {
        let backups = self.list_backups()?;

        // Supprimer les backups au-dela de keep_count
        for backup in backups.iter().skip(keep_count) {
            let backup_file = self.backup_path.join(backup);
            let _ = fs::remove_file(backup_file);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_storage_full_cycle() {
        // Creer un dossier temporaire pour les tests
        let temp_dir = env::temp_dir().join(format!("cockpit_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let storage = StorageManager::new(&temp_dir).unwrap();
        let password = "test_password_123";

        // Initialiser
        storage.initialize(password).unwrap();
        assert!(storage.exists());

        // Charger
        let data = storage.load(password).unwrap();
        assert_eq!(data.sites.len(), 0);

        // Ajouter un site
        let mut data = data;
        data.sites.push(Site {
            id: "test-site".to_string(),
            name: "Site de Test".to_string(),
            enabled: true,
            urls: SiteUrls {
                frontend: "https://test.fr".to_string(),
                backend: "/admin".to_string(),
                phpmyadmin: "https://phpmyadmin.test".to_string(),
            },
            enpass_refs: EnpassRefs {
                backend_protection: None,
                joomla_admin: "[Test] Joomla Admin".to_string(),
                mysql_su: "[Test] MySQL SU".to_string(),
                mysql_std: None,
                editors: vec![],
            },
            admintools_login: Some("sectionsu".to_string()),
            server: ServerInfo {
                mysql_host: "localhost:3306".to_string(),
                database: "test_db".to_string(),
                prefix: "jos_".to_string(),
                ovh_vps: "VPS Test".to_string(),
            },
            tech: TechInfo {
                joomla_version: "4.4.2".to_string(),
                php_version: "8.1".to_string(),
                template: "Helix".to_string(),
            },
            analytics: None,
            joomla_accounts: vec![],
            extensions: vec![],
            checklist: vec![],
            interventions: vec![],
            contacts: vec![],
            notes: String::new(),
            last_update: "2025-01-01T00:00:00+00:00".to_string(),
        });

        // Sauvegarder
        storage.save(&data, password, false).unwrap();

        // Recharger
        let loaded = storage.load(password).unwrap();
        assert_eq!(loaded.sites.len(), 1);
        assert_eq!(loaded.sites[0].name, "Site de Test");

        // Nettoyage
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
