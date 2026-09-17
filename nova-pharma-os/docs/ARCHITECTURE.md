# Architecture

## Vue d'ensemble

```
                        ┌──────────────────────────────┐
   Navigateur ─────────▶│  Next.js 15                  │
   (aucun jeton)        │  · rendu serveur             │
                        │  · cookie httpOnly           │
                        │  · relais /api/proxy         │
                        └──────────────┬───────────────┘
                                       │  Bearer (côté serveur)
                        ┌──────────────▼───────────────┐
                        │  NestJS                      │
                        │  · AuthGuard                 │
                        │  · AuthorizationGuard        │
                        │  · SupportActivityInterceptor│
                        └──────────────┬───────────────┘
                                       │  rôle nova_app, SET LOCAL
                        ┌──────────────▼───────────────┐
                        │  PostgreSQL 16               │
                        │  · 293 politiques RLS        │
                        │  · FORCE ROW LEVEL SECURITY  │
                        └──────────────────────────────┘
```

## Le contexte d'exécution

Tout repose sur un objet unique, `RequestContext`, construit par `AuthGuard` à partir
du jeton, puis appliqué à la base au début de chaque transaction.

| Champ | Effet |
|---|---|
| `organizationId` | Détermine ce que RLS laisse voir |
| `branchId` | Rattache les opérations à un point de vente |
| `platform` | Contexte back-office SaaS ; n'ouvre **aucune** politique métier |
| `readonly` | Bloque toute écriture (suspension, accès support en lecture) |
| `permissions` | Droits effectifs de l'utilisateur |
| `modules` | Modules ouverts par le forfait |
| `supportGrantId` | Déclenche la journalisation intégrale de la requête |

`DatabaseService.transaction(ctx, work)` ouvre la transaction, positionne le contexte,
exécute le travail, valide ou annule. Un service ne peut pas interroger la base sans
contexte : la signature l'impose.

## Ordre des contrôles

1. **AuthGuard** — vérifie le jeton ou la clé API, construit le contexte. Pour un
   accès support, c'est **l'état en base** de la subvention qui fait foi à chaque
   requête, jamais le seul contenu du jeton : une révocation prend effet immédiatement.
2. **AuthorizationGuard** — rôle interne, puis caractère écrivable du contexte, puis
   permissions, puis module ouvert par le forfait. L'ordre est choisi pour que le
   message de refus soit le plus informatif possible.
3. **RLS** — dernière barrière, dans la base. Ce que les deux premières laisseraient
   passer par erreur, celle-ci l'arrête.

## Codes de réponse

| Code | Signification | Exemple |
|---|---|---|
| `402` | Limite de forfait atteinte | Onzième utilisateur sur un forfait à dix |
| `403` | Droit insuffisant, ou contexte en lecture seule | Abonnement suspendu |
| `404` | Hors périmètre | Produit d'une autre pharmacie |
| `409` | Règle métier | Stock insuffisant, encours dépassé, ordonnance manquante |

Un `402` est une invitation à faire évoluer l'abonnement, pas une erreur : l'interface
peut proposer la montée de forfait.

## Idempotence

Quatre points d'entrée peuvent être rejoués sans effet double :

| Opération | Clé |
|---|---|
| Vente hors ligne | `sales.client_operation_id` |
| Réception fournisseur | `goods_receipts.idempotency_key` |
| Facture d'abonnement | `subscription_invoices.idempotency_key` (période complète) |
| Règlement d'abonnement | `subscription_payments.idempotency_key` + référence opérateur |

Chaque clé est portée par un index unique : la garantie tient même sous appels
concurrents, pas seulement sous rejeu séquentiel.

## Migrations

Les migrations sont numérotées, jouées dans l'ordre, une seule fois, chacune dans sa
transaction. Leur empreinte est enregistrée : modifier un fichier déjà appliqué
provoque une erreur explicite plutôt qu'une divergence silencieuse entre
environnements.

| # | Contenu |
|---|---|
| 001 | Socle : contexte tenant, types partagés |
| 002 | Plateforme : organisations, forfaits, abonnements, facturation, support |
| 003 | Socle tenant : branches, utilisateurs, rôles, audit, documents, API |
| 004–008 | Catalogue, stock et FEFO, achats, ventes, B2B |
| 009 | **Row-Level Security** |
| 010 | Données de référence : pays, permissions, forfaits, options |
| 011 | Numérotation de la facturation SaaS |
| 012 | Recherche des comptes à l'authentification |
| 013 | Identité de l'agent support visible du client |
| 014 | Compteurs de quota pour le back-office |
| 015 | Protection de la table de suivi des migrations |

## Traitements périodiques

| Traitement | Cadence | Rôle |
|---|---|---|
| `billing-cycle` | 02h00 | Facture les périodes échues |
| `usage-metrics` | 03h00 | Agrège l'activité de chaque pharmacie |
| `retention` | 04h00 | Archive les résiliées hors durée de conservation |
| `stock-alerts` | 05h00 | Recalcule ruptures, seuils et péremptions |
| `trial-expiry` | 06h00 | Clôt les essais échus |
| `dunning` | 08h00 | Relance les impayés, suspend après le délai de grâce |
| `support-access-expiry` | horaire | Ferme les accès support à échéance |

Tous idempotents, tous relançables depuis le back-office.

## Pourquoi le back-office ne voit pas les données métier

C'est un choix d'architecture, pas une limitation. Le contexte plateforme n'ouvre
aucune politique sur les tables tenant : `SELECT * FROM products` avec
`nova.platform = 'on'` renvoie zéro ligne.

L'éditeur a pourtant besoin de chiffres pour piloter son activité. Ils lui parviennent
par deux canaux qui ne divulguent aucun contenu :

- **`usage_metrics`** — une tâche entre dans le périmètre de chaque pharmacie,
  agrège, et publie des compteurs. Le back-office lit « 412 ventes ce mois », jamais
  la liste des ventes.
- **`nova.organization_quota_usage()`** — compteurs de quota, avec un garde-fou dans
  la fonction elle-même : elle refuse de s'exécuter hors contexte back-office.

Ce cloisonnement est ce qui rend crédible l'engagement pris auprès des pharmacies.
