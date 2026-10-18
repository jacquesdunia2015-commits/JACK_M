# NuméroGo — SaaS de numéros de téléphone temporaires

Implémentation de la **Phase 1 (MVP, §11)** du *Cahier des charges — Plateforme
SaaS mondiale de numéros de téléphone temporaires, v1.0 du 19 juillet 2026* :
compte utilisateur · wallet · sélection de pays · attribution d'un numéro ·
réception de SMS en temps réel · dashboard · API de base · paiement simple —
avec une bonne partie de la **Phase 2** (multi-pays, multi-devises, webhooks
signés, anti-abus léger, reporting admin) déjà posée pour ne pas bloquer la
suite du projet.

> 📄 Ce dossier vit dans le dépôt `JACK_M`, qui héberge plusieurs projets
> indépendants sur des branches séparées (voir `medilab-saas`, dont ce projet
> reprend la convention technique). Il est volontairement autonome — aucune
> dépendance vers le reste du dépôt — pour pouvoir être extrait vers son
> propre dépôt Git à tout moment (`git subtree split` ou simple copie).

## Démarrage

Aucune dépendance externe : **Node.js ≥ 18** suffit.

```bash
node server.mjs             # http://localhost:8080
PORT=3000 node server.mjs   # port personnalisé
```

Au premier démarrage, une base de démonstration est créée dans `data/`
(déplaçable via `NUMEROGO_DATA=/chemin`), avec deux comptes :

| Compte | Rôle | Mot de passe |
|---|---|---|
| `demo@numerogo.dev` | utilisateur (crédit + 1 numéro déjà actif avec un SMS reçu) | `demo1234` |
| `admin@numerogo.dev` | administrateur plateforme | `admin123` |

⚠️ Comptes de démonstration uniquement — à supprimer et remplacer avant toute
mise en production.

## Test de recette

```bash
node test/smoke.mjs
```

21 vérifications automatisées couvrant les critères d'acceptation du §12 :
création de compte, réservation/activation d'un numéro, réception de SMS,
tarification convertie par pays/devise, renouvellement, libération et
politique de remboursement, wallet, clé API, webhooks, rôles et permissions,
suspension de compte.

## Correspondance avec le cahier des charges

| Section | Exigence | Implémentation |
|---|---|---|
| §3.1 | Compte utilisateur, wallet, historique | `POST /auth/register`\|`login`, mot de passe scrypt salé, session par jeton porteur, `GET /me`, `GET /billing/transactions` |
| §3.2 | Recherche, réservation, activation, renouvellement, libération d'un numéro | Cycle `available → reserved → active → expired/released` (`numbers.reserve/activate/renew/release`), réservation expirée automatiquement libérée (3 min), balayage périodique des expirations |
| §3.3 | SMS entrants en temps réel, horodatage, historique, notification | Flux **SSE** (`GET /api/stream`) poussant chaque SMS à l'utilisateur propriétaire dès réception ; toast navigateur ; historique complet (`GET /messages`) |
| §3.4 | Wallet, débit automatique, détail des transactions, remboursements, rechargement | Grand livre append-only (`transactions`), débit à l'activation/au renouvellement, **remboursement automatique** si libération &lt; 2 min après activation et aucun SMS reçu, `POST /billing/recharge` (mode bac à sable — voir §9.6 ci-dessous) |
| §3.5 | Administration : pays, devises, tarifs, fournisseurs, utilisateurs, trafic, marges | `GET /admin/overview` (revenus, numéros actifs, SMS/24 h par pays), `GET`/`POST`/`PATCH /admin/countries`, `PATCH /admin/users/:id` (suspension), `GET /admin/audit` |
| §4 | Multi-pays, multi-devises, conversion automatique, devise de référence USD, historique des taux | Chaque pays porte sa devise et son taux (unités locales pour 1 USD) ; prix affichés = prix USD × taux, jamais désynchronisés ; `rateHistory` conserve chaque changement de taux |
| §5, §6 | Architecture par services logiques, provisioning automatisé via API | `server.mjs` sépare clairement auth / pays-tarifs / numéros / messages / webhooks / facturation / admin ; le « fournisseur télécom » est simulé derrière une frontière nette (section *Fournisseur simulé* du code) pour pouvoir être remplacé sans toucher au reste |
| §6.3 | Endpoints minimaux | Voir tableau ci-dessous |
| §7.1 | TLS, chiffrement, secrets, 2FA admin, HMAC webhooks, rate limiting, audit | Mots de passe et clés API hashés (scrypt, comparaison à temps constant), clé API affichée une seule fois, webhooks signés HMAC-SHA256 (`X-Signature`), rate limiting sur `/api/auth/*`, journal d'audit append-only. *(TLS et 2FA admin sont hors périmètre d'un MVP applicatif — à la charge de l'hébergeur/reverse proxy et d'une Phase 2, voir Feuille de route.)* |
| §7.2 | Politique de remboursement, usage acceptable | Politique de remboursement codée et documentée ci-dessus ; limite anti-abus de 5 numéros actifs/réservés simultanés par compte |
| §12 | Critères de validation | Couverts par `test/smoke.mjs` (voir plus haut) |

