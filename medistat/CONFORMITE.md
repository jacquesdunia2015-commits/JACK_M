# Matrice de conformité au cahier des charges

Ce document répond article par article au *Cahier des charges fonctionnel et
technique — SaaS de gestion des dossiers médicaux et des résultats de
laboratoire, version 1.0 du 19 juillet 2026*.

Chaque ligne indique **où** l'exigence est mise en œuvre dans le code, afin que
la vérification soit possible sans parcourir l'ensemble du dépôt.

Légende : ✅ couvert — 🟡 partiel (motif indiqué)

---

## Article 4 — Périmètre fonctionnel

| Exigence | État | Mise en œuvre |
|---|:--:|---|
| Gestion administrative des patients | ✅ | `js/modules/patients.js` |
| Gestion des consultations | ✅ | `js/modules/consultations.js` |
| Gestion des prescriptions | ✅ | `js/core/model.js` (entité), `js/modules/laboratoire.js` |
| Demandes de laboratoire | ✅ | `js/modules/laboratoire.js` |
| Résultats de laboratoire | ✅ | `js/modules/laboratoire.js` |
| Documents médicaux | 🟡 | Magasin chiffré et modèle en place (`js/core/store.js`) ; interface de dépôt à compléter |
| Utilisateurs et rôles | ✅ | `js/modules/administration.js`, `js/core/auth.js` |
| Tableaux de bord | ✅ | `js/modules/tableau-bord.js` |
| Reporting | ✅ | `js/modules/rapports.js` |
| Export de données | ✅ | `js/core/export.js` |
| Audit trail | ✅ | `js/core/crypto.js` (chaînage), `js/modules/administration.js` |
| API d'intégration | ✅ | `server/api.mjs` |
| Multi-établissement | ✅ | `js/core/store.js` (cloisonnement), `server/api.mjs` |

**Architecture multi-tenant.** Chaque enregistrement porte un
`etablissement_id`. Le cloisonnement est appliqué **deux fois** : côté client
dans `depot()` (`js/core/store.js`), et côté serveur sur chaque route. Vérifié
par 12 contrôles automatisés dans `tests/serveur.test.mjs`, dont l'accès direct
par identifiant à un enregistrement d'un autre établissement — qui doit renvoyer
403.

---

## Article 5 — Profils utilisateurs

Les dix profils sont définis dans `js/core/model.js`, constante `ROLES`, et
redéclarés côté serveur dans `server/api.mjs` (le serveur ne fait jamais
confiance au client).

| Rôle | Niveau | Droits caractéristiques |
|---|:--:|---|
| Administrateur système | 100 | Tous droits, tous établissements |
| Administrateur d'établissement | 90 | Paramétrage et utilisateurs de son établissement |
| Médecin | 70 | Dossiers, prescriptions, résultats sensibles |
| Biologiste | 80 | **Validation et signature** des résultats |
| Laborantin | 55 | **Saisie** des résultats — mais pas leur validation |
| Infirmier | 50 | Constantes, prélèvements |
| Pharmacien | 50 | Prescriptions et délivrances |
| Réceptionniste | 30 | Patients et rendez-vous — **aucun accès aux résultats** |
| Responsable qualité | 75 | Audit et indicateurs — **lecture seule sur les résultats** |
| Comptable | 40 | Facturation — **aucun accès aux résultats** |
| Patient | 10 | Portail uniquement |

La séparation **laborantin / biologiste** est le point le plus important : elle
matérialise la responsabilité biologique. Elle est vérifiée par des contrôles
dédiés côté client et côté serveur.

---

## Article 6 — Fonctionnalités principales

### 6.1 Gestion des patients ✅

Création, modification, recherche rapide (`Ctrl+K`), identification unique par
IPP engendré (`genererIPP`), antécédents, allergies **signalées en évidence sur
chaque écran du dossier**, contacts d'urgence, archivage.

### 6.2 Gestion des consultations ✅

Ouverture, symptômes, constantes **avec alerte automatique sur valeurs
anormales** (fièvre ≥ 39 °C, tension ≥ 180/110, désaturation < 92 %…),
diagnostic codé CIM-10, prescription enchaînée, historique consolidé.

### 6.3 Gestion du laboratoire ✅

| Exigence | Mise en œuvre |
|---|---|
| Création d'une demande de test | `formulaireDemande()` |
| Affectation à un technicien | Champs `technicienId`, `laboratoireId` |
| Suivi du statut | 7 états, `STATUTS_DEMANDE` |
| Saisie des résultats | `saisirResultat()` avec delta-check |
| Validation | `validerDemande()`, réservée au biologiste |
| Signature électronique | `signerResultat()` — SHA-256 du contenu exact |
| Publication au dossier | Transition `rendue` + notification au prescripteur |
| Impression et export PDF | `compteRenduLaboratoire()` |

