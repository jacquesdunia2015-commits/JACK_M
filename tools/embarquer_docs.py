#!/usr/bin/env python3
"""Génère assets/helpdocs_data.js : les manuels PDF encodés en base64.

Ce fichier n'est utilisé QUE par la version « fichier unique » (standalone) :
tools/build_standalone.py l'injecte dans le HTML pour que les manuels restent
disponibles hors ligne.

Le site en ligne, lui, ne le charge JAMAIS : js/helpdocs.js va chercher le PDF
dans docs/ au moment du clic. C'est ce qui permet au site de démarrer avec
~130 Ko au lieu de ~740 Ko — décisif sur une connexion lente.

À relancer après toute régénération des PDF de docs/ :
    python3 tools/embarquer_docs.py && python3 tools/build_standalone.py
"""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = [
    ("guide", "QualiCode_Guide_utilisation.pdf"),
    ("manuel", "QualiCode_Manuel_debutant.pdf"),
]

parts = [
    "// Manuels PDF embarqués (généré par tools/embarquer_docs.py — NE PAS ÉDITER).",
    "// Chargé uniquement dans le fichier unique QualiCode.html, pour l'usage hors ligne.",
    "window.__QC_PDFS = {",
]
for key, fname in DOCS:
    b64 = base64.b64encode((ROOT / "docs" / fname).read_bytes()).decode()
    parts.append(f'  {key}: "{b64}",')
parts.append("};")

out = ROOT / "assets" / "helpdocs_data.js"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(parts) + "\n", encoding="utf-8")
print(f"OK : {out} ({out.stat().st_size / 1024:.0f} Ko — hors ligne uniquement)")
