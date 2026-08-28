# 🚀 Commercialiser QualiCode — de A à Z, à partir d'aujourd'hui

*Guide opérationnel. Complète [PRICING.md](PRICING.md) (grille tarifaire) et
[MARKETING.md](MARKETING.md) (cibles, canaux, modèle économique).*

---

## Où en est le produit aujourd'hui

| | État |
|---|---|
| Fonctionnalités | ✅ 70/70 vérifiées automatiquement (import, codage, analyses, exports, IA, temps réel…) |
| Ordinateur | ✅ installation avec icône, en ligne comme hors ligne |
| Téléphone Android | ✅ installation confirmée |
| iPhone / tablettes | ✅ prévu (Safari), même procédure |
| Essai + abonnements | ✅ 5 jours, puis jour/semaine/mois/an/à vie |
| Contrôle des licences | ✅ **clés verrouillées par appareil** (voir §3) |
| Suivi des clients | ✅ `tools/gestion_clients.py` |
| Documentation client | ✅ Guide, Manuel débutant, schéma d'installation |

**Il ne manque rien de technique pour vendre.** Ce qui reste est commercial :
publier, encaisser, faire connaître.

---

## §1. Les 6 étapes, dans l'ordre

### Étape 1 — Verrouiller votre secret de licence (30 minutes, INDISPENSABLE)

Tant que le secret par défaut est en place, n'importe qui pourrait fabriquer des
clés gratuites.

1. Inventez une phrase secrète longue, connue de vous seul.
2. Remplacez `LICENSE_SECRET` **aux trois endroits** :
   `js/license.js`, `tools/generer_cle.py`, `tools/gestion_clients.py`.
3. Reconstruisez : `python3 tools/build_standalone.py && python3 tools/faire_paquet_web.py`
4. **Passez le dépôt GitHub en privé** (Settings → General → Danger Zone →
   Change visibility). Un dépôt public contenant votre secret = licences
   contournables.

> ⚠️ Toutes les clés déjà distribuées cessent de fonctionner quand vous changez
> le secret. Faites-le **avant** votre première vente.

### Étape 2 — Publier l'application (15 minutes)

C'est votre « boutique » : l'adresse que vous donnerez à tout le monde.

1. `python3 tools/faire_paquet_web.py` → `dist/QualiCode_site.zip`
2. Déposez-le sur **Netlify Drop** (`app.netlify.com/drop`), Cloudflare Pages ou
   Vercel — gratuit, glisser-déposer, adresse `https://…` immédiate.
3. Créez un compte pour **garder la main** sur le site et pouvoir le mettre à jour.
4. Renommez le site (ex. `qualicode.netlify.app`), puis, quand vous serez prêt,
   achetez un nom de domaine (≈ 12 $/an : `qualicode.africa`, `qualicode.rw`…).
5. Régénérez le schéma d'installation à votre adresse :
   `QC_URL="https://votre-adresse/" node tools/faire_schema.js`

### Étape 3 — Ouvrir les moyens de paiement (1–2 jours d'attente)

1. **Un agrégateur africain** — CinetPay, FedaPay (Bénin), Flutterwave ou
   PawaPay : un seul compte couvre Orange Money, MTN MoMo, Airtel Money **et**
   les cartes Visa/Mastercard. Il faut une pièce d'identité et un numéro
   marchand.
2. **PayPal** pour la diaspora et l'international.
3. Renseignez vos liens et numéros dans `js/payments.js` (`PAY_CONFIG`), puis
   reconstruisez. Ils s'affichent automatiquement dans « 💳 Abonnement ».
4. Ouvrez un **numéro WhatsApp Business** dédié : c'est votre canal de vente,
   de livraison des clés et de support.

### Étape 4 — Préparer les documents de vente (1 journée)

- Le **schéma d'installation** (`assets/schemas/installation-telephone.png`) à
  envoyer avec chaque lien.
