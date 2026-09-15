#!/usr/bin/env python3
"""Générateur du site éditorial de conseil à la consommation.

Il lit les contenus de `site/` (JSON + fichiers texte) et produit le site
statique complet dans le dossier indiqué par `dossier_sortie` de
site/config.json — par défaut `conseil/`.

    python3 tools/generer_site_conseil.py            # génère et contrôle
    python3 tools/generer_site_conseil.py --strict   # échoue sur avertissement

Aucune dépendance : bibliothèque standard uniquement.

Le générateur applique les contrôles de publication du cahier des charges :
alternative textuelle obligatoire sur l'image de couverture (§ 6.5), signature
obligatoire (§ 5), longueurs des balises title et meta description (§ 6.4),
budget de poids et de requêtes par page (§ 6.3). Voir le rapport final.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
import shutil
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "site"
CONTENU = SOURCE / "contenu"

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]

avertissements: list[str] = []
erreurs: list[str] = []


def avertir(message: str) -> None:
    avertissements.append(message)


def refuser(message: str) -> None:
    """Anomalie bloquant la publication (§ 5 et § 6.5)."""
    erreurs.append(message)


# --------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------

def ardoise(texte: str) -> str:
    """Transforme un texte en identifiant d'URL : minuscules, sans accent."""
    texte = unicodedata.normalize("NFD", texte)
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    texte = re.sub(r"[^a-zA-Z0-9]+", "-", texte).strip("-").lower()
    return texte or "section"


def e(texte) -> str:
    return html.escape(str(texte), quote=True)


def date_fr(iso: str, avec_jour: bool = False) -> str:
    d = datetime.strptime(iso, "%Y-%m-%d").date()
    if avec_jour:
        return f"{d.day} {MOIS[d.month - 1]} {d.year}"
    return f"{MOIS[d.month - 1]} {d.year}"


def temps_lecture(texte: str) -> int:
    """§ 4.3.4 point 4 : temps de lecture calculé automatiquement."""
    mots = len(re.findall(r"\w+", texte, flags=re.UNICODE))
    return max(1, math.ceil(mots / 220))


def prefixe(profondeur: int) -> str:
    """Chemin relatif vers la racine du site, pour une page à N niveaux."""
    return "../" * profondeur if profondeur else ""


def lire_entete(chemin: Path) -> tuple[dict, str]:
    """Lit un fichier `clé: valeur`, ligne `---`, puis le corps."""
    brut = chemin.read_text(encoding="utf-8")
    if "\n---\n" in brut:
        entete_brute, corps = brut.split("\n---\n", 1)
    else:
        entete_brute, corps = brut, ""
    champs: dict = {}
    for ligne in entete_brute.splitlines():
        ligne = ligne.rstrip()
        if not ligne or ligne.startswith("#") or ":" not in ligne:
            continue
        cle, _, valeur = ligne.partition(":")
        valeur = valeur.strip()
        try:
            champs[cle.strip()] = json.loads(valeur)
        except (ValueError, TypeError):
            champs[cle.strip()] = valeur
    return champs, corps.strip()


# --------------------------------------------------------------------------
# Rendu du corps : sous-ensemble Markdown + blocs éditoriaux (§ 4.3.4 point 7)
# --------------------------------------------------------------------------

MOTIF_BLOC = re.compile(r"^:::\s*(\w+)\s*(.*)$")
MOTIF_ATTR = re.compile(r'(\w+)="([^"]*)"')


def inline(texte: str, ctx: dict) -> str:
    """Gras, italique, code, liens. Les liens externes reçoivent
    target=_blank rel=noopener et un pictogramme (§ 4.3.4 point 6)."""
    out = e(texte)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)

    def lien(m):
        libelle, url = m.group(1), m.group(2)
        if url.startswith(("http://", "https://")):
            return (f'<a class="lien-externe" href="{url}" target="_blank" '
                    f'rel="noopener">{libelle}</a>')
        if url.startswith(("#", "mailto:")):
            return f'<a href="{url}">{libelle}</a>'
        return f'<a href="{ctx["base"]}{url.lstrip("/")}">{libelle}</a>'

    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lien, out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", out)
    return out


def rendre_corps(corps: str, ctx: dict) -> tuple[str, list]:
    """Retourne le HTML du corps et la liste des FAQ rencontrées
    (réutilisée pour le balisage JSON-LD FAQPage, § 6.4)."""
    lignes = corps.split("\n")
    html_sortie: list[str] = []
    faq_collectee: list[tuple[str, str]] = []
    i = 0
    n = len(lignes)

    def fermer_liste(pile):
        while pile:
            html_sortie.append(f"</{pile.pop()}>")

    pile: list[str] = []

    while i < n:
        ligne = lignes[i]
        nue = ligne.strip()

        # --- blocs éditoriaux --------------------------------------------
        m = MOTIF_BLOC.match(nue)
        if m and m.group(1) != "":
            fermer_liste(pile)
            nom = m.group(1)
            attrs = dict(MOTIF_ATTR.findall(m.group(2)))
            interieur: list[str] = []
            i += 1
            while i < n and lignes[i].strip() != ":::":
                interieur.append(lignes[i])
                i += 1
            i += 1
            bloc, faq = rendre_bloc(nom, attrs, interieur, ctx)
            html_sortie.append(bloc)
            faq_collectee.extend(faq)
            continue

        # --- tableaux ------------------------------------------------------
        if nue.startswith("|"):
            fermer_liste(pile)
            table = []
            while i < n and lignes[i].strip().startswith("|"):
                table.append(lignes[i].strip())
                i += 1
            html_sortie.append(rendre_tableau(table, ctx))
            continue

        # --- titres --------------------------------------------------------
        if nue.startswith("### "):
            fermer_liste(pile)
            t = nue[4:]
            html_sortie.append(f'<h3 id="{ardoise(t)}">{inline(t, ctx)}</h3>')
            i += 1
            continue
        if nue.startswith("## "):
            fermer_liste(pile)
            t = nue[3:]
            html_sortie.append(f'<h2 id="{ardoise(t)}">{inline(t, ctx)}</h2>')
            ctx.setdefault("h2", []).append(t)
            i += 1
            continue

        # --- citation ------------------------------------------------------
        if nue.startswith("> "):
            fermer_liste(pile)
            bloc = []
            while i < n and lignes[i].strip().startswith("> "):
                bloc.append(lignes[i].strip()[2:])
                i += 1
            html_sortie.append("<blockquote><p>" + inline(" ".join(bloc), ctx) + "</p></blockquote>")
            continue

        # --- listes --------------------------------------------------------
        if re.match(r"^- ", nue):
            if not pile or pile[-1] != "ul":
                fermer_liste(pile)
                html_sortie.append("<ul>")
                pile.append("ul")
            html_sortie.append(f"<li>{inline(nue[2:], ctx)}</li>")
            i += 1
            continue
        if re.match(r"^\d+\. ", nue):
            if not pile or pile[-1] != "ol":
                fermer_liste(pile)
                html_sortie.append("<ol>")
                pile.append("ol")
            texte_li = re.sub(r"^\d+\. ", "", nue)
            html_sortie.append("<li>" + inline(texte_li, ctx) + "</li>")
            i += 1
            continue

        # --- paragraphe ----------------------------------------------------
        if not nue:
            fermer_liste(pile)
            i += 1
            continue
        fermer_liste(pile)
        paragraphe = [nue]
        i += 1
        while i < n and lignes[i].strip() and not re.match(r"^(#|-|\d+\.|>|\||:::)", lignes[i].strip()):
            paragraphe.append(lignes[i].strip())
            i += 1
        html_sortie.append("<p>" + inline(" ".join(paragraphe), ctx) + "</p>")

    fermer_liste(pile)
    return "\n".join(html_sortie), faq_collectee


def rendre_tableau(lignes: list[str], ctx: dict) -> str:
    cellules = [[c.strip() for c in l.strip("|").split("|")] for l in lignes]
    if len(cellules) >= 2 and set("".join(cellules[1]).replace(" ", "")) <= set("-:"):
        entete, corps = cellules[0], cellules[2:]
    else:
        entete, corps = cellules[0], cellules[1:]
    th = "".join(f"<th scope=\"col\">{inline(c, ctx)}</th>" for c in entete)
    trs = "".join(
        "<tr>" + "".join(f"<td>{inline(c, ctx)}</td>" for c in ligne) + "</tr>"
        for ligne in corps
    )
    return (f'<div class="tableau-enveloppe" tabindex="0" role="region" '
            f'aria-label="Tableau, défilement horizontal possible">'
            f"<table><thead><tr>{th}</tr></thead>"
            f"<tbody>{trs}</tbody></table></div>")


# --------------------------------------------------------------------------
# Blocs éditoriaux réutilisables (§ 4.3.4 point 7)
# --------------------------------------------------------------------------

def note_fr(note) -> str:
    return f"{note:.1f}".replace(".", ",")


def etoiles(note: float) -> str:
    pleines = int(note)
    demie = 1 if note - pleines >= 0.5 else 0
    return "★" * pleines + ("½" if demie else "") + "☆" * (5 - pleines - demie)


def lien_affilie(produit: dict, ctx: dict, emplacement: str, libelle: str = "") -> str:
    """Lien sortant traçable /go/{slug}/ (§ 4.6)."""
    url = f'{ctx["base"]}{ctx["prefixe_go"]}/{produit["slug"]}/'
    libelle = libelle or f'Voir le prix chez {produit.get("marchand", "le marchand")}'
    return (f'<a class="bouton bouton-achat" href="{url}" '
            f'rel="{e(ctx["rel_affilie"])}" target="_blank" '
            f'data-affilie="{e(produit["slug"])}" '
            f'data-marchand="{e(produit.get("marchand", ""))}" '
            f'data-emplacement="{e(emplacement)}">{e(libelle)}'
            f'<span class="invisible"> (lien affilié, nouvelle fenêtre)</span></a>')


def carte_produit(produit: dict, ctx: dict) -> str:
    forts = "".join(f"<li>{inline(p, ctx)}</li>" for p in produit.get("points_forts", []))
    faibles = "".join(f"<li>{inline(p, ctx)}</li>" for p in produit.get("points_faibles", []))
    visuel = visuel_produit(produit, ctx)
    critere = produit.get("critere", "")
    verifie = produit.get("verifie_le")
    date_prix = f"<small>Prix relevé le {date_fr(verifie, True)}</small>" if verifie else ""
    return f"""<div class="carte-produit" data-produit="{e(produit['slug'])}">
  <div class="carte-produit-haut">
    <div class="carte-produit-visuel">{visuel}</div>
    <div>
      {'<p class="etiquette etiquette-accent">' + e(critere) + '</p>' if critere else ''}
      <h3>{e(produit['nom'])}</h3>
      <p class="marque">{e(produit.get('marque', ''))} · {e(produit.get('categorie', ''))}</p>
      <p><span class="note"><span class="etoiles" aria-hidden="true">{etoiles(produit.get('note', 0))}</span>
      <span>{note_fr(produit.get('note', 0))}/5</span></span></p>
      <p class="prix">{e(produit.get('prix_indicatif', '—'))} € {date_prix}</p>
      {lien_affilie(produit, ctx, 'carte-produit')}
    </div>
  </div>
  <div class="pf-pfaibles">
    <div class="points-forts"><h4>Points forts</h4><ul>{forts}</ul></div>
    <div class="points-faibles"><h4>Points faibles</h4><ul>{faibles}</ul></div>
  </div>
</div>"""


