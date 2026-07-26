#!/usr/bin/env python3
"""Construit dist/QualiCode.html : l'application complète en UN seul fichier.

Le fichier produit s'ouvre par double-clic (file://), sans serveur ni internet.
Les modules ES sont convertis en scripts classiques encapsulés (IIFE) et
exposés via un registre __QC, ce qui évite les restrictions CORS de file://
sur les modules, tout en gardant les sources du dépôt inchangées.

Usage : python3 tools/build_standalone.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Ordre de concaténation = ordre des dépendances (aucun cycle)
MODULES = ["langs", "i18n", "state", "analysis", "docx", "docxout", "crypto", "applock", "payments", "license", "merge", "sample", "export", "helpdocs", "pdf", "refi", "conceptmap", "audio", "social", "ai", "sync", "imagecode", "ocr", "biblio", "stats", "realtime", "mobile", "app"]


def transform_module(name: str, src: str) -> str:
    exported = re.findall(r"^export (?:async )?function (\w+)", src, re.M)
    exported += re.findall(r"^export const (\w+)", src, re.M)

    # import { a, b } from "./mod.js";  →  const { a, b } = __QC["mod"];
    src = re.sub(
        r'import\s*\{([^}]*)\}\s*from\s*"\./(\w+)\.js";',
        lambda m: f'const {{{m.group(1)}}} = __QC["{m.group(2)}"];',
        src,
        flags=re.S,
    )
    src = re.sub(r"^export (?=(?:async )?function |const )", "", src, flags=re.M)

    returns = ", ".join(exported)
    return f'__QC["{name}"] = (function () {{\n"use strict";\n{src}\nreturn {{ {returns} }};\n}})();\n'


def main() -> None:
    bundle = ["var __QC = {};"]
    for name in MODULES:
        src = (ROOT / "js" / f"{name}.js").read_text(encoding="utf-8")
        leftover = re.search(r"^\s*(import|export)\b", transform_module(name, src), re.M)
        code = transform_module(name, src)
        if leftover:
            raise SystemExit(f"Transformation incomplète dans {name}.js : {leftover.group(0)!r}")
        bundle.append(code)
    js = "\n".join(bundle)

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/style.css">', f"<style>\n{css}\n</style>")
    # Fichier unique : pas de manifeste ni d'icône externes (aucune requête réseau)
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', "", html)
    # Manuels PDF embarqués : indispensables hors ligne, jamais servis au site
    pdfs = ROOT / "assets" / "helpdocs_data.js"
    pdf_script = f"<script>\n{pdfs.read_text(encoding='utf-8')}\n</script>\n" if pdfs.exists() else ""
    if not pdf_script:
        print("⚠️  assets/helpdocs_data.js absent : lancez tools/embarquer_docs.py "
              "(les manuels PDF ne seront pas disponibles hors ligne).")
    html = html.replace(
        '<script type="module" src="js/app.js"></script>',
        f"{pdf_script}<script>\n{js}\n</script>",
    )
    assert "<style>" in html and "var __QC" in html, "Substitutions manquées"

    out = ROOT / "dist" / "QualiCode.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"OK : {out} ({out.stat().st_size / 1024:.0f} Ko)")


if __name__ == "__main__":
    main()
