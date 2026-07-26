# 📖 QualiCode — Manuel du débutant complet (de A à Z)

*Pour la personne qui n'a JAMAIS fait d'analyse de données qualitatives et qui
n'a jamais utilisé un logiciel comme celui-ci. Lisez dans l'ordre : chaque
chapitre s'appuie sur le précédent. Temps de lecture : environ 1 heure.
Temps pour tout essayer en même temps : une demi-journée.*

> 💡 Ce manuel est **téléchargeable en PDF depuis l'application** : onglet
> **Accueil → groupe « Documentation » → 🎓 Manuel débutant (PDF)**. Le
> **Guide d'utilisation** (plus court, orienté « comment faire ») est
> disponible au même endroit : 📖 Guide (PDF).

---

## Chapitre 1 — Comprendre AVANT de cliquer : c'est quoi l'analyse qualitative ?

### 1.1 Données quantitatives et données qualitatives

- Une **donnée quantitative** est un chiffre : « 45 % des femmes ont été
  dépistées ». On l'analyse avec Excel, SPSS, R.
- Une **donnée qualitative** est du **discours** : ce que les gens disent, avec
  leurs mots. Exemple : *« Je ne vais pas à la consultation parce que le centre
  est trop loin et qu'on m'y a mal parlé la dernière fois. »*

Les données qualitatives viennent surtout :
- d'**entretiens individuels** (vous discutez avec une personne et enregistrez) ;
- de **focus groups** (discussion de groupe) ;
- de **réponses ouvertes** de questionnaires ;
- de documents, photos, messages WhatsApp, etc.

### 1.2 Le principe central : le CODAGE

Imaginez 20 entretiens de 10 pages = 200 pages de texte. Impossible de tout
garder en tête. La solution universelle (celle de tous les chercheurs du monde)
s'appelle le **codage** :

1. Vous lisez le texte.
2. Chaque fois qu'un passage parle d'une idée importante, vous lui collez une
   **étiquette** appelée **code**. Exemple : le passage *« le centre est trop
   loin »* reçoit le code `Barrière - distance` ; *« on m'y a mal parlé »*
   reçoit `Barrière - accueil du personnel`.
3. À la fin, le logiciel peut vous montrer **tous les passages** qui portent un
   code donné, les compter, les croiser. C'est comme trier 200 pages dans des
   classeurs étiquetés — mais en quelques clics.

Trois mots à connaître (tout le manuel les utilise) :
- **Document** : un texte importé (un entretien transcrit, par exemple).
- **Code** : une étiquette (une idée, un thème).
- **Segment** : un morceau de texte auquel on a attaché un code.

Un logiciel comme QualiCode ne « fait » pas l'analyse à votre place : **c'est
vous qui pensez**, lui il range, retrouve, compte et croise à votre place.

---

## Chapitre 2 — Ouvrir QualiCode

### 2.1 Ce qu'il vous faut

- Un ordinateur (Windows, Mac ou Linux) avec un navigateur récent (Chrome ou
  Edge recommandés). **Aucune installation, aucun internet nécessaire.**
- Le fichier `QualiCode.html` (un seul fichier).

### 2.2 Premier lancement

1. Copiez `QualiCode.html` dans un dossier de votre ordinateur (ex. `Documents`).
2. Double-cliquez dessus → il s'ouvre dans le navigateur.
3. L'application démarre avec un **essai gratuit complet de 5 jours**. La barre
   du bas affiche « ⏳ Essai : 5 j restants ».
4. Après l'essai, un écran vous propose d'entrer une **clé de licence** (voir
   chapitre 14). Vos données ne sont jamais bloquées : le bouton « Exporter mes
   données » reste toujours disponible.

### 2.3 L'écran, en quatre zones

- **En haut** : le ruban avec des onglets (Accueil, Importer, Codage, Analyse,
  Visualisation, Rapports) — comme dans Word.
- **À gauche** : vos **Documents**.
- **Au centre** : le texte du document ouvert (le « navigateur de document »).
- **À droite** : vos **Codes**, et en dessous le volet des résultats/segments.
- **En bas** : la barre d'état (nombre de documents, codes, segments,
  sauvegarde automatique, état de la licence).

Astuce : `Ctrl+K` ouvre une **palette de commandes** — tapez un mot
(« export », « kappa »…) et l'action correspondante apparaît.

---

## Chapitre 3 — Protéger l'accès (mot de passe) — recommandé si données sensibles

QualiCode propose DEUX protections différentes :

| Protection | Bouton | Ce qu'elle fait |
|---|---|---|
| **Mot de passe de l'application** | Accueil → 🔐 « Mot de passe app » | Demandé à CHAQUE ouverture de QualiCode, avant l'accès à tous les projets de la machine. |
| **Chiffrement du fichier projet** | Accueil → 🔒 « Mot de passe » | Chiffre le fichier `.projx` que vous enregistrez/envoyez (AES-256). Sans le mot de passe, le fichier est illisible. |