def tableau_comparatif(slugs: list[str], colonnes: list[str], ctx: dict) -> str:
    produits = [ctx["produits"][s] for s in slugs if s in ctx["produits"]]
    th = "".join(f'<th scope="col">{e(c)}</th>' for c in colonnes)
    lignes = []
    for p in produits:
        cells = "".join(f'<td>{e(p.get("specs", {}).get(c, "—"))}</td>' for c in colonnes)
        lignes.append(
            '<tr><th scope="row">'
            + (f'<span class="produit-critere">{e(p["critere"])}</span>' if p.get("critere") else "")
            + f'<span class="produit-nom">{e(p["nom"])}</span>'
            + f'<span class="marque">{e(p.get("marque", ""))}</span></th>'
            + f'<td>{p.get("prix_indicatif", "—")} €</td>'
            + f'<td><span class="etoiles" aria-hidden="true">{etoiles(p.get("note", 0))}</span> {note_fr(p.get("note", 0))}/5</td>'
            + cells
            + f'<td>{lien_affilie(p, ctx, "tableau", "Voir")}</td></tr>'
        )
    return f"""<div class="tableau-enveloppe" tabindex="0" role="region"
     aria-label="Tableau comparatif, défilement horizontal possible">
  <table class="tableau-comparatif">
    <caption class="invisible">Tableau comparatif des produits de la sélection</caption>
    <thead><tr><th scope="col">Modèle</th><th scope="col">Prix indicatif</th><th scope="col">Note</th>{th}<th scope="col">Voir</th></tr></thead>
    <tbody>{''.join(lignes)}</tbody>
  </table>
</div>
<p class="carte-meta indication-tableau">Faites défiler le tableau horizontalement pour afficher
toutes les colonnes. Prix indicatifs relevés à la date précisée sur chaque fiche produit.</p>"""


def rendre_bloc(nom: str, attrs: dict, interieur: list[str], ctx: dict):
    faq: list[tuple[str, str]] = []
    texte = "\n".join(interieur).strip()

    if nom == "aretenir":
        titre = attrs.get("titre", "À retenir")
        contenu, _ = rendre_corps(texte, ctx)
        return (f'<aside class="bloc-aretenir"><h2>{e(titre)}</h2>{contenu}</aside>', faq)

    if nom == "chiffres":
        elements = []
        for ligne in interieur:
            ligne = ligne.strip().lstrip("- ").strip()
            if not ligne:
                continue
            morceaux = [m.strip() for m in ligne.split("|")]
            valeur = morceaux[0]
            libelle = morceaux[1] if len(morceaux) > 1 else ""
            source = morceaux[2] if len(morceaux) > 2 else ""
            src = (f' <a class="lien-externe" href="{source}" target="_blank" rel="noopener">source</a>'
                   if source else "")
            elements.append(f'<div class="chiffre"><b>{e(valeur)}</b><span>{e(libelle)}{src}</span></div>')
        return ('<div class="bloc-chiffres">' + "".join(elements) + "</div>", faq)

    if nom == "citation":
        contenu, _ = rendre_corps(texte, ctx)
        auteur = attrs.get("auteur", "")
        fonction = attrs.get("fonction", "")
        return (f'<figure class="bloc-citation"><blockquote>{contenu}</blockquote>'
                f'<figcaption><strong>{e(auteur)}</strong>'
                + (f" — {e(fonction)}" if fonction else "")
                + "</figcaption></figure>", faq)

    if nom == "produit":
        slug = attrs.get("slug", "")
        produit = ctx["produits"].get(slug)
        if not produit:
            refuser(f'{ctx["fichier"]} : produit inconnu « {slug} » (voir site/contenu/produits.json)')
            return ("", faq)
        ctx.setdefault("produits_cites", []).append(slug)
        return (carte_produit(produit, ctx), faq)

    if nom == "comparatif":
        slugs = [s.strip() for s in attrs.get("produits", "").split(",") if s.strip()]
        colonnes = [c.strip() for c in attrs.get("colonnes", "").split(",") if c.strip()]
        manquants = [s for s in slugs if s not in ctx["produits"]]
        if manquants:
            refuser(f'{ctx["fichier"]} : produits inconnus dans le comparatif : {", ".join(manquants)}')
        ctx.setdefault("produits_cites", []).extend(s for s in slugs if s in ctx["produits"])
        ctx["comparatif"] = [s for s in slugs if s in ctx["produits"]]
        return (tableau_comparatif(slugs, colonnes, ctx), faq)

    if nom == "faq":
        items = []
        question = None
        reponse: list[str] = []
        for ligne in interieur + ["? FIN"]:
            nue = ligne.strip()
            if nue.startswith("? "):
                if question:
                    items.append((question, " ".join(reponse).strip()))
                question, reponse = nue[2:], []
            elif nue.startswith("! "):
                reponse.append(nue[2:])
            elif nue and reponse:
                reponse.append(nue)
        details = []
        for q, r in items:
            details.append(
                f"<details><summary>{inline(q, ctx)}</summary><p>{inline(r, ctx)}</p></details>"
            )
            faq.append((q, r))
        return ('<section class="bloc-faq"><h2 id="questions-frequentes">Questions fréquentes</h2>'
                + "".join(details) + "</section>", faq)

    avertir(f'{ctx["fichier"]} : bloc inconnu « {nom} », ignoré.')
    return ("", faq)


# --------------------------------------------------------------------------
# Visuels : SVG générés, légers et sans dépendance à une banque d'images.
# En production, ils sont remplacés par les photographies du client
# (WebP/AVIF, srcset — § 6.3). Les dimensions sont toujours déclarées
# pour éviter tout décalage de mise en page (§ 6.3, anti-CLS).
# --------------------------------------------------------------------------

PALETTES = [("#17469E", "#4C7AD1"), ("#186B4A", "#4FA37D"), ("#B3521B", "#DB8B4E"),
            ("#0F2F6E", "#3F63A8"), ("#6B2E6E", "#A45FA8"), ("#1E5F73", "#4E93A8")]


def svg_illustration(graine: str, titre: str, largeur: int = 1200, hauteur: int = 800) -> str:
    h = hashlib.sha256(graine.encode("utf-8")).digest()
    fond, motif = PALETTES[h[0] % len(PALETTES)]
    formes = []
    for k in range(6):
        cx = 80 + (h[k * 3] / 255) * (largeur - 160)
        cy = 80 + (h[k * 3 + 1] / 255) * (hauteur - 160)
        r = 60 + (h[k * 3 + 2] / 255) * 190
        opacite = 0.10 + (h[k] % 5) * 0.045
        formes.append(
            f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="#fff" opacity="{opacite:.2f}"/>'
        )
    initiales = "".join(m[0] for m in re.findall(r"\w+", titre)[:3]).upper()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largeur} {hauteur}" role="img" aria-hidden="true">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{fond}"/><stop offset="1" stop-color="{motif}"/></linearGradient></defs>
<rect width="{largeur}" height="{hauteur}" fill="url(#g)"/>{''.join(formes)}
<text x="{largeur/2:.0f}" y="{hauteur/2:.0f}" text-anchor="middle" dominant-baseline="central"
 font-family="Georgia, serif" font-size="{hauteur*0.22:.0f}" fill="#fff" opacity=".82">{e(initiales)}</text>
</svg>"""


def visuel_article(article: dict, ctx: dict, classe: str = "", eager: bool = False) -> str:
    chemin = f'{ctx["base"]}medias/{article["slug"]}.svg'
    chargement = "eager" if eager else "lazy"
    priorite = ' fetchpriority="high"' if eager else ""
    return (f'<img src="{chemin}" width="1200" height="800" loading="{chargement}"{priorite} '
            f'decoding="async" alt="{e(article["image_alt"])}"'
            + (f' class="{classe}"' if classe else "") + ">")


def visuel_produit(produit: dict, ctx: dict) -> str:
    chemin = f'{ctx["base"]}medias/produits/{produit["slug"]}.svg'
    return (f'<img src="{chemin}" width="600" height="600" loading="lazy" decoding="async" '
            f'alt="{e(produit["nom"])} de la marque {e(produit.get("marque", ""))}">')


def visuel_auteur(auteur: dict, ctx: dict, taille: int = 200) -> str:
    chemin = f'{ctx["base"]}medias/auteurs/{auteur["slug"]}.svg'
    return (f'<img src="{chemin}" width="{taille}" height="{taille}" loading="lazy" '
            f'decoding="async" alt="Portrait de {e(auteur["nom"])}">')


# --------------------------------------------------------------------------
# Coquille des pages : en-tête, navigation, pied de page (§ 4.3.1)
# --------------------------------------------------------------------------

ICONES = {
    "facebook": '<svg viewBox="0 0 24 24"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg>',
    "x": '<svg viewBox="0 0 24 24"><path d="M3 3h4.9l4.3 6 5-6H21l-6.9 8.2L21.4 21h-4.9l-4.7-6.6L6.1 21H3.4l7.3-8.7z"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24"><path d="M5 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-2 6h4v11H3zm7 0h3.6v1.5c.6-1 1.8-1.8 3.5-1.8 3 0 3.9 1.9 3.9 4.7V21h-4v-5.6c0-1.4-.5-2.3-1.7-2.3-1 0-1.6.7-1.8 1.4-.1.2-.1.6-.1.9V21h-4z"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-2.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>',
}


def logo_svg(cfg: dict, sur_sombre: bool = False) -> str:
    couleur = "#FFFFFF" if sur_sombre else cfg["couleurs"]["primaire"]
    accent = "#9FC0F5" if sur_sombre else cfg["couleurs"]["accent"]
    marque = cfg["marque"]
    # La largeur du gabarit suit la longueur du nom : le point d'accent reste
    # collé au mot, quelle que soit la marque saisie dans config.json.
    fin_texte = 42 + len(marque) * 11.9
    largeur = fin_texte + 18
    return f"""<svg viewBox="0 0 {largeur:.0f} 44" role="img" aria-label="{e(marque)}, page d'accueil">
<title>{e(marque)}</title>
<rect x="0" y="6" width="32" height="32" rx="8" fill="{couleur}"/>
<path d="M9 22l4.5 4.5L23 17" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
<text x="42" y="29" font-family="Georgia, serif" font-size="21" font-weight="700" fill="{couleur}">{e(marque)}</text>
<circle cx="{fin_texte + 7:.0f}" cy="27" r="3.4" fill="{accent}"/>
</svg>"""


def navigation(ctx: dict) -> str:
    b = ctx["base"]
    items = []
    for t in ctx["transverses"]:
        items.append(f'<li class="nav-item transverse"><a href="{b}{t["slug"]}/">{e(t["nom"])}</a></li>')
    for r in ctx["rubriques"]:
        sous = ""
        if r["sous"]:
            liens = "".join(
                f'<li><a href="{b}{r["slug"]}/{s["slug"]}/">{e(s["nom"])}</a></li>' for s in r["sous"]
            )
            sous = f'<ul class="sous-menu">{liens}</ul>'
        items.append(f'<li class="nav-item"><a href="{b}{r["slug"]}/">{e(r["nom"])}</a>{sous}</li>')
    return f"""<nav class="nav-principale" id="menu" aria-label="Navigation principale" data-ouvert="non">
