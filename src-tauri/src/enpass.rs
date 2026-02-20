// src-tauri/src/enpass.rs
// Lecture directe du vault Enpass (SQLCipher) sans enpass-cli
//
// Le vault Enpass est un fichier SQLite chiffre avec SQLCipher.
// Algorithme de dechiffrement :
//   1. Lire vault.json pour obtenir kdf_iter (nombre d'iterations PBKDF2)
//   2. Lire les 16 premiers octets du .enpassdb comme sel
//   3. Deriver la cle avec PBKDF2-HMAC-SHA512(password, salt, iterations) => 64 octets
//   4. Utiliser les 64 premiers caracteres hex de cette cle comme pragma_key SQLCipher
//   5. Les valeurs de type "password" dans itemfield sont chiffrees en AES-256-GCM :
//      - key = item.key[0..32], nonce = item.key[32..44]
//      - AAD = UUID sans tirets (decode hex)
//      - ciphertext+tag = hex_decode(itemfield.value)

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Nombre d'octets pour le sel en tete du fichier .enpassdb
const SALT_LENGTH: usize = 16;

/// Longueur de la cle hexadecimale pour SQLCipher (64 chars hex = 32 bytes)
const MASTER_KEY_HEX_LENGTH: usize = 64;

/// Valeurs d'iterations KDF a essayer quand vault.json n'est pas disponible
/// Enpass 6.0-6.7 = 100k, Enpass 6.8+ = 320k
const KDF_ITERATIONS_TO_TRY: &[u32] = &[100_000, 320_000];

// =========================================================================
// Cache du vault telecharge depuis WebDAV (evite de retelecharger a chaque operation)
// =========================================================================

/// Chemin du dernier fichier vault telecharge depuis WebDAV (cache en memoire)
static WEBDAV_CACHE: Mutex<Option<WebDavCache>> = Mutex::new(None);

struct WebDavCache {
    /// Chemin du fichier temporaire telecharge
    local_path: PathBuf,
    /// URL source pour invalidation
    source_url: String,
}

/// Telecharge un fichier depuis une URL WebDAV avec authentification Basic
fn download_webdav_file(
    client: &reqwest::blocking::Client,
    url: &str,
    pcloud_username: &str,
    pcloud_password: &str,
) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .basic_auth(pcloud_username, Some(pcloud_password))
        .send()
        .map_err(|e| format!("Erreur telechargement {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {} pour {}", response.status(), url));
    }

    response
        .bytes()
        .map(|b| b.to_vec())
        .map_err(|e| format!("Erreur lecture reponse {}: {}", url, e))
}

/// Separe un fichier .enpassdbsync en deux parties :
/// - Le header JSON (metadonnees du vault, equivalent de vault.json)
/// - Les donnees SQLCipher brutes (la base de donnees chiffree)
///
/// Le format .enpassdbsync est un conteneur :
///   [JSON header][padding null bytes][donnees SQLCipher]
///
/// Les donnees SQLCipher commencent a un offset aligne (typiquement 1024 ou 4096)
/// depuis le debut du fichier. Le padding entre le JSON et les donnees est rempli
/// de null bytes (0x00).
fn split_enpassdbsync(data: &[u8]) -> Result<(String, Vec<u8>), String> {
    if data.is_empty() {
        return Err("Fichier vault.enpassdbsync vide".to_string());
    }

    // Le fichier doit commencer par '{' (debut du JSON)
    if data[0] != b'{' {
        return Err(format!(
            "Format inattendu: le fichier ne commence pas par '{{' (premier octet: 0x{:02x})",
            data[0]
        ));
    }

    // Trouver la fin du JSON en comptant les accolades
    // On doit gerer les strings JSON qui peuvent contenir des accolades echappees
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape_next = false;
    let mut json_end = 0usize;

    for (i, &byte) in data.iter().enumerate() {
        if escape_next {
            escape_next = false;
            continue;
        }

        if byte == b'\\' && in_string {
            escape_next = true;
            continue;
        }

        if byte == b'"' {
            in_string = !in_string;
            continue;
        }

        if !in_string {
            if byte == b'{' {
                depth += 1;
            } else if byte == b'}' {
                depth -= 1;
                if depth == 0 {
                    json_end = i + 1; // Position juste apres le '}'
                    break;
                }
            }
        }
    }

    if json_end == 0 || depth != 0 {
        return Err(
            "Impossible de trouver la fin du header JSON dans vault.enpassdbsync".to_string(),
        );
    }

    let json_part = String::from_utf8_lossy(&data[..json_end]).to_string();

    // Le format .enpassdbsync aligne les donnees SQLCipher sur une frontiere de page.
    // On essaie les alignements courants : 1024, 4096, 8192 depuis le debut du fichier.
    // L'offset SQLCipher = le premier multiple de page_size >= json_end.
    //
    // On retourne le json_end pour que la fonction appelante puisse essayer
    // plusieurs strategies d'extraction des donnees SQLCipher.
    let db_data = data[json_end..].to_vec();

    Ok((json_part, db_data))
}

