# MediStat face aux autres solutions

*Comparatif à jour au 31 juillet 2026.*

---

## Avertissement de méthode — à lire avant le tableau

Ce document est rédigé **par l'équipe de MediStat**. Un comparatif écrit par un éditeur sur son propre produit est structurellement partial : il connaît ses forces mieux que celles des autres, et choisit les critères. Trois précautions ont donc été prises.

1. **Les colonnes « concurrents » décrivent des positionnements généraux**, tirés de la documentation publique de chaque produit. Les fonctionnalités évoluent vite. **Vérifiez auprès de chaque éditeur avant toute décision d'achat.** Ne prenez aucune ligne de ce tableau comme un engagement contractuel de leur part.

2. **La section « Là où les autres sont meilleurs » est aussi détaillée que les autres.** Un comparatif sans cette section ne mérite pas d'être lu.

3. **MediStat est un logiciel jeune.** Il n'a ni base installée, ni certification, ni contrat de support. C'est le fait le plus important de ce document, et il figure en toutes lettres plus bas.

---

## 1. Les catégories comparées

Comparer MediStat à « un logiciel médical » n'a pas de sens : le marché se divise en familles qui ne font pas le même métier.

| Famille | Exemples courants | Ce qu'elle fait |
|---|---|---|
| **Dossier patient (DPI / EMR)** | OpenMRS, Bahmni, OpenEMR, GNU Health | Gère le dossier de soins. |
| **Laboratoire (SGL / LIMS)** | OpenELIS, SENAITE, Bika | Gère le circuit d'analyses. |
| **Information sanitaire agrégée** | DHIS2 | Agrège des indicateurs de population. |
| **Statistiques** | R, SPSS, Stata, Epi Info, Jamovi | Analyse des données. |
| **Suites hospitalières propriétaires** | Cerner, Epic, Dedalus, Softway | Tout le système d'information hospitalier. |

**MediStat couvre les trois premières colonnes et la quatrième dans un seul produit.** C'est sa proposition centrale. C'est aussi sa principale limite : il ne va pas aussi loin dans chaque domaine qu'un spécialiste de ce domaine.

---

## 2. Tableau comparatif principal

Légende : ● complet · ◐ partiel · ○ absent · — hors périmètre du produit

| Critère | **MediStat** | OpenMRS / Bahmni | DHIS2 | OpenELIS | OpenEMR | SPSS / Stata | Suites propriétaires |
|---|---|---|---|---|---|---|---|
| **Nature** | Libre, SaaS ou local | Libre | Libre | Libre | Libre | Propriétaire | Propriétaire |
| **Dossier patient** | ● | ● | ○ | ◐ | ● | — | ● |
| **Circuit laboratoire complet** | ● | ◐ | ○ | ● | ◐ | — | ● |
| **Signature électronique des résultats** | ● | ◐ | ○ | ◐ | ◐ | — | ● |
| **Statistiques inférentielles intégrées** | ● (~40 tests) | ○ | ◐ (agrégats) | ○ | ○ | ● | ○ |
| **Analyse de survie (Kaplan-Meier, Cox)** | ● | ○ | ○ | ○ | ○ | ● | ○ |
| **Analyse qualitative de corpus** | ● | ○ | ○ | ○ | ○ | ◐ | ○ |
| **Analyse guidée pour non-statisticien** | ● | — | ◐ | — | — | ○ | — |
| **Interprétation rédigée en clair** | ● | — | ○ | — | — | ○ | — |
| **Fonctionne hors ligne** | ● | ◐ | ● (Android) | ○ | ○ | ● (bureau) | ◐ |
| **Installation sans serveur** | ● (1 fichier) | ○ | ○ | ○ | ○ | ● | ○ |
| **Dépendances externes** | **0** | Nombreuses | Nombreuses | Nombreuses | Nombreuses | s.o. | s.o. |
| **Chiffrement des champs au repos** | ● | ◐ | ◐ | ◐ | ◐ | ○ | ● |
| **Journal d'audit chaîné inviolable** | ● | ◐ | ◐ | ◐ | ◐ | ○ | ● |
| **Multi-établissement cloisonné** | ● | ● | ● | ◐ | ◐ | — | ● |
| **HL7 FHIR R4** | ● | ● | ● | ◐ | ◐ | — | ● |
| **Codification LOINC** | ● | ● | ◐ | ● | ◐ | — | ● |
| **Langues d'interface** | **50** | ~30 | ~80 | ~10 | ~30 | 5–10 | Variable |
| **Écriture droite-à-gauche** | ● | ● | ● | ◐ | ◐ | ◐ | ● |
| **SMS automatique au patient** | ● | ◐ (module) | ◐ | ○ | ◐ | ○ | ● |
| **Imagerie (PACS / DICOM)** | ○ | ◐ | ○ | ○ | ◐ | — | ● |
| **E-prescription vers pharmacie externe** | ○ | ◐ | ○ | ○ | ◐ | — | ● |
| **Connexion aux automates de laboratoire** | ○ | ◐ | ○ | ● | ○ | — | ● |
| **Facturation** | ◐ | ◐ | ○ | ○ | ● | — | ● |
| **Base installée** | **Nouvelle** | Très large | Très large | Large | Large | Très large | Très large |
| **Certification / accréditation** | **Aucune** | Variable | Variable | Variable | ◐ (ONC aux É.-U.) | s.o. | ● |
| **Support commercial** | **Aucun** | Intégrateurs | Intégrateurs | Intégrateurs | Intégrateurs | ● | ● |
| **Coût de licence** | Gratuit | Gratuit | Gratuit | Gratuit | Gratuit | Élevé | Très élevé |
| **Coût de mise en œuvre** | Faible | Élevé | Élevé | Moyen | Moyen | Faible | Très élevé |

