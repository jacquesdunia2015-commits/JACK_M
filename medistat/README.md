# MediStat

**Gestion des dossiers médicaux et des résultats de laboratoire, avec analyse
statistique des données quantitatives et qualitatives.**

MediStat répond au *Cahier des charges fonctionnel et technique — SaaS de gestion
des dossiers médicaux et des résultats de laboratoire (v1.0)*, et l'étend à un
environnement complet d'analyse de données.

L'application s'installe sur **ordinateur** (Windows, macOS, Linux) et sur
**téléphone** (Android, iOS), fonctionne **hors ligne**, et ne dépend d'**aucune
bibliothèque externe** — ni au bâti, ni à l'exécution.

---

## Table des matières

- [En un coup d'œil](#en-un-coup-dœil)
- [Installation](#installation)
- [Premier démarrage](#premier-démarrage)
- [Les deux moitiés du logiciel](#les-deux-moitiés-du-logiciel)
- [Analyse de données](#analyse-de-données)
- [Sécurité](#sécurité)
- [Architecture](#architecture)
- [Serveur d'API](#serveur-dapi)
- [Tests](#tests)
- [Conformité au cahier des charges](#conformité-au-cahier-des-charges)
- [Limites connues](#limites-connues)

---

## En un coup d'œil

| | |
|---|---|
| **Dépendances** | Aucune. Ni npm, ni CDN, ni police distante. |
| **Fonctionne hors ligne** | Oui, intégralement, après la première ouverture. |
| **Installable** | PWA (tout appareil) + installateurs Windows, macOS, Linux. |
| **Base de données** | IndexedDB sur l'appareil ; SQLite côté serveur (facultatif). |
| **Chiffrement** | AES-GCM 256 bits au repos, PBKDF2 250 000 itérations. |
| **Interopérabilité** | HL7 FHIR R4, LOINC, CSV, Excel XLSX, PDF. |
| **Tests** | 689 contrôles automatisés, tous au vert. |
| **Langue** | Français. |

---

## Installation

### Sur téléphone ou tablette — le plus simple

1. Ouvrez l'adresse de MediStat dans **Chrome** (Android) ou **Safari** (iOS).
2. Android : menu **⋮ › Installer l'application**.
   iOS : bouton **Partager › Sur l'écran d'accueil**.
3. MediStat apparaît comme une application, avec son icône, sans barre de navigateur.

### Sur ordinateur — installateur

```bash
# Linux
bash installateurs/installer-linux.sh

# macOS  (ou double-clic sur le fichier)
bash installateurs/installer-macos.command

# Windows  (double-clic)
installateurs\installer-windows.bat
```

L'installateur copie l'application, engendre un secret de signature propre à la
machine, crée un raccourci dans le menu et démarre le serveur local.

**Prérequis :** [Node.js 22 ou supérieur](https://nodejs.org). Le module
`node:sqlite`, utilisé par le serveur, n'existe qu'à partir de cette version.

### Sans rien installer

```bash
node server/api.mjs
# puis ouvrez http://localhost:8080
```

Ou, si vous n'avez pas Node, servez le dossier avec n'importe quel serveur
statique : l'application fonctionne alors entièrement dans le navigateur, sans
serveur d'API.

> **Note.** L'ouverture directe du fichier `index.html` (`file://`) ne
> fonctionne pas : les modules JavaScript et l'API WebCrypto exigent une origine
> `https://` ou `http://localhost`. C'est une contrainte des navigateurs, pas de
> MediStat.

---

## Premier démarrage

À la première ouverture, MediStat demande de créer l'**établissement** et son
**compte administrateur**. Cochez « Charger un jeu de données de démonstration »
pour découvrir le logiciel avec 120 patients fictifs, leurs consultations, leurs
examens et leurs résultats — supprimables à tout moment depuis *Aide ›
Maintenance*.

Les comptes de démonstration correspondent à chaque profil métier
(`dr.mukendi`, `bio.ilunga`, `lab.kasongo`…) et permettent de constater
concrètement comment l'interface s'adapte au rôle. Leurs mots de passe sont
affichés dans *Aide › Maintenance*.

---

## Les deux moitiés du logiciel

### 1. Le dossier médical et le laboratoire

Le **cycle de vie d'un examen** est le cœur du dispositif. Il suit exactement la
séquence de l'article 7.2 du cahier des charges, et les transitions non prévues
sont refusées par le modèle lui-même :

```
enregistrée → prélevée → réceptionnée → en analyse → saisie → validée → rendue
                                            ↑__________________________|
                                     correction sous contrôle d'audit
```

À chaque étape, le logiciel fait le travail que l'on attend d'un logiciel :

- **Interprétation automatique.** Toute valeur est située par rapport aux normes
  et aux seuils d'alerte du catalogue. Une valeur critique déclenche une alerte
  bloquante, qui doit être acquittée après avoir joint le prescripteur — et
  l'acquittement est tracé.
- **Contrôle de vraisemblance.** Chaque résultat est comparé au dosage précédent
  du même patient. Un écart supérieur à 50 % est signalé avant validation :
  c'est souvent le signe d'une erreur d'identification d'échantillon.
- **Signature électronique.** La validation produit une empreinte SHA-256 du
  contenu exact du résultat. Si quelqu'un modifie ensuite ce résultat, la
  signature devient invalide **et l'impression du compte rendu est bloquée**.
- **Paillasse priorisée.** Les analyses sont classées par degré d'urgence puis
  par ancienneté — l'ordre dans lequel un technicien doit réellement travailler.

### 2. L'analyse de données

C'est l'extension au cahier des charges. Le SaaS devient son propre entrepôt de
données : l'extraction met automatiquement les résultats de laboratoire en
colonnes, une ligne par patient ou par consultation, avec pseudonymisation
optionnelle. Aucune ressaisie, donc aucune erreur de ressaisie.

---

## Analyse de données

### Statistiques — 30 analyses guidées

| Famille | Contenu |
|---|---|
| **Description** | Tendance centrale, dispersion, forme, quantiles, intervalles de confiance, tableaux de fréquences, tableaux croisés, « tableau 1 » par groupe |
| **Conditions d'application** | Shapiro-Wilk, Lilliefors, Anderson-Darling, D'Agostino-Pearson, Levene, Brown-Forsythe, Bartlett |
| **Comparaison de moyennes** | t (un échantillon, indépendants, Welch, apparié), ANOVA 1 et 2 facteurs, mesures répétées avec Greenhouse-Geisser, ANCOVA |
| **Post-hoc** | Tukey HSD, Bonferroni, Holm, Benjamini-Hochberg, Dunnett, Dunn |
| **Non paramétriques** | Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, Cochran Q, signes, séquences, Kolmogorov-Smirnov |
| **Catégoriels** | χ² (indépendance, ajustement, Yates), Fisher exact, McNemar, Mantel-Haenszel, binomial, Poisson |
| **Corrélations** | Pearson, Spearman, Kendall τ-b, partielle, matrices |
| **Régression** | Linéaire simple et multiple (VIF, Durbin-Watson, AIC/BIC), logistique (OR, Hosmer-Lemeshow, pseudo-R²), Poisson |
| **Épidémiologie** | Sensibilité, spécificité, VPP/VPN, rapports de vraisemblance, ROC/AUC, RR, OR, NST, Kaplan-Meier, log-rank, Cox |
| **Multivariées** | ACP, AFC, analyse discriminante, k-moyennes, classification hiérarchique |
| **Fidélité** | Cronbach α, κ de Cohen et de Fleiss, ICC, Bland-Altman, concordance de Lin |
| **Planification** | Puissance, taille d'échantillon |

**Ce qui distingue MediStat d'une simple boîte à outils :** le logiciel vérifie
les conditions d'application, bascule automatiquement vers l'alternative
appropriée (Welch si les variances diffèrent, Kruskal-Wallis si la normalité est
rejetée), affiche systématiquement la taille d'effet et son intervalle de
confiance à côté de la valeur p, et **rédige l'interprétation en français**.

### Analyse qualitative

Pour le texte libre — verbatims de patients, observations cliniques,
commentaires de biologistes :

- **Livre de codes** et codage thématique, avec suggestion depuis le vocabulaire
- **Lexicométrie** : fréquences, TF-IDF, n-grammes, indice de Guiraud, hapax
- **Concordancier** (mot en contexte) — pour vérifier le sens réel d'un terme
  avant de le coder : *« pas de douleur »* et *« douleur intense »* contiennent
  le même mot
- **Cooccurrences** : Jaccard, information mutuelle, φ, centralité des codes
- **Courbe de saturation** : à partir de quel document n'apprend-on plus rien ?
- **Accord inter-codeurs** (κ de Cohen)
- **Analyse de sentiment** avec gestion des négations et des intensificateurs
- **Méthodes mixtes** : croisement des thèmes avec les variables quantitatives

### Exports

CSV, Excel XLSX, JSON, **script R prêt à exécuter**, **syntaxe SPSS**, lots HL7
FHIR. Les fichiers CSV portent un BOM UTF-8 et un séparateur point-virgule :
ils s'ouvrent correctement dans Excel en configuration française.

---

## Sécurité

Ce que le logiciel fait, et ce qu'il ne fait pas.

| Dispositif | Portée | Limite |
|---|---|---|
| **Chiffrement au repos** (AES-GCM 256) | Antécédents, allergies, coordonnées, diagnostics, commentaires, documents | Nom et IPP restent en clair : sans cela, aucune recherche ne serait possible |
| **Dérivation de clé** (PBKDF2, 250 000 tours) | Clé jamais stockée, effacée à la fermeture de session | Ne protège pas un appareil compromis pendant une session ouverte |
| **Journal d'audit chaîné** (SHA-256) | Toute altération détectée, y compris par un administrateur | Contient qui/quoi/quand, jamais le détail clinique |
| **Signature électronique** | Invalide dès qu'un résultat signé est modifié ; impression bloquée | Signature d'intégrité, non qualifiée au sens réglementaire |
| **Contrôle d'accès** | 10 rôles, 9 droits par ressource, revérifié côté serveur | Un administrateur garde des droits étendus |
| **Cloisonnement multi-tenant** | Étanchéité stricte, vérifiée par 12 contrôles automatisés | — |
| **Protection des accès** | Blocage après 5 échecs, verrouillage après 15 min, historique de 5 mots de passe, TOTP | Ne protège pas contre le partage volontaire d'identifiants |

**Le serveur ne fait jamais confiance au client.** Chaque droit est revérifié
côté serveur, quoi qu'ait décidé l'interface. Le journal d'audit est recalculé
côté serveur : un client ne peut pas forger d'empreinte.

**Ce qui relève de votre organisation :** sauvegardes régulières, politique de
conservation conforme à votre juridiction, formation des utilisateurs, chiffrement
des disques, et — si vous déployez le serveur — TLS obligatoire et
`MEDISTAT_SECRET` défini.

---

## Architecture

```
medistat/
├── index.html              Coquille applicative
├── manifest.webmanifest    Installation (PWA)
├── sw.js                   Hors ligne — aucune donnée de santé en cache
├── css/style.css           Thèmes clair et sombre, responsive, impression
│
├── js/
│   ├── app.js              Routage, session, recherche globale, installation
│   ├── core/
│   │   ├── model.js        Entités (art. 17), rôles (art. 5), droits (art. 10),
│   │   │                   cycle de vie (art. 7.2), interprétation biologique
│   │   ├── crypto.js       AES-GCM, PBKDF2, signature, chaîne d'audit, TOTP
│   │   ├── store.js        IndexedDB, dépôts, cloisonnement, audit, sync
│   │   ├── auth.js         Session, verrouillage, politique de mots de passe
│   │   ├── ui.js           DOM sans injection, tableaux, modales, formulaires
│   │   ├── charts.js       14 types de graphiques, SVG pur, export PNG
│   │   └── export.js       PDF, CSV, XLSX, FHIR — moteurs internes
│   │
│   ├── stats/              Moteur statistique — 8 modules, zéro dépendance
│   │   ├── distributions.js  Lois, densités, CDF, quantiles
│   │   ├── descriptive.js    Description, fréquences, histogrammes, KDE
│   │   ├── inferential.js    ~40 tests d'hypothèse
│   │   ├── regression.js     Linéaire, multiple, logistique, Poisson
│   │   ├── survival.js       Kaplan-Meier, log-rank, Cox
│   │   ├── diagnostic.js     ROC, Bland-Altman, Westgard, CLSI
│   │   ├── multivariate.js   ACP, AFC, AFD, k-moyennes, CAH
│   │   └── qualitative.js    Lexicométrie, codage, cooccurrences
│   │
│   └── modules/            12 écrans métier
│
├── server/api.mjs          API REST multi-tenant (node:sqlite, zéro dépendance)
├── tests/                  5 suites, 689 contrôles
└── installateurs/          Windows, macOS, Linux
```

**Pourquoi zéro dépendance ?** En contexte médical, chaque dépendance est une
surface d'attaque et une dette de maintenance. Un logiciel qui doit fonctionner
dix ans dans un service dépourvu de connexion fiable ne peut pas reposer sur un
écosystème de paquets. Tout ce qui est utilisé ici — moteur PDF, écriture XLSX,
archive ZIP, algèbre matricielle, lois de probabilité — est écrit dans le dépôt
et testé.

---

## Serveur d'API

Facultatif : l'application fonctionne intégralement sans lui. Il sert à
mutualiser les données entre plusieurs postes et plusieurs établissements.

```bash
export MEDISTAT_SECRET="$(openssl rand -base64 32)"   # indispensable en production
node server/api.mjs --port 8080 --db data/medistat.db
```

| Variable | Rôle |
|---|---|
| `MEDISTAT_SECRET` | Signe les jetons de session. **À définir en production** : sans lui, un secret aléatoire est engendré à chaque démarrage et toutes les sessions sont invalidées au redémarrage. |
| `MEDISTAT_PORT` | Port d'écoute (défaut : 8080) |
| `MEDISTAT_DB` | Chemin de la base SQLite |
| `MEDISTAT_ORIGINE` | Origine autorisée pour le partage entre origines. Non défini = API accessible seulement depuis la page qu'elle sert. |
| `MEDISTAT_STATIQUE` | `0` pour ne servir que l'API |

Principales routes :

```
GET    /api/sante                    État du service
POST   /api/initialiser              Créer le premier établissement
POST   /api/connexion                Obtenir un jeton
GET    /api/moi                      Session et permissions
GET    /api/<entité>?depuis=<date>   Synchronisation incrémentale
POST   /api/<entité>                 Enregistrer (unitaire ou par lot)
DELETE /api/<entité>/<id>            Suppression logique
GET    /api/audit/integrite          Contrôle d'intégrité du journal
```

La synchronisation résout les conflits par numéro de version : la version la
plus élevée l'emporte, une version antérieure est rejetée et signalée.

**En production, placez le serveur derrière un proxy TLS** (nginx, Caddy). Le
chiffrement en transit exigé par l'article 9 est assuré par ce proxy.

---

## Tests

```bash
node tests/tous.mjs           # les 5 suites
node tests/stats.test.mjs     # une suite en particulier
```

| Suite | Contrôles | Objet |
|---|---:|---|
| `stats.test.mjs` | 220 | Valeurs de référence R/SPSS, calculs analytiques, identités mathématiques |
| `app.test.mjs` | 109 | Chiffrement, droits, cloisonnement, audit, TOTP, sauvegarde |
| `export.test.mjs` | 73 | CSV, XLSX (validé par openpyxl), PDF (validé par pdfminer), FHIR |
| `modules.test.mjs` | 204 | Syntaxe, résolution des imports, routeur, manifeste, modèle |
| `serveur.test.mjs` | 83 | Authentification, droits serveur, multi-tenant, audit, durcissement |
| **Total** | **689** | |

Le moteur statistique est validé de trois manières indépendantes : valeurs
publiées de R et SPSS, calculs analytiques reproductibles à la main, et
identités mathématiques (`F = t²` à deux groupes, `AUC = U/(n₁·n₂)`,
`R² = r²`, ANOVA à deux facteurs dont les sommes de carrés se recomposent).
Le modèle de Cox est validé par simulation : des délais engendrés selon un β
connu doivent redonner ce β.

**Ces tests ont trouvé de vrais défauts.** Trois exemples :

- une erreur de signe sur les coefficients extrêmes de Royston dans
  Shapiro-Wilk, qui rendait le test inutilisable ;
- des données de santé écrites **en clair dans le journal d'audit**, annulant le
  bénéfice du chiffrement des champs ;
- une règle « mot de passe trop courant » qui rejetait tout mot de passe
  commençant par un mot du dictionnaire, y compris `AdminFort2026!`.

---

## Conformité au cahier des charges

L'écran *Aide › Conformité* détaille les 24 articles. Synthèse :

**Pleinement couverts** — articles 4, 5, 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 8,
9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 23.

**Partiellement couverts**, signalés honnêtement :

| Article | État |
|---|---|
| **6.4** Gestion documentaire | Modèle et magasin chiffré en place ; interface de dépôt à compléter |
| **12** Portail patient | Rôle et permissions définis ; interface dédiée à développer (module explicitement optionnel) |
| **13** Notifications | Notifications in-app et alertes critiques opérationnelles ; passerelles courriel et SMS à raccorder au déploiement |

Les huit **critères de réception de l'article 23** sont vérifiables : un patient
peut être créé et suivi, un examen prescrit, un résultat saisi/validé/consulté,
un PDF généré, l'audit est complet, les rôles fonctionnent, le système reste
stable, et plusieurs établissements coexistent de façon étanche.

---

## Limites connues

Dites franchement, pour éviter toute mauvaise surprise :

- **`file://` ne fonctionne pas.** Modules JavaScript et WebCrypto exigent une
  origine sécurisée. Utilisez le serveur fourni ou n'importe quel serveur statique.
- **La réinitialisation d'un mot de passe par un administrateur** rend
  inaccessibles à cet utilisateur les champs qu'il avait chiffrés : la clé
  dérive du mot de passe. C'est le prix d'un chiffrement où le serveur ne
  détient aucune clé.
- **Le mode navigation privée** désactive IndexedDB. MediStat bascule alors en
  mémoire volatile et l'affiche clairement : les données seront perdues à la
  fermeture.
- **La signature électronique** est une signature d'intégrité. Une signature
  qualifiée au sens réglementaire exigerait un certificat délivré par une
  autorité de certification.
- **Les intervalles de référence recalculés** portent sur l'ensemble des
  résultats, malades compris. Ils repèrent les écarts manifestes, mais ne
  remplacent pas une étude CLSI sur population saine sélectionnée.
- **L'analyse de sentiment** repose sur un lexique. L'ironie et l'implicite lui
  échappent, comme à toute analyse automatique.
- **La classification ascendante hiérarchique** est limitée à 500 observations
  (coût quadratique) ; au-delà, les k-moyennes prennent le relais.

---

## Licence et propriété

Développé d'après le cahier des charges v1.0 du Client. Les dispositions
juridiques et commerciales relèvent du contrat de prestation associé
(article 25 du cahier des charges).

## Accès immédiat (MVP)

Une version autonome de MediStat — un seul fichier HTML, sans installation
ni serveur — est publiée à l'adresse suivante :

    https://claude.ai/code/artifact/d650cf03-0f83-4384-8cf7-36267d0db7f2

Au premier lancement, l'écran de configuration crée l'établissement et son
compte administrateur. Laissez cochée la case « charger un jeu de données de
démonstration » pour découvrir la Solution avec 120 patients, un catalogue
d'analyses et plusieurs centaines de résultats fictifs.

Les données restent dans le navigateur (IndexedDB) et ne partent nulle part.
Cette version convient à l'évaluation et à la démonstration ; pour un usage
réel, déployez le serveur (`server/api.mjs`) afin d'obtenir la sauvegarde
centralisée, le partage entre postes et l'envoi des messages aux patients.

### Reconstruire le fichier autonome

    node outils/construire-autonome.mjs              # document complet
    node outils/construire-autonome.mjs --fragment   # corps seul, pour intégration

Le premier produit `dist/medistat-autonome.html`, déposable tel quel sur
n'importe quel hébergement statique ou ouvrable depuis une clé USB.
