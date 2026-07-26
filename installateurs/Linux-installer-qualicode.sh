#!/usr/bin/env bash
# ============================================================
#  QualiCode — installation sur un ordinateur Linux
#  Copie l'application dans ~/.local/share/QualiCode et ajoute
#  une icône au menu des applications (et sur le bureau).
#  Aucune connexion internet nécessaire, aucun droit root.
#  Désinstallation : ./Linux-installer-qualicode.sh --desinstaller
# ============================================================
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.local/share/QualiCode"
APPS="$HOME/.local/share/applications"
RACCOURCI="$APPS/qualicode.desktop"

if [[ "${1:-}" == "--desinstaller" ]]; then
  rm -f "$RACCOURCI" "$HOME/Bureau/qualicode.desktop" "$HOME/Desktop/qualicode.desktop"
  rm -rf "$DEST"
  command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" 2>/dev/null || true
  echo "QualiCode a été retiré de cet ordinateur."
  exit 0
fi

echo
echo "  ================================================"
echo "    QualiCode — installation sur cet ordinateur"
echo "  ================================================"
echo

# 1. Retrouver l'application
APP=""
for CANDIDAT in "$ICI/QualiCode.html" "$ICI/../dist/QualiCode.html" "$ICI/../QualiCode.html"; do
  [[ -f "$CANDIDAT" ]] && { APP="$(readlink -f "$CANDIDAT")"; break; }
done
if [[ -z "$APP" ]]; then
  echo "  [X] Fichier QualiCode.html introuvable."
  echo "      Placez ce script à côté du fichier QualiCode.html, puis relancez-le."
  exit 1
fi
echo "  Application trouvée : $APP"

# 2. Copier l'application et l'icône
mkdir -p "$DEST" "$APPS"
cp -f "$APP" "$DEST/QualiCode.html"
for ICONE in "$ICI/../assets/logo/qualicode-icon-512.png" "$ICI/qualicode-icon-512.png"; do
  [[ -f "$ICONE" ]] && cp -f "$ICONE" "$DEST/qualicode.png" && break
done
echo "  Copie dans : $DEST"

# 3. Créer le lanceur — en « mode application » si Chrome/Chromium est présent
#    (fenêtre propre sans barre d'adresse, comme un logiciel installé)
NAVIGATEUR=""
for CANDIDAT in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
  command -v "$CANDIDAT" >/dev/null && { NAVIGATEUR="$CANDIDAT"; break; }
done
if [[ -n "$NAVIGATEUR" ]]; then
  EXEC="$NAVIGATEUR --app=file://$DEST/QualiCode.html"
  echo "  Navigateur détecté : $NAVIGATEUR (fenêtre d'application)"
else
  EXEC="xdg-open \"$DEST/QualiCode.html\""
  echo "  Chrome/Chromium non détecté : ouverture dans le navigateur par défaut."
fi

cat > "$RACCOURCI" <<EOF
[Desktop Entry]
Type=Application
Name=QualiCode
GenericName=Analyse qualitative de données
Comment=Analyser des entretiens et des textes de recherche (hors ligne)
Exec=$EXEC
Icon=$DEST/qualicode.png
Terminal=false
Categories=Office;Education;Science;
Keywords=QDA;analyse;qualitative;entretiens;codage;
EOF
chmod +x "$RACCOURCI"
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" 2>/dev/null || true

# 4. Copier aussi sur le bureau si le dossier existe
for BUREAU in "$HOME/Bureau" "$HOME/Desktop"; do
  if [[ -d "$BUREAU" ]]; then
    cp -f "$RACCOURCI" "$BUREAU/qualicode.desktop"
    chmod +x "$BUREAU/qualicode.desktop"
    command -v gio >/dev/null && gio set "$BUREAU/qualicode.desktop" metadata::trusted true 2>/dev/null || true
  fi
done

echo "  Icône QualiCode ajoutée au menu des applications."
echo
echo "  Terminé : cherchez « QualiCode » dans vos applications."
echo "  (Désinstaller : $0 --desinstaller)"
echo
