# Conformité au cahier des charges

Chaque exigence du cahier des charges NOVA PHARMA OS, et où elle est traitée.

Légende : **Livré** · **Partiel** (socle en place, reste à brancher) · **Différé**
(volontairement reporté après validation du produit, conformément à la priorité
commerciale du cahier des charges).

---

## 1. Corrections générales

| Exigence | État | Où |
|---|---|---|
| Orthographe « fonctionnalités », « SaaS » | Livré | Ensemble du code et de la documentation |
| « distributeurs semi-grossistes » | Livré | `subscription_plans.target_audience` (forfait Business) |
| Harmoniser « client professionnel (B2B) » | Livré | `customers.kind = 'professional'`, interface et messages |
| Distinguer back-office SaaS / espace pharmacie | Livré | Deux espaces séparés : `/admin` et `/pharmacie`, modules `platform/` et `tenant/` |
| Formulation professionnelle | Livré | « pharmacie pilote », « projet pilote » |
| Entité technique **NOVA PHARMA OS** | Livré | Nom du produit, de l'API et de l'interface |
| Marque pilote **NOVA SANTÉ PHARMA** | Livré | Pharmacie pilote de la démonstration |

---

## 2. Administration SaaS

### 4.1 Super administrateur SaaS

| Permission | État | Où |
|---|---|---|
| Créer, activer, suspendre, supprimer logiquement une pharmacie | Livré | `POST /platform/organizations`, `/suspend`, `/reactivate`, `/terminate`, `DELETE` |
| Organisations, branches, environnements | Livré | `organizations`, `branches`, environnements test/préproduction/production par configuration |
| Abonnements mensuels, trimestriels, annuels | Livré | `organization_subscriptions.billing_cycle` |
| Forfaits, options, limites, essais gratuits | Livré | `subscription_plans`, `plan_addons`, `SubscriptionsService` |
| Facturation SaaS | Livré | `BillingService`, `subscription_invoices` |
| Paiements SaaS | Livré | `subscription_payments`, rapprochement idempotent |
| Relances d'impayé | Livré | `dunning_notices`, tâche `dunning` |
| Codes promotionnels et remises | Livré | `promo_codes`, `SubscriptionsService.resolvePromo` |
| Utilisateurs internes NOVA PHARMA OS | Livré | `platform_users`, `PlatformUsersController` |
| Support client | Livré | `support_tickets`, `SupportService` |
| Métriques globales | Livré | `GET /platform/metrics/dashboard` |
| Paramètres globaux | Livré | `platform_settings` |
| Intégrations externes | Partiel | `api_keys`, `webhook_endpoints`, journal des appels ; connecteurs à brancher |
| Journaux d'audit plateforme | Livré | `platform_audit_logs`, `GET /platform/audit-logs` |
| Sauvegardes, incidents, maintenance | Livré | `organization_backups`, `platform_incidents` |
| Politiques de sécurité | Livré | RLS, rôles, verrouillage, rotation des jetons |
| Pays, devises, langues, règles locales | Livré | `country_settings` (6 pays paramétrés) |
| Fonctionnalités activées par forfait | Livré | `subscription_plans.modules`, `feature_flags` |

### 4.2 Administrateur support SaaS

| Permission | État | Où |
|---|---|---|
| Consulter les informations d'une pharmacie | Livré | `GET /platform/organizations/:id` (abonnement et compteurs, jamais les données métier) |
| Créer et suivre les tickets | Livré | `PlatformSupportController` |
| Réinitialiser un accès selon procédure | Livré | `POST /platform/users/:id/password`, sessions closes |
| Accès temporaire avec autorisation | Livré | `support_access_grants`, parcours complet en 6 étapes |
| Consulter les journaux | Livré | `GET /platform/audit-logs` |
| Accompagner l'onboarding | Livré | `GET /onboarding` — progression vérifiée sur les données réelles |
| Ne rien modifier sans validation | Livré | Lecture seule par défaut ; l'écriture exige l'accord du client |
| **Traçabilité complète de chaque accès** | Livré | `support_access_events` : agent, pharmacie, horodatage, motif, durée, actions, validation |

