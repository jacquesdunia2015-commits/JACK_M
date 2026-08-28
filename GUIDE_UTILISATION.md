# 📖 Guide d'utilisation de QualiCode

*Un guide simple, pas à pas, pour analyser vos entretiens et vos textes de recherche.*

> 💡 Ce guide est aussi **téléchargeable en PDF depuis l'application** :
> onglet **Accueil → groupe « Documentation » → 📖 Guide (PDF)**.
> Si vous n'avez **jamais** fait d'analyse qualitative, commencez plutôt par le
> **Manuel du débutant complet (A → Z)** — mêmes boutons, 🎓 Manuel débutant
> (PDF) — qui explique aussi les concepts (codage, segments, mémos…).

---

## 1. C'est quoi, QualiCode ?

QualiCode est un logiciel qui vous aide à **analyser des textes** : entretiens, groupes de discussion, réponses à des questionnaires, articles…

Le principe est simple :

1. Vous **importez** vos textes.
2. Vous **surlignez** les passages importants et vous leur donnez une étiquette (un « **code** », par exemple *« Isolement »* ou *« Motivation »*).
3. Le logiciel **rassemble** ensuite pour vous tous les passages qui portent le même code, et fait des **tableaux et des graphiques**.

Vos données restent **sur votre ordinateur**. Rien n'est envoyé sur internet.

---

## 2. Ouvrir l'application

**La façon la plus simple** : téléchargez le fichier **QualiCode.html** (dossier `dist` du projet, ou fourni par votre équipe), puis **double-cliquez dessus**. L'application s'ouvre dans votre navigateur — sans installation, sans internet, sans manipulation technique. Vous pouvez copier ce fichier sur une clé USB et l'utiliser sur n'importe quel ordinateur.

*Autre possibilité (en ligne)* : ouvrez votre navigateur à l'adresse **https://jacquesdunia2015-commits.github.io/JACK_M/** (si votre réseau y donne accès). Même en ligne, **vos données restent sur votre ordinateur** : le site ne fait que fournir l'application, il ne reçoit jamais vos textes.

*Autre possibilité (sources)* : téléchargez le dossier du projet, ouvrez un terminal dedans, tapez `python3 -m http.server 8080` puis allez sur **http://localhost:8080**.

Au premier lancement, un **projet exemple** s'ouvre : une étude sur le télétravail **entièrement terminée** — 3 entretiens + 1 focus group codés de bout en bout (32 segments pondérés et commentés), mémos de définition des codes, mémo de résultats du projet, 4 requêtes sauvegardées, une carte conceptuelle « Modèle des résultats » et une bibliographie APA. Explorez-le pour voir à quoi ressemble une analyse complète, puis réinitialisez-le à tout moment (Accueil → Projet exemple).

> 💡 En haut à droite : le bouton **🌐** change la langue (français/anglais) et le bouton **🌓** passe en mode sombre.

---

## 3. Comprendre l'écran

L'écran est découpé en **4 zones** (vous pouvez les agrandir ou les réduire en tirant les bordures) :

| Zone | À quoi elle sert |
|---|---|
| **📄 Système de documents** (en haut à gauche) | La liste de vos textes, rangés dans des dossiers |
| **🏷️ Système de codes** (en bas à gauche) | La liste de vos étiquettes (codes), avec leurs couleurs |
| **📖 Navigateur de document** (en haut à droite) | Le texte que vous êtes en train de lire et de coder |
| **🧲 Segments récupérés** (en bas à droite) | Tous les passages codés que vous avez demandé à voir |

Tout en haut, un **ruban d'onglets** (Accueil, Importer, Codes, Mémos…) donne accès à toutes les fonctions, comme dans Word ou Excel.

---

## 4. Créer un projet et importer vos textes

### Créer un projet
- Onglet **Accueil** → **🗂️ Nouveau projet** → donnez-lui un nom.

### Retrouver vos projets : le bouton « 📚 Mes projets »
- Onglet **Accueil** → **📚 Mes projets** : la liste de **tous les projets commencés sur cet ordinateur** s'affiche, avec leur date et leur contenu (documents, codes, segments).
- Cliquez sur **Ouvrir** pour passer d'un projet à l'autre — le projet en cours est sauvegardé automatiquement avant la bascule.
- Le bouton 🗑️ supprime un projet de l'ordinateur (enregistrez-le d'abord en `.projx` si vous voulez le garder).
- À l'ouverture de l'application, c'est toujours **votre dernier projet** qui se rouvre tout seul.

> 💡 « Mes projets » liste les projets de **cet ordinateur et de ce navigateur**. Pour emporter un projet ailleurs, utilisez 💾 Enregistrer (.projx) puis 📂 Ouvrir (.projx) sur l'autre machine.

### Importer vos textes (onglet **Importer**)
Vous avez 4 façons de faire :

