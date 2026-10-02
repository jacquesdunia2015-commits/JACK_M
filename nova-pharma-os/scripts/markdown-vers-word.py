#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convertit les documents Markdown de NOVA PHARMA OS en fichiers Word.

Le .docx est écrit directement, sans passer par LibreOffice ni par une
bibliothèque à installer : un document Word est une archive ZIP contenant
du XML, et rien de plus. Ce choix a une raison pratique — vous pouvez
relancer ce script sur n'importe quel ordinateur où Python est présent,
sans rien installer, y compris quand les documents auront changé.

Le convertisseur couvre ce que ces documents emploient réellement :
titres, gras, italique, code, liens, listes, citations, tableaux et
filets. Pas le Markdown complet, et c'est volontaire : le reste
n'apparaît pas dans ces textes.

Usage :
    python3 scripts/markdown-vers-word.py [dossier de sortie]
"""
import html
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import sys

RACINE = Path(__file__).resolve().parent.parent

DOCUMENTS = [
    (RACINE / "docs/QUE_FAIRE_AVEC_NOVA_PHARMA_OS.md",
     "Que faire avec NOVA PHARMA OS"),
    (RACINE / "GUIDE_DEMARRAGE.md",
     "NOVA PHARMA OS — Guide de démarrage"),
    (RACINE / "docs/GUIDE_COMMERCIAL.md",
     "NOVA PHARMA OS — Guide commercial"),
]

VERT = "0D5A4A"
VERT_SOMBRE = "14332C"
BORD = "CFE0DA"
ENTETE_FOND = "E8F2EE"
CITATION_FOND = "F4F8F6"
CODE_FOND = "EEF2F0"

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


# ---------------------------------------------------------------------
# Analyse du Markdown : le texte devient une suite de blocs simples.
# ---------------------------------------------------------------------

def morceaux_en_ligne(texte: str) -> list[dict]:
    """Découpe une ligne en fragments porteurs de gras, italique, code ou lien.

    Le code est isolé en premier : son contenu ne doit pas être relu comme
    du Markdown, sinon `**` à l'intérieur d'un extrait deviendrait du gras.
    """
    protege: list[str] = []

    def garder(m):
        protege.append(m.group(1))
        return f"\x00C{len(protege) - 1}\x00"

    texte = re.sub(r"`([^`]+)`", garder, texte)

    liens: list[tuple[str, str]] = []

    def garder_lien(m):
        liens.append((m.group(1), m.group(2)))
        return f"\x00L{len(liens) - 1}\x00"

    texte = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", garder_lien, texte)

    fragments: list[dict] = []
    motif = re.compile(
        r"\*\*(?P<gras>[^*]+)\*\*"
        r"|(?<!\*)\*(?P<italique>[^*\n]+)\*(?!\*)"
        r"|\x00C(?P<code>\d+)\x00"
        r"|\x00L(?P<lien>\d+)\x00"
    )
    position = 0
    for trouve in motif.finditer(texte):
        if trouve.start() > position:
            fragments.append({"texte": texte[position:trouve.start()]})
        if trouve.group("gras"):
            fragments.append({"texte": trouve.group("gras"), "gras": True})
        elif trouve.group("italique"):
            fragments.append({"texte": trouve.group("italique"), "italique": True})
        elif trouve.group("code") is not None:
            fragments.append({"texte": protege[int(trouve.group("code"))], "code": True})
        else:
            libelle, cible = liens[int(trouve.group("lien"))]
            fragments.append({"texte": libelle, "lien": cible})
        position = trouve.end()
    if position < len(texte):
        fragments.append({"texte": texte[position:]})

    # Les marqueurs restants dans du texte ordinaire sont rendus tels quels.
    for fragment in fragments:
        fragment["texte"] = re.sub(
            r"\x00C(\d+)\x00", lambda m: protege[int(m.group(1))], fragment["texte"]
        )
    return [f for f in fragments if f["texte"]]


def cellules(ligne: str) -> list[str]:
    return [c.strip() for c in ligne.strip().strip("|").split("|")]


def analyser(markdown: str) -> list[dict]:
    lignes = markdown.split("\n")
    blocs: list[dict] = []
    i = 0

    while i < len(lignes):
        nu = lignes[i].strip()

        if not nu:
            i += 1
            continue

        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", nu):
            blocs.append({"type": "filet"})
            i += 1
            continue

        titre = re.match(r"^(#{1,6})\s+(.*)$", nu)
        if titre:
            blocs.append({
                "type": "titre",
                "niveau": min(len(titre.group(1)), 3),
                "texte": titre.group(2),
            })
            i += 1
            continue

        if nu.startswith("```"):
            i += 1
            corps = []
            while i < len(lignes) and not lignes[i].strip().startswith("```"):
                corps.append(lignes[i])
                i += 1
            i += 1
            blocs.append({"type": "code", "lignes": corps})
            continue

        if nu.startswith("|") and i + 1 < len(lignes) and re.fullmatch(
            r"\|[\s:|-]+\|", lignes[i + 1].strip()
        ):
            entetes = cellules(nu)
            i += 2
            corps = []
            while i < len(lignes) and lignes[i].strip().startswith("|"):
                corps.append(cellules(lignes[i].strip()))
                i += 1
            blocs.append({"type": "tableau", "entetes": entetes, "lignes": corps})
            continue

        if nu.startswith(">"):
            corps = []
            while i < len(lignes) and lignes[i].strip().startswith(">"):
                corps.append(lignes[i].strip().lstrip(">").strip())
                i += 1
            paragraphes = [p.replace("\n", " ").strip()
                           for p in "\n".join(corps).split("\n\n") if p.strip()]
            blocs.append({"type": "citation", "paragraphes": paragraphes})
            continue

        if re.match(r"^([-*+]|\d+\.)\s+", nu):
            ordonnee = bool(re.match(r"^\d+\.\s", nu))
            elements: list[str] = []
            while i < len(lignes):
                courante = lignes[i]
                debut = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", courante)
                if debut:
                    elements.append(debut.group(2).strip())
                    i += 1
                elif courante.strip() and courante[:1] in " \t" and elements:
                    # Ligne de continuation indentée : elle appartient au
                    # point précédent, pas à un nouveau.
                    elements[-1] += " " + courante.strip()
                    i += 1
                else:
                    break
            blocs.append({"type": "liste", "ordonnee": ordonnee, "elements": elements})
            continue

        corps = []
        while i < len(lignes) and lignes[i].strip() and not re.match(
            r"^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|\||```|-{3,}$)", lignes[i]
        ):
            corps.append(lignes[i].strip())
            i += 1
        if corps:
            blocs.append({"type": "paragraphe", "texte": " ".join(corps)})
        else:
            i += 1

    return blocs


# ---------------------------------------------------------------------
# Écriture du WordprocessingML
# ---------------------------------------------------------------------

class Document:
    def __init__(self) -> None:
        self.corps: list[str] = []
        self.liens: list[str] = []          # cibles externes, une par relation
        self.prochaine_relation = 10

    def relation_lien(self, cible: str) -> str:
        self.liens.append(cible)
        identifiant = f"rId{self.prochaine_relation}"
        self.prochaine_relation += 1
        return identifiant

    def runs(self, fragments: list[dict]) -> str:
        sortie = []
        for f in fragments:
            proprietes = []
            if f.get("gras"):
                proprietes.append("<w:b/>")
            if f.get("italique"):
                proprietes.append("<w:i/>")
            if f.get("code"):
                proprietes.append(
                    '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
                    '<w:sz w:val="19"/>'
                    f'<w:shd w:val="clear" w:fill="{CODE_FOND}"/>'
                )
            if f.get("lien"):
                proprietes.append(f'<w:color w:val="{VERT}"/><w:u w:val="single"/>')
            rpr = f"<w:rPr>{''.join(proprietes)}</w:rPr>" if proprietes else ""
            run = (f"<w:r>{rpr}<w:t xml:space=\"preserve\">"
                   f"{html.escape(f['texte'])}</w:t></w:r>")
            if f.get("lien"):
                identifiant = self.relation_lien(f["lien"])
                run = f'<w:hyperlink r:id="{identifiant}">{run}</w:hyperlink>'
            sortie.append(run)
        return "".join(sortie)

    def paragraphe(self, fragments: list[dict], style: str | None = None,
                   proprietes: str = "") -> str:
        style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""
        ppr = f"<w:pPr>{style_xml}{proprietes}</w:pPr>" if (style_xml or proprietes) else ""
        return f"<w:p>{ppr}{self.runs(fragments)}</w:p>"

    def ajouter(self, bloc: dict) -> None:
        genre = bloc["type"]

        if genre == "titre":
            self.corps.append(
                self.paragraphe(morceaux_en_ligne(bloc["texte"]),
                                f"Titre{bloc['niveau']}")
            )

        elif genre == "paragraphe":
            self.corps.append(self.paragraphe(morceaux_en_ligne(bloc["texte"])))

        elif genre == "filet":
            self.corps.append(
                '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" '
                f'w:space="6" w:color="{BORD}"/></w:pBdr>'
                '<w:spacing w:before="200" w:after="200"/></w:pPr></w:p>'
            )

        elif genre == "liste":
            numero = 2 if bloc["ordonnee"] else 1
            for element in bloc["elements"]:
                self.corps.append(self.paragraphe(
                    morceaux_en_ligne(element),
                    "Liste",
                    f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{numero}"/></w:numPr>',
                ))

        elif genre == "citation":
            for rang, texte in enumerate(bloc["paragraphes"]):
                dernier = rang == len(bloc["paragraphes"]) - 1
                self.corps.append(self.paragraphe(
                    morceaux_en_ligne(texte),
                    "Citation",
                    "" if dernier else '<w:spacing w:after="60"/>',
                ))

        elif genre == "code":
            for ligne in bloc["lignes"]:
                self.corps.append(self.paragraphe(
                    [{"texte": ligne or " ", "code": True}], "Code"
                ))

        elif genre == "tableau":
            self.corps.append(self.tableau(bloc["entetes"], bloc["lignes"]))

    def tableau(self, entetes: list[str], lignes: list[list[str]]) -> str:
        colonnes = max([len(entetes)] + [len(r) for r in lignes]) or 1
        largeur = 9350 // colonnes

        def cellule(contenu: str, entete: bool) -> str:
            fond = (f'<w:shd w:val="clear" w:fill="{ENTETE_FOND}"/>'
                    if entete else "")
            fragments = morceaux_en_ligne(contenu)
            if entete:
                for f in fragments:
                    f["gras"] = True
            corps = self.paragraphe(fragments, "Cellule")
            return (f'<w:tc><w:tcPr><w:tcW w:w="{largeur}" w:type="dxa"/>'
                    f'{fond}</w:tcPr>{corps}</w:tc>')

        def rangee(valeurs: list[str], entete: bool) -> str:
            remplies = valeurs + [""] * (colonnes - len(valeurs))
            entete_xml = '<w:trPr><w:tblHeader/></w:trPr>' if entete else ""
            return ("<w:tr>" + entete_xml
                    + "".join(cellule(v, entete) for v in remplies) + "</w:tr>")

        bordure = (lambda cote: f'<w:{cote} w:val="single" w:sz="4" '
                                f'w:space="0" w:color="{BORD}"/>')
        proprietes = (
            '<w:tblPr><w:tblStyle w:val="Grille"/>'
            '<w:tblW w:w="5000" w:type="pct"/>'
            "<w:tblBorders>"
            + "".join(bordure(c) for c in
                      ("top", "left", "bottom", "right", "insideH", "insideV"))
            + "</w:tblBorders>"
            '<w:tblCellMar>'
            '<w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
            '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/>'
            "</w:tblCellMar></w:tblPr>"
        )
        return ("<w:tbl>" + proprietes + rangee(entetes, True)
                + "".join(rangee(r, False) for r in lignes) + "</w:tbl>"
                # Word colle deux tableaux consécutifs s'ils ne sont pas
                # séparés par un paragraphe.
                + '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>')

    def xml(self) -> str:
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f"<w:document {W} {R}><w:body>"
            + "".join(self.corps)
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
              '<w:pgMar w:top="1250" w:right="1130" w:bottom="1250" '
              'w:left="1130" w:header="708" w:footer="708" w:gutter="0"/>'
              "</w:sectPr></w:body></w:document>"
        )


def styles() -> str:
    def titre(identifiant: str, nom: str, taille: int, couleur: str,
              avant: int, apres: int, filet: bool = False) -> str:
        bordure = ('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" '
                   f'w:color="{BORD}"/></w:pBdr>') if filet else ""
        return (
            f'<w:style w:type="paragraph" w:styleId="{identifiant}">'
            f'<w:name w:val="{nom}"/><w:basedOn w:val="Normal"/>'
            f'<w:pPr><w:keepNext/><w:spacing w:before="{avant}" w:after="{apres}"/>'
            f"{bordure}</w:pPr>"
            f'<w:rPr><w:b/><w:color w:val="{couleur}"/><w:sz w:val="{taille}"/></w:rPr>'
            "</w:style>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f"<w:styles {W}>"
        "<w:docDefaults><w:rPrDefault><w:rPr>"
        '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
        '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="fr-FR"/>'
        "</w:rPr></w:rPrDefault>"
        '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" '
        'w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
        '<w:name w:val="Normal"/></w:style>'
        + titre("Titre1", "heading 1", 40, VERT, 0, 240)
        + titre("Titre2", "heading 2", 30, VERT, 400, 160, filet=True)
        + titre("Titre3", "heading 3", 25, VERT_SOMBRE, 280, 120)
        + '<w:style w:type="paragraph" w:styleId="Liste">'
          '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>'
          '<w:pPr><w:spacing w:after="80"/><w:ind w:left="360"/></w:pPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Citation">'
          '<w:name w:val="Quote"/><w:basedOn w:val="Normal"/>'
          '<w:pPr><w:ind w:left="280"/><w:spacing w:before="120" w:after="140"/>'
          f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="{VERT}"/>'
          "</w:pBdr>"
          f'<w:shd w:val="clear" w:fill="{CITATION_FOND}"/></w:pPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Code">'
          '<w:name w:val="Code"/><w:basedOn w:val="Normal"/>'
          '<w:pPr><w:spacing w:after="0"/></w:pPr>'
          '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
          '<w:sz w:val="19"/></w:rPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Cellule">'
          '<w:name w:val="Cellule"/><w:basedOn w:val="Normal"/>'
          '<w:pPr><w:spacing w:before="20" w:after="20" w:line="240" '
          'w:lineRule="auto"/></w:pPr>'
          '<w:rPr><w:sz w:val="20"/></w:rPr></w:style>'
        + '<w:style w:type="table" w:styleId="Grille">'
          '<w:name w:val="Table Grid"/></w:style>'
        + "</w:styles>"
    )


def numerotation() -> str:
    def definition(identifiant: int, ordonnee: bool) -> str:
        format_ = "decimal" if ordonnee else "bullet"
        texte = "%1." if ordonnee else ""
        police = ('<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr>'
                  if not ordonnee else "")
        marque = "" if ordonnee else '<w:lvlText w:val=""/>'
        return (
            f'<w:abstractNum w:abstractNumId="{identifiant}">'
            '<w:lvl w:ilvl="0"><w:start w:val="1"/>'
            f'<w:numFmt w:val="{format_}"/>'
            + (f'<w:lvlText w:val="{texte}"/>' if ordonnee else marque)
            + '<w:lvlJc w:val="left"/>'
              '<w:pPr><w:ind w:left="502" w:hanging="288"/></w:pPr>'
            + police
            + "</w:lvl></w:abstractNum>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f"<w:numbering {W}>"
        + definition(0, False) + definition(1, True)
        + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
          '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>'
          "</w:numbering>"
    )


def ecrire(chemin: Path, document: Document, titre: str) -> None:
    horodatage = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    relations_document = "".join(
        f'<Relationship Id="rId{10 + rang}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/'
        f'relationships/hyperlink" Target="{html.escape(cible, quote=True)}" '
        'TargetMode="External"/>'
        for rang, cible in enumerate(document.liens)
    )

    fichiers = {
        "[Content_Types].xml":
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            "</Types>",
        "_rels/.rels":
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            "</Relationships>",
        "word/_rels/document.xml.rels":
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
            + relations_document + "</Relationships>",
        "word/document.xml": document.xml(),
        "word/styles.xml": styles(),
        "word/numbering.xml": numerotation(),
        "docProps/core.xml":
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f"<dc:title>{html.escape(titre)}</dc:title>"
            "<dc:creator>NOVA PHARMA OS</dc:creator>"
            "<cp:lastModifiedBy>NOVA PHARMA OS</cp:lastModifiedBy>"
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{horodatage}</dcterms:created>'
            f'<dcterms:modified xsi:type="dcterms:W3CDTF">{horodatage}</dcterms:modified>'
            "</cp:coreProperties>",
        "docProps/app.xml":
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
            "<Application>NOVA PHARMA OS</Application>"
            "</Properties>",
    }

    chemin.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(chemin, "w", zipfile.ZIP_DEFLATED) as archive:
        for nom, contenu in fichiers.items():
            archive.writestr(nom, contenu)


def main() -> int:
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / "docs/word"
    manquants = 0

    for source, titre in DOCUMENTS:
        if not source.exists():
            print(f"  ✗ introuvable : {source}")
            manquants += 1
            continue

        document = Document()
        for bloc in analyser(source.read_text(encoding="utf-8")):
            document.ajouter(bloc)

        cible = destination / (source.stem + ".docx")
        ecrire(cible, document, titre)
        print(f"  ✓ {cible.name}  ({cible.stat().st_size // 1024} Ko)")

    return 1 if manquants else 0


if __name__ == "__main__":
    raise SystemExit(main())
