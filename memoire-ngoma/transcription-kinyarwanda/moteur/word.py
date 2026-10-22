#!/usr/bin/env python3
"""
word.py — transcription en document Word (.docx) modifiable, sans bibliothèque supplémentaire.

Même mise en forme que l’export « Word » de l’éditeur :
  bi  tableau Heure | Locuteur | Kinyarwanda | Français (défaut)
  fr  paragraphes en français (import dans NVivo)
  rw  paragraphes en kinyarwanda

  python word.py transcriptions/P01.json                 → transcriptions/P01_rw-fr.docx
  python word.py P01_transcription.json --contenu fr     → P01_transcription_fr.docx
"""
import argparse
import datetime
import os
import re
import zipfile
from xml.sax.saxutils import escape

LOCUTEURS = {"E": "Enquêteur", "P": "Participant", "A": "Autre"}
COULEUR_LOC = {"E": "6B4FA0", "P": "1F5F99"}
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
INTERDITS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f]")


def heure(s):
    s = int(s or 0)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def run(texte, gras=False, italique=False, sans_correction=False, couleur=None, taille=None):
    pr = (("<w:b/>" if gras else "") + ("<w:i/>" if italique else "") + ("<w:noProof/>" if sans_correction else "")
          + (f'<w:color w:val="{couleur}"/>' if couleur else "")
          + (f'<w:sz w:val="{taille}"/><w:szCs w:val="{taille}"/>' if taille else ""))
    lignes = str(texte or "").replace("\r", "").split("\n")
    return "".join("<w:r>" + (f"<w:rPr>{pr}</w:rPr>" if pr else "") + ("<w:br/>" if i else "")
                   + f'<w:t xml:space="preserve">{escape(INTERDITS.sub("", l))}</w:t></w:r>'
                   for i, l in enumerate(lignes))


def para(runs, apres=None, retrait=None):
    pr = ((f'<w:spacing w:after="{apres}"/>' if apres is not None else "")
          + (f'<w:ind w:left="{retrait}"/>' if retrait else ""))
    return "<w:p>" + (f"<w:pPr>{pr}</w:pPr>" if pr else "") + runs + "</w:p>"


def cellule(paragraphes, largeur, fond=None):
    return (f'<w:tc><w:tcPr><w:tcW w:w="{largeur}" w:type="dxa"/>'
            + (f'<w:shd w:val="clear" w:color="auto" w:fill="{fond}"/>' if fond else "")
            + "</w:tcPr>" + paragraphes + "</w:tc>")


def lignes_entete(projet):
    m, a, mo = projet.get("meta", {}), projet.get("audio", {}), projet.get("moteur") or {}
    l = ["Transcription d’entretien" + (f" — {m['code']}" if m.get("code") else "")]
    if m.get("date"):
        l.append(f"Date de l’entretien : {m['date']}")
    if a.get("duree"):
        l.append(f"Durée de l’enregistrement : {heure(a['duree'])}")
    l.append(("Mode : verbatim nettoyé" if m.get("mode") == "nettoye" else "Mode : verbatim intégral")
             + " · Langue de l’entretien : kinyarwanda · Traduction : français")
    if m.get("transcripteur"):
        l.append(f"Transcrit par : {m['transcripteur']}")
    if m.get("verificateur"):
        l.append(f"Vérifié par : {m['verificateur']}")
    if mo.get("modele"):
        l.append(f"Premier jet automatique : {mo['modele']}"
                 + (f" ; traduction automatique : {mo['traduction']}" if mo.get("traduction") else "")
                 + " — à relire et corriger à l’écoute")
    return l