- **📄 Fichiers (DOCX, PDF, TXT, MD)** : choisissez vos fichiers Word (.docx), PDF ou texte. C'est la méthode la plus courante. *(PDF : seuls les PDF « texte » fonctionnent — un PDF scanné est une photo, son texte ne peut pas être extrait.)*
- **📋 Coller un texte** : copiez-collez directement un texte.
- **📊 Enquête CSV** : importez un tableau de réponses (une ligne = une personne). Les réponses courtes (âge, sexe…) deviennent automatiquement des « variables », les réponses longues deviennent le texte à coder.
- **🧩 Texte structuré** : collez plusieurs entretiens d'un coup, séparés par des lignes `#DOC Nom de l'entretien`.
- **🎙️ Transcrire un audio/vidéo** : choisissez l'enregistrement de votre entretien (téléphone, dictaphone, **ou une vidéo** — l'image s'affiche alors au-dessus de la zone de texte) — une fenêtre s'ouvre avec un **lecteur** et une zone de texte. Vous écoutez et vous tapez. Astuces : réduisez la **vitesse à 0,5×** pour taper en écoutant ; **Ctrl+Espace** met en pause ; **Ctrl+B** recule de 5 secondes ; **Ctrl+T** insère l'heure exacte `[12:34]` à l'endroit où vous tapez. L'audio reste sur votre ordinateur, rien n'est envoyé sur internet.
- **🖼️ Photos et images** : choisissez une image (photo de terrain, affiche, dessin d'un participant…) avec 📄 Fichiers — elle devient un document à part entière. Pour la coder : **tracez un rectangle** sur la zone qui vous intéresse et choisissez un code — la zone se colore avec une étiquette. Cliquez sur une zone pour la commenter, la pondérer ou la supprimer.
- **📄 PDF scanné (OCR)** : si un PDF est un scan (photos de pages, sans texte), QualiCode vous propose automatiquement la **reconnaissance de texte par IA** : il extrait les pages et les fait transcrire avec votre clé API (comme les Suggestions IA). Vous **relisez et corrigez** le texte avant de l'ajouter au projet. ⚠️ Les pages partent vers le service d'IA : uniquement pour des documents non nominatifs ou avec autorisation éthique.
- **📚 Bibliographie (RIS/BibTeX)** : importez vos références depuis **Zotero, EndNote ou Mendeley** (export .ris ou .bib). Elles sont conservées dans le projet et exportables en **liste formatée style APA** — prête à coller dans le chapitre Références de votre mémoire.
- **📱 Réseaux sociaux (export)** : importez une **discussion WhatsApp** (dans WhatsApp : ouvrir la discussion → ⋮ → Plus → Exporter la discussion → *Sans fichiers médias* → choisissez le fichier .txt obtenu) ou un **fichier CSV/JSON** de publications (tweets, commentaires YouTube…). QualiCode reconnaît le format tout seul : les messages WhatsApp deviennent un entretien avec les locuteurs mis en évidence ; pour un CSV/JSON, vous choisissez quelles colonnes contiennent l'auteur, le texte et la date. ⚠️ N'importez une discussion qu'avec le **consentement** de ses participants.

### Coder directement sur la piste audio/vidéo ⏺
Sans passer par le texte : dans la barre de lecture, cliquez **⏺ Coder un extrait** au début du passage, laissez jouer (ou avancez), puis cliquez à nouveau à la fin — choisissez le code et ajoutez une note (« ton hésitant », « rires »…). L'extrait apparaît dans les Segments récupérés avec son intervalle `[🎧 12:34–13:10]` ; cliquer dessus relance l'écoute au bon moment. Idéal pour capturer l'intonation ou les silences que la transcription ne rend pas.

### Réécouter ou revoir un passage pendant le codage 🎧🎬
Si votre transcription contient des horodatages `[12:34]`, ils deviennent **cliquables** : un clic fait démarrer l'audio — ou la **vidéo**, dont l'image s'affiche au-dessus du texte (masquable avec le bouton 🎬) — à ce moment précis — pratique pour vérifier un verbatim ou une intonation. Associez d'abord le fichier audio ou vidéo à l'entretien avec le bouton **🎧** (en haut du volet de lecture). L'audio étant trop volumineux pour être gardé dans le navigateur, il faudra le réassocier à chaque nouvelle session (l'application vous rappelle le nom du fichier attendu).

### Ranger vos textes
- **📁 Nouveau groupe** crée un dossier (par exemple « Entretiens femmes », « Entretiens hommes »).
- Faites **glisser** un document sur un dossier pour l'y ranger.

> 💡 L'application **enregistre toute seule** votre travail dans le navigateur. Pour garder une copie de sauvegarde ou partager le projet, utilisez **Accueil → 💾 Enregistrer (.projx)** : cela télécharge un fichier unique qui contient tout votre projet.

---

## 5. Coder un texte (le cœur du travail)

### Créer vos codes
- Onglet **Codes** → **🏷️ Nouveau code** : donnez un nom (ex. *« Difficultés »*) et choisissez une couleur.
- Vous pouvez créer des **sous-codes** à l'infini (ex. *« Difficultés » → « Isolement » → « Chez les jeunes »*) : cliquez sur le **＋** qui apparaît quand vous survolez un code.
- Pour réorganiser : **glissez** un code sur un autre pour en faire son sous-code.

### Coder un passage
1. Cliquez sur un document (à gauche) pour l'ouvrir.
2. **Sélectionnez un passage** avec la souris, comme pour surligner.
3. Un petit menu apparaît : **cliquez sur le code** à appliquer. C'est tout ! Le passage se colore.

Trois autres façons de coder :
- **In vivo** : le passage sélectionné devient lui-même un nouveau code (utile pour garder les mots exacts des personnes interrogées).
- **Raccourci Alt+C** : applique au passage sélectionné le code actuellement choisi dans la liste.
- **⚡ Codage automatique** : tapez un mot (ex. « fatigue »), choisissez un code, et le logiciel code automatiquement toutes les phrases qui contiennent ce mot.

### 🤖 Se faire aider par l'IA (facultatif)
Onglet **Codes → 🤖 Suggestions IA** : l'intelligence artificielle lit l'entretien ouvert et votre liste de codes, puis **propose** des passages à coder — avec une justification pour chacun. Vous cochez ce que vous acceptez, décochez ce que vous refusez, puis cliquez sur *Appliquer* : **rien n'est codé sans votre accord**.

À savoir :
- Il faut une **clé API personnelle** (créez-la sur console.anthropic.com — l'usage coûte quelques centimes par document) et une connexion internet.
- La clé reste **sur votre ordinateur**, jamais dans le fichier projet.
- ⚠️ **N'utilisez cette fonction que sur des textes anonymisés** : le texte du document est envoyé au service d'IA. Une case de confirmation vous le rappelle à chaque envoi. En cas de doute (données de santé identifiantes), codez à la main.
- L'IA est un **assistant, pas un remplaçant** : dans votre mémoire, indiquez que le codage a été validé par vous (les jurys y sont attentifs).

### Modifier ou supprimer un codage
Cliquez sur un passage surligné : une fiche s'ouvre. Vous pouvez y ajouter un **commentaire**, un **poids** (importance de 1 à 100), ou **retirer le code**.

---

## 6. Retrouver les passages codés

C'est la récompense du codage ! Dans les listes de gauche :

1. Cliquez sur le **✅** devant les documents qui vous intéressent (ils s'activent).
2. Cliquez sur le **✅** devant les codes qui vous intéressent.
3. Tous les passages correspondants s'affichent en bas à droite, dans **Segments récupérés**.

- Le menu en haut de cette zone permet de choisir **OU** (les passages qui ont *au moins un* des codes activés) ou **ET** (les passages où *plusieurs* codes se chevauchent).
- Cliquez sur le nom du document dans un résultat pour **retourner au passage** dans son contexte.
- Les boutons **⬇ CSV** et **🖨️** exportent ou impriment ces résultats.

> 💡 Le bouton ✅ dans l'en-tête de chaque volet active/désactive **tout** d'un coup.

### Changer le code d'un passage (recodage)
Vous vous êtes trompé de code ? **Attrapez une carte de résultat avec la souris et déposez-la sur le bon code** dans le volet Codes (en bas à gauche). Le passage change de code instantanément. (Annulable avec Ctrl+Z.)

### Sauvegarder une combinaison de filtres (requêtes)
Vous consultez souvent la même combinaison (par exemple : tous les entretiens femmes + le code « Obstacles ») ?
1. Activez vos documents et codes comme d'habitude.
2. Onglet **Analyse** → **📋 Requêtes sauvegardées** → **💾 Sauvegarder la requête courante** → donnez un nom.
3. La prochaine fois : ouvrez la liste et cliquez sur **Charger** — tous vos filtres se remettent en place d'un coup.

---

## 7. Prendre des notes (mémos)

Un travail rigoureux garde une trace des idées :

- **📝 sur un document** : survolez-le et cliquez sur 📝 (vos impressions sur un entretien).
- **📝 sur un code** : sa définition, ses règles d'application.
- **Mémo du projet** (onglet Mémos) : votre journal d'analyse général.
- Le **🗒️ Gestionnaire de mémos** rassemble toutes vos notes au même endroit.

Un petit 📝 apparaît dans les listes à côté de tout élément qui a un mémo.

---

## 8. Les variables (qui a dit quoi ?)

Les variables décrivent vos documents : âge, sexe, région, métier…

1. Onglet **Variables** → **🧮 Liste des variables** : créez vos variables.
2. **📋 Éditeur de données** : remplissez le tableau (une ligne par document).
3. Ensuite, dans l'onglet **Analyse** → **⚖️ Comparaison de groupes**, vous verrez par exemple si les *femmes* et les *hommes* parlent différemment de l'*isolement*.

---

## 9. Rechercher dans les textes

Dans l'onglet **Accueil**, la barre de recherche fouille **tous** vos textes :

- `télétravail fatigue` → passages contenant les deux mots ;
- `télétravail OU visio` → l'un ou l'autre ;
- `"machine à café"` → l'expression exacte.

Cliquez sur un résultat pour ouvrir le passage.

---

## 10. Analyser et visualiser

Onglet **Analyse** :
- **🧮 Matrice des codes** : un tableau codes × documents avec le nombre de passages. Cliquez sur une case pour voir les passages correspondants.
- **🔗 Co-occurrences** : quels codes apparaissent souvent *ensemble* au même endroit.
- **🔤 Fréquences de mots** : les mots les plus utilisés (les petits mots comme « le », « de » sont ignorés).
- **📖 KWIC** : un mot affiché avec son contexte à gauche et à droite, à chaque apparition.
- **📈 Statistiques** : le résumé de vos variables (combien de femmes, d'hommes, etc.).

Onglet **Visualisation** :
- **🎨 Portrait de document** : le film coloré d'un entretien (chaque rectangle = un passage codé, dans l'ordre).
- **☁️ Nuage de mots** : les mots fréquents, en grand.
- **📊 Fréquences des codes** : le poids de chaque code en barres colorées.
- **🗺️ Carte conceptuelle** : dessinez votre modèle théorique ! Créez des boîtes (vos concepts), déplacez-les, reliez-les par des flèches, puis exportez le schéma en image SVG pour l'insérer dans votre mémoire. Mode d'emploi : **＋ Nœud** puis cliquez sur le fond pour créer une boîte ; **→ Relier** puis cliquez sur deux boîtes pour tracer une flèche ; double-cliquez sur une boîte pour la renommer.

Onglet **Rapports** : exportez les segments (CSV pour Excel), la matrice, le système de codes, un **rapport Word (.docx)** prêt à remettre (segments regroupés par code, avec les couleurs), un **rapport imprimable** (qui peut être enregistré en PDF), ou le projet complet au format **REFI-QDA (.qdpx)** — le format d'échange standard : ce fichier s'ouvre directement dans **MAXQDA, NVivo ou ATLAS.ti** (pratique si votre directeur de mémoire utilise un de ces logiciels).

---

## 11. Protéger votre projet par mot de passe

Si vos données sont sensibles (c'est souvent le cas en recherche) :

1. Onglet **Accueil** → **🔒 Mot de passe**.
2. Saisissez deux fois votre mot de passe → la protection s'active.
3. Désormais, le fichier `.projx` téléchargé avec **💾 Enregistrer** est **chiffré** (norme AES-256) : impossible de le lire sans le mot de passe.

⚠️ **Important : si vous oubliez ce mot de passe, personne ne pourra récupérer le fichier.** Notez-le en lieu sûr.

---

## 12. Travailler à plusieurs (fusion et accord entre codeurs)

### La façon la plus simple : le dossier partagé 🔄
Si votre équipe a un dossier commun (Google Drive, Dropbox, OneDrive, clé USB qui circule, partage réseau) :

1. Chacun ouvre **Accueil → 🔄 Dossier partagé**, choisit le dossier commun et entre son **nom de codeur**.
2. Chacun clique **📤 Publier ma copie** : son projet est déposé dans le dossier (un fichier par personne, donc jamais de conflit). Republiez après chaque séance de codage.
3. Pour récupérer le travail des autres : **🔍 Vérifier les nouveautés** — les copies des collègues apparaissent avec leur état (🆕 nouveau, 🔁 mis à jour, ✅ déjà fusionné) → cliquez **🧬 Fusionner** (le nom du codeur est pré-rempli).
4. Puis **Analyse → 🤝 Accord inter-codeurs (κ)** comme d'habitude.

À savoir : le navigateur demande de re-choisir le dossier à chaque session (règle de sécurité) ; cette fonction nécessite **Chrome ou Edge** (sur Firefox, utilisez l'échange manuel ci-dessous) ; si le projet est protégé par mot de passe, la copie publiée est **chiffrée** — toute l'équipe doit connaître le mot de passe.

### L'échange manuel (marche partout)
Quand deux personnes codent les mêmes entretiens (chacune de son côté) :

1. Chaque personne travaille dans sa copie et **enregistre son fichier .projx**.
2. L'une des deux ouvre son projet, puis fait **Accueil → 🧬 Fusionner (.projx)** et choisit le fichier de l'autre.
3. Donnez un nom au deuxième codeur (ex. « Marie ») → les deux codages sont réunis dans un seul projet.
4. Onglet **Analyse** → **🤝 Accord inter-codeurs (κ)** : le logiciel calcule le **kappa de Cohen**, un score scientifique qui mesure si les deux personnes codent de la même façon :

| Kappa | Lecture |
|---|---|
| en dessous de 0,40 | accord faible — il faut discuter des définitions des codes |
| 0,41 à 0,60 | accord modéré |
| 0,61 à 0,80 | accord fort |
| au-dessus de 0,80 | accord quasi parfait ✨ |

---

## 13. Aller plus vite : la palette de commandes ⌨️

Appuyez sur **Ctrl+K** n'importe où : une barre s'ouvre, tapez le début d'une action (« fusionner », « nuage », « rapport »…) et validez avec Entrée — plus besoin de chercher le bouton. Autres raccourcis : **Ctrl+S** enregistre le .projx, **Ctrl+F** va à la recherche, **F1** affiche tous les raccourcis (aussi via le bouton ⌨️ en haut à droite).

## 14. Les statistiques avancées 📐

Onglet **Analyse → 📐 Statistiques avancées** :
- **Croisement code × variable (χ²)** : par exemple « le code *Obstacles financiers* dépend-il du *sexe* ? ». Le logiciel affiche le tableau, le χ², la valeur p, le V de Cramér **et une phrase d'interprétation en clair** (significatif ou non). Un avertissement s'affiche si l'échantillon est trop petit.
- **Corrélations entre codes** : quels thèmes varient ensemble d'un entretien à l'autre (matrice colorée, bleu = ensemble, rouge = opposés).
- **Pont R / SPSS / jamovi** : téléchargez la matrice documents × codes (+ variables) en CSV et un **script R prêt à exécuter** — pour les analyses mixtes poussées de votre mémoire ou vos articles.

## 15. Travailler à plusieurs EN DIRECT 🌐

Si votre équipe dispose d'un serveur de synchronisation (fichier `server/sync-server.mjs` du projet, lancé avec `node server/sync-server.mjs` sur une machine accessible) :
1. Chacun ouvre **Accueil → 🌐 Temps réel (serveur)**, entre l'adresse (`ws://adresse:8765`), la même **salle** et son **nom de codeur**.
2. C'est tout : les codages de chacun apparaissent chez les autres **en direct** (indicateur 🟢 en bas de l'écran avec la liste des personnes connectées).
3. Chaque codeur reste propriétaire de ses segments — aucun conflit possible — et le kappa se calcule à tout moment.
4. Le serveur ne stocke **aucune donnée** : il fait passer les messages, c'est tout. Si la connexion tombe, l'application se reconnecte toute seule et vous continuez hors ligne sans rien perdre.

