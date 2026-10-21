# Transcripteur Kinyarwanda — guide d’utilisation

Outil local pour transcrire en kinyarwanda, puis traduire en français, les entretiens enregistrés sur le
terrain (district de Ngoma). Il reprend la phase 1 du cahier des charges : un moteur interchangeable,
un premier jet automatique, un éditeur de correction et des exports. Il ne comprend ni comptes
utilisateurs, ni paiement, ni serveur.

## 1. Contenu du dossier

| Fichier | Rôle | Où l’utiliser |
|---|---|---|
| `Transcripteur_Kinyarwanda.html` | Éditeur : écoute, transcription, traduction, correction, exports | Tout ordinateur, **y compris Windows 7** (Chrome 109 ou Firefox 115 ESR), sans Internet |
| `Transcription_Kinyarwanda_Colab.ipynb` | Premier jet automatique dans Google Colab (GPU gratuit) | Navigateur récent ; Internet ; **accord de la directrice requis** (§ 7) |
| `moteur/transcrire.py` | Le même moteur, à lancer sur un ordinateur | Windows 10/11, macOS ou Linux, 8 Go de mémoire au moins (16 Go conseillés) |
| `moteur/mesurer_wer.py` | Mesure la qualité du premier jet sur vos propres entretiens | Ordinateur avec Python |
| `moteur/faire-carnet.py` | Régénère le carnet Colab après une modification du script | Développement uniquement |

## 2. Ce qu’il faut savoir avant de commencer

- **Le texte automatique est un brouillon.** Chaque segment doit être réécouté et corrigé par vous.
  Les citations du mémoire ne sont reprises que dans la version corrigée.
- **La qualité sur vos enregistrements n’est pas connue d’avance.** Les modèles ont été entraînés
  sur d’autres voix et d’autres conditions d’enregistrement. Mesurez-la sur deux entretiens (§ 6) avant
  de décider si le premier jet vous fait gagner du temps. Le cahier des charges vise un taux d’erreur
  sur les mots (WER) de 20 % au plus. Au-delà, transcrire à la main dans l’éditeur peut aller plus vite.
- **La traduction automatique (NLLB-200) n’est qu’une proposition.** Elle doit être revue phrase par
  phrase, surtout pour les termes de santé et les expressions imagées.
- **Windows 7 ne peut pas faire tourner le moteur automatique.** Python s’arrête à la version 3.8
  sur Windows 7, et les bibliothèques d’intelligence artificielle actuelles ne s’y installent plus.
  Sur Windows 7, l’éditeur fonctionne normalement pour la transcription manuelle et la correction.
  Le premier jet se fait alors dans Colab ou sur un ordinateur plus récent, par exemple à l’école ou au
  district.

## 3. Méthode conseillée, entretien par entretien

1. **Nommer l’enregistrement par le code du participant** (`P01.mp3`, `P02.m4a`…), jamais par son nom.
   Le garder dans le dossier sécurisé de l’étude.
2. **Premier jet automatique (facultatif)** : avec Colab (§ 4) ou avec le script (§ 5). On obtient
   `P01.json`.
3. **Ouvrir `Transcripteur_Kinyarwanda.html`** (double-clic ; sinon clic droit → *Ouvrir avec* → Chrome).
4. Cliquer sur **Ouvrir l’audio** et choisir `P01.mp3`. Avec un premier jet, cliquer aussi sur
   **Ouvrir une transcription** et choisir `P01.json`.
5. Remplir le **code du participant**, la date, vos initiales et le mode (verbatim intégral conseillé).
6. **Écouter et corriger, segment par segment.**
   - Vitesse 0,75× pour la première écoute.
   - Le « retour à la reprise » de 1 s fait reculer l’audio à chaque pause.
   - **Échap** met en lecture ou en pause sans quitter le texte.
   - **F2** crée un nouveau segment à chaque changement de locuteur.
   - **Alt+1** marque l’enquêteur, **Alt+2** le participant.
   - **F4** réécoute le segment en cours.
   - **Ctrl+I** marque un passage douteux « à revoir ».
7. **Traduire** dans la colonne de droite. Le glossaire, à droite de l’écran, insère les termes de
   santé ; complétez-le au fil des entretiens.
8. **Anonymiser** avec *Rechercher / remplacer* : chaque nom de personne devient `[NOM]`, chaque
   lieu `[LIEU]`, chaque établissement `[CENTRE]`.
9. **Vérifier l’avancement** (encadré « Avancement ») : 100 % de l’audio transcrit, aucun segment
   sans locuteur, aucun segment sans traduction, les segments « à revoir » réécoutés.