/// Telecharge le vault Enpass depuis une URL WebDAV (pCloud)
///
/// Le fichier vault.enpassdbsync est un conteneur unique qui contient :
/// 1. Un header JSON (metadonnees = kdf_algo, kdf_iter, etc.)
/// 2. Les donnees SQLCipher brutes (la base de donnees chiffree)
///
/// On separe les deux parties, on ecrit les donnees SQLCipher dans un fichier
/// temporaire, et on retourne le chemin vers ce fichier.
fn download_vault_from_webdav(
    webdav_url: &str,
    pcloud_username: &str,
    pcloud_password: &str,
) -> Result<PathBuf, String> {
    // Verifier le cache
    {
        let cache = WEBDAV_CACHE
            .lock()
            .map_err(|_| "Erreur interne: mutex du cache WebDAV corrompu")?;
        if let Some(ref cached) = *cache {
            if cached.source_url == webdav_url && cached.local_path.exists() {
                return Ok(cached.local_path.clone());
            }
        }
    }

    let base_url = webdav_url.trim_end_matches('/');
    let sync_url = format!("{}/vault.enpassdbsync", base_url);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Erreur creation client HTTP: {}", e))?;

    // Telecharger vault.enpassdbsync (le fichier conteneur unique)
    let raw_bytes = download_webdav_file(&client, &sync_url, pcloud_username, pcloud_password)
        .map_err(|e| {
            format!(
                "Impossible de telecharger vault.enpassdbsync depuis {}. {}",
                sync_url, e
            )
        })?;

    if raw_bytes.is_empty() {
        return Err("Le fichier vault.enpassdbsync telecharge est vide".to_string());
    }

    // Separer le header JSON des donnees SQLCipher
    let (json_header, db_data) = split_enpassdbsync(&raw_bytes)?;

    if db_data.is_empty() {
        return Err(format!(
            "Aucune donnee SQLCipher trouvee apres le header JSON ({} octets de JSON, {} octets total)",
            json_header.len(),
            raw_bytes.len()
        ));
    }

    let temp_dir = std::env::temp_dir().join("cockpit-enpass-webdav");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Erreur creation dossier temporaire: {}", e))?;

    // Ecrire le JSON des metadonnees
    let json_path = temp_dir.join("vault_info.json");
    fs::write(&json_path, &json_header)
        .map_err(|e| format!("Erreur ecriture vault_info.json: {}", e))?;

    // Le format .enpassdbsync aligne les donnees SQLCipher sur une frontiere de page.
    // L'offset SQLCipher depuis le debut du fichier = premier multiple de page_size >= json_end.
    //
    // json_header.len() = json_end (position apres le JSON dans le fichier complet)
    // db_data = raw_bytes[json_end..] (tout ce qui suit le JSON)
    //
    // On essaie plusieurs strategies pour trouver le debut des donnees SQLCipher :
    // 1. Alignement sur 1024 octets depuis le debut du fichier
    // 2. Alignement sur 4096 octets depuis le debut du fichier
    // 3. Alignement sur 8192 octets depuis le debut du fichier
    // 4. Premier octet non-nul (ancienne heuristique, fallback)

    let json_end = json_header.len();
    let total_size = raw_bytes.len();

    // Calculer les offsets alignes possibles depuis le debut du fichier
    let mut candidate_offsets: Vec<(String, usize)> = Vec::new();

    for &page_size in &[1024usize, 4096, 8192, 16384] {
        // L'offset aligne = le premier multiple de page_size >= json_end
        let aligned_offset = if json_end % page_size == 0 {
            json_end
        } else {
            ((json_end / page_size) + 1) * page_size
        };

        if aligned_offset < total_size {
            let offset_in_db_data = aligned_offset - json_end;
            candidate_offsets.push((format!("align_{}", page_size), offset_in_db_data));
        }
    }

    // Ajouter le fallback : premier octet non-nul
    let first_non_null = db_data.iter().position(|&b| b != 0x00).unwrap_or(0);
    candidate_offsets.push(("first_non_null".to_string(), first_non_null));

    // Ajouter le fallback : pas de padding du tout (donnees juste apres le JSON)
    candidate_offsets.push(("no_padding".to_string(), 0));

    // Dedupliquer les offsets
    candidate_offsets.sort_by_key(|item| item.1);
    candidate_offsets.dedup_by_key(|item| item.1);

    // Ecrire les infos de debug
    let debug_candidates: Vec<String> = candidate_offsets
        .iter()
        .map(|(name, offset)| {
            let abs_offset = json_end + *offset;
            let remaining = total_size.saturating_sub(abs_offset);
            let first_bytes = if *offset < db_data.len() {
                let end = std::cmp::min(*offset + 16, db_data.len());
                hex::encode(&db_data[*offset..end])
            } else {
                "OUT_OF_BOUNDS".to_string()
            };
            format!(
                "{}:rel={},abs={},remaining={},first16={}",
                name, offset, abs_offset, remaining, first_bytes
            )
        })
        .collect();

    let debug_info = format!(
        "json_size={}, db_data_size={}, total={}, candidates=[{}]",
        json_end,
        db_data.len(),
        total_size,
        debug_candidates.join(" | ")
    );
    let _ = fs::write(temp_dir.join("split_debug.txt"), &debug_info);

    // Trouver le bon offset : on essaie chaque candidat et on prend le premier
    // dont la taille resultante est un multiple de 1024 (condition necessaire pour SQLCipher)
    // et dont la taille est > 0
    let mut best_offset = first_non_null; // fallback par defaut
    let mut best_name = "first_non_null";

    for (name, offset) in &candidate_offsets {
        if *offset >= db_data.len() {
            continue;
        }
        let remaining = db_data.len() - *offset;
        // SQLCipher: la taille du fichier doit etre un multiple de la page_size (1024, 4096, etc.)
        if remaining > 0 && (remaining % 1024 == 0 || remaining % 4096 == 0) {
            best_offset = *offset;
            best_name = name;
            break; // prendre le premier candidat valide
        }
    }

    let actual_db_data = &db_data[best_offset..];

    // Logger le choix final
    let final_debug = format!(
        "CHOSEN: {} (offset={}+{}={}, sqlcipher_size={}, mod1024={}, mod4096={})",
        best_name,
        json_end,
        best_offset,
        json_end + best_offset,
        actual_db_data.len(),
        actual_db_data.len() % 1024,
        actual_db_data.len() % 4096,
    );
    let _ = fs::write(temp_dir.join("split_chosen.txt"), &final_debug);

    // Ecrire les donnees SQLCipher
    let db_path = temp_dir.join("vault.enpassdb");
    let mut file = fs::File::create(&db_path)
        .map_err(|e| format!("Erreur creation fichier temporaire: {}", e))?;
    file.write_all(actual_db_data)
        .map_err(|e| format!("Erreur ecriture donnees SQLCipher: {}", e))?;

    // Mettre a jour le cache
    {
        let mut cache = WEBDAV_CACHE
            .lock()
            .map_err(|_| "Erreur interne: mutex du cache WebDAV corrompu")?;
        *cache = Some(WebDavCache {
            local_path: db_path.clone(),
            source_url: webdav_url.to_string(),
        });
    }

    Ok(db_path)
}

/// Telecharge les donnees brutes du vault depuis WebDAV et retourne les composants separes.
/// Retourne (raw_bytes, json_header, db_data_after_json, json_end_offset)
fn download_raw_webdav_data(
    webdav_url: &str,
    pcloud_username: &str,
    pcloud_password: &str,
) -> Result<(Vec<u8>, String, Vec<u8>, usize), String> {
    // Verifier le cache - si un fichier existe deja, lire les donnees brutes du fichier sync
    // On ne peut pas utiliser le cache ici car on a besoin des donnees brutes
    // Le cache sera gere par open_vault_webdav apres succes

    let base_url = webdav_url.trim_end_matches('/');
    let sync_url = format!("{}/vault.enpassdbsync", base_url);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Erreur creation client HTTP: {}", e))?;

    let raw_bytes = download_webdav_file(&client, &sync_url, pcloud_username, pcloud_password)
        .map_err(|e| {
            format!(
                "Impossible de telecharger vault.enpassdbsync depuis {}. {}",
                sync_url, e
            )
        })?;

    if raw_bytes.is_empty() {
        return Err("Le fichier vault.enpassdbsync telecharge est vide".to_string());
    }

    let (json_header, db_data) = split_enpassdbsync(&raw_bytes)?;
    let json_end = json_header.len();

    if db_data.is_empty() {
        return Err(format!(
            "Aucune donnee SQLCipher trouvee apres le header JSON ({} octets de JSON, {} octets total)",
            json_end,
            raw_bytes.len()
        ));
    }

    Ok((raw_bytes, json_header, db_data, json_end))
}

/// Invalide le cache WebDAV (force un nouveau telechargement au prochain appel)
pub fn invalidate_webdav_cache() {
    if let Ok(mut cache) = WEBDAV_CACHE.lock() {
        // Supprimer le fichier temporaire si existant
        if let Some(ref cached) = *cache {
            let _ = fs::remove_file(&cached.local_path);
        }
        *cache = None;
    }
}

