# LocaGest — SaaS de gestion de locataires (MVP)

MVP développé à partir du **cahier des charges « SaaS de gestion de locataires » v1.0 (25 septembre 2026)**.
Il couvre la **Phase 1 de la roadmap** (§8) et une partie de la **Phase 2** : suivi des paiements,
reçus, rapports exportables, messagerie intégrée, notifications in-app, interface en 22 langues et
gestion des monnaies selon le pays de chaque utilisateur.

Au cœur du produit, les **alertes de garantie à quatre couleurs** (§3.4) :

| Couleur | Situation | Délai avant expiration | Action recommandée |
|---|---|---|---|
| 🟢 Vert | Situation normale | 60 jours et plus | Aucune action immédiate |
| 🟡 Jaune | Renouvellement imminent | 30 à 59 jours | Préparer le renouvellement, contacter le locataire |
| 🟠 Orange | Expiration très proche | 1 à 29 jours | Relancer le locataire, préparer les documents |
| 🔴 Rouge | Garantie expirée | 0 jour ou dépassé | Action immédiate, régulariser la situation |

Les éléments jaunes, orange et rouges **pulsent** à l'écran. Des emails partent automatiquement **à 30, 14 et
7 jours** de l'expiration, puis le jour même, au bailleur et au locataire. Chaque envoi est conservé dans
l'historique des alertes, pour l'audit.

## Ce que fait le MVP

| Cahier des charges | Contenu livré |
|---|---|
| Authentification et comptes | Inscription des bailleurs, connexion par jeton JWT, rôles **bailleur / locataire / administrateur** (RBAC), limitation des tentatives de connexion |
| 3.1 Propriétés | Fiche complète (province, commune, quartier, avenue, numéro ; type ; chambres, salons, toilettes internes/externes, cuisines ; état ; loyer en USD ou FC ; disponibilité), statut Vacante / Occupée / En maintenance, **galerie photos**, recherche et filtres |
| 3.2 Locataires | Profil (identité, CIN, nationalité, contacts, profession, employeur), logements précédents, **note de fiabilité**, **liste noire** avec motif, alerte à la saisie d'un numéro ou téléphone déjà blacklisté, historique des baux |
| 3.3 Baux | Création et modification, date d'expiration de la garantie (par défaut la fin du bail), montant de la garantie, termes, clause de renouvellement automatique ; **renouvellement** (l'ancien bail est archivé), **clôture** (la propriété redevient vacante), **contrat imprimable / PDF** généré depuis un modèle |
| 3.4 Alertes de garantie | Code couleur, pulsation, tableau de bord temps réel, emails 30/14/7/0 jours, **historique d'alertes** |
| 3.5 Paiements | Enregistrement (espèces, Mobile Money, virement), échéancier mensuel **Payé / Partiel / À venir / En retard / Impayé**, emails de retard **après 5, 10 et 15 jours**, graphique des revenus sur 12 mois |
| 3.5 Reçus | **Reçu de loyer imprimable / PDF** pour chaque paiement (mention « paiement partiel » si besoin) |
| 3.7 Rapports | Indicateurs du tableau de bord ; **rapport mensuel** (loyers par bail, paiements reçus, occupation) et **rapport annuel** (attendu, encaissé, arriérés, occupation par mois) ; **export Excel (CSV)** et **impression PDF** |
| 3.8 Communication | **Messagerie interne** bailleur ↔ locataire (historique conservé, accusés ✓ Envoyé / ✓✓ Lu), email « nouveau message » au destinataire (sans le contenu), **notifications in-app** : badges de messages non lus et de garanties à moins de 30 jours |
| Espace locataire | Le bailleur ouvre un accès ; le locataire consulte son bail, l'état de sa garantie et ses loyers |
| Administration | Statistiques de la plateforme, liste des bailleurs, **changement d'offre**, suspension de compte, déclenchement manuel des alertes |
| 7. Offres | Limites appliquées : Starter 3 propriétés / 10 locataires, Pro 20 propriétés, Enterprise illimité |
| Multilingue | **22 langues** : français, anglais, lingala, swahili, kikongo, tshiluba, kinyarwanda, kirundi, bambara, wolof, haoussa, yoruba, amharique, arabe (de droite à gauche), espagnol, portugais, italien, allemand, néerlandais / flamand, norvégien, chinois (mandarin), hindi. Langue du navigateur détectée, choix enregistré sur le compte, messages d'erreur du serveur traduits |
| Pays et monnaies | **Pays de l'utilisateur** détecté à l'inscription (fuseau horaire, puis langue) et modifiable ; **monnaie par défaut du pays** (FC, $, €, F CFA, shilling, naira, rand… une quarantaine) proposée pour chaque nouvelle propriété et chaque bail ; noms des pays et monnaies dans la langue de l'interface ; tableau de bord et rapports totalisés **par monnaie** ; répartition des bailleurs **par pays** dans l'administration |
| 6. Sécurité | Mots de passe hachés (bcrypt), en-têtes de sécurité (helmet), isolation stricte des données entre bailleurs, **journal d'audit** des actions critiques |

**Pas encore dans le MVP** : notifications push (Firebase : il faut un projet et ses clés), SMS / WhatsApp,
annonces, 2FA, application mobile, mode hors ligne, e-signature, inspections, scoring IA, marketplace,
intégrations Mobile Money, conversion automatique entre monnaies.

### À propos des traductions

Le français est la langue de référence (`web/src/i18n/locales/fr.ts`). Les traductions en anglais sont
relues ; **les 20 autres ont été rédigées sans relecture par des locuteurs natifs** et portent la marque
✎ « à relire » dans le sélecteur. C'est particulièrement vrai pour les langues africaines et le hindi :
faites-les relire avant de les proposer à des clients. Pour corriger une traduction, modifiez le fichier
de la langue (`web/src/i18n/locales/<code>.ts`) puis passez `reviewed: true` dans
`web/src/i18n/languages.ts`. Les tests refusent toute traduction incomplète ou dont les valeurs insérées
(`{name}`, `{amount}`…) diffèrent du français.