def document_xml(projet, contenu="bi"):
    segs = [s for s in projet.get("segments", []) if (s.get("texte") or "").strip() or (s.get("traduction") or "").strip()]
    entete = lignes_entete(projet)
    corps = [para(run(entete[0], gras=True, taille=32), apres=120)]
    corps += [para(run(l, couleur="595959", taille=20), apres=0) for l in entete[1:]]
    corps.append(para("", apres=120))

    def revoir(s):
        return run(" [à revoir]", couleur="B5541C", taille=18) if s.get("incertain") else ""

    def qui(s):
        return LOCUTEURS.get(s.get("locuteur"), "?")

    if contenu == "bi":
        L = [1000, 1300, 3385, 3385]
        bord = 'w:val="single" w:sz="4" w:space="0" w:color="A0A7B4"'
        t = ['<w:tbl><w:tblPr><w:tblW w:w="9070" w:type="dxa"/><w:tblBorders>'
             + "".join(f"<w:{c} {bord}/>" for c in ("top", "left", "bottom", "right", "insideH", "insideV"))
             + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/>'
             '<w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>'
             "</w:tblCellMar></w:tblPr>",
             "<w:tblGrid>" + "".join(f'<w:gridCol w:w="{l}"/>' for l in L) + "</w:tblGrid>",
             "<w:tr><w:trPr><w:tblHeader/></w:trPr>"
             + "".join(cellule(para(run(x, gras=True, taille=20), apres=0), L[j], "E8EDF2")
                       for j, x in enumerate(["Heure", "Locuteur", "Kinyarwanda", "Français"])) + "</w:tr>"]
        for s in segs:
            note = para(run("Note : " + s["note"], italique=True, couleur="595959", taille=18), apres=0) if s.get("note") else ""
            t.append("<w:tr><w:trPr><w:cantSplit/></w:trPr>"
                     + cellule(para(run(heure(s.get("debut")), couleur="595959", taille=18), apres=0), L[0])
                     + cellule(para(run(qui(s), gras=True, couleur=COULEUR_LOC.get(s.get("locuteur")), taille=20), apres=0), L[1])
                     + cellule(para(run(s.get("texte"), sans_correction=True, taille=22) + revoir(s), apres=0), L[2])
                     + cellule(para(run(s.get("traduction") or "[traduction manquante]", taille=22), apres=0) + note, L[3])
                     + "</w:tr>")
        t.append("</w:tbl>")
        corps += ["".join(t), para("")]
    else:
        for s in segs:
            texte = (s.get("traduction") or "[traduction manquante]") if contenu == "fr" else s.get("texte")
            corps.append(para(run(f"[{heure(s.get('debut'))}] ", couleur="595959", taille=18)
                              + run(qui(s) + " : ", gras=True, couleur=COULEUR_LOC.get(s.get("locuteur")))
                              + run(texte, sans_correction=contenu == "rw") + revoir(s), apres=0 if s.get("note") else 160))
            if s.get("note"):
                corps.append(para(run("Note : " + s["note"], italique=True, couleur="595959", taille=20), apres=160, retrait=567))
    return (X + f"<w:document {W}><w:body>" + "".join(corps)
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" '
              'w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>')


STYLES = (X + f"<w:styles {W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Times New Roman\" "
          'w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/>'
          '<w:szCs w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>'
          '<w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
          '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
          '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>'
          '<w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar>'
          '<w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/>'
          '<w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>')
TYPES = (X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/>'
         '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
         '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
RELS = (X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
DOC_RELS = (X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')


def ecrire_docx(projet, chemin, contenu="bi"):
    date = datetime.datetime.now().timetuple()[:6]
    with zipfile.ZipFile(chemin, "w", zipfile.ZIP_DEFLATED) as z:
        for nom, texte in (("[Content_Types].xml", TYPES), ("_rels/.rels", RELS), ("word/_rels/document.xml.rels", DOC_RELS),
                           ("word/document.xml", document_xml(projet, contenu)), ("word/styles.xml", STYLES)):
            z.writestr(zipfile.ZipInfo(nom, date), texte.encode("utf-8"), zipfile.ZIP_DEFLATED)
    return chemin


SUFFIXES = {"bi": "_rw-fr", "fr": "_fr", "rw": "_rw"}


def main():
    import json
    p = argparse.ArgumentParser(description="Transcription (.json) en document Word modifiable (.docx).")
    p.add_argument("projets", nargs="+", help="fichiers JSON du moteur ou projets enregistrés depuis l’éditeur")
    p.add_argument("--contenu", choices=["bi", "fr", "rw"], default="bi", help="bi (tableau, défaut), fr ou rw")
    a = p.parse_args()
    for chemin in a.projets:
        with open(chemin, encoding="utf-8") as f:
            projet = json.load(f)
        cible = os.path.splitext(chemin)[0] + SUFFIXES[a.contenu] + ".docx"
        print("écrit :", ecrire_docx(projet, cible, a.contenu))


if __name__ == "__main__":
    main()
