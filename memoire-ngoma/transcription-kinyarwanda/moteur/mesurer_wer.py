#!/usr/bin/env python3
"""
mesurer_wer.py — mesure la qualité du premier jet automatique sur vos propres enregistrements.

Compare le fichier JSON brut du moteur avec le projet corrigé à l’écoute dans l’éditeur
(même entretien) et calcule le taux d’erreur sur les mots (WER) et sur les caractères (CER)
du texte kinyarwanda. Plus le taux est bas, moins le premier jet a demandé de corrections.

  python mesurer_wer.py transcriptions/P01.json P01_transcription.json
  python mesurer_wer.py brut.json corrige.json --jusqua 300     (seulement les 5 premières minutes)

Ne fonctionne que si la partie comparée a été entièrement réécoutée et corrigée.
"""
import argparse
import json
import re
import unicodedata


def texte_normalise(chemin, jusqua=None):
    with open(chemin, encoding="utf-8") as f:
        projet = json.load(f)
    morceaux = [s.get("texte", "") for s in projet.get("segments", [])
                if jusqua is None or s.get("debut", 0) < jusqua]
    t = " ".join(morceaux).lower()
    t = unicodedata.normalize("NFC", t.replace("’", "'"))
    t = re.sub(r"\[[^\]]*\]", " ", t)              # balises [inaudible], [NOM]…
    t = re.sub(r"[^\w' ]+", " ", t)                # ponctuation
    return t.split()


def distance(a, b):
    """Distance d’édition (insertions, suppressions, substitutions) entre deux suites."""
    prec = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cour = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cour[j] = min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (x != y))
        prec = cour
    return prec[-1]


def main():
    p = argparse.ArgumentParser(description="Taux d’erreur du premier jet automatique (WER et CER).")
    p.add_argument("brut", help="JSON produit par transcrire.py")
    p.add_argument("corrige", help="projet enregistré depuis l’éditeur après correction")
    p.add_argument("--jusqua", type=float, help="ne comparer que les segments commençant avant cette seconde")
    a = p.parse_args()
    hyp, ref = texte_normalise(a.brut, a.jusqua), texte_normalise(a.corrige, a.jusqua)
    if not ref:
        raise SystemExit("La transcription corrigée est vide.")
    wer = distance(ref, hyp) / len(ref)
    print(f"Mots de la transcription corrigée : {len(ref)}")
    print(f"WER (taux d’erreur sur les mots)      : {wer:.1%}")
    cr, ch = " ".join(ref), " ".join(hyp)
    if len(cr) <= 20000:
        print(f"CER (taux d’erreur sur les caractères) : {distance(cr, ch) / len(cr):.1%}")
    else:
        print("CER non calculé (texte trop long) : utilisez --jusqua 600 pour les 10 premières minutes.")


if __name__ == "__main__":
    main()