/// Ouvre le vault Enpass depuis une URL WebDAV (pCloud)
///
/// Le fichier vault.enpassdbsync sur pCloud est un conteneur unique :
/// - Header JSON (metadonnees = kdf_algo, kdf_iter, etc.)
/// - Donnees SQLCipher brutes
///
/// Cette fonction telecharge le fichier, puis essaie plusieurs offsets
/// pour extraire les donnees SQLCipher (le format .enpassdbsync aligne
/// les donnees sur une frontiere de page variable selon les versions).
pub fn open_vault_webdav(
    webdav_url: &str,
    pcloud_username: &str,
    pcloud_password: &str,
    master_password: &str,
) -> Result<Connection, String> {
    // Telecharger les donnees brutes et le JSON
    let (raw_bytes, json_header, db_data, json_end) =
        download_raw_webdav_data(webdav_url, pcloud_username, pcloud_password)?;

    let temp_dir = std::env::temp_dir().join("cockpit-enpass-webdav");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Erreur creation dossier temporaire: {}", e))?;

    // Ecrire le JSON des metadonnees
    let json_path = temp_dir.join("vault_info.json");
    fs::write(&json_path, &json_header)
        .map_err(|e| format!("Erreur ecriture vault_info.json: {}", e))?;

    // Parser les iterations KDF depuis le JSON header
    let kdf_iterations: Option<u32> = match serde_json::from_str::<VaultInfo>(&json_header) {
        Ok(info) => {
            if info.kdf_algo != "pbkdf2" {
                return Err(format!(
                    "Algorithme KDF non supporte: {} (attendu: pbkdf2)",
                    info.kdf_algo
                ));
            }
            if info.have_keyfile != 0 {
                return Err("Les vaults avec keyfile ne sont pas supportes.".to_string());
            }
            Some(info.kdf_iter)
        }
        Err(_) => None,
    };

    // Construire la liste des iterations a essayer
    let iterations_to_try: Vec<u32> = if let Some(iter) = kdf_iterations {
        vec![iter]
    } else {
        KDF_ITERATIONS_TO_TRY.to_vec()
    };

    // Construire la liste des offsets candidats pour les donnees SQLCipher
    let total_size = raw_bytes.len();
    let mut candidate_offsets: Vec<(String, usize)> = Vec::new();

    for &page_size in &[1024usize, 4096, 8192, 16384] {
        let aligned_offset = if json_end % page_size == 0 {
            json_end
        } else {
            ((json_end / page_size) + 1) * page_size
        };

        if aligned_offset < total_size {
            let offset_in_db_data = aligned_offset - json_end;
            candidate_offsets.push((format!("align_{}", page_size), offset_in_db_data));
        }
    }

    // Fallback: premier octet non-nul apres le JSON
    let first_non_null = db_data.iter().position(|&b| b != 0x00).unwrap_or(0);
    if first_non_null > 0 {
        candidate_offsets.push(("first_non_null".to_string(), first_non_null));
    }

    // Fallback: pas de padding (donnees directement apres le JSON)
    candidate_offsets.push(("no_padding".to_string(), 0));

    // Dedupliquer
    candidate_offsets.sort_by_key(|item| item.1);
    candidate_offsets.dedup_by_key(|item| item.1);

    // Debug: logger tous les candidats
    let debug_candidates: Vec<String> = candidate_offsets
        .iter()
        .map(|(name, offset)| {
            let abs_offset = json_end + *offset;
            let remaining = total_size.saturating_sub(abs_offset);
            let first_bytes = if *offset < db_data.len() {
                let end = std::cmp::min(*offset + 16, db_data.len());
                hex::encode(&db_data[*offset..end])
            } else {
                "OUT_OF_BOUNDS".to_string()
            };
            format!(
                "{}:rel={},abs={},remaining={},mod1024={},first16={}",
                name,
                offset,
                abs_offset,
                remaining,
                remaining % 1024,
                first_bytes
            )
        })
        .collect();

    let debug_info = format!(
        "json_size={}, db_data_size={}, total={}, kdf_iter={:?}, candidates=[{}]",
        json_end,
        db_data.len(),
        total_size,
        kdf_iterations,
        debug_candidates.join(" | ")
    );
    let _ = fs::write(temp_dir.join("split_debug.txt"), &debug_info);

    // Essayer chaque combinaison (offset, iterations, cipher_compat)
    let mut all_errors: Vec<String> = Vec::new();
    let db_path = temp_dir.join("vault.enpassdb");

    for (offset_name, offset) in &candidate_offsets {
        if *offset >= db_data.len() {
            continue;
        }

        let actual_db_data = &db_data[*offset..];
        if actual_db_data.is_empty() {
            continue;
        }

        // Ecrire ce candidat sur disque
        if let Err(e) = fs::write(&db_path, actual_db_data) {
            all_errors.push(format!("{}: erreur ecriture: {}", offset_name, e));
            continue;
        }

        // Extraire le sel (16 premiers octets)
        let salt = match extract_salt(&db_path) {
            Ok(s) => s,
            Err(e) => {
                all_errors.push(format!("{}: {}", offset_name, e));
                continue;
            }
        };

        for &iterations in &iterations_to_try {
            let db_key = match derive_key(master_password.as_bytes(), &salt, iterations) {
                Ok(k) => k,
                Err(e) => {
                    all_errors.push(format!(
                        "{}/iter={}: derive_key: {}",
                        offset_name, iterations, e
                    ));
                    continue;
                }
            };

            match open_encrypted_db(&db_path, &db_key) {
                Ok(conn) => {
                    // Succes! Logger et mettre en cache
                    let success_info = format!(
                        "SUCCESS: offset={} (abs={}), iterations={}, db_size={}, salt={}",
                        offset_name,
                        json_end + *offset,
                        iterations,
                        actual_db_data.len(),
                        hex::encode(&salt)
                    );
                    let _ = fs::write(temp_dir.join("split_success.txt"), &success_info);

                    // Mettre a jour le cache
                    if let Ok(mut cache) = WEBDAV_CACHE.lock() {
                        *cache = Some(WebDavCache {
                            local_path: db_path.clone(),
                            source_url: webdav_url.to_string(),
                        });
                    }

                    return Ok(conn);
                }
                Err(e) => {
                    all_errors.push(format!("{}/iter={}: {}", offset_name, iterations, e));
                }
            }
        }
    }

    // Aucune combinaison n'a fonctionne
    // Logger les erreurs
    let _ = fs::write(temp_dir.join("split_errors.txt"), all_errors.join("\n"));

    Err(format!(
        "Impossible d'ouvrir le vault: mot de passe incorrect ou version de base non supportee. \
         Details: {} | Debug: json_end={}, total={}, candidates={}",
        all_errors.last().unwrap_or(&"aucune tentative".to_string()),
        json_end,
        total_size,
        candidate_offsets.len()
    ))
}

/// Informations du vault (vault.json)
#[derive(Deserialize, Debug)]
struct VaultInfo {
    #[serde(default = "default_kdf_algo")]
    kdf_algo: String,
    #[serde(default = "default_kdf_iter")]
    kdf_iter: u32,
    #[serde(default)]
    have_keyfile: u32,
    #[serde(default)]
    vault_name: String,
}

fn default_kdf_algo() -> String {
    "pbkdf2".to_string()
}

fn default_kdf_iter() -> u32 {
    100_000
}

/// Entree du vault Enpass (item + itemfield joints)
#[derive(Serialize, Clone, Debug)]
pub struct EnpassEntry {
    pub uuid: String,
    pub title: String,
    pub subtitle: String,
    pub note: String,
    pub category: String,
    pub trashed: i64,
    pub deleted: i64,
    pub label: String,
    pub field_type: String,
    pub sensitive: bool,
    /// Valeur en clair (dechiffree si c'est un password, brute sinon)
    pub value: String,
}

/// Resultat JSON pour le frontend
#[derive(Serialize)]
pub struct EnpassResult {
    pub success: bool,
    pub message: String,
    pub data: Option<String>,
}

/// Ouvre le vault Enpass et retourne une connexion SQLite dechiffree.
///
/// Etapes :
/// 1. Lire vault.json
/// 2. Extraire le sel (16 premiers octets du .enpassdb)
/// 3. Deriver la cle DB via PBKDF2-HMAC-SHA512
/// 4. Ouvrir SQLCipher avec la cle derivee (essai v4 puis v3)
pub fn open_vault(vault_path: &str, master_password: &str) -> Result<Connection, String> {
    let vault_dir = Path::new(vault_path);

    // Trouver le fichier .enpassdb
    let db_path = find_db_file(vault_dir)?;
    let info_path = vault_dir.join("vault.json");

    if !info_path.exists() {
        return Err(format!(
            "Fichier vault.json introuvable dans {}",
            vault_path
        ));
    }

    // 1. Lire vault.json
    let info_content =
        fs::read_to_string(&info_path).map_err(|e| format!("Erreur lecture vault.json: {}", e))?;
    let vault_info: VaultInfo = serde_json::from_str(&info_content)
        .map_err(|e| format!("Erreur parsing vault.json: {}", e))?;

    if vault_info.kdf_algo != "pbkdf2" {
        return Err(format!(
            "Algorithme KDF non supporte: {} (attendu: pbkdf2)",
            vault_info.kdf_algo
        ));
    }

    if vault_info.have_keyfile != 0 {
        return Err(
            "Les vaults avec keyfile ne sont pas encore supportes. Desactivez le keyfile dans Enpass."
                .to_string(),
        );
    }

    // 2. Extraire le sel
    let salt = extract_salt(&db_path)?;

    // 3. Deriver la cle via PBKDF2-HMAC-SHA512
    let db_key = derive_key(master_password.as_bytes(), &salt, vault_info.kdf_iter)?;

    // 4. Ouvrir la base avec SQLCipher
    open_encrypted_db(&db_path, &db_key)
}

/// Trouve le fichier vault.enpassdb dans le repertoire du vault
fn find_db_file(vault_dir: &Path) -> Result<PathBuf, String> {
    let default_path = vault_dir.join("vault.enpassdb");
    if default_path.exists() {
        return Ok(default_path);
    }

    // Chercher un fichier .enpassdb dans le repertoire
    if let Ok(entries) = fs::read_dir(vault_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.ends_with(".enpassdb") || name_str.ends_with(".walletx") {
                return Ok(entry.path());
            }
        }
    }

    Err(format!(
        "Aucun fichier vault (.enpassdb/.walletx) trouve dans {}",
        vault_dir.display()
    ))
}

