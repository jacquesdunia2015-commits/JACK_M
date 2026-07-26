#!/bin/bash
# ============================================================
#  QualiCode — installation sur un Mac
#  Copie l'application dans ~/Applications/QualiCode et place
#  une icône sur le Bureau. Aucune connexion internet requise.
#  (Double-cliquez ce fichier. Si macOS refuse : clic droit →
#   Ouvrir → Ouvrir.)
# ============================================================
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/Applications/QualiCode"

echo
echo "  ================================================"
echo "    QualiCode — installation sur ce Mac"
echo "  ================================================"
echo

APP=""
for CANDIDAT in "$ICI/QualiCode.html" "$ICI/../dist/QualiCode.html" "$ICI/../QualiCode.html"; do
  [[ -f "$CANDIDAT" ]] && { APP="$CANDIDAT"; break; }
done
if [[ -z "$APP" ]]; then
  echo "  [X] Fichier QualiCode.html introuvable."
  echo "      Placez ce script à côté du fichier QualiCode.html, puis relancez-le."
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
  exit 1
fi
echo "  Application trouvée : $APP"

mkdir -p "$DEST"
cp -f "$APP" "$DEST/QualiCode.html"
echo "  Copie dans : $DEST"

# Raccourci internet sur le Bureau : s'ouvre dans le navigateur par défaut
BUREAU="$HOME/Desktop"
cat > "$BUREAU/QualiCode.webloc" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>file://$DEST/QualiCode.html</string>
</dict>
</plist>
EOF

echo "  Icône QualiCode placée sur le Bureau."
echo
echo "  Terminé : double-cliquez « QualiCode » sur le Bureau."
echo "  Astuce : dans Chrome ou Edge, menu ⋮ → Enregistrer et partager →"
echo "  « Installer QualiCode » ajoute l'application au Launchpad."
echo
read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
