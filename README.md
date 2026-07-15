# 🔍 QualiCode — Logiciel d'analyse qualitative de données (QDA)

Application web d'analyse qualitative et de méthodes mixtes, inspirée de MAXQDA / NVivo / ATLAS.ti,
développée à partir du **cahier des charges « Logiciel d'analyse qualitative de données (QDA) » v1.0 (juillet 2026)**.

Cette version correspond au **MVP (phase 2 du planning du cahier des charges)** : gestion de projet,
import de textes, codage hiérarchique, récupération de segments, analyses et exports — avec plusieurs
fonctionnalités de la version 1.0 déjà incluses (variables, analyses lexicales, visualisations, rapports).

📖 **Nouveau sur QualiCode ?** Lisez le **[Guide d'utilisation](GUIDE_UTILISATION.md)** — pas à pas, en français simple.

## 🚀 Lancement

**Fichier unique (le plus simple)** : téléchargez **[dist/QualiCode.html](https://github.com/jacquesdunia2015-commits/JACK_M/raw/main/dist/QualiCode.html)**
et ouvrez-le par **double-clic** — aucune installation, aucun serveur, fonctionne sans internet.
(Régénérable à tout moment : `python3 tools/build_standalone.py`.)

**En ligne** : l'application est déployée automatiquement sur GitHub Pages —
👉 **https://jacquesdunia2015-commits.github.io/JACK_M/**
(les données restent locales : rien n'est envoyé au serveur, qui ne fait que fournir les fichiers de l'application).

**En local (sources)** : aucune installation, aucune dépendance. Il suffit de servir le dossier en statique :

```bash
# Option 1 — Python
python3 -m http.server 8080

# Option 2 — Node
npx serve .
```

Puis ouvrir <http://localhost:8080>. L'application démarre avec un **projet exemple**
(étude fictive sur le télétravail : 3 entretiens + 1 focus group, déjà partiellement codés).

> L'application fonctionne aussi en ouvrant directement `index.html` dans certains navigateurs,
> mais un serveur statique est recommandé (modules ES).

## 🖥️ Interface (conforme §3.1 du cahier des charges)

- **4 volets redimensionnables** : système de documents, système de codes, navigateur de document, segments récupérés.
- **Ruban d'onglets** par domaine fonctionnel : Accueil, Importer, Codes, Mémos, Variables, Analyse, Visualisation, Rapports.
- **Thèmes clair / sombre** (bouton 🌓) et **interface en 12 langues** (bouton 🌐) : français, anglais,
  kinyarwanda, kiswahili (Kenya/Tanzanie), kiswahili de l'Est de la RDC, lingála, wolof, arabe (écriture
  droite→gauche prise en charge), espagnol, portugais, chinois (mandarin), hindi. FR/EN sont complets ;
  les autres langues couvrent l'essentiel de l'interface avec repli automatique sur le français.
  *Les traductions kinyarwanda, lingála, kiswahili-RDC et wolof mériteront une relecture par des
  locuteurs natifs avant commercialisation.*
- Numérotation des paragraphes, détection des locuteurs dans les transcriptions (`Nom :` en début de ligne).

## ✨ Fonctionnalités livrées

| Domaine (réf. cahier des charges) | Fonctionnalités |
|---|---|
| **Gestion de projet (§2.1)** | Création, sauvegarde/ouverture dans un fichier conteneur unique `.projx` (JSON), **sauvegarde automatique dans IndexedDB** (clonage structuré : gros corpus de milliers de documents, migration automatique depuis localStorage), corbeille interne, **filtre + plafond d'affichage** de l'arbre des documents, instantanés d'annulation légers (textes partagés par référence) |
| **Importation (§2.2)** | Fichiers **DOCX** (extraction native sans dépendance : lecture ZIP via `DecompressionStream` + analyse de `word/document.xml`), **PDF** (extraction de texte native : décompression FlateDecode + analyse des opérateurs de texte — PDF « texte », pas les scans), TXT/MD, collage de texte, enquêtes CSV (réponses courtes → variables, réponses longues → texte), texte structuré (balises `#DOC`), **transcription assistée** (lecteur audio local + raccourcis + horodatages), **réseaux sociaux sans API** (export WhatsApp .txt auto-détecté Android/iOS ; CSV/JSON de publications avec mappage auteur/texte/date auto-deviné, variable « source »), **images** (photos recompressées, codage par zones rectangulaires), **OCR des PDF scannés** (extraction native des pages JPEG + transcription IA avec clé utilisateur, relecture avant ajout) |
| **Organisation (§2.3)** | Groupes de documents (glisser-déposer), variables de document, navigateur avec numérotation des paragraphes, recherche plein texte booléenne (ET / OU / "phrase") |
| **Codage (§2.4)** | Codes et sous-codes en arborescence illimitée avec couleurs, codage par sélection de texte (menu contextuel), codage in vivo, raccourci clavier `Alt+C`, codage automatique par recherche lexicale (occurrence / phrase / paragraphe), pondération des segments, fusion visuelle des chevauchements, fréquences en temps réel, glisser-déposer des codes, **suggestions de codage par IA** (clé API de l'utilisateur, consentement explicite à chaque envoi, validation humaine suggestion par suggestion, clé jamais stockée dans le projet) |
| **Récupération (§2.4)** | Activation de documents et de codes (✅), modes **OU** et **ET** (intersection/chevauchement), saut au passage source, **requêtes sauvegardées** (combinaisons de filtres réutilisables, stockées dans le `.projx`), **recodage par glisser-déposer** (tirer une carte segment sur un code) |
| **Bibliographie (§2.2)** | Import **RIS / BibTeX** (Zotero, EndNote, Mendeley), stockage dans le projet, **export en liste formatée style APA** pour le chapitre Références |
| **Mémos (§2.5)** | Mémos de projet, de document et de code ; commentaires sur segments ; gestionnaire de mémos ; indicateurs 📝 dans les arbres |
| **Analyse (§2.6)** | Matrice codes × documents (cliquable), matrice de co-occurrences, comparaison de groupes par variable, fréquences de mots (anti-dictionnaire FR/EN), KWIC (mots en contexte), statistiques descriptives, **statistiques avancées** : test du χ² d'indépendance (valeur p exacte par fonction gamma incomplète), V de Cramér, corrélations de Spearman/Pearson entre codes avec matrice colorée, **pont R/SPSS/jamovi** (matrice documents × codes CSV + script R prêt à exécuter) |
| **Audio / vidéo (§2.2, §2.7)** | **Lecteur audio et vidéo horodaté** : transcription assistée (image vidéo affichée, vitesse 0,5×–2×, Ctrl+Espace/B/T), horodatages `[mm:ss]` cliquables dans les transcriptions (saut au moment exact), panneau vidéo repliable au-dessus du texte, média 100 % local jamais téléversé, **codage direct sur la piste** (⏺ début/fin d'extrait → code + note, relecture au clic) |
| **Visualisation (§2.7)** | Portrait de document (séquence colorée des segments), nuage de mots, diagramme de fréquences des codes, **cartes conceptuelles SVG** (nœuds déplaçables, flèches, plusieurs cartes par projet, export .svg) |
| **Rapports & exports (§2.8)** | Export CSV des segments (compatible Excel), export du système de codes, export CSV de la matrice, **rapport Word (.docx) natif** (archive ZIP + WordprocessingML générés sans bibliothèque), **export ET import REFI-QDA (.qdpx)** — échange bidirectionnel avec MAXQDA, NVivo et ATLAS.ti (lecture ZIP native deflate, hiérarchie de codes, codages, variables via Cases) —, rapport HTML imprimable (→ PDF via l'impression navigateur), export/import du projet `.projx` |
| **Sécurité (§2.1, §3.4)** | Protection du projet par mot de passe : fichier `.projx` chiffré en **AES-256-GCM**, clé dérivée par PBKDF2 (310 000 itérations, SHA-256) via l'API Web Crypto native |
| **Équipe (§2.1, §2.9)** | **Fusion de projets** (appariement des documents, codes et mémos ; segments étiquetés par codeur) et **accord inter-codeurs par kappa de Cohen** (unité : le paragraphe, par code + global, interprétation Landis & Koch) — critère d'acceptation n°4 du cahier des charges — et **collaboration par dossier partagé** (File System Access : chaque codeur publie sa copie dans un dossier synchronisé Drive/Dropbox/USB, détection des nouveautés, fusion en un clic, copie chiffrée si le projet est protégé), **collaboration en temps réel** (client WebSocket + serveur de relais fourni `server/sync-server.mjs`, zéro dépendance, aucun stockage serveur : chaque codeur possède ses segments, présence en direct, reconnexion automatique) |

## 🗺️ Feuille de route (fonctionnalités du cahier des charges non couvertes par ce MVP)

- **Import RTF / ODT** (§2.2) — DOCX et PDF sont déjà couverts.
- **Transcription automatique de la parole** (§2.2) — la transcription assistée et l'OCR des scans sont couverts ; la reconnaissance vocale nécessiterait un modèle local (Whisper WASM) ou une API.
- **Empaquetage desktop** Windows/macOS : la base web actuelle est directement intégrable dans **Tauri** ou **Electron** (options recommandées §4).

## 🖱️ Ergonomie
- **Palette de commandes (Ctrl+K)** : toutes les actions au clavier, avec filtrage instantané.
- Raccourcis globaux : Ctrl+S (enregistrer), Ctrl+F (recherche), Ctrl+Z/Y (annuler/rétablir), Alt+C (coder), F1 (aide).
- Focus visible au clavier, animations réduites si le système le demande (accessibilité).

## 🌐 Serveur de synchronisation (collaboration temps réel)

```bash
node server/sync-server.mjs 8765   # zéro dépendance, ne stocke aucune donnée
```
Chaque membre de l'équipe : **Accueil → 🌐 Temps réel (serveur)** → adresse `ws://…`, salle commune,
nom de codeur. Les codages apparaissent chez les autres en direct (modèle sans conflit : chaque codeur
est propriétaire de ses segments). En production, placer derrière un proxy TLS (`wss://`).

## 🏗️ Architecture

```
index.html          Structure : ruban + 4 volets + modales
css/style.css       Thèmes clair/sombre (variables CSS), mise en page en grille
js/app.js           Contrôleur principal : interface, codage, récupération, modales
js/state.js         Modèle de données du projet + persistance (autosave)
js/i18n.js          Internationalisation (12 langues, repli sur FR, RTL arabe)
js/langs.js         Dictionnaires des 10 langues supplémentaires
js/analysis.js      Recherche booléenne, lexicométrie, matrices
js/export.js        Exports CSV, rapport imprimable, conteneur .projx
js/docx.js          Import DOCX natif (lecture ZIP + WordprocessingML)
js/docxout.js       Export Word natif (écriture ZIP/CRC-32 + WordprocessingML)
js/pdf.js           Import PDF natif (FlateDecode + opérateurs de texte BT/ET)
js/refi.js          Export REFI-QDA .qdpx (XML urn:QDA-XML + sources texte)
js/conceptmap.js    Éditeur de cartes conceptuelles SVG (nœuds, flèches, export)
js/audio.js         Lecteur audio/vidéo horodaté (transcription, horodatages cliquables)
js/social.js        Import réseaux sociaux sans API (WhatsApp, CSV/JSON de posts)
js/ai.js            Suggestions de codage IA (clé utilisateur, validation humaine)
js/sync.js          Collaboration par dossier partagé (File System Access)
js/imagecode.js     Codage de zones d'images (rectangles normalisés, calques)
js/ocr.js           OCR des PDF scannés (extraction JPEG native + IA, clé utilisateur)
js/biblio.js        Références bibliographiques (RIS/BibTeX → liste APA)
js/stats.js         Statistiques avancées (χ², V de Cramér, corrélations, pont R)
js/realtime.js      Client temps réel WebSocket (contribution par codeur)
server/sync-server.mjs  Serveur de relais WebSocket (RFC 6455, zéro dépendance)
js/crypto.js        Chiffrement AES-256-GCM du .projx (PBKDF2, Web Crypto)
js/merge.js         Fusion de projets + kappa de Cohen (accord inter-codeurs)
js/sample.js        Projet exemple (étude sur le télétravail)
```

**Modèle de données** (`.projx`, JSON) : `documents`, `documentGroups`, `codes` (hiérarchie par `parentId`),
`segments` (offsets de caractères `start`/`end` dans le texte source, poids, commentaire), `memos`, `variables`,
`savedQueries` (combinaisons de filtres), `conceptMaps` (nœuds/arêtes), `trash`.

Aucune dépendance externe : HTML/CSS/JavaScript natifs (modules ES), fonctionne hors ligne,
données 100 % locales par défaut (conformité RGPD §3.4 : aucune télémétrie).