/// Lit les 16 premiers octets du fichier DB comme sel
fn extract_salt(db_path: &Path) -> Result<Vec<u8>, String> {
    let mut file = fs::File::open(db_path).map_err(|e| format!("Erreur ouverture vault: {}", e))?;
    let mut salt = vec![0u8; SALT_LENGTH];
    file.read_exact(&mut salt)
        .map_err(|e| format!("Erreur lecture sel du vault: {}", e))?;
    Ok(salt)
}

/// Derive la cle de la base via PBKDF2-HMAC-SHA512
fn derive_key(password: &[u8], salt: &[u8], iterations: u32) -> Result<Vec<u8>, String> {
    use hmac::Hmac;
    use sha2::Sha512;

    // Output = 64 octets (SHA-512 digest size)
    let mut key = vec![0u8; 64];
    pbkdf2::pbkdf2::<Hmac<Sha512>>(password, salt, iterations, &mut key)
        .map_err(|e| format!("Erreur derivation PBKDF2: {}", e))?;
    Ok(key)
}

/// Ouvre la base SQLCipher en essayant d'abord la compatibilite v4, puis v3
fn open_encrypted_db(db_path: &Path, db_key: &[u8]) -> Result<Connection, String> {
    let hex_key = hex::encode(db_key);
    // Ne prendre que les 64 premiers caracteres hex (= 32 octets = AES-256)
    let hex_key_truncated = &hex_key[..MASTER_KEY_HEX_LENGTH];

    let mut errors = Vec::new();

    // Diagnostic: version SQLCipher, cle et fichier
    let file_size = fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    let cipher_version = {
        let tmp_conn = Connection::open_in_memory();
        match tmp_conn {
            Ok(c) => c
                .query_row("PRAGMA cipher_version", [], |row| row.get::<_, String>(0))
                .unwrap_or_else(|_| "unknown".to_string()),
            Err(_) => "error".to_string(),
        }
    };
    errors.push(format!(
        "sqlcipher={}, key_prefix={}, key_len={}, file_size={}, file_mod4096={}",
        cipher_version,
        &hex_key_truncated[..16],
        hex_key_truncated.len(),
        file_size,
        file_size % 4096
    ));

    // Essayer SQLCipher v4 d'abord (Enpass 6.8+), puis v3
    // cipher_compatibility configure automatiquement page_size, hmac, kdf, etc.
    for cipher_compat in [4, 3] {
        match try_open_db(db_path, hex_key_truncated, cipher_compat, 0) {
            Ok(conn) => return Ok(conn),
            Err(e) => {
                errors.push(e);
            }
        }
    }

    // Lire le debug du split si disponible
    let split_debug = {
        let temp_dir = std::env::temp_dir().join("cockpit-enpass-webdav");
        let chosen_path = temp_dir.join("split_chosen.txt");
        let debug_path = temp_dir.join("split_debug.txt");
        let chosen = fs::read_to_string(&chosen_path).unwrap_or_default();
        let debug = fs::read_to_string(&debug_path).unwrap_or_default();
        if !chosen.is_empty() || !debug.is_empty() {
            format!(" | Split: {} | {}", chosen, debug)
        } else {
            String::new()
        }
    };

    Err(format!(
        "Impossible d'ouvrir le vault: mot de passe incorrect ou version de base non supportee. \
         Diag: {} | Essais: {}{}",
        errors.first().unwrap_or(&String::new()),
        errors[1..].join(" | "),
        split_debug
    ))
}

/// Tente d'ouvrir la base avec une version SQLCipher specifique
///
/// PRAGMA key + cipher_compatibility configure automatiquement :
/// page_size, hmac_algorithm, kdf_algorithm, cipher_use_hmac, etc.
fn try_open_db(
    db_path: &Path,
    hex_key: &str,
    cipher_compat: u32,
    _page_size: u32,
) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Erreur ouverture SQLite: {}", e))?;

    // PRAGMA key doit etre la premiere instruction executee sur la connexion
    // Format raw key : "x'<64 hex chars>'" (32 bytes = AES-256)
    let pragma_key = format!("PRAGMA key = \"x'{}'\";", hex_key);
    conn.execute_batch(&pragma_key)
        .map_err(|e| format!("Erreur PRAGMA key: {}", e))?;

    // Configurer la compatibilite SQLCipher (v3 ou v4)
    // Ce PRAGMA configure automatiquement : page_size, hmac_algorithm,
    // kdf_algorithm, cipher_use_hmac, etc. pour la version cible
    conn.execute_batch(&format!("PRAGMA cipher_compatibility = {};", cipher_compat))
        .map_err(|e| format!("Erreur PRAGMA cipher_compatibility: {}", e))?;

    // Verifier que la base est accessible en lisant sqlite_master
    // C'est la premiere operation de lecture, qui declenche le dechiffrement
    match conn.query_row::<i64, _, _>("SELECT count(*) FROM sqlite_master", [], |row| row.get(0)) {
        Ok(_) => Ok(conn),
        Err(e) => {
            drop(conn);
            Err(format!("v{}: {}", cipher_compat, e))
        }
    }
}

/// Dechiffre la valeur d'un champ password avec AES-256-GCM
///
/// - key_bytes[0..32]  = cle AES-256
/// - key_bytes[32..44] = nonce GCM (12 octets)
/// - value_hex         = ciphertext + tag (16 octets) encode en hex
/// - uuid              = UUID de l'item (AAD = uuid sans tirets, decode hex)
pub fn decrypt_field_value(
    key_bytes: &[u8],
    value_hex: &str,
    uuid: &str,
) -> Result<String, String> {
    if value_hex.is_empty() {
        return Ok(String::new());
    }

    if key_bytes.len() < 44 {
        return Err("Cle item trop courte (< 44 octets)".to_string());
    }

    let key = &key_bytes[..32];
    let nonce_bytes = &key_bytes[32..44];

    // Decoder le ciphertext+tag depuis hex
    let ciphertext_and_tag =
        hex::decode(value_hex).map_err(|e| format!("Erreur decodage hex du ciphertext: {}", e))?;

    // AAD = UUID sans tirets, decode hex
    let uuid_clean = uuid.replace('-', "");
    let aad =
        hex::decode(&uuid_clean).map_err(|e| format!("Erreur decodage hex de l'UUID: {}", e))?;

    // Dechiffrer avec AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Erreur initialisation AES-GCM: {}", e))?;

    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(
            nonce,
            Payload {
                msg: &ciphertext_and_tag,
                aad: &aad,
            },
        )
        .map_err(|_| "Echec du dechiffrement AES-GCM (cle ou AAD incorrects)".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("Erreur decodage UTF-8: {}", e))
}

/// Chiffre une valeur avec AES-256-GCM pour ecriture dans le vault
///
/// Retourne (value_hex, key_bytes_44) ou :
/// - value_hex = ciphertext+tag encode en hex
/// - key_bytes_44 = 32 octets de cle AES + 12 octets de nonce
pub fn encrypt_field_value(plaintext: &str, uuid: &str) -> Result<(String, Vec<u8>), String> {
    use rand::RngCore;

    // Generer une cle AES-256 aleatoire (32 octets)
    let mut key = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key);

    // Generer un nonce aleatoire (12 octets)
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    // AAD = UUID sans tirets, decode hex
    let uuid_clean = uuid.replace('-', "");
    let aad =
        hex::decode(&uuid_clean).map_err(|e| format!("Erreur decodage hex de l'UUID: {}", e))?;

    // Chiffrer
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Erreur init AES-GCM: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext_and_tag = cipher
        .encrypt(
            nonce,
            Payload {
                msg: plaintext.as_bytes(),
                aad: &aad,
            },
        )
        .map_err(|e| format!("Erreur chiffrement AES-GCM: {}", e))?;

    let value_hex = hex::encode(&ciphertext_and_tag);

    // Concatener key (32) + nonce (12) = 44 octets
    let mut item_key = Vec::with_capacity(44);
    item_key.extend_from_slice(&key);
    item_key.extend_from_slice(&nonce_bytes);

    Ok((value_hex, item_key))
}

