#!/bin/bash
# Script de nettoyage ULTIME pour Cockpit CFDT
# À utiliser si les erreurs "defined multiple times" persistent

set -e  # Arrêter si erreur

echo "🧹🔥 NETTOYAGE EXTRÊME EN COURS..."
echo ""

# Couleurs pour le terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Nettoyer le cache Cargo GLOBAL
echo -e "${YELLOW}1. Nettoyage du cache Cargo global...${NC}"
rm -rf ~/.cargo/registry/index/* 2>/dev/null || true
rm -rf ~/.cargo/registry/cache/* 2>/dev/null || true
rm -rf ~/.cargo/git/db/* 2>/dev/null || true
rm -rf ~/.cargo/git/checkouts/* 2>/dev/null || true
echo -e "${GREEN}   ✓ Cache Cargo global nettoyé${NC}"

# 2. Nettoyer le dossier target COMPLET
echo -e "${YELLOW}2. Suppression du dossier target/...${NC}"
cd src-tauri
rm -rf target
echo -e "${GREEN}   ✓ Dossier target/ supprimé${NC}"

# 3. Supprimer Cargo.lock
echo -e "${YELLOW}3. Suppression de Cargo.lock...${NC}"
rm -f Cargo.lock
echo -e "${GREEN}   ✓ Cargo.lock supprimé${NC}"

# 4. Cargo clean (au cas où)
echo -e "${YELLOW}4. cargo clean...${NC}"
cargo clean 2>/dev/null || true
echo -e "${GREEN}   ✓ cargo clean effectué${NC}"

cd ..

# 5. Nettoyer node_modules
echo -e "${YELLOW}5. Suppression de node_modules/...${NC}"
rm -rf node_modules
rm -f package-lock.json
echo -e "${GREEN}   ✓ node_modules/ supprimé${NC}"

echo ""
echo -e "${GREEN}✅ NETTOYAGE TERMINÉ !${NC}"
echo ""
echo -e "${YELLOW}Maintenant, lance :${NC}"
echo -e "  1. ${GREEN}npm install --legacy-peer-deps${NC}"
echo -e "  2. ${GREEN}npm run tauri build${NC}"
echo ""
echo -e "${RED}Si ça ne marche TOUJOURS pas :${NC}"
echo -e "  ${YELLOW}Redémarre ton Mac et réessaye !${NC}"
echo ""
