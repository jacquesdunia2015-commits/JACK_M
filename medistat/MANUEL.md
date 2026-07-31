# MediStat — Manuel d'utilisation

*Version 1.0 — Une initiative APSA, Actions pour la Promotion de la Santé en Afrique.*

Ce manuel décrit chaque écran de MediStat, chaque rôle et chaque procédure.
Si vous découvrez le logiciel, commencez plutôt par le **[Guide du débutant](GUIDE-DEBUTANT.md)**, plus court et écrit en français simple.

---

## Sommaire

1. [Présentation générale](#1-présentation-générale)
2. [Installation et premier démarrage](#2-installation-et-premier-démarrage)
3. [Comptes, rôles et droits](#3-comptes-rôles-et-droits)
4. [Sécurité au quotidien](#4-sécurité-au-quotidien)
5. [Interface générale](#5-interface-générale)
6. [Langues](#6-langues)
7. [Dossier patient](#7-dossier-patient)
8. [Consultations et rendez-vous](#8-consultations-et-rendez-vous)
9. [Catalogue des analyses](#9-catalogue-des-analyses)
10. [Circuit du laboratoire](#10-circuit-du-laboratoire)
11. [Notification des patients](#11-notification-des-patients)
12. [Analyse quantitative](#12-analyse-quantitative)
13. [Analyse qualitative](#13-analyse-qualitative)
14. [Rapports et exports](#14-rapports-et-exports)
15. [Administration](#15-administration)
16. [Journal d'audit](#16-journal-daudit)
17. [Sauvegarde et restauration](#17-sauvegarde-et-restauration)
18. [Travail hors ligne](#18-travail-hors-ligne)
19. [Raccourcis clavier](#19-raccourcis-clavier)
20. [Diagnostic des incidents](#20-diagnostic-des-incidents)
21. [Limites connues](#21-limites-connues)

---

## 1. Présentation générale

MediStat réunit trois métiers dans un seul logiciel :

| Domaine | Ce que MediStat couvre |
|---|---|
| **Dossier médical** | Identité, antécédents, allergies, consultations, prescriptions, documents, chronologie du patient. |
| **Laboratoire** | Catalogue d'analyses, demandes, prélèvements, saisie, validation biologique, signature électronique, compte rendu. |
| **Analyse de données** | Statistiques descriptives et inférentielles, survie, diagnostic, multivarié, analyse qualitative de corpus. |

### Principes de conception

- **Aucune dépendance externe.** Le moteur PDF, le générateur Excel, l'algèbre matricielle, les lois de probabilité sont écrits et testés dans le projet. En contexte médical, chaque bibliothèque tierce est une surface d'attaque et une mise à jour à surveiller.
- **Hors ligne d'abord.** MediStat fonctionne sans réseau. Les écritures faites hors ligne partent d'elles-mêmes au retour de la connexion.
- **Chiffrement au repos.** Les champs de santé sont chiffrés en AES-GCM 256 bits dans la base locale.
- **Traçabilité inviolable.** Chaque entrée du journal d'audit contient l'empreinte de la précédente. Modifier ou supprimer une ligne casse la chaîne, et cela se voit — y compris pour un administrateur.

### Où sont les données

| Mode | Emplacement | Ce que cela implique |
|---|---|---|
| **Local seul** (par défaut) | Dans le navigateur du poste, en IndexedDB chiffré. | Rien ne sort de l'appareil. Aucun partage entre postes. Sauvegardez régulièrement. |
| **Avec serveur** | Base SQLite sur votre serveur, plus une copie locale. | Partage entre postes, sauvegarde centralisée, envoi des SMS. |

---

## 2. Installation et premier démarrage

### Les trois manières d'utiliser MediStat

| Manière | Pour qui | Comment |
|---|---|---|
| **Fichier unique** | Découverte, démonstration, poste isolé sans internet. | Ouvrez `dist/medistat-autonome.html`. Rien à installer. |
| **Application installée (PWA)** | Usage quotidien sur un poste ou un téléphone. | Ouvrez l'adresse, puis « Installer l'application ». |
| **Serveur** | Établissement à plusieurs postes. | `node server/api.mjs --port 8080`. Voir `INSTALLATION.md`. |

### Première configuration

Cette étape n'a lieu **qu'une fois**, et crée l'établissement et son compte administrateur.

| Champ | Rôle |
|---|---|
| Nom de l'établissement | Apparaît en tête de tous les comptes rendus. |
| Code court | 3 à 4 lettres. Entre dans les IPP et les numéros de demande. Ne le changez plus ensuite. |
| Type | Hôpital, clinique, centre de santé ou laboratoire indépendant. |
| Compte administrateur | Prénom, nom, identifiant, mot de passe. |
| Modules à activer | Facturation et portail patient. Désactivables plus tard sans perte. |
| Jeu de démonstration | 120 patients fictifs, leurs examens et résultats. Supprimable à tout moment. |

> **Important.** Le mot de passe de l'administrateur ouvre la clé de chiffrement de l'établissement. Il n'existe aucun moyen de le récupérer s'il est perdu et qu'aucun autre compte n'existe. Créez un second compte administrateur dès la mise en service.

---

## 3. Comptes, rôles et droits

### Les dix rôles

| Rôle | Ce qu'il fait | Ce qu'il ne peut pas faire |
|---|---|---|
| Administrateur système | Tout, sur tous les établissements. | — |
| Administrateur d'établissement | Paramétrage, utilisateurs, facturation, statistiques. | **Saisir ou valider un résultat.** |
| Médecin | Dossiers, consultations, prescriptions, demandes, lecture des résultats. | Valider un résultat. |
| Infirmier | Constantes, prélèvements, appui aux consultations. | Prescrire, valider. |
| Laborantin | Saisie des résultats à la paillasse. | **Valider un résultat.** |
| Biologiste | Saisie, validation, signature électronique. | Administrer les comptes. |
| Réceptionniste | Accueil, identité, rendez-vous. | **Voir un résultat d'analyse.** |
| Comptable | Facturation. | **Voir un résultat d'analyse.** |
| Qualité | Lecture du journal d'audit, indicateurs. | Modifier un résultat. |
| Patient | Portail : ses propres résultats. | Tout le reste. |

> **La séparation des rôles n'est pas une gêne, c'est la sécurité du patient.** Un administrateur ne doit pas pouvoir saisir un résultat : cela permettrait de modifier une valeur sans compétence biologique. Un laborantin ne valide pas ce qu'il a saisi : le double regard est le principe de base du contrôle qualité.

**Conséquence pratique :** avec le seul compte créé au démarrage, vous ne pourrez pas dérouler la chaîne du laboratoire. Créez au minimum un compte laborantin et un compte biologiste.

### Créer un utilisateur

1. **Utilisateurs** → **＋ Nouvel utilisateur**.
2. Renseignez prénom, nom, identifiant, rôle.
3. MediStat affiche les droits du rôle choisi avant validation.
4. **Créer le compte**.
5. Un mot de passe provisoire s'affiche **une seule fois**. Notez-le et transmettez-le par un canal sûr.

L'utilisateur devra le changer à sa première connexion.

### Garde-fous

MediStat refuse :

- de changer votre propre rôle ;
- de désactiver votre propre compte ;
- de désactiver le dernier administrateur actif.

Ces refus évitent de se retrouver enfermé dehors.

---

## 4. Sécurité au quotidien

### Politique de mots de passe

| Règle | Valeur |
|---|---|
| Tentatives avant blocage | 5 |
| Durée du blocage | 15 minutes |
| Verrouillage automatique | 15 minutes d'inactivité |
| Expiration | 180 jours |
| Réutilisation interdite | 5 derniers mots de passe |

MediStat refuse aussi les mots de passe courants (`password`, `admin2026`…) et les caractères répétés.

### Double authentification (2FA)

1. Menu compte → **Sécurité** → **Activer la double authentification**.
2. Scannez le QR code avec une application d'authentification.
3. Saisissez le code à 6 chiffres pour confirmer.

Recommandée pour tous les comptes administrateurs et biologistes.

### Comment fonctionne le chiffrement

MediStat utilise un **chiffrement enveloppe** :

- une clé de données unique par établissement, tirée au hasard ;
- cette clé est enveloppée séparément pour chaque utilisateur, avec une clé dérivée de son mot de passe ;
- elle n'est jamais stockée en clair, nulle part.

**Ce que cela change :** tous les soignants d'un établissement lisent les mêmes dossiers. Changer son mot de passe ré-enveloppe la clé sans toucher aux données. Deux établissements restent cryptographiquement cloisonnés.

### Verrouiller sa session

`Ctrl + L`, ou le cadenas 🔒 en haut à droite. Prenez-en l'habitude en quittant votre poste.

---

## 5. Interface générale

### Barre supérieure

| Élément | Fonction |
|---|---|
| ☰ | Replie la barre latérale (ordinateur) ou l'ouvre (téléphone). |
| Logo et nom | Établissement en cours. |
| Recherche | Cherche un patient, une demande ou un code-barres, partout. |
| Indicateur ● | Vert : connecté. Orange : hors ligne, les écritures sont en file. |
| Langue | 50 langues, rangées par continent. |
| 🔔 | Notifications internes. Les valeurs critiques y apparaissent en rouge. |
| 🔒 | Verrouille la session. |
| 🌓 | Thème clair ou sombre. |
| Compte | Profil, mot de passe, 2FA, sauvegarde, déconnexion. |

### Barre latérale

Quatre familles : **Soins**, **Laboratoire**, **Analyse de données**, **Administration**. Le logo APSA figure en tête, sous la marque MediStat.

Vous ne voyez que les écrans auxquels votre rôle donne accès. Un menu absent n'est pas une panne.

### Sur téléphone

La barre latérale sort de l'écran ; une barre de navigation apparaît en bas avec les quatre écrans les plus utilisés. Le sélecteur de langue se trouve alors dans **Établissement**.

---

## 6. Langues

MediStat propose **50 langues** couvrant les cinq continents : 15 pour l'Europe, 20 pour l'Asie et le Moyen-Orient, 11 pour l'Afrique, 2 pour les Amériques, 2 pour l'Océanie. Les langues transcontinentales — français, anglais, espagnol, portugais, arabe, russe, turc — apparaissent dans chacun de leurs continents.

L'arabe, l'hébreu, le persan et l'ourdou basculent l'interface entière de droite à gauche.

Les nombres et les dates suivent la locale de la langue : « 1 234,5 » en français, « 1.234,5 » en allemand, « 1,234.5 » en anglais.

### Portée de la traduction

| Traduit dans les 50 langues | Reste en français, puis en anglais |
|---|---|
| Navigation, actions, session | Interprétations statistiques |
| Vocabulaire de laboratoire essentiel | Aide en ligne détaillée |
| Messages envoyés aux patients | Messages d'erreur techniques |

Une clé non traduite retombe sur l'anglais, puis sur le français. **Aucun écran ne reste vide.** L'écran Établissement affiche le taux de couverture réel de la langue choisie.

> **Avertissement clinique.** Les termes « normal », « bas », « élevé » et surtout « critique » déclenchent des décisions de soin. Pour les langues dont votre établissement n'a pas de locuteur, faites relire ces clés par un professionnel de santé natif avant la mise en production.

---

## 7. Dossier patient

### Créer un dossier

**Patients** → **＋ Nouveau patient**.

| Champ | Remarque |
|---|---|
| Nom, prénom, date de naissance, sexe | Obligatoires. |
| **Allergies** | Affichées en rouge sur toutes les pages du dossier. Le champ le plus important. |
| Téléphone | Au format international si possible (`+243…`). |
| **Langue du patient** | Langue de ses SMS et comptes rendus. Distincte de celle de l'interface. |
| **Consentement aux notifications** | « Oui » ou rien. L'absence de réponse n'est pas un accord. |
| Antécédents, groupe sanguin, contact d'urgence, assurance | Facultatifs. |

MediStat attribue un **IPP** de la forme `CHU26000001` : code établissement, année, numéro d'ordre. Il ne change jamais.

### Consulter un dossier

Le dossier comporte :

- un bandeau d'identité avec l'âge calculé et les badges (groupe sanguin, allergies, langue, consentement) ;
- une **chronologie** de tous les événements ;
- l'historique des consultations et des résultats ;
- des **courbes d'évolution** par analyse, avec les bornes de référence tracées ;
- les documents rattachés.

### Archiver

Un dossier archivé sort des listes mais **n'est jamais supprimé**. En contexte médical, la suppression est toujours logique, jamais physique : la donnée reste auditable.

---

## 8. Consultations et rendez-vous

### Consultation

**Consultations** → **＋ Nouvelle consultation**. Motif, constantes (tension, température, poids, saturation), examen clinique, diagnostic codé CIM-10, conduite à tenir.

Depuis la consultation, vous pouvez enchaîner directement sur une prescription ou une demande d'examens.

### Prescription

Médicament, posologie, durée, voie. MediStat **signale automatiquement** si le médicament figure dans les allergies du patient.

### Rendez-vous

Planification par praticien avec vue calendaire. Les rendez-vous alimentent le tableau de bord.

---

## 9. Catalogue des analyses

Le catalogue définit ce que votre laboratoire sait faire.

### Amorcer depuis LOINC

**Catalogue des tests** → **Amorcer depuis LOINC** installe 24 analyses courantes avec leur code LOINC international, leurs unités et leurs bornes de référence.

### Paramètres d'une analyse

| Paramètre | Rôle |
|---|---|
| Code, nom, catégorie | Identification. |
| Code LOINC | Interopérabilité internationale. |
| Unité | Affichée partout avec la valeur. |
| Bornes de référence | En dehors : résultat « bas » ou « élevé ». |
| **Seuils critiques** | En dehors : alerte immédiate au prescripteur. |
| Délai de rendu | Alimente les indicateurs de ponctualité. |
| Prix | Alimente la facturation. |

> **Une borne laissée vide reste vide.** Elle n'est pas interprétée comme un zéro. Un seuil critique non renseigné ne déclenche donc aucune alerte — ce qui est le comportement voulu : un laboratoire dont chaque analyse sonne l'alarme est un laboratoire où plus personne ne l'entend.

---

## 10. Circuit du laboratoire

### Les sept états d'une demande

```
Enregistrée → Prélevée → Réceptionnée → En analyse → Saisie → Validée → Rendue
                                                                    ↘ Annulée
```

MediStat interdit de sauter une étape. Chaque transition exige un droit précis.

### 10.1 Créer une demande

**Demandes d'examens** → **＋ Nouvelle demande** → choisir le patient → cocher les analyses → degré d'urgence → **Enregistrer la demande**.

Une ligne de résultat vide est créée par analyse. La paillasse sait immédiatement ce qui reste à faire.

### 10.2 Prélèvement

Bouton **🩸 Enregistrer le prélèvement** sur la demande. MediStat génère un **code-barres avec clé de Luhn** : un chiffre mal lu est détecté.

### 10.3 Réception

Le laboratoire vérifie la conformité de l'échantillon. En cas de non-conformité, indiquez le motif : MediStat rappelle que le prescripteur doit être informé **avant** analyse.

### 10.4 Saisie à la paillasse

**Paillasse** liste les analyses à saisir, les plus urgentes d'abord.

Pendant la saisie, MediStat affiche en temps réel :

- l'**interprétation** : normal, bas, élevé, critique, avec sa couleur ;
- le **delta-check** : comparaison au dosage précédent du même patient, avec alerte si l'écart est invraisemblable ;
- les bornes de référence de l'analyse.

Utilisez la **virgule** décimale. Une valeur physiologiquement impossible est refusée.

### 10.5 Validation et signature

**Validation** liste les demandes prêtes, avec le nombre d'anomalies et de valeurs critiques.

1. **Valider** sur la demande.
2. Relisez le tableau récapitulatif.
3. Saisissez votre mot de passe.

La signature est une empreinte SHA-256 du contenu exact du résultat.

> **Toute modification ultérieure invalide la signature et bloque l'impression du compte rendu.** Ce n'est pas une panne : c'est la garantie que le document imprimé correspond bien à ce qui a été signé.

### 10.6 Correction d'un résultat rendu

Une erreur découverte après rendu se corrige par la procédure prévue : l'ancienne valeur est conservée, la nouvelle est versionnée, le motif est obligatoire, et le journal d'audit garde tout. **Ne contournez jamais cette procédure.**

### 10.7 Compte rendu

Génère un PDF conforme : en-tête de l'établissement, identité du patient, résultats avec unités et bornes, interprétations, valeurs hors norme signalées, identité et signature du biologiste, date.

---

## 11. Notification des patients

À la validation des résultats, le patient est prévenu automatiquement.

### Trois règles non négociables

1. **Le message n'annonce que la disponibilité.** Aucune valeur, aucun nom d'analyse, aucune interprétation. Un SMS transite en clair et s'affiche sur un écran verrouillé.
2. **Aucun envoi sans consentement explicite** du patient.
3. **Les identifiants de la passerelle ne quittent jamais le serveur.** Le poste dépose un message dans la file ; c'est le serveur qui appelle l'opérateur.

### Une valeur critique ne part jamais par SMS

Elle déclenche une **alerte interne au prescripteur**. On n'annonce pas une urgence à un patient par message, sans médecin en face.

### Activer la fonction

**Établissement** → « Notification automatique des patients ». Désactivée par défaut : un établissement qui n'a rien décidé ne doit pas se mettre à écrire à ses patients.

| Réglage | Rôle |
|---|---|
| Prévenir automatiquement | Interrupteur principal. |
| Canal préféré | SMS ou courriel. |
| Indicatif du pays | Complète les numéros saisis au format national. |

### Passerelles reconnues

Webhook générique, Twilio, Africa's Talking, Infobip, Vonage. Configurées **sur le serveur** ; l'écran affiche « secret enregistré », jamais le secret.

### Écran « Messages aux patients »

File d'envoi, état de remise, relance individuelle. Cinq tentatives espacées, puis abandon **visible**. Un message qui n'est jamais parti doit être vu par un humain.

---

## 12. Analyse quantitative

### Créer un jeu de données

**Jeux de données** permet d'importer un CSV ou un Excel, ou d'**extraire depuis le dossier médical et le laboratoire**.

MediStat détecte le type de chaque colonne : numérique, catégorielle, date, texte.

### Les 30 analyses guidées

| Famille | Contenu |
|---|---|
| **Descriptif** | Moyenne, médiane, écart-type, quartiles, asymétrie, aplatissement, intervalles de confiance, tableaux croisés. |
| **Comparaison de moyennes** | Student (une, deux, appariés), Welch, ANOVA à un et deux facteurs, ANOVA sur mesures répétées, post-hoc de Tukey. |
| **Non paramétrique** | Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, signe. |
| **Tables de contingence** | Khi-deux, Fisher exact, McNemar, Cochran-Armitage, kappa de Cohen. |
| **Corrélation et régression** | Pearson, Spearman, Kendall, régression linéaire simple et multiple, logistique, de Poisson, avec VIF. |
| **Normalité et variances** | Shapiro-Wilk, Lilliefors, Anderson-Darling, Levene, Bartlett. |
| **Survie** | Kaplan-Meier, test du log-rank, modèle de Cox. |
| **Diagnostic** | Courbe ROC et AUC, sensibilité, spécificité, valeurs prédictives, rapports de vraisemblance, Bland-Altman, règles de Westgard, CLSI. |
| **Multivarié** | ACP, analyse des correspondances, analyse discriminante, k-moyennes, classification hiérarchique. |

### Lire un résultat

Chaque analyse renvoie :

- la **statistique** et ses degrés de liberté ;
- la **valeur p** au format des publications ;
- la **taille d'effet** (d de Cohen, êta², V de Cramér…) ;
- l'**intervalle de confiance** ;
- la **vérification des conditions d'application** ;
- une **interprétation rédigée en français**.

> **La valeur p ne dit pas si un résultat est important.** Avec un grand échantillon, une différence négligeable devient « significative ». Lisez toujours la taille d'effet et l'intervalle de confiance.

MediStat vous prévient quand les conditions du test choisi ne sont pas réunies, et propose l'alternative appropriée.

---

## 13. Analyse qualitative

Pour les entretiens, les questions ouvertes, les observations de terrain.

| Outil | Usage |
|---|---|
| Corpus | Import des textes. |
| Livre de codes | Codes hiérarchiques, définitions, exemples. |
| Codage | Segments de texte associés à un ou plusieurs codes. |
| Lexicométrie | Fréquences, spécificités, richesse du vocabulaire. |
| Concordancier (KWIC) | Chaque occurrence d'un mot dans son contexte. |
| Co-occurrences | Quels codes apparaissent ensemble. |
| Courbe de saturation | À partir de quand les entretiens n'apportent plus de nouveau code. |
| Accord inter-codeurs | Kappa de Cohen entre deux codeurs. |
| Méthodes mixtes | Croisement d'un code qualitatif avec une variable quantitative. |

---

## 14. Rapports et exports

### Six rapports

Activité, laboratoire, qualité, épidémiologie, indicateurs de performance, synthèse pour la direction. Chacun s'exporte en PDF.

### Formats d'export

| Format | Usage |
|---|---|
| **PDF** | Comptes rendus, rapports. Moteur écrit dans le projet. |
| **CSV** | Tableur. BOM UTF-8 et point-virgule : Excel français l'ouvre correctement. |
| **XLSX** | Excel natif, plusieurs feuilles. |
| **HL7 FHIR R4** | Échange avec un autre système de santé. |
| **Script R / syntaxe SPSS** | Rejouer une analyse dans son logiciel habituel. |

### Anonymisation

Avant tout export de recherche, MediStat propose la **pseudonymisation** (identité remplacée par un code stable, réversible en interne) ou l'**anonymisation** (irréversible).

---

## 15. Administration

### Écran Établissement

Identification, coordonnées, modules activés, langue de l'interface avec taux de couverture, notification des patients, passerelle d'envoi, diagnostic du stockage.

### Modules activables

Laboratoire, consultations, facturation, portail patient, analyse de données. Désactiver un module masque ses écrans **sans supprimer les données**.

### Matrice des droits

**Utilisateurs** → **🛡️ Matrice des droits** affiche l'intégralité des rôles croisés avec les ressources et les actions. Utile pour un audit ou pour justifier un refus d'accès.

---

## 16. Journal d'audit

Chaque action sensible est enregistrée : qui, quoi, quand, sur quel enregistrement.

### Ce qui est tracé

Connexions et échecs, création et modification de dossier, consultation d'un dossier, saisie et validation de résultat, signature, correction, export, changement de droits, paramétrage, envoi de message.

### Ce qui n'est pas tracé

**Le contenu des données de santé.** Le journal indique qu'une allergie a été modifiée, jamais laquelle. Un journal consultable par l'administration ne doit pas devenir une seconde base de données médicales.

### Contrôle d'intégrité

**Journal d'audit** → **Vérifier l'intégrité** recalcule toute la chaîne d'empreintes. Si une entrée a été modifiée ou supprimée — même par un administrateur, même directement dans la base — MediStat le signale et indique la position de la rupture.

---

## 17. Sauvegarde et restauration

### Sauvegarder

Menu compte → **💾 Sauvegarder**. Produit un fichier chiffré contenant l'intégralité de la base.

**Recommandation :** une sauvegarde par semaine au minimum, conservée sur un support distinct du poste de travail.

### Restaurer

Menu compte → **♻️ Restaurer une sauvegarde**. Demande le mot de passe utilisé lors de la sauvegarde.

> **La restauration remplace la base actuelle.** Faites une sauvegarde de l'état présent avant de restaurer.

---

## 18. Travail hors ligne

MediStat continue de fonctionner sans réseau. L'indicateur de la barre supérieure passe à l'orange.

| Fonctionne hors ligne | Nécessite le réseau |
|---|---|
| Dossiers, consultations, prescriptions | Synchronisation entre postes |
| Circuit laboratoire complet | Envoi effectif des SMS |
| Statistiques et rapports | — |
| Exports PDF, CSV, XLSX | — |

Les écritures sont mises en file et partent d'elles-mêmes au retour de la connexion. Les messages aux patients suivent le même chemin.

---

## 19. Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl + L` | Verrouiller la session. |
| `Ctrl + K` | Recherche globale. |
| `Échap` | Fermer la fenêtre en cours. |
| `Tab` | Champ suivant. |
| `Entrée` | Valider le formulaire. |

L'ensemble de l'interface est utilisable au clavier seul, avec un focus visible.

---

## 20. Diagnostic des incidents

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Accès refusé » | Votre rôle n'a pas ce droit. | Normal. La tentative est tracée. |
| Compte bloqué | 5 échecs de connexion. | Attendre 15 minutes ou demander une réinitialisation. |
| Un menu manque | Votre rôle, ou un module désactivé. | Vérifier dans **Établissement**. |
| Impression du compte rendu refusée | Signature invalidée par une modification. | Revalider le résultat par la procédure de correction. |
| Valeur refusée à la saisie | Hors des bornes physiologiques. | Vérifier la virgule et l'unité. |
| SMS non reçu | Consentement, numéro, ou passerelle. | Écran **Messages aux patients**. |
| Écran de connexion après rechargement | Comportement voulu sur poste partagé. | Se reconnecter. |
| Lenteur sur de gros volumes | Base locale très remplie. | Archiver les dossiers anciens ; envisager le serveur. |
| Champs vides dans un dossier | Base créée avant la version 1.0. | Se reconnecter une fois : la clé est reprise automatiquement. |

---

## 21. Limites connues

MediStat ne fait pas tout. Ce qui suit est absent ou partiel, et le savoir vaut mieux que le découvrir en production.

| Domaine | État |
|---|---|
| Téléversement de documents (art. 6.4) | Le modèle de données existe ; l'écran de dépôt n'est pas terminé. |
| Portail patient (art. 12) | Les droits et les données existent ; l'interface dédiée n'est pas terminée. |
| Imagerie médicale (PACS, DICOM) | Non couvert. |
| E-prescription vers une pharmacie externe | Non couvert. |
| Connexion directe aux automates de laboratoire | Non couvert. La saisie est manuelle ou par import de fichier. |
| Certification ou accréditation | Aucune obtenue à ce jour. |
| Support commercial | Aucun contrat de support n'est proposé en l'état. |

Le détail article par article figure dans **`CONFORMITE.md`**.

---

## Nous contacter

APSA — Actions pour la Promotion de la Santé en Afrique
*Promouvoir la santé, protéger la vie, renforcer les communautés.*

---

*Ce manuel décrit MediStat 1.0. Les captures et les libellés correspondent à l'interface en français.*
