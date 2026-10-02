#!/bin/bash
# Lance NOVA PHARMA OS :  ./demarrer-linux.sh
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "ERREUR : Node.js n'est pas installé."
  echo "Installez-le :  sudo apt install nodejs npm    (Ubuntu, Debian)"
  echo "Ou depuis      https://nodejs.org"
  exit 1
fi

exec node demarrer.mjs
