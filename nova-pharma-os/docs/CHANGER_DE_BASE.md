# Changer de base de données sans rien perdre — gratuitement

La base gratuite de Render expire **30 jours après sa création**. Celle de
NOVA PHARMA OS expire le **12 octobre 2026**. Après cette date, elle devient
inaccessible ; Render la supprime définitivement 14 jours plus tard, avec
toutes ses données.

Render n'accepte **qu'une seule base gratuite à la fois** par compte : on ne
peut pas en créer une deuxième pour y recopier la première. La solution
gratuite et durable est **Neon** : une base PostgreSQL gratuite **qui
n'expire pas** (0,5 Go, largement assez pour une pharmacie).

NOVA PHARMA OS sait recopier lui-même toute l'ancienne base dans la
nouvelle, au démarrage de l'API, depuis Render. Vous n'installez rien.

> Faites-le **avant le 12 octobre**, de préférence le soir, quand personne
> ne vend : une vente enregistrée pendant la copie resterait dans
> l'ancienne base.

---

## Étape 1 — Créer la base Neon (5 minutes)

1. Ouvrez <https://neon.com> et créez un compte gratuit (avec votre adresse
   Gmail, par exemple).
2. Créez un projet : nom `nova-pharma`, version PostgreSQL **17**, et la
   **même région que votre service Render**. La région de Render est écrite
   sur la page du service nova-pharma-api (par exemple *Oregon* → choisissez
   *US West (Oregon)* chez Neon ; *Frankfurt* → *Europe (Frankfurt)*). Deux
   régions éloignées ralentiraient chaque page.
3. Sur le tableau de bord du projet, cliquez sur **Connect**. Dans la
   fenêtre :
   - décochez **Connection pooling** (il faut l'adresse directe) ;
   - copiez l'adresse affichée. Elle ressemble à :
     `postgresql://neondb_owner:XXXX@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
4. À la fin de cette adresse, **retirez** `&channel_binding=require` et
   gardez `?sslmode=require`.

C'est votre **nouvelle adresse**. Gardez-la de côté.

## Étape 2 — Régler le service nova-pharma-api sur Render

Ouvrez <https://dashboard.render.com> → **nova-pharma-api** →
**Environment**.

1. Repérez la variable **DATABASE_ADMIN_URL**. Copiez sa valeur actuelle :
   c'est l'adresse de **l'ancienne** base.
2. Ajoutez une variable **COPIER_DEPUIS_URL** et collez-y cette ancienne
   adresse.
3. Remplacez la valeur de **DATABASE_ADMIN_URL** par la **nouvelle**
   adresse (celle de Neon).
4. S'il existe une variable **DATABASE_URL**, **supprimez-la** : l'API la
   déduira de la nouvelle adresse.
5. Vérifiez qu'il existe une variable **NOVA_APP_PASSWORD**. Sinon, ajoutez-la
   avec un mot de passe long (au moins 20 caractères, lettres, chiffres et
   tirets, par exemple `Kv7-pQ2x-Zm9w-Lr4t-Hs8y` — inventez le vôtre). Neon
   refuse les mots de passe courts.
6. Cliquez sur **Save, rebuild, and deploy**.

## Étape 3 — Vérifier la copie

Dans **Logs** du service, attendez ces lignes (2 à 5 minutes) :

```
22 migration(s) appliquée(s) :
Copie de l’ancienne base vers la nouvelle…
Copie réussie : 89 tables, … lignes. Retirez maintenant COPIER_DEPUIS_URL des réglages du service.
```

Puis connectez-vous à <https://nova-pharma-os.onrender.com> avec vos comptes
habituels : vos produits, votre stock, vos ventes et vos factures doivent y
être, à l'identique.

## Étape 4 — Ranger

1. Dans **Environment**, **supprimez COPIER_DEPUIS_URL**, puis enregistrez.
   (Si vous l'oubliez, rien de grave : l'API constate que la nouvelle base a
   déjà ses pharmacies et ne recopie rien.)
2. Gardez l'ancienne base Render jusqu'au 12 octobre, au cas où. Ensuite,
   supprimez-la.

---

## Ce que la copie garantit

- **L'ancienne base n'est jamais modifiée** : elle est seulement lue.
- **Tout ou rien** : si quoi que ce soit échoue, la nouvelle base reste sans
  données et le déploiement échoue ; l'ancienne version de l'application continue
  de tourner sur l'ancienne base. Envoyez alors les dernières lignes des
  Logs.
- **Rien n'est écrasé** : si la nouvelle base contient déjà des pharmacies,
  la copie est ignorée.
- **Tout est vérifié** : le nombre de lignes de chaque table est comparé, et
  toutes les relations entre les données (clés étrangères) sont recontrôlées.
- Le cloisonnement entre pharmacies est rétabli à l'identique dans la
  nouvelle base.

## Et ensuite ?

Neon gratuit n'expire pas : plus besoin de recommencer tous les 30 jours.
Ses limites : 0,5 Go de données et 100 heures de calcul par mois ; la base
s'endort après 5 minutes sans activité et se réveille en une seconde à la
connexion suivante. Pour une ou deux pharmacies, c'est suffisant. Au-delà, il
faudra une offre payante (Neon, Render ou autre) — la même copie servira
alors à déménager.

Pour un déménagement ultérieur vers une autre base, la procédure est la même :
`COPIER_DEPUIS_URL` = l'adresse actuelle, `DATABASE_ADMIN_URL` = la nouvelle.
Pour remplacer volontairement une base qui contient déjà des données, ajoutez
`COPIER_FORCER=oui` (à retirer aussitôt après).
