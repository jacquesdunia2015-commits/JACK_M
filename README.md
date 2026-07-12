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
- **Thèmes clair / sombre** (bouton 🌓) et **interface bilingue FR / EN** (bouton 🌐), extensible.
- Numérotation des paragraphes, détection des locuteurs dans les transcriptions (`Nom :` en début de ligne).

## ✨ Fonctionnalités livrées

| Domaine (réf. cahier des charges) | Fonctionnalités |
|---|---|
| **Gestion de projet (§2.1)** | Création, sauvegarde/ouverture dans un fichier conteneur unique `.projx` (JSON), sauvegarde automatique locale (localStorage), corbeille interne pour documents et codes |
| **Importation (§2.2)** | Fichiers **DOCX** (extraction native sans dépendance : lecture ZIP via `DecompressionStream` + analyse de `word/document.xml`), **PDF** (extraction de texte native : décompression FlateDecode + analyse des opérateurs de texte — PDF « texte », pas les scans), TXT/MD, collage de texte, enquêtes CSV (réponses courtes → variables, réponses longues → texte), texte structuré (balises `#DOC`) |
| **Organisation (§2.3)** | Groupes de documents (glisser-déposer), variables de document, navigateur avec numérotation des paragraphes, recherche plein texte booléenne (ET / OU / "phrase") |
| **Codage (§2.4)** | Codes et sous-codes en arborescence illimitée avec couleurs, codage par sélection de texte (menu contextuel), codage in vivo, raccourci clavier `Alt+C`, codage automatique par recherche lexicale (occurrence / phrase / paragraphe), pondération des segments, fusion visuelle des chevauchements, fréquences en temps réel, glisser-déposer des codes |
| **Récupération (§2.4)** | Activation de documents et de codes (✅), modes **OU** et **ET** (intersection/chevauchement), saut au passage source, **requêtes sauvegardées** (combinaisons de filtres réutilisables, stockées dans le `.projx`), **recodage par glisser-déposer** (tirer une carte segment sur un code) |
| **Mémos (§2.5)** | Mémos de projet, de document et de code ; commentaires sur segments ; gestionnaire de mémos ; indicateurs 📝 dans les arbres |
| **Analyse (§2.6)** | Matrice codes × documents (cliquable), matrice de co-occurrences, comparaison de groupes par variable, fréquences de mots (anti-dictionnaire FR/EN), KWIC (mots en contexte), statistiques descriptives des variables |
| **Visualisation (§2.7)** | Portrait de document (séquence colorée des segments), nuage de mots, diagramme de fréquences des codes, **cartes conceptuelles SVG** (nœuds déplaçables, flèches, plusieurs cartes par projet, export .svg) |
| **Rapports & exports (§2.8)** | Export CSV des segments (compatible Excel), export du système de codes, export CSV de la matrice, **rapport Word (.docx) natif** (archive ZIP + WordprocessingML générés sans bibliothèque), **export REFI-QDA (.qdpx)** — format d'échange standard importable dans MAXQDA, NVivo et ATLAS.ti —, rapport HTML imprimable (→ PDF via l'impression navigateur), export/import du projet `.projx` |
| **Sécurité (§2.1, §3.4)** | Protection du projet par mot de passe : fichier `.projx` chiffré en **AES-256-GCM**, clé dérivée par PBKDF2 (310 000 itérations, SHA-256) via l'API Web Crypto native |
| **Équipe (§2.1, §2.9)** | **Fusion de projets** (appariement des documents, codes et mémos ; segments étiquetés par codeur) et **accord inter-codeurs par kappa de Cohen** (unité : le paragraphe, par code + global, interprétation Landis & Koch) — critère d'acceptation n°4 du cahier des charges |

## 🗺️ Feuille de route (fonctionnalités du cahier des charges non couvertes par ce MVP)

- **Import RTF / ODT** (§2.2) — DOCX et PDF sont déjà couverts.
- **Médias audio / vidéo / images et transcriptions horodatées** (§2.2, §2.7) — lecture synchronisée FFmpeg côté desktop.
- **Import réseaux sociaux et références bibliographiques** (§2.2).
- **Import REFI-QDA** (§2.8) — l'export `.qdpx` est couvert ; l'import (lecture des projets MAXQDA/NVivo) reste à faire.
- **Phase 2 cloud** : collaboration temps réel, rôles, journal des modifications (la fusion asynchrone et le kappa de Cohen sont déjà couverts).
- **Empaquetage desktop** Windows/macOS : la base web actuelle est directement intégrable dans **Tauri** ou **Electron** (options recommandées §4).

## 🏗️ Architecture

```
index.html          Structure : ruban + 4 volets + modales
css/style.css       Thèmes clair/sombre (variables CSS), mise en page en grille
js/app.js           Contrôleur principal : interface, codage, récupération, modales
js/state.js         Modèle de données du projet + persistance (autosave)
js/i18n.js          Internationalisation FR/EN (extensible)
js/analysis.js      Recherche booléenne, lexicométrie, matrices
js/export.js        Exports CSV, rapport imprimable, conteneur .projx
js/docx.js          Import DOCX natif (lecture ZIP + WordprocessingML)
js/docxout.js       Export Word natif (écriture ZIP/CRC-32 + WordprocessingML)
js/pdf.js           Import PDF natif (FlateDecode + opérateurs de texte BT/ET)
js/refi.js          Export REFI-QDA .qdpx (XML urn:QDA-XML + sources texte)
js/conceptmap.js    Éditeur de cartes conceptuelles SVG (nœuds, flèches, export)
js/crypto.js        Chiffrement AES-256-GCM du .projx (PBKDF2, Web Crypto)
js/merge.js         Fusion de projets + kappa de Cohen (accord inter-codeurs)
js/sample.js        Projet exemple (étude sur le télétravail)
```

**Modèle de données** (`.projx`, JSON) : `documents`, `documentGroups`, `codes` (hiérarchie par `parentId`),
`segments` (offsets de caractères `start`/`end` dans le texte source, poids, commentaire), `memos`, `variables`,
`savedQueries` (combinaisons de filtres), `conceptMaps` (nœuds/arêtes), `trash`.

Aucune dépendance externe : HTML/CSS/JavaScript natifs (modules ES), fonctionne hors ligne,
données 100 % locales par défaut (conformité RGPD §3.4 : aucune télémétrie).
