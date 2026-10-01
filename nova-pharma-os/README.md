# NOVA PHARMA OS

**Plateforme SaaS de gestion pharmaceutique, commerciale et logistique.**

> NOVA PHARMA OS permet aux pharmacies de gérer leurs opérations, sécuriser leurs
> stocks, améliorer leurs marges et développer leurs ventes, depuis une plateforme
> adaptée aux réalités africaines.
>
> Du point de vue de l'éditeur : une plateforme multi-pharmacies, multi-branches et
> par abonnement, permettant de commercialiser, administrer, sécuriser et faire
> évoluer le logiciel à grande échelle.

La pharmacie pilote de validation opérationnelle est **NOVA SANTÉ PHARMA**, à Bukavu.

---

## Ce qui est livré

Deux espaces distincts, une seule base :

| Espace | Administré par | Contenu |
|---|---|---|
| **Back-office SaaS** | NOVA PHARMA OS | Pharmacies clientes, forfaits, abonnements, facturation, relances, support, métriques, sauvegardes |
| **Espace pharmacie** | Chaque pharmacie abonnée | Catalogue, lots et FEFO, stock, achats, ventes POS, caisse, clients, B2B, livraison, messagerie, Mobile Money, rapports |

- **API** : NestJS + TypeScript, 105 tables PostgreSQL, documentation OpenAPI générée.
- **Interface** : Next.js 15 + TypeScript, rendu serveur, espace bureau et application
  mobile installable (PWA).
- **Langues** : 15, dont le kiswahili de la RD Congo, le lingala, le kinyarwanda, le
  kirundi, le wolof et le bambara ; l'arabe bascule la page de droite à gauche.
- **Isolation** : PostgreSQL Row-Level Security, zéro table non protégée — vérifié par
  `nova.assert_rls_coverage()`, qui doit rendre zéro ligne.
- **Tests** : 213 tests de bout en bout, dont les 17 critères d'acceptation du cahier
  des charges.

### Fonctionner sans rien payer

Trois fonctions ont été conçues pour rendre service **avant** tout contrat payant, et
basculer sur une intégration facturée le jour où elle se justifie :

| Fonction | Mode gratuit, disponible d'emblée | Mode payant, plus tard |
|---|---|---|
| SMS et WhatsApp | La plateforme compose le message et rend un lien `wa.me` / `sms:` que le vendeur ouvre sur **son** téléphone | Passerelle HTTP appelée par la plateforme |
| Mobile Money | Le client compose le code de l'opérateur ; le vendeur saisit la référence de transaction, unique, qui empêche tout double encaissement | Intégration directe de l'opérateur |
| Application mobile | PWA installable depuis le navigateur, sans boutique | Application native |

### Marque et documents

- **Logo** : déposer `web/public/logo.png` (carré, 256 px minimum) le substitue au
  monogramme « NP » sur la connexion, les deux espaces et l'application mobile.
  Sans fichier, le monogramme reste affiché — l'interface n'a jamais d'image cassée.
- **Guides intégrés** : les trois documents de `docs/` sont convertis en HTML à la
  construction et consultables depuis le menu *Documents* des deux espaces, avec
  téléchargement en Word.

Dans les deux modes, la trace enregistrée est la même : passer de l'un à l'autre ne
fait perdre aucun historique.

---

## Démarrage

### Avec Docker

```bash
cp api/.env.example api/.env      # ajustez JWT_SECRET
docker compose up --build
```

- Interface : <http://localhost:3000>
- API et documentation : <http://localhost:3001/api/docs>

### En local

```bash
# 1. PostgreSQL 16 disponible, base créée
createdb nova_dev

# 2. API
cd api
npm install
cp .env.example .env               # ajustez DATABASE_URL
npm run migrate                    # applique les 22 migrations
npm run seed                       # crée les comptes internes
npm run start:dev                  # http://localhost:3001/api

# 3. Interface
cd ../web
npm install
cp .env.example .env.local
npm run dev                        # http://localhost:3000
```

### Comptes internes créés par l'amorçage

| Rôle | Adresse | Mot de passe |
|---|---|---|
| Super administrateur SaaS | `admin@novapharmaos.com` | `NovaPharma2026!` |
| Administrateur support | `support@novapharmaos.com` | `NovaPharma2026!` |
| Gestionnaire commercial | `commercial@novapharmaos.com` | `NovaPharma2026!` |

Définissez `SEED_SUPER_ADMIN_PASSWORD` avant l'amorçage pour choisir vos mots de
passe. **Changez-les avant toute mise en ligne.**

---

## Isolation multi-tenant : la garantie centrale

Le cahier des charges exige qu'« un utilisateur d'une pharmacie ne puisse jamais
consulter les données d'une autre pharmacie ». Cette garantie ne repose pas sur la
discipline du code applicatif, mais sur PostgreSQL lui-même.

**Comment cela fonctionne.** L'API se connecte avec le rôle `nova_app`, qui n'est ni
propriétaire des tables, ni superutilisateur, et ne dispose pas de `BYPASSRLS`. Elle
le vérifie au démarrage et **refuse de démarrer** si ce n'est pas le cas : un rôle
privilégié ignorerait les politiques sans produire la moindre erreur, et chaque
pharmacie verrait les données des autres pendant que tous les écrans continueraient
de paraître normaux. C'est la panne la plus dangereuse du produit parce qu'elle est
silencieuse — elle est donc rendue bruyante.

Au début de chaque transaction, l'API positionne le contexte :

```sql
SELECT set_config('nova.organization_id', $1, true),
       set_config('nova.platform',        $2, true),
       set_config('nova.readonly',        $3, true);
```

Les politiques RLS s'y réfèrent. Concrètement :

```sql
-- Dans le contexte de la pharmacie A, sans aucune clause WHERE :
SELECT * FROM products;          -- ne renvoie que les produits de A
SELECT * FROM products WHERE organization_id = '<id de B>';  -- 0 ligne
INSERT INTO products (organization_id, ...) VALUES ('<id de B>', ...);
-- ERROR: new row violates row-level security policy
```

Un oubli de filtre dans le code ne produit donc pas une fuite de données : il produit
un résultat vide. C'est vérifié par la suite `tenant-isolation.e2e-spec.ts`, qui
exécute délibérément des requêtes non filtrées.

