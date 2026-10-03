#!/usr/bin/env python3
"""Construit dist/QualiCode.html : l'application complète en UN seul fichier.

Le fichier produit s'ouvre par double-clic (file://), sans serveur ni internet.
Les modules ES sont convertis en scripts classiques encapsulés (IIFE) et
exposés via un registre __QC, ce qui évite les restrictions CORS de file://
sur les modules, tout en gardant les sources du dépôt inchangées.

Usage : python3 tools/build_standalone.py
"""
import base64
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Ordre de concaténation = ordre des dépendances (aucun cycle)
MODULES = ["langs", "i18n", "state", "analysis", "docx", "docxout", "crypto", "applock", "payments", "license", "merge", "sample", "branding", "export", "helpdocs", "pdf", "refi", "conceptmap", "audio", "social", "ai", "sync", "imagecode", "ocr", "biblio", "stats", "realtime", "mobile", "app"]


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

        # QC_PROJET=chemin.projx : embarque un projet dans le fichier.
        #
        # Motif : sur téléphone, ou avec une connexion difficile, « télécharger
        # un .projx puis le retrouver dans l'explorateur de fichiers » est
        # l'étape où l'on décroche. Un fichier unique qui contient déjà le
        # projet supprime l'étape : on ouvre, le projet est là.
        #
        # L'injection se place APRÈS le module « sample » et avant « app », qui
        # lit la fonction à son propre chargement. Au premier lancement (aucun
        # projet enregistré) et sur le bouton « Projet exemple », c'est ce
        # projet qui est chargé au lieu de l'exemple générique.
        if name == "sample" and os.environ.get("QC_PROJET"):
            chemin = Path(os.environ["QC_PROJET"])
            if not chemin.is_absolute():
                chemin = ROOT / chemin
            projet = json.loads(chemin.read_text(encoding="utf-8"))
            if projet.get("format") != "qualicode-projx":
                raise SystemExit(f"{chemin} n'est pas un projet QualiCode (.projx)")
            bundle.append(
                '__QC["sample"].buildSampleProject = function () {\n'
                '  return __QC["state"].normalizeProject('
                + json.dumps(projet, ensure_ascii=False)
                + ");\n};\n"
            )
            # Démarrage : si le navigateur contient déjà un projet de même
            # identifiant mais d'une autre version (champ versionSimulation),
            # l'ancien est conservé sous un nouvel identifiant (rien n'est
            # perdu), puis le projet embarqué est installé et ouvert. Si la
            # bonne version est déjà là, on ne touche à rien : le travail fait
            # depuis dans l'application est préservé.
            if projet.get("id"):
                bundle.append(
                    "(function () {\n"
                    '  const S = __QC["state"];\n'
                    "  const chargerOrigine = S.loadPersisted;\n"
                    f"  const ID = {json.dumps(projet['id'])};\n"
                    f"  const VERSION = {json.dumps(projet.get('versionSimulation'))};\n"
                    "  S.loadPersisted = async function () {\n"
                    "    try {\n"
                    "      const present = await S.loadProjectById(ID);\n"
                    "      if (!present || (VERSION && present.versionSimulation !== VERSION)) {\n"
                    "        if (present) {\n"
                    "          S.remplacerProjet(Object.assign({}, present, {\n"
                    "            id: S.uid(), name: present.name + \" (ancienne version, conservée)\" }));\n"
                    "          if (!(await S.persistNow())) throw new Error(\"sauvegarde de l'ancienne version impossible\");\n"
                    "        }\n"
                    '        S.remplacerProjet(__QC["sample"].buildSampleProject());\n'
                    "        await S.persistNow();\n"
                    "        return true;\n"
                    "      }\n"
                    "    } catch (e) { console.error(e); }\n"
                    "    return chargerOrigine();\n"
                    "  };\n"
                    "})();\n"
                )
            print(f"Projet embarqué : {chemin.name} — "
                  f"{len(projet.get('documents', []))} documents, "
                  f"{len(projet.get('codes', []))} codes, "
                  f"{len(projet.get('segments', []))} segments")

    js = "\n".join(bundle)

    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # Empreinte du fichier unique. Un QualiCode.html circule par clé USB et par
    # WhatsApp : des copies de plusieurs mois d'écart coexistent sur le terrain,
    # et rien ne permettait de les distinguer à l'ouverture. L'empreinte
    # s'affiche dans la barre d'état et dans le rapport de diagnostic.
    empreinte = "fichier unique · " + datetime.now().strftime("%d/%m/%Y")
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.strip()
        if sha:
            empreinte = f"{sha} · fichier unique · " + datetime.now().strftime("%d/%m/%Y")
    except Exception:
        pass  # dépôt absent : la date suffit
    html, n = re.subn(r'(<meta name="qc-version" content=")[^"]*(">)',
                      lambda m: m.group(1) + empreinte + m.group(2), html, count=1)
    if n != 1:
        raise SystemExit("balise qc-version introuvable dans index.html")

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
    # Logo de l'organisation embarqué : dans le fichier unique, aucune requête
    # réseau n'est possible, le logo doit donc voyager en base64 dans la page.
    org_script = ""
    logo_org = ROOT / "assets" / "logo" / "organisation.png"
    if logo_org.exists():
        b64 = base64.b64encode(logo_org.read_bytes()).decode("ascii")
        nom = os.environ.get("QC_ORG_NOM", "APSA")
        org_script = (
            f'<script>window.__QC_ORG_LOGO="data:image/png;base64,{b64}";'
            f'window.__QC_ORG_NOM={json.dumps(nom)};</script>\n'
        )
        print(f"Logo organisation embarqué ({logo_org.stat().st_size / 1024:.0f} Ko, nom : {nom})")

    html = html.replace(
        '<script type="module" src="js/app.js"></script>',
        f"{org_script}{pdf_script}<script>\n{js}\n</script>",
    )
    assert "<style>" in html and "var __QC" in html, "Substitutions manquées"

    out = ROOT / "dist" / "QualiCode.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"OK : {out} ({out.stat().st_size / 1024:.0f} Ko)")


if __name__ == "__main__":
    main()
