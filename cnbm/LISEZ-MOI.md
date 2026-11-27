# CNBM-RDC — Application de recensement des membres

📘 **Manuel d'utilisation** (avec captures d'écran) : [`manuel/index.html`](manuel/index.html) — PDF :
[complet](manuel/CNBM_Manuel_complet.pdf) · [adhérent](manuel/CNBM_Guide_adherent.pdf) ·
[administrateur de conseil](manuel/CNBM_Guide_administrateur.pdf) · [créateur](manuel/CNBM_Guide_createur.pdf).
Les PDF se régénèrent depuis `manuel/index.html` (paramètre `?partie=membre|admin|createur`), imprimé au format A4.

Application du **Conseil national des biotechnologistes médicaux de la RDC** pour recenser les
techniciens de laboratoire et les biologistes médicaux. Elle fonctionne sur **téléphone (Android, iPhone)
et ordinateur (Windows, Mac, Linux)**, **avec ou sans Internet**.

## Ce que l'application collecte

- **Identité** : nom, postnom, prénom, sexe, année de naissance, nationalité
- **Contacts** : téléphone, WhatsApp, e-mail
- **Adresse physique** : n°, avenue, quartier, commune, ville/territoire, province, pays
- **Profil** : catégorie, diplôme, spécialité, école, année d'obtention du diplôme
- **Carrière** : année de début du travail, lieu du premier emploi, nombre d'années d'expérience
- **Lieux de travail** (plusieurs possibles) : hôpital/établissement, fonction occupée, service, zone de santé,
  ville/territoire, province, pays
- **Formations suivies** durant la carrière (plusieurs possibles)
- **Adhésion au CNBM** : membre ou non, année d'adhésion, carte de membre, n° de carte, serment prêté (et année),
  cotisations à jour, nombre de mois payés, dernier mois payé
- **Pièces justificatives** (photos ou PDF) : diplômes, carte d'identité, passeport, carte de membre, attestation de serment,
  carte de service, certificats de formation… — diplôme et pièce d'identité exigés pour un dossier complet
- **Photo passeport** (recadrée automatiquement) et **vidéo de présentation** (2 minutes maximum,
  compressée automatiquement pour pouvoir partir par e-mail)

## Les trois espaces

| Espace | Qui | Accès |
|---|---|---|
| **Espace membre** (`index.html`) | Techniciens de laboratoire, biologistes médicaux, nouveaux candidats | Compte créé avec **téléphone ou e-mail + mot de passe** |
| **Espace responsables** (`index.html`, onglet 🏛️) | Administrateurs d'un conseil provincial ou du bureau national | Compte administrateur créé avec la **clé d'abonnement** du conseil |
| **Espace créateur** (`createur.html`) | Le créateur de la plateforme | Fichier de **clé privée de créateur** |

## Abonnements des conseils provinciaux

1. Le conseil (ex. Nord-Kivu) paie son abonnement (mensuel, trimestriel, semestriel, annuel ou essai de 30 jours).
2. Le créateur ouvre `createur.html`, charge sa clé privée, remplit le formulaire et obtient :
   - une **clé d'abonnement** pour les administrateurs du conseil ;
   - un **lien d'inscription** pour les membres du conseil (le lien rattache chaque membre au conseil et règle l'adresse de réception des fiches).
3. À l'expiration, l'import et l'export du registre du conseil sont bloqués jusqu'au renouvellement (nouvelle clé).

Les clés sont **signées** (ECDSA P-256) et vérifiées par l'application sans Internet : on ne peut ni les fabriquer ni modifier
leur date sans la clé privée du créateur. La clé publique correspondante est dans `index.html` (`CLES_PUBLIQUES_CREATEUR`).
**La clé privée ne doit jamais être déposée dans ce dépôt** (le fichier est exclu par `.gitignore`).

## Comment ça marche

1. Le membre ouvre le lien d'inscription de son conseil, crée son compte (téléphone ou e-mail + mot de passe) et note son code de récupération.
2. Il remplit sa fiche (pas besoin d'Internet ; tout est enregistré sur son appareil).
3. Le bouton **📄 Mon récapitulatif** lui donne un document téléchargeable (et imprimable en PDF) indiquant si son dossier est complet et s'il est membre en règle (carte, serment, cotisations).
4. Avec Internet, il appuie sur **📤 Envoyer aux responsables** : la fiche (`.txt`), la photo et la vidéo
   sont jointes à un e-mail (Gmail, Outlook…) adressé au secrétariat.
5. Le conseil importe les pièces jointes reçues dans **🏛️ Espace responsables**, puis clique sur
   **📊 Liste complète en Excel** : un fichier `.xlsx` contenant toutes les personnes inscrites et toutes
   leurs données (feuilles *Membres*, *Lieux de travail*, *Formations*).

## Nouveaux membres

Un candidat qui n'est pas encore membre répond « Non » à « Êtes-vous membre du CNBM ? » puis « Oui, je demande mon adhésion ».
Le conseil retrouve ces fiches avec le filtre **Demandes d'adhésion** et les accepte (bouton **✅ Accepter l'adhésion**, avec le n° de carte attribué).

## Limites actuelles (sans serveur)

- Un compte n'existe que **sur l'appareil où il a été créé**. Pour se connecter depuis n'importe quel appareil, il faut un serveur en ligne.
- Les fiches partent par **e-mail**, envoyé par le membre lui-même.
- Mot de passe oublié : code de récupération donné à l'inscription, ou réinitialisation par un administrateur sur le même appareil.

## Distribution

- **Par lien** (recommandé, permet d'installer l'icône sur le téléphone) : une fois publiée sur GitHub Pages,
  l'application est à l'adresse `https://jacquesdunia2015-commits.github.io/JACK_M/cnbm/`.
- **Sans Internet** : copier `index.html` (clé USB, WhatsApp) et l'ouvrir dans le navigateur.

## Confidentialité

Aucune donnée n'est envoyée à un serveur par l'application. Les fiches restent sur l'appareil jusqu'à ce que
le membre les envoie lui-même par e-mail. Le registre des responsables vit dans leur navigateur : faire
régulièrement une **💾 Sauvegarde complète** et la garder en lieu sûr.
