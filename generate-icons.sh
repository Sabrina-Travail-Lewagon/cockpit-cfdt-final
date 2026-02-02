#!/bin/bash
# Script pour générer les icônes Cockpit CFDT

echo "🎨 Génération des icônes Cockpit CFDT..."

# Créer le dossier icons
mkdir -p src-tauri/icons

# Utiliser ImageMagick pour créer des icônes simples
# Icône orange CFDT avec texte "C"

# Vérifier si ImageMagick est installé
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick n'est pas installé"
    echo ""
    echo "Sur Windows (avec Chocolatey) :"
    echo "  choco install imagemagick"
    echo ""
    echo "Sur Mac :"
    echo "  brew install imagemagick"
    echo ""
    echo "Ou télécharge les icônes depuis : https://icon.kitchen"
    exit 1
fi

# Créer une icône 1024x1024 avec fond orange CFDT
convert -size 1024x1024 xc:"#E7591C" \
    -gravity center \
    -pointsize 600 \
    -fill white \
    -font Arial-Bold \
    -annotate +0+0 "C" \
    src-tauri/icons/icon.png

echo "✓ icon.png créé (1024x1024)"

# Générer les différentes tailles PNG
convert src-tauri/icons/icon.png -resize 32x32 src-tauri/icons/32x32.png
echo "✓ 32x32.png créé"

convert src-tauri/icons/icon.png -resize 128x128 src-tauri/icons/128x128.png
echo "✓ 128x128.png créé"

convert src-tauri/icons/icon.png -resize 256x256 src-tauri/icons/128x128@2x.png
echo "✓ 128x128@2x.png créé"

# Générer le .ico pour Windows (avec plusieurs résolutions)
convert src-tauri/icons/icon.png \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 -alpha on -colors 256 src-tauri/icons/icon.ico
echo "✓ icon.ico créé (Windows)"

# Générer le .icns pour macOS
# Créer un dossier temporaire pour l'iconset
mkdir -p /tmp/icon.iconset
convert src-tauri/icons/icon.png -resize 16x16 /tmp/icon.iconset/icon_16x16.png
convert src-tauri/icons/icon.png -resize 32x32 /tmp/icon.iconset/icon_16x16@2x.png
convert src-tauri/icons/icon.png -resize 32x32 /tmp/icon.iconset/icon_32x32.png
convert src-tauri/icons/icon.png -resize 64x64 /tmp/icon.iconset/icon_32x32@2x.png
convert src-tauri/icons/icon.png -resize 128x128 /tmp/icon.iconset/icon_128x128.png
convert src-tauri/icons/icon.png -resize 256x256 /tmp/icon.iconset/icon_128x128@2x.png
convert src-tauri/icons/icon.png -resize 256x256 /tmp/icon.iconset/icon_256x256.png
convert src-tauri/icons/icon.png -resize 512x512 /tmp/icon.iconset/icon_256x256@2x.png
convert src-tauri/icons/icon.png -resize 512x512 /tmp/icon.iconset/icon_512x512.png
convert src-tauri/icons/icon.png -resize 1024x1024 /tmp/icon.iconset/icon_512x512@2x.png

# Convertir en .icns (Mac seulement)
if [[ "$OSTYPE" == "darwin"* ]]; then
    iconutil -c icns /tmp/icon.iconset -o src-tauri/icons/icon.icns
    echo "✓ icon.icns créé (macOS)"
    rm -rf /tmp/icon.iconset
else
    echo "⚠️  Pour créer icon.icns, lance ce script sur Mac"
    # Alternative : utiliser png2icns si disponible
    if command -v png2icns &> /dev/null; then
        png2icns src-tauri/icons/icon.icns src-tauri/icons/icon.png
        echo "✓ icon.icns créé avec png2icns"
    fi
    rm -rf /tmp/icon.iconset
fi

echo ""
echo "✅ Icônes générées avec succès !"
echo ""
echo "Fichiers créés dans src-tauri/icons/ :"
ls -lh src-tauri/icons/
echo ""
echo "🔄 Maintenant, fais :"
echo "  git add src-tauri/icons/"
echo "  git commit -m 'Ajout des icônes'"
echo "  git push"