Pour définir le mot de passe d'ouverture : Accueil → 🔐 → tapez-le deux fois →
« Définir le mot de passe ». Un bouton 🔒 apparaît en haut à droite pour
verrouiller l'écran quand vous quittez votre bureau.

⚠️ **Si vous oubliez ce mot de passe, PERSONNE ne peut le récupérer.**
Notez-le en lieu sûr.

---

## Chapitre 4 — Créer votre projet et importer vos données

### 4.1 Créer un projet

Accueil → « Nouveau projet » → donnez-lui un nom clair (ex. « Accès à l'eau
potable — village de Kigufi 2026 »). Le projet est sauvegardé automatiquement
dans le navigateur à chaque modification (« ✓ Enregistré » en bas à droite).

### 4.2 Importer un entretien transcrit (le cas le plus courant)

Votre transcription est dans Word ? Onglet **Importer** → « Fichiers » →
choisissez le `.docx`. Le texte apparaît dans la liste de gauche. Formats
acceptés : DOCX, PDF, TXT, images (JPG/PNG), et plus encore :

| Vous avez… | Faites… |
|---|---|
| Plusieurs entretiens dans UN fichier | Importer → « Texte structuré » : séparez chaque entretien par une ligne `#DOC Nom de l'entretien` |
| Un questionnaire avec réponses ouvertes (Excel) | Enregistrez-le en CSV → Importer → « Enquête CSV » (les colonnes deviennent des variables) |
| Un enregistrement audio/vidéo à transcrire | Importer → « Transcrire » : le lecteur s'affiche avec pédale clavier et insertion d'horodatages [mm:ss] cliquables |
| Une discussion WhatsApp exportée | Importer → « Réseaux sociaux » (export sans médias depuis WhatsApp) |
| Un PDF scanné (photo de document) | Importer → « OCR IA » (nécessite une clé API, chapitre 11) |
| Une bibliographie Zotero/EndNote | Importer → « Bibliographie » (fichiers .ris ou .bib) |

### 4.3 Les variables (fiche d'identité de chaque document)

Cliquez un document → « Variables » : ajoutez par exemple `sexe=F`, `âge=32`,
`village=Kigufi`. Cela servira au chapitre 8 pour comparer les groupes
(« que disent les femmes vs les hommes ? »).

---

## Chapitre 5 — Coder : le cœur du travail

### 5.1 Créer vos premiers codes

Volet droit → « Nouveau code ». Commencez simple, avec 5 à 10 codes issus de
vos questions de recherche. Exemple pour l'eau potable :
`Barrières d'accès`, `Stratégies des ménages`, `Perception de la qualité`,
`Coût`, `Rôle des autorités`.

