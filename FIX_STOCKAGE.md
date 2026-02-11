# Fix - Problème de stockage personnalisé

## Problème identifié

L'application ne sauvegardait pas l'emplacement de stockage personnalisé choisi par l'utilisateur. Deux problèmes principaux :

1. **Pas de persistance** : L'emplacement choisi n'était pas sauvegardé, donc perdu au redémarrage
2. **Données non transférées** : Le nouveau dossier restait vide car les fichiers n'étaient pas copiés

## Solution implémentée

### Fichiers modifiés/créés :

1. **`src-tauri/src/config.rs`** (NOUVEAU)
   - Module de gestion de configuration persistante
   - Sauvegarde l'emplacement dans un fichier `config.json`

2. **`src-tauri/src/lib.rs`** 
   - Ajout du module `config`
   - Export du `ConfigManager`

3. **`src-tauri/src/main.rs`**
   - Ajout du `ConfigManager` dans `AppState`
   - Modification de `set_data_location()` pour :
     - Copier `sites.encrypted` vers le nouveau dossier
     - Copier tous les backups
     - Sauvegarder l'emplacement dans `config.json`
   - Nouvelle commande `get_custom_data_location()`

4. **`src/App.tsx`**
   - Modification de `getAppDirectory()` pour charger l'emplacement depuis `config.json`

5. **`src/utils/tauri.ts`**
   - Ajout de `getCustomDataLocation()`

## PROBLÈME DE COMPILATION

⚠️ **Les modifications ne peuvent pas être compilées actuellement à cause d'un problème avec le linker Windows.**

L'erreur est :
```
error: linking with `link.exe` failed: exit code: 1
note: `link.exe` returned an unexpected error
note: you may need to install Visual Studio build tools with the "C++ build tools" workload
```

## Solutions pour compiler

### Option 1 : Réparer l'environnement Rust (RECOMMANDÉ)

1. Installer Visual Studio Build Tools 2022 :
   - Télécharger depuis : https://visualstudio.microsoft.com/fr/downloads/
   - Sélectionner **"Build Tools pour Visual Studio 2022"**
   - Dans l'installateur, cocher **"Développement Desktop en C++"**
   - Installer

2. Redémarrer l'ordinateur

3. Compiler l'application :
   ```bash
   npm run tauri build
   ```

### Option 2 : Utiliser un autre ordinateur

Si vous avez accès à un autre ordinateur Windows avec un environnement Rust fonctionnel, copiez le projet et compilez-le là-bas.

### Option 3 : Utiliser WSL (Windows Subsystem for Linux)

Compiler depuis WSL si installé (mais nécessite des configurations supplémentaires pour Tauri).

## Comment ça fonctionnera une fois compilé

1. **Au premier lancement** : L'app utilise l'emplacement par défaut (AppData ou mode portable)

2. **Changement d'emplacement** :
   - L'utilisateur clique sur "Choisir un nouvel emplacement"
   - L'app copie automatiquement :
     - `sites.encrypted` (toutes les données)
     - Dossier `backups/` avec tous les fichiers
   - L'app crée un `config.json` avec le nouveau chemin

3. **Redémarrages suivants** :
   - L'app lit `config.json`
   - Charge les données depuis l'emplacement personnalisé
   - Le dossier choisi contient maintenant toutes les données

## Test après compilation

1. Lancer l'application compilée
2. Aller dans Paramètres > Stockage
3. Noter l'emplacement actuel
4. Cliquer sur "Choisir un nouvel emplacement"
5. Sélectionner un nouveau dossier (ex: `D:\MesDonnees`)
6. **Vérifier** : Le nouveau dossier doit maintenant contenir :
   - `sites.encrypted`
   - Dossier `backups/` avec tous les backups
   - `config.json`
7. Fermer et redémarrer l'application
8. Vérifier dans Paramètres que l'emplacement affiché est bien le nouveau
9. Vérifier que les données sont toujours accessibles

## Fichiers de configuration

Après changement d'emplacement, le fichier `config.json` sera créé :

**Emplacement** : À côté de `sites.encrypted`

**Contenu** :
```json
{
  "custom_data_location": "C:\\Users\\nom\\Documents\\MesDonnees"
}
```

## Besoin d'aide ?

Si le problème de compilation persiste, contactez un développeur ayant un environnement Rust fonctionnel ou installez les Build Tools de Visual Studio.
