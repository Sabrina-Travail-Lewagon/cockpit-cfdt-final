#!/usr/bin/env python3
"""
Script pour générer les icônes Cockpit CFDT
Nécessite : pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Couleur orange CFDT
ORANGE_CFDT = "#E7591C"

def create_icon(size, output_path):
    """Crée une icône simple avec fond orange et lettre C blanche"""
    # Créer une image avec fond orange
    img = Image.new('RGB', (size, size), ORANGE_CFDT)
    draw = ImageDraw.Draw(img)
    
    # Ajouter la lettre C au centre
    # Taille de la police proportionnelle à la taille de l'image
    font_size = int(size * 0.6)
    try:
        # Essayer d'utiliser une police système
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            # Fallback sur la police par défaut
            font = ImageFont.load_default()
    
    # Calculer la position du texte pour le centrer
    text = "C"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - font_size // 10)
    
    # Dessiner le texte blanc
    draw.text(position, text, fill="white", font=font)
    
    # Sauvegarder
    img.save(output_path)
    print(f"✓ {output_path} créé ({size}x{size})")

def create_ico(png_path, ico_path):
    """Crée un fichier .ico à partir d'un PNG"""
    img = Image.open(png_path)
    img.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    print(f"✓ {ico_path} créé (multi-résolution)")

def create_icns(png_path, icns_path):
    """Crée un fichier .icns à partir d'un PNG (macOS)"""
    import subprocess
    import tempfile
    import shutil
    
    # Créer un iconset temporaire
    iconset_path = tempfile.mkdtemp(suffix='.iconset')
    
    img = Image.open(png_path)
    
    # Générer toutes les tailles nécessaires
    sizes = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]
    
    for size, filename in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_path, filename))
    
    # Convertir en .icns (nécessite iconutil sur macOS)
    try:
        subprocess.run(['iconutil', '-c', 'icns', iconset_path, '-o', icns_path], check=True)
        print(f"✓ {icns_path} créé (macOS)")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"⚠️  iconutil non disponible, impossible de créer {icns_path}")
        print("    Sur macOS, lance ce script pour générer l'icns")
    
    # Nettoyer
    shutil.rmtree(iconset_path)

def main():
    print("🎨 Génération des icônes Cockpit CFDT...\n")
    
    # Créer le dossier icons
    icons_dir = "src-tauri/icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    # Créer l'icône principale 1024x1024
    icon_path = os.path.join(icons_dir, "icon.png")
    create_icon(1024, icon_path)
    
    # Créer les différentes tailles
    create_icon(32, os.path.join(icons_dir, "32x32.png"))
    create_icon(128, os.path.join(icons_dir, "128x128.png"))
    create_icon(256, os.path.join(icons_dir, "128x128@2x.png"))
    
    # Créer le .ico pour Windows
    ico_path = os.path.join(icons_dir, "icon.ico")
    create_ico(icon_path, ico_path)
    
    # Créer le .icns pour macOS
    icns_path = os.path.join(icons_dir, "icon.icns")
    create_icns(icon_path, icns_path)
    
    print("\n✅ Icônes générées avec succès !")
    print(f"\nFichiers créés dans {icons_dir}/")
    print("\n🔄 Maintenant, fais :")
    print("  git add src-tauri/icons/")
    print("  git commit -m 'Ajout des icônes'")
    print("  git push")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("❌ Pillow n'est pas installé")
        print("\nInstalle-le avec :")
        print("  pip install Pillow")
        print("\nOu utilise l'outil en ligne : https://icon.kitchen/")
