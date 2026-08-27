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
| **Espace pharmacie** | Chaque pharmacie abonnée | Catalogue, lots et FEFO, stock, achats, ventes POS, caisse, clients, B2B, livraison, rapports |

- **API** : NestJS + TypeScript, 82 tables PostgreSQL, documentation OpenAPI générée.
- **Interface** : Next.js 15 + TypeScript, rendu serveur, 22 routes.
- **Isolation** : PostgreSQL Row-Level Security, 293 politiques, zéro table non protégée.
- **Tests** : 59 tests de bout en bout, dont les 17 critères d'acceptation du cahier
  des charges.

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
npm run migrate                    # applique les 15 migrations
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
propriétaire des tables, ni superutilisateur, et ne dispose pas de `BYPASSRLS`. Au
début de chaque transaction, elle positionne le contexte :

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
├── db/migrations/        15 migrations SQL, appliquées dans l'ordre et une seule fois
├── api/                  NestJS — API métier et back-office SaaS
│   ├── src/common/       socle : base, contexte tenant, auth, quotas, audit, numérotation
│   ├── src/modules/
│   │   ├── auth/         authentification, rotation des jetons
│   │   ├── platform/     back-office SaaS
│   │   ├── tenant/       espace pharmacie
│   │   └── jobs/         traitements périodiques
│   └── test/             59 tests de bout en bout
├── web/                  Next.js — interface des deux espaces
└── docs/                 conformité au cahier des charges, architecture
```

---

## Tests

```bash
cd api && npm run test:e2e
```

Trois suites, exécutées sur une base recréée à chaque lancement :

| Suite | Ce qu'elle démontre |
|---|---|
| `acceptance-saas.e2e-spec.ts` | Les 17 critères d'acceptation du cahier des charges |
| `pharmacy-operations.e2e-spec.ts` | FEFO, stock, caisse, crédit, B2B, inventaire, mise en route |
| `tenant-isolation.e2e-spec.ts` | L'isolation tient au niveau base, sans le code applicatif |

---

## Ce qui reste à faire

Conformément à la priorité commerciale du cahier des charges, ces éléments viennent
**après validation du produit auprès de plusieurs pharmacies réellement actives** :

- **Applications mobiles Flutter** (vendeur, magasinier, livreur, client) — l'API et
  le schéma les portent déjà : synchronisation hors ligne idempotente, tournée du
  livreur, preuve de livraison.
- **Envoi réel des notifications** — WhatsApp Business, SMS, e-mail, Firebase. Les
  notifications sont produites et stockées ; il reste à brancher les passerelles.
- **Encaissement Mobile Money en ligne** — la couche d'adaptateurs et le
  rapprochement idempotent existent ; il reste l'intégration opérateur.
- **OCR des factures fournisseur**, **IA et prévisions**, **marketplace B2B**,
  **IoT température**, **module importation**.
- **Traduction complète des 12 langues** — l'architecture multilingue est en place
  (langues déclarées dans les paramètres de la plateforme, localisation par pays) ;
  l'interface est aujourd'hui livrée en français.
- **Meilisearch**, **Metabase**, **Kubernetes** — pertinents à la montée en charge,
  inutiles au démarrage.

Voir [`docs/CONFORMITE.md`](docs/CONFORMITE.md) pour le détail point par point.
