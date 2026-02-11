# Version Portable de Cockpit CFDT

## Qu'est-ce que la version portable ?

La version portable vous permet de :
- ✅ Stocker l'application sur un **SSD USB** ou disque externe
- ✅ Utiliser l'application sur **plusieurs PC** (Windows et/ou Mac)
- ✅ Conserver vos **données avec l'application** sur le disque externe
- ✅ Pas besoin d'installation, lancez directement l'exécutable
- ✅ **Plus sécurisé** : vos données restent sur votre disque, pas sur le PC

## Comment créer la version portable ?

### Windows

1. **Après la compilation** (GitHub Actions ou locale), récupérez :
   - `cockpit-cfdt.exe` dans `src-tauri/target/release/`
   
2. **Créez un dossier** sur votre SSD USB, par exemple :
   ```
   E:\CockpitCFDT\
   ```

3. **Copiez** l'exécutable dans ce dossier

4. **Créez un fichier vide** nommé `.portable` dans le même dossier :
   ```
   E:\CockpitCFDT\.portable
   ```

5. **Structure finale** :
   ```
   E:\CockpitCFDT\
   ├── cockpit-cfdt.exe
   ├── .portable
   └── (les données seront créées automatiquement au premier lancement)
   ```

6. **Lancez** `cockpit-cfdt.exe` - vos données seront stockées dans `E:\CockpitCFDT\data\`

### macOS

1. **Après la compilation**, récupérez :
   - `Cockpit CFDT.app` dans `src-tauri/target/release/bundle/macos/`
   
2. **Créez un dossier** sur votre SSD USB, par exemple :
   ```
   /Volumes/MonSSD/CockpitCFDT/
   ```

3. **Copiez** l'application dans ce dossier

4. **Créez un fichier vide** nommé `.portable` dans le même dossier :
   ```
   /Volumes/MonSSD/CockpitCFDT/.portable
   ```

5. **Structure finale** :
   ```
   /Volumes/MonSSD/CockpitCFDT/
   ├── Cockpit CFDT.app
   ├── .portable
   └── (les données seront créées automatiquement au premier lancement)
   ```

6. **Lancez** l'application - vos données seront stockées dans `/Volumes/MonSSD/CockpitCFDT/data/`

## Mode Installation Classique vs Mode Portable

| Caractéristique | Installation Classique | Mode Portable |
|----------------|------------------------|---------------|
| **Installation** | Via MSI (Windows) ou DMG (macOS) | Aucune, juste copier |
| **Stockage données** | AppData (C:\Users\...) ou ~/Library | À côté de l'exe/app |
| **Utilisation** | Un seul PC | Plusieurs PC via SSD USB |
| **Mise à jour** | Réinstaller le MSI/DMG | Remplacer l'exe/app |
| **Sécurité** | Données sur le PC | Données sur SSD (plus sécurisé) |

## Synchronisation Windows ↔️ Mac

Avec le mode portable sur SSD USB :

1. **Utilisez l'application sur Windows** :
   - Vos sites sont enregistrés dans `E:\CockpitCFDT\data\`

2. **Branchez le SSD sur Mac** :
   - Les mêmes données sont accessibles
   - Lancez l'application Mac depuis le SSD
   - Vos sites apparaissent automatiquement !

3. **Pas de conflit** :
   - Un seul fichier de données partagé
   - Fonctionne tant que vous n'utilisez pas les deux PC en même temps

## Sécurité

### Recommandations :

1. **Chiffrez votre SSD** :
   - Windows : BitLocker
   - macOS : FileVault ou chiffrement de disque externe

2. **Mot de passe fort** :
   - L'application chiffre vos données
   - Utilisez un mot de passe complexe

3. **Sauvegarde** :
   - Copiez régulièrement le dossier `data/` ailleurs
   - L'application crée des backups automatiques dans `data/backups/`

## Troubleshooting

### L'application ne détecte pas le mode portable

- Vérifiez que le fichier `.portable` existe bien
- Vérifiez qu'il est au bon endroit (à côté de l'exe/app, pas dans un sous-dossier)
- Sur Windows, vérifiez que l'extension est bien `.portable` et non `.portable.txt`

### Les données ne sont pas synchronisées

- Vérifiez que vous utilisez bien le même SSD sur les deux PC
- Assurez-vous que le SSD est monté au même emplacement
- Vérifiez les logs de l'application (console)

### Permission refusée sur macOS

- Clic droit sur l'application > Ouvrir
- Acceptez l'avertissement de sécurité
- Ou : Préférences Système > Sécurité > Autoriser l'application