// =========================================================================
// Fonctions de haut niveau pour les commandes Tauri
// =========================================================================

/// Parametres de connexion au vault (local ou WebDAV)
pub struct VaultConfig<'a> {
    /// Chemin local du vault (mode local)
    pub vault_path: &'a str,
    /// Mode : "webdav" ou "" (local)
    pub mode: &'a str,
    /// URL WebDAV (mode webdav)
    pub webdav_url: &'a str,
    /// Nom d'utilisateur pCloud (mode webdav)
    pub pcloud_username: &'a str,
    /// Mot de passe pCloud (mode webdav)
    pub pcloud_password: &'a str,
}

/// Ouvre le vault en mode automatique (local ou WebDAV selon la config)
fn open_vault_auto(config: &VaultConfig, master_password: &str) -> Result<Connection, String> {
    if config.mode == "webdav" {
        if config.webdav_url.is_empty() {
            return Err("URL WebDAV non configuree. Allez dans Parametres > Enpass.".to_string());
        }
        if config.pcloud_username.is_empty() || config.pcloud_password.is_empty() {
            return Err(
                "Identifiants pCloud requis pour le mode WebDAV. Allez dans Parametres > Enpass."
                    .to_string(),
            );
        }
        open_vault_webdav(
            config.webdav_url,
            config.pcloud_username,
            config.pcloud_password,
            master_password,
        )
    } else {
        open_vault(config.vault_path, master_password)
    }
}

/// Liste les entrees du vault correspondant a un filtre
pub fn list_entries(
    vault_path: &str,
    filter: &str,
    master_password: &str,
) -> Result<Vec<EnpassEntry>, String> {
    let conn = open_vault(vault_path, master_password)?;

    let filter_lower = filter.to_lowercase();
    let has_filter = !filter_lower.is_empty();

    let query = r#"
        SELECT item.uuid, item.title, item.subtitle, item.note,
               item.category, item.trashed, item.deleted,
               itemfield.label, itemfield.type, itemfield.sensitive,
               itemfield.value, item.key
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
    "#;

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Erreur preparation requete: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let uuid: String = row.get(0)?;
            let title: String = row.get(1)?;
            let subtitle: String = row.get(2)?;
            let note: String = row.get(3)?;
            let category: String = row.get(4)?;
            let trashed: i64 = row.get(5)?;
            let deleted: i64 = row.get(6)?;
            let label: String = row.get(7)?;
            let field_type: String = row.get(8)?;
            let sensitive: bool = row.get::<_, i64>(9)? != 0;
            let raw_value: String = row.get(10)?;
            let item_key: Vec<u8> = row.get(11)?;

            Ok((
                uuid, title, subtitle, note, category, trashed, deleted, label, field_type,
                sensitive, raw_value, item_key,
            ))
        })
        .map_err(|e| format!("Erreur execution requete: {}", e))?;

    let mut entries = Vec::new();

    for row_result in rows {
        let (
            uuid,
            title,
            subtitle,
            note,
            category,
            trashed,
            deleted,
            label,
            field_type,
            sensitive,
            raw_value,
            item_key,
        ) = row_result.map_err(|e| format!("Erreur lecture ligne: {}", e))?;

        // Filtre sur title/subtitle
        if has_filter {
            let title_lower = title.to_lowercase();
            let subtitle_lower = subtitle.to_lowercase();
            if !title_lower.contains(&filter_lower) && !subtitle_lower.contains(&filter_lower) {
                continue;
            }
        }

        // Dechiffrer la valeur si c'est un champ password
        let value = if field_type == "password" && sensitive && !raw_value.is_empty() {
            decrypt_field_value(&item_key, &raw_value, &uuid).unwrap_or_default()
        } else {
            raw_value
        };

        entries.push(EnpassEntry {
            uuid,
            title,
            subtitle,
            note,
            category,
            trashed,
            deleted,
            label,
            field_type,
            sensitive,
            value,
        });
    }

    Ok(entries)
}

/// Recupere le mot de passe d'une entree par son titre
pub fn get_password(
    vault_path: &str,
    entry_name: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault(vault_path, master_password)?;

    let entry_lower = entry_name.to_lowercase();

    let query = r#"
        SELECT item.uuid, itemfield.value, item.key
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
          AND item.trashed = 0
          AND itemfield.type = 'password'
          AND itemfield.sensitive = 1
          AND (instr(lower(item.title), ?1) > 0 OR instr(lower(item.subtitle), ?1) > 0)
        LIMIT 1
    "#;

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Erreur preparation requete: {}", e))?;

    let result = stmt
        .query_row([&entry_lower], |row| {
            let uuid: String = row.get(0)?;
            let value_hex: String = row.get(1)?;
            let item_key: Vec<u8> = row.get(2)?;
            Ok((uuid, value_hex, item_key))
        })
        .map_err(|_| format!("Entree '{}' non trouvee dans le vault", entry_name))?;

    let (uuid, value_hex, item_key) = result;
    decrypt_field_value(&item_key, &value_hex, &uuid)
}

