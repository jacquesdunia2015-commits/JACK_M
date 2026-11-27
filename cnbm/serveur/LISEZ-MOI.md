# Serveur en ligne — plateforme de recensement CNBM-RDC

Le serveur donne à la plateforme :

- des **comptes utilisables depuis n'importe quel appareil** (téléphone, ordinateur) ;
- la **réception automatique des fiches** : dès que le membre valide sa fiche et qu'il a Internet, la fiche, la photo, la vidéo et les pièces justificatives partent au serveur. Plus besoin d'e-mail ni d'import manuel ;
- un **registre partagé par conseil** : chaque administrateur voit les fiches de **sa** province, et le bureau national les voit toutes ;
- la **récupération des fiches** quand un membre change de téléphone ;
- un **tableau de bord pour le créateur** (`createur.html` → « Tableau de bord du serveur ») : conseils, comptes ouverts, fiches reçues, volume des fichiers.

L'application continue de fonctionner **hors ligne** : les fiches validées sans Internet partent d'elles-mêmes au retour de la connexion.

## Ce qu'il faut

- **Node.js 22** ou plus récent (ou Docker). Aucune bibliothèque à installer : base SQLite et chiffrement intégrés à Node.
- Un **disque persistant** pour le dossier des données (`DONNEES`). Comptez environ **1 Go pour 500 membres** sans vidéo, et 5 à 10 Go avec des vidéos.
- Une adresse **HTTPS** (fournie automatiquement par les hébergeurs ci-dessous).

## Lancement local (essai)

```bash
node cnbm/serveur/serveur.mjs
```

Ouvrir ensuite http://localhost:8080 (l'application) et http://localhost:8080/createur.html (l'espace créateur).

## Variables

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port HTTP | `8080` |
| `DONNEES` | Dossier de la base `cnbm.sqlite` et des fichiers des membres | `./donnees-cnbm` |
| `ORIGINES` | Sites autorisés à utiliser l'API en plus du serveur lui-même (séparés par des virgules) | `https://jacquesdunia2015-commits.github.io` |
| `CLES_PUBLIQUES` | Clés publiques du créateur (JSON) | lues dans `cnbm/index.html` |

## Hébergement

### Render (recommandé, le plus simple)

1. Créez un compte sur https://render.com.
2. **New → Blueprint**, choisissez ce dépôt GitHub et, dans **Blueprint Path**, saisissez `cnbm/serveur/render.yaml`. Ce fichier configure tout : Docker, disque de 5 Go, contrôle de santé. Le `render.yaml` à la racine du dépôt appartient à un autre projet (LocaGest).
3. Une fois le déploiement terminé, notez l'adresse, par exemple `https://cnbm-rdc.onrender.com`.

Coût indicatif : offre *Starter* avec un disque persistant, quelques dollars par mois. L'offre gratuite n'a **pas de disque** : les données y seraient perdues à chaque redémarrage, ne l'utilisez pas.

### Serveur privé (VPS) ou machine du CNBM, avec Docker

```bash
docker build -f cnbm/serveur/Dockerfile -t cnbm-rdc .
```

```bash
docker run -d --name cnbm-rdc --restart unless-stopped -p 8080:8080 -v /srv/cnbm-donnees:/donnees cnbm-rdc
```

Placez ensuite un proxy HTTPS devant le port 8080 (Caddy, nginx).

## Après le déploiement

1. **Espace créateur** : ouvrez `https://<votre-serveur>/createur.html`. Le champ « Adresse du serveur » est rempli automatiquement. Les nouveaux abonnements et leurs liens d'inscription pointent alors vers le serveur.
2. **Conseils déjà abonnés** : renvoyez-leur un abonnement (bouton « Renouveler ») pour que leur lien d'inscription pointe vers le serveur. Les administrateurs ouvrent `https://<votre-serveur>/`, puis :
   - s'ils n'ont pas encore de compte sur le serveur, ils le créent avec « Je suis responsable d'un conseil » et la clé d'abonnement ;
   - s'ils ont déjà un compte, ils se connectent normalement.
3. **Version GitHub Pages** : pour qu'elle utilise aussi le serveur, renseignez `SERVEUR_PAR_DEFAUT` dans `cnbm/index.html`.

## Sauvegarde

Tout est dans le dossier `DONNEES` : la base `cnbm.sqlite` et le sous-dossier `fichiers/`. Copiez-le régulièrement (instantanés du disque chez l'hébergeur, ou `docker cp`). Les administrateurs peuvent aussi télécharger une **sauvegarde complète** de leur registre depuis l'application.

## Sécurité

- **Mots de passe** : hachés avec *scrypt* et jamais stockés en clair. Les sessions sont des jetons aléatoires, dont seule l'empreinte est conservée.
- **Clés d'abonnement** : signées par le créateur (ECDSA P-256) et vérifiées par le serveur. Un abonnement expiré bloque l'accès au registre du conseil.
- **Cloisonnement** : un administrateur ne voit que les fiches et les fichiers de sa province. Les tests vérifient que le Sud-Kivu n'accède pas aux fiches du Nord-Kivu.
- **Tableau de bord du créateur** : il exige une requête signée avec la clé privée du créateur.
- **Données personnelles** : les fiches concernent des professionnels de santé. Hébergez le serveur dans un environnement de confiance et limitez l'accès au disque.