**Point notable :** l'impression est **bloquée** si la signature d'un résultat
est invalide, c'est-à-dire si le résultat a été modifié après signature.

### 6.4 Gestion documentaire 🟡

Entité `document` modélisée, magasin `documents` avec chiffrement du contenu,
traçabilité des ajouts et suppressions, classement par patient et par entité.
**L'interface de dépôt de fichiers reste à développer.**

### 6.5 Reporting ✅

`js/modules/rapports.js` — six rapports imprimables et exportables :

- patients actifs et volumes d'activité ;
- nombre de tests par période ;
- **taux de positivité par examen, avec intervalle de confiance de Wilson** ;
- délais de rendu (médiane, 90ᵉ centile, conformité par degré d'urgence) ;
- volume d'activité par utilisateur et par service ;
- statistiques financières si la facturation est activée.

---

## Article 7 — Module laboratoire

### 7.1 Paramétrage ✅

`js/modules/catalogue.js` — catégories d'examens (8 disciplines), catalogue des
tests, valeurs de référence, unités, **seuils d'alerte par test**, délais de
rendu contractuels, tarifs. Amorçage depuis un référentiel de 24 analyses
courantes codées LOINC.

### 7.2 Cycle de vie ✅

```
enregistrée → prélevée → réceptionnée → en analyse → saisie → validée → rendue
```

Les transitions sont déclarées dans `TRANSITIONS` (`js/core/model.js`) et
vérifiées par `transitionAutorisee()` **avant toute écriture**. Une transition
non prévue est refusée : il est impossible, par exemple, de passer de
« brouillon » à « validée ».

La correction d'un résultat déjà rendu est possible (`rendue → en analyse`),
mais elle incrémente la version, invalide la signature et est tracée.

### 7.3 Exploitation des résultats ✅

- **Identification des résultats hors norme** : `interpreterResultat()` situe
  chaque valeur par rapport aux normes et aux seuils critiques.
- **Alerte sur valeur critique** : bloquante, avec acquittement tracé après
  contact du prescripteur.
- **Commentaires du biologiste** : chiffrés au repos.
- **Signatures et validations internes** : `signerResultat()`,
  `verifierSignature()`.
- **Delta-check** : comparaison au dosage précédent, alerte au-delà de 50 %
  d'écart — souvent le signe d'une erreur d'identification d'échantillon.

---

## Article 8 — Exigences techniques

### 8.1 Architecture ✅

Web, modulaire (28 modules aux responsabilités distinctes), sécurisée,
évolutive, multi-tenant, déployable en cloud.

### 8.2 Composants ✅

| Composant attendu | Mise en œuvre |
|---|---|
| Frontend web | Application monopage, modules ES natifs |
| Backend API | `server/api.mjs` — REST, zéro dépendance |
| Base de données relationnelle | SQLite (`node:sqlite`), WAL activé |
| Stockage de documents | Magasin `documents`, contenu chiffré |
| Moteur de génération PDF | `DocumentPDF` — moteur interne, PDF 1.4 valide |
| Système d'authentification | `js/core/auth.js` + jetons HMAC serveur |
| Journalisation et audit | Chaîne d'empreintes SHA-256, côtés client et serveur |
| Module d'intégration externe | HL7 FHIR R4, LOINC, CSV, XLSX |

### 8.3 Interopérabilité ✅

- **API REST** documentée (voir README).
- **Import et export CSV et Excel** — XLSX authentique, validé par openpyxl.
- **Génération PDF** — validée par pdfminer, accents corrects (WinAnsi).
- **HL7 FHIR R4** — ressources `Patient`, `Observation`, `ServiceRequest`,
  lots `Bundle`, interprétations normalisées (`N`/`H`/`L`/`HH`/`LL`).
- **LOINC** — catalogue de 24 analyses courantes, champ `loinc` sur chaque test.

---

## Article 9 — Sécurité et conformité ✅

| Exigence | Mise en œuvre |
|---|---|
| Authentification sécurisée | PBKDF2-SHA256, 250 000 itérations, comparaison à temps constant |
| Gestion des rôles | 10 rôles, `ROLES` |
| Permissions fines | 9 droits × 13 ressources, `hasPermission()` |
| Chiffrement en transit | TLS via proxy (voir INSTALLATION.md) |
| Chiffrement au repos | AES-GCM 256 sur les champs sensibles |
| Journalisation de toutes les actions | 16 types d'événements tracés |
| Traçabilité des modifications | Version, auteur, horodatage sur chaque enregistrement |
| Sauvegardes régulières | `exporterBase()` + sauvegarde SQLite |
| Plan de reprise | `restaurerBase()`, procédure documentée |

**Mesures complémentaires :** blocage après 5 échecs, verrouillage automatique
après 15 minutes d'inactivité, historique interdisant la réutilisation des 5
derniers mots de passe, double authentification TOTP (RFC 6238),
pseudonymisation pour les exports de recherche, limitation de débit,
neutralisation de la traversée de répertoire, en-têtes de durcissement HTTP.

---

## Article 10 — Gestion des droits d'accès ✅

Les neuf droits élémentaires sont définis dans `DROITS` : lecture, création,
modification, validation, suppression, export, administration, signature, accès
aux résultats sensibles.

La matrice complète est consultable dans l'application :
*Administration › Utilisateurs › Matrice des droits*.

Conformément à la matrice illustrative de l'article 10 :

| Rôle | Droit caractéristique | Vérifié |
|---|---|:--:|
| Laborantin | Saisie et soumission des résultats — **pas la validation** | ✅ |
| Biologiste | Validation et signature | ✅ |
| Médecin | Consultation des dossiers et des résultats | ✅ |
| Administrateur | Paramétrage et administration | ✅ |
| Patient | Consultation de ses propres résultats | ✅ |

---

## Article 11 — Interface utilisateur ✅

- **11.1 Interface clinique** — simple, rapide, claire ; utilisable sur
  ordinateur, tablette et téléphone. Sur petit écran, les tableaux se
  transforment en cartes empilées, plus lisibles au doigt. Cibles tactiles d'au
  moins 44 px, contrastes conformes au niveau AA des WCAG.
- **11.2 Interface laboratoire** — paillasse (analyses en attente, classées par
  urgence), statut des échantillons, saisie, **alertes sur valeurs critiques**,
  validation et impression.
- **11.3 Interface d'administration** — utilisateurs, services, paramétrage des
  tests, établissements, rapports, audit.

---

## Article 12 — Portail patient 🟡

Rôle `patient` et permissions `portail:lecture` / `portail:export` définis.
**L'interface dédiée reste à développer.** Le cahier des charges qualifie ce
module d'optionnel, son activation étant à confirmer lors du cadrage détaillé.

---

## Article 13 — Notifications 🟡

| Canal | État |
|---|---|
| Notification in-app | ✅ Opérationnelle, avec compteur et panneau dédié |
| Alerte sur résultat critique | ✅ Bloquante, acquittement tracé |
| Rappel de rendez-vous | ✅ Modèle en place (`rappelEnvoye`) |
| Courrier électronique | 🟡 À raccorder au déploiement (SMTP) |
| SMS | 🟡 À raccorder au déploiement (passerelle opérateur) |

Ces deux passerelles dépendent d'un prestataire et d'une configuration propres
à chaque établissement ; l'entité `notification` porte déjà le champ `canal`.

---

## Article 14 — Multi-établissement ✅

Plusieurs cliniques, laboratoires et services au sein d'un même groupe.
Configurations spécifiques par site via `modules`. Cloisonnement strict des
données, vérifié automatiquement. Administration centrale.

---

## Article 15 — Facturation ✅

Module **activable ou désactivable** selon que la structure est publique, privée
ou mixte. Tarification par acte, établissement de factures à partir des demandes
rendues, suivi des règlements, indicateurs financiers au tableau de bord.

---

## Article 16 — Journal d'audit ✅

Les événements tracés couvrent l'ensemble de la liste de l'article 16 :
connexion, création d'un dossier patient, modification d'un résultat,
validation, suppression, export, impression, changement de droits, paramétrage
— auxquels s'ajoutent l'échec de connexion, le refus d'accès, la consultation
d'un dossier, la signature, la correction et l'alerte critique.

**« Non modifiable par l'utilisateur standard, quel que soit son niveau de
privilège fonctionnel. »** Cette exigence est satisfaite par un chaînage
cryptographique : chaque entrée contient l'empreinte SHA-256 de la précédente.
Supprimer, insérer ou modifier une entrée rompt la chaîne — y compris si
l'auteur est administrateur et opère directement sur la base.

Le contrôle est accessible dans l'application (*Administration › Journal
d'audit › Contrôler l'intégrité*) et par l'API (`GET /api/audit/integrite`).
Il est vérifié par des tests qui **falsifient délibérément la base** et
constatent la détection.