**Le back-office n'échappe pas à la règle.** Le contexte plateforme n'ouvre aucune
politique sur les tables métier : le Super administrateur ne voit ni les ventes, ni
les stocks, ni les clients d'une pharmacie. Il voit son abonnement, ses factures et
des compteurs de quota — jamais le contenu.

**Trois dérogations, toutes étroites et documentées :**

| Fonction | Pourquoi | Ce qu'elle expose |
|---|---|---|
| `nova.authentication_lookup` | À la connexion, l'organisation n'est pas encore connue | Identité et empreinte du mot de passe, sur une adresse précise |
| `nova.organization_quota_usage` | Facturer les options exige de connaître la consommation | Des nombres uniquement ; refuse tout appel hors contexte back-office |
| `support_access_grants` | Un agent doit parfois intervenir | Voir ci-dessous |

Les deux fonctions appartiennent à un rôle dédié, `nova_derogation`, **sans droit de
connexion** : on ne l'exerce qu'à travers elles, et une politique ne lui ouvre que la
lecture des cinq tables qu'elles consultent. Elles ne dépendent donc pas d'un
administrateur superutilisateur — ce qui compte chez un hébergeur, où l'administrateur
n'est qu'un compte ordinaire soumis lui aussi au cloisonnement forcé. L'API refuse de
démarrer si son rôle de connexion peut endosser `nova_derogation`.

---

## Répertoire des fournisseurs

