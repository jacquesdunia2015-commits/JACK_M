# CNBM-RDC — Application de recensement des membres

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
- **Photo passeport** (recadrée automatiquement) et **vidéo de présentation** (2 minutes maximum,
  compressée automatiquement pour pouvoir partir par e-mail)

## Comment ça marche

1. Le membre remplit sa fiche (pas besoin d'Internet ; tout est enregistré sur son appareil).
2. Avec Internet, il appuie sur **📤 Envoyer aux responsables** : la fiche (`.txt`), la photo et la vidéo
   sont jointes à un e-mail (Gmail, Outlook…) adressé au secrétariat.
3. Le secrétariat importe les pièces jointes reçues dans **🏛️ Espace responsables**, puis clique sur
   **📊 Liste complète en Excel** : un fichier `.xlsx` contenant toutes les personnes inscrites et toutes
   leurs données (feuilles *Membres*, *Lieux de travail*, *Formations*).

## À faire par le secrétariat avant de diffuser

Indiquer l'adresse e-mail qui recevra les fiches, de l'une de ces façons :

- dans l'application : **Espace responsables → Paramètres d'envoi**, puis **🔗 Copier le lien à partager
  aux membres** (le lien se termine par `?email=…` et configure l'adresse chez chaque membre) ;
- ou dans le fichier `index.html`, ligne `const EMAIL_PAR_DEFAUT = "";`.

## Distribution

- **Par lien** (recommandé, permet d'installer l'icône sur le téléphone) : une fois publiée sur GitHub Pages,
  l'application est à l'adresse `https://jacquesdunia2015-commits.github.io/JACK_M/cnbm/`.
- **Sans Internet** : copier `index.html` (clé USB, WhatsApp) et l'ouvrir dans le navigateur.

## Confidentialité

Aucune donnée n'est envoyée à un serveur par l'application. Les fiches restent sur l'appareil jusqu'à ce que
le membre les envoie lui-même par e-mail. Le registre des responsables vit dans leur navigateur : faire
régulièrement une **💾 Sauvegarde complète** et la garder en lieu sûr.
