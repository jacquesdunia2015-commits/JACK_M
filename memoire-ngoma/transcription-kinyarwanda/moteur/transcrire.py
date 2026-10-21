#!/usr/bin/env python3
"""
transcrire.py — premier jet automatique de transcription (kinyarwanda) et de traduction (français)
des entretiens enregistrés, à corriger ensuite dans Transcripteur_Kinyarwanda.html.

Étapes : lecture de l’audio (16 kHz, mono) → découpage aux silences en segments de 20 s au plus
→ reconnaissance de la parole (modèle CTC kinyarwanda) → traduction automatique (NLLB-200)
→ fichier JSON lisible par l’éditeur, avec une confiance par segment (les segments peu sûrs
sont marqués « à revoir »).

Exemples :
  python transcrire.py P01.mp3 --traduire
  python transcrire.py audios/*.m4a --modele ubuzima --traduire --sortie resultats
  python transcrire.py P01.mp3 --decoupage-seul        (segments vides, sans modèle)

Le texte produit est un brouillon : chaque segment doit être réécouté et corrigé par le chercheur.
"""
import argparse
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys

import numpy as np

VERSION = "1.0"
SR = 16000

# Modèles de reconnaissance de la parole en kinyarwanda (raccourcis ; un identifiant Hugging Face
# ou un dossier local est aussi accepté).
MODELES = {
    "badrex": "badrex/w2v-bert-2.0-kinyarwanda-asr",  # w2v-BERT 2.0 affiné sur le kinyarwanda
    "ubuzima": "dganza/Ubuzima_AI",                   # même base, adaptée au vocabulaire de la santé
    "mms": "facebook/mms-1b-all",                     # Meta MMS, adaptateur « kin »
}
TRADUCTEUR = "facebook/nllb-200-distilled-600M"
SEUIL_CONFIANCE = 0.6


# ---------------------------------------------------------------- audio
def charger_audio(chemin):
    """Renvoie le signal en float32, 16 kHz, mono."""
    if shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", chemin, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
        sortie = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if sortie.returncode == 0 and sortie.stdout:
            return np.frombuffer(sortie.stdout, dtype=np.float32).copy()
        print("  ffmpeg n’a pas pu lire le fichier :", sortie.stderr.decode("utf-8", "replace").strip()[:300])
    try:
        import librosa
        signal, _ = librosa.load(chemin, sr=SR, mono=True)
        return signal.astype(np.float32)
    except ImportError:
        pass
    import soundfile as sf
    signal, sr = sf.read(chemin, dtype="float32", always_2d=True)
    signal = signal.mean(axis=1)
    if sr != SR:
        # Rééchantillonnage linéaire de secours (installer ffmpeg ou librosa pour une meilleure qualité)
        n = int(round(len(signal) * SR / sr))
        signal = np.interp(np.linspace(0, len(signal) - 1, n), np.arange(len(signal)), signal).astype(np.float32)
    return signal