---

## 3. Ce que MediStat apporte de spécifique

### 3.1 Un seul outil du prélèvement à la publication

Le parcours habituel d'une étude en établissement :

```
Dossier papier ou DPI  →  export Excel  →  nettoyage manuel  →  SPSS  →  rédaction
```

Chaque flèche est une occasion de perdre, de recopier ou de désaligner des données. Dans MediStat :

```
Dossier  →  jeu de données  →  analyse guidée  →  rapport PDF
```

Sans export intermédiaire, sans ressaisie.

### 3.2 Des statistiques utilisables sans statisticien

C'est la différence la plus concrète avec un DPI classique et avec un logiciel de statistiques classique.

| | DPI classique | SPSS / Stata | MediStat |
|---|---|---|---|
| Choix du test | s.o. | À la charge de l'utilisateur | Guidé par la question posée |
| Conditions d'application | s.o. | À vérifier soi-même | Vérifiées et signalées |
| Taille d'effet | s.o. | Souvent optionnelle | Toujours affichée |
| Lecture du résultat | s.o. | Tableaux à interpréter | Phrase rédigée en français |
| Test inadapté | s.o. | Aucun avertissement | Alternative proposée |

Le moteur a été validé de trois manières indépendantes : valeurs publiées de R et SPSS, résultats calculables à la main, et identités mathématiques (`F = t²`, `AUC = U/(n₁n₂)`, `R² = r²`, recomposition des sommes de carrés de l'ANOVA).

### 3.3 Zéro dépendance

MediStat n'utilise aucune bibliothèque tierce, ni à la construction, ni à l'exécution. Le moteur PDF, le générateur Excel, l'algèbre matricielle et les lois de probabilité sont écrits et testés dans le projet.

| Conséquence | Détail |
|---|---|
| Surface d'attaque | Aucune vulnérabilité héritée d'un paquet tiers. |
| Pérennité | Aucun risque d'abandon d'une dépendance. |
| Audit | Le code livré est le code écrit : lisible tel quel dans l'inspecteur du navigateur. |
| Poids | Application complète en 1 Mo. |
| Déploiement | Un seul fichier HTML, sans chaîne de construction. |

**Le revers :** l'équipe assume seule la maintenance de tout ce code. Une bibliothèque éprouvée bénéficie de milliers d'utilisateurs qui en trouvent les défauts.

### 3.4 Conçu pour un réseau irrégulier

| Situation | Comportement |
|---|---|
| Coupure de connexion | Le travail continue. Écritures mises en file. |
| Retour du réseau | Synchronisation automatique, sans intervention. |
| Aucun serveur disponible | Fonctionnement local complet. |
| Poste bas de gamme | 1 Mo, aucun cadre applicatif lourd. |
| Téléphone Android d'entrée de gamme | Installable en PWA. |

### 3.5 Cinquante langues sur cinq continents

15 langues européennes, 20 asiatiques et moyen-orientales, 11 africaines, 2 américaines, 2 océaniennes. Onze langues africaines incluant swahili, amharique, haoussa, yoruba, igbo, zoulou, somali, lingala, kinyarwanda, malgache, afrikaans.

Quatre langues basculent l'interface entière de droite à gauche. Les nombres et les dates suivent la locale de chaque langue.

**Portée réelle :** les menus, actions et messages aux patients sont traduits dans les 50 langues. Les textes longs — aide, interprétations statistiques — retombent sur le français ou l'anglais. L'écran Établissement affiche le taux de couverture réel.

### 3.6 Sécurité pensée pour un poste partagé

| Mécanisme | Ce qu'il empêche |
|---|---|
| Chiffrement enveloppe par établissement | Un poste volé ne livre rien sans mot de passe. Et tous les soignants lisent bien les mêmes dossiers. |
| Journal d'audit chaîné | Un administrateur ne peut pas effacer sa trace sans que cela se voie. |
| Signature qui bloque l'impression | Un résultat modifié après signature ne peut pas être imprimé comme authentique. |
| Séparation stricte des rôles | Un administrateur ne peut pas saisir un résultat. Un laborantin ne valide pas ce qu'il a saisi. |
| SMS sans donnée de santé | Un message intercepté ou lu sur un écran verrouillé ne divulgue rien. |

---

## 4. Là où les autres sont meilleurs

Cette section vaut le reste du document. Sur les points suivants, **choisissez un autre produit**.

### DHIS2

**Choisissez DHIS2 si** votre besoin est la surveillance sanitaire à l'échelle d'un district, d'une province ou d'un pays.

DHIS2 est adopté par plus de 80 ministères de la santé, dispose d'une communauté considérable, d'une application Android mature pour la collecte terrain, et de modules épidémiologiques éprouvés depuis des années sur le paludisme, la tuberculose, la vaccination. MediStat travaille au niveau de l'établissement, pas du système national.

### OpenMRS et Bahmni

**Choisissez-les si** vous équipez un hôpital de plusieurs centaines de lits avec des besoins cliniques profonds.

Écosystème mature, communauté internationale, intégrateurs disponibles dans de nombreux pays, modèle de données clinique très riche, modules d'hospitalisation, de pharmacie et de radiologie. MediStat n'a ni gestion des lits, ni bloc opératoire, ni pharmacie hospitalière.

### OpenELIS et SENAITE

**Choisissez-les si** votre laboratoire est le cœur de votre activité et que vous devez connecter des automates.

La connexion directe aux analyseurs — que MediStat ne fait pas — change la vie d'un laboratoire à fort volume : les résultats remontent seuls, sans ressaisie ni risque de transcription. C'est un écart majeur.

### R, SPSS, Stata, SAS

**Choisissez-les si** vous menez de la recherche méthodologiquement exigeante.

MediStat couvre une quarantaine de tests fréquents. R en couvre des milliers via ses paquets. Pour des modèles mixtes, bayésiens, des méta-analyses, des séries temporelles complexes ou des méthodes récentes, MediStat ne suffit pas — et il vaut mieux le savoir avant de commencer.

Notez toutefois que MediStat **exporte un script R et une syntaxe SPSS** : vous pouvez rejouer et approfondir chaque analyse dans votre outil habituel.

### Suites hospitalières propriétaires

**Choisissez-les si** vous avez besoin d'une responsabilité contractuelle, d'une certification réglementaire nationale, d'un support 24 h/24 et d'une intégration complète incluant l'imagerie et le bloc.

C'est ce que MediStat ne peut pas offrir aujourd'hui, à aucun prix.

---

## 5. Les limites de MediStat, sans détour

| Limite | Portée |
|---|---|
| **Aucune base installée** | Aucun établissement en production à ce jour. Vous seriez parmi les premiers, avec ce que cela implique. |
| **Aucune certification** | Ni marquage CE dispositif médical, ni ONC, ni agrément national. Vérifiez ce qu'exige votre réglementation. |
| **Aucun contrat de support** | Pas de hotline, pas d'engagement de disponibilité, pas de responsabilité contractuelle. |
| **Pas d'imagerie** | Ni PACS, ni DICOM, ni compte rendu de radiologie. |
| **Pas de connexion aux automates** | Saisie manuelle ou import de fichier. |
| **Pas d'e-prescription externe** | Ordonnance imprimée uniquement. |
| **Facturation partielle** | Le module existe mais reste sommaire. |
| **Portail patient inachevé** | Les droits et les données existent ; l'écran dédié n'est pas terminé. |
| **Téléversement de documents inachevé** | Le modèle existe ; l'écran de dépôt n'est pas terminé. |
| **Traduction partielle des textes longs** | 50 langues pour l'ossature, français et anglais pour l'aide et les interprétations. |
| **Termes cliniques à faire relire** | « Critique », « bas », « élevé » orientent des décisions de soin. Faites-les relire par un soignant natif dans les langues où vous n'avez pas de locuteur. |
| **Maintenance intégralement à notre charge** | Le choix « zéro dépendance » a ce prix. |

---

## 6. Pour qui MediStat est le bon choix

### Oui, probablement

- **Centre de santé ou clinique de taille moyenne** cherchant un outil unique sans budget de licence.
- **Laboratoire indépendant** voulant un circuit tracé et signé sans investir dans un LIMS complet.
- **Équipe de recherche clinique** ayant besoin de collecter *et* d'analyser sans passer par Excel.
- **Structure en zone de réseau irrégulier**, où le fonctionnement hors ligne n'est pas un confort mais une condition.
- **Programme de santé publique multilingue** devant s'adresser aux patients dans leur langue.
- **Enseignement** : un seul fichier HTML installe un système de santé complet dans une salle de cours.

### Non, cherchez ailleurs

- **Hôpital de plus de 300 lits** avec bloc, imagerie et pharmacie hospitalière.
- **Établissement soumis à une certification nationale obligatoire.**
- **Laboratoire à fort volume** avec parc d'automates à connecter.
- **Recherche méthodologiquement avancée** : modèles mixtes, bayésiens, méta-analyses.
- **Structure exigeant un support contractuel** avec engagement de disponibilité.

---

## 7. Combiner plutôt qu'opposer

MediStat est conçu pour coexister. Trois assemblages qui fonctionnent :

| Assemblage | Répartition |
|---|---|
| **MediStat + DHIS2** | MediStat gère l'établissement ; les indicateurs agrégés remontent vers DHIS2 pour le pilotage national. |
| **MediStat + R** | MediStat collecte, contrôle et prépare ; l'analyse avancée se fait dans R via le script exporté. |
| **MediStat + LIMS existant** | MediStat pour le dossier et les statistiques ; échange avec le LIMS en HL7 FHIR R4. |

---

## 8. Résumé en une page

**Ce que MediStat fait mieux que les autres**
Le continuum soin → laboratoire → statistiques dans un seul outil. Des statistiques utilisables par un soignant. Aucune dépendance. Un fichier unique installable partout. 50 langues. Un fonctionnement hors ligne réel.

**Ce que les autres font mieux que MediStat**
La profondeur clinique hospitalière (OpenMRS). La surveillance nationale (DHIS2). La connexion aux automates (OpenELIS). L'étendue méthodologique (R, SPSS). La certification, le support et la responsabilité contractuelle (suites propriétaires).

**Le facteur décisif**
MediStat est neuf, sans base installée, sans certification, sans support commercial. Si votre contexte exige l'une de ces trois choses, la question est tranchée quelles que soient les fonctionnalités.

---

*MediStat — une initiative APSA, Actions pour la Promotion de la Santé en Afrique.*
*Promouvoir la santé, protéger la vie, renforcer les communautés.*