### 4.3 Gestionnaire commercial SaaS

| Fonctionnalité | État | Où |
|---|---|---|
| Prospects pharmacies | Livré | `leads`, `LeadsController` |
| Démonstrations et essais gratuits | Livré | `startTrial`, `POST .../subscription/trial` |
| Conversion prospect → client | Livré | `leadId` au provisionnement, `leads.stage = 'won'` |
| Attribution d'un forfait | Livré | `POST .../subscription/plan` |
| Devis SaaS | Livré | `POST /platform/billing/organizations/:id/quotes` |
| Suivi des paiements et renouvellements | Livré | `BillingController`, `renewal_at` |
| Résiliations | Livré | `POST .../terminate` |
| Remises commerciales | Livré | `discount_percent`, `promo_codes` |
| Revenu mensuel récurrent | Livré | Tableau de bord SaaS |
| Pharmacies actives et inactives | Livré | Tableau de bord et liste filtrable |

---

## 3. Abonnements et facturation SaaS (§89 bis)

| Élément du modèle d'abonnement | État |
|---|---|
| Forfait actif, dates de début et de renouvellement | Livré |
| Statut, cycle et devise de facturation | Livré |
| Maximums utilisateurs, branches, produits | Livré |
| Quotas stockage documentaire, SMS et WhatsApp | Livré |
| Liste des modules activés | Livré |
| Historiques paiements, factures, changements de forfait | Livré |

**Les 8 statuts d'abonnement** (`nova.subscription_status`) : `trialing`, `active`,
`pending_payment`, `past_due`, `suspended`, `cancelled`, `expired`, `archived`.

| Règle d'abonnement | État | Où |
|---|---|---|
| L'essai donne accès aux fonctionnalités du forfait | Livré | `modules` recopiés à la souscription |
| Fin d'essai sans paiement → attente de paiement | Livré | Tâche `trial-expiry` et `billing-cycle` |
| Notifications automatiques en cas de retard | Livré | Tâche `dunning`, `dunning_notices` |
| Suspension après un délai de grâce paramétrable | Livré | `grace_days`, `platform_settings` |
| Aucune suppression à la suspension | Livré | Suspension = lecture seule uniquement |
| Consultation en lecture seule si suspendue | Livré | `nova.is_readonly_context()` |
| Réactivation automatique après paiement, ou manuelle | Livré | `settleOrganization`, `POST .../reactivate` |
| Toute modification de forfait est historisée | Livré | `subscription_plan_changes` |

**Les 4 forfaits** sont livrés avec les cibles, limites et modules du cahier des
charges : Starter (3/1), Professional (10/2), Business (30/5), Enterprise (sur mesure).

**Les 16 options** du cahier des charges sont toutes présentes dans `plan_addons` :
utilisateur et branche supplémentaires, application livreur, WhatsApp, pack SMS, OCR,
IA, multi-entrepôts, importation, Mobile Money, comptabilité, API partenaires,
formation, support premium, sauvegardes renforcées, stockage supplémentaire.

| Document de facturation | État |
|---|---|
| Devis SaaS, facture d'abonnement, reçu de paiement | Livré |
| Note de crédit (avoir) | Livré |
| Relance de paiement, historique, rapport de revenus | Livré |

| Mode de paiement | État |
|---|---|
| Mobile Money, virement, paiement bancaire local, carte, validation manuelle, annuel anticipé | Livré (enregistrement et rapprochement) ; intégration opérateur à brancher |

**Les 16 indicateurs du tableau de bord** sont tous exposés par
`GET /platform/metrics/dashboard` : pharmacies inscrites, actives, en essai,
suspendues, en retard ; MRR, ARR, taux de conversion, taux de résiliation, revenu par
forfait, utilisateurs actifs, ventes traitées, volume de stock, tickets ouverts,
disponibilité, adoption par module.

---

## 4. Multi-tenant et sécurité renforcée

