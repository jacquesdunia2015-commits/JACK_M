#!/usr/bin/env python3
"""Cahier de recette automatisé du site éditorial (§ 10 du cahier des charges).

Contrôle le site généré, page par page, sur les points vérifiables sans
navigateur : structure HTML et hiérarchie des titres, alternatives textuelles,
liens internes, données structurées, absence de dépôt tiers avant consentement,
conformité des liens d'affiliation, longueurs des balises SEO.

    python3 tools/verifier_site_conseil.py
    python3 tools/verifier_site_conseil.py --reseau   # teste aussi les liens marchands

Code de sortie 1 si au moins une anomalie bloquante est détectée.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, urljoin

RACINE = Path(__file__).resolve().parent.parent

# Domaines dont le chargement est autorisé sans consentement : aucun.
# Le site doit être entièrement auto-porté (§ 6.7).
HOTES_AUTORISES: set[str] = set()


class Analyse(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titres: list[tuple[int, str]] = []
        self.images: list[dict] = []
        self.liens: list[dict] = []
        self.scripts: list[str] = []
        self.iframes: list[str] = []
        self.champs: list[dict] = []
        self.labels: list[str] = []
        self.metas: dict[str, str] = {}
        self.canonique: str | None = None
        self.lang: str | None = None
        self.jsonld: list[str] = []
        self.viewport: str = ""
        self._dans_jsonld = False
        self._niveau_titre: int | None = None
        self._texte_titre: list[str] = []
        self._dans_title = False
        self.title = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title" and not self.title:
            # Seul le <title> du document compte : ceux des <svg> sont ignorés.
            self._dans_title = True
        elif tag == "meta":
            if a.get("name"):
                self.metas[a["name"]] = a.get("content", "")
                if a["name"] == "viewport":
                    self.viewport = a.get("content", "")
            if a.get("property"):
                self.metas[a["property"]] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonique = a.get("href")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._niveau_titre = int(tag[1])
            self._texte_titre = []
        elif tag == "img":
            self.images.append(a)
        elif tag == "a":
            self.liens.append(a)
        elif tag == "script":
            self.scripts.append(a.get("src", ""))
            if a.get("type") == "application/ld+json":
                self._dans_jsonld = True
                self.jsonld.append("")
        elif tag == "iframe":
            self.iframes.append(a.get("src", ""))
        elif tag in ("input", "textarea", "select"):
            self.champs.append({"tag": tag, **a})
        elif tag == "label":
            self.labels.append(a.get("for", ""))

    def handle_endtag(self, tag):
        if tag == "title":
            self._dans_title = False
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._niveau_titre:
            self.titres.append((self._niveau_titre, "".join(self._texte_titre).strip()))
            self._niveau_titre = None
        if tag == "script":
            self._dans_jsonld = False

    def handle_data(self, data):
        if self._dans_title:
            self.title += data
        if self._niveau_titre:
            self._texte_titre.append(data)
        if self._dans_jsonld and self.jsonld:
            self.jsonld[-1] += data


def verifier(sortie: Path, cfg: dict, reseau: bool) -> tuple[list, list]:
    anomalies: list[str] = []
    remarques: list[str] = []
    pages = sorted(sortie.rglob("*.html"))

    for fichier in pages:
        rel = fichier.relative_to(sortie)
        contenu = fichier.read_text(encoding="utf-8")
        p = Analyse()
        p.feed(contenu)
        redirection = 'http-equiv="refresh"' in contenu

        # -- 1. Structure et métadonnées -----------------------------------
        if not p.lang:
            anomalies.append(f"{rel} : attribut lang absent sur <html>.")
        if not p.title.strip():
            anomalies.append(f"{rel} : balise <title> vide.")
        elif len(p.title) > cfg["meta_titre_max"] and not redirection:
            remarques.append(f"{rel} : title de {len(p.title)} caractères (cible ≤ {cfg['meta_titre_max']}).")
        if not redirection:
            if not p.metas.get("description"):
                anomalies.append(f"{rel} : meta description absente.")
            elif len(p.metas["description"]) > cfg["meta_description_max"]:
                remarques.append(f"{rel} : meta description de {len(p.metas['description'])} caractères.")
            if not p.canonique:
                anomalies.append(f"{rel} : balise canonical absente.")
            if not p.metas.get("og:title") or not p.metas.get("twitter:card"):
                anomalies.append(f"{rel} : balisage Open Graph / Twitter Cards incomplet.")

        # -- 2. Accessibilité ----------------------------------------------
        if "maximum-scale" in p.viewport or "user-scalable=no" in p.viewport:
            anomalies.append(f"{rel} : le zoom utilisateur est bloqué (proscrit, § 6.6).")
        h1 = [t for n, t in p.titres if n == 1]
        if not redirection:
            if len(h1) != 1:
                anomalies.append(f"{rel} : {len(h1)} balise(s) H1 (une seule attendue).")
            precedent = 0
            for niveau, texte in p.titres:
                if precedent and niveau > precedent + 1:
                    remarques.append(f"{rel} : saut de niveau de titre H{precedent} → H{niveau} "
                                     f"(« {texte[:40]} »).")
                precedent = niveau
            if "evitement" not in contenu:
                anomalies.append(f"{rel} : lien d'évitement absent.")
        for img in p.images:
            if "alt" not in img:
                anomalies.append(f"{rel} : image sans attribut alt ({img.get('src', '?')}).")
            if not img.get("width") or not img.get("height"):
                remarques.append(f"{rel} : image sans dimensions déclarées ({img.get('src', '?')}) "
                                 "— risque de décalage de mise en page.")
        for champ in p.champs:
            if champ["tag"] == "input" and champ.get("type") in ("hidden", "submit", "checkbox", "button"):
                continue
            identifiant = champ.get("id")
            if not identifiant:
                anomalies.append(f"{rel} : champ de formulaire sans id, donc sans étiquette associable.")
            elif identifiant not in p.labels:
                anomalies.append(f"{rel} : champ « {identifiant} » sans <label for>.")

        # -- 3. Liens internes ---------------------------------------------
        for lien in p.liens:
            href = lien.get("href", "")
            if not href or href.startswith(("http://", "https://", "mailto:", "#", "tel:")):
                continue
            cible = (fichier.parent / href).resolve()
            if cible.is_dir():
                cible = cible / "index.html"
            elif cible.suffix == "":
                cible = cible / "index.html"
            if not cible.exists():
                anomalies.append(f"{rel} : lien interne mort → {href}")

        # -- 4. RGPD : aucun appel tiers avant consentement -----------------
        for src in p.scripts + p.iframes + [i.get("src", "") for i in p.images]:
            if src.startswith(("http://", "https://", "//")):
                hote = urlparse(src if "//" in src[:8] else "https:" + src).netloc
                if hote not in HOTES_AUTORISES:
                    anomalies.append(f"{rel} : ressource tierce chargée sans consentement ({hote}).")

        # -- 5. Liens d'affiliation (§ 4.6) ---------------------------------
        for lien in p.liens:
            if lien.get("data-affilie") is not None:
                rel_attr = set((lien.get("rel") or "").split())
                if not {"sponsored", "nofollow"} <= rel_attr:
                    anomalies.append(f"{rel} : lien affilié sans rel=\"sponsored nofollow\".")
                if "noopener" not in rel_attr:
                    anomalies.append(f"{rel} : lien affilié sans rel=\"noopener\".")
                if lien.get("href", "").startswith("http"):
                    anomalies.append(f"{rel} : lien marchand exposé en direct, sans passer par "
                                     f"/{cfg['affiliation']['prefixe_redirection']}/.")
            if (lien.get("target") == "_blank"
                    and "noopener" not in (lien.get("rel") or "")):
                anomalies.append(f"{rel} : lien target=_blank sans rel=noopener ({lien.get('href')}).")

        # -- 6. Données structurées ----------------------------------------
        for bloc in p.jsonld:
            try:
                json.loads(bloc)
            except ValueError as err:
                anomalies.append(f"{rel} : JSON-LD invalide ({err}).")

        # -- 7. noindex là où il est attendu (§ 4.4 et § 4.6) ---------------
        chemin = str(rel).replace("\\", "/")
        doit_etre_noindex = chemin.startswith(("recherche/", cfg["affiliation"]["prefixe_redirection"] + "/")) \
            or chemin == "404.html" or "/page/" in chemin
        robots = p.metas.get("robots", "")
        if doit_etre_noindex and "noindex" not in robots:
            anomalies.append(f"{rel} : la page devrait porter noindex.")
        if not doit_etre_noindex and "noindex" in robots and not redirection:
            remarques.append(f"{rel} : page en noindex — vérifier que c'est voulu.")

    # -- 8. Fichiers techniques attendus -----------------------------------
    for attendu in ("sitemap.xml", "sitemap-articles.xml", "robots.txt", "flux.xml",
                    "404.html", "recherche/index.json", "redirections.conf"):
        if not (sortie / attendu).exists():
            anomalies.append(f"Fichier attendu absent : {attendu}")

    # -- 9. Liens marchands (§ 4.6, rapport de liens morts) ----------------
    produits = json.loads((RACINE / "site" / "contenu" / "produits.json").read_text(encoding="utf-8"))["produits"]
    for produit in produits:
        url = produit.get("url_affiliee", "")
        if not url.startswith("https://"):
            anomalies.append(f"Produit « {produit['slug']} » : lien marchand absent ou non sécurisé.")
        elif "[" in url:
            remarques.append(f"Produit « {produit['slug']} » : identifiant d'affiliation non renseigné dans l'URL.")
    if reseau:
        import urllib.request
        for produit in produits:
            url = produit.get("url_affiliee", "")
            if "[" in url:
                continue
            try:
                requete = urllib.request.Request(url, method="HEAD",
                                                 headers={"User-Agent": "verificateur-liens/1.0"})
                with urllib.request.urlopen(requete, timeout=10) as reponse:
                    if reponse.status >= 400:
                        anomalies.append(f"Lien mort ({reponse.status}) : {produit['slug']} → {url}")
            except Exception as err:  # noqa: BLE001 — rapport, pas d'interruption
                remarques.append(f"Lien marchand injoignable : {produit['slug']} → {err}")

    return anomalies, remarques


def main() -> int:
    analyseur = argparse.ArgumentParser(description="Recette automatisée du site.")
    analyseur.add_argument("--reseau", action="store_true",
                           help="Teste réellement les liens marchands (requêtes HTTP).")
    analyseur.add_argument("--sortie", help="Dossier du site généré.")
    options = analyseur.parse_args()

    cfg = json.loads((RACINE / "site" / "config.json").read_text(encoding="utf-8"))
    sortie = RACINE / (options.sortie or cfg["dossier_sortie"])
    if not sortie.exists():
        print(f"Dossier {sortie} introuvable : lancez d'abord tools/generer_site_conseil.py")
        return 1

    anomalies, remarques = verifier(sortie, cfg, options.reseau)
    pages = len(list(sortie.rglob("*.html")))

    print(f"Recette du site — {pages} pages contrôlées.")
    if anomalies:
        print(f"\n  {len(anomalies)} anomalie(s) bloquante(s) :")
        for m in anomalies:
            print(f"    ✗ {m}")
    if remarques:
        print(f"\n  {len(remarques)} remarque(s) :")
        for m in remarques:
            print(f"    · {m}")
    if not anomalies and not remarques:
        print("  Aucun écart détecté.")
    elif not anomalies:
        print("\n  Aucune anomalie bloquante.")
    return 1 if anomalies else 0


if __name__ == "__main__":
    sys.exit(main())