Le journal ne contient **aucune donnée de santé en clair** : les champs
sensibles y sont remplacés par une mention de présence.

---

## Article 17 — Modèle de données ✅

Les quatorze entités attendues sont modélisées dans `js/core/model.js`,
constante `ENTITES` : Patient, Consultation, Prescription, Test laboratoire,
Échantillon, Résultat, Document, Utilisateur, Rôle, Établissement, Audit,
Notification, Facture, Historique (vue consolidée).

S'y ajoutent trois entités propres à l'extension analytique : Rendez-vous,
Jeu de données, Corpus.

---

## Article 18 — Exports et impressions ✅

Rapports PDF, résultats imprimables, exports CSV et Excel, fichiers d'échange
pour intégration externe (FHIR, JSON).

**« Le rendu PDF devra respecter la mise en page des formulaires cliniques et
des résultats de laboratoire. »** Le compte rendu comporte un en-tête
d'établissement, un bloc d'identification patient, les résultats groupés par
discipline, le signalement des valeurs hors normes et critiques, le commentaire
du biologiste, la signature électronique avec son empreinte, et une pagination.

---

## Article 19 — Performance et disponibilité ✅

| Exigence | Mise en œuvre |
|---|---|
| Chargement rapide | Vues chargées à la demande ; seul le code utilisé est évalué |
| Utilisateurs simultanés | SQLite en mode WAL (lectures concurrentes) |
| Volumes croissants | Index sur toutes les clés de recherche |
| Performance des recherches | Recherche par index, jamais par balayage complet |
| Accès aux historiques | Pagination systématique |
| Stabilité en pic d'activité | Limitation de débit, plafonnement des charges utiles |