<ul>{''.join(items)}</ul></nav>"""


def entete(ctx: dict) -> str:
    b = ctx["base"]
    cfg = ctx["cfg"]
    reseaux = "".join(
        f'<li><a href="{e(url)}" target="_blank" rel="noopener me">{ICONES[nom]}'
        f'<span class="invisible">{nom.capitalize()}</span></a></li>'
        for nom, url in cfg["reseaux"].items() if nom in ICONES
    )
    return f"""<div class="barre-haute"><div class="conteneur">
<p>{e(cfg['promesse'].split('.')[0])}.</p>
<ul class="reseaux">{reseaux}</ul>
</div></div>
<header class="entete">
  <div class="conteneur entete-corps">
    <a class="logo" href="{b}">{logo_svg(cfg)}</a>
    {navigation(ctx)}
    <div class="actions-entete">
      <button type="button" class="bouton-icone" data-ouvrir-recherche aria-haspopup="dialog">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <span class="invisible">Rechercher sur le site</span>
      </button>
      <button type="button" class="bouton-icone burger" aria-expanded="false" aria-controls="menu">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        <span class="invisible">Ouvrir le menu</span>
      </button>
    </div>
  </div>
</header>
<div class="voile" data-actif="non"></div>
<div class="surcouche-recherche" data-ouvert="non" role="dialog" aria-label="Rechercher">
  <div class="boite-recherche">
    <form action="{b}recherche/" method="get" role="search">
      <label for="recherche-rapide">Rechercher un guide, un produit, un conseil</label>
      <input class="champ" id="recherche-rapide" type="search" name="q" autocomplete="off"
             placeholder="aspirateur, gourde, indice de durabilité…">
    </form>
    <ul class="suggestions"></ul>
    <p><button type="button" class="bouton bouton-secondaire" data-fermer>Fermer</button></p>
  </div>
</div>"""


def bloc_newsletter(ctx: dict, source: str, titre: str = "Nos conseils, une fois par semaine") -> str:
    cfg = ctx["cfg"]
    b = ctx["base"]
    return f"""<section class="bloc-newsletter" aria-labelledby="nl-{source}">
  <h2 id="nl-{source}">{e(titre)}</h2>
  <p>{e(cfg['newsletter']['finalite'])} Un courriel par semaine, désinscription en un clic.</p>
  <form class="formulaire-newsletter" data-newsletter="{e(source)}" novalidate>
    <div class="ligne">
      <label class="invisible" for="nl-mail-{source}">Votre adresse électronique</label>
      <input class="champ" id="nl-mail-{source}" type="email" name="email" required
             autocomplete="email" placeholder="vous@exemple.fr">
      <button type="submit" class="bouton">Je m'inscris</button>
    </div>
    <label class="consentement">
      <input type="checkbox" name="consentement" value="oui">
      <span>J'accepte de recevoir la lettre d'information. Mon adresse sert uniquement à cet envoi et
      n'est jamais cédée. Je peux me désinscrire à tout moment
      (<a href="{b}politique-de-confidentialite/">politique de confidentialité</a>).</span>
    </label>
    <p class="message-formulaire" data-message role="status"></p>
  </form>
</section>"""


def pied(ctx: dict) -> str:
    b = ctx["base"]
    cfg = ctx["cfg"]
    rubriques = "".join(
        f'<li><a href="{b}{r["slug"]}/">{e(r["nom"])}</a></li>'
        for r in ctx["transverses"] + ctx["rubriques"]
    )
    services = "".join(
        f'<li><a href="{b}{p["slug"]}/">{e(p["titre"])}</a></li>'
        for p in sorted(ctx["pages"], key=lambda x: x.get("ordre", 99))
    )
    return f"""<footer class="pied">
  <div class="conteneur">
    <div class="pied-grille">
      <div>
        <p class="logo">{logo_svg(cfg, sur_sombre=True)}</p>
        <p>{e(cfg['promesse'])}</p>
        <p><a href="{b}charte-editoriale/">Charte éditoriale</a> ·
           <a href="{b}politique-affiliation/">Politique d'affiliation</a></p>
      </div>
      <div>
        <h2>Rubriques</h2>
        <ul>{rubriques}</ul>
      </div>
      <div>
        <h2>Le site</h2>
        <ul>{services}<li><a href="{b}auteurs/">Nos auteurs</a></li></ul>
      </div>
    </div>
    <div class="pied-bas">
      <p>© <span data-annee>{date.today().year}</span> {e(cfg['marque'])} — {e(cfg['raison_sociale'])}.
         Tous droits réservés.</p>
      <p><button type="button" class="bouton-lien" data-ouvrir-cmp>Gérer les cookies</button></p>
    </div>
  </div>
</footer>"""


def jsonld(*blocs) -> str:
    utiles = [b for b in blocs if b]
    if not utiles:
        return ""
    contenu = json.dumps(utiles if len(utiles) > 1 else utiles[0],
                         ensure_ascii=False, separators=(",", ":"))
    return f'<script type="application/ld+json">{contenu}</script>'


def page(ctx, *, titre, description, chemin, corps, profondeur, noindex=False,
         entete_sup="", classe_corps="", attributs_corps="", og_type="website",
         og_image=None, structure="", canonique=None):
    """Assemble une page complète. `chemin` est l'URL relative à la racine."""
    cfg = ctx["cfg"]
    b = prefixe(profondeur)
    ctx["base"] = b
    couleurs = "".join(f"--{k.replace('_', '-')}:{v};" for k, v in cfg["couleurs"].items())
    url_absolue = canonique or (cfg["base_url"].rstrip("/") + "/" + chemin).rstrip("/") + "/"
    if chemin == "":
        url_absolue = cfg["base_url"].rstrip("/") + "/"
    image = og_image or (cfg["base_url"].rstrip("/") + "/medias/partage-defaut.svg")

    if len(titre) > cfg["meta_titre_max"]:
        avertir(f'Balise title trop longue ({len(titre)} > {cfg["meta_titre_max"]}) : {chemin or "/"}')
    if len(description) > cfg["meta_description_max"]:
        avertir(f'Meta description trop longue ({len(description)} > {cfg["meta_description_max"]}) : {chemin or "/"}')

    demo = ""
    if cfg.get("mode_demonstration"):
        demo = ('<p class="bandeau-demo"><strong>Site de démonstration.</strong> '
                "Contenus, marques et prix fictifs, destinés à valider les gabarits. "
                "Aucune recommandation d'achat réelle.</p>")

    reglages = json.dumps({
        "mesure": cfg["mesure"]["outil"],
        "matomoUrl": cfg["mesure"].get("matomo_url", ""),
        "matomoSiteId": cfg["mesure"].get("matomo_site_id", "1"),
        "ga4": cfg["mesure"].get("ga4_id", ""),
    }, ensure_ascii=False)

    return f"""<!doctype html>
<html lang="{cfg['langue']}" data-base="{b}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url_absolue}">
{'<meta name="robots" content="noindex, follow">' if noindex else '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{e(cfg['marque'])}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{e(titre)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url_absolue}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(titre)}">
<meta name="twitter:description" content="{e(description)}">
<meta name="twitter:image" content="{image}">
<meta name="theme-color" content="{cfg['couleurs']['primaire']}">
<link rel="icon" href="{b}medias/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="{e(cfg['marque'])} — derniers articles" href="{b}flux.xml">
<style>:root{{{couleurs}}}</style>
<link rel="stylesheet" href="{b}assets/style.css">
<script type="application/json" id="reglages-site">{reglages}</script>
<script src="{b}assets/consentement.js" defer></script>
<script src="{b}assets/site.js" defer></script>
{structure}
{entete_sup}
</head>
<body{(' class="' + classe_corps + '"') if classe_corps else ''}{attributs_corps}>
<a class="evitement" href="#contenu">Aller au contenu principal</a>
{demo}
{entete(ctx)}
<main id="contenu">
{corps}
</main>
{pied(ctx)}
</body>
</html>"""


# --------------------------------------------------------------------------
# Cartes de contenu et listings
# --------------------------------------------------------------------------

def carte(article: dict, ctx: dict, principale: bool = False, avec_chapo: bool = True,
          niveau: int = 3) -> str:
    b = ctx["base"]
    url = b + article["url"]
    meta = [date_fr(article["publie_le"]), f'{article["temps_lecture"]} min de lecture']
    if article.get("partenaire"):
        meta.append('<span class="etiquette etiquette-accent">Article partenaire</span>')
    etiquette = f'<a class="etiquette" href="{b}{article["rubrique"]}/">{e(article["rubrique_nom"])}</a>'
    chapo = f'<p class="carte-chapo">{e(article["chapo"][:160])}…</p>' if avec_chapo else ""
    return f"""<article class="carte{' carte-principale' if principale else ''}">
  <a class="carte-visuel" href="{url}" tabindex="-1" aria-hidden="true">{visuel_article(article, ctx, eager=principale)}</a>
  <div class="carte-texte">
    <p class="carte-meta">{etiquette}</p>
    <h{niveau} class="carte-titre"><a href="{url}">{e(article['titre'])}</a></h{niveau}>
    {chapo}
    <p class="carte-meta">{' · '.join(meta)}</p>
  </div>
</article>"""


def grille(articles: list, ctx: dict, colonnes: int = 3, avec_chapo: bool = True,
           niveau: int = 3) -> str:
    return (f'<div class="grille grille-{colonnes}">'
            + "".join(carte(a, ctx, avec_chapo=avec_chapo, niveau=niveau) for a in articles)
            + "</div>")


def fil_ariane(elements: list, ctx: dict) -> tuple[str, dict]:
    """Retourne le HTML et le JSON-LD BreadcrumbList (§ 6.4)."""
    b = ctx["base"]
    lis, items = [], []
    for i, (libelle, url) in enumerate(elements, start=1):
        if url is None:
            lis.append(f'<li aria-current="page">{e(libelle)}</li>')
        else:
            lis.append(f'<li><a href="{b}{url}">{e(libelle)}</a></li>')
        cible = url if url is not None else ctx.get("chemin_courant", "")
        items.append({
            "@type": "ListItem", "position": i, "name": libelle,
            "item": ctx["cfg"]["base_url"].rstrip("/") + "/" + cible
        })
    html_fil = ('<nav class="fil-ariane" aria-label="Fil d\'Ariane"><div class="conteneur"><ol>'
                + "".join(lis) + "</ol></div></nav>")
    return html_fil, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def pagination(page_courante: int, total: int, base_url: str, ctx: dict) -> str:
    if total <= 1:
        return ""
    b = ctx["base"]

    def url(n):
        return f"{b}{base_url}" if n == 1 else f"{b}{base_url}page/{n}/"

    items = []
    if page_courante > 1:
        items.append(f'<li><a href="{url(page_courante - 1)}" rel="prev">Précédent</a></li>')
    for n in range(1, total + 1):
        if n == page_courante:
            items.append(f'<li><span aria-current="page">{n}</span></li>')
        else:
            items.append(f'<li><a href="{url(n)}">{n}</a></li>')
    if page_courante < total:
        items.append(f'<li><a href="{url(page_courante + 1)}" rel="next">Suivant</a></li>')
    return f'<nav aria-label="Pagination"><ol class="pagination">{"".join(items)}</ol></nav>'