> 💡 Pas de serveur ? Le **🔄 Dossier partagé** (section 12) reste la solution simple.

## 16. Petites questions fréquentes

**J'ai supprimé un document ou un code par erreur !**
→ **Accueil → 🗑️ Corbeille** : cliquez sur *Restaurer*.

**Puis-je travailler avec des centaines ou des milliers de documents ?**
→ Oui. Le stockage utilise une base interne du navigateur (IndexedDB) sans la limite des anciens systèmes, l'affichage de la liste reste rapide (plafonné avec message), et la **case Filtrer…** en haut du volet Documents retrouve n'importe quel document instantanément.

**Puis-je ouvrir un projet venant de MAXQDA, NVivo ou ATLAS.ti ?**
→ Oui : exportez-le depuis ce logiciel au format **REFI-QDA (.qdpx)**, puis dans QualiCode : **Accueil → 📂 Ouvrir** et choisissez le fichier .qdpx — documents, codes (avec leur hiérarchie), codages et variables sont repris. L'inverse marche aussi (Rapports → REFI-QDA).

**Où est enregistré mon travail ?**
→ Automatiquement dans votre navigateur, sur votre ordinateur (regardez « ✓ Sauvegarde automatique » en bas à droite). Tous vos projets sont visibles dans **Accueil → 📚 Mes projets**. Pour une copie durable ou pour changer d'ordinateur : **💾 Enregistrer (.projx)**, puis **📂 Ouvrir (.projx)** sur l'autre machine.