Chaque code a une **couleur** (choisissez-la : le texte codé sera surligné de
cette couleur). Les codes peuvent avoir des **sous-codes** : cliquez-glissez un
code sur un autre pour l'y ranger (`Barrières d'accès` peut contenir
`distance`, `coût`, `accueil`).

### 5.2 Coder un passage (à faire 200 fois par projet 🙂)

1. Ouvrez un document (clic à gauche).
2. **Sélectionnez** un passage avec la souris (comme pour un copier-coller).
3. Un petit menu apparaît : cliquez le code voulu. C'est tout.

Autres façons :
- **Alt+C** : coder la sélection avec le dernier code utilisé (très rapide).
- **Codage in vivo** : crée un code portant les mots exacts du participant.
- **Codage automatique** : Codage → « Autocodage » : tous les passages contenant
  un mot donné reçoivent le code (à relire ensuite !).
- **Suggestions IA** (option, chapitre 11) : l'IA propose, VOUS validez.

### 5.3 Corriger

- Cliquez un passage surligné → retirer le code, changer le **poids**
  (importance 1–100) ou ajouter un **commentaire**.
- `Ctrl+Z` annule (30 niveaux), `Ctrl+Y` rétablit.
- Recoder : glissez la carte d'un segment (volet bas droit) sur un autre code.

### 5.4 Combien de codes ? Le conseil du débutant

Première lecture : codez large (beaucoup de passages, codes provisoires).
Deuxième passage : fusionnez, renommez, hiérarchisez. Un mémoire de master
finit typiquement avec 20–60 codes rangés sous 4–8 grands thèmes. Si vous avez
300 codes, fusionnez.

---

## Chapitre 6 — Les mémos : votre journal de chercheur

Un **mémo** est une note à vous-même : idée, hypothèse, décision. Écrivez-en
dès qu'une idée vient (bouton « Mémo » sur le projet, un document ou un code).
Exemple : *« Les trois veuves interrogées mentionnent toutes le coût — creuser
le lien statut matrimonial × coût. »* Le « Gestionnaire de mémos » (onglet
Analyse) les regroupe tous. Vos mémos deviendront des paragraphes de votre
chapitre Discussion.

---

## Chapitre 7 — Retrouver : recherche et requêtes

- **Recherche plein texte** (Accueil, ou `Ctrl+F`) : `eau ET payante`,
  `"château d'eau"` — opérateurs ET/OU et guillemets.
- **Activation** (le mot savant pour « filtrer ») : cochez des documents et des
  codes → le volet résultats montre uniquement les segments correspondants.
  Mode **OU** (au moins un code) ou **ET** (tous les codes).
- **Requêtes sauvegardées** : votre combinaison de filtres enregistrée pour la
  refaire en un clic la semaine suivante.
- Cliquez n'importe quel résultat → QualiCode saute au passage dans son
  contexte d'origine.

---

## Chapitre 8 — Analyser (onglet Analyse)

| Outil | Question à laquelle il répond |
|---|---|
| **Matrice codes × documents** | Qui parle de quoi, combien de fois ? (chaque case est cliquable) |
| **Co-occurrences** | Quels thèmes apparaissent ENSEMBLE ? (ex. `coût` revient souvent avec `veuves`) |
| **Comparaison par variable** | Les femmes disent-elles autre chose que les hommes ? Kigufi vs Rubona ? |
| **Fréquences de mots** | Quels mots reviennent le plus (les mots vides « le, la, de » sont ignorés) |
| **KWIC** | Voir un mot dans toutes ses phrases d'origine |
| **Statistiques descriptives** | Moyenne d'âge, répartition par sexe… de vos participants |
| **χ² et V de Cramér** | « La différence observée est-elle statistiquement significative ? » (avec p) |
| **Pont R/SPSS** | Exporte la matrice + un script R prêt à coller pour aller plus loin |
| **Accord inter-codeurs (kappa)** | Deux personnes ont codé le même texte : sont-elles d'accord ? (κ ≥ 0,61 = bon) |

Débutant : commencez par la **matrice** et la **comparaison par variable** —
c'est 80 % de ce qu'on met dans un chapitre Résultats de mémoire.

---

## Chapitre 9 — Visualiser (onglet Visualisation)

- **Nuage de mots** : impact visuel pour une soutenance.
- **Diagramme de fréquences** : les codes les plus utilisés.
- **Portrait de document** : la « couleur » d'un entretien d'un coup d'œil.
- **Carte conceptuelle** : dessinez vos thèmes et leurs liens (flèches), puis
  exportez l'image (SVG) pour le mémoire.

---

## Chapitre 10 — Audio, vidéo, images

- **Écouter en codant** : sélectionnez un document → « Audio » → associez le
  fichier son. Les horodatages `[12:35]` de la transcription deviennent
  cliquables (saut direct). 
- **Coder la piste elle-même** : bouton « Extrait » pendant la lecture → début,
  fin, code — sans transcription.
- **Vidéo** : identique, l'image en plus.
- **Images** : importez une photo (affiche, mur d'un centre de santé…), tracez
  un rectangle sur une zone → codez-la comme du texte.

---

## Chapitre 11 — Les fonctions IA (optionnelles, jamais obligatoires)

Suggestions de codes et OCR de PDF scannés utilisent l'API d'Anthropic avec
**votre propre clé** (console.anthropic.com). Points essentiels :
- QualiCode vous demande un **consentement explicite** avant tout envoi.
- L'IA **propose**, vous **validez** chaque suggestion une par une.
- Ne soumettez jamais de données nominatives : anonymisez à la transcription
  (remplacez les noms par P01, P02…).

---

## Chapitre 12 — Travailler à plusieurs

1. **Chacun son fichier** : chaque codeur travaille sur sa copie, définit son
   nom de codeur (Accueil), puis l'un importe le fichier de l'autre →
   « Fusionner » → le kappa est calculé automatiquement.
2. **Dossier partagé** (Drive/Dropbox installé sur le PC) : QualiCode détecte
   les nouveautés des collègues à chaque ouverture.
3. **Temps réel** (avancé) : un serveur (fourni : `server/sync-server.mjs`) et
   chacun voit les segments des autres arriver en direct.

---

## Chapitre 13 — Sauvegarder, exporter, rendre son mémoire

- La sauvegarde locale est **automatique et continue**, mais un navigateur peut
  être nettoyé : **exportez un `.projx` chaque soir** (Accueil → Enregistrer)
  sur clé USB ou Drive. C'est votre assurance-vie.
- **Rapport Word** (onglet Rapports) : document .docx avec segments classés par
  code — la matière première de votre chapitre Résultats.
- **CSV** : tous les segments pour Excel.
- **REFI-QDA (.qdpx)** : format d'échange standard — votre projet s'ouvre dans
  MAXQDA, NVivo ou ATLAS.ti (et réciproquement, QualiCode importe le leur).

---

## Chapitre 13 bis — QualiCode sur votre téléphone 📱

Vous pouvez lire vos entretiens et les coder depuis un téléphone Android ou un
iPhone — pratique dans le transport, en attente sur le terrain, ou quand
l'ordinateur n'est pas disponible.

**Installer QualiCode comme une application**
1. Ouvrez QualiCode dans le navigateur du téléphone (adresse du site, ou le
   fichier `QualiCode.html` reçu par WhatsApp et ouvert depuis « Fichiers »).
2. Onglet **Accueil → 📲 Installer sur l'écran d'accueil**.
   *(iPhone : bouton Partager ⬆️ de Safari → « Sur l'écran d'accueil ».)*
3. L'icône apparaît sur votre écran d'accueil. Elle s'ouvre en plein écran et
   **fonctionne sans internet**.

**Les cinq onglets du bas** — 📄 Documents, 🏷️ Codes, 📖 Texte, 🧲 Segments et
☰ Menu. Un seul volet s'affiche à la fois (l'écran est petit) ; le ☰ Menu donne
accès à tout le reste (importer, analyser, exporter…).

**Coder avec le doigt** — appui long sur un mot → faites glisser pour
sélectionner la phrase → touchez **🏷️ Coder la sélection** → choisissez le code.

**Conseil pratique** : le téléphone est idéal pour **relire et coder** ; la
transcription et la rédaction restent plus confortables sur ordinateur.
Transférez le projet dans les deux sens avec 💾 Enregistrer (.projx) et
📂 Ouvrir (.projx).

## Chapitre 14 — Licence et paiement (après les 5 jours d'essai)

1. Ouvrez « 💳 Abonnement » (ou attendez l'écran de fin d'essai).
2. Choisissez une formule : jour, semaine, mois, an ou à vie.
3. Payez par le canal indiqué (mobile money Orange/MTN/Airtel, carte
   Visa/Mastercard, Stripe, PayPal ou crypto) et envoyez la preuve au contact
   affiché.
4. Vous recevez une clé `QC1-…` → collez-la dans « 💳 Abonnement » → Activer.
   L'activation fonctionne **hors ligne**.

---

## Chapitre 15 — Les 10 erreurs du débutant (et comment les éviter)

1. **Tout coder dès la première lecture** → lisez d'abord un entretien en entier sans rien faire.
2. **300 codes** → fusionnez ; un code utilisé une seule fois n'est pas un thème.
3. **Coder des mots isolés** → codez l'unité de sens (la phrase ou le paragraphe).
4. **Oublier les mémos** → l'analyse, c'est les mémos ; le codage n'est que le tri.
5. **Ne jamais exporter de `.projx`** → sauvegarde externe quotidienne.
6. **Mettre les noms réels des participants** → anonymisez (P01, P02…) dès la transcription.
7. **Confondre fréquence et importance** → un thème dit une seule fois peut être capital ; le chiffre guide, il ne décide pas.
8. **Coder à deux sans vérifier l'accord** → calculez le kappa sur 2–3 entretiens dès le début.
9. **Choisir les codes après avoir vu les résultats espérés** → définissez la logique de codage dans un mémo AVANT.
10. **Reporter l'analyse à la fin du terrain** → codez chaque entretien dans les 48 h.

## Chapitre 16 — Petit lexique

| Terme | Définition simple |
|---|---|
| Codage | Coller des étiquettes (codes) sur des passages |
| Segment | Passage de texte qui porte un code |
| Code in vivo | Code qui reprend les mots exacts du participant |
| Mémo | Note de recherche à soi-même |
| Variable | Information sur un document (sexe, âge, lieu…) |
| Activation | Filtrer les résultats sur des documents/codes choisis |
| Co-occurrence | Deux codes présents sur le même passage |
| Kappa (κ) | Mesure d'accord entre deux codeurs (0 = hasard, 1 = parfait) |
| χ² (khi-deux) | Test : la différence entre groupes est-elle due au hasard ? |
| Saturation | Moment où de nouveaux entretiens n'apportent plus d'idées nouvelles |
| REFI-QDA | Format standard d'échange entre logiciels d'analyse qualitative |
| .projx | Fichier de sauvegarde d'un projet QualiCode |

*Bonne analyse ! Pour l'aide dans l'application : touche F1, ou `Ctrl+K` puis
tapez ce que vous cherchez.*