Le fonctionnement hors ligne apporte une disponibilité que le cahier des charges
n'exigeait pas : une panne réseau n'interrompt pas le travail.

---

## Article 20 — Maintenance et support ✅

| Livrable | Emplacement |
|---|---|
| Documentation technique | `README.md` |
| Documentation utilisateur | `Aide` dans l'application + guide PDF téléchargeable |
| Manuel d'administration | `INSTALLATION.md` + `Aide › Rôles et droits` |
| Procédure de sauvegarde | `INSTALLATION.md` §Sauvegardes + `Aide › Maintenance` |
| Procédure de restauration | Idem |
| Procédure de mise à jour | `INSTALLATION.md` §Mise à jour |

---

## Article 21 — Livrables ✅

Cahier des charges (référence), architecture technique (README), base de
données (schéma dans `server/api.mjs`), frontend web, backend API, module
laboratoire, module patients, module d'administration, **tests (689 contrôles)**,
documentation, déploiement (installateurs), support de formation (jeu de
démonstration et guide intégré).

Les maquettes UX/UI ne sont pas livrées séparément : l'interface implémentée en
tient lieu.

---

## Article 23 — Critères de réception

Les huit conditions cumulatives, et comment les vérifier :

| Critère | Vérification |
|---|---|
| Un patient peut être créé et suivi dans le temps | *Patients › Nouveau patient*, puis onglet Résultats du dossier |
| Un examen peut être prescrit | *Demandes › Nouvelle demande* |
| Un résultat peut être saisi, validé et consulté | *Paillasse* → *Validation* → dossier patient |
| Un document PDF peut être généré | *Demande validée › Compte rendu PDF* |
| L'audit trail est complet | *Administration › Journal d'audit*, 16 types d'événements |
| Les rôles et permissions fonctionnent | *Matrice des droits* ; 30 contrôles automatisés |
| Le système reste stable et sécurisé | 689 contrôles automatisés au vert |
| Plusieurs établissements, données étanches | 12 contrôles de cloisonnement dans `tests/serveur.test.mjs` |

---

## Extensions au cahier des charges

Ajoutées à la demande, au-delà du périmètre initial :

- **Moteur statistique complet** — une quarantaine de tests d'hypothèse,
  régressions, analyse de survie, épidémiologie, analyses multivariées,
  fidélité, planification d'étude. Validé contre R et SPSS.
- **Analyse qualitative** — codage thématique, lexicométrie, concordancier,
  cooccurrences, saturation, accord inter-codeurs, méthodes mixtes.
- **Fonctionnement hors ligne intégral** et installation sur tout appareil.
- **Exports vers R, SPSS, Stata et jamovi**, script d'analyse fourni.
- **Contrôle qualité de laboratoire** — règles de Westgard, Six Sigma
  analytique, intervalles de référence CLSI C28-A3, différence critique.
