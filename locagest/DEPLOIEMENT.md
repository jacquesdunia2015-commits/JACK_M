# Mettre LocaGest en ligne (Render)

LocaGest a besoin d'un serveur et d'une base de données qui tournent en permanence. Le plus simple
est **Render** : le fichier `render.yaml` à la racine du dépôt décrit tout, et Render installe le
reste tout seul.

## Les étapes (10 minutes)

1. **Créez un compte** sur <https://render.com> avec le bouton **« Sign in with GitHub »**.
   Autorisez Render à lire le dépôt `JACK_M`.
2. **Cliquez sur ce lien de déploiement** :
   <https://render.com/deploy?repo=https://github.com/jacquesdunia2015-commits/JACK_M>
3. Render affiche ce qu'il va créer : une base **locagest-db** et un service **locagest**.
   Il demande deux valeurs :
   - `ADMIN_EMAIL` : votre adresse email (compte administrateur de LocaGest) ;
   - `ADMIN_PASSWORD` : un mot de passe solide (12 caractères ou plus). Notez-le.
4. Cliquez sur **« Apply »** (ou « Deploy Blueprint »). Comptez 5 à 10 minutes pour la première
   installation.
5. Ouvrez le service **locagest** : son adresse s'affiche en haut, du type
   **`https://locagest-xxxx.onrender.com`**. **C'est le lien d'accès à votre SaaS.**
6. Connectez-vous avec l'email et le mot de passe de l'étape 3 : vous arrivez dans
   l'**administration**. Les bailleurs créent leur compte eux-mêmes avec « Créer un compte ».

Chaque fois qu'une modification arrive sur la branche `main` du dépôt, Render redéploie
automatiquement.

## Ce que permet l'offre gratuite, et ses limites

L'offre gratuite suffit pour **tester et faire des démonstrations**, pas pour de vrais clients :

| Limite de l'offre gratuite | Conséquence |
|---|---|
| Le service s'endort après 15 minutes sans visite | La première ouverture suivante prend environ une minute |
| La base de données gratuite expire au bout de 30 jours | Les données sont perdues si vous ne passez pas à une offre payante |
| Pas de disque permanent | Les photos des propriétés disparaissent à chaque redéploiement |

**Pour de vrais clients**, passez dans Render :
- le service **locagest** en offre **Starter** (environ 7 $/mois) et ajoutez-lui un **disque**
  (« Disks », 1 Go, point de montage `/opt/render/project/src/locagest/server/uploads`) ;
- la base **locagest-db** en offre **Basic** (à partir d'environ 6 $/mois), avec sauvegardes.

Les tarifs évoluent : vérifiez-les sur <https://render.com/pricing>.

## Activer l'envoi réel des emails

Au départ, les emails d'alerte sont **simulés** : ils apparaissent dans les journaux (« Logs ») du
service et dans l'historique des alertes, sans partir vraiment. Pour les envoyer :

1. Créez un compte chez un service d'envoi d'emails, par exemple **Brevo** (offre gratuite de 300
   emails par jour) ou **SendGrid**, et récupérez les accès **SMTP**.
2. Dans Render › **locagest** › **Environment**, ajoutez :
   `SMTP_HOST`, `SMTP_PORT` (souvent 587), `SMTP_USER`, `SMTP_PASS`, et
   `MAIL_FROM` (par exemple `LocaGest <alertes@votre-domaine.com>`).
3. Enregistrez : Render redémarre le service, et les emails partent réellement.

## Utiliser votre propre nom de domaine

Dans Render › **locagest** › **Settings** › **Custom Domains**, ajoutez par exemple
`app.locagest.cd`, puis créez chez votre registraire de domaine l'enregistrement DNS indiqué par
Render. Le certificat HTTPS est fourni automatiquement.

## Données de démonstration

La version en ligne démarre **vide** : seul votre compte administrateur existe, et les bailleurs
créent leur compte eux-mêmes. N'y chargez pas les données de démonstration (`npm run seed`) : elles
créent des comptes aux mots de passe connus de tous, dont un compte administrateur. Gardez-les pour
une installation locale.