# --------------------------------------------------------------------------
# Gabarit article (§ 4.3.4)
# --------------------------------------------------------------------------

def inserer_pave(corps_html: str) -> str:
    """Pavé in-article après le 2e H2 (§ 7.3), hauteur réservée (anti-CLS)."""
    pave = ('<div class="pub pub-pave" role="complementary" aria-label="Publicité">'
            "Publicité 300×250</div>")
    positions = [m.end() for m in re.finditer(r"</h2>", corps_html)]
    if len(positions) >= 2:
        # Après le 2e H2, mais à la fin du premier paragraphe qui le suit :
        # un encart publicitaire collé à un titre nuit à la lecture.
        suite = corps_html.find("</p>", positions[1])
        p = (suite + 4) if suite != -1 else positions[1]
        return corps_html[:p] + pave + corps_html[p:]
    return corps_html + pave


def construire_article(article: dict, ctx: dict) -> str:
    cfg = ctx["cfg"]
    profondeur = article["profondeur"]
    ctx["base"] = prefixe(profondeur)
    b = ctx["base"]
    ctx["fichier"] = article["fichier"]
    ctx["chemin_courant"] = article["url"]
    ctx["comparatif"] = []
    ctx["produits_cites"] = []
    ctx["h2"] = []

    corps_html, faq = rendre_corps(article["corps"], ctx)
    corps_html = inserer_pave(corps_html)

    auteur = ctx["auteurs"][article["auteur"]]

    # 1. fil d'Ariane
    chemin_fil = [("Accueil", "")]
    chemin_fil.append((article["rubrique_nom"], f'{article["rubrique"]}/'))
    if article.get("sous_rubrique_nom"):
        chemin_fil.append((article["sous_rubrique_nom"],
                           f'{article["rubrique"]}/{article["sous_rubrique"]}/'))
    chemin_fil.append((article["titre"], None))
    fil_html, fil_ld = fil_ariane(chemin_fil, ctx)

    # 4. ligne de crédits
    maj = ""
    if article.get("maj_le") and article["maj_le"] != article["publie_le"]:
        maj = f'<span class="maj">Mis à jour en {date_fr(article["maj_le"])}</span>'
    credits = f"""<p class="credits">
      <span>Publié en {date_fr(article['publie_le'])}</span>{maj}
      <span>{article['temps_lecture']} min de lecture</span>
      <span>Par <a href="{b}auteurs/{auteur['slug']}/" rel="author">{e(auteur['nom'])}</a>,
      {e(auteur['fonction'])}</span>
    </p>"""

    # mention d'affiliation, avant le premier lien commercial (§ 5)
    mention = ""
    if article.get("affiliation"):
        mention = f"""<p class="mention-affiliation">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>
      <span>{e(cfg['affiliation']['mention'])}</span></p>"""

    bandeau_partenaire = ""
    if article.get("partenaire"):
        bandeau_partenaire = f"""<p class="bandeau-partenaire">
      <span class="etiquette etiquette-accent">Article partenaire</span>
      <span>Ce contenu est financé par {e(article.get('partenaire_nom', 'un annonceur'))}.
      Il n'entre dans aucun de nos comparatifs éditoriaux.
      <a href="{b}politique-affiliation/">Notre politique</a>.</span></p>"""

    # 8. encadré « Complément d'informations » (§ 4.3.4 point 8)
    def jetons(valeurs):
        return "".join(f'<span class="jeton">{e(v)}</span>' for v in valeurs)

    lignes_complement = []
    if article.get("thematiques"):
        lignes_complement.append(("Thématiques", jetons(article["thematiques"])))
    if article.get("mots_cles"):
        lignes_complement.append(("Mots-clés", jetons(article["mots_cles"])))
    if article.get("lieu"):
        lignes_complement.append(("Localisation du sujet", e(article["lieu"])))
    if article.get("expertise_auteur"):
        lignes_complement.append(("Expertise de l'auteur", e(article["expertise_auteur"])))
    if article.get("transverses"):
        lignes_complement.append(
            ("Sélections", "".join(
                f'<a class="jeton" href="{b}{t}/">{e(ctx["transverses_par_slug"][t]["nom"])}</a>'
                for t in article["transverses"] if t in ctx["transverses_par_slug"])))
    complement = ""
    if lignes_complement:
        dl = "".join(f"<dt>{titre}</dt><dd>{valeur}</dd>" for titre, valeur in lignes_complement)
        complement = f"""<section class="complement" aria-labelledby="complement-titre">
      <h2 id="complement-titre">Complément d'informations</h2><dl>{dl}</dl></section>"""

    # 9. bloc auteur
    reseaux_auteur = " · ".join(
        f'<a href="{e(url)}" target="_blank" rel="noopener me">{nom.capitalize()}</a>'
        for nom, url in auteur.get("reseaux", {}).items())
    bloc_auteur = f"""<section class="bloc-auteur" aria-labelledby="auteur-titre">
      <div class="portrait">{visuel_auteur(auteur, ctx)}</div>
      <div>
        <h2 id="auteur-titre">{e(auteur['nom'])}</h2>
        <p class="fonction">{e(auteur['fonction'])} · {e(', '.join(auteur['expertises']))}</p>
        <p>{e(auteur['bio_courte'])}</p>
        <p><a href="{b}auteurs/{auteur['slug']}/">Tous ses articles</a>{' · ' + reseaux_auteur if reseaux_auteur else ''}</p>
      </div>
    </section>"""

    # 10. partage
    url_abs = cfg["base_url"].rstrip("/") + "/" + article["url"]
    partage = f"""<div class="partage">
      <span>Partager</span>
      <a href="https://www.facebook.com/sharer/sharer.php?u={url_abs}" target="_blank" rel="noopener nofollow">
        {ICONES['facebook']}<span class="invisible">Partager sur Facebook</span></a>
      <a href="https://x.com/intent/tweet?url={url_abs}&amp;text={html.escape(article['titre'])}" target="_blank" rel="noopener nofollow">
        {ICONES['x']}<span class="invisible">Partager sur X</span></a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url={url_abs}" target="_blank" rel="noopener nofollow">
        {ICONES['linkedin']}<span class="invisible">Partager sur LinkedIn</span></a>
      <a href="mailto:?subject={html.escape(article['titre'])}&amp;body={url_abs}">
        <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zm2 2v.5l7 4.5 7-4.5V7z"/></svg>
        <span class="invisible">Partager par courriel</span></a>
      <button type="button" data-partage-natif>
        <svg viewBox="0 0 24 24"><path d="M18 8a3 3 0 1 0-2.8-4H15L8.9 7.6a3 3 0 1 0 0 8.8L15 20h.2A3 3 0 1 0 18 16a3 3 0 0 0-2.1.9L10 13.4a3 3 0 0 0 0-2.8l5.9-3.5A3 3 0 0 0 18 8z"/></svg>
        <span class="invisible">Partager (partage natif)</span></button>
    </div>"""

    # 11 & 13. recommandations
    autres = recommander(article, ctx, meme_rubrique=True, nombre=4)
    rapport = recommander(article, ctx, meme_rubrique=False, nombre=5)

    bloc_recos = f"""<section class="section" aria-labelledby="recos-titre">
      <div class="entete-section"><h2 id="recos-titre">Vous souhaitez d'autres conseils&nbsp;?</h2></div>
      {grille(autres, ctx, 4, avec_chapo=False)}
    </section>"""
    bloc_rapport = f"""<section class="section" aria-labelledby="rapport-titre">
      <div class="entete-section"><h2 id="rapport-titre">En rapport avec votre article</h2></div>
      {grille(rapport, ctx, 4, avec_chapo=False)}
    </section>"""

    # 14. bloc partenaire
    bloc_partenaire = f"""<aside class="bloc-partenaire" data-partenaire aria-label="Contenu partenaire">
      <p class="etiquette etiquette-accent">Contenu partenaire</p>
      <h2>Emplacement réservé au partenaire</h2>
      <p>Cet emplacement est commercialisé et clairement identifié comme tel, conformément à notre
      <a href="{b}politique-affiliation/">politique d'affiliation et de publicité</a>. Il n'influence
      aucun classement éditorial.</p>
    </aside>"""

    # JSON-LD
    ld_article = {
        "@context": "https://schema.org",
        "@type": "NewsArticle" if article["type"] == "actu" else "Article",
        "headline": article["titre"][:110],
        "description": article["chapo"],
        "inLanguage": "fr-FR",
        "datePublished": article["publie_le"],
        "dateModified": article.get("maj_le", article["publie_le"]),
        "mainEntityOfPage": {"@type": "WebPage", "@id": url_abs},
        "image": [cfg["base_url"].rstrip("/") + f'/medias/{article["slug"]}.svg'],
        "author": {"@type": "Person", "name": auteur["nom"], "jobTitle": auteur["fonction"],
                   "url": cfg["base_url"].rstrip("/") + f'/auteurs/{auteur["slug"]}/'},
        "publisher": {"@type": "Organization", "name": cfg["marque"],
                      "url": cfg["base_url"].rstrip("/") + "/"},
        "articleSection": article["rubrique_nom"],
        "keywords": ", ".join(article.get("mots_cles", [])),
    }
    if article.get("lieu"):
        ld_article["contentLocation"] = {"@type": "Place", "name": article["lieu"]}

    ld_faq = None
    if faq:
        ld_faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", r)}}
            for q, r in faq]}

    ld_liste = None
    if ctx["comparatif"]:
        ld_liste = {"@context": "https://schema.org", "@type": "ItemList",
                    "name": article["titre"], "itemListOrder": "https://schema.org/ItemListOrderDescending",
                    "numberOfItems": len(ctx["comparatif"]), "itemListElement": []}
        for i, slug in enumerate(ctx["comparatif"], start=1):
            p = ctx["produits"][slug]
            ld_liste["itemListElement"].append({
                "@type": "ListItem", "position": i,
                "item": {
                    "@type": "Product", "name": p["nom"], "brand": {"@type": "Brand", "name": p.get("marque", "")},
                    "category": p.get("categorie", ""),
                    "review": {"@type": "Review", "author": {"@type": "Person", "name": auteur["nom"]},
                               "reviewRating": {"@type": "Rating", "ratingValue": p.get("note", 0),
                                                "bestRating": 5, "worstRating": 1}},
                    "offers": {"@type": "Offer", "price": p.get("prix_indicatif", 0),
                               "priceCurrency": "EUR", "availability": "https://schema.org/InStock",
                               "url": cfg["base_url"].rstrip("/") + f'/{ctx["prefixe_go"]}/{slug}/'},
                }})

    corps = f"""{fil_html}
<div class="conteneur">
  <div class="pub pub-banniere" role="complementary" aria-label="Publicité">Publicité</div>
  <div class="page-article">
    <article class="article-entete" data-article="{e(article['slug'])}">
      {bandeau_partenaire}
      <figure class="visuel-entete">{visuel_article(article, ctx, eager=True)}
        <figcaption>{e(article.get('image_legende', ''))}</figcaption></figure>
      <h1>{e(article['titre'])}</h1>
      {credits}
      <p class="chapo">{e(article['chapo'])}</p>
      {mention}
      <div class="corps">{corps_html}</div>
      {complement}
      {bloc_auteur}
      {partage}
    </article>
    <aside class="colonne-laterale">
      <div class="pub pub-colonne" role="complementary" aria-label="Publicité">Publicité 300×600</div>
    </aside>
  </div>
</div>
<div class="conteneur">{bloc_recos}</div>
<div class="section section-alt"><div class="conteneur lecture">{bloc_newsletter(ctx, 'article')}</div></div>
<div class="conteneur">{bloc_rapport}{bloc_partenaire}</div>"""

    return page(
        ctx,
        titre=article.get("meta_titre") or article["titre"],
        description=article.get("meta_description") or article["chapo"][:150],
        chemin=article["url"],
        corps=corps,
        profondeur=profondeur,
        og_type="article",
        og_image=cfg["base_url"].rstrip("/") + f'/medias/{article["slug"]}.svg',
        structure=jsonld(ld_article, fil_ld, ld_faq, ld_liste),
        attributs_corps=f' data-article="{e(article["slug"])}"',
    )


