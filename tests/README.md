# Vérifications automatiques de QualiCode

Deux séries de contrôles, toutes deux **sans aucune installation** : ni npm, ni
bibliothèque de test. QualiCode ne dépend de rien, ses tests non plus.

## 1. En ligne de commande (391 vérifications)

```bash
node tests/tous.mjs
```

Pour n'exécuter qu'une suite :

```bash
node tests/tous.mjs persistance
node tests/tous.mjs statistiques
```

| Suite | Fichier | Ce qu'elle protège |
|---|---|---|
| Intégrité | `integrite.test.mjs` | L'application démarre, rien ne manque au cache hors ligne, aucune clé de traduction ne s'affiche brute, le générateur de clés et l'application partagent le même secret |
| Persistance | `persistance.test.mjs` | Le corpus enregistré se retrouve intact, la bibliothèque de projets, la migration des anciennes versions, et l'alerte quand une sauvegarde échoue |
| Codage | `codage.test.mjs` | Documents, codes, segments, annulation/rétablissement, corbeille et restauration |
| Analyse | `analyse.test.mjs` | Recherche booléenne, lexique, concordancier, matrices, co-occurrences, comparaison de groupes |
| Statistiques | `statistiques.test.mjs` | χ², V de Cramér, Pearson, Spearman, export vers R/SPSS — comparés aux tables de référence |
| Exports | `echange.test.mjs` | `.projx`, CSV, `.docx`, `.qdpx` : chaque fichier est relu comme le ferait Excel, Word ou MAXQDA |
| Fusion | `fusion.test.mjs` | Travail à deux codeurs, fusion de projets, kappa de Cohen |
| Licence | `licence.test.mjs` | Accès libre, essai, clés d'abonnement, verrouillage sur appareil |

Sortie attendue : **Toutes les suites sont au vert.**

## 2. Dans un navigateur réel (32 vérifications + démarrage complet)

Certaines choses ne se vérifient pas hors navigateur : la vraie base IndexedDB,
le vrai analyseur XML qui relit un `.qdpx`, le vrai chiffrement.

```bash
python3 -m http.server 8000
```

puis ouvrez **http://localhost:8000/tests/navigateur.html**

La page vérifie aussi que **vos propres projets** se relisent correctement, et
signale si ce navigateur risque d'effacer vos données. Elle travaille dans une
base d'essai séparée (`qualicode-tests`) qu'elle supprime en terminant : elle ne
modifie jamais vos projets.

Le bouton « Lancer le test de démarrage » charge l'application entière et
vérifie qu'elle s'ouvre, peuple ses panneaux et ne lève aucune erreur.

## Ce que ces tests ne remplacent pas

Aucun test ne garantit un disque qui ne meurt pas. Avant une collecte :

1. **Installez QualiCode** (bouton 📲) — c'est ce qui rend le stockage durable,
   et sur iPhone ce qui empêche l'effacement après sept jours d'inactivité.
2. **Exportez votre projet** (`.projx`) après chaque séance, sur un support
   différent de l'appareil de travail.
3. **Ne travaillez jamais en navigation privée** : tout est effacé à la
   fermeture.

## Écrire une vérification de plus

`aide.mjs` fournit `verifier`, `egal`, `memeContenu`, `proche`, `leve`, `titre`
et `bilan`. `faux-navigateur.mjs` double le stockage local, IndexedDB et les
téléchargements ; il doit être installé **avant** d'importer les modules testés :

```js
import { installerTout } from "./faux-navigateur.mjs";
installerTout();
const { state } = await import("../js/state.js");
```

`aide-fichiers.mjs` relit les fichiers produits : `lireZip`, `lireCsv`,
`xmlBienForme`, `commenceParBom`.

Deux règles tenues dans toute la suite :

- **Les valeurs de référence viennent de l'extérieur.** Les valeurs p sont
  comparées aux tables du χ², les kappas à des tableaux 2 × 2 calculés à la
  main. Comparer un logiciel à lui-même ne prouve rien.
- **Aucune donnée d'essai n'est écrite à la main quand elle peut être
  calculée.** Les bornes de codage sont dérivées du texte : une faute de frappe
  dans le jeu d'essai transformerait un vrai défaut en test au vert.