- Une **vidéo de 3 minutes** filmée sur votre écran : importer un entretien,
  coder trois passages, montrer la matrice. C'est l'argument le plus efficace.
- Votre **mémoire** comme étude de cas : « analyse réalisée avec QualiCode ».

### Étape 5 — Vendre les 10 premières licences (2 à 4 semaines)

Visez vos cercles proches : promotion, encadreurs, collègues de terrain.
Le circuit complet est au §2. Objectif : **10 clients payants**, pas 100. Ces
dix-là vous diront ce qui bloque, et deviendront vos références.

### Étape 6 — Passer à l'échelle (mois 2 à 12)

- Offrez la **licence à vie à 5 encadreurs** de méthodologie : chacun expose
  20 à 50 étudiants par an.
- Lancez un **atelier payant** (20 places × 20–50 $, licence 1 mois incluse).
- Recrutez **2 ambassadeurs** (Bénin, Rwanda) payés 25–30 % de commission en
  mobile money.
- Enregistrez l'entreprise et déposez la marque (OAPI/ARIPO) quand le chiffre
  d'affaires le justifie.

---

## §2. Le circuit de vente, pas à pas (à imprimer)

```
1. Le client vous contacte (WhatsApp, atelier, bouche-à-oreille)
        │
2. Vous envoyez : le lien du site + le schéma d'installation
        │
3. Il installe et utilise QualiCode GRATUITEMENT pendant 5 jours
        │
4. À l'expiration, l'application lui affiche les tarifs et vos moyens de paiement
        │
5. Il paie (mobile money / carte / PayPal) et vous envoie :
   • la preuve de paiement
   • son CODE APPAREIL (dans « 💳 Abonnement », en gros à l'écran)
        │
6. Vous enregistrez la vente :
   python3 tools/gestion_clients.py vendre "Nom" email month \
       --appareil XXXX-XXXX --montant 15 --canal "MTN MoMo"
        │
7. L'outil affiche un message tout prêt : vous le copiez dans WhatsApp
        │
8. Le client colle la clé → 💳 Abonnement → Activer → c'est actif, hors ligne
        │
9. Avant l'échéance : python3 tools/gestion_clients.py rappels --jours 7
   → vous relancez avec le message proposé
```

**Délai réaliste** : moins d'une heure entre le paiement et l'activation.

---

## §3. « Si j'envoie le fichier par WhatsApp, comment garder le contrôle ? »

C'est LA question, et la réponse est encourageante.

### Oui, le fichier fonctionne chez les autres

Le fichier `QualiCode.html` envoyé par WhatsApp, e-mail ou clé USB **s'ouvre et
fonctionne parfaitement** chez le destinataire : c'est une application complète
dans un seul fichier. Deux nuances :

- il **fonctionne** partout, mais ne peut pas être **installé** en icône depuis
  un fichier reçu (règle des navigateurs) — pour l'icône, il faut passer par
  votre adresse web ;
- chaque destinataire démarre avec **son propre essai de 5 jours**.

### Et vous gardez le contrôle grâce au CODE APPAREIL

Chaque installation affiche un code unique (ex. `K7QP-3M2X`) dans
« 💳 Abonnement ». Quand vous générez une clé **avec** `--appareil K7QP-3M2X` :

| Situation | Résultat |
|---|---|
| Le client active la clé sur SON appareil | ✅ fonctionne |
| Il transmet sa clé à un ami | ❌ refusée : « cette clé a été délivrée pour un AUTRE appareil » |
| Quelqu'un partage le fichier QualiCode | ✅ il l'obtient… mais avec 5 jours d'essai, puis il doit acheter |

**C'est donc un atout, pas un risque** : laissez le fichier circuler, il fait
votre publicité. Chaque copie est un prospect qui devra prendre sa propre clé.

### Ce que cette protection ne fait PAS (à savoir)

- **Aucune coupure à distance.** Une application hors ligne ne peut pas être
  désactivée par le vendeur. Une clé délivrée reste valable jusqu'à sa date
  d'expiration — « résilier » signifie simplement **ne pas renouveler**.