# ---------------------------------------------------------------- découpage
def niveaux_db(signal, trame=0.025, pas=0.010):
    """Énergie (dB) par trame de 25 ms, toutes les 10 ms."""
    lt, lp = int(trame * SR), int(pas * SR)
    if len(signal) < lt:
        signal = np.pad(signal, (0, lt - len(signal)))
    n = 1 + (len(signal) - lt) // lp
    idx = np.arange(lt)[None, :] + lp * np.arange(n)[:, None]
    rms = np.sqrt(np.mean(signal[idx] ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-9), pas


def plages(masque):
    """Liste des plages [début, fin) où le masque est vrai."""
    m = np.concatenate([[False], masque, [False]]).astype(np.int8)
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def decouper(signal, duree_max=20.0, silence_min=0.3, marge=0.15, ecart_fusion=0.6, ecart_db=8.0):
    """Découpe aux silences ; renvoie des (début, fin) en secondes, de duree_max au plus."""
    db, pas = niveaux_db(signal)
    bruit = np.percentile(db, 10)
    seuil = max(bruit + ecart_db, db.max() - 50)
    parole = db > seuil
    # combler les silences trop courts, retirer les bruits trop brefs
    for d, f in plages(~parole):
        if (f - d) * pas < silence_min and d > 0 and f < len(parole):
            parole[d:f] = True
    for d, f in plages(parole):
        if (f - d) * pas < 0.2:
            parole[d:f] = False
    total = len(signal) / SR
    regions = [[max(0.0, d * pas - marge), min(total, f * pas + 0.025 + marge)] for d, f in plages(parole)]
    # regrouper les régions proches tant que le segment reste court
    fusion = []
    for r in regions:
        if fusion and r[0] - fusion[-1][1] < ecart_fusion and r[1] - fusion[-1][0] <= duree_max:
            fusion[-1][1] = r[1]
        else:
            fusion.append(r)
    # couper les régions trop longues au point le plus calme
    segments = []
    for debut, fin in fusion:
        while fin - debut > duree_max:
            a, b = int((debut + duree_max * 0.5) / pas), int((debut + duree_max) / pas)
            coupe = (a + int(np.argmin(db[a:b]))) * pas if b > a else debut + duree_max
            segments.append((debut, coupe))
            debut = coupe
        if fin - debut >= 0.3:
            segments.append((debut, fin))
    return [(round(float(d), 2), round(float(f), 2)) for d, f in segments]


# ---------------------------------------------------------------- reconnaissance
def appareil_choisi(choix):
    import torch
    if choix == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return choix


class Reconnaissance:
    """Modèle CTC (w2v-BERT, wav2vec 2.0, MMS) ; renvoie le texte et une confiance moyenne."""

    def __init__(self, nom, appareil):
        import torch
        from transformers import AutoModelForCTC, AutoProcessor
        self.torch = torch
        self.ident = MODELES.get(nom, nom)
        self.appareil = appareil
        print(f"Chargement du modèle de reconnaissance : {self.ident} ({appareil})")
        options = {"target_lang": "kin", "ignore_mismatched_sizes": True} if "mms-" in self.ident else {}
        base = self._base_adaptateur()
        if base:
            # Dépôt ne contenant qu’un adaptateur LoRA : charger le modèle de base puis l’adaptateur
            from peft import PeftModel
            modele = AutoModelForCTC.from_pretrained(base)
            self.modele = PeftModel.from_pretrained(modele, self.ident).merge_and_unload()
            try:
                self.processeur = AutoProcessor.from_pretrained(self.ident)
            except Exception:
                self.processeur = AutoProcessor.from_pretrained(base)
        else:
            self.processeur = AutoProcessor.from_pretrained(self.ident, **({"target_lang": "kin"} if options else {}))
            self.modele = AutoModelForCTC.from_pretrained(self.ident, **options)
        self.modele.to(appareil).eval()
        tok = getattr(self.processeur, "tokenizer", None)
        self.blanc = getattr(tok, "pad_token_id", None)
        if self.blanc is None:
            self.blanc = getattr(self.modele.config, "pad_token_id", 0) or 0

    def _base_adaptateur(self):
        if os.path.isdir(self.ident):
            chemin = os.path.join(self.ident, "adapter_config.json")
            if not os.path.exists(chemin):
                return None
        else:
            try:
                from huggingface_hub import hf_hub_download
                chemin = hf_hub_download(self.ident, "adapter_config.json")
            except Exception:
                return None
        with open(chemin, encoding="utf-8") as f:
            return json.load(f).get("base_model_name_or_path")

    def __call__(self, morceau):
        torch = self.torch
        entrees = self.processeur(morceau, sampling_rate=SR, return_tensors="pt")
        entrees = {k: v.to(self.appareil) for k, v in entrees.items()}
        with torch.inference_mode():
            logits = self.modele(**entrees).logits[0].float()
        probas = torch.softmax(logits, dim=-1)
        meilleures, ids = probas.max(dim=-1)
        texte = self.processeur.batch_decode(ids[None].cpu())[0].strip()
        utiles = ids != self.blanc
        confiance = float(meilleures[utiles].mean()) if bool(utiles.any()) else 0.0
        return texte, confiance


class Traduction:
    """Traduction automatique kinyarwanda → français (NLLB-200)."""

    def __init__(self, appareil, ident=TRADUCTEUR):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        self.torch = torch
        self.ident = ident
        self.appareil = appareil
        print(f"Chargement du modèle de traduction : {ident} ({appareil})")
        self.tok = AutoTokenizer.from_pretrained(ident, src_lang="kin_Latn")
        self.modele = AutoModelForSeq2SeqLM.from_pretrained(ident).to(appareil).eval()
        self.cible = self.tok.convert_tokens_to_ids("fra_Latn")

    def __call__(self, textes, lot=8):
        sorties = [""] * len(textes)
        a_traduire = [i for i, t in enumerate(textes) if t.strip()]
        for k in range(0, len(a_traduire), lot):
            idx = a_traduire[k:k + lot]
            entrees = self.tok([textes[i] for i in idx], return_tensors="pt", padding=True,
                               truncation=True, max_length=256).to(self.appareil)
            with self.torch.inference_mode():
                gen = self.modele.generate(**entrees, forced_bos_token_id=self.cible, max_new_tokens=256, num_beams=4)
            for i, t in zip(idx, self.tok.batch_decode(gen, skip_special_tokens=True)):
                sorties[i] = t.strip()
        return sorties


# ---------------------------------------------------------------- programme
def traiter(chemin, args, reco, trad):
    print(f"\n=== {os.path.basename(chemin)}")
    signal = charger_audio(chemin)
    total = len(signal) / SR
    print(f"  Durée : {int(total // 60)} min {int(total % 60)} s")
    decoupes = decouper(signal, duree_max=args.duree_max)
    print(f"  {len(decoupes)} segments")
    segments = []
    for n, (debut, fin) in enumerate(decoupes, 1):
        seg = {"debut": debut, "fin": fin, "locuteur": "", "texte": "", "traduction": "", "note": ""}
        if reco:
            texte, conf = reco(signal[int(debut * SR):int(fin * SR)])
            seg.update(texte=texte, confiance=round(conf, 3), incertain=conf < SEUIL_CONFIANCE or not texte)
            if n % 10 == 0 or n == len(decoupes):
                print(f"  reconnaissance : {n}/{len(decoupes)}")
        segments.append(seg)
    if trad:
        print("  traduction en français…")
        for seg, t in zip(segments, trad([s["texte"] for s in segments])):
            seg["traduction"] = t
    # combler les petits trous entre segments pour que toute la durée soit couverte dans l’éditeur
    for a, b in zip(segments, segments[1:]):
        a["fin"] = b["debut"] = round((a["fin"] + b["debut"]) / 2, 2) if b["debut"] > a["fin"] else a["fin"]
    if segments:
        segments[0]["debut"] = 0.0
        segments[-1]["fin"] = round(total, 2)
    projet = {
        "format": "transcripteur-kinyarwanda", "version": 1,
        "meta": {"code": "", "date": "", "transcripteur": "", "verificateur": "", "mode": "verbatim"},
        "audio": {"nom": os.path.basename(chemin), "taille": os.path.getsize(chemin), "duree": round(total, 2)},
        "moteur": {"script": f"transcrire.py {VERSION}", "date": datetime.datetime.now().isoformat(timespec="seconds"),
                   "modele": reco.ident if reco else None, "traduction": trad.ident if trad else None,
                   "duree_max_segment": args.duree_max, "seuil_confiance": SEUIL_CONFIANCE},
        "segments": segments,
    }
    os.makedirs(args.sortie, exist_ok=True)
    cible = os.path.join(args.sortie, os.path.splitext(os.path.basename(chemin))[0] + ".json")
    with open(cible, "w", encoding="utf-8") as f:
        json.dump(projet, f, ensure_ascii=False, indent=1)
    a_revoir = sum(1 for s in segments if s.get("incertain"))
    print(f"  écrit : {cible}" + (f" ({a_revoir} segment(s) à revoir)" if reco else ""))
    return cible


def main(argv=None):
    p = argparse.ArgumentParser(description="Premier jet de transcription kinyarwanda et de traduction française.")
    p.add_argument("audios", nargs="+", help="fichiers audio (MP3, WAV, M4A, OGG, AMR…) ; les jokers *.mp3 sont acceptés")
    p.add_argument("--modele", default="badrex", help="badrex (défaut), ubuzima, mms, ou identifiant / dossier d’un modèle CTC")
    p.add_argument("--traduire", action="store_true", help="ajouter la traduction automatique en français (NLLB-200)")
    p.add_argument("--decoupage-seul", action="store_true", help="seulement découper aux silences (aucun modèle, segments vides)")
    p.add_argument("--sortie", default="transcriptions", help="dossier des fichiers JSON (défaut : transcriptions)")
    p.add_argument("--duree-max", type=float, default=20.0, help="durée maximale d’un segment en secondes (défaut : 20)")
    p.add_argument("--appareil", default="auto", help="auto (GPU s’il existe), cpu ou cuda")
    args = p.parse_args(argv)

    fichiers = []
    for motif in args.audios:
        fichiers.extend(sorted(glob.glob(motif)) or [motif])
    absents = [f for f in fichiers if not os.path.isfile(f)]
    if absents:
        sys.exit("Fichier(s) introuvable(s) : " + ", ".join(absents))

    reco = trad = None
    if not args.decoupage_seul:
        appareil = appareil_choisi(args.appareil)
        reco = Reconnaissance(args.modele, appareil)
        if args.traduire:
            trad = Traduction(appareil)
    for f in fichiers:
        traiter(f, args, reco, trad)
    print("\nTerminé. Ouvrez Transcripteur_Kinyarwanda.html, puis l’audio et le fichier JSON correspondant.")


if __name__ == "__main__":
    main()
