# MediLab SaaS — Gestion des dossiers médicaux et des résultats de laboratoire

Implémentation de la **Phase 1 (MVP)** du *Cahier des charges fonctionnel et
technique — SaaS de Gestion des Dossiers Médicaux et des Résultats de
Laboratoire, v1.0 du 19 juillet 2026*.

> Périmètre Phase 1 (Art. 22) : gestion patient · consultations · demandes de
> laboratoire · saisie des résultats · export PDF · authentification · audit de
> base — avec séparation multi-établissement (multi-tenant), critère de
> réception de l'Art. 23.

## Démarrage

Aucune dépendance externe : **Node.js ≥ 18** suffit.

```bash
cd medilab
node server.mjs            # http://localhost:8080
PORT=3000 node server.mjs  # port personnalisé
```

Au premier démarrage, une base de démonstration est créée dans `medilab/data/`
(déplaçable via `MEDILAB_DATA=/chemin`), avec deux Établissements étanches :

| Établissement | Comptes (mot de passe `demo1234`) |
|---|---|
| Clinique Horizon Santé (Kinshasa) | `dr.mukendi` (médecin) · `inf.kalala` (infirmier) · `accueil` (réceptionniste) · `lab.kanya` (laborantin) · `bio.ilunga` (biologiste) · `qualite` (resp. qualité) · `admin.horizon` (admin établissement) |
| Centre Médical du Lac (Goma) | `dr.amani` (médecin) · `lab.furaha` (laborantin) |
| Plateforme (tous établissements) | `admin` / `admin123` (administrateur système) |

⚠️ Comptes de démonstration uniquement — à supprimer et remplacer avant toute
mise en production.

## Test de recette

```bash
node test/smoke.mjs
```

36 vérifications automatisées couvrant les critères de réception de
l'Article 23 : création et suivi d'un patient, prescription, cycle de vie
complet de l'échantillon, saisie/validation/consultation des résultats,
génération PDF, complétude de l'audit trail, contrôle des rôles et
étanchéité entre Établissements.

## Correspondance avec le cahier des charges

| Article | Exigence | Implémentation |
|---|---|---|
| Art. 4, 14, 23 | SaaS multi-tenant, étanchéité des données | Chaque enregistrement porte un `etablissementId` ; filtrage systématique côté serveur (`tenantFilter`/`tenantCheck`) ; l'admin système gère les Établissements |
| Art. 5, 10 | Profils et permissions fines | 8 rôles natifs avec matrice de permissions vérifiée à chaque requête (lecture, création, validation, export…) |
| Art. 6.1 | Gestion des patients | Dossier avec identifiant unique (`PAT-…`), recherche rapide, antécédents, allergies, contact d'urgence, archivage |
| Art. 6.2 | Consultations | Ouverture, symptômes, diagnostic, constantes, liaison vers le laboratoire, historique au dossier |
| Art. 6.3, 7 | Module laboratoire | Catalogue de tests paramétrable (unités, valeurs de référence, seuils d'alerte) ; cycle de vie complet : demandée → prélevée (échantillon numéroté) → reçue → en analyse → saisie → validée (signature) → publiée ; correction post-validation réservée au biologiste, sous audit |
| Art. 7.3 | Résultats hors norme | Interprétation automatique (normal / bas / élevé / **critique**) selon les seuils du catalogue ; commentaires du biologiste |
| Art. 6.5 | Reporting | Tableau de bord : patients actifs, volume de demandes, en-cours par statut, délai moyen de rendu, résultats critiques |
| Art. 9 | Sécurité | Mots de passe scrypt salés, jetons de session, comparaison à temps constant, contrôle d'accès par rôle, aucune donnée servie sans authentification |
| Art. 11 | Interfaces | SPA en français, responsive (ordinateur/tablette), vues clinique, laboratoire et administration |
| Art. 16 | Journal d'audit | Append-only : connexions (y compris échecs), créations, modifications, changements de statut, validations, corrections, exports PDF, changements de droits ; aucune API de modification/suppression |
| Art. 17 | Modèle de données | Patient, Consultation, Demande (prescription), Test, Échantillon, Résultat, Utilisateur, Rôle, Établissement, Audit |
| Art. 18 | Export PDF | Générateur PDF intégré (sans dépendance) : compte rendu mis en page, disponible après validation uniquement |

## Architecture (Art. 8)

```
medilab/
├── server.mjs        # Backend API REST + génération PDF + audit (Node pur)
├── public/
│   ├── index.html    # Point d'entrée SPA
│   ├── app.js        # Application cliente (vanilla JS, routage par hash)
│   └── styles.css    # Interface clinique responsive
├── test/smoke.mjs    # Recette automatisée (Art. 23)
└── data/             # Persistance JSON (créée au premier lancement, non versionnée)
```

Le stockage JSON sur fichier est un choix de MVP : la couche de persistance est
isolée (`loadDb`/`saveDb`) pour permettre une migration vers une base
relationnelle (PostgreSQL) en Phase 2 sans toucher aux routes. Les Phases 2 et
3 du cahier des charges (portail patient, notifications, HL7/FHIR, facturation)
sont hors périmètre de ce MVP.
