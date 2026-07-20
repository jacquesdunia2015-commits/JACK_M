#!/usr/bin/env python3
"""Régénère js/helpdocs.js : les manuels PDF encodés en base64, embarqués dans
l'application pour que les boutons « Documentation » de l'onglet Accueil
fonctionnent partout — y compris dans le fichier standalone, hors ligne.

À relancer après toute régénération des PDF de docs/ :
    python3 tools/embarquer_docs.py && python3 tools/build_standalone.py
"""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = [
    ("GUIDE_PDF", "QualiCode_Guide_utilisation.pdf"),
    ("MANUEL_PDF", "QualiCode_Manuel_debutant.pdf"),
]

parts = [
    "// Documentation PDF embarquée (générée par tools/embarquer_docs.py — NE PAS ÉDITER À LA MAIN).",
    "// Guide d'utilisation et Manuel du débutant, téléchargeables depuis l'onglet Accueil,",
    "// même hors ligne et dans le fichier standalone.",
    "",
    'import { downloadBlob } from "./export.js";',
    "",
]
for name, fname in DOCS:
    b64 = base64.b64encode((ROOT / "docs" / fname).read_bytes()).decode()
    parts.append(f'const {name} = "{b64}";')
parts.append("""
function pdfBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

export function downloadGuidePdf() {
  downloadBlob("QualiCode_Guide_utilisation.pdf", pdfBlob(GUIDE_PDF));
}

export function downloadManuelPdf() {
  downloadBlob("QualiCode_Manuel_debutant.pdf", pdfBlob(MANUEL_PDF));
}
""")
out = ROOT / "js" / "helpdocs.js"
out.write_text("\n".join(parts), encoding="utf-8")
print(f"OK : {out} ({out.stat().st_size / 1024:.0f} Ko)")
