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
- **Tests** : 78 tests de bout en bout, dont les 17 critères d'acceptation du cahier
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
├── db/migrations/        16 migrations SQL, appliquées dans l'ordre et une seule fois
├── api/                  NestJS — API métier et back-office SaaS
│   ├── src/common/       socle : base, contexte tenant, auth, quotas, audit, numérotation
│   ├── src/modules/
│   │   ├── auth/         authentification, rotation des jetons
│   │   ├── platform/     back-office SaaS
│   │   ├── tenant/       espace pharmacie
│   │   └── jobs/         traitements périodiques
│   └── test/             78 tests de bout en bout
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
| `pharmacy-operations.e2e-spec.ts` | FEFO, stock, caisse, crédit, B2B, inventaire, mise en route |
| `tenant-isolation.e2e-spec.ts` | L'isolation tient au niveau base, sans le code applicatif |
| `messaging-payments.e2e-spec.ts` | Un message ne part pas deux fois, un versement Mobile Money ne s'encaisse pas deux fois |

---

## Ce qui reste à faire

Conformément à la priorité commerciale du cahier des charges, ces éléments viennent
**après validation du produit auprès de plusieurs pharmacies réellement actives** :

- **Applications natives Flutter** (magasinier, client) — l'application mobile
  installable couvre aujourd'hui le vendeur et le livreur : vente au comptoir,
  tournée, preuve de remise. Ce qui manque au natif : la vente hors ligne et le
  lecteur de code-barres.
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
