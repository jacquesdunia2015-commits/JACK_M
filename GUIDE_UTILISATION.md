# 📖 Guide d'utilisation de QualiCode

*Un guide simple, pas à pas, pour analyser vos entretiens et vos textes de recherche.*

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

1. Ouvrez le dossier de l'application dans un terminal.
2. Tapez : `python3 -m http.server 8080`
3. Ouvrez votre navigateur (Chrome, Edge, Firefox…) à l'adresse : **http://localhost:8080**

Au premier lancement, un **projet exemple** s'ouvre (une étude sur le télétravail, déjà partiellement codée). C'est parfait pour s'entraîner sans risque.

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

### Importer vos textes (onglet **Importer**)
Vous avez 4 façons de faire :

- **📄 Fichiers (DOCX, TXT, MD)** : choisissez vos fichiers Word (.docx) ou texte. C'est la méthode la plus courante.
- **📋 Coller un texte** : copiez-collez directement un texte.
- **📊 Enquête CSV** : importez un tableau de réponses (une ligne = une personne). Les réponses courtes (âge, sexe…) deviennent automatiquement des « variables », les réponses longues deviennent le texte à coder.
- **🧩 Texte structuré** : collez plusieurs entretiens d'un coup, séparés par des lignes `#DOC Nom de l'entretien`.

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

Onglet **Rapports** : exportez les segments (CSV pour Excel), la matrice, le système de codes, ou générez un **rapport imprimable** (qui peut être enregistré en PDF).

---

## 11. Protéger votre projet par mot de passe

Si vos données sont sensibles (c'est souvent le cas en recherche) :

1. Onglet **Accueil** → **🔒 Mot de passe**.
2. Saisissez deux fois votre mot de passe → la protection s'active.
3. Désormais, le fichier `.projx` téléchargé avec **💾 Enregistrer** est **chiffré** (norme AES-256) : impossible de le lire sans le mot de passe.

⚠️ **Important : si vous oubliez ce mot de passe, personne ne pourra récupérer le fichier.** Notez-le en lieu sûr.

---

## 12. Travailler à plusieurs (fusion et accord entre codeurs)

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

## 13. Petites questions fréquentes

**J'ai supprimé un document ou un code par erreur !**
→ **Accueil → 🗑️ Corbeille** : cliquez sur *Restaurer*.

**Où est enregistré mon travail ?**
→ Automatiquement dans votre navigateur, sur votre ordinateur (regardez « ✓ Sauvegarde automatique » en bas à droite). Pour une copie durable ou pour changer d'ordinateur : **💾 Enregistrer (.projx)**, puis **📂 Ouvrir (.projx)** sur l'autre machine.

**Un passage peut-il avoir plusieurs codes ?**
→ Oui ! Sélectionnez-le à nouveau et appliquez un autre code. Les chevauchements sont soulignés ; cliquez dessus pour choisir quel code consulter.

**Puis-je changer un code de place ?**
→ Oui, glissez-le sur un autre code (il devient sous-code) ou dans le vide (il redevient un code principal).

**L'application marche-t-elle sans internet ?**
→ Oui, entièrement. Aucune donnée ne quitte votre ordinateur.

---

*Bonne analyse ! 🔍*