/// Recupere les details d'une entree (tous les champs) par son titre
pub fn show_entry(
    vault_path: &str,
    entry_name: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault(vault_path, master_password)?;

    let entry_lower = entry_name.to_lowercase();

    // D'abord trouver l'UUID de l'item
    let uuid: String = conn
        .query_row(
            r#"
            SELECT uuid FROM item
            WHERE deleted = 0 AND trashed = 0
              AND (instr(lower(title), ?1) > 0 OR instr(lower(subtitle), ?1) > 0)
            LIMIT 1
            "#,
            [&entry_lower],
            |row| row.get(0),
        )
        .map_err(|_| format!("Entree '{}' non trouvee", entry_name))?;

    // Puis recuperer tous les champs de cet item
    let item_key: Vec<u8> = conn
        .query_row("SELECT key FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Erreur lecture cle item: {}", e))?;

    let title: String = conn
        .query_row("SELECT title FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    let subtitle: String = conn
        .query_row(
            "SELECT subtitle FROM item WHERE uuid = ?1",
            [&uuid],
            |row| row.get(0),
        )
        .unwrap_or_default();

    let note: String = conn
        .query_row("SELECT note FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    // Recuperer les champs itemfield
    let mut stmt = conn
        .prepare(
            r#"
            SELECT type, value, sensitive, label
            FROM itemfield
            WHERE item_uuid = ?1 AND deleted = 0
            "#,
        )
        .map_err(|e| format!("Erreur preparation requete champs: {}", e))?;

    let fields = stmt
        .query_map([&uuid], |row| {
            let field_type: String = row.get(0)?;
            let value: String = row.get(1)?;
            let sensitive: bool = row.get::<_, i64>(2)? != 0;
            let label: String = row.get(3)?;
            Ok((field_type, value, sensitive, label))
        })
        .map_err(|e| format!("Erreur lecture champs: {}", e))?;

    // Construire un JSON de sortie compatible avec ce qu'attendait le frontend
    // (format similaire a la sortie JSON de enpass-cli show)
    let mut json_obj = serde_json::Map::new();
    json_obj.insert("uuid".into(), serde_json::Value::String(uuid.clone()));
    json_obj.insert("title".into(), serde_json::Value::String(title));
    json_obj.insert("subtitle".into(), serde_json::Value::String(subtitle));
    json_obj.insert("note".into(), serde_json::Value::String(note));

    for field_result in fields {
        let (field_type, raw_value, sensitive, label) =
            field_result.map_err(|e| format!("Erreur iteration champs: {}", e))?;

        let decrypted = if field_type == "password" && sensitive && !raw_value.is_empty() {
            decrypt_field_value(&item_key, &raw_value, &uuid).unwrap_or_default()
        } else {
            raw_value
        };

        // Utiliser le type de champ comme cle, ou le label si present
        let key = if !label.is_empty() {
            label
        } else {
            field_type.clone()
        };

        // Mapping pour compatibilite : "username" -> "login"
        let normalized_key = match key.as_str() {
            "username" | "Username" | "E-mail" | "email" => "login".to_string(),
            "password" | "Password" => "password".to_string(),
            "url" | "URL" => "url".to_string(),
            other => other.to_string(),
        };

        json_obj.insert(normalized_key, serde_json::Value::String(decrypted));
    }

    serde_json::to_string(&json_obj).map_err(|e| format!("Erreur serialisation JSON: {}", e))
}

/// Cree une nouvelle entree dans le vault Enpass
pub fn create_entry(
    vault_path: &str,
    title: &str,
    login: &str,
    password: &str,
    url: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault(vault_path, master_password)?;

    let entry_uuid = generate_uuid();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Erreur temps systeme: {}", e))?
        .as_secs() as i64;

    // Chiffrer le mot de passe si present
    let (encrypted_value, item_key) = if !password.is_empty() {
        let (val, key) = encrypt_field_value(password, &entry_uuid)?;
        (Some(val), key)
    } else {
        (None, Vec::new())
    };

    // Transaction
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| format!("Erreur debut transaction: {}", e))?;

    // Inserer dans item
    conn.execute(
        r#"
        INSERT INTO item (uuid, created_at, field_updated_at, title, subtitle,
                          note, trashed, deleted, category, icon, last_used, key)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?8, ?9, ?10)
        "#,
        rusqlite::params![
            entry_uuid,
            now,
            now,
            title,
            login,
            "",
            "Login",
            "card_password",
            now,
            item_key
        ],
    )
    .map_err(|e| {
        let _ = conn.execute_batch("ROLLBACK");
        format!("Erreur insertion item: {}", e)
    })?;

    // Inserer le champ password
    if let Some(ref enc_val) = encrypted_value {
        conn.execute(
            r#"
            INSERT INTO itemfield (item_uuid, label, value, deleted, sensitive, type)
            VALUES (?1, ?2, ?3, 0, 1, ?4)
            "#,
            rusqlite::params![entry_uuid, "", enc_val, "password"],
        )
        .map_err(|e| {
            let _ = conn.execute_batch("ROLLBACK");
            format!("Erreur insertion champ password: {}", e)
        })?;
    }

    // Inserer le champ username
    if !login.is_empty() {
        conn.execute(
            r#"
            INSERT INTO itemfield (item_uuid, label, value, deleted, sensitive, type)
            VALUES (?1, ?2, ?3, 0, 0, ?4)
            "#,
            rusqlite::params![entry_uuid, "", login, "username"],
        )
        .map_err(|e| {
            let _ = conn.execute_batch("ROLLBACK");
            format!("Erreur insertion champ username: {}", e)
        })?;
    }

    // Inserer le champ URL
    if !url.is_empty() {
        conn.execute(
            r#"
            INSERT INTO itemfield (item_uuid, label, value, deleted, sensitive, type)
            VALUES (?1, ?2, ?3, 0, 0, ?4)
            "#,
            rusqlite::params![entry_uuid, "", url, "url"],
        )
        .map_err(|e| {
            let _ = conn.execute_batch("ROLLBACK");
            format!("Erreur insertion champ URL: {}", e)
        })?;
    }

    conn.execute_batch("COMMIT")
        .map_err(|e| format!("Erreur commit transaction: {}", e))?;

    Ok(entry_uuid)
}

