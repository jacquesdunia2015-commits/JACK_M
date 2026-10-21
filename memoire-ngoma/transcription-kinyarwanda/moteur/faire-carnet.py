#!/usr/bin/env python3
"""Produit le carnet Google Colab à partir de transcrire.py (à relancer après toute modification du script)."""
import json
import os

ICI = os.path.dirname(os.path.abspath(__file__))
SCRIPT = open(os.path.join(ICI, "transcrire.py"), encoding="utf-8").read()


def md(texte):
    return {"cell_type": "markdown", "metadata": {}, "source": texte.strip("\n").splitlines(True)}


def code(texte):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": texte.strip("\n").splitlines(True)}


cellules = [
    md("""
# Transcription kinyarwanda → français (premier jet automatique)

Ce carnet produit, pour chaque enregistrement, un fichier **.json** à ouvrir dans
**Transcripteur_Kinyarwanda.html** pour écoute et correction. Le texte obtenu est un brouillon :
chaque segment doit être réécouté et corrigé.

**Confidentialité — à lire avant de continuer.** Dans Colab, les enregistrements sont copiés sur
des serveurs de Google le temps du calcul. Le formulaire de consentement promet que seules les
personnes de l’équipe de recherche ont accès aux données : n’utilisez ce carnet qu’avec l’accord
de votre directrice de recherche, avec un compte Google personnel protégé, et supprimez les
fichiers à la fin (dernière cellule). Sinon, utilisez le script sur un ordinateur local (voir le guide).

**Avant de commencer :** menu *Exécution* → *Modifier le type d’exécution* → *GPU T4*, puis exécutez
les cellules une à une (bouton ▶ à gauche de chaque cellule).
"""),
    md("## 1. Installer les outils (1 à 3 minutes)"),
    code("!pip -q install -U transformers peft sentencepiece librosa"),
    md("## 2. Écrire le script de transcription"),
    code("%%writefile transcrire.py\n" + SCRIPT),
    md("""
## 3. Envoyer les enregistrements

Choisissez un ou plusieurs fichiers audio (MP3, M4A, WAV, AMR…). Nommez-les de préférence par le
code du participant (P01.mp3, P02.mp3…), jamais par son nom.
"""),
    code("""
import os
from google.colab import files
os.makedirs("audios", exist_ok=True)
for nom, contenu in files.upload().items():
    with open(os.path.join("audios", nom), "wb") as f:
        f.write(contenu)
print(sorted(os.listdir("audios")))
"""),
    md("""
## 4. Transcrire et traduire

`--modele badrex` : modèle kinyarwanda général (par défaut). `--modele ubuzima` : variante adaptée au
vocabulaire de la santé. Essayez les deux sur un même entretien et gardez celui qui demande le moins de
corrections. Retirez `--traduire` pour obtenir seulement le kinyarwanda.
"""),
    code("!python transcrire.py \"audios/*\" --modele badrex --traduire --sortie transcriptions"),
    md("## 5. Récupérer les fichiers .json"),
    code("""
import shutil
from google.colab import files
shutil.make_archive("transcriptions", "zip", "transcriptions")
files.download("transcriptions.zip")
"""),
    md("## 6. Effacer les enregistrements et les transcriptions de Colab"),
    code("""
import shutil, os
for d in ["audios", "transcriptions"]:
    shutil.rmtree(d, ignore_errors=True)
if os.path.exists("transcriptions.zip"):
    os.remove("transcriptions.zip")
print("Fichiers effacés. Fermez ensuite la session : menu Exécution → Déconnecter et supprimer l’environnement d’exécution.")
"""),
]

for n, c in enumerate(cellules, 1):
    c["id"] = f"cellule-{n:02d}"

carnet = {"nbformat": 4, "nbformat_minor": 5, "cells": cellules,
          "metadata": {"accelerator": "GPU", "colab": {"provenance": []},
                       "kernelspec": {"display_name": "Python 3", "name": "python3"},
                       "language_info": {"name": "python"}}}
cible = os.path.join(os.path.dirname(ICI), "Transcription_Kinyarwanda_Colab.ipynb")
with open(cible, "w", encoding="utf-8") as f:
    json.dump(carnet, f, ensure_ascii=False, indent=1)
print("écrit :", cible)