def recommander(article: dict, ctx: dict, meme_rubrique: bool, nombre: int) -> list:
    """§ 4.3.4 points 11 et 13 : même rubrique, sinon récence ; même
    sous-rubrique ou mots-clés partagés pour le second bloc."""
    autres = [a for a in ctx["articles"] if a["slug"] != article["slug"]]
    if meme_rubrique:
        prioritaires = [a for a in autres if a["rubrique"] == article["rubrique"]]
    else:
        mots = set(article.get("mots_cles", []))
        prioritaires = [
            a for a in autres
            if (article.get("sous_rubrique") and a.get("sous_rubrique") == article.get("sous_rubrique")
                and a["rubrique"] == article["rubrique"])
            or (mots & set(a.get("mots_cles", [])))
            or (set(article.get("transverses", [])) & set(a.get("transverses", [])))
        ]
    reste = [a for a in autres if a not in prioritaires]
    return (prioritaires + reste)[:nombre]


# --------------------------------------------------------------------------
# Page d'accueil (§ 4.3.2)
# --------------------------------------------------------------------------

def construire_accueil(ctx: dict) -> str:
    cfg = ctx["cfg"]
    ctx["base"] = ""
    recents = ctx["articles"]
    une, secondaires = recents[0], recents[1:5]

    blocs_rubriques = []
    for r in ctx["rubriques"]:
        arts = [a for a in recents if a["rubrique"] == r["slug"]][:4]
        if not arts:
            continue
        blocs_rubriques.append(f"""<section class="section" aria-labelledby="r-{r['slug']}">
  <div class="entete-section">
    <h2 id="r-{r['slug']}">{e(r['nom'])}</h2>
    <a href="{r['slug']}/">Voir tous les articles<span class="invisible"> de la rubrique {e(r['nom'])}</span> →</a>
  </div>
  {grille(arts, ctx, 4, avec_chapo=False)}
</section>""")

    blocs_transverses = []
    for t in ctx["transverses"]:
        arts = [a for a in recents if t["slug"] in a.get("transverses", [])][:3]
        if not arts:
            continue
        blocs_transverses.append(f"""<section class="section" aria-labelledby="t-{t['slug']}">
  <div class="entete-section">
    <h2 id="t-{t['slug']}">Nos sélections {e(t['nom'])}</h2>
    <a href="{t['slug']}/">Tout voir →</a>
  </div>
  <p class="lecture">{e(t['chapo'])}</p>
  {grille(arts, ctx, 3)}
</section>""")

    ld_org = {
        "@context": "https://schema.org", "@type": "Organization",
        "name": cfg["marque"], "url": cfg["base_url"].rstrip("/") + "/",
        "logo": cfg["base_url"].rstrip("/") + "/medias/logo.svg",
        "slogan": cfg["baseline"],
        "sameAs": [u for u in cfg["reseaux"].values() if not u.startswith("[") and "[" not in u],
    }
    ld_site = {
        "@context": "https://schema.org", "@type": "WebSite",
        "name": cfg["marque"], "url": cfg["base_url"].rstrip("/") + "/",
        "inLanguage": "fr-FR",
        "potentialAction": {
            "@type": "SearchAction",
            "target": {"@type": "EntryPoint",
                       "urlTemplate": cfg["base_url"].rstrip("/") + "/recherche/?q={search_term_string}"},
            "query-input": "required name=search_term_string",
        },
    }

    corps = f"""<div class="conteneur">
  <div class="pub pub-banniere" role="complementary" aria-label="Publicité">Publicité</div>
  <section class="section" aria-labelledby="une-titre">
    <h1 id="une-titre" class="invisible">{e(cfg['marque'])} — {e(cfg['baseline'])}</h1>
    <div class="une">
      {carte(une, ctx, principale=True, niveau=2)}
      <div class="une-secondaires">{''.join(carte(a, ctx, avec_chapo=False, niveau=2) for a in secondaires)}</div>
    </div>
  </section>
</div>
<div class="conteneur">{''.join(blocs_transverses)}</div>
<div class="section section-alt"><div class="conteneur lecture">{bloc_newsletter(ctx, 'accueil')}</div></div>
<div class="conteneur">{''.join(blocs_rubriques)}</div>"""

    return page(ctx, titre=f'{cfg["marque"]} — {cfg["baseline"]}',
                description=cfg["promesse"][:150], chemin="", corps=corps, profondeur=0,
                structure=jsonld(ld_org, ld_site))


# --------------------------------------------------------------------------
# Pages rubrique, sous-rubrique et transverse (§ 4.3.3)
# --------------------------------------------------------------------------

def construire_listing(ctx, *, titre, h1, chapo, articles, chemin, profondeur,
                       sous_rubriques=None, fil=None, description=None):
    pages_html = []
    par_page = ctx["cfg"]["articles_par_page"]
    total = max(1, math.ceil(len(articles) / par_page))

    for numero in range(1, total + 1):
        prof = profondeur if numero == 1 else profondeur + 2
        ctx["base"] = prefixe(prof)
        lot = articles[(numero - 1) * par_page: numero * par_page]
        ctx["chemin_courant"] = chemin if numero == 1 else f"{chemin}page/{numero}/"
        fil_html, fil_ld = fil_ariane(fil or [("Accueil", ""), (h1, None)], ctx)

        sous_html = ""
        if sous_rubriques:
            liens = "".join(
                f'<li><a class="etiquette" href="{ctx["base"]}{s["url"]}">{e(s["nom"])}</a></li>'
                for s in sous_rubriques)
            sous_html = ('<nav aria-label="Sous-rubriques"><ul class="reseaux" style="flex-wrap:wrap;gap:.4rem">'
                         + liens + "</ul></nav>")

        chemin_page = chemin if numero == 1 else f"{chemin}page/{numero}/"
        suffixe = "" if numero == 1 else f" — page {numero}"
        corps = f"""{fil_html}
<div class="conteneur">
  <div class="pub pub-banniere" role="complementary" aria-label="Publicité">Publicité</div>
  <header class="section" style="padding-bottom:1rem">
    <h1>{e(h1)}{suffixe}</h1>
    <p class="chapo lecture">{e(chapo)}</p>
    {sous_html}
  </header>
  <section class="section" style="padding-top:0" aria-label="Articles">
    {grille(lot, ctx, 3, niveau=2) if lot else '<p>Aucun article publié dans cette rubrique pour le moment.</p>'}
    {pagination(numero, total, chemin, ctx)}
  </section>
</div>
<div class="section section-alt"><div class="conteneur lecture">{bloc_newsletter(ctx, 'rubrique')}</div></div>"""

        ld_liste = {"@context": "https://schema.org", "@type": "CollectionPage",
                    "name": h1, "description": chapo, "inLanguage": "fr-FR"}
        pages_html.append((chemin_page, page(
            ctx, titre=(titre + suffixe)[:70], description=(description or chapo)[:150],
            chemin=chemin_page, corps=corps, profondeur=prof,
            noindex=(numero > 1), structure=jsonld(ld_liste, fil_ld))))
    return pages_html


# --------------------------------------------------------------------------
# Pages auteurs (§ 4.3.5)
# --------------------------------------------------------------------------

def construire_auteur(auteur: dict, ctx: dict) -> str:
    ctx["base"] = prefixe(2)
    b = ctx["base"]
    cfg = ctx["cfg"]
    articles = [a for a in ctx["articles"] if a["auteur"] == auteur["slug"]]
    ctx["chemin_courant"] = f'auteurs/{auteur["slug"]}/'
    fil_html, fil_ld = fil_ariane(
        [("Accueil", ""), ("Nos auteurs", "auteurs/"), (auteur["nom"], None)], ctx)
    reseaux = " · ".join(
        f'<a href="{e(url)}" target="_blank" rel="noopener me">{nom.capitalize()}</a>'
        for nom, url in auteur.get("reseaux", {}).items())

    ld = {"@context": "https://schema.org", "@type": "Person", "name": auteur["nom"],
          "jobTitle": auteur["fonction"], "description": auteur["bio"],
          "url": cfg["base_url"].rstrip("/") + f'/auteurs/{auteur["slug"]}/',
          "knowsAbout": auteur["expertises"],
          "worksFor": {"@type": "Organization", "name": cfg["marque"]},
          "sameAs": [u for u in auteur.get("reseaux", {}).values() if "[" not in u]}

    corps = f"""{fil_html}
<div class="conteneur">
  <header class="entete-auteur">
    <div class="portrait">{visuel_auteur(auteur, ctx, 320)}</div>
    <div>
      <h1>{e(auteur['nom'])}</h1>
      <p class="chapo">{e(auteur['fonction'])} · {e(', '.join(auteur['expertises']))}</p>
      <p>{e(auteur['bio'])}</p>
      <p>{reseaux}{' · ' if reseaux else ''}<a href="{b}contact/">Contacter la rédaction</a></p>
    </div>
  </header>
  <section class="section" aria-labelledby="ses-articles">
    <div class="entete-section"><h2 id="ses-articles">
      {len(articles)} article{'s' if len(articles) > 1 else ''} signé{'s' if len(articles) > 1 else ''}</h2></div>
    {grille(articles, ctx, 3)}
  </section>
</div>"""
    return page(ctx, titre=f'{auteur["nom"]} — {auteur["fonction"]}',
                description=auteur["bio_courte"][:150],
                chemin=f'auteurs/{auteur["slug"]}/', corps=corps, profondeur=2,
                og_type="profile", structure=jsonld(ld, fil_ld))


