# NOVA PHARMA OS — comprendre votre affaire

**Pour Jacques Dunia, propriétaire de NOVA PHARMA OS.**

Ce document répond à quatre questions : comment fonctionne ce commerce, ce qu'il
coûte, comment vous facturez vos clientes, et par où commencer.

> **Sur les prix cités.** Ce sont des ordres de grandeur, pas des devis. Les tarifs
> d'hébergement, de SMS et de Mobile Money changent souvent et varient d'un pays et
> d'un opérateur à l'autre. **Vérifiez chaque chiffre auprès du fournisseur** avant
> de fonder une décision dessus. Ceux marqués « à confirmer » sont ceux dont je suis
> le moins sûr.

---

## 1. Ce que vous vendez, exactement

Vous ne vendez pas un logiciel. **Vous louez un service.**

La différence est capitale pour votre trésorerie :

| Vendre un logiciel | Louer un service (SaaS) |
|---|---|
| La pharmacie paie une fois, 2 000 $ | La pharmacie paie 79 $ chaque mois |
| Vous encaissez beaucoup, une seule fois | Vous encaissez peu, mais tous les mois |
| Au bout de 2 ans : 2 000 $ | Au bout de 2 ans : 1 896 $ |
| Au bout de 5 ans : 2 000 $ | Au bout de 5 ans : **4 740 $** |
| Le client peut partir sans que ça change rien | Le client qui part arrête de payer |

Le modèle par abonnement est plus lent au début et bien plus rentable ensuite —
**à condition de garder vos clientes**. C'est pour cela que le logiciel surveille le
taux de résiliation : c'est l'indicateur qui décide de votre avenir.

### Ce que la pharmacie obtient pour son abonnement

- Son espace privé, invisible des autres pharmacies
- La gestion de son stock, de ses lots et de ses péremptions
- Sa caisse, ses ventes, ses clients, ses fournisseurs
- Ses sauvegardes
- Le support

### Ce que vous obtenez, vous

- Un revenu qui tombe chaque mois sans nouvelle vente
- Un logiciel qui s'améliore pour toutes vos clientes à la fois
- Une valeur d'entreprise : une affaire à 50 pharmacies × 79 $ se revend

---

## 2. Ce que ça vous coûte

### Aujourd'hui, en phase de test : **0 $**

L'installation décrite dans [`GUIDE_DEMARRAGE.md`](../GUIDE_DEMARRAGE.md) ne coûte
rien. Vous pouvez tester avec votre équipe aussi longtemps que vous voulez.

### Quand une vraie pharmacie devient cliente

Il faut alors un ordinateur allumé en permanence sur internet — vous ne pouvez pas
demander à une pharmacie de Goma de dépendre de votre ordinateur portable.

| Poste | Coût mensuel estimé | Remarque |
|---|---|---|
| Serveur (VPS) | **5 à 20 $** | Hetzner à partir de ~5 €, Contabo, OVH. Un petit serveur suffit pour les premières pharmacies. |
| Nom de domaine | **~1 $** | ~12 $ par an pour `novapharmaos.com` |
| Sauvegardes externes | **1 à 5 $** | Espace de stockage. Indispensable. |
| **Total pour démarrer** | **7 à 26 $ par mois** | |

**Votre première cliente à 79 $ par mois couvre déjà tous ces frais.** À partir de la
deuxième, vous gagnez de l'argent. C'est le point important de tout ce document.

### Trois fonctions qui marchent déjà, sans rien payer

Ce point a changé : ce qui figurait ici comme « plus tard, quand vous aurez un
compte » **fonctionne aujourd'hui**, dans une version gratuite qui rend le même
service au comptoir.

| Fonction | Comment elle marche gratuitement | Ce que ça vous coûte |
|---|---|---|
| **Reçus WhatsApp** | L'application prépare le message et ouvre WhatsApp sur le téléphone du vendeur ; il appuie sur envoyer | **0 $** — c'est son forfait, pas le vôtre |
| **SMS** | Même principe, avec l'application SMS du téléphone | **0 $** |
| **Encaissement Mobile Money** | Le client compose le code de l'opérateur, le vendeur saisit la référence de transaction | **0 $** de votre côté ; la commission de l'opérateur est prélevée comme d'habitude |
| **Application mobile** | S'installe depuis le navigateur, « Ajouter à l'écran d'accueil » | **0 $** — ni Play Store, ni App Store, ni compte développeur |

C'est un argument de vente, pas seulement une économie : vous pouvez montrer un
reçu WhatsApp arriver sur le téléphone d'un pharmacien pendant la démonstration,
sans avoir ouvert le moindre compte.

### Ce qui reste payant, et quand ça le devient