/// Verifie que le vault est accessible avec le mot de passe donne
pub fn check_setup(vault_path: &str, master_password: &str) -> Result<(), String> {
    let conn = open_vault(vault_path, master_password)?;

    // Verifier que la table item existe
    let table_name: String = conn
        .query_row(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='item'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Table 'item' introuvable dans le vault".to_string())?;

    if table_name != "item" {
        return Err("Structure du vault invalide".to_string());
    }

    Ok(())
}

/// Diagnostic : cherche une entree par titre et retourne les informations de debug
/// Utile pour comprendre pourquoi une entree n'est pas trouvee
pub fn debug_search(
    vault_path: &str,
    search_term: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault(vault_path, master_password)?;

    let search_lower = search_term.to_lowercase();
    let mut debug_info = Vec::new();

    // 1. Compter le nombre total d'items non supprimes
    let total_items: i64 = conn
        .query_row("SELECT count(*) FROM item WHERE deleted = 0", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);
    debug_info.push(format!("Total items dans le vault: {}", total_items));

    // 2. Chercher les items dont le titre contient le terme de recherche (recherche Rust, pas SQL)
    let mut stmt = conn
        .prepare(
            "SELECT uuid, title, subtitle, category, trashed, deleted FROM item WHERE deleted = 0",
        )
        .map_err(|e| format!("Erreur: {}", e))?;

    let items: Vec<(String, String, String, String, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| format!("Erreur: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // 3. Chercher les correspondances
    let mut matches = Vec::new();
    for (uuid, title, subtitle, category, trashed, _deleted) in &items {
        let title_lower = title.to_lowercase();
        let subtitle_lower = subtitle.to_lowercase();
        if title_lower.contains(&search_lower) || subtitle_lower.contains(&search_lower) {
            matches.push(format!(
                "  MATCH: title='{}', subtitle='{}', category='{}', trashed={}, uuid={}",
                title, subtitle, category, trashed, uuid
            ));

            // Verifier les champs itemfield pour cette entree
            let mut field_stmt = conn
                .prepare("SELECT type, sensitive, label, length(value) FROM itemfield WHERE item_uuid = ?1 AND deleted = 0")
                .map_err(|e| format!("Erreur: {}", e))?;

            let fields: Vec<String> = field_stmt
                .query_map([uuid], |row| {
                    let ft: String = row.get(0)?;
                    let sens: i64 = row.get(1)?;
                    let label: String = row.get(2)?;
                    let val_len: i64 = row.get(3)?;
                    Ok(format!(
                        "    field: type='{}', sensitive={}, label='{}', value_len={}",
                        ft, sens, label, val_len
                    ))
                })
                .map_err(|e| format!("Erreur: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            for f in fields {
                matches.push(f);
            }
        }
    }

    if matches.is_empty() {
        debug_info.push(format!("Aucune correspondance pour '{}'", search_term));

        // Montrer les 10 premiers titres pour aider
        debug_info.push("Premiers titres dans le vault:".to_string());
        for (_, title, subtitle, category, trashed, _) in items.iter().take(20) {
            debug_info.push(format!(
                "  - '{}' (subtitle='{}', cat='{}', trashed={})",
                title, subtitle, category, trashed
            ));
        }
    } else {
        debug_info.push(format!("Correspondances trouvees ({}):", matches.len()));
        debug_info.extend(matches);
    }

    // 4. Tester aussi la recherche SQL comme le fait get_password
    let sql_test = conn.query_row(
        r#"
        SELECT item.uuid, itemfield.type, itemfield.sensitive
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
          AND item.trashed = 0
          AND itemfield.type = 'password'
          AND itemfield.sensitive = 1
          AND (instr(lower(item.title), ?1) > 0 OR instr(lower(item.subtitle), ?1) > 0)
        LIMIT 1
        "#,
        [&search_lower],
        |row| {
            let uuid: String = row.get(0)?;
            let ft: String = row.get(1)?;
            let sens: i64 = row.get(2)?;
            Ok(format!(
                "SQL match: uuid={}, type={}, sensitive={}",
                uuid, ft, sens
            ))
        },
    );

    match sql_test {
        Ok(info) => debug_info.push(format!("Requete SQL get_password: OK - {}", info)),
        Err(e) => debug_info.push(format!("Requete SQL get_password: ECHEC - {}", e)),
    }

    Ok(debug_info.join("\n"))
}

/// Detecte automatiquement le(s) vault(s) Enpass sur la machine
///
/// Cherche dans les emplacements standards :
/// - Windows: %APPDATA%\Sinew Software Systems Pvt Ltd\Enpass\Enpass\Vaults\
/// - macOS: ~/Library/Containers/in.sinew.Enpass-Desktop/Data/Documents/Vaults/
/// - Linux: ~/.local/share/Enpass/Vaults/
///
/// Retourne la liste des chemins de vaults trouves
pub fn detect_vaults() -> Vec<String> {
    let mut vaults = Vec::new();

    // Emplacements possibles des vaults Enpass
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = dirs::data_dir() {
            // %APPDATA% = C:\Users\<user>\AppData\Roaming
            let roaming = appdata
                .parent()
                .map(|p| p.join("Roaming"))
                .unwrap_or(appdata.clone());
            search_dirs.push(
                roaming
                    .join("Sinew Software Systems Pvt Ltd")
                    .join("Enpass")
                    .join("Enpass")
                    .join("Vaults"),
            );
            // Ancien emplacement possible
            search_dirs.push(roaming.join("Enpass").join("Vaults"));
        }
        // Aussi chercher dans AppData\Local
        if let Some(local) = dirs::data_local_dir() {
            search_dirs.push(local.join("Enpass").join("Vaults"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            search_dirs.push(
                home.join("Library")
                    .join("Containers")
                    .join("in.sinew.Enpass-Desktop")
                    .join("Data")
                    .join("Documents")
                    .join("Vaults"),
            );
            // Installation hors App Store
            search_dirs.push(home.join("Documents").join("Enpass").join("Vaults"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            search_dirs.push(
                home.join(".local")
                    .join("share")
                    .join("Enpass")
                    .join("Vaults"),
            );
        }
    }

    for dir in &search_dirs {
        if !dir.exists() {
            continue;
        }

        // Lister les sous-dossiers (chaque sous-dossier est un vault)
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Verifier qu'il contient vault.enpassdb ou un .walletx
                    let has_db = path.join("vault.enpassdb").exists();
                    let has_walletx = path.join("vault.json").exists();
                    if has_db || has_walletx {
                        vaults.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    vaults
}

// =========================================================================
// Fonctions avec VaultConfig (supportent local + WebDAV)
// =========================================================================

/// Liste les entrees du vault correspondant a un filtre (mode auto)
pub fn list_entries_with_config(
    config: &VaultConfig,
    filter: &str,
    master_password: &str,
) -> Result<Vec<EnpassEntry>, String> {
    let conn = open_vault_auto(config, master_password)?;
    list_entries_from_conn(&conn, filter)
}

/// Recupere le mot de passe d'une entree par son titre (mode auto)
pub fn get_password_with_config(
    config: &VaultConfig,
    entry_name: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault_auto(config, master_password)?;
    get_password_from_conn(&conn, entry_name)
}

/// Recupere les details d'une entree (mode auto)
pub fn show_entry_with_config(
    config: &VaultConfig,
    entry_name: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault_auto(config, master_password)?;
    show_entry_from_conn(&conn, entry_name)
}

/// Cree une nouvelle entree dans le vault (mode auto)
/// Note : l'ecriture n'est PAS supportee en mode WebDAV (lecture seule)
pub fn create_entry_with_config(
    config: &VaultConfig,
    title: &str,
    login: &str,
    password: &str,
    url: &str,
    master_password: &str,
) -> Result<String, String> {
    if config.mode == "webdav" {
        return Err("La creation d'entrees n'est pas supportee en mode WebDAV (lecture seule). Creez vos entrees directement dans Enpass.".to_string());
    }
    create_entry(
        config.vault_path,
        title,
        login,
        password,
        url,
        master_password,
    )
}

/// Verifie que le vault est accessible (mode auto)
pub fn check_setup_with_config(config: &VaultConfig, master_password: &str) -> Result<(), String> {
    let conn = open_vault_auto(config, master_password)?;

    // Verifier que la table item existe
    let table_name: String = conn
        .query_row(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='item'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Table 'item' introuvable dans le vault".to_string())?;

    if table_name != "item" {
        return Err("Structure du vault invalide".to_string());
    }

    Ok(())
}

/// Diagnostic de recherche (mode auto)
pub fn debug_search_with_config(
    config: &VaultConfig,
    search_term: &str,
    master_password: &str,
) -> Result<String, String> {
    let conn = open_vault_auto(config, master_password)?;
    debug_search_from_conn(&conn, search_term)
}

/// Synchronise le vault WebDAV (force le re-telechargement)
pub fn sync_webdav_vault(
    webdav_url: &str,
    pcloud_username: &str,
    pcloud_password: &str,
) -> Result<String, String> {
    // Invalider le cache pour forcer le telechargement
    invalidate_webdav_cache();

    let db_path = download_vault_from_webdav(webdav_url, pcloud_username, pcloud_password)?;

    // Verifier la taille du fichier SQLCipher extrait
    let db_size = fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);

    // Lire les iterations KDF depuis vault_info.json
    let temp_dir = std::env::temp_dir().join("cockpit-enpass-webdav");
    let json_path = temp_dir.join("vault_info.json");

    let kdf_info = if json_path.exists() {
        match fs::read_to_string(&json_path) {
            Ok(json) => match serde_json::from_str::<VaultInfo>(&json) {
                Ok(info) => format!("KDF: {} ({} iter)", info.kdf_algo, info.kdf_iter),
                Err(e) => format!("JSON parse error: {}", e),
            },
            Err(_) => "vault_info.json illisible".to_string(),
        }
    } else {
        "vault_info.json non trouve".to_string()
    };

    // Diagnostic : lire les 16 premiers octets du fichier SQLCipher extrait
    let db_header = {
        let mut buf = vec![0u8; 16];
        if let Ok(mut f) = fs::File::open(&db_path) {
            let _ = f.read_exact(&mut buf);
        }
        hex::encode(&buf)
    };

    // Lire les infos de debug du split
    let split_info = fs::read_to_string(temp_dir.join("split_debug.txt")).unwrap_or_default();

    Ok(format!(
        "Vault extrait ! DB: {:.1} Ko (sel: {}). {}. {}",
        db_size as f64 / 1024.0,
        db_header,
        split_info,
        kdf_info
    ))
}

// =========================================================================
// Fonctions internes operant sur une Connection deja ouverte
// =========================================================================

/// Liste les entrees depuis une connexion deja ouverte
fn list_entries_from_conn(conn: &Connection, filter: &str) -> Result<Vec<EnpassEntry>, String> {
    let filter_lower = filter.to_lowercase();
    let has_filter = !filter_lower.is_empty();

    let query = r#"
        SELECT item.uuid, item.title, item.subtitle, item.note,
               item.category, item.trashed, item.deleted,
               itemfield.label, itemfield.type, itemfield.sensitive,
               itemfield.value, item.key
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
    "#;

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Erreur preparation requete: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let uuid: String = row.get(0)?;
            let title: String = row.get(1)?;
            let subtitle: String = row.get(2)?;
            let note: String = row.get(3)?;
            let category: String = row.get(4)?;
            let trashed: i64 = row.get(5)?;
            let deleted: i64 = row.get(6)?;
            let label: String = row.get(7)?;
            let field_type: String = row.get(8)?;
            let sensitive: bool = row.get::<_, i64>(9)? != 0;
            let raw_value: String = row.get(10)?;
            let item_key: Vec<u8> = row.get(11)?;

            Ok((
                uuid, title, subtitle, note, category, trashed, deleted, label, field_type,
                sensitive, raw_value, item_key,
            ))
        })
        .map_err(|e| format!("Erreur execution requete: {}", e))?;

    let mut entries = Vec::new();

    for row_result in rows {
        let (
            uuid,
            title,
            subtitle,
            note,
            category,
            trashed,
            deleted,
            label,
            field_type,
            sensitive,
            raw_value,
            item_key,
        ) = row_result.map_err(|e| format!("Erreur lecture ligne: {}", e))?;

        if has_filter {
            let title_lower = title.to_lowercase();
            let subtitle_lower = subtitle.to_lowercase();
            if !title_lower.contains(&filter_lower) && !subtitle_lower.contains(&filter_lower) {
                continue;
            }
        }

        let value = if field_type == "password" && sensitive && !raw_value.is_empty() {
            decrypt_field_value(&item_key, &raw_value, &uuid).unwrap_or_default()
        } else {
            raw_value
        };

        entries.push(EnpassEntry {
            uuid,
            title,
            subtitle,
            note,
            category,
            trashed,
            deleted,
            label,
            field_type,
            sensitive,
            value,
        });
    }

    Ok(entries)
}

/// Recupere le mot de passe d'une entree depuis une connexion deja ouverte
fn get_password_from_conn(conn: &Connection, entry_name: &str) -> Result<String, String> {
    let entry_lower = entry_name.to_lowercase();

    let query = r#"
        SELECT item.uuid, itemfield.value, item.key
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
          AND item.trashed = 0
          AND itemfield.type = 'password'
          AND itemfield.sensitive = 1
          AND (instr(lower(item.title), ?1) > 0 OR instr(lower(item.subtitle), ?1) > 0)
        LIMIT 1
    "#;

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Erreur preparation requete: {}", e))?;

    let result = stmt
        .query_row([&entry_lower], |row| {
            let uuid: String = row.get(0)?;
            let value_hex: String = row.get(1)?;
            let item_key: Vec<u8> = row.get(2)?;
            Ok((uuid, value_hex, item_key))
        })
        .map_err(|_| format!("Entree '{}' non trouvee dans le vault", entry_name))?;

    let (uuid, value_hex, item_key) = result;
    decrypt_field_value(&item_key, &value_hex, &uuid)
}

/// Recupere les details d'une entree depuis une connexion deja ouverte
fn show_entry_from_conn(conn: &Connection, entry_name: &str) -> Result<String, String> {
    let entry_lower = entry_name.to_lowercase();

    let uuid: String = conn
        .query_row(
            r#"
            SELECT uuid FROM item
            WHERE deleted = 0 AND trashed = 0
              AND (instr(lower(title), ?1) > 0 OR instr(lower(subtitle), ?1) > 0)
            LIMIT 1
            "#,
            [&entry_lower],
            |row| row.get(0),
        )
        .map_err(|_| format!("Entree '{}' non trouvee", entry_name))?;

    let item_key: Vec<u8> = conn
        .query_row("SELECT key FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Erreur lecture cle item: {}", e))?;

    let title: String = conn
        .query_row("SELECT title FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    let subtitle: String = conn
        .query_row(
            "SELECT subtitle FROM item WHERE uuid = ?1",
            [&uuid],
            |row| row.get(0),
        )
        .unwrap_or_default();

    let note: String = conn
        .query_row("SELECT note FROM item WHERE uuid = ?1", [&uuid], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT type, value, sensitive, label
            FROM itemfield
            WHERE item_uuid = ?1 AND deleted = 0
            "#,
        )
        .map_err(|e| format!("Erreur preparation requete champs: {}", e))?;

    let fields = stmt
        .query_map([&uuid], |row| {
            let field_type: String = row.get(0)?;
            let value: String = row.get(1)?;
            let sensitive: bool = row.get::<_, i64>(2)? != 0;
            let label: String = row.get(3)?;
            Ok((field_type, value, sensitive, label))
        })
        .map_err(|e| format!("Erreur lecture champs: {}", e))?;

    let mut json_obj = serde_json::Map::new();
    json_obj.insert("uuid".into(), serde_json::Value::String(uuid.clone()));
    json_obj.insert("title".into(), serde_json::Value::String(title));
    json_obj.insert("subtitle".into(), serde_json::Value::String(subtitle));
    json_obj.insert("note".into(), serde_json::Value::String(note));

    for field_result in fields {
        let (field_type, raw_value, sensitive, label) =
            field_result.map_err(|e| format!("Erreur iteration champs: {}", e))?;

        let decrypted = if field_type == "password" && sensitive && !raw_value.is_empty() {
            decrypt_field_value(&item_key, &raw_value, &uuid).unwrap_or_default()
        } else {
            raw_value
        };

        let key = if !label.is_empty() {
            label
        } else {
            field_type.clone()
        };

        let normalized_key = match key.as_str() {
            "username" | "Username" | "E-mail" | "email" => "login".to_string(),
            "password" | "Password" => "password".to_string(),
            "url" | "URL" => "url".to_string(),
            other => other.to_string(),
        };

        json_obj.insert(normalized_key, serde_json::Value::String(decrypted));
    }

    serde_json::to_string(&json_obj).map_err(|e| format!("Erreur serialisation JSON: {}", e))
}

/// Diagnostic de recherche depuis une connexion deja ouverte
fn debug_search_from_conn(conn: &Connection, search_term: &str) -> Result<String, String> {
    let search_lower = search_term.to_lowercase();
    let mut debug_info = Vec::new();

    // 1. Compter le nombre total d'items non supprimes
    let total_items: i64 = conn
        .query_row("SELECT count(*) FROM item WHERE deleted = 0", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);
    debug_info.push(format!("Total items dans le vault: {}", total_items));

    // 2. Chercher les items dont le titre contient le terme de recherche (recherche Rust, pas SQL)
    let mut stmt = conn
        .prepare(
            "SELECT uuid, title, subtitle, category, trashed, deleted FROM item WHERE deleted = 0",
        )
        .map_err(|e| format!("Erreur: {}", e))?;

    let items: Vec<(String, String, String, String, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| format!("Erreur: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // 3. Chercher les correspondances
    let mut matches = Vec::new();
    for (uuid, title, subtitle, category, trashed, _deleted) in &items {
        let title_lower = title.to_lowercase();
        let subtitle_lower = subtitle.to_lowercase();
        if title_lower.contains(&search_lower) || subtitle_lower.contains(&search_lower) {
            matches.push(format!(
                "  MATCH: title='{}', subtitle='{}', category='{}', trashed={}, uuid={}",
                title, subtitle, category, trashed, uuid
            ));

            // Verifier les champs itemfield pour cette entree
            let mut field_stmt = conn
                .prepare("SELECT type, sensitive, label, length(value) FROM itemfield WHERE item_uuid = ?1 AND deleted = 0")
                .map_err(|e| format!("Erreur: {}", e))?;

            let fields: Vec<String> = field_stmt
                .query_map([uuid], |row| {
                    let ft: String = row.get(0)?;
                    let sens: i64 = row.get(1)?;
                    let label: String = row.get(2)?;
                    let val_len: i64 = row.get(3)?;
                    Ok(format!(
                        "    field: type='{}', sensitive={}, label='{}', value_len={}",
                        ft, sens, label, val_len
                    ))
                })
                .map_err(|e| format!("Erreur: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            for f in fields {
                matches.push(f);
            }
        }
    }

    if matches.is_empty() {
        debug_info.push(format!("Aucune correspondance pour '{}'", search_term));

        // Montrer les 20 premiers titres pour aider
        debug_info.push("Premiers titres dans le vault:".to_string());
        for (_, title, subtitle, category, trashed, _) in items.iter().take(20) {
            debug_info.push(format!(
                "  - '{}' (subtitle='{}', cat='{}', trashed={})",
                title, subtitle, category, trashed
            ));
        }
    } else {
        debug_info.push(format!("Correspondances trouvees ({}):", matches.len()));
        debug_info.extend(matches);
    }

    // 4. Tester aussi la recherche SQL comme le fait get_password
    let sql_test = conn.query_row(
        r#"
        SELECT item.uuid, itemfield.type, itemfield.sensitive
        FROM item
        INNER JOIN itemfield ON item.uuid = itemfield.item_uuid
        WHERE item.deleted = 0
          AND item.trashed = 0
          AND itemfield.type = 'password'
          AND itemfield.sensitive = 1
          AND (instr(lower(item.title), ?1) > 0 OR instr(lower(item.subtitle), ?1) > 0)
        LIMIT 1
        "#,
        [&search_lower],
        |row| {
            let uuid: String = row.get(0)?;
            let ft: String = row.get(1)?;
            let sens: i64 = row.get(2)?;
            Ok(format!(
                "SQL match: uuid={}, type={}, sensitive={}",
                uuid, ft, sens
            ))
        },
    );

    match sql_test {
        Ok(info) => debug_info.push(format!("Requete SQL get_password: OK - {}", info)),
        Err(e) => debug_info.push(format!("Requete SQL get_password: ECHEC - {}", e)),
    }

    Ok(debug_info.join("\n"))
}

/// Genere un UUID v4 simple (sans dependance externe)
fn generate_uuid() -> String {
    use rand::RngCore;

    let mut bytes = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut bytes);

    // Version 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Variant 1
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        u16::from_be_bytes([bytes[8], bytes[9]]),
        // Les 6 derniers octets comme un u64 (avec 0-padding)
        u64::from_be_bytes([
            0, 0, bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
        ])
    )
}