### Endpoints (§6.3)

| Cahier des charges | Implémenté | Note |
|---|---|---|
| `POST /auth/login` | `POST /api/auth/login` | + `POST /api/auth/register`, `POST /api/auth/logout` |
| `POST /auth/api-key` | `POST /api/auth/api-key` | clé rendue une seule fois, utilisable via l'en-tête `X-Api-Key` |
| `GET /countries` | `GET /api/countries` | public |
| `GET /numbers/available` | `GET /api/numbers/available?country=XX` | public |
| `POST /numbers/reserve` | `POST /api/numbers/reserve` | |
| `POST /numbers/activate` | `POST /api/numbers/:id/activate` | id dans le chemin plutôt que le corps |
| `POST /numbers/renew` | `POST /api/numbers/:id/renew` | |
| `DELETE /numbers/release` | `POST /api/numbers/:id/release` **et** `DELETE /api/numbers/:id` | alias REST, même comportement |
| `GET /messages` | `GET /api/messages?numberId=…` | |
| `POST /webhooks/register` | `POST /api/webhooks/register` | + `GET`/`DELETE /api/webhooks/:id` |
| `GET /billing/balance` | `GET /api/billing/balance` | + `GET /api/billing/transactions` |
| `POST /billing/recharge` | `POST /api/billing/recharge` | |
| `GET /pricing` | `GET /api/pricing?country=XX` | |

Endpoints ajoutés au-delà du minimum : `GET /api/me`, `GET /api/stream` (SSE),
`POST /api/numbers/:id/simulate-sms` (aide de démo/test), `POST
/api/provider/inbound` (point d'entrée qu'un vrai fournisseur télécom
appellerait en production), et `/api/admin/*`.

## Architecture

```
├── server.mjs        # API REST + wallet + fournisseur simulé + SSE (Node pur)
├── public/
│   ├── index.html    # Point d'entrée SPA
│   ├── app.js         # Application cliente (vanilla JS, routage par hash)
│   └── styles.css     # Interface responsive
├── test/smoke.mjs     # Recette automatisée (§12)
└── data/              # Persistance JSON (créée au premier lancement, non versionnée)
```

Le stockage JSON sur fichier est un choix de MVP : la couche de persistance
est isolée (`loadDb`/`saveDb`) pour permettre une migration vers PostgreSQL +
Redis (§5.3) en Phase 2 sans toucher aux routes.

## Fournisseur télécom (simulation)

Ce MVP n'est branché sur aucun fournisseur télécom réel. Il simule :
- un **pool de numéros** généré à la volée par pays (provisioning « instantané ») ;
- la **réception de SMS** : chaque numéro activé reçoit automatiquement un
  code de vérification factice 4 à 9 secondes après activation (pour une
  démonstration immédiate), et `POST /api/numbers/:id/simulate-sms` permet
  d'en injecter d'autres à la demande ;
- le **webhook fournisseur entrant** : `POST /api/provider/inbound` (protégé
  par le secret partagé `PROVIDER_SECRET`) est le point que remplacerait
  l'intégration d'un vrai fournisseur (Twilio, Vonage, Telnyx…) — aucune
  autre partie du serveur n'a besoin de changer.

## Paiement (simulation)

`POST /api/billing/recharge` crédite le wallet **immédiatement**, en mode
« bac à sable » — il n'y a pas d'intégration Stripe/PayPal/Mobile Money
réelle dans ce MVP (§9.6). En production, cette route doit être remplacée par
un flux de confirmation asynchrone (webhook de paiement signé) avant tout
crédit du wallet.

## Déploiement

```bash
# Sur Render (voir render.yaml, rootDir: numero-saas)
# Sur tout hébergeur Node : node server.mjs derrière un reverse proxy TLS.
```

## 🗺️ Feuille de route (hors périmètre de ce MVP)

- **Vrai fournisseur télécom** (Twilio, Vonage, Telnyx…) à la place du
  fournisseur simulé — l'interface (`receiveMessage`, `/api/provider/inbound`)
  est déjà prête pour l'accueillir.
- **Paiement réel** (Stripe, PayPal, Mobile Money) à la place du
  rechargement instantané simulé.
- **TLS et 2FA administrateur** (§7.1) — à la charge du reverse proxy /
  hébergeur pour le premier, à ajouter en Phase 2 pour le second.
- **PostgreSQL + Redis** (§5.3) à la place du fichier JSON, pour la montée
  en charge et le multi-instance.
- **Phase 3** (§11) : white-label, programme revendeur, SLA entreprise,
  optimisation avancée de marge et de disponibilité, site vitrine marketing
  dédié (§8), internationalisation de l'interface (i18n).