Restent en français : le contrat de bail, le reçu et les emails d'alerte (documents à valeur juridique ;
leur traduction est une étape suivante).

## Démarrage rapide

Prérequis : **Node.js 22** et **PostgreSQL 16** (ou Docker).

```bash
cd locagest
docker compose up -d                # PostgreSQL (bases locagest et locagest_test)
cp server/.env.example server/.env  # puis renseigner JWT_SECRET
npm install
npm run seed                        # schéma + données de démonstration
npm run dev                         # API :4000 + interface :5173
```

Ouvrir <http://localhost:5173>. Comptes de démonstration :

| Rôle | Email | Mot de passe |
|---|---|---|
| Bailleur (4 baux, un par couleur) | `demo@locagest.app` | `demo1234` |
| Locataire | `locataire@locagest.app` | `demo1234` |
| Administrateur | `admin@locagest.app` | `admin1234` |
| Bailleur au Sénégal (F CFA, wolof) | `dakar@locagest.app` | `demo1234` |

Sans `SMTP_HOST`, les emails sont **simulés** : ils s'affichent dans la console du serveur et apparaissent
avec le statut « Simulé » dans l'historique des alertes. Pour envoyer de vrais emails, renseignez les
variables `SMTP_*` dans `server/.env` (Brevo, SendGrid et Gmail fonctionnent en SMTP).

### Production

```bash
npm run build        # compile l'API (server/dist) et l'interface (web/dist)
npm start            # applique les migrations, puis sert l'API et l'interface sur PORT
```

Le serveur applique lui-même les migrations au démarrage. Il crée le compte administrateur défini par
`ADMIN_EMAIL` et `ADMIN_PASSWORD` s'il n'existe pas, puis vérifie les alertes toutes les heures. Un
`Dockerfile` est fourni pour Heroku, Render, Railway, AWS, etc. Les photos sont stockées dans `UPLOAD_DIR` ;
prévoyez un volume persistant, ou S3 plus tard.

### Tests

```bash
npm test             # 60 tests serveur (base locagest_test) + 23 tests de traductions
npm run typecheck
```

Les tests tournent aussi dans GitHub Actions (`.github/workflows/locagest-ci.yml`).

## Architecture

```
locagest/
├── server/                 API REST — Node.js, Express 5, TypeScript, PostgreSQL (pg), zod
│   ├── src/db/migrations/  schéma SQL versionné
│   ├── src/lib/alerts.ts   règles métier : couleurs, paliers d'emails, statut des loyers
│   ├── src/lib/notifier.ts tâche horaire d'envoi des alertes (idempotente)
│   ├── src/lib/geo.ts      pays pris en charge et monnaie de chacun
│   ├── src/routes/         auth, properties, tenants, leases (+ paiements, reçus), dashboard, reports,
│   │                       messages, notifications, admin, portal
│   └── test/               vitest + supertest
└── web/                    React 19, TypeScript, Vite, Tailwind CSS 4, React Router
    └── src/i18n/           moteur de traduction, liste des langues, un fichier par langue (chargé à la demande)
```

**Idempotence des alertes** : la table `alerts` a une clé unique (bail, type, palier, échéance,
destinataire). La tâche peut tourner toutes les heures, redémarrer ou s'exécuter sur plusieurs serveurs :
une alerte n'est jamais envoyée deux fois. Si l'échéance change, par exemple après un renouvellement, le
cycle d'alertes repart de zéro.

**« Aujourd'hui »** est calculé dans le fuseau `APP_TIMEZONE` (par défaut `Africa/Kinshasa`), et les dates
sont stockées sans heure. Une échéance ne glisse donc pas d'un jour selon le fuseau du serveur.

### API (extrait)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | — |
| GET/POST/PUT/DELETE | `/api/properties[/:id]`, `POST /:id/photos` | bailleur |
| GET/POST/PUT/DELETE | `/api/tenants[/:id]`, `GET /check-blacklist`, `POST /:id/portal` | bailleur |
| GET/POST/PUT | `/api/leases[/:id]`, `POST /:id/renew`, `POST /:id/terminate`, `GET /:id/contract` | bailleur |
| POST/DELETE | `/api/leases/:id/payments[/:paymentId]` | bailleur |
| GET | `/api/dashboard` | bailleur |
| GET | `/api/alerts`, `POST /api/alerts/run` (admin) | bailleur, admin |
| GET | `/api/leases/:id/payments/:paymentId/receipt` | bailleur |
| GET | `/api/reports/monthly?month=AAAA-MM`, `/api/reports/annual?year=AAAA` (`&format=csv`) | bailleur |
| GET/POST | `/api/messages`, `/api/messages/:tenantId` | bailleur |
| GET/POST | `/api/portal/messages` | locataire |
| GET | `/api/notifications` (compteurs des badges) | bailleur, locataire |
| GET | `/api/portal/leases` | locataire |
| GET/PATCH | `/api/admin/stats`, `/api/admin/users[/:id]`, `/api/admin/audit` | admin |

## Prochaines étapes suggérées

1. Fin de la Phase 2 : notifications push (Firebase Cloud Messaging) ; relecture des traductions par des locuteurs
2. Notifications SMS / WhatsApp (Twilio, WhatsApp Business) sur le même mécanisme que les emails
3. Stockage des photos et documents sur S3, contrats signés téléversés
4. Paiement de l'abonnement (Mobile Money, carte) et changement d'offre en libre-service
