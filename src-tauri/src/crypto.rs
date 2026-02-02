// src-tauri/src/crypto.rs
// Module de chiffrement sécurisé pour Cockpit CFDT
// Utilise AES-256-GCM (authentifié) + Argon2id (dérivation de clé)

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::error::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};
use base64::{Engine as _, engine::general_purpose};

/// Résultat d'une opération crypto
pub type CryptoResult<T> = Result<T, Box<dyn Error>>;

/// Structure contenant un secret qui sera effacé de la mémoire
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKey {
    key: [u8; 32], // 256 bits
}

impl SecretKey {
    /// Crée une clé depuis un mot de passe en utilisant Argon2
    pub fn from_password(password: &str, salt: &[u8]) -> CryptoResult<Self> {
        // Configuration Argon2id (résistant aux attaques GPU et side-channel)
        let argon2 = Argon2::default();
        
        // Dérivation de la clé (cela prend du temps intentionnellement)
        let mut key = [0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Erreur dérivation clé: {}", e))?;
        
        Ok(SecretKey { key })
    }

    /// Retourne la clé (usage interne uniquement)
    fn as_bytes(&self) -> &[u8; 32] {
        &self.key
    }
}

/// Données chiffrées avec métadonnées
#[derive(Serialize, Deserialize, Clone)]
pub struct EncryptedData {
    /// Version du format (pour compatibilité future)
    pub version: String,
    
    /// Algorithme de chiffrement utilisé
    pub algorithm: String,
    
    /// Fonction de dérivation de clé
    pub kdf: String,
    
    /// Paramètres KDF
    pub kdf_params: KdfParams,
    
    /// Salt pour la dérivation de clé (base64)
    pub salt: String,
    
    /// Nonce pour AES-GCM (base64)
    pub nonce: String,
    
    /// Données chiffrées (base64)
    pub ciphertext: String,
    
    /// Tag d'authentification GCM (base64)
    pub auth_tag: String,
}

/// Paramètres de dérivation de clé Argon2
#[derive(Serialize, Deserialize, Clone)]
pub struct KdfParams {
    pub memory: u32,      // en KB
    pub iterations: u32,
    pub parallelism: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            memory: 65536,    // 64 MB
            iterations: 3,
            parallelism: 4,
        }
    }
}

/// Moteur de chiffrement principal
pub struct CryptoEngine;

impl CryptoEngine {
    /// Chiffre des données avec AES-256-GCM
    /// 
    /// # Arguments
    /// * `plaintext` - Données en clair (JSON string)
    /// * `password` - Mot de passe maître
    /// 
    /// # Returns
    /// Structure EncryptedData contenant toutes les métadonnées
    pub fn encrypt(plaintext: &str, password: &str) -> CryptoResult<EncryptedData> {
        // 1. Générer un salt aléatoire pour Argon2
        let mut salt = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut salt);
        
        // 2. Dériver la clé depuis le mot de passe
        let secret_key = SecretKey::from_password(password, &salt)?;
        
        // 3. Créer le cipher AES-256-GCM
        let cipher = Aes256Gcm::new_from_slice(secret_key.as_bytes())
            .map_err(|e| format!("Erreur création cipher: {}", e))?;
        
        // 4. Générer un nonce aléatoire (96 bits pour GCM)
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 5. Chiffrer les données
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Erreur chiffrement: {}", e))?;
        
        // 6. Extraire le tag d'authentification (les 16 derniers octets)
        let auth_tag = &ciphertext[ciphertext.len() - 16..];
        let actual_ciphertext = &ciphertext[..ciphertext.len() - 16];
        
        // 7. Encoder en base64 pour le stockage
        Ok(EncryptedData {
            version: "1.0".to_string(),
            algorithm: "AES-256-GCM".to_string(),
            kdf: "Argon2id".to_string(),
            kdf_params: KdfParams::default(),
            salt: general_purpose::STANDARD.encode(&salt),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            ciphertext: general_purpose::STANDARD.encode(actual_ciphertext),
            auth_tag: general_purpose::STANDARD.encode(auth_tag),
        })
    }
    
    /// Déchiffre des données AES-256-GCM
    /// 
    /// # Arguments
    /// * `encrypted` - Structure EncryptedData
    /// * `password` - Mot de passe maître
    /// 
    /// # Returns
    /// Données déchiffrées (JSON string)
    pub fn decrypt(encrypted: &EncryptedData, password: &str) -> CryptoResult<String> {
        // 1. Vérifier la version
        if encrypted.version != "1.0" {
            return Err("Version de format non supportée".into());
        }
        
        // 2. Décoder les données base64
        let salt = general_purpose::STANDARD.decode(&encrypted.salt)
            .map_err(|e| format!("Erreur décodage salt: {}", e))?;
        let nonce_bytes = general_purpose::STANDARD.decode(&encrypted.nonce)
            .map_err(|e| format!("Erreur décodage nonce: {}", e))?;
        let ciphertext = general_purpose::STANDARD.decode(&encrypted.ciphertext)
            .map_err(|e| format!("Erreur décodage ciphertext: {}", e))?;
        let auth_tag = general_purpose::STANDARD.decode(&encrypted.auth_tag)
            .map_err(|e| format!("Erreur décodage auth_tag: {}", e))?;
        
        // 3. Dériver la clé depuis le mot de passe
        let secret_key = SecretKey::from_password(password, &salt)?;
        
        // 4. Créer le cipher
        let cipher = Aes256Gcm::new_from_slice(secret_key.as_bytes())
            .map_err(|e| format!("Erreur création cipher: {}", e))?;
        
        // 5. Recombiner ciphertext + auth_tag
        let mut combined = ciphertext;
        combined.extend_from_slice(&auth_tag);
        
        // 6. Déchiffrer
        let nonce = Nonce::from_slice(&nonce_bytes);
        let plaintext_bytes = cipher
            .decrypt(nonce, combined.as_ref())
            .map_err(|_| "Mot de passe incorrect ou données corrompues")?;
        
        // 7. Convertir en String UTF-8
        String::from_utf8(plaintext_bytes)
            .map_err(|e| format!("Erreur UTF-8: {}", e).into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "mon_super_mot_de_passe_123";
        let data = r#"{"sites": [{"name": "Test Site"}]}"#;
        
        // Chiffrer
        let encrypted = CryptoEngine::encrypt(data, password).unwrap();
        
        // Vérifier les métadonnées
        assert_eq!(encrypted.version, "1.0");
        assert_eq!(encrypted.algorithm, "AES-256-GCM");
        assert_eq!(encrypted.kdf, "Argon2id");
        
        // Déchiffrer
        let decrypted = CryptoEngine::decrypt(&encrypted, password).unwrap();
        assert_eq!(decrypted, data);
    }
    
    #[test]
    fn test_wrong_password() {
        let password = "correct_password";
        let wrong_password = "wrong_password";
        let data = "secret data";
        
        let encrypted = CryptoEngine::encrypt(data, password).unwrap();
        let result = CryptoEngine::decrypt(&encrypted, wrong_password);
        
        // Doit échouer
        assert!(result.is_err());
    }
    
    #[test]
    fn test_tampered_data() {
        let password = "password";
        let data = "original data";
        
        let mut encrypted = CryptoEngine::encrypt(data, password).unwrap();
        
        // Modifier le ciphertext (simulation d'attaque)
        encrypted.ciphertext = general_purpose::STANDARD.encode(b"tampered");
        
        let result = CryptoEngine::decrypt(&encrypted, password);
        
        // Doit échouer grâce au tag d'authentification GCM
        assert!(result.is_err());
    }
}