def construire_liste_auteurs(ctx: dict) -> str:
    ctx["base"] = prefixe(1)
    b = ctx["base"]
    ctx["chemin_courant"] = "auteurs/"
    fil_html, fil_ld = fil_ariane([("Accueil", ""), ("Nos auteurs", None)], ctx)
    cartes = []
    for a in ctx["auteurs"].values():
        n = len([x for x in ctx["articles"] if x["auteur"] == a["slug"]])
        cartes.append(f"""<article class="carte">
  <div class="portrait" style="max-width:9rem">{visuel_auteur(a, ctx)}</div>
  <h2 class="carte-titre"><a href="{b}auteurs/{a['slug']}/">{e(a['nom'])}</a></h2>
  <p class="carte-meta">{e(a['fonction'])} · {n} article{'s' if n > 1 else ''}</p>
  <p class="carte-chapo">{e(a['bio_courte'])}</p>
</article>""")
    corps = f"""{fil_html}
<div class="conteneur">
  <header class="section" style="padding-bottom:0">
    <h1>Nos auteurs</h1>
    <p class="chapo lecture">Chaque contenu est signé. Nos journalistes indiquent leur fonction,
    leurs domaines d'expertise et leurs moyens de contact : c'est la condition pour que vous puissiez
    juger de la valeur de ce que vous lisez.</p>
  </header>
  <section class="section"><div class="grille grille-3">{''.join(cartes)}</div></section>
</div>"""
    return page(ctx, titre="Nos auteurs — qui écrit sur ce site",
                description="Les journalistes qui signent nos guides d'achat et nos décryptages : fonction, expertise et articles.",
                chemin="auteurs/", corps=corps, profondeur=1, structure=jsonld(fil_ld))


# --------------------------------------------------------------------------
# Pages de service (§ 4.3.6), recherche (§ 4.4), 404, redirections affiliées
# --------------------------------------------------------------------------

def formulaire_contact(ctx: dict) -> str:
    b = ctx["base"]
    return f"""<form class="formulaire-newsletter" method="post" action="#" novalidate
      aria-describedby="contact-rgpd" style="max-width:34rem">
  <p><label for="c-nom">Nom et prénom *</label>
     <input class="champ" id="c-nom" name="nom" required autocomplete="name"></p>
  <p><label for="c-mail">Adresse électronique *</label>
     <input class="champ" id="c-mail" name="email" type="email" required autocomplete="email"></p>
  <p><label for="c-objet">Objet *</label>
     <select class="champ" id="c-objet" name="objet" required>
       <option value="">Choisir…</option>
       <option>Signaler une erreur dans un article</option>
       <option>Droit de réponse</option>
       <option>Partenariat ou publicité</option>
       <option>Demande presse</option>
       <option>Exercice de mes droits (données personnelles)</option>
       <option>Autre</option>
     </select></p>
  <p><label for="c-message">Message *</label>
     <textarea class="champ" id="c-message" name="message" rows="7" required></textarea></p>
  <p style="position:absolute;left:-9999px" aria-hidden="true">
     <label for="c-site">Ne pas remplir</label>
     <input id="c-site" name="site" tabindex="-1" autocomplete="off"></p>
  <label class="consentement" style="color:var(--encre-douce)">
    <input type="checkbox" name="consentement" required value="oui">
    <span id="contact-rgpd">J'accepte que ces informations soient utilisées pour traiter ma demande.
    Elles sont conservées 12 mois après le dernier échange et ne sont jamais cédées
    (<a href="{b}politique-de-confidentialite/">politique de confidentialité</a>). *</span>
  </label>
  <p><button type="submit" class="bouton">Envoyer</button></p>
  <p class="carte-meta">* Champs obligatoires. Protection anti-robot par champ masqué : aucun CAPTCHA
  intrusif, conformément au cahier des charges (§ 4.3.6).</p>
</form>"""


def bloc_cookies(ctx: dict) -> str:
    return """<div class="complement">
  <h2>Modifier mon choix</h2>
  <p>Le panneau ci-dessous reprend votre choix actuel. Vous pouvez le modifier ou le retirer
  entièrement : le site continuera de fonctionner.</p>
  <p><button type="button" class="bouton" data-ouvrir-cmp>Ouvrir le panneau de consentement</button></p>
</div>"""


def bloc_plan(ctx: dict) -> str:
    b = ctx["base"]
    parties = []
    liens_t = "".join(f'<li><a href="{b}{t["slug"]}/">{e(t["nom"])}</a></li>' for t in ctx["transverses"])
    parties.append(f"<h2>Rubriques transverses</h2><ul>{liens_t}</ul>")
    for r in ctx["rubriques"]:
        sous = "".join(
            f'<li><a href="{b}{r["slug"]}/{s["slug"]}/">{e(s["nom"])}</a></li>' for s in r["sous"])
        arts = "".join(
            f'<li><a href="{b}{a["url"]}">{e(a["titre"])}</a></li>'
            for a in ctx["articles"] if a["rubrique"] == r["slug"])
        parties.append(f'<h2><a href="{b}{r["slug"]}/">{e(r["nom"])}</a></h2>'
                       + (f"<h3>Sous-rubriques</h3><ul>{sous}</ul>" if sous else "")
                       + (f"<h3>Articles</h3><ul>{arts}</ul>" if arts else ""))
    auteurs = "".join(
        f'<li><a href="{b}auteurs/{a["slug"]}/">{e(a["nom"])}</a></li>' for a in ctx["auteurs"].values())
    parties.append(f'<h2><a href="{b}auteurs/">Auteurs</a></h2><ul>{auteurs}</ul>')
    services = "".join(
        f'<li><a href="{b}{p["slug"]}/">{e(p["titre"])}</a></li>'
        for p in sorted(ctx["pages"], key=lambda x: x.get("ordre", 99)))
    parties.append(f"<h2>Pages de service</h2><ul>{services}</ul>")
    return "".join(parties)


def construire_page_service(p: dict, ctx: dict) -> str:
    ctx["base"] = prefixe(1)
    ctx["fichier"] = p["fichier"]
    ctx["chemin_courant"] = f'{p["slug"]}/'
    corps_html, faq = rendre_corps(p["corps"], ctx)
    fil_html, fil_ld = fil_ariane([("Accueil", ""), (p["titre"], None)], ctx)

    supplement = ""
    if p.get("gabarit") == "contact":
        supplement = formulaire_contact(ctx)
    elif p.get("gabarit") == "cookies":
        supplement = bloc_cookies(ctx)
    elif p.get("gabarit") == "plan":
        supplement = bloc_plan(ctx)

    corps = f"""{fil_html}
<div class="conteneur">
  <article class="section lecture">
    <h1>{e(p['titre'])}</h1>
    <p class="chapo">{e(p.get('chapo', ''))}</p>
    <div class="corps">{corps_html}{supplement}</div>
  </article>
</div>"""
    return page(ctx, titre=f'{p["titre"]} — {ctx["cfg"]["marque"]}',
                description=p.get("meta_description", p.get("chapo", ""))[:150],
                chemin=f'{p["slug"]}/', corps=corps, profondeur=1,
                noindex=bool(p.get("noindex")), structure=jsonld(fil_ld))


def construire_recherche(ctx: dict) -> str:
    ctx["base"] = prefixe(1)
    ctx["chemin_courant"] = "recherche/"
    fil_html, _ = fil_ariane([("Accueil", ""), ("Recherche", None)], ctx)
    corps = f"""{fil_html}
<div class="conteneur">
  <section class="section lecture" data-page-recherche>
    <h1>Rechercher</h1>
    <form role="search">
      <p><label for="q">Votre recherche</label>
      <input class="champ" id="q" type="search" name="q" autocomplete="off"
             placeholder="aspirateur, gourde, indice de durabilité…"></p>
      <p><button class="bouton" type="submit">Rechercher</button></p>
    </form>
    <p class="carte-meta" data-compteur role="status"></p>
    <div class="grille grille-2" data-resultats></div>
  </section>
</div>"""
    # Page de résultats en noindex (§ 4.4)
    return page(ctx, titre="Rechercher sur le site", description="Rechercher un guide d'achat, un comparatif ou un conseil.",
                chemin="recherche/", corps=corps, profondeur=1, noindex=True)


def construire_404(ctx: dict) -> str:
    ctx["base"] = ""
    suggestions = grille(ctx["articles"][:4], ctx, 4, avec_chapo=False)
    corps = f"""<div class="conteneur">
  <section class="section lecture">
    <h1>Cette page n'existe pas (ou plus)</h1>
    <p class="chapo">L'adresse demandée est introuvable. Elle a peut-être changé, ou comporte
    une faute de frappe.</p>
    <form role="search" action="recherche/" method="get">
      <p><label for="q404">Rechercher sur le site</label>
      <input class="champ" id="q404" type="search" name="q" placeholder="Que cherchiez-vous ?"></p>
      <p><button class="bouton" type="submit">Rechercher</button>
      <a class="bouton bouton-secondaire" href="plan-du-site/">Voir le plan du site</a></p>
    </form>
  </section>
  <section class="section">
    <div class="entete-section"><h2>Nos derniers contenus</h2></div>
    {suggestions}
  </section>
</div>"""
    return page(ctx, titre="Page introuvable (404)", description="La page demandée est introuvable.",
                chemin="404.html", corps=corps, profondeur=0, noindex=True)


def construire_redirection_affiliee(produit: dict, ctx: dict) -> str:
    """Page de redirection sortante /go/{slug}/ (§ 4.6).

    En production, cette page est remplacée par une redirection 302 côté
    serveur ; la version statique conserve le même contrat : noindex,
    rel=\"sponsored nofollow noopener\", événement de mesure, et information
    de l'utilisateur avant le départ."""
    cfg = ctx["cfg"]
    ctx["base"] = prefixe(2)
    url = produit["url_affiliee"]
    return f"""<!doctype html>
<html lang="fr" data-base="{ctx['base']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redirection vers {e(produit.get('marchand', 'le marchand'))}…</title>
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="1;url={e(url)}">
<link rel="stylesheet" href="{ctx['base']}assets/style.css">
</head>
<body>
<main id="contenu"><div class="conteneur section lecture">
<h1>Redirection en cours…</h1>
<p>Vous allez être dirigé vers <strong>{e(produit.get('marchand', 'le marchand'))}</strong>
pour le produit <strong>{e(produit['nom'])}</strong>.</p>
<p class="mention-affiliation"><span>{e(cfg['affiliation']['mention'])}</span></p>
<p><a class="bouton" href="{e(url)}" rel="{e(cfg['affiliation']['rel'])}">
Continuer vers {e(produit.get('marchand', 'le marchand'))}</a></p>
<p><a href="{ctx['base']}">Retour à l'accueil</a></p>
</div></main>
<script>
(function(){{
  try {{
    var brut = window.localStorage.getItem("consentement.v1");
    var ok = brut && JSON.parse(brut).choix && JSON.parse(brut).choix.mesure;
    if (ok) {{
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({{ evenement: "clic_affilie_sortant", produit: "{e(produit['slug'])}",
        marchand: "{e(produit.get('marchand', ''))}" }});
    }}
  }} catch (e) {{}}
  location.replace({json.dumps(url)});
}})();
</script>
</body>
</html>"""


# --------------------------------------------------------------------------
# Chargement des contenus
# --------------------------------------------------------------------------

