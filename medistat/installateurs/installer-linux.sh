#!/usr/bin/env bash
# MediStat — installation sur Linux
# Installe l'application dans ~/.local/share/medistat, crée un lanceur dans le
# menu des applications, et démarre le serveur local.
set -euo pipefail

DEST="${HOME}/.local/share/medistat"
BUREAU="${HOME}/.local/share/applications"
BIN="${HOME}/.local/bin"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "╭──────────────────────────────────────────────╮"
echo "│  MediStat — installation                     │"
echo "╰──────────────────────────────────────────────╯"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "⛔ Node.js est introuvable."
  echo "   Installez-le puis relancez :"
  echo "     Debian/Ubuntu :  sudo apt install nodejs"
  echo "     Fedora        :  sudo dnf install nodejs"
  echo "     Arch          :  sudo pacman -S nodejs"
  exit 1
fi

VERSION_NODE="$(node -pe 'process.versions.node.split(".")[0]')"
if [ "${VERSION_NODE}" -lt 22 ]; then
  echo "⛔ Node.js 22 ou supérieur est requis (version détectée : ${VERSION_NODE})."
  echo "   Le module node:sqlite, utilisé par le serveur, n'existe qu'à partir de Node 22."
  exit 1
fi

echo "→ Copie des fichiers vers ${DEST}"
mkdir -p "${DEST}" "${BUREAU}" "${BIN}"
cp -r "${SOURCE}/index.html" "${SOURCE}/manifest.webmanifest" "${SOURCE}/sw.js" \
      "${SOURCE}/css" "${SOURCE}/js" "${SOURCE}/assets" "${SOURCE}/server" "${DEST}/"
[ -d "${SOURCE}/docs" ] && cp -r "${SOURCE}/docs" "${DEST}/" || true

# Secret de signature propre à cette installation, engendré une seule fois
if [ ! -f "${DEST}/.secret" ]; then
  node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))' > "${DEST}/.secret"
  chmod 600 "${DEST}/.secret"
  echo "→ Secret de signature engendré"
fi

echo "→ Création du lanceur"
cat > "${BIN}/medistat" <<LANCEUR
#!/usr/bin/env bash
export MEDISTAT_SECRET="\$(cat "${DEST}/.secret")"
PORT="\${MEDISTAT_PORT:-8080}"
node "${DEST}/server/api.mjs" --port "\${PORT}" --db "${DEST}/data/medistat.db" &
SERVEUR=\$!
sleep 1.5
for NAVIGATEUR in xdg-open gio open sensible-browser firefox chromium google-chrome; do
  if command -v "\${NAVIGATEUR}" >/dev/null 2>&1; then
    "\${NAVIGATEUR}" "http://localhost:\${PORT}" >/dev/null 2>&1 &
    break
  fi
done
echo "MediStat est lancé sur http://localhost:\${PORT}"
echo "Fermez cette fenêtre ou appuyez sur Ctrl+C pour arrêter."
wait \${SERVEUR}
LANCEUR
chmod +x "${BIN}/medistat"

cat > "${BUREAU}/medistat.desktop" <<RACCOURCI
[Desktop Entry]
Type=Application
Name=MediStat
GenericName=Dossiers médicaux et analyse de données
Comment=Gestion des dossiers médicaux, du laboratoire et analyse statistique
Exec=${BIN}/medistat
Icon=${DEST}/assets/icone-512.png
Terminal=true
Categories=Office;Science;MedicalSoftware;
Keywords=médical;laboratoire;statistiques;analyse;
StartupNotify=true
RACCOURCI

command -v update-desktop-database >/dev/null 2>&1 && \
  update-desktop-database "${BUREAU}" 2>/dev/null || true

echo
echo "✅ Installation terminée."
echo
echo "   Lancer     :  medistat"
echo "                 (ou depuis le menu des applications)"
echo "   Données    :  ${DEST}/data/"
echo
if ! echo "${PATH}" | grep -q "${BIN}"; then
  echo "   ⚠ Ajoutez ${BIN} à votre PATH :"
  echo "       echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
  echo
fi
echo "   Pour désinstaller :  rm -rf ${DEST} ${BIN}/medistat ${BUREAU}/medistat.desktop"
echo
