# 🎨 GÉNÉRER LES ICÔNES COCKPIT CFDT

## 🚨 PROBLÈME

GitHub Actions a échoué car il manque les fichiers d'icônes dans `src-tauri/icons/`

**Fichiers requis :**
- `icon.png` (1024x1024 ou 512x512)
- `32x32.png`
- `128x128.png`
- `128x128@2x.png` (256x256)
- `icon.ico` (Windows)
- `icon.icns` (macOS)

---

## ✅ SOLUTION RAPIDE (5 minutes)

### **Option 1 : Utiliser Tauri Icon** ⭐ (Recommandé)

**C'est un outil officiel Tauri qui génère TOUTES les icônes automatiquement !**

```bash
# 1. Installer l'outil
cargo install tauri-cli

# 2. Télécharger un logo orange CFDT (1024x1024)
# Ou créer une image simple avec Paint/Photoshop
# Sauvegarde-la comme : app-icon.png

# 3. Générer toutes les icônes
cargo tauri icon app-icon.png

# Résultat : Toutes les icônes sont créées dans src-tauri/icons/ !
```

---

### **Option 2 : Utiliser un outil en ligne** 🌐 (Plus rapide)

**Site : https://icon.kitchen/**

1. Va sur https://icon.kitchen/
2. Upload un logo orange CFDT (ou écris juste "C")
3. Choisis "App" comme type
4. Télécharge le ZIP généré
5. Extraire et copier tous les fichiers dans `src-tauri/icons/`

---

### **Option 3 : Télécharger mes icônes pré-faites** 📦 (Le plus rapide)

**Je vais créer un ZIP avec des icônes simples orange CFDT !**

(Voir cockpit-cfdt-ICONS.zip ci-dessous)

**Contenu :**
- Fond orange CFDT (#E7591C)
- Lettre "C" blanche au centre
- Toutes les tailles nécessaires

**Installation :**
1. Télécharge `cockpit-cfdt-ICONS.zip`
2. Extraire le contenu
3. Copie tous les fichiers dans `src-tauri/icons/`
4. `git add src-tauri/icons/`
5. `git commit -m "Ajout des icônes"`
6. `git push`

---

## 🔄 APRÈS AVOIR AJOUTÉ LES ICÔNES

```bash
# 1. Vérifier que les icônes sont là
ls src-tauri/icons/

# Tu devrais voir :
# 32x32.png
# 128x128.png
# 128x128@2x.png
# icon.icns
# icon.ico
# icon.png

# 2. Ajouter au git
git add src-tauri/icons/

# 3. Commit
git commit -m "Ajout des icônes de l'application"

# 4. Push
git push

# 5. GitHub Actions va recompiler automatiquement !
```

---

## 🎨 CRÉER UN LOGO PERSONNALISÉ (Optionnel)

**Si tu veux un vrai logo CFDT :**

1. Ouvre Paint / Photoshop / Figma
2. Crée une image 1024x1024
3. Fond orange CFDT (#E7591C)
4. Ajoute le logo CFDT ou "Cockpit CFDT"
5. Sauvegarde en PNG
6. Utilise `cargo tauri icon mon-logo.png`

---

## ⚠️ NOTES IMPORTANTES

- **Format requis :** PNG avec fond opaque (pas de transparence pour Windows)
- **Taille minimale :** 512x512 (recommandé 1024x1024)
- **Couleur :** Orange CFDT #E7591C recommandée

---

## 🆘 SI CARGO TAURI ICON NE MARCHE PAS

**Utilise le script `generate-icons.sh` (nécessite ImageMagick) :**

```bash
# Sur Windows (avec Chocolatey)
choco install imagemagick

# Puis
chmod +x generate-icons.sh
./generate-icons.sh
```

---

## 📦 CHECKLIST FINALE

- [ ] Icônes créées dans `src-tauri/icons/`
- [ ] Vérifier que `icon.ico` existe (Windows)
- [ ] Vérifier que `icon.icns` existe (macOS)
- [ ] `git add src-tauri/icons/`
- [ ] `git commit -m "Ajout des icônes"`
- [ ] `git push`
- [ ] Vérifier GitHub Actions (va recompiler automatiquement)

---

**Choisis l'option qui te convient le mieux ! 😊**