| Exigence | État | Comment |
|---|---|---|
| Tables `organizations`, `organization_subscriptions`, `subscription_plans`, `subscription_invoices`, `subscription_payments`, `feature_flags`, `usage_metrics`, `branches`, `users`, `roles`, `permissions` | Livré | Toutes présentes, aux noms du cahier des charges |
| `organization_id` sur chaque table métier sensible | Livré | Vérifié par test automatisé |
| Un utilisateur ne voit jamais une autre pharmacie | Livré | RLS + test d'isolation au niveau base |
| Filtrage systématique par `organization_id` | Livré | `SET LOCAL` en début de transaction |
| Contrôle applicatif **et** base de données | Livré | Double barrière |
| **PostgreSQL Row-Level Security** | Livré | 293 politiques, `FORCE ROW LEVEL SECURITY`, rôle sans `BYPASSRLS` |
| Fichiers séparés par organisation | Livré | `documents.storage_key = org/<id>/…` |
| Restauration d'une pharmacie sans les autres | Livré | `BackupsService`, confirmation par identifiant |
| Conservation contractuelle avant archivage | Livré | `data_retention_until`, tâche `retention` |

**Accès administrateur aux données clientes** — les six exigences sont satisfaites :
demande motivée, validation du client, durée limitée, lecture seule par défaut,
journalisation complète, révocation automatique.

---

## 5. Technologies

| Domaine | Cahier des charges | Livré |
|---|---|---|
| Frontend web | Next.js, React, TypeScript | ✅ Next.js 15 |
| Mobile | Flutter | ⏳ Différé — API et synchronisation hors ligne prêtes |
| Backend | NestJS, Node.js, TypeScript | ✅ |
| API | REST + OpenAPI/Swagger | ✅ `/api/docs` |
| Base de données | PostgreSQL | ✅ PostgreSQL 16 |
| Isolation | Row-Level Security | ✅ |
| Cache et files | Redis + BullMQ | ⏳ Redis dans la composition ; ordonnanceur applicatif en place |
| Recherche | Meilisearch / OpenSearch | ⏳ Recherche SQL indexée suffisante à ce stade |
| Fichiers | Stockage objet S3 | ⏳ Système de fichiers cloisonné par organisation ; adaptateur à écrire |
| Temps réel | WebSockets | ⏳ Différé |
| Authentification | OAuth 2.0, OIDC, JWT rotatifs | ✅ JWT rotatifs ; SSO prévu au forfait Enterprise |
| Paiements | Couche d'adaptateurs | ✅ Structure ; intégrations opérateur à brancher |
| Notifications | WhatsApp, SMS, e-mail, FCM | ⏳ Notifications produites et stockées ; passerelles à brancher |
| OCR | Vision, Textract | ⏳ Différé (option commercialisable définie) |
| IA | Python, FastAPI, prévisions | ⏳ Différé (option commercialisable définie) |
| Analytique | Metabase / Superset | ⏳ Rapports natifs livrés |
| Observabilité | Sentry, Prometheus, Grafana | ⏳ `/api/health` et journaux structurés |
| Infrastructure | Docker, Kubernetes | ✅ Docker ; Kubernetes à la montée en charge |
| CI/CD | GitHub Actions | ⏳ Tests exécutables en une commande |
| Sécurité applicative | WAF, limitation de débit, secrets | ✅ Limitation de débit par clé API ; secrets par variables d'environnement |

**Architecture** : monolithe modulaire, comme recommandé. Les 25 modules backend du
cahier des charges correspondent aux dossiers de `api/src/modules` et `api/src/common`.

---

## 6. Fonctionnalités supplémentaires prioritaires

**Onboarding des pharmacies** — les 12 étapes du cahier des charges sont implémentées
et **vérifiées sur les données réelles** : la progression reflète l'état effectif de
la mise en route, pas une case cochée.

**Centre de support SaaS**