def charger(ctx: dict) -> None:
    cfg = json.loads((SOURCE / "config.json").read_text(encoding="utf-8"))
    ctx["cfg"] = cfg
    ctx["prefixe_go"] = cfg["affiliation"]["prefixe_redirection"]
    ctx["rel_affilie"] = cfg["affiliation"]["rel"]

    arbre = json.loads((CONTENU / "rubriques.json").read_text(encoding="utf-8"))
    ctx["transverses"] = arbre["transverses"]
    ctx["transverses_par_slug"] = {t["slug"]: t for t in arbre["transverses"]}
    ctx["rubriques"] = arbre["rubriques"]
    for r in ctx["rubriques"]:
        for s in r["sous"]:
            s["url"] = f'{r["slug"]}/{s["slug"]}/'

    ctx["auteurs"] = {a["slug"]: a
                      for a in json.loads((CONTENU / "auteurs.json").read_text(encoding="utf-8"))["auteurs"]}
    ctx["produits"] = {p["slug"]: p
                       for p in json.loads((CONTENU / "produits.json").read_text(encoding="utf-8"))["produits"]}

    rubriques_par_slug = {r["slug"]: r for r in ctx["rubriques"]}

    articles = []
    for fichier in sorted((CONTENU / "articles").glob("*.md")):
        champs, corps = lire_entete(fichier)
        champs["fichier"] = fichier.name
        champs["slug"] = champs.get("slug") or fichier.stem
        champs["corps"] = corps
        champs["temps_lecture"] = temps_lecture(corps)

        if not champs.get("image_alt", "").strip():
            refuser(f"{fichier.name} : image de couverture sans alternative textuelle "
                    "— publication bloquée (§ 6.5).")
        if champs.get("auteur") not in ctx["auteurs"]:
            refuser(f'{fichier.name} : auteur « {champs.get("auteur")} » inconnu '
                    "— la signature est obligatoire (§ 5).")
        rub = rubriques_par_slug.get(champs.get("rubrique"))
        if not rub:
            refuser(f'{fichier.name} : rubrique « {champs.get("rubrique")} » absente de rubriques.json.')
            continue
        champs["rubrique_nom"] = rub["nom"]
        if champs.get("sous_rubrique"):
            sous = next((s for s in rub["sous"] if s["slug"] == champs["sous_rubrique"]), None)
            if not sous:
                refuser(f'{fichier.name} : sous-rubrique « {champs["sous_rubrique"]} » '
                        f'absente de la rubrique {rub["slug"]}.')
                champs["sous_rubrique"] = None
            else:
                champs["sous_rubrique_nom"] = sous["nom"]
        if not champs.get("meta_description"):
            avertir(f"{fichier.name} : meta description absente, le chapô est utilisé par défaut.")

        if cfg["urls_avec_rubrique"]:
            champs["url"] = f'{champs["rubrique"]}/{champs["slug"]}/'
            champs["profondeur"] = 2
        else:
            champs["url"] = f'{champs["slug"]}/'
            champs["profondeur"] = 1
        articles.append(champs)

    articles.sort(key=lambda a: (a.get("maj_le") or a["publie_le"], a["publie_le"]), reverse=True)
    ctx["articles"] = articles

    pages = []
    for fichier in sorted((CONTENU / "pages").glob("*.md")):
        champs, corps = lire_entete(fichier)
        champs["fichier"] = fichier.name
        champs["slug"] = champs.get("slug") or fichier.stem
        champs["corps"] = corps
        pages.append(champs)
    ctx["pages"] = pages

    # Collisions de slugs entre pages, rubriques et articles
    occupes: dict[str, str] = {}
    for r in ctx["transverses"] + ctx["rubriques"]:
        occupes[r["slug"]] = "rubrique"
    for p in pages:
        if p["slug"] in occupes:
            refuser(f'Collision de slug « {p["slug"]} » entre une page de service et une {occupes[p["slug"]]}.')
        occupes[p["slug"]] = "page"
    for reserve in ("auteurs", "recherche", ctx["prefixe_go"], "medias", "assets"):
        if reserve in occupes:
            refuser(f'Le slug « {reserve} » est réservé par le générateur.')


# --------------------------------------------------------------------------
# Fichiers techniques : médias, sitemaps, flux, robots, redirections
# --------------------------------------------------------------------------

def ecrire(chemin: Path, contenu: str) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(contenu, encoding="utf-8")


def svg_portrait(nom: str, taille: int = 400) -> str:
    h = hashlib.sha256(nom.encode("utf-8")).digest()
    fond, motif = PALETTES[h[0] % len(PALETTES)]
    initiales = "".join(m[0] for m in nom.split()[:2]).upper()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {taille} {taille}" role="img" aria-hidden="true">
<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{fond}"/><stop offset="1" stop-color="{motif}"/></linearGradient></defs>
<rect width="{taille}" height="{taille}" fill="url(#p)"/>
<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif"
 font-size="{taille * 0.4:.0f}" fill="#fff" opacity=".92">{e(initiales)}</text></svg>"""


def generer_medias(ctx: dict, sortie: Path) -> None:
    cfg = ctx["cfg"]
    for a in ctx["articles"]:
        ecrire(sortie / "medias" / f'{a["slug"]}.svg', svg_illustration(a["slug"], a["titre"]))
    for p in ctx["produits"].values():
        ecrire(sortie / "medias" / "produits" / f'{p["slug"]}.svg',
               svg_illustration(p["slug"], p["nom"], 600, 600))
    for auteur in ctx["auteurs"].values():
        ecrire(sortie / "medias" / "auteurs" / f'{auteur["slug"]}.svg', svg_portrait(auteur["nom"]))
    ecrire(sortie / "medias" / "logo.svg",
           logo_svg(cfg).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1))
    ecrire(sortie / "medias" / "favicon.svg",
           f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
           f'<rect width="32" height="32" rx="8" fill="{cfg["couleurs"]["primaire"]}"/>'
           f'<path d="M9 17l4.5 4.5L23 12" fill="none" stroke="#fff" stroke-width="3.4" '
           f'stroke-linecap="round" stroke-linejoin="round"/></svg>')
    # Image de partage par défaut (§ 6.4 : générée si non renseignée)
    ecrire(sortie / "medias" / "partage-defaut.svg", f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="{cfg['couleurs']['primaire']}"/>
<circle cx="1050" cy="120" r="230" fill="#fff" opacity=".08"/>
<circle cx="150" cy="560" r="180" fill="#fff" opacity=".07"/>
<text x="80" y="300" font-family="Georgia, serif" font-size="86" font-weight="700" fill="#fff">{e(cfg['marque'])}</text>
<text x="80" y="380" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="#D8E2F6">{e(cfg['baseline'])}</text>
</svg>""")


def generer_sitemaps(ctx: dict, sortie: Path, urls: dict) -> None:
    cfg = ctx["cfg"]
    racine_url = cfg["base_url"].rstrip("/") + "/"
    # Date de référence des pages de listing : la dernière publication, et non
    # la date du jour — la sortie générée reste ainsi identique d'un build à
    # l'autre tant que les contenus n'ont pas changé.
    aujourd = max((a.get("maj_le") or a["publie_le"]) for a in ctx["articles"])

    def bloc(liste):
        corps = "".join(
            f"<url><loc>{racine_url}{u}</loc><lastmod>{d}</lastmod>"
            f"<changefreq>{f}</changefreq><priority>{p}</priority></url>"
            for u, d, f, p in liste)
        return ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                + corps + "</urlset>")

    articles = [(a["url"], a.get("maj_le") or a["publie_le"], "monthly", "0.8") for a in ctx["articles"]]
    rubriques = [("", aujourd, "daily", "1.0")]
    rubriques += [(f'{t["slug"]}/', aujourd, "weekly", "0.7") for t in ctx["transverses"]]
    for r in ctx["rubriques"]:
        rubriques.append((f'{r["slug"]}/', aujourd, "weekly", "0.7"))
        rubriques += [(f'{r["slug"]}/{s["slug"]}/', aujourd, "weekly", "0.6") for s in r["sous"]]
    auteurs = [("auteurs/", aujourd, "monthly", "0.5")]
    auteurs += [(f'auteurs/{a}/', aujourd, "monthly", "0.5") for a in ctx["auteurs"]]
    pages = [(f'{p["slug"]}/', aujourd, "yearly", "0.3") for p in ctx["pages"] if not p.get("noindex")]

    ecrire(sortie / "sitemap-articles.xml", bloc(articles))
    ecrire(sortie / "sitemap-rubriques.xml", bloc(rubriques))
    ecrire(sortie / "sitemap-auteurs.xml", bloc(auteurs))
    ecrire(sortie / "sitemap-pages.xml", bloc(pages))
    index = "".join(
        f"<sitemap><loc>{racine_url}{n}</loc><lastmod>{aujourd}</lastmod></sitemap>"
        for n in ("sitemap-articles.xml", "sitemap-rubriques.xml",
                  "sitemap-auteurs.xml", "sitemap-pages.xml"))
    ecrire(sortie / "sitemap.xml",
           '<?xml version="1.0" encoding="UTF-8"?>\n'
           '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
           + index + "</sitemapindex>")


def generer_flux(ctx: dict, sortie: Path) -> None:
    cfg = ctx["cfg"]
    racine_url = cfg["base_url"].rstrip("/") + "/"
    items = []
    for a in ctx["articles"][:20]:
        d = datetime.strptime(a.get("maj_le") or a["publie_le"], "%Y-%m-%d")
        items.append(
            "<item>"
            f"<title>{e(a['titre'])}</title>"
            f"<link>{racine_url}{a['url']}</link>"
            f"<guid isPermaLink=\"true\">{racine_url}{a['url']}</guid>"
            f"<pubDate>{d.strftime('%a, %d %b %Y')} 08:00:00 +0200</pubDate>"
            f"<dc:creator>{e(ctx['auteurs'][a['auteur']]['nom'])}</dc:creator>"
            f"<category>{e(a['rubrique_nom'])}</category>"
            f"<description>{e(a['chapo'])}</description>"
            "</item>")
    ecrire(sortie / "flux.xml",
           '<?xml version="1.0" encoding="UTF-8"?>\n'
           '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>'
           f"<title>{e(cfg['marque'])}</title><link>{racine_url}</link>"
           f"<description>{e(cfg['promesse'])}</description><language>fr-FR</language>"
           + "".join(items) + "</channel></rss>")


def generer_robots(ctx: dict, sortie: Path) -> None:
    cfg = ctx["cfg"]
    racine_url = cfg["base_url"].rstrip("/") + "/"
    chemin = "/" + racine_url.split("/", 3)[-1] if racine_url.count("/") > 3 else "/"
    ecrire(sortie / "robots.txt", f"""# {cfg['marque']}
User-agent: *
Allow: /
# Pages sans valeur d'indexation (§ 4.4 et § 4.6)
Disallow: {chemin}recherche/
Disallow: {chemin}{ctx['prefixe_go']}/
Disallow: *?q=

Sitemap: {racine_url}sitemap.xml
""")