**Comment reprendre un projet commencé hier ?**
→ Rouvrez simplement l'application : le dernier projet se rouvre tout seul. S'il ne s'agit pas du bon, **Accueil → 📚 Mes projets** → cliquez sur **Ouvrir** à côté du projet voulu.

**Un passage peut-il avoir plusieurs codes ?**
→ Oui ! Sélectionnez-le à nouveau et appliquez un autre code. Les chevauchements sont soulignés ; cliquez dessus pour choisir quel code consulter.

**Puis-je changer un code de place ?**
→ Oui, glissez-le sur un autre code (il devient sous-code) ou dans le vide (il redevient un code principal).

**L'application marche-t-elle sans internet ?**
→ Oui, entièrement. Aucune donnée ne quitte votre ordinateur.

## 17. Mot de passe d'ouverture et verrouillage d'écran 🔐

En plus du chiffrement du fichier `.projx` (section 11), vous pouvez exiger un
mot de passe **à chaque ouverture de QualiCode**, avant tout accès aux projets :

1. Accueil → **🔐 Mot de passe app** ;
2. tapez le mot de passe deux fois → « Définir le mot de passe » ;
3. c'est fait : au prochain lancement, l'écran de déverrouillage apparaîtra.

Un bouton **🔒** apparaît en haut à droite : cliquez-le pour verrouiller
l'écran quand vous quittez votre poste (comme `Windows + L`).

