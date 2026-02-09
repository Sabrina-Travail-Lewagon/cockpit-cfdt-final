// src-tauri/src/storage.rs
// Module de stockage sécurisé pour Cockpit CFDT
// Gère la lecture/écriture du fichier sites.encrypted

use crate::crypto::{CryptoEngine, EncryptedData};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};

/// Résultat d'une opération de storage
pub type StorageResult<T> = Result<T, Box<dyn Error>>;

/// Structure complète des données de l'application
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppData {
    /// Liste de tous les sites CFDT
    pub sites: Vec<Site>,
    
    /// Paramètres de l'application
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

/// Représentation d'un site CFDT
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Site {
    /// Identifiant unique (ex: "cfdt-ulogistique")
    pub id: String,
    
    /// Nom d'affichage (ex: "CFDT Ulogistique")
    pub name: String,
    
    /// Site actif ou archivé
    pub enabled: bool,
    
    /// URLs d'accès
    pub urls: SiteUrls,
    
    /// Références vers les credentials Dashlane
    pub dashlane_refs: DashlaneRefs,
    
    /// Informations serveur
    pub server: ServerInfo,
    
    /// Informations techniques
    pub tech: TechInfo,
    
    /// Analytics
    pub analytics: Option<AnalyticsInfo>,

    /// Extensions Joomla installées
    #[serde(default)]
    pub extensions: Vec<Extension>,

    /// Checklist de tâches
    pub checklist: Vec<ChecklistItem>,
    
    /// Journal des interventions
    pub interventions: Vec<Intervention>,
    
    /// Contacts
    pub contacts: Vec<Contact>,
    
    /// Notes libres
    pub notes: String,
    
    /// Date de dernière modification
    pub last_update: String,
}

/// URLs d'un site
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SiteUrls {
    pub frontend: String,
    pub backend: String,
    pub phpmyadmin: String,
}

/// Références Dashlane
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DashlaneRefs {
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

/// Paramètres de l'application
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    /// Auto-lock après X minutes d'inactivité
    pub auto_lock_minutes: u32,
    
    /// Backup automatique avant modification
    pub auto_backup: bool,
    
    /// Nombre de jours de rétention des backups
    pub backup_keep_days: u32,
    
    /// Chemin vers Dashlane CLI (ou "auto")
    pub dashlane_cli_path: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_minutes: 5,
            auto_backup: true,
            backup_keep_days: 30,
            dashlane_cli_path: "auto".to_string(),
        }
    }
}

/// Gestionnaire de stockage
pub struct StorageManager {
    data_path: PathBuf,
    backup_path: PathBuf,
}

impl StorageManager {
    /// Crée un nouveau gestionnaire de stockage
    /// 
    /// # Arguments
    /// * `app_dir` - Répertoire de l'application (ex: /FluentApp/data)
    pub fn new(app_dir: &Path) -> StorageResult<Self> {
        let data_path = app_dir.join("sites.encrypted");
        let backup_path = app_dir.join("backups");
        
        // Créer le dossier backups s'il n'existe pas
        if !backup_path.exists() {
            fs::create_dir_all(&backup_path)?;
        }
        
        Ok(Self {
            data_path,
            backup_path,
        })
    }
    
    /// Vérifie si le fichier de données existe
    pub fn exists(&self) -> bool {
        self.data_path.exists()
    }
    
    /// Charge les données depuis le fichier chiffré
    /// 
    /// # Arguments
    /// * `password` - Mot de passe maître
    pub fn load(&self, password: &str) -> StorageResult<AppData> {
        // Lire le fichier
        let encrypted_json = fs::read_to_string(&self.data_path)?;
        
        // Parser le JSON des métadonnées de chiffrement
        let encrypted: EncryptedData = serde_json::from_str(&encrypted_json)?;
        
        // Déchiffrer
        let decrypted_json = CryptoEngine::decrypt(&encrypted, password)?;
        
        // Parser les données de l'app
        let app_data: AppData = serde_json::from_str(&decrypted_json)?;
        
        Ok(app_data)
    }
    
    /// Sauvegarde les données dans le fichier chiffré
    /// 
    /// # Arguments
    /// * `data` - Données de l'application
    /// * `password` - Mot de passe maître
    /// * `create_backup` - Créer un backup avant d'écraser
    pub fn save(&self, data: &AppData, password: &str, create_backup: bool) -> StorageResult<()> {
        // Backup si demandé et si le fichier existe déjà
        if create_backup && self.exists() {
            self.create_backup()?;
        }
        
        // Sérialiser les données en JSON
        let json = serde_json::to_string_pretty(data)?;
        
        // Chiffrer
        let encrypted = CryptoEngine::encrypt(&json, password)?;
        
        // Sérialiser les métadonnées de chiffrement
        let encrypted_json = serde_json::to_string_pretty(&encrypted)?;
        
        // Écrire dans le fichier
        fs::write(&self.data_path, encrypted_json)?;
        
        Ok(())
    }
    
    /// Crée un fichier de données initial (première utilisation)
    pub fn initialize(&self, password: &str) -> StorageResult<()> {
        let initial_data = AppData::default();
        self.save(&initial_data, password, false)?;
        Ok(())
    }
    
    /// Crée un backup du fichier actuel
    fn create_backup(&self) -> StorageResult<()> {
        if !self.exists() {
            return Ok(());
        }
        
        // Nom du backup avec timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let backup_name = format!("sites-{}.encrypted", timestamp);
        let backup_file = self.backup_path.join(backup_name);
        
        // Copier le fichier
        fs::copy(&self.data_path, &backup_file)?;
        
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
        
        // Trier par ordre décroissant (plus récent en premier)
        backups.sort_by(|a, b| b.cmp(a));
        
        Ok(backups)
    }
    
    /// Restaure depuis un backup
    pub fn restore_backup(&self, backup_name: &str) -> StorageResult<()> {
        let backup_file = self.backup_path.join(backup_name);
        
        if !backup_file.exists() {
            return Err("Backup introuvable".into());
        }
        
        // Créer un backup du fichier actuel avant restauration
        if self.exists() {
            self.create_backup()?;
        }
        
        // Copier le backup
        fs::copy(&backup_file, &self.data_path)?;
        
        Ok(())
    }
    
    /// Nettoie les vieux backups (garde les N plus récents)
    pub fn cleanup_old_backups(&self, keep_count: usize) -> StorageResult<()> {
        let backups = self.list_backups()?;
        
        // Supprimer les backups au-delà de keep_count
        for backup in backups.iter().skip(keep_count) {
            let backup_file = self.backup_path.join(backup);
            fs::remove_file(backup_file)?;
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
        // Créer un dossier temporaire pour les tests
        let temp_dir = env::temp_dir().join("fluent_app_test");
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
            dashlane_refs: DashlaneRefs {
                backend_protection: None,
                joomla_admin: "[Test] Joomla Admin".to_string(),
                mysql_su: "[Test] MySQL SU".to_string(),
                mysql_std: None,
                editors: vec![],
            },
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
            extensions: vec![],
            checklist: vec![],
            interventions: vec![],
            contacts: vec![],
            notes: String::new(),
            last_update: chrono::Local::now().to_rfc3339(),
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