def generer_index_recherche(ctx: dict, sortie: Path) -> None:
    """Index JSON de la recherche interne (§ 4.4) : titres, chapôs,
    taxonomies et mots-clés."""
    documents = []
    for a in ctx["articles"]:
        documents.append({
            "t": a["titre"], "c": a["chapo"], "u": "../" + a["url"],
            "r": a["rubrique_nom"], "k": " ".join(a.get("mots_cles", [])),
            "x": re.sub(r"\s+", " ", re.sub(r"[#>*`\[\]()|:-]", " ", a["corps"]))[:1200],
        })
    for p in ctx["pages"]:
        documents.append({
            "t": p["titre"], "c": p.get("chapo", ""), "u": f'../{p["slug"]}/',
            "r": "Le site", "k": "", "x": p["corps"][:600],
        })
    ecrire(sortie / "recherche" / "index.json",
           json.dumps(documents, ensure_ascii=False, separators=(",", ":")))


def generer_redirections(ctx: dict, sortie: Path, urls_actuelles: dict) -> list:
    """Redirections 301 automatiques en cas de changement de slug (§ 4.1).

    L'empreinte des URLs du build précédent est conservée dans
    `.urls.json` : toute URL disparue est redirigée vers la nouvelle."""
    memoire = sortie / ".urls.json"
    anciennes = {}
    if memoire.exists():
        try:
            anciennes = json.loads(memoire.read_text(encoding="utf-8"))
        except ValueError:
            anciennes = {}

    manuelles = []
    fichier_manuel = CONTENU / "redirections.json"
    if fichier_manuel.exists():
        manuelles = json.loads(fichier_manuel.read_text(encoding="utf-8")).get("redirections", [])

    regles = list(manuelles)
    for identifiant, ancienne in anciennes.items():
        nouvelle = urls_actuelles.get(identifiant)
        if nouvelle and nouvelle != ancienne:
            regles.append({"de": ancienne, "vers": nouvelle, "motif": "changement de slug"})

    racine_url = ctx["cfg"]["base_url"].rstrip("/") + "/"
    for regle in regles:
        cible = racine_url + regle["vers"].lstrip("/")
        profondeur = regle["de"].strip("/").count("/") + 1
        ecrire(sortie / regle["de"].strip("/") / "index.html", f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Page déplacée</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{cible}">
<meta http-equiv="refresh" content="0;url={cible}">
</head><body><p>Cette page a été déplacée : <a href="{cible}">{cible}</a>.</p>
<script>location.replace({json.dumps(cible)});</script></body></html>""")

    ecrire(memoire, json.dumps(urls_actuelles, ensure_ascii=False, indent=1))
    ecrire(sortie / "redirections.json",
           json.dumps({"_lisez_moi": "Plan de redirections 301. En production, ces règles sont "
                                     "appliquées côté serveur (voir redirections.conf) ; la version "
                                     "statique publie des pages de redirection équivalentes.",
                       "redirections": regles}, ensure_ascii=False, indent=2))
    lignes_nginx = "\n".join(
        f'rewrite ^/{r["de"].strip("/")}/?$ /{r["vers"].strip("/")}/ permanent;' for r in regles)
    lignes_apache = "\n".join(
        f'Redirect 301 /{r["de"].strip("/")}/ /{r["vers"].strip("/")}/' for r in regles)
    ecrire(sortie / "redirections.conf",
           "# Règles générées automatiquement — à inclure dans la configuration du serveur.\n"
           "# nginx :\n" + (lignes_nginx or "# (aucune)") +
           "\n\n# Apache :\n" + (lignes_apache or "# (aucune)") + "\n")
    return regles


# --------------------------------------------------------------------------
# Budget de performance (§ 6.3) : poids et nombre de requêtes par page
# --------------------------------------------------------------------------

def controler_budget(ctx: dict, sortie: Path) -> list:
    cfg = ctx["cfg"]
    assets = sortie / "assets"
    poids_fixe = sum(f.stat().st_size for f in assets.glob("*") if f.is_file())
    requetes_fixes = len([f for f in assets.glob("*") if f.is_file()])
    rapport = []
    for fichier in sorted(sortie.rglob("*.html")):
        contenu = fichier.read_text(encoding="utf-8")
        images = set(re.findall(r'src="([^"]+\.svg)"', contenu))
        poids_images = 0
        for src in images:
            cible = (fichier.parent / src).resolve()
            if cible.exists():
                poids_images += cible.stat().st_size
        total = fichier.stat().st_size + poids_fixe + poids_images
        requetes = 1 + requetes_fixes + len(images)
        rapport.append((str(fichier.relative_to(sortie)), total, requetes))
        if total > cfg["budget_page_ko"] * 1024:
            avertir(f"Budget de poids dépassé ({total // 1024} Ko > {cfg['budget_page_ko']} Ko) : "
                    f"{fichier.relative_to(sortie)}")
        if requetes > cfg["budget_requetes"]:
            avertir(f"Budget de requêtes dépassé ({requetes} > {cfg['budget_requetes']}) : "
                    f"{fichier.relative_to(sortie)}")
    return sorted(rapport, key=lambda x: -x[1])


# --------------------------------------------------------------------------
# Programme principal
# --------------------------------------------------------------------------

def main() -> int:
    analyseur = argparse.ArgumentParser(description="Génère le site éditorial.")
    analyseur.add_argument("--strict", action="store_true",
                           help="Traite les avertissements comme des erreurs (recette, § 10).")
    analyseur.add_argument("--sortie", help="Dossier de sortie (défaut : celui de config.json).")
    options = analyseur.parse_args()

    ctx: dict = {"base": ""}
    charger(ctx)
    cfg = ctx["cfg"]
    sortie = RACINE / (options.sortie or cfg["dossier_sortie"])

    if erreurs:
        for m in erreurs:
            print(f"  ERREUR   {m}")
        print("\nPublication bloquée : corrigez les anomalies ci-dessus.")
        return 1

    memoire = sortie / ".urls.json"
    anciennes_urls = memoire.read_bytes() if memoire.exists() else None
    if sortie.exists():
        shutil.rmtree(sortie)
    sortie.mkdir(parents=True)
    if anciennes_urls:
        memoire.write_bytes(anciennes_urls)

    # Fichiers statiques partagés
    (sortie / "assets").mkdir(parents=True, exist_ok=True)
    for nom in ("style.css", "site.js", "consentement.js"):
        shutil.copy2(SOURCE / "design" / nom, sortie / "assets" / nom)
    (sortie / ".nojekyll").write_text("", encoding="utf-8")

    generer_medias(ctx, sortie)

    pages_ecrites = 0

    # Accueil
    ecrire(sortie / "index.html", construire_accueil(ctx))
    pages_ecrites += 1

    # Articles
    for a in ctx["articles"]:
        ecrire(sortie / a["url"] / "index.html", construire_article(a, ctx))
        pages_ecrites += 1

    # Rubriques et sous-rubriques
    for r in ctx["rubriques"]:
        arts = [a for a in ctx["articles"] if a["rubrique"] == r["slug"]]
        for chemin, contenu in construire_listing(
                ctx, titre=f'{r["nom"]} — {cfg["marque"]}', h1=r.get("titre", r["nom"]),
                chapo=r["chapo"], articles=arts, chemin=f'{r["slug"]}/', profondeur=1,
                sous_rubriques=r["sous"],
                fil=[("Accueil", ""), (r["nom"], None)]):
            ecrire(sortie / chemin / "index.html", contenu)
            pages_ecrites += 1
        for s in r["sous"]:
            sous_arts = [a for a in arts if a.get("sous_rubrique") == s["slug"]]
            for chemin, contenu in construire_listing(
                    ctx, titre=f'{s["nom"]} — {r["nom"]}', h1=f'{s["nom"]} · {r["nom"]}',
                    chapo=s["chapo"], articles=sous_arts, chemin=s["url"], profondeur=2,
                    fil=[("Accueil", ""), (r["nom"], f'{r["slug"]}/'), (s["nom"], None)]):
                ecrire(sortie / chemin / "index.html", contenu)
                pages_ecrites += 1

    # Rubriques transverses (§ 1.3)
    for t in ctx["transverses"]:
        arts = [a for a in ctx["articles"] if t["slug"] in a.get("transverses", [])]
        for chemin, contenu in construire_listing(
                ctx, titre=f'{t["nom"]} — {cfg["marque"]}', h1=t.get("titre", t["nom"]),
                chapo=t["chapo"], articles=arts, chemin=f'{t["slug"]}/', profondeur=1,
                fil=[("Accueil", ""), (t["nom"], None)]):
            ecrire(sortie / chemin / "index.html", contenu)
            pages_ecrites += 1

    # Auteurs
    ecrire(sortie / "auteurs" / "index.html", construire_liste_auteurs(ctx))
    pages_ecrites += 1
    for auteur in ctx["auteurs"].values():
        ecrire(sortie / "auteurs" / auteur["slug"] / "index.html", construire_auteur(auteur, ctx))
        pages_ecrites += 1

    # Pages de service, recherche, 404
    for p in ctx["pages"]:
        ecrire(sortie / p["slug"] / "index.html", construire_page_service(p, ctx))
        pages_ecrites += 1
    ecrire(sortie / "recherche" / "index.html", construire_recherche(ctx))
    ecrire(sortie / "404.html", construire_404(ctx))
    pages_ecrites += 2

    # Redirections de liens marchands (§ 4.6)
    produits_utilises = set()
    for a in ctx["articles"]:
        produits_utilises.update(a.get("produits", []) or [])
    for slug in sorted(produits_utilises | set(ctx["produits"])):
        produit = ctx["produits"][slug]
        ecrire(sortie / ctx["prefixe_go"] / slug / "index.html",
               construire_redirection_affiliee(produit, ctx))

    generer_index_recherche(ctx, sortie)
    generer_sitemaps(ctx, sortie, {})
    generer_flux(ctx, sortie)
    generer_robots(ctx, sortie)
    urls_actuelles = {a["fichier"]: a["url"] for a in ctx["articles"]}
    urls_actuelles.update({f'page:{p["fichier"]}': f'{p["slug"]}/' for p in ctx["pages"]})
    regles = generer_redirections(ctx, sortie, urls_actuelles)

    budget = controler_budget(ctx, sortie)

    # ----------------------------------------------------------------- rapport
    print(f"Site généré dans {sortie.relative_to(RACINE)}/")
    print(f"  {pages_ecrites} pages HTML · {len(ctx['articles'])} articles · "
          f"{len(ctx['rubriques'])} rubriques · {sum(len(r['sous']) for r in ctx['rubriques'])} sous-rubriques · "
          f"{len(ctx['auteurs'])} auteurs · {len(ctx['produits'])} produits")
    if regles:
        print(f"  {len(regles)} redirection(s) 301 générée(s) — voir redirections.conf")
    if budget:
        pire = budget[0]
        print(f"  Page la plus lourde : {pire[0]} — {pire[1] // 1024} Ko, {pire[2]} requêtes "
              f"(budget : {cfg['budget_page_ko']} Ko / {cfg['budget_requetes']} requêtes)")
    total_octets = sum(f.stat().st_size for f in sortie.rglob("*") if f.is_file())
    print(f"  Poids total du site : {total_octets // 1024} Ko")

    if erreurs:
        for m in erreurs:
            print(f"  ERREUR   {m}")
    if avertissements:
        print(f"\n  {len(avertissements)} avertissement(s) :")
        for m in avertissements:
            print(f"    · {m}")

    if erreurs:
        return 1
    if options.strict and avertissements:
        print("\nMode strict : les avertissements bloquent la recette.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
