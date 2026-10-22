# extraire-protocole.py — lit le protocole corrigé (.docx) et produit, ici :
#   · protocole.json            texte du protocole en blocs (h1/h2/h3/p/table/image) ;
#   · figures/                  logos, cadre conceptuel, carte ;
#   · references-protocole.json les 71 références de sa bibliographie.
#
# Usage : python3 extraire-protocole.py chemin/vers/Protocole_corrige.docx
#
# Le dépôt étant public, protocole.json et figures/ ne sont PAS versés (voir
# .gitignore) : le protocole n'est pas publié. Seule la liste des références,
# faite de publications, l'est. Sans ces deux fichiers, seul faire-memoire.mjs
# ne peut pas tourner ; les autres générateurs n'en ont pas besoin.
# Dépendance : python-docx.
import sys, json, os

sys.modules.setdefault("cryptography", None)   # paquet système parfois cassé, inutile ici
import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

NOMS_FIGURES = ["logo1.png", "logo2.png", "logo3.png", "cadre_conceptuel.png", "carte_ngoma.jpeg"]
ICI = os.path.dirname(os.path.abspath(__file__))

d = docx.Document(sys.argv[1])
os.makedirs(os.path.join(ICI, "figures"), exist_ok=True)
blocs, nimg = [], 0
for el in d.element.body.iterchildren():
    tag = el.tag.split("}")[1]
    if tag == "p":
        p = Paragraph(el, d)
        t, st = p.text.strip(), p.style.name
        for b in el.findall(".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
            rid = b.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            part = d.part.related_parts[rid]
            nom = NOMS_FIGURES[nimg] if nimg < len(NOMS_FIGURES) else f"figure{nimg + 1}.{part.partname.split('.')[-1]}"
            nimg += 1
            open(os.path.join(ICI, "figures", nom), "wb").write(part.blob)
            blocs.append({"type": "image", "fichier": nom})
        if not t:
            continue
        typ = {"Heading 1": "h1", "Heading 2": "h2", "Heading 3": "h3"}.get(st, "p")
        num = st.startswith("List Number") or (p._p.pPr is not None and p._p.pPr.numPr is not None)
        blocs.append({"type": typ, "texte": t, **({"liste": True} if num and typ == "p" else {})})
    elif tag == "tbl":
        rows = []
        for r in Table(el, d).rows:
            cells, prev = [], None
            for c in r.cells:
                if c._tc is prev:
                    continue
                prev = c._tc
                cells.append(c.text.strip())
            rows.append(cells)
        blocs.append({"type": "table", "lignes": rows})

json.dump(blocs, open(os.path.join(ICI, "protocole.json"), "w"), ensure_ascii=False, indent=1)
debut = next(i for i, b in enumerate(blocs) if b["type"] == "h1" and b["texte"].startswith("RÉFÉRENCES"))
fin = next(i for i, b in enumerate(blocs) if i > debut and b["type"] == "h1")
refs = [b["texte"] for b in blocs[debut + 1:fin] if b["type"] == "p"]
json.dump(refs, open(os.path.join(ICI, "references-protocole.json"), "w"), ensure_ascii=False, indent=1)
print(f"{len(blocs)} blocs, {nimg} images, {len(refs)} références")
