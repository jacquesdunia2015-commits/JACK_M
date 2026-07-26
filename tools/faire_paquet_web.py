#!/usr/bin/env python3
"""Fabrique dist/QualiCode_site.zip : le site prêt à publier n'importe où.

À quoi ça sert ? L'installation d'une application (icône sur l'écran d'accueil
d'un téléphone) n'est possible que depuis une adresse https. Si GitHub Pages est
injoignable depuis votre réseau (erreur ERR_CONNECTION_TIMED_OUT), publiez ce
paquet sur un autre hébergeur — voir INSTALLATION.md : c'est gratuit et cela
prend deux minutes (glisser-déposer du zip).

Le paquet ne contient QUE ce qui est nécessaire au site : ni fichiers de
développement, ni installateurs, ni données de recherche.

Usage : python3 tools/faire_paquet_web.py
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "QualiCode_site.zip"

FICHIERS = ["index.html", "manifest.webmanifest", "sw.js", "css/style.css"]
DOSSIERS = ["js", "assets/logo", "assets/screenshots", "docs"]
EXCLUS = {"assets/helpdocs_data.js"}  # embarqué dans le fichier unique seulement


def main() -> None:
    OUT.parent.mkdir(exist_ok=True)
    total = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        # Empêche GitHub Pages (Jekyll) d'ignorer certains fichiers
        z.writestr(".nojekyll", "")
        for rel in FICHIERS:
            z.write(ROOT / rel, rel)
            total += (ROOT / rel).stat().st_size
        for dossier in DOSSIERS:
            for f in sorted((ROOT / dossier).rglob("*")):
                if not f.is_file():
                    continue
                rel = f.relative_to(ROOT).as_posix()
                if rel in EXCLUS:
                    continue
                z.write(f, rel)
                total += f.stat().st_size
    print(f"OK : {OUT} ({OUT.stat().st_size / 1024:.0f} Ko compressés, "
          f"{total / 1024:.0f} Ko de fichiers)")
    print("Publiez-le sur un hébergeur statique (voir INSTALLATION.md), "
          "puis ouvrez l'adresse obtenue sur le téléphone pour installer l'application.")


if __name__ == "__main__":
    main()
