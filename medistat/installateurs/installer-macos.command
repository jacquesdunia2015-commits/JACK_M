#!/usr/bin/env bash
# MediStat — installation sur macOS
# Crée une application MediStat.app dans le dossier Applications.
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${HOME}/Library/Application Support/MediStat"
APP="${HOME}/Applications/MediStat.app"

echo "╭──────────────────────────────────────────────╮"
echo "│  MediStat — installation                     │"
echo "╰──────────────────────────────────────────────╯"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "⛔ Node.js est introuvable."
  echo "   Installez-le depuis https://nodejs.org (version 22 ou supérieure)"
  echo "   ou avec Homebrew :  brew install node"
  read -r -p "Appuyez sur Entrée pour fermer…"
  exit 1
fi

VERSION_NODE="$(node -pe 'process.versions.node.split(".")[0]')"
if [ "${VERSION_NODE}" -lt 22 ]; then
  echo "⛔ Node.js 22 ou supérieur est requis (version détectée : ${VERSION_NODE})."
  read -r -p "Appuyez sur Entrée pour fermer…"
  exit 1
fi

echo "→ Copie des fichiers"
mkdir -p "${DEST}" "${APP}/Contents/MacOS" "${APP}/Contents/Resources"
cp -r "${SOURCE}/index.html" "${SOURCE}/manifest.webmanifest" "${SOURCE}/sw.js" \
      "${SOURCE}/css" "${SOURCE}/js" "${SOURCE}/assets" "${SOURCE}/server" "${DEST}/"
[ -d "${SOURCE}/docs" ] && cp -r "${SOURCE}/docs" "${DEST}/" || true

if [ ! -f "${DEST}/.secret" ]; then
  node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))' > "${DEST}/.secret"
  chmod 600 "${DEST}/.secret"
fi

echo "→ Création de MediStat.app"
cat > "${APP}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>MediStat</string>
  <key>CFBundleDisplayName</key><string>MediStat</string>
  <key>CFBundleIdentifier</key><string>org.medistat.app</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>medistat</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

cat > "${APP}/Contents/MacOS/medistat" <<LANCEUR
#!/usr/bin/env bash
export MEDISTAT_SECRET="\$(cat "${DEST}/.secret")"
PORT="\${MEDISTAT_PORT:-8080}"
node "${DEST}/server/api.mjs" --port "\${PORT}" --db "${DEST}/data/medistat.db" &
SERVEUR=\$!
sleep 1.5
open "http://localhost:\${PORT}"
wait \${SERVEUR}
LANCEUR
chmod +x "${APP}/Contents/MacOS/medistat"
cp "${SOURCE}/assets/icone-512.png" "${APP}/Contents/Resources/icone.png" 2>/dev/null || true

echo
echo "✅ Installation terminée."
echo
echo "   Lancer   :  ouvrez MediStat depuis le dossier Applications"
echo "   Données  :  ${DEST}/data/"
echo
echo "   Astuce : dans Safari ou Chrome, « Partager › Ajouter au Dock »"
echo "            installe aussi MediStat comme application autonome."
echo
read -r -p "Appuyez sur Entrée pour fermer…"