| Service | Ce que ça coûte | Quand ça vaut la peine |
|---|---|---|
| **Passerelle SMS** | ~0,02 à 0,05 $ par message *(à confirmer)* | Au-delà de ~30 messages par jour, quand ouvrir l'écran à chaque fois devient pénible |
| **WhatsApp Business** | ~0,01 à 0,09 $ par conversation *(à confirmer)* | Idem, ou si vous voulez des rappels automatiques la nuit |
| **Intégration Mobile Money** | ~1 à 3 % de chaque transaction *(à confirmer)*, en plus de la commission habituelle | Au-delà de ~50 encaissements par jour, quand la saisie manuelle coûte plus cher que la commission |

Chacun exige un compte d'entreprise et des démarches administratives : compte
chez un agrégateur (Africa's Talking, Twilio), compte Meta Business vérifié,
compte marchand chez M-Pesa, Airtel Money ou Orange Money — ce dernier **exige
une entreprise enregistrée**.

**Mon conseil : n'y touchez pas maintenant.** La version gratuite fait le travail
tant que vous avez moins d'une dizaine de pharmacies. Et le passage à la version
payante ne fait rien perdre : les messages et les encaissements déjà enregistrés
restent dans le même journal, au même endroit.

---

## 3. Comment vous facturez vos pharmacies clientes

Le logiciel fait ce travail à votre place. Voici ce qui se passe, dans l'ordre.

### Le parcours d'une cliente

```
    Vous rencontrez une pharmacie
              ↓
    Vous créez son compte dans le back-office
    (un formulaire, deux minutes)
              ↓
    ESSAI GRATUIT — 14 jours
    Elle utilise tout, sans payer
              ↓
    Le 14e jour, le logiciel émet la facture, tout seul
              ↓
    ┌─────────────────┬──────────────────────┐
    │  Elle paie      │  Elle ne paie pas    │
    │       ↓         │         ↓            │
    │  Compte ACTIF   │  Relance à J+1       │
    │  Elle repaie    │  Relance à J+7       │
    │  chaque mois    │  Relance à J+14      │
    │                 │         ↓            │
    │                 │  SUSPENSION          │
    │                 │  Elle voit toujours  │
    │                 │  ses données, mais   │
    │                 │  ne peut plus rien   │
    │                 │  modifier            │
    │                 │         ↓            │
    │                 │  Elle paie →         │
    │                 │  tout revient        │
    └─────────────────┴──────────────────────┘
```

**Ce que vous faites à la main :** créer le compte, encaisser l'argent, saisir le
paiement reçu.
**Ce que le logiciel fait seul :** facturer, relancer, suspendre, réactiver.

### Le point qui rassure vos clientes

Une pharmacie suspendue pour impayé **ne perd rien**. Elle continue de voir son stock,
ses ventes, ses clients — elle ne peut simplement plus rien saisir. Dès qu'elle paie,
tout redevient normal à la seconde.

Dites-le clairement à vos prospects : c'est la première inquiétude d'un pharmacien qui
confie son stock à un logiciel.

### Vos quatre formules

| Formule | Pour qui | Prix indicatif | Utilisateurs | Points de vente |
|---|---|---|---|---|
| **Starter** | Petite officine | 29 $/mois | 3 | 1 |
| **Professional** | Pharmacie structurée | 79 $/mois | 10 | 2 |
| **Business** | Semi-grossiste | 199 $/mois | 30 | 5 |
| **Enterprise** | Réseau, grossiste | Sur devis | Sur mesure | Sur mesure |

**Ces prix sont modifiables** depuis votre back-office, menu *Forfaits et options*.
Changez-les selon ce que le marché de Bukavu supporte : vous connaissez vos confrères
mieux que quiconque.

Vous vendez aussi **16 options** à la carte — utilisateur supplémentaire, WhatsApp,
pack SMS, application livreur… Chacune s'ajoute automatiquement à la facture.

### Comment vous encaissez

Au début, le plus simple est le mieux :

1. La pharmacie vous paie **en espèces, par Mobile Money ou par virement**
2. Vous ouvrez le back-office, menu *Facturation*
3. Vous saisissez le paiement reçu
4. Le logiciel rapproche la facture et réactive le compte s'il était suspendu

Vous n'avez **pas besoin** d'une intégration Mobile Money pour encaisser. Vous en
aurez besoin le jour où saisir les paiements à la main vous prendra trop de temps —
c'est-à-dire vers vingt ou trente clientes.

---

## 4. Vos étapes jusqu'à la première vente

### Étape 1 — Utilisez-le vous-même (2 à 4 semaines)

Faites tourner **votre propre pharmacie** dessus, pour de vrai. Pas une simulation :
vos vrais produits, vos vraies ventes, votre vraie caisse.

C'est l'étape que personne ne veut faire et qui décide de tout. Vous découvrirez en
deux semaines ce qu'aucune réunion ne vous dirait : ce qui manque, ce qui agace, ce
qui fait gagner du temps.

Notez tout. Ces notes valent plus que n'importe quel cahier des charges.

### Étape 2 — Une deuxième pharmacie, gratuitement (1 à 2 mois)

Trouvez **un confrère qui vous fait confiance**. Offrez-lui six mois gratuits en
échange de sa franchise.

Vous cherchez la réponse à une seule question : **est-ce que quelqu'un d'autre que
moi arrive à s'en servir ?** Un logiciel que seul son auteur sait utiliser n'est pas
un produit.

### Étape 3 — Mettez-le en ligne (1 semaine, ~20 $/mois)

C'est le moment de payer l'hébergement — pas avant. Vous savez maintenant que le
produit tient debout.

### Étape 4 — Vendez à trois pharmacies (2 à 3 mois)

**Trois**, pas trente. Vous cherchez encore à apprendre, pas à grandir.

Ce que vous vendez n'est pas un logiciel, c'est la fin d'un problème :
- « Combien de boîtes avez-vous jetées le mois dernier parce qu'elles étaient périmées ? »
- « Savez-vous, ce soir, combien votre stock vaut ? »
- « Combien vos clients à crédit vous doivent-ils en ce moment ? »

Un pharmacien qui ne sait répondre à aucune de ces questions comprend immédiatement
ce que vous vendez.

**Prévoyez la formation.** Une pharmacie qui ne sait pas se servir du logiciel
l'abandonne au bout de six semaines — et vous perdez un abonnement.

### Étape 5 — Alors seulement, grandissez

Avec trois clientes qui paient et qui restent, vous avez une affaire. Vous pouvez
recruter, ouvrir d'autres villes, ajouter le WhatsApp et le Mobile Money.

---

## 5. Ce qu'il faut regarder chaque mois

Votre back-office calcule ces chiffres tout seul. Trois comptent vraiment :

| Indicateur | Où le voir | Ce qu'il vous dit |
|---|---|---|
| **Revenu mensuel récurrent** | Tableau de bord | Ce qui rentre chaque mois sans rien vendre de neuf |
| **Taux de résiliation** | Tableau de bord | Le seul chiffre qui peut tuer l'affaire. Au-dessus de 5 % par mois, arrêtez de vendre et allez comprendre pourquoi elles partent. |
| **Conversion essai → payant** | Tableau de bord | En dessous de 30 %, votre essai gratuit ne convainc pas : accompagnez mieux |

**Une résiliation coûte bien plus cher qu'une vente ne rapporte.** Gagner une cliente
demande des semaines ; la perdre prend un mois d'inattention.

---

## 6. Les questions que vous vous posez sans doute

**« Puis-je vendre sans être une entreprise enregistrée ? »**
Pour encaisser en espèces entre confrères, en pratique oui. Pour émettre des factures
en règle, ouvrir un compte marchand Mobile Money ou signer avec une clinique, non.
L'enregistrement devient nécessaire vers la troisième ou quatrième cliente.

**« Et si une pharmacie perd ses données ? »**
Le logiciel sauvegarde chaque pharmacie séparément et sait en restaurer une seule sans
toucher aux autres. C'est vérifié par un test automatique. Configurez malgré tout une
copie hors du serveur : une sauvegarde stockée au même endroit que les données n'en
est pas une.

**« Une pharmacie peut-elle voir les données d'une autre ? »**
Non, et ce n'est pas qu'une promesse : la séparation est imposée par la base de
données elle-même, pas seulement par le code. Même une erreur de programmation ne la
ferait pas tomber. Vous pouvez l'affirmer sans réserve à vos prospects.

**« Et si je ne peux pas payer l'hébergement un mois ? »**
Le serveur s'arrête, les pharmacies n'ont plus accès. **Gardez toujours deux mois
d'hébergement d'avance.** C'est vingt dollars qui protègent votre réputation.

**« Combien de temps avant de vivre de ça ? »**
Avec 30 clientes à 79 $, vous êtes à ~2 370 $ par mois de revenu brut. Y arriver
demande, réalistement, **deux à trois ans**. Quiconque vous promet plus vite vous
vend quelque chose.

---

## En résumé

- **Aujourd'hui**, tester ne coûte rien.
- **Votre première cliente** paie tous vos frais.
- **La partie difficile** n'est pas le logiciel — il est fait. C'est de trouver trois
  pharmacies qui paient et qui restent.
- **Ne payez rien** tant que vous n'avez pas la preuve qu'un confrère se sert du
  logiciel sans vous.
