// src-tauri/src/crypto.rs
// Module de chiffrement securise pour Cockpit CFDT
// Utilise AES-256-GCM (authentifie) + Argon2id (derivation de cle)

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::error::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Resultat d'une operation crypto
pub type CryptoResult<T> = Result<T, Box<dyn Error + Send + Sync>>;

/// Structure contenant un secret qui sera efface de la memoire
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKey {
    key: [u8; 32], // 256 bits
}

impl SecretKey {
    /// Cree une cle depuis un mot de passe en utilisant Argon2id
    /// avec les parametres KDF explicites
    pub fn from_password(
        password: &str,
        salt: &[u8],
        kdf_params: &KdfParams,
    ) -> CryptoResult<Self> {
        // Configuration Argon2id avec les parametres explicites
        let params = argon2::Params::new(
            kdf_params.memory,
            kdf_params.iterations,
            kdf_params.parallelism,
            Some(32),
        )
        .map_err(|e| format!("Erreur parametres Argon2: {}", e))?;

        let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

        // Derivation de la cle
        let mut key = [0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Erreur derivation cle: {}", e))?;

        Ok(SecretKey { key })
    }

    /// Retourne la cle (usage interne uniquement)
    fn as_bytes(&self) -> &[u8; 32] {
        &self.key
    }
}

/// Donnees chiffrees avec metadonnees
#[derive(Serialize, Deserialize, Clone)]
pub struct EncryptedData {
    /// Version du format (pour compatibilite future)
    pub version: String,

    /// Algorithme de chiffrement utilise
    pub algorithm: String,

    /// Fonction de derivation de cle
    pub kdf: String,

    /// Parametres KDF
    pub kdf_params: KdfParams,

    /// Salt pour la derivation de cle (base64)
    pub salt: String,

    /// Nonce pour AES-GCM (base64)
    pub nonce: String,

    /// Donnees chiffrees (base64)
    pub ciphertext: String,

    /// Tag d'authentification GCM (base64)
    pub auth_tag: String,
}

/// Parametres de derivation de cle Argon2
#[derive(Serialize, Deserialize, Clone)]
pub struct KdfParams {
    pub memory: u32, // en KB
    pub iterations: u32,
    pub parallelism: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            memory: 65536, // 64 MB
            iterations: 3,
            parallelism: 4,
        }
    }
}

/// Moteur de chiffrement principal
pub struct CryptoEngine;

impl CryptoEngine {
    /// Chiffre des donnees avec AES-256-GCM
    ///
    /// # Arguments
    /// * `plaintext` - Donnees en clair (JSON string)
    /// * `password` - Mot de passe maitre
    ///
    /// # Returns
    /// Structure EncryptedData contenant toutes les metadonnees
    pub fn encrypt(plaintext: &str, password: &str) -> CryptoResult<EncryptedData> {
        let kdf_params = KdfParams::default();

        // 1. Generer un salt aleatoire pour Argon2
        let mut salt = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut salt);

        // 2. Deriver la cle depuis le mot de passe avec parametres explicites
        let secret_key = SecretKey::from_password(password, &salt, &kdf_params)?;

        // 3. Creer le cipher AES-256-GCM
        let cipher = Aes256Gcm::new_from_slice(secret_key.as_bytes())
            .map_err(|e| format!("Erreur creation cipher: {}", e))?;

        // 4. Generer un nonce aleatoire (96 bits pour GCM)
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // 5. Chiffrer les donnees
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
            kdf_params,
            salt: general_purpose::STANDARD.encode(&salt),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            ciphertext: general_purpose::STANDARD.encode(actual_ciphertext),
            auth_tag: general_purpose::STANDARD.encode(auth_tag),
        })
    }

    /// Dechiffre des donnees AES-256-GCM
    ///
    /// # Arguments
    /// * `encrypted` - Structure EncryptedData
    /// * `password` - Mot de passe maitre
    ///
    /// # Returns
    /// Donnees dechiffrees (JSON string)
    pub fn decrypt(encrypted: &EncryptedData, password: &str) -> CryptoResult<String> {
        // 1. Verifier la version
        if encrypted.version != "1.0" {
            return Err("Version de format non supportee".into());
        }

        // 2. Decoder les donnees base64
        let salt = general_purpose::STANDARD
            .decode(&encrypted.salt)
            .map_err(|e| format!("Erreur decodage salt: {}", e))?;
        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted.nonce)
            .map_err(|e| format!("Erreur decodage nonce: {}", e))?;
        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted.ciphertext)
            .map_err(|e| format!("Erreur decodage ciphertext: {}", e))?;
        let auth_tag = general_purpose::STANDARD
            .decode(&encrypted.auth_tag)
            .map_err(|e| format!("Erreur decodage auth_tag: {}", e))?;

        // 3. Valider la longueur du nonce (doit etre exactement 12 octets pour AES-GCM)
        if nonce_bytes.len() != 12 {
            return Err(format!(
                "Nonce invalide: attendu 12 octets, recu {} octets. Fichier potentiellement corrompu.",
                nonce_bytes.len()
            )
            .into());
        }

        // 4. Deriver la cle depuis le mot de passe avec les parametres stockes
        let secret_key = SecretKey::from_password(password, &salt, &encrypted.kdf_params)?;

        // 5. Creer le cipher
        let cipher = Aes256Gcm::new_from_slice(secret_key.as_bytes())
            .map_err(|e| format!("Erreur creation cipher: {}", e))?;

        // 6. Recombiner ciphertext + auth_tag
        let mut combined = ciphertext;
        combined.extend_from_slice(&auth_tag);

        // 7. Dechiffrer
        let nonce = Nonce::from_slice(&nonce_bytes);
        let plaintext_bytes = cipher
            .decrypt(nonce, combined.as_ref())
            .map_err(|_| "Mot de passe incorrect ou donnees corrompues")?;

        // 8. Convertir en String UTF-8
        String::from_utf8(plaintext_bytes).map_err(|e| format!("Erreur UTF-8: {}", e).into())
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

        // Verifier les metadonnees
        assert_eq!(encrypted.version, "1.0");
        assert_eq!(encrypted.algorithm, "AES-256-GCM");
        assert_eq!(encrypted.kdf, "Argon2id");

        // Dechiffrer
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

        // Doit echouer grace au tag d'authentification GCM
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_nonce_length() {
        let password = "password";
        let data = "test data";

        let mut encrypted = CryptoEngine::encrypt(data, password).unwrap();

        // Corrompre le nonce avec une mauvaise longueur
        encrypted.nonce = general_purpose::STANDARD.encode(b"short");

        let result = CryptoEngine::decrypt(&encrypted, password);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("Nonce invalide"));
    }
}