10. **Enregistrer le projet** (**Ctrl+S**). Ranger `P01_transcription.json` dans le dossier sécurisé.
    Le navigateur garde aussi une copie automatique, mais elle ne remplace pas ce fichier.
11. **Exporter.**
    - *Word (.rtf) — kinyarwanda + français* : pour les annexes et le contrôle de fidélité.
    - *Texte (.txt) — français* : pour l’import dans NVivo (ou dans QualiCode).

## 4. Premier jet dans Google Colab

1. Aller sur <https://colab.research.google.com> → *Importer* → choisir
   `Transcription_Kinyarwanda_Colab.ipynb`. Chrome 109 sous Windows 7 peut ne plus être accepté par
   Colab ; dans ce cas, utiliser un autre ordinateur.
2. Menu *Exécution* → *Modifier le type d’exécution* → **GPU T4**.
3. Exécuter les cellules dans l’ordre.
   - La cellule 3 envoie les audios.
   - La cellule 4 transcrit et traduit. Le premier passage télécharge les modèles (plusieurs
     gigaoctets).
   - La cellule 5 télécharge `transcriptions.zip`.
   - La cellule 6 efface tout.
4. Pour chaque entretien, comparer `--modele badrex` (kinyarwanda général) et `--modele ubuzima`
   (variante adaptée au vocabulaire de la santé). Garder celui qui demande le moins de corrections.

## 5. Premier jet sur un ordinateur (Windows 10/11, macOS, Linux)

```
python -m pip install torch transformers peft sentencepiece librosa
python moteur/transcrire.py P01.mp3 --traduire
python moteur/transcrire.py "audios/*.m4a" --modele ubuzima --traduire --sortie transcriptions
```

- La première exécution télécharge les modèles. Une connexion Internet est nécessaire une seule fois ;
  ensuite tout se fait sans Internet et l’audio ne quitte pas l’ordinateur.
- Sans carte graphique, le calcul est plus lent que la durée de l’enregistrement. Lancer l’ensemble des
  fichiers le soir.
- Installer **ffmpeg** permet de lire tous les formats (AMR, M4A…).
- `--decoupage-seul` prépare seulement les segments aux silences, sans modèle.

## 6. Mesurer la qualité du premier jet

Sur deux entretiens, corriger entièrement les dix premières minutes dans l’éditeur, enregistrer le
projet, puis lancer :

```
python moteur/mesurer_wer.py transcriptions/P01.json P01_transcription.json --jusqua 600
```

Le WER indique la part des mots que vous avez dû corriger. Si vous voulez citer ce chiffre dans
le mémoire (méthodes), il décrit la qualité du premier jet automatique, et non celle de la
transcription finale, qui est entièrement corrigée à l’écoute.

## 7. Confidentialité

- L’éditeur et le script local ne transmettent rien sur Internet.
- **Colab copie les enregistrements sur les serveurs de Google.** Le formulaire de consentement limite
  l’accès aux données à l’équipe de recherche. N’utilisez Colab qu’avec l’accord écrit de votre
  directrice de recherche, et effacez les fichiers à la fin (cellule 6). Sinon, utilisez le script local
  ou transcrivez à la main.
- Ne pas travailler sur un ordinateur partagé, ou effacer la copie du navigateur à la fin
  (*Aide* → *Effacer la copie du navigateur*).

## 8. Formats audio

Chrome lit le MP3, le WAV, le M4A/AAC, l’OGG et l’OPUS. Pour un fichier AMR, 3GP ou WMA :

1. Installer **VLC** (la version 3 fonctionne sous Windows 7).
2. Menu *Média* → *Convertir / Enregistrer*.
3. Choisir le profil *Audio – MP3*.

## 9. Modèles utilisés (sources)

- Reconnaissance, kinyarwanda général : [badrex/w2v-bert-2.0-kinyarwanda-asr](https://huggingface.co/badrex/w2v-bert-2.0-kinyarwanda-asr) (version ONNX : [OpenVoiceOS](https://huggingface.co/OpenVoiceOS/w2v-bert-2.0-kinyarwanda-onnx))
- Reconnaissance, variante santé : [dganza/Ubuzima_AI](https://huggingface.co/dganza/Ubuzima_AI)
- Reconnaissance, variante multilingue : [facebook/mms-1b-all](https://huggingface.co/docs/transformers/v4.30.0/en/model_doc/mms) (`--modele mms`)
- Traduction : [facebook/nllb-200-distilled-600M](https://huggingface.co/facebook/nllb-200-distilled-600M/blob/main/README.md). Sa licence (CC-BY-NC) en limite l’usage à la recherche non commerciale.
