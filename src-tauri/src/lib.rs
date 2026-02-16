// Cockpit CFDT - Bibliothèque principale

pub mod config;
pub mod crypto;
pub mod enpass;
pub mod storage;

// Réexporter les types nécessaires
pub use config::ConfigManager;
pub use storage::{AppData, StorageManager};
