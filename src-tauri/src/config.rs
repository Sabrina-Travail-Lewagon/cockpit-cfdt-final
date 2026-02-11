// src-tauri/src/config.rs
// Module de gestion de la configuration persistante de l'application

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

/// Configuration de l'application
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    /// Emplacement personnalisé des données (si défini)
    pub custom_data_location: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            custom_data_location: None,
        }
    }
}

/// Gestionnaire de configuration
pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    /// Crée un nouveau gestionnaire de configuration
    /// Le fichier config.json est stocké à côté de l'exécutable (mode portable)
    /// ou dans le dossier système approprié (mode classique)
    pub fn new(config_dir: &Path) -> Result<Self, Box<dyn Error>> {
        let config_path = config_dir.join("config.json");

        // Créer le dossier parent si nécessaire
        if let Some(parent) = config_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        Ok(Self { config_path })
    }

    /// Charge la configuration depuis le fichier
    pub fn load(&self) -> Result<AppConfig, Box<dyn Error>> {
        if !self.config_path.exists() {
            return Ok(AppConfig::default());
        }

        let content = fs::read_to_string(&self.config_path)?;
        let config: AppConfig = serde_json::from_str(&content)?;

        Ok(config)
    }

    /// Sauvegarde la configuration dans le fichier
    pub fn save(&self, config: &AppConfig) -> Result<(), Box<dyn Error>> {
        let json = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, json)?;
        Ok(())
    }

    /// Met à jour l'emplacement des données personnalisé
    pub fn set_custom_data_location(&self, location: Option<String>) -> Result<(), Box<dyn Error>> {
        let mut config = self.load()?;
        config.custom_data_location = location;
        self.save(&config)?;
        Ok(())
    }

    /// Récupère l'emplacement des données personnalisé
    pub fn get_custom_data_location(&self) -> Result<Option<String>, Box<dyn Error>> {
        let config = self.load()?;
        Ok(config.custom_data_location)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_config_cycle() {
        let temp_dir = env::temp_dir().join("cockpit_config_test");
        let _ = fs::create_dir_all(&temp_dir);

        let manager = ConfigManager::new(&temp_dir).unwrap();

        // Par défaut, pas d'emplacement personnalisé
        let config = manager.load().unwrap();
        assert!(config.custom_data_location.is_none());

        // Définir un emplacement
        manager
            .set_custom_data_location(Some("/custom/path".to_string()))
            .unwrap();

        // Recharger et vérifier
        let config = manager.load().unwrap();
        assert_eq!(
            config.custom_data_location,
            Some("/custom/path".to_string())
        );

        // Supprimer l'emplacement
        manager.set_custom_data_location(None).unwrap();
        let config = manager.load().unwrap();
        assert!(config.custom_data_location.is_none());

        // Nettoyage
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