⚠️ Ce mot de passe n'est **pas récupérable** en cas d'oubli — notez-le en lieu
sûr. Pour le changer ou le supprimer : Accueil → 🔐 (le mot de passe actuel est
demandé).

## 18. Essai gratuit, abonnement et activation 💳

- À la première ouverture, vous disposez d'un **essai gratuit complet de
  5 jours** (l'état est affiché dans la barre du bas).
- À la fin de l'essai, un écran vous demande une **clé de licence**. Vos
  données ne sont jamais bloquées : « Exporter mes données » reste disponible.
- Pour acheter : **💳 Abonnement** → choisissez une formule (jour, semaine,
  mois, an, à vie) → payez par le canal indiqué (mobile money Orange/MTN/
  Airtel, carte Visa/Mastercard, Stripe, PayPal, cryptomonnaie) → envoyez la
  preuve au contact affiché → vous recevez une clé `QC1-…`.
- Collez la clé dans « 💳 Abonnement » → **Activer**. L'activation fonctionne
  **hors ligne** et la barre du bas affiche votre formule et sa date de fin.

**Le code de votre appareil**

En haut de la fenêtre « 💳 Abonnement », QualiCode affiche un **code d'appareil**
(par exemple `K7QP-3M2X`). Communiquez-le au vendeur au moment de l'achat :
votre clé sera **réservée à votre appareil**. C'est une sécurité pour vous
(personne ne peut utiliser votre licence) et pour le vendeur.

Si vous changez de téléphone ou d'ordinateur, ou si vous effacez les données de
votre navigateur, votre code change : demandez simplement une nouvelle clé au
vendeur en lui donnant le nouveau code — c'est gratuit et immédiat.

## 18 bis. La clé API pour le codage par IA 🤖

Les **suggestions de codage par IA** et l'**OCR des PDF scannés** utilisent
votre propre compte Anthropic. La clé n'est PAS fournie avec QualiCode : vous la
créez vous-même, et elle vous appartient.

### Obtenir une clé (une seule fois, 5 minutes)

1. Allez sur **console.anthropic.com** et créez un compte.
2. Ajoutez du crédit (**5 $ suffisent pour des centaines d'entretiens**).
3. Menu **API Keys** → **Create Key** → copiez la clé, qui commence par `sk-ant-`.
   ⚠️ Elle ne s'affiche **qu'une seule fois** : collez-la tout de suite dans
   QualiCode ou notez-la en lieu sûr.

### La saisir, la revoir, l'effacer

Onglet **Codes → 🤖 Suggestions IA** (ouvrez d'abord un document) :

- **Saisir** : collez la clé dans le champ « Clé API Anthropic ».
- **La revoir** : bouton **👁 Afficher** — le champ est masqué par défaut, ce
  bouton révèle la clé pour vérifier qu'elle est complète (une clé tronquée est
  la cause n° 1 des erreurs). Le bouton devient **🙈 Masquer**.
- **L'effacer** : bouton **🗑 Oublier cette clé** — utile sur un ordinateur
  partagé ou avant de prêter votre machine.
- La date d'enregistrement est rappelée sous le champ.

La clé est conservée **sur cet appareil uniquement** : elle n'est jamais
enregistrée dans le fichier `.projx` qui circule entre codeurs. Sur un autre
appareil, il faudra la saisir de nouveau.

### Pratiquer le codage par IA (pas à pas)

1. Ouvrez un document (un entretien transcrit).
2. **Codes → 🤖 Suggestions IA**.
3. Vérifiez la clé (👁 Afficher si vous avez un doute) et choisissez le modèle.
4. **Cochez la case de consentement** : elle confirme que ce document peut être
   envoyé à un service externe. ⚠️ N'envoyez jamais de texte nominatif —
   anonymisez au moment de la transcription (P01, P02…).
5. Cliquez **🔎 Analyser**. Après quelques secondes, l'IA propose une liste de
   passages avec le code suggéré et **la raison** de sa proposition.
6. **Décochez ce qui ne vous convient pas** (c'est vous qui décidez), puis
   **✅ Appliquer** : les segments sont créés, les nouveaux codes ajoutés.
7. Relisez toujours : l'IA propose, le chercheur valide. Les segments créés
   restent modifiables et annulables (`Ctrl+Z`).

### Si un message d'erreur apparaît

| Message | Que faire |
|---|---|
| Clé invalide | Vérifiez avec 👁 Afficher qu'elle est complète et commence par `sk-ant-` |
| Quota / crédit épuisé | Rechargez votre compte sur console.anthropic.com |
| Réponse illisible | Réessayez ; si cela persiste, choisissez un autre modèle |
| Rien ne se passe | Vérifiez votre connexion internet : c'est la seule fonction de QualiCode qui en a besoin |

**Combien ça coûte ?** Quelques centimes par entretien. Vous payez Anthropic
directement, à l'usage — QualiCode ne prend aucune commission et ne voit jamais
votre clé.

---

## 19. Utiliser QualiCode sur téléphone 📱

QualiCode fonctionne sur téléphone Android et iPhone : l'affichage s'adapte tout
seul dès que l'écran est étroit.

**Ouvrir l'application sur le téléphone**
- *Le plus simple* : allez sur l'adresse du site (par exemple
  https://jacquesdunia2015-commits.github.io/JACK_M/) avec Chrome (Android) ou
  Safari (iPhone).
- *Sans internet* : envoyez-vous le fichier `QualiCode.html` (WhatsApp, e-mail,
  clé USB), enregistrez-le dans « Fichiers » puis ouvrez-le avec le navigateur.

**L'installer comme une vraie application** (recommandé)
- Un bandeau **« Installer QualiCode ? »** apparaît tout seul : touchez
  **Installer**. (Si vous répondez « Plus tard », il ne revient pas avant
  deux semaines.) Vous pouvez aussi passer par **Accueil → 📲 Installer
  l'application**.
- L'icône QualiCode s'ajoute à côté de vos autres applications, elle s'ouvre
  en plein écran et **fonctionne ensuite sans connexion**.
- Sur **Android** (Chrome) : **menu ⋮** en haut à droite → « Installer
  l'application ». *(Il n'y a pas de bouton ⬆️ sur Android.)*
- Sur **iPhone/iPad** : ouvrez QualiCode **dans Safari**, touchez
  **Partager (⬆️)** dans la barre du **bas** de Safari, puis faites défiler
  jusqu'à **« Sur l'écran d'accueil »**. Ce bouton n'existe pas dans Chrome ni
  dans le navigateur intégré de WhatsApp.

> ⚠️ **Point essentiel** : on ne peut installer QualiCode que s'il est ouvert
> depuis une **adresse web** (https). Un fichier `QualiCode.html` ouvert depuis
> « Fichiers » ou WhatsApp ne peut jamais être installé — c'est une règle de
> sécurité des navigateurs. Le bouton **📲** de QualiCode vous indique
> exactement ce qui manque et l'adresse à ouvrir.
- **Sur ordinateur aussi** (Windows, Mac, Linux) : avec Chrome ou Edge,
  cliquez l'icône **⊕ / 💻** à droite de la barre d'adresse → « Installer » :
  QualiCode arrive sur le bureau et dans le menu Démarrer, comme un logiciel
  installé. Sans internet, utilisez les scripts du dossier `installateurs`
  (voir `installateurs/LISEZ-MOI.md`).
- Une fois installé : un **clic droit sur l'icône** propose « Mes projets »,
  « Nouveau projet » et « Manuel du débutant », et **double-cliquer un fichier
  `.projx`** ouvre QualiCode avec le projet déjà chargé.

**Installer sur n'importe quel appareil — le tableau complet**

| Appareil | Comment installer |
|---|---|
| **Téléphone Android** (Chrome, Samsung Internet, Firefox, Opera, Edge) | Ouvrez l'adresse du site → menu du navigateur → « Installer l'application » / « Ajouter à l'écran d'accueil » |
| **iPhone** | Ouvrez l'adresse **dans Safari** → Partager ⬆️ (barre du bas) → « Sur l'écran d'accueil » |
| **Tablette Android** | Exactement comme un téléphone Android ; l'écran étant plus large, QualiCode affiche automatiquement la mise en page ordinateur (4 volets) si la tablette dépasse 820 px |
| **iPad** | Comme l'iPhone, mais le bouton Partager ⬆️ est **en haut à droite** |
| **Ordinateur Windows / Mac / Linux avec Chrome ou Edge** | Ouvrez l'adresse → icône ⊕ dans la barre d'adresse → « Installer » |
| **Ordinateur sans internet** | Lancez le script de votre système dans le dossier `installateurs` (Windows `.bat`, Linux `.sh`, macOS `.command`) : l'icône arrive sur le bureau |
| **Ordinateur avec Firefox ou Safari (Mac)** | Ces navigateurs n'installent pas les applications web : utilisez les scripts ci-dessus, ou Chrome/Edge |

> 💡 **Tablette** : tout ce qui est décrit pour le téléphone fonctionne, et le
> codage au doigt y est encore plus confortable. Sur une tablette large, vous
> retrouvez les 4 volets de l'ordinateur.

**Se repérer sur petit écran**
- En bas de l'écran, cinq onglets : **📄 Documents · 🏷️ Codes · 📖 Texte ·
  🧲 Segments · ☰ Menu**. On ne voit qu'un volet à la fois, on passe de l'un à
  l'autre d'un seul appui.
- **☰ Menu** ouvre le ruban (Accueil, Importer, Analyse…) en bas de l'écran :
  **toutes** les fonctions de la version ordinateur y sont. On referme avec ✕
  ou en tapant au-dessus.
- Quand vous touchez un document dans la liste, QualiCode bascule tout de suite
  sur le texte.

**Coder au doigt**
1. Appuyez longuement sur un mot du texte, puis faites glisser les poignées
   bleues pour sélectionner tout le passage (comme pour copier-coller).
2. Le bouton **🏷️ Coder la sélection** apparaît en bas de l'écran : touchez-le.
3. La liste de vos codes s'ouvre en grand : touchez le code voulu. C'est fait.

> 💡 Sur le terrain, la tablette ou le téléphone servent surtout à **relire et
> coder** ; pour la transcription et la rédaction, l'ordinateur reste plus
> confortable. Le même projet passe de l'un à l'autre avec 💾 Enregistrer
> (.projx) puis 📂 Ouvrir (.projx).

## 20. Les formats de fichiers utilisés par QualiCode

Vous croiserez ces extensions dans les fenêtres « Ouvrir » et « Enregistrer » :

| Extension | À quoi elle sert |
|---|---|
| **`.projx`** | **Votre projet QualiCode** : documents, codes, segments, mémos, requêtes, cartes — tout dans un seul fichier. C'est LE fichier à sauvegarder et à transporter. |
| `.qdpx` | **REFI-QDA**, le format d'échange standard : permet d'envoyer votre projet vers MAXQDA, NVivo ou ATLAS.ti — et d'importer les leurs. |
| `.docx` | Documents Word à importer (transcriptions d'entretiens). |
| `.pdf` | Documents PDF à importer (et manuels téléchargés depuis l'application). |
| `.txt` / `.md` | Textes simples, exports WhatsApp. |
| `.csv` | Enquêtes (une ligne = une personne) et exports de tableaux vers Excel. |
| `.json` | Exports de réseaux sociaux (commentaires, publications). |
| `.ris` / `.bib` | Références bibliographiques venant de Zotero, EndNote ou Mendeley. |
| `.svg` | Cartes conceptuelles exportées en image. |
| audio/vidéo (`.mp3`, `.m4a`, `.wav`, `.mp4`, `.webm`…) | Enregistrements d'entretiens à transcrire ou à coder. |

> 💡 Quand QualiCode est **installé** sur un ordinateur, double-cliquer un
> fichier `.projx` ou `.qdpx` l'ouvre directement dans l'application : c'est ce
> que le navigateur demande d'autoriser lors de l'installation.

---

## 21. Afficher le logo de votre organisation et votre drapeau 🏛️🇨🇩

QualiCode peut porter **trois marques côte à côte** dans son en-tête : son
propre logo, celui de votre organisation (APSA, une université, une ONG, un
bureau d'études) et **votre drapeau national**. Les mêmes marques apparaissent
**en tête des rapports imprimables** que vous remettez à un commanditaire.

C'est un vrai argument professionnel : ni MAXQDA, ni NVivo, ni ATLAS.ti ne
laissent une organisation cliente mettre sa propre marque dans le logiciel.

### En quelques clics

1. Onglet **Accueil** → bouton **🏛️ Logo de l'organisation**.
2. **Nom de l'organisation** : par exemple `APSA`. Tant que vous n'avez pas
   chargé d'image, une **vignette portant le sigle** est affichée à la place du
   logo — c'est un repère provisoire, pas le logo officiel.
3. **Choisir une image** : un fichier PNG, JPG, SVG ou WebP. L'image est réduite
   automatiquement à 320 px, inutile d'envoyer un fichier de 5 Mo.
4. **Drapeau national** : cliquez sur une vignette — 🇨🇩 République démocratique
   du Congo, 🇷🇼 Rwanda, 🇧🇯 Bénin, ou *Aucun*.
5. **OK**. Tout apparaît immédiatement à droite du logo QualiCode.

Pour tout enlever : rouvrez la même fenêtre et cliquez **Tout retirer**.

### Ce qu'il faut savoir

| Question | Réponse |
|---|---|
| Où ces réglages sont-ils conservés ? | Dans le navigateur de **cet appareil**, pas dans le fichier projet. |
| Sont-ils envoyés avec mon `.projx` ? | **Non.** Un collègue à qui vous envoyez le projet ne verra pas vos marques — chacun met les siennes. |
| Apparaissent-ils dans les rapports ? | Oui, en haut du **rapport imprimable** (et donc du PDF que vous en tirez) : logo et nom à gauche, drapeau à droite. |
| Sur téléphone ? | Oui, en version réduite, sur la même ligne que le logo QualiCode. |
| Le drapeau pèse-t-il lourd ? | Non : il est dessiné en SVG dans l'application (quelques centaines d'octets) et fonctionne **hors ligne**, sans aucune requête réseau. |
| Si je réinstalle QualiCode ? | Les réglages sont à refaire (quelques clics). Gardez le fichier image quelque part. |

### Pour une organisation entière (option avancée)

Si vous déployez QualiCode pour toute une équipe et que vous voulez que les
marques soient **déjà en place au premier lancement**, sans que chacun ait à les
choisir, tout se règle dans les balises `<meta>` de `index.html` :

```html
<meta name="qc-org-nom" content="APSA">
<meta name="qc-org-drapeau" content="cd">   <!-- cd, rw, bj, ou vide -->
<meta name="qc-org-logo" content="assets/logo/organisation.png">
```

1. Le **nom** et le **drapeau** fonctionnent immédiatement, sans aucun fichier.
2. Pour le **logo officiel**, déposez le fichier dans
   `assets/logo/organisation.png` puis décommentez la troisième ligne.
3. Reconstruisez les paquets :
   `python3 tools/build_standalone.py` (le logo est alors embarqué dans le
   fichier unique, donc disponible hors ligne) puis
   `python3 tools/faire_paquet_web.py`.

Chaque utilisateur reste libre de remplacer ces marques par les siennes, ou de
les retirer. Un client qui achète QualiCode change simplement ces deux lignes
pour son propre nom et son propre drapeau.

---

*Bonne analyse ! 🔍*
