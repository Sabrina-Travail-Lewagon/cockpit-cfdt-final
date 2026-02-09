// Cockpit CFDT - Bibliothèque principale

pub mod crypto;
pub mod storage;

// Réexporter les types nécessaires
pub use storage::{AppData, StorageManager};
