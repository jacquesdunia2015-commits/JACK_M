# finaliser-docx.py — dernière étape du mémoire et du rapport : ouvre le .docx
# dans LibreOffice (sans interface), remplit le sommaire et la table des
# matières comme le ferait F9 dans Word, puis réenregistre le fichier au
# format Word 2007-365. Le fichier final s'ouvre donc avec ses index remplis,
# sans demande de mise à jour des champs, et son emballage est celui d'un
# traitement de texte, ce qui le rend lisible par Word sur ordinateur, sur
# mobile et en ligne. Un PDF identique peut être produit à côté.
#
# Usage : python3 finaliser-docx.py fichier.docx [--pdf fichier.pdf]
# Dépendances : LibreOffice (Writer) et son module Python (python3-uno).
import os, re, shutil, subprocess, sys, tempfile, time, uno, zipfile
from com.sun.star.beans import PropertyValue


def prop(nom, valeur):
    p = PropertyValue(); p.Name = nom; p.Value = valeur; return p


def remettre_en_ordre(chemin):
    """LibreOffice écrit la définition de section (w:sectPr) en tête des propriétés
    de paragraphe ; le schéma de Word l'exige à la fin (avant un éventuel
    w:pPrChange). On la déplace, sans toucher au reste du fichier."""
    def corriger(m):
        contenu = m.group(1)
        sect = re.search(r"<w:sectPr[ >].*?</w:sectPr>", contenu, re.S)
        if not sect:
            return m.group(0)
        reste = contenu[:sect.start()] + contenu[sect.end():]
        i = reste.find("<w:pPrChange")
        reste = reste + sect.group(0) if i < 0 else reste[:i] + sect.group(0) + reste[i:]
        return f"<w:pPr>{reste}</w:pPr>"
    tmp = chemin + ".tmp"
    with zipfile.ZipFile(chemin) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                data = re.sub(r"<w:pPr>(.*?)</w:pPr>", corriger, data.decode("utf-8"), flags=re.S).encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, chemin)


def main():
    chemin = os.path.abspath(sys.argv[1])
    pdf = os.path.abspath(sys.argv[sys.argv.index("--pdf") + 1]) if "--pdf" in sys.argv else None
    port = 2100 + os.getpid() % 1000
    profil = tempfile.mkdtemp(prefix="lo-profil-")
    lo = subprocess.Popen(["soffice", "--headless", "--norestore", "--invisible", f"-env:UserInstallation=file://{profil}",
                           f"--accept=socket,host=localhost,port={port};urp;"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ctx = None
        for _ in range(90):
            try:
                local = uno.getComponentContext()
                resolveur = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
                ctx = resolveur.resolve(f"uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(1)
        if ctx is None:
            sys.exit("LibreOffice n'a pas démarré")
        bureau = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        doc = bureau.loadComponentFromURL(uno.systemPathToFileUrl(chemin), "_blank", 0, (prop("Hidden", True),))
        # Deux passes : la première remplit les index, la seconde corrige leurs numéros de page.
        for _ in range(2):
            index = doc.getDocumentIndexes()
            for i in range(index.getCount()):
                index.getByIndex(i).update()
            doc.refresh()
        doc.storeToURL(uno.systemPathToFileUrl(chemin), (prop("FilterName", "MS Word 2007 XML"),))
        if pdf:
            doc.storeToURL(uno.systemPathToFileUrl(pdf), (prop("FilterName", "writer_pdf_Export"),))
        doc.close(True)
        try:
            bureau.terminate()
        except Exception:
            pass
    finally:
        try:
            lo.wait(timeout=30)
        except subprocess.TimeoutExpired:
            lo.kill()
    remettre_en_ordre(chemin)
    print("finalisé :", chemin, "(index remplis)" + (f" ; pdf : {pdf}" if pdf else ""))


main()
