#!/bin/bash
# Double-cliquez sur ce fichier pour démarrer NOVA PHARMA OS.
cd "$(dirname "$0")"

echo
echo "  Démarrage de NOVA PHARMA OS..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  ERREUR : Node.js n'est pas installé sur cet ordinateur."
  echo
  echo "  1. Ouvrez le site  https://nodejs.org"
  echo "  2. Téléchargez la version « LTS »"
  echo "  3. Installez-la"
  echo "  4. Relancez ce fichier"
  echo
  read -r -p "  Appuyez sur Entrée pour fermer."
  exit 1
fi

node demarrer.mjs

echo
echo "  L'application est arrêtée."
read -r -p "  Appuyez sur Entrée pour fermer."
