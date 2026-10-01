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

- **API** : NestJS + TypeScript, 87 tables PostgreSQL, documentation OpenAPI générée.
- **Interface** : Next.js 15 + TypeScript, rendu serveur, espace bureau et application
  mobile installable (PWA).
- **Langues** : 15, dont le kiswahili de la RD Congo, le lingala, le kinyarwanda, le
  kirundi, le wolof et le bambara ; l'arabe bascule la page de droite à gauche.
- **Isolation** : PostgreSQL Row-Level Security, zéro table non protégée — vérifié par
  `nova.assert_rls_coverage()`, qui doit rendre zéro ligne.
- **Tests** : 168 tests de bout en bout, dont les 17 critères d'acceptation du cahier
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
│   └── test/             168 tests de bout en bout
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