- **Réinstallation = nouveau code appareil.** Si un client change de téléphone
  ou vide les données de son navigateur, régénérez sa clé :
  `python3 tools/gestion_clients.py cle son@email --appareil NOUVEAU-CODE`
  (c'est normal et gratuit pour lui — c'est du service client).
- **Un informaticien déterminé peut contourner** la protection, puisque le
  secret est dans le fichier. C'est vrai de tout logiciel hors ligne. Votre
  vraie protection commerciale : un prix bas, un support rapide, des mises à
  jour régulières.

### Conseil de stratégie

Verrouillez par appareil **les licences longues** (an, à vie) et les clients
que vous ne connaissez pas. Pour une licence jour/semaine à 1,50 $, le verrou
est facultatif : le service client compte plus que la fraude.

---

## §4. Gérer vos clients au quotidien

Tout tient dans `clients.json` (créé automatiquement, **jamais publié** — il est
exclu par `.gitignore`). Sauvegardez-le comme votre comptabilité.

| Ce que vous voulez faire | Commande |
|---|---|
| Enregistrer une vente + générer la clé | `python3 tools/gestion_clients.py vendre "Nom" email month --appareil XXXX-XXXX --montant 15 --canal "MTN MoMo"` |
| Voir tous les clients et le chiffre d'affaires | `python3 tools/gestion_clients.py liste` |
| Savoir qui relancer cette semaine | `python3 tools/gestion_clients.py rappels --jours 7` |
| Renvoyer une clé perdue / changement d'appareil | `python3 tools/gestion_clients.py cle email --appareil NOUVEAU` |
| Marquer un client comme parti | `python3 tools/gestion_clients.py revoquer email` |

**Rythme conseillé** : `liste` une fois par semaine, `rappels` tous les lundis.

**Support** : promettez « réponse WhatsApp sous 24 h » et tenez-le. Dans ce
marché, c'est un avantage concurrentiel supérieur à n'importe quelle
fonctionnalité. Quand un client signale un problème d'installation, demandez-lui
le **📋 diagnostic copié** depuis l'application : vous saurez immédiatement quoi
répondre.

---

## §5. Déployer une mise à jour (quand vous améliorez QualiCode)

```bash
# 1. Reconstruire les deux formats
python3 tools/build_standalone.py      # dist/QualiCode.html  (fichier unique)
python3 tools/faire_paquet_web.py      # dist/QualiCode_site.zip (site)

# 2. Republier le site : glisser le zip sur Netlify (même site → même adresse)
# 3. Prévenir les clients : « rouvrez QualiCode, la nouvelle version s'installe seule »
```

Les utilisateurs qui ont **installé depuis le site** reçoivent la mise à jour
automatiquement à la réouverture (le service worker récupère la nouvelle
version). Ceux qui utilisent le **fichier unique** doivent recevoir le nouveau
fichier — d'où l'intérêt de pousser tout le monde vers le site.

**Ne changez jamais le secret de licence lors d'une mise à jour de routine** :
toutes les clés en circulation cesseraient de fonctionner.

---

## §6. Erreurs à éviter (vues chez d'autres éditeurs)

1. **Vendre avant d'avoir changé le secret** → licences contournables dès le premier client technique.
2. **Laisser le dépôt public** → même conséquence.
3. **Promettre une fonctionnalité qui n'existe pas** → remboursements et réputation abîmée. Tout ce qui est annoncé dans COMPARATIF.md est vérifié par les tests.
4. **Négliger la sauvegarde de `clients.json`** → vous perdez la trace de vos abonnés.
5. **Baisser les prix trop vite** → commencez au tarif affiché ; accordez plutôt des durées offertes (un mois de plus) que des remises.
6. **Oublier les données de recherche** : rappelez à chaque client d'exporter son `.projx` régulièrement. Un client qui perd son mémoire vous en tiendra rigueur, même si la faute vient de son navigateur.