Chaque pharmacie tient la fiche de ses fournisseurs — dépôt, téléphone (normalisé avec
l'indicatif du pays du dépôt), e-mail, pays, ville, adresse — et le **catalogue de
chacun** : produits proposés, présentation, prix, devise, disponibilité, date du prix,
dates de fabrication et d'expiration du lot annoncé (migration 020).
Un article peut désigner un produit du catalogue de la pharmacie ou un simple nom.

| Point d'entrée | Rôle |
|---|---|
| `GET/POST /api/purchasing/suppliers`, `GET/PATCH …/:id` | Fiches fournisseurs |
| `POST …/:id/products`, `PATCH/DELETE …/:id/products/:lineId` | Catalogue et prix |
| `GET …/price-comparison?search=` | Offres de tous les dépôts actifs, la moins chère disponible signalée par devise |

Le module `suppliers` est inclus dans **tous les forfaits** (migration 019) ; les commandes
et réceptions restent au module `purchasing`. Une réception met à jour le prix du
fournisseur (prix et date d'expiration) pour les produits reçus. Une offre périmée n'est
jamais signalée comme la moins chère ; la recherche ignore la casse et les accents.

## Réquisitions

Une réquisition liste les produits à acheter et le fournisseur choisi pour chacun, avec
le prix de son catalogue au moment de la demande (migration 021). Elle relève du module
`suppliers`, donc de tous les forfaits.

| Point d'entrée | Rôle |
|---|---|
| `GET/POST /api/purchasing/requisitions`, `GET/PATCH …/:id` | Réquisitions, lignes, statut (brouillon → envoyée → reçue, ou annulée) |
| `GET …/:id/pdf[?supplierId=]` | PDF au logo de la pharmacie, un fournisseur par page (pdfkit) |
| `GET …/suppliers/price-comparison?productId=` | Offres de tous les fournisseurs pour un produit du catalogue |
| `GET/PUT/DELETE /api/admin/logo` | Logo PNG ou JPEG (500 Ko au plus, contenu vérifié) |

Le relais web `/api/proxy` transmet désormais les réponses binaires (PDF) avec leur type.

## Commandes fournisseurs et commandes professionnelles (écrans)

Les points d'entrée existaient ; l'espace pharmacie a désormais leurs écrans.

- **Achats** (`/pharmacie/achats`, `…/achats/[id]`) : commande créée depuis les
  suggestions de réapprovisionnement groupées par fournisseur (`?commande=<fournisseur>`)
  ou à la main, prix repris du catalogue du fournisseur (`price-comparison`) ou du prix
  d'achat habituel ; transmission (`POST …/orders/:id/submit`) ; réceptions partielles
  successives (`POST /api/purchasing/receipts` avec `purchaseOrderLineId`), lot et
  péremption exigés pour un produit périssable, clé d'idempotence renouvelée à chaque
  réception.
- **B2B** (`/pharmacie/b2b`, `…/commandes/[id]`, `…/devis/[id]`) : commande ou devis pour un
  client professionnel, prix de gros et remise par ligne ; statuts (confirmée, en
  préparation, prête, annulée) ; livraison et facture (`POST …/orders/:id/fulfil`), comptant
  avec moyen de règlement ou à crédit ; conversion d'un devis en commande.
- Une livraison B2B d'un médicament sur ordonnance n'exige plus d'ordonnance de patient
  (`channel = 'b2b'`) ; la vente au comptoir la réclame toujours.

## Caisse en deux devises (migration 023)

Le taux du jour (`exchange_rates`, « 1 base = rate quote », historisé, avec le pas
d'arrondi de la monnaie rendue dans la devise cotée) permet d'encaisser une vente en
dollars avec des francs, ou un mélange des deux.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/cash/rates`, `POST /api/cash/rates` | Taux du jour et historique ; fixer un taux (`cash.manage`) |
| `POST /api/sales` — `payments[].currency`, `payments[].exchangeRate`, `changeCurrency` | Montant remis dans une autre devise, taux affiché au client, devise de la monnaie |
| `POST /api/cash/sessions` — `openingFloats` ; `…/close` — `countedOther` | Fonds et comptage de chaque autre devise |

- `sale_payments.amount` reste la contre-valeur dans la devise de la vente (totaux,
  marges, factures inchangés) ; `tendered_currency`, `tendered_amount` et
  `exchange_rate` gardent ce que le client a remis. La monnaie rendue est gardée dans
  sa devise (`sales.change_currency`, `change_amount`), arrondie à la coupure.
- Le taux annoncé par le poste n'est accepté que s'il a été fixé par la pharmacie dans
  les 7 derniers jours (ventes préparées hors ligne) ; sinon le dernier taux s'applique.
- Un écart d'arrondi inférieur au demi-pas n'est pas un règlement incomplet : la vente
  est soldée. Le crédit client se compte dans la devise de la pharmacie.
- La caisse suit chaque autre devise dans `cash_session_currencies` (fonds, attendu,
  compté, écart) ; une annulation reverse les espèces de chaque devise telles
  qu'elles sont entrées.

## Tiers payant (migration 024)

Organismes payeurs (`payers` : assurance, mutuelle, entreprise, ONG ; taux, plafond par
vente, délai de règlement), bénéficiaires (`payer_members` : carte ou matricule, ayant
droit, taux propre, plafond annuel, validité), relevés (`payer_claims`) et leurs
règlements. Lecture : `customers.read` ; organismes et cartes : `customers.write` ;
relevés : `customers.credit`.

| Point d'entrée | Rôle |
|---|---|
| `GET/POST /api/payers`, `GET/PATCH …/:id`, `POST …/:id/members`, `PATCH …/members/:id` | Organismes et bénéficiaires |
| `GET /api/payers/members?q=` · `GET …/members/:id/coverage?amount=` | Recherche au comptoir · aperçu du partage |
| `POST /api/sales` — `coverage: { payerMemberId, authorizationNumber? }` | Vente prise en charge : la part du payeur est calculée par le serveur |
| `GET/POST /api/payers/claims`, `GET …/:id`, `…/:id/pdf`, `…/:id/send`, `…/:id/payments`, `…/:id/cancel` | Relevé d'une période, PDF, présentation, règlements, annulation |

- La part du payeur devient un règlement `insurance` de la vente : elle n'entre ni en
  caisse ni à l'encours du client. `sales` garde payeur, bénéficiaire, taux, parts et
  numéro de bon. La ligne du bénéficiaire est verrouillée pendant la vente : deux caisses
  ne consomment pas ensemble le même reste de plafond annuel (année civile).
- Carte désactivée ou expirée, organisme inactif, plafond épuisé : la vente est refusée
  avec la raison. Les paiements doivent couvrir la part du patient.
- Un relevé réunit les ventes de la période (fuseau de la pharmacie) pas encore
  présentées ; une vente annulée sort d'un relevé en brouillon, et l'annulation est
  refusée une fois le relevé présenté.

## Caisse hors connexion

La caisse continue de vendre pendant une coupure d'Internet et envoie les ventes au
retour du réseau.

- **Catalogue gardé par le poste** : `GET /api/sales/offline-catalog` (prix,
  codes-barres, lots vendables avec leur péremption, taux du jour), rechargé à
  l'ouverture de la caisse, toutes les 5 minutes et après chaque envoi. Hors connexion,
  le poste ne vend que les lots qui ne seront pas périmés le jour de la vente, et
  déduit lui-même ce qu'il a vendu sans que l'API le sache. Au-delà de 24 heures, le
  catalogue gardé est trop ancien : plus de vente sans réseau.
- **Ventes en attente** (`web/src/lib/hors-ligne.ts`, stockage du navigateur) :
  seulement au comptant (espèces en dollars ou en francs, Mobile Money, carte) — le
  crédit et le tiers payant attendent le réseau. Chaque vente garde son identifiant
  d'opération, le prix et le taux affichés au client, l'identifiant du poste et son
  heure réelle (`soldAt`, au plus 7 jours plus tôt).
- **Envoi** au retour du réseau (événement `online`, puis toutes les 20 secondes),
  dans l'ordre. L'API ne crée jamais de doublon (identifiant d'opération). Une vente
  refusée (stock vendu ailleurs entre-temps…) reste sur le poste « à régulariser » :
  réessayer après correction, ou abandonner. Une session expirée garde les ventes
  jusqu'à la reconnexion.
- La **clôture** de caisse est bloquée tant que le poste a des ventes non envoyées.
- Le service worker garde la dernière version de la page Caisse : un poste rechargé
  pendant la coupure peut continuer d'encaisser. Il ne sert toujours aucune donnée de
  l'API depuis son cache.

## Codes-barres : scan par la caméra et étiquettes

- **Scan** (`web/src/components/ScanCodeBarres.tsx`) : caméra arrière du téléphone ou
  webcam, lecteur intégré du navigateur (`BarcodeDetector`, Chrome Android) ou, à
  défaut, `@zxing/browser` chargé à la demande. À la caisse, sur le mobile du vendeur,
  à la création d'un produit et sur sa fiche. Une douchette USB tape le code puis
  Entrée : le produit part directement au ticket (aussi hors connexion).
- **Contrôle** : les codes GS1 (8, 12, 13, 14 chiffres) doivent avoir un chiffre de
  contrôle juste ; un code ne peut appartenir qu'à un produit. À l'import du catalogue,
  un code faux ou déjà pris est écarté et signalé sans bloquer l'import.
- **Codes internes** : EAN-13 du préfixe GS1 « 29 » (usage interne d'un magasin) pour
  les produits sans code-barres.
- **Étiquettes** (`/pharmacie/catalogue/etiquettes`) : planche A4 de 24 ou 40
  étiquettes, ou rouleau 50 × 30 / 40 × 25 mm, avec ou sans prix ; codes dessinés en SVG
  (EAN-13, EAN-8, UPC-A, Code 128) et vérifiés par décodage.

| Point d'entrée | Rôle |
|---|---|
| `POST /api/catalog/products/:id/barcodes`, `DELETE …/barcodes/:code` | Ajouter (saisi ou scanné) ou retirer un code |
| `POST /api/catalog/barcodes/internal` | Codes internes pour les produits sans code-barres |
| `GET /api/catalog/labels?ids=` | Nom, dosage, prix et code principal des étiquettes |

## Rapports et export Excel

Page *Rapports* (`reporting.read`) : période (aujourd'hui, hier, 7 jours, ce mois, mois
précédent, 90 jours ou dates libres, jours comptés dans le fuseau de la pharmacie),
synthèse (chiffre d'affaires, marge hors taxes, panier moyen, part des tiers payants,
annulations, pertes), chiffre d'affaires jour par jour, encaissements par moyen et par
devise remise, ventes par produit, catégorie, vendeur et client, valeur du stock,
produits qui ne se vendent pas (aucune vente en 90 jours), péremptions et pertes.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/reports/summary?from&to` | Synthèse de la période |
| `GET /api/reports/sales?groupBy=day\|month\|product\|category\|seller\|customer&from&to` | Ventes regroupées (dates AAAA-MM-JJ incluses) |
| `GET /api/reports/payments?from&to` | Encaissements par moyen et par devise remise |
| `GET /api/reports/expiry?from&to` | Retirés pour péremption, périmés en stock, à risque sous 90 jours |
| `GET /api/reports/workbook?from&to` | Classeur Excel de tous les rapports (`reporting.financial`) |

- **Marge hors taxes** partout : la TVA comprise dans les prix est déduite du chiffre
  d'affaires avant de calculer la marge et son taux.
- **Excel** : `.xlsx` écrit sans bibliothèque (`api/src/common/excel/classeur.ts`, zip +
  XML) — une feuille par rapport, en-tête figé et filtrable, montants, pourcentages et
  dates reconnus par Excel, LibreOffice et Google Sheets.
- **Régularisations de stock** : une casse, une destruction pour péremption ou une sortie
  retirent désormais toujours du stock, quel que soit le signe saisi ; sans lot précisé,
  elles prennent les lots qui périment le plus tôt, à leur coût (auparavant une quantité
  positive *ajoutait* du stock sur une ligne sans lot).

## Mot de passe et double authentification (migration 025)

Page *Mon compte* (lien en haut de chaque page, espace pharmacie et back-office).

- **Mot de passe** : l'actuel, puis le nouveau (8 caractères, lettres et chiffre,
  différent de l'actuel). Toutes les sessions sont fermées, puis une session neuve est
  ouverte pour l'appareil qui a changé le mot de passe (`POST /api/auth/password` renvoie
  les jetons ; le relais web `/api/compte/mot-de-passe` réécrit le cookie).
- **Double authentification** (TOTP, RFC 6238, `api/src/modules/auth/totp.ts`) : QR code
  à scanner avec une application gratuite (Google Authenticator, Microsoft Authenticator,
  2FAS), activation par un premier code juste, 8 codes de secours à usage unique (gardés
  sous forme d'empreinte). À la connexion, après le mot de passe, la réponse
  `401 { mfaRequired: true }` fait apparaître le champ du code ; un code ne sert qu'une
  fois ; un code faux compte comme un échec de connexion. Pas de SMS : aucun frais.
- Le back-office se verrouille désormais aussi 15 minutes après 5 échecs.

| Point d'entrée | Rôle |
|---|---|
| `POST /api/auth/login`, `…/platform/login` — `code` | Code de l'application ou code de secours |
| `GET /api/auth/2fa` · `POST …/2fa/setup` · `…/2fa/enable` · `…/2fa/disable` | État, QR code, activation, désactivation (mot de passe et code) |

## Ticket de caisse sur imprimante thermique

`/ticket/:id?largeur=58|80` (hors du cadre de l'application, pour n'imprimer que le
ticket) : en-tête de la pharmacie, articles regroupés par produit, total et taxes, part
du tiers payant et bénéficiaire, règlements dans leur devise avec le taux, monnaie
rendue. Le bouton **Imprimer le ticket** (caisse après chaque vente, page d'une vente)
ouvre le ticket et lance l'impression ; la largeur est retenue sur le poste. La page
d'impression est mesurée à la hauteur exacte du ticket : le rouleau n'avance que de ce
qui est imprimé. Données : `GET /api/sales/:id/receipt` (avec `coverage`).

## Traitements suivis des malades chroniques (migration 026)

Page *Traitements suivis* (`customers.read` ; ajout et arrêt : `customers.write` ;
rappel : `messaging.write`). Pour chaque patient et chaque médicament de fond
(`treatment_plans` : maladie, jours couverts par une unité vendue, jours d'avance du
rappel), NOVA calcule la date de fin de la boîte : dernière délivrance + quantité ×
jours par unité. **Chaque vente** du médicament au patient recalcule cette date (jour de
la vente au fuseau de la pharmacie, heure réelle pour une vente faite hors connexion)
et efface le rappel précédent.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/treatments?etat=a_prevenir\|en_retard\|en_cours\|arrete&customerId=` | Traitements avec leur état et les jours restants (`a_prevenir` inclut les boîtes finies) |
| `POST /api/treatments` · `PATCH …/:id` | Suivre un traitement · modifier, arrêter (`isActive: false`) ou reprendre |
| `POST /api/treatments/:id/remind` | Prépare le message de renouvellement (catégorie `refill_reminder`) |

- Le rappel passe par la messagerie : en mode manuel (par défaut, gratuit), il rend un
  lien `wa.me` que le vendeur ouvre sur le téléphone de la pharmacie ; un clic confirme
  l'envoi (`POST /api/messaging/messages/:id/sent`). Patient sans téléphone, traitement
  arrêté : rappel refusé avec la raison.
- Le message dit « arrive à sa fin vers le … » ou, boîte finie, « devait être renouvelé
  le … », avec le nom et le téléphone de la pharmacie.

## Fidélité : points et remises (migration 027)

Page *Fidélité* (`customers.read` ; réglages, catégories, ajustements : `customers.write`).
Rien n'est actif tant que la pharmacie n'a pas activé le programme.

- **Points** (`loyalty_programs`, un par pharmacie) : points gagnés par unité de devise
  payée, valeur d'un point, seuil d'utilisation, part maximale d'une vente payable en
  points, points de bienvenue à l'inscription d'un client. Les points se gagnent sur ce
  que le client paie lui-même (ni part du tiers payant, ni points, ni crédit ; pas sur
  une vente B2B). Journal `loyalty_entries` (gagnés, utilisés, annulation, ajustement,
  bienvenue) avec le solde après chaque mouvement ; le solde ne devient jamais négatif.
- **À la caisse**, le client peut être choisi pour toute vente : son solde s'affiche, et
  `loyaltyPoints` dans `POST /api/sales` paie une partie de la vente. La valeur des
  points devient un règlement `loyalty` : elle n'entre ni en caisse ni à l'encours. La
  fiche du client est verrouillée pendant la vente (deux caisses ne dépensent pas les
  mêmes points). Hors connexion, pas de points.
- **Annulation** d'une vente : les points gagnés repartent, les points utilisés
  reviennent (solde ramené à zéro au pire si les points gagnés sont déjà dépensés).
- **Remises par catégorie** (`customer_groups` : personnel, clients fidèles…) : la
  remise de la catégorie active du client s'applique d'office aux lignes sans remise
  saisie, côté serveur comme à l'écran de la caisse ; `sales.group_discount_percent`
  la garde.
- Le ticket indique les points utilisés, gagnés et le nouveau solde.

| Point d'entrée | Rôle |
|---|---|
| `GET/PUT /api/loyalty/program` | Réglages et points en circulation (valeur promise, mois en cours) |
| `GET /api/loyalty/customers/:id` · `…/:id/quote?amount=` | Solde et mouvements · points utilisables sur un montant |
| `POST /api/loyalty/customers/:id/adjust` | Offrir ou retirer des points, avec un motif |
| `GET /api/loyalty/dashboard` | Meilleurs clients et derniers mouvements |
| `GET/POST /api/loyalty/groups`, `PATCH …/:id` · `PUT /api/loyalty/customers/:id/group` | Catégories et remise · ranger un client |

## Dépenses, bénéfice réel et facture normalisée (migration 028)

Page *Dépenses et bénéfice* (liste : `cash.read` ; saisie et annulation : `cash.manage` ;
bénéfice et TVA : `reporting.financial` ; régime fiscal : `settings.write`).

- **Dépenses** (`expenses`, numéros `DEP-AAAA-00001`) : 16 catégories (loyer, salaires,
  SNEL, REGIDESO, carburant du groupe, frais Mobile Money…), montant en dollars ou en
  francs (contre-valeur au taux saisi ou au dernier taux du jour), moyen de paiement.
  Payée en espèces « depuis la caisse ouverte », elle sort de la caisse dans sa devise
  (mouvement `expense`) ; annulée tant que la caisse est ouverte, l'argent y rentre.
- **Bénéfice réel du mois** (`GET /api/reports/profit?month=AAAA-MM`) : marge HT des
  ventes − points de fidélité utilisés − pertes de stock au coût (péremptions, casse,
  régularisations, écarts d'inventaire) − dépenses ; comparaison avec le mois précédent et
  six derniers mois. Les achats de médicaments ne sont pas des dépenses : ils comptent
  à la vente, par leur coût d'achat.
- **Facture normalisée** (décret n° 23/10 du 3 mars 2023 ; obligatoire pour les
  assujettis à la TVA depuis le 1er décembre 2025, sanctions depuis le 15 mai 2026) :
  elle doit être émise par un système de facturation homologué par la DGI relié à un
  dispositif électronique fiscal (MCF ou e-MCF). NOVA n'est pas homologué : la pharmacie
  émet la facture avec son dispositif et en note la référence sur la vente
  (`PUT /api/sales/:id/normalized-reference`), reportée sur la facture PDF et le ticket.
  Pour une pharmacie déclarée assujettie (`PUT /api/finance/settings`), une dépense ne
  compte hors TVA que si elle est justifiée par une facture normalisée ; le rapport donne
  la TVA collectée, la TVA récupérable sur dépenses (indicatif : la TVA des achats de
  médicaments n'est pas encore suivie), les dépenses avec TVA sans facture normalisée et
  les ventes sans référence.

| Point d'entrée | Rôle |
|---|---|
| `GET/POST /api/expenses` · `POST …/:id/cancel` · `GET …/categories` | Dépenses d'une période, saisie, annulation motivée |
| `GET /api/reports/profit?month=` | Compte du mois et bénéfice réel |
| `GET/PUT /api/finance/settings` | Assujettissement à la TVA, numéro du dispositif fiscal |
| `PUT /api/sales/:id/normalized-reference` | Référence de la facture normalisée d'une vente |

## Rappels de lots et produits falsifiés (migration 029)

- **Alertes du back-office** (`product_alerts`, table de référence lisible par toutes les
  pharmacies, écrite par le seul back-office) : un super-administrateur ou le support
  publie un rappel de l'ACOREP, une alerte de l'OMS sur un produit falsifié… avec les
  numéros de lot et des mots à retrouver dans le produit (nom, molécule, dosage). Chaque
  pharmacie la reprend dans son suivi (`lot_recalls`) à l'ouverture de ses rappels.
- **Rappels de la pharmacie** : une lettre du grossiste ou du fabricant s'enregistre de
  la même façon, sur un produit du catalogue ou un nom.
- **Recherche des lots** : majuscules, espaces, tirets et accents ignorés
  (`nova.lot_normalise`, `nova.sans_accent`) ; pour une alerte sans produit précis, tous
  les mots doivent figurer dans le produit — un numéro de lot seul est trop ambigu.
- **Quarantaine** : le lot sort du FEFO, de la caisse et du catalogue hors connexion.
  **Clients** qui ont acheté le lot (ventes non annulées), avec message WhatsApp prêt
  (`lot_recall`) ; quantités vendues sans client identifié. **Clôture** : stock détruit
  (`damage`) ou retourné (`purchase_return`) au coût, ou fausse alerte (quarantaine levée
  sauf si un autre rappel ouvert vise le lot).
- **Réception bloquée** d'un lot visé par un rappel ouvert. Bandeau sur le tableau de bord.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/recalls` · `GET …/summary` · `GET …/:id` | Rappels et stock concerné · résumé · lots et clients (`inventory.read`) |
| `POST /api/recalls` · `…/:id/quarantine` · `…/:id/withdraw` · `…/:id/release` | Enregistrer, bloquer, détruire ou retourner, fausse alerte (`inventory.adjust`) |
| `POST /api/recalls/:id/notify` | Message WhatsApp pour un client (`messaging.write`) |
| `GET/POST /api/platform/product-alerts` · `PATCH …/:id` | Back-office : publier, retirer (super-administrateur, support) |

## Page publique, réservations et photo d'ordonnance (migration 030)

- **Page publique** `/p/<identifiant>` (sans compte, hors du cadre de l'application) :
  nom, logo, accroche, horaires, adresse et repère, annonce (« de garde »), boutons
  WhatsApp, Appeler et Itinéraire (OpenStreetMap, gratuit). Invisible (404) tant que la
  pharmacie ne l'a pas publiée, et pour une pharmacie suspendue. Réglages et QR code à
  coller sur la vitrine : page *Réservations* (`settings.write`).
- **Recherche publique** : disponible ou sur commande — jamais les quantités ; prix
  affichés au choix de la pharmacie ; lots en quarantaine ou périmés exclus.
- **Réservation sans compte** : médicaments et/ou photo d'ordonnance (réduite dans le
  navigateur à 1 600 px en JPEG, 2,5 Mo au plus, signature JPEG/PNG vérifiée), nom,
  téléphone (normalisé, rattaché à la fiche client s'il existe), heure de passage.
  Protections : champ piège, 5 demandes par téléphone et par jour, 40 par pharmacie et
  par heure. Le client suit sa demande avec son numéro (`RES-AAAA-00001`) et son
  téléphone. Rien n'est payé en ligne.
- **Traitement** (`sales.read`, `sales.create`) : nouvelle → confirmée → prête → retirée
  (ou annulée) ; message WhatsApp gratuit « reçue » ou « prête ». Les photos sont
  gardées dans la base (aucun stockage payant) et effacées 30 jours après la clôture.
- La limite des requêtes JSON passe de 100 Ko (valeur d'Express) à 3 Mo
  (`common/http/corps-requete.ts`) : un logo de plus de 100 Ko était refusé par une
  erreur 500 ; un envoi trop lourd reçoit désormais un 413 explicite.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/public/pharmacies/:slug` · `…/products?q=` | Fiche publique · médicaments disponibles (sans jeton) |
| `POST /api/public/pharmacies/:slug/reservations` · `GET …/reservations/:numero?phone=` | Réserver · suivre sa demande (sans jeton) |
| `GET/PUT /api/public-profile` | Réglages de la page publique |
| `GET /api/reservations` · `…/summary` · `…/:id/prescription` | Demandes · compteurs · photo d'ordonnance |
| `POST /api/reservations/:id/status` · `…/:id/notify` | Changer le statut · message WhatsApp |

## Prévisions saisonnières et quantités à commander

Page *Prévisions* (`reporting.read`), calculée sur l'historique de la pharmacie seule —
aucune donnée ne sort, aucun service payant.

- **Rythme récent** : ventes des 30 derniers jours et des 60 d'avant, à poids égal.
- **Saison** : indice d'un mois = ventes du même mois l'an dernier ÷ moyenne mensuelle des
  12 derniers mois, pour le produit et pour sa catégorie (un produit peu vendu suit
  surtout sa catégorie). Le rythme récent est « désaisonnalisé » (indice des jours
  couverts par les 90 derniers jours), puis multiplié par l'indice du mois visé (milieu
  de l'horizon). Sans un an d'historique, la saison est inconnue (indice 1) et la
  fiabilité est indiquée : bonne (≥ 13 mois), moyenne (6 à 12), faible.
- **À commander** = prévision journalière × jours de couverture (délai de livraison
  compris) × (1 + stock de sécurité) − stock vendable − quantités déjà commandées ; le
  seuil de réapprovisionnement de la fiche produit reste un plancher. Tri par jours de
  stock restants. Un clic prépare une réquisition avec ces quantités.
- Profil saisonnier de chaque catégorie sur les 12 prochains mois ; export Excel.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/reports/forecast?horizon=30&coverDays=45&safetyPercent=20` | Prévisions, suggestions, saisons par catégorie |
| `GET /api/reports/forecast/workbook` | Même chose en classeur Excel |

## Sauvegarde et restauration d'une pharmacie

Back-office : `POST /api/platform/organizations/:id/backups`, `POST /api/platform/backups/restore`
(confirmation par l'identifiant de la pharmacie, empreinte SHA-256 vérifiée, opération
atomique). Le plan de sauvegarde (format 2) est lu dans la base à chaque fois : toutes les
tables dotées de la politique « pharmacie », dans l'ordre de leurs clés étrangères. Une
table ajoutée par une migration future est donc sauvegardée sans rien modifier.

- Correctif : l'ancienne liste figée ignorait une trentaine de tables récentes ; en
  restaurant, elle vidait les tables listées et, par les clés `ON DELETE CASCADE`, des
  tables jamais sauvegardées (traitements suivis, journal de fidélité, devises de la
  caisse…). Elle échouait aussi sur le cycle devis → commande professionnelle → facture
  (clés non différables).
- Les cycles et autoréférences (catégorie parente, avoir sur facture) sont rompus par une
  clé facultative insérée vide puis renseignée ; binaires (photos d'ordonnance) en
  hexadécimal, colonnes JSON et tableaux restitués à l'identique. Vérifié par
  `sauvegarde-complete.e2e-spec.ts`.

## Changer de base de données

Une base gratuite d'hébergeur expire (Render : 30 jours, une seule base gratuite par
compte). `COPIER_DEPUIS_URL` = l'ancienne base, `DATABASE_ADMIN_URL` = la nouvelle : au
démarrage, après les migrations, l'API recopie tout (`api/src/database/copier-base.ts`).
La source est lue dans une transaction annulée ; la cible est remplie dans une seule
transaction (tout ou rien), clés étrangères retirées puis recréées (donc revérifiées),
cloisonnement rétabli, nombre de lignes contrôlé table par table. Une cible qui a déjà des
pharmacies n'est pas écrasée (sauf `COPIER_FORCER=oui`). Le rôle applicatif est créé avec
`NOVA_APP_PASSWORD` avant les migrations, pour les hébergeurs qui refusent les mots de passe
courts (Neon). Procédure pas à pas : [docs/CHANGER_DE_BASE.md](docs/CHANGER_DE_BASE.md).

## Session et droits dans l'interface

- **Renouvellement de session** (`web/src/middleware.ts`) : le jeton d'accès de l'API vit
  15 minutes (`JWT_ACCESS_TTL`), la session web 8 heures. Avant chaque page ou appel du
  relais, un jeton qui expire dans moins d'une minute est échangé contre un neuf
  (`POST /api/auth/refresh`) et le cookie réécrit. L'API tolère 30 secondes un jeton de
  rafraîchissement tout juste remplacé, pour les requêtes parallèles d'une même page ; un
  jeton révoqué par une déconnexion reste refusé. Une session morte renvoie à la connexion.
- **Menu selon le rôle** : `GET /api/auth/me` donne permissions et modules ; le menu n'affiche
  que les entrées utilisables, et une page ouverte sans le droit affiche « Accès réservé ».
- **Devise** : la connexion renvoie la devise de la pharmacie, gardée dans la session ; tous
  les montants de l'espace pharmacie et du mobile s'affichent dans celle-ci (USD, CDF…).
- `NOVA_TRACE_API=1` côté web trace chaque refus de l'API dans le journal du serveur ; les
  pannes (API injoignable, 5xx) y sont toujours tracées.

## Factures clients

Une vente peut recevoir **une** facture, émise à la demande du client (ou d'office pour
une vente à crédit ou B2B). Le client est choisi dans le fichier, ou nommé sur le moment :
il est alors retrouvé par son téléphone (normalisé au format international) ou créé. Le
montant payé exclut la part à crédit, qui reste due jusqu'à l'échéance du client. Aucune
migration : les tables `invoices` et `invoice_lines` existaient déjà.

| Point d'entrée | Rôle |
|---|---|
| `GET /api/invoices[?customerId=&search=]` | Factures, filtrées par client ou par numéro, nom, téléphone |
| `POST /api/invoices` `{ saleId, customerId? \| customer? }` | Établit la facture d'une vente (renvoie l'existante si elle est déjà faite) |
| `GET /api/invoices/:id`, `GET …/:id/pdf` | Détail (lignes avec lot et péremption, règlements) ; PDF au logo de la pharmacie |

Lecture : `sales.read` ; émission : `sales.create` (vendeur et caissier compris). La mise en
page PDF (en-tête de l'officine, formats, pied de page) est partagée avec les réquisitions
(`api/src/common/pdf/mise-en-page.ts`).

## Catalogue de référence Goma–Bukavu

`GET /api/catalog/reference` renvoie 100 médicaments et produits courants au Kivu (DCI,
forme, conditionnement, unité de vente, famille, repères ordonnance, stupéfiant, froid),
avec des prix indicatifs en USD ; `POST /api/catalog/reference/import { items: [{ code,
salePrice?, costPrice? }] }` en reprend tout ou partie. Hors USD, le prix de vente de la
pharmacie est exigé. Un produit déjà présent (même référence ou même nom) est ignoré. La
liste vit dans `api/src/modules/tenant/catalog/reference-kivu.ts`.

## Couleurs d'alerte

L'API renvoie la couleur, l'écran l'affiche — une seule règle pour le bureau, le mobile
et les tests.

| Champ | Règle | Code |
|---|---|---|
| `stock_level` | Rupture · < 7 j de ventes ou ½ seuil · < 14 j ou seuil · au-delà | `inventory/niveau-stock.ts` |
| `expiry_level` | Date passée · ≤ délai d'alerte du produit (90 j) · ≤ 2 × ce délai · au-delà | `common/niveau-peremption.ts` |

`expiry_level` est présent sur les positions de stock, les lots du tableau de bord, le
catalogue des fournisseurs et la comparaison des prix.

---

## Création des comptes

Tout compte se crée avec un **téléphone**, une **adresse e-mail** et un **mot de
passe** (8 caractères minimum). Le téléphone est enregistré au format international
(E.164), avec l'indicatif du pays de la pharmacie : `0991 234 567` saisi à Bukavu
devient `+243991234567`.

| Compte | Créé par | Point d'entrée |
|---|---|---|
| Pharmacie + son administrateur | La personne elle-même | `POST /api/auth/register` — page `/inscription` |
| Membre de l'équipe | Administrateur de la pharmacie (`users.write`) | `POST /api/admin/users` — page *Équipe* |
| Compte interne (super_admin, support_admin, commercial) | Super-administrateur uniquement | `POST /api/platform/users` — back-office *Équipe* |

L'inscription publique ne peut créer **que** une pharmacie et son administrateur : un
champ `role` est rejeté, et le compte obtenu n'ouvre pas le back-office. Elle se
ferme avec `INSCRIPTION_PUBLIQUE=off`, se limite globalement avec
`INSCRIPTION_LIMITE_PAR_HEURE` (20 par défaut) et attribue le forfait
`INSCRIPTION_FORFAIT` (`professional` par défaut) en période d'essai.

Le premier super-administrateur n'a pas de formulaire : `run-seed.ts` le crée à
l'installation (`admin@novapharmaos.com`, mot de passe `SEED_SUPER_ADMIN_PASSWORD`, à
défaut `NovaPharma2026!`). Il sert à créer son propre compte depuis *Équipe*, puis
est désactivé depuis cette même page.

---

## Accès du support aux données d'une pharmacie

Aucun agent NOVA PHARMA OS ne consulte les données d'une cliente sans autorisation.
Le parcours complet :

1. **Demande motivée** — l'agent indique un motif explicite, une portée
   (lecture seule par défaut) et une durée (72 heures maximum).
2. **Notification** — la pharmacie reçoit la demande dans son espace, avec le nom et
   l'adresse de l'agent.
3. **Validation** — la pharmacie autorise ou refuse. Un accès en **écriture** exige
   toujours son accord explicite.
4. **Session bornée** — l'agent reçoit un jeton limité à cette pharmacie et à cette
   durée. Il quitte le contexte plateforme et travaille sous RLS, comme un
   utilisateur de la pharmacie.
5. **Journalisation intégrale** — chaque requête est tracée, **consultations et
   tentatives refusées comprises**. La pharmacie lit ce journal à tout moment.
6. **Révocation** — par la pharmacie à tout instant, et automatiquement à échéance.

Un agent en session support ne peut ni administrer les comptes, ni modifier les
paramètres, ni voir une autre pharmacie.

---

## Ce qui protège les données

| Risque | Réponse |
|---|---|
| Fuite entre pharmacies | RLS forcée sur 82 tables, rôle applicatif sans `BYPASSRLS` |
| Accès silencieux de l'éditeur | Accès support motivé, validé, borné, journalisé, révocable |
| Vol de jeton | Rotation des jetons de rafraîchissement, chaînage et révocation en cascade |
| Vol de session par XSS | Jeton en cookie `httpOnly` ; le navigateur ne le voit jamais |
| Force brute | Verrouillage du compte après 5 échecs |
| Double encaissement | Clés d'idempotence sur ventes, paiements, réceptions et factures |
| Perte de données à la suspension | Suspension = lecture seule ; aucune suppression |
| Perte de données à la résiliation | Sauvegarde préalable, conservation contractuelle, puis archivage |
| Sinistre sur une pharmacie | Restauration ciblée par organisation, sans toucher aux autres |

---

## Règles métier notables

**FEFO — First Expired, First Out.** Toute sortie de stock consomme d'abord le lot
dont la péremption est la plus proche. Une vente de 80 boîtes réparties sur deux lots
produit deux lignes distinctes, chacune rattachée à son lot. Les lots périmés ou mis
en quarantaine sont écartés automatiquement.

**Réception sans date = refus.** Un produit à péremption ne peut pas entrer en stock
sans date de péremption : c'est la condition pour que la règle FEFO ait un sens.

**Ordonnance obligatoire.** Un médicament marqué « sur ordonnance » ne peut être vendu
sans prescription renseignée.

**Encours client.** Une vente à crédit qui dépasserait le plafond du client est
refusée, avec le détail du dépassement.

**Inventaire tracé.** Un écart d'inventaire devient un mouvement de stock motivé, pas
une correction silencieuse des quantités.

**Caisse.** L'écart entre l'attendu et le compté est conservé à la clôture — c'est la
matière première du contrôle interne.

---

## Cycle de vie commercial

```
Prospect → Essai gratuit → Facturation → Actif
                              │
                              ├── impayé → relances (J+1, J+7, J+14)
                              │              │
                              │              └── délai de grâce dépassé
                              │                     → Suspension (lecture seule)
                              │                            │
                              │                            └── paiement
                              │                                  → Réactivation
                              └── résiliation
                                     → Conservation contractuelle → Archivage
```

Tous ces traitements sont **idempotents** : les rejouer ne produit ni double facture,
ni double relance, ni double suspension. Ils s'exécutent chaque nuit et sont
relançables à la main depuis le back-office après un incident.

---

## Structure du dépôt

```
nova-pharma-os/
├── db/migrations/        22 migrations SQL, appliquées dans l'ordre et une seule fois
├── api/                  NestJS — API métier et back-office SaaS
│   ├── src/common/       socle : base, contexte tenant, auth, quotas, audit, numérotation
│   ├── src/modules/
│   │   ├── auth/         authentification, rotation des jetons
│   │   ├── platform/     back-office SaaS
│   │   ├── tenant/       espace pharmacie
│   │   └── jobs/         traitements périodiques
│   └── test/             213 tests de bout en bout
├── web/                  Next.js — interface des deux espaces + application mobile
│   ├── src/app/mobile/   écrans vendeur et livreur, pensés pour le pouce
│   ├── src/lib/i18n/     15 dictionnaires, typés d'après le français
│   └── public/           manifeste PWA, service worker, icônes
├── demarrer.mjs          lancement complet en une commande, base embarquée comprise
├── scripts/              conversion des guides en Word, sans dépendance à installer
└── docs/                 conformité, architecture, guides commercial et d'usage
    └── word/             les mêmes guides en .docx, régénérables
```

---

## Tests

```bash
cd api && npm run test:e2e
```

Quatre suites, exécutées sur une base recréée à chaque lancement :

| Suite | Ce qu'elle démontre |
|---|---|
| `acceptance-saas.e2e-spec.ts` | Les 17 critères d'acceptation du cahier des charges |
| `caisse-devises.e2e-spec.ts` | Taux du jour, paiement en francs ou mêlé, monnaie rendue arrondie, caisse et annulation par devise |
| `tiers-payant.e2e-spec.ts` | Organismes, bénéficiaires, partage sous plafonds, relevé PDF, annulation, règlement |
| `hors-connexion.e2e-spec.ts` | Catalogue du poste (lots vendables), vente envoyée à son heure réelle, rejeu sans doublon, limites |
| `codes-barres.e2e-spec.ts` | Chiffre de contrôle, code unique, ajout d'un code scanné, codes internes, étiquettes, vente au scan |
| `rapports.e2e-spec.ts` | Synthèse, marge hors taxes, regroupements, encaissements par devise, pertes par péremption, classeur Excel lu |
| `sauvegarde-complete.e2e-spec.ts` | Sauvegarde de toutes les tables, restauration exacte malgré cycles de clés, autoréférences, photo binaire et JSON |
| `previsions.e2e-spec.ts` | Produit saisonnier prévu plus haut qu'un produit régulier au même rythme, quantité à commander, fiabilité, export Excel |
| `reservations.e2e-spec.ts` | Page invisible avant publication, disponibilité sans quantités, réservation et photo sans compte, abus refusés, statut et WhatsApp, suivi client |
| `rappels.e2e-spec.ts` | Alerte du back-office reprise par la pharmacie, lot trouvé malgré accents et tirets, quarantaine hors vente, réception bloquée, clients prévenus, destruction, fausse alerte |
| `depenses.e2e-spec.ts` | Dépense en francs au taux du jour sortie de caisse, annulation, bénéfice réel (pertes, TVA à 16 %), TVA déductible sur facture normalisée seulement |
| `fidelite.e2e-spec.ts` | Programme désactivé par défaut, bienvenue, points gagnés et utilisés sous limites, annulation, ajustement, remise de catégorie |
| `traitements.e2e-spec.ts` | Date de fin d'une boîte, patients à prévenir, lien WhatsApp, date recalculée par la vente, arrêt |
| `double-authentification.e2e-spec.ts` | Changement de mot de passe, activation, code à usage unique, codes de secours, désactivation, verrouillage du back-office |
| `pharmacy-operations.e2e-spec.ts` | FEFO, stock, caisse, crédit, B2B, inventaire, mise en route |
| `tenant-isolation.e2e-spec.ts` | L'isolation tient au niveau base, sans le code applicatif |
| `messaging-payments.e2e-spec.ts` | Un message ne part pas deux fois, un versement Mobile Money ne s'encaisse pas deux fois |

---

## Ce qui reste à faire

Conformément à la priorité commerciale du cahier des charges, ces éléments viennent
**après validation du produit auprès de plusieurs pharmacies réellement actives** :

- **Applications natives Flutter** (magasinier, client) — l'application mobile
  installable couvre aujourd'hui le vendeur et le livreur : vente au comptoir,
  tournée, preuve de remise. La caisse de l'espace pharmacie vend déjà pendant les
  coupures ; l'application mobile du vendeur pas encore.
- **Passerelle d'envoi automatique** — SMS et WhatsApp partent aujourd'hui du
  téléphone du vendeur, gratuitement. Le mode « gateway » est prévu dans le modèle
  et dans les réglages ; il reste à écrire l'appel HTTP et à souscrire un compte.
- **Intégration directe des opérateurs Mobile Money** — la demande, la confirmation
  et le rapprochement existent, avec unicité de la référence de transaction. Il
  reste à recevoir la confirmation de l'opérateur au lieu de la saisir.
- **OCR des factures fournisseur**, **IA et prévisions**, **marketplace B2B**,
  **IoT température**, **module importation**.
- **Relecture des traductions** — les 15 langues sont écrites et utilisables ; dix
  d'entre elles n'ont pas encore été relues par un locuteur natif, ce que
  l'application signale elle-même sur la page de connexion.
- **Meilisearch**, **Metabase**, **Kubernetes** — pertinents à la montée en charge,
  inutiles au démarrage.

Voir [`docs/CONFORMITE.md`](docs/CONFORMITE.md) pour le détail point par point.
