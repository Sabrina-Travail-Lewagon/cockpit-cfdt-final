#!/bin/bash
# Script pour nettoyer complètement et recompiler Cockpit CFDT

echo "🧹 Nettoyage COMPLET du cache de compilation Rust..."
cd src-tauri

# Supprimer le dossier target complet
echo "  → Suppression du dossier target/"
rm -rf target

# Nettoyer avec cargo
echo "  → cargo clean"
cargo clean

cd ..

echo ""
echo "🧹 Nettoyage du cache npm..."
rm -rf node_modules
rm -f package-lock.json

echo ""
echo "📦 Installation des dépendances npm..."
npm install --legacy-peer-deps

echo ""
echo "🚀 Compilation de l'application..."
echo "  (Cela peut prendre 10-15 minutes la première fois)"
npm run tauri build

echo ""
echo "✅ Terminé !"
echo ""
echo "L'application se trouve dans :"
echo "src-tauri/target/release/bundle/macos/Cockpit CFDT.app"
echo ""
echo "Pour la lancer :"
echo 'open "src-tauri/target/release/bundle/macos/Cockpit CFDT.app"'
