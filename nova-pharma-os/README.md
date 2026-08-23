# NOVA PHARMA OS — SaaS de gestion de pharmacie

Implémentation du **MVP (§86)** du cahier des charges *NOVA PHARMA OS —
SaaS de gestion d'une pharmacie, des achats, stocks, ventes, commandes,
livraisons et clients B2B/semi-grossistes*.

> Projet pilote : **NOVA SANTÉ PHARMA** — Bukavu, Sud-Kivu, RDC.

## Démarrage

Aucune dépendance externe : **Node.js ≥ 18** suffit.

```bash
node server.mjs            # http://localhost:8080
PORT=3000 node server.mjs  # port personnalisé
```

Au premier démarrage, une base de démonstration est créée dans `data/`
(déplaçable via `NOVA_DATA=/chemin`) : l'organisation NOVA SANTÉ PHARMA,
8 produits, 3 fournisseurs, 3 clients (dont 2 B2B) et 8 comptes de rôles
différents.

| Compte | Mot de passe | Rôle |
|---|---|---|
| `proprietaire` | `demo1234` | Propriétaire / Administrateur pharmacie |
| `pharmacien` | `demo1234` | Pharmacien responsable |
| `gestionnaire` | `demo1234` | Gestionnaire (achats, stock, prix) |
| `magasinier` | `demo1234` | Magasinier (réception, préparation, livraison) |
| `vendeur` | `demo1234` | Vendeur / Caissier |
| `comptable` | `demo1234` | Comptable |
| `livreur` | `demo1234` | Livreur |
| `admin` | `admin123` | Super administrateur SaaS (multi-organisation) |

⚠️ Comptes de démonstration uniquement — à supprimer avant toute mise en
production.

## Test de recette

```bash
node test/smoke.mjs
```

53 vérifications automatisées couvrant les critères d'acceptation de
l'Article 94 : catalogue, fournisseurs et achats, réception et traçabilité
des lots (FEFO), caisse et vente comptoir avec calcul de marge, règles
métier critiques (§92 : pas de vente sous le prix minimum, pas
d'ajustement sans motif, plafond de crédit), commandes B2B, préparation et
décrément FEFO, livraison avec preuve, suivi client sans authentification,
paiements et créances, inventaire, alertes de rupture/péremption, tableau
de bord et KPI, journal d'audit, étanchéité multi-organisation.

## Correspondance avec le cahier des charges

| Article | Exigence | Implémentation |
|---|---|---|
| §5 | SaaS multi-tenant | Chaque enregistrement porte un `organizationId` ; filtrage systématique côté serveur |
| §4 | Rôles et permissions | 8 rôles MVP (propriétaire, pharmacien, gestionnaire, magasinier, vendeur, comptable, livreur, admin plateforme), un compte individuel par utilisateur |
| §10, §11, §12 | Catalogue, lots, FEFO | Fiche produit complète ; lots traçables (« où est le lot X ? ») ; allocation automatique du lot le plus proche de l'expiration à chaque vente |
| §13 à §17 | Stock, mouvements, inventaire, alertes | Stock disponible = actif non expiré ; tout mouvement journalisé ; comptage d'inventaire avec écart et validation ; alertes rupture/péremption/surstock |
| §19 | Achats | Commande fournisseur (brouillon → envoyée → reçue), réception créant les lots |
| §21, §22, §35 | Ventes, tarification, caisse | POS avec panier, tarification par catégorie client, session de caisse avec rapprochement théorique/réel |
| §25 à §28, §33 | Commandes clients, B2B, crédit | Cycle de statuts complet ; plafond de crédit bloquant sans validation d'un responsable |
| §29 à §31 | Livraison | Création, statuts, preuve de livraison (réceptionnaire, heure) |
| §34 | Facturation | Reçus PDF générés nativement (sans dépendance) |
| §37 à §39 | Tableau de bord, KPI | CA, marge, valeur du stock, créances, ruptures, péremptions, achats recommandés |
| §64 | Journal d'audit | Append-only, aucune API de modification/suppression |
| §92 | Règles métier critiques | Pas de vente de produit expiré (FEFO exclut les lots expirés) ; pas de stock négatif non maîtrisé ; aucun ajustement sans motif ; aucune remise sous le prix minimum sans habilitation ; aucun dépassement de crédit sans validation ; traçabilité des lots ; audit des modifications critiques ; compte individuel par utilisateur |

## Architecture (§80 à §84)

```
nova-pharma-os/
├── server.mjs               # Point d'entrée HTTP + routage + fichiers statiques
├── server/
│   ├── db.mjs                # Persistance JSON (écriture synchrone, tmp+renommage atomique)
│   ├── auth.mjs               # Authentification, rôles, permissions, audit
│   ├── stock-engine.mjs       # FEFO, mouvements, alertes, valeur du stock
│   ├── pdf.mjs                 # Générateur PDF minimal (factures, reçus)
│   ├── seed.mjs                # Données de démonstration
│   └── routes/                 # Une route par domaine métier
│       ├── catalog.mjs, stock.mjs, purchasing.mjs, sales.mjs,
│       │   customers.mjs, delivery.mjs, finance.mjs, dashboard.mjs, users.mjs
├── public/                    # SPA vanilla JS (aucun outillage de build)
│   ├── index.html, styles.css, app.js
├── test/smoke.mjs             # Recette automatisée (§94)
└── data/                      # Persistance JSON (créée au premier lancement, non versionnée)
```

Le stockage JSON sur fichier est un choix de MVP assumé : la couche de
persistance est isolée (`db.mjs`) pour permettre une migration vers
PostgreSQL (§82) sans réécrire les routes. Les écritures sont **synchrones
et immédiates** (pas de différé) : pour un pilote de cette taille, la
durabilité prime sur la micro-optimisation.

## Hors périmètre de ce MVP

Conformément au phasage du cahier des charges (§86, §95), les éléments
suivants relèvent des phases 2 et 3 et ne sont **pas** couverts ici :
mode hors ligne et synchronisation mobile (§47), portail fournisseur et
RFQ (§20), WhatsApp/SMS intégrés (§42-43), OCR documentaire (§61),
intelligence artificielle et prévisions (§40), multi-pharmacie et
transferts entre sites (§48-49), applications mobiles natives (§76).
Le suivi de commande client (§25) est disponible via une API de consultation
publique (numéro de commande + téléphone), sans portail self-service complet.