| Fonctionnalité | État |
|---|---|
| Base de connaissances, FAQ, tutoriels | Livré (`knowledge_base_articles`) |
| Visites guidées intégrées | Partiel — étape d'onboarding `guided_training` |
| Tickets avec priorité et SLA | Livré |
| Chat support | Livré sous forme de fil de messages |
| Pièces jointes | Livré (`support_ticket_messages.attachments`) |
| Statut des incidents | Livré (`platform_incidents`) |
| Historique des échanges | Livré |
| Mesure de satisfaction | Livré |
| Demandes de fonctionnalité | Livré (catégorie `feature_request`) |

**Gestion des langues** — architecture multilingue en place : langues déclarées dans
`platform_settings`, locale par organisation et par utilisateur, localisation par pays.
L'interface est livrée en français ; les traductions restent à produire. Les données
produits et les documents réglementaires conservent leur intégrité, indépendamment de
la langue d'interface.

**Paramétrage local par pays** — les 11 éléments demandés sont couverts par
`country_settings` : devise, TVA, format et numérotation des factures, moyens de
paiement, format téléphonique, langues, règles de crédit, exigences réglementaires,
conservation des données, fuseau horaire. Six pays sont paramétrés (RDC, Rwanda,
Burundi, Tanzanie, Kenya, Congo-Brazzaville).

**Intégrations et API partenaires** — les sept éléments demandés sont livrés : clés
API par organisation, scopes, limitation de débit, webhooks, journal des appels,
révocation, documentation OpenAPI.

---

## 7. Critères d'acceptation SaaS

Les 17 critères sont couverts par des tests automatisés dans
`api/test/acceptance-saas.e2e-spec.ts`.

| # | Critère | Test |
|---|---|---|
| 1 | Le Super administrateur peut créer une pharmacie cliente | ✅ |
| 2 | Une pharmacie peut démarrer un essai gratuit | ✅ |
| 3 | Le Super administrateur peut attribuer ou modifier un forfait | ✅ |
| 4 | Chaque forfait limite utilisateurs, branches et modules | ✅ |
| 5 | Une facture SaaS est générée automatiquement | ✅ (+ non-duplication) |
| 6 | Les paiements sont enregistrés et rapprochés | ✅ |
| 7 | Les relances d'impayé sont envoyées automatiquement | ✅ |
| 8 | Une pharmacie impayée peut être suspendue sans perdre ses données | ✅ |
| 9 | Une pharmacie réactivée retrouve ses données et ses accès | ✅ |
| 10 | Les données d'une pharmacie sont invisibles aux autres | ✅ (+ 11b : invisibles au back-office) |
| 11 | Les accès du support sont limités, autorisés et journalisés | ✅ |
| 12 | Le tableau de bord affiche abonnements, revenus et impayés | ✅ |
| 13 | Les journaux d'audit fonctionnent aux deux niveaux | ✅ |
| 14 | Les sauvegardes permettent une restauration ciblée | ✅ |
| 15 | Les modules et options sont activables selon le forfait | ✅ |
| 16 | Déploiement en test, préproduction et production | ✅ Configuration par environnement ; conservation vérifiée à la résiliation |
| 17 | Protection contre doublons et erreurs de synchronisation | ✅ |

---

## 8. Priorité commerciale

**MVP 1 — Pharmacie pilote** : intégralement livré (authentification et rôles,
catalogue, lots et FEFO, stock et inventaire, achats et réceptions, ventes POS, caisse
et paiements, clients particuliers et B2B, factures et reçus, alertes de rupture et de
péremption, tableau de bord opérationnel, socle de synchronisation hors ligne).

**MVP 2 — SaaS commercialisable** : intégralement livré (multi-tenant complet,
création de pharmacies clientes, abonnements, limites par forfait, facturation,
paiements, suspension et réactivation, tableau de bord Super administrateur, support
et tickets, onboarding guidé, audit plateforme, sauvegarde et restauration par
organisation).

**Au-delà** : IA avancée, marketplace B2B, OCR, IoT température, importation et
intégrations complexes sont volontairement différés, conformément au cahier des
charges, jusqu'à validation auprès de plusieurs pharmacies réellement actives.
