# 💰 QualiCode — Tarification, licences et paiements

*Document du vendeur. Version du 15 juillet 2026. Tous les prix sont en dollars US.*

## 1. Positionnement de prix

Repères du marché (licence individuelle, prix publics 2026) :

| Logiciel | Licence perpétuelle | Abonnement annuel | Étudiant |
|---|---|---|---|
| MAXQDA | ≈ $700 | ≈ $250/an | ≈ $110 |
| NVivo | ≈ $1 250 | ≈ $400/an | ≈ $120 |
| ATLAS.ti | ≈ $770 | ≈ $250/an | ≈ $100 |
| **QualiCode** | **$199–399** | **$99–199/an** | tarif Afrique |

QualiCode se positionne **3 à 6 fois moins cher** que les leaders, avec deux
zones tarifaires (parité de pouvoir d'achat) — c'est l'arme principale pour
conquérir le marché africain et étudiant, tout en restant très rentable
(coût marginal d'une copie ≈ 0).

## 2. Grille tarifaire (celle codée dans l'application)

| Formule | Afrique (tarif solidaire) | International |
|---|---|---|
| **Essai complet** | Gratuit · 5 jours | Gratuit · 5 jours |
| Jour (1 j) | $1,50 | $4 |
| Semaine (7 j) | $6 | $15 |
| Mois (31 j) | $15 | $29 |
| An (366 j, ≈ 2 mois offerts) | $99 | $199 |
| **À vie** (achat définitif) | $199 | $399 |
| Institution (10 postes, à vie) | $990 | $1 990 |

Logique de la grille :
- **Jour/Semaine** : l'étudiant qui n'a besoin du logiciel que pour finir son
  chapitre Résultats. Personne d'autre sur le marché ne propose cela — c'est un
  avantage concurrentiel réel en Afrique (comme les forfaits internet journaliers).
- **Mois** : le mémorant (2–4 mois d'analyse) → revenu typique $30–60 par mémoire.
- **An** : laboratoires, doctorants, consultants.
- **À vie** : réticents à l'abonnement ; prix ≈ 2 années d'abonnement.
- La grille est modifiable dans `js/payments.js` (constante `PRICING`).

## 3. Fonctionnement technique des licences

- Essai gratuit **5 jours** : démarre au premier lancement (stocké localement).
- Ensuite : écran bloquant demandant une **clé de licence** `QC1-…`
  (l'export des données reste toujours possible — on ne prend jamais les
  données d'un client en otage : c'est aussi un argument de vente).
- Les clés sont signées **HMAC-SHA256** et vérifiées **hors ligne**. Elles
  encodent la formule, la date d'expiration et le nom/e-mail du client.
- Génération (vendeur uniquement) :
  `python3 tools/generer_cle.py month "client@email.com"`
- ⚠️ **Avant toute vente** : changez `LICENSE_SECRET` dans `js/license.js` ET
  `tools/generer_cle.py` (même valeur), puis reconstruisez
  (`python3 tools/build_standalone.py`). Ne publiez jamais le dépôt contenant
  votre secret réel.
- Honnêteté technique : une application 100 % locale ne peut pas avoir de DRM
  inviolable (un informaticien qui lit le code peut fabriquer une clé). C'est
  une protection dissuasive, comme Sublime Text ou WinRAR — largement
  suffisante pour la cible (chercheurs, étudiants), et le vrai levier
  anti-piratage est le prix bas + le support + les mises à jour.

## 4. Encaissement : le circuit manuel (à lancer dès demain, 0 frais fixes)

1. Le client paie (voir canaux ci-dessous).
2. Vous recevez la notification (SMS opérateur / e-mail Stripe-PayPal).
3. Vous générez la clé : `python3 tools/generer_cle.py month "client@email.com"`.
4. Vous envoyez la clé par e-mail/WhatsApp → le client l'active dans
   « 💳 Abonnement ». Délai réaliste : < 1 h en journée.

Configurez vos comptes réels dans `js/payments.js` (constante `PAY_CONFIG`) :
ils s'affichent automatiquement dans la modale « Abonnement » et sur l'écran
d'expiration.

### Canaux et comment les ouvrir

| Canal | Couvre | Prestataire à utiliser | Frais ≈ |
|---|---|---|---|
| **Mobile money** Orange Money, MTN MoMo, Airtel Money | Afrique de l'Ouest/Centrale/Est | Compte marchand opérateur, ou agrégateur **CinetPay**, **Flutterwave**, **PawaPay**, **FedaPay** (Bénin) | 1,5–3,5 % |
| **Visa / Mastercard** | Monde | **Stripe Payment Links** (aucun code : créer le lien sur stripe.com) ou l'agrégateur ci-dessus | 2,9 % + $0,30 |
| **PayPal** | Monde (diaspora ++) | paypal.me/VotreNom | ≈ 3,5 % |
| **Cryptomonnaie** | Monde, sans banque | Adresse USDT (TRC-20, frais quasi nuls) + BTC ; ou passerelle NOWPayments/BTCPay | 0–1 % |
| Virement / dépôt | Institutions | Facture PDF + RIB | 0 |

Conseil : commencez par **un agrégateur africain (CinetPay ou FedaPay)** — un
seul compte donne Orange + MTN + Airtel/Moov + cartes bancaires, avec une page de
paiement hébergée que vous mettez dans `PAY_CONFIG.aggregatorLink`. Ajoutez
PayPal pour la diaspora et Stripe quand vous aurez une structure juridique
éligible (via Atlas ou une filiale, Stripe ne couvrant pas tous les pays africains).

## 5. Étape 2 : livraison automatique des clés (quand > ~30 ventes/mois)

Un petit serveur (extension du modèle `server/sync-server.mjs`, ou une simple
fonction serverless) qui :
1. reçoit le **webhook** « paiement confirmé » de CinetPay/Stripe/PayPal ;
2. exécute la même logique HMAC que `tools/generer_cle.py` ;
3. envoie la clé par e-mail automatiquement.

≈ 100 lignes de code, hébergement $5/mois. À ce stade, ajouter aussi la
vérification en ligne optionnelle des clés (anti-partage) tout en gardant le
fonctionnement hors ligne pour les clients légitimes.

## 6. Prix de vente de l'application elle-même (si cession totale)

Si un acheteur (éditeur, université, ONG) voulait acheter **le logiciel entier
(code source + marque)** : une base raisonnable est 3–5 ans de profit espéré.
Avec un objectif conservateur de $30 000–60 000/an de ventes (voir
MARKETING.md), la fourchette de cession se situe autour de
**$90 000 – $250 000**, à négocier selon la traction réelle (utilisateurs
actifs, revenus récurrents prouvés). Sans traction démontrée, un acheteur ne
paiera que la valeur technique : ~$15 000–40 000. **Conclusion : vendez des
abonnements d'abord, la traction multiplie le prix de cession par 5–10.**
