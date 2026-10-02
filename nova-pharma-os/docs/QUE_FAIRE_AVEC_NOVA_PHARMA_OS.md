# Que voulez-vous faire avec NOVA PHARMA OS ?

**Pour Jacques Dunia.** Ce document ne parle ni de code ni de serveurs. Il
répond à une seule question : **vous avez construit quelque chose — qu'est-ce
que c'est, et qu'est-ce qu'on en fait ?**

---

## 1. Ce que vous avez, en une phrase

Vous avez **un logiciel de pharmacie que vous pouvez louer à plusieurs
pharmacies à la fois**, chacune ne voyant que ses propres données.

Ce n'est pas la même chose qu'un logiciel de pharmacie. C'est la différence
entre posséder une voiture et posséder une compagnie de taxis.

| Un logiciel de pharmacie | NOVA PHARMA OS |
|---|---|
| Sert une pharmacie | Sert autant de pharmacies que vous en signez |
| S'installe chez le client | Tourne à un seul endroit, tout le monde s'y connecte |
| Vous êtes payé une fois | Vous êtes payé chaque mois, par chaque cliente |
| Une correction = une visite chez chaque client | Une correction = tout le monde l'a en même temps |

---

## 2. Les trois choses que vous pouvez en faire

Elles ne s'excluent pas. La troisième est le but ; les deux premières y mènent.

### A. L'utiliser pour NOVA SANTÉ PHARMA (votre pharmacie)

C'est le point de départ, et c'est déjà une valeur en soi.

Le logiciel sait ce qui est cher à tenir à la main dans une officine :

- **Il sort toujours le lot qui périme le plus tôt** (règle FEFO). Ce n'est pas
  un détail : les périmés qu'on jette sont de l'argent déjà payé au
  fournisseur, perdu.
- **Il prévient avant la péremption**, pas après.
- **Il refuse de vendre un médicament sur ordonnance** sans le nom du patient
  et du prescripteur.
- **Il tient le crédit client** : qui doit quoi, depuis combien de temps, et il
  bloque quand le plafond est atteint.
- **Il ferme la caisse avec un écart calculé**, pas estimé.
- **Il enregistre qui a fait quoi**, ce qui règle les discussions.

Même si vous ne vendiez jamais ce logiciel à personne, cela vaudrait le travail
accompli.

### B. Le faire tourner pour deux ou trois pharmacies amies

L'étape que je vous recommande avant de parler d'entreprise.

Vous connaissez des confrères à Bukavu. Vous leur ouvrez un espace. Ils s'en
servent un mois, gratuitement. Vous apprenez alors trois choses que personne ne
peut vous dire à l'avance :

1. **Ce qui manque vraiment.** Pas ce que vous croyez qui manque : ce que trois
   pharmaciens différents réclament au bout de deux semaines.
2. **Ce que ça coûte de les accompagner.** Une pharmacie qui appelle six fois
   par semaine ne se facture pas comme une qui n'appelle jamais.
3. **Ce qu'ils accepteraient de payer.** La seule réponse qui compte, et elle
   ne se devine pas.

### C. En faire une entreprise d'abonnement

C'est le contenu du guide commercial (`GUIDE_COMMERCIAL.md`) : les forfaits, la
facturation, les relances, les étapes jusqu'à la première vente.

Le raisonnement tient en trois lignes :

> 10 pharmacies × 79 $/mois = **790 $ par mois**, soit 9 480 $ par an.
> Vos coûts, à cette taille : moins de 60 $ par mois.
> Ce qui reste finance votre temps, et le suivant.

**Le point qui décide de tout, c'est la fidélité.** Une cliente qui reste cinq
ans rapporte 4 740 $. La même qui part au bout de trois mois en rapporte 237 et
vous a coûté plus cher en installation. Toute votre attention doit aller là :
non pas à signer beaucoup, mais à ce que celles qui signent restent.

---

## 3. Ce que le logiciel sait déjà faire

Rien de cette liste n'est un projet : tout est écrit, testé, et vous pouvez le
voir tourner sur votre ordinateur dès aujourd'hui.

### Pour la pharmacie
- Catalogue de produits, molécules, catégories, prix d'achat et de vente
- Stock par lot avec dates de péremption, sortie automatique en FEFO
- Alertes : rupture, seuil bas, péremption proche, lot périmé
- Caisse : ouverture, encaissement, clôture avec écart
- Ventes au comptoir, ordonnances, remises, annulations
- Clients particuliers et professionnels, crédit avec plafond, balance âgée
- Achats fournisseurs et réceptions
- Commandes de gros (B2B), devis, livraisons avec preuve de remise
- Équipe, rôles et permissions (huit rôles livrés d'origine)
- Tableau de bord : ventes du jour, marge, stock valorisé, créances

### Pour vous, l'éditeur
- Liste de vos pharmacies clientes, leur forfait, leur état d'abonnement
- Facturation automatique des abonnements, relances des impayés
- Suspension d'une pharmacie qui ne paie pas — **elle garde l'accès en lecture**,
  ses données ne sont jamais prises en otage
- Support : demande d'accès à l'espace d'une cliente, **qu'elle doit approuver**,
  limitée dans le temps, et chaque geste est journalisé
- Forfaits et options modifiables sans toucher au code

### Ajouté cette semaine
- **Quinze langues**, dont le kiswahili de la RD Congo, le lingala, le
  kinyarwanda, le kirundi, le wolof et le bambara
- **Application mobile** installable sur le téléphone d'un vendeur ou d'un
  livreur, sans passer par une boutique d'applications
- **Reçus WhatsApp et SMS**, gratuits, envoyés depuis le téléphone du vendeur
- **Encaissement Mobile Money** avec référence de transaction et rapprochement

---

## 4. Ce qu'il ne sait pas faire, et qu'il faut savoir

Je préfère l'écrire noir sur blanc plutôt que vous laisser le découvrir devant
une cliente.

| Ce qui manque | Ce que ça change | Quand ça devient nécessaire |
|---|---|---|
| Pas d'hébergement en ligne | Vos clientes ne peuvent pas s'y connecter de chez elles | Dès la **première cliente payante** |
| Envoi SMS/WhatsApp non automatique | Le vendeur doit appuyer sur « envoyer » sur son téléphone | Quand le volume dépasse ~30 messages/jour |
| Mobile Money non branché aux opérateurs | Le vendeur saisit la référence à la main | Quand vous dépassez ~50 encaissements/jour |
| Dix des quinze langues non relues | Des tournures maladroites | Avant de démarcher hors de la RD Congo |
| Pas de lecteur de code-barres | On tape le nom du produit | Quand une pharmacie a plus de 2 000 références |
| Pas de mode hors ligne pour les ventes | Sans réseau, on ne vend pas | Si le courant ou le réseau coupe souvent |

**Aucun de ces manques n'empêche de tester avec votre équipe dès maintenant.**
Le premier est le seul qui bloque la vente à un tiers, et il coûte entre 7 et
26 $ par mois — quand vous aurez une cliente pour le justifier.

---

## 5. Ce que je vous conseille de faire, dans l'ordre

### Cette semaine — sur votre ordinateur, gratuitement
Suivez `GUIDE_DEMARRAGE.md`. Ouvrez l'application. Faites une vente. Regardez
le stock bouger. **Vous devez pouvoir le montrer à quelqu'un sans hésiter** :
c'est ce qui fera la différence devant un confrère.

### Les deux semaines suivantes — avec votre équipe
Réunissez vos vendeurs autour d'un ordinateur, sur le réseau Wi-Fi de
l'officine. Faites-les vendre pour de faux pendant une matinée. Notez tout ce
qui les gêne : un bouton mal placé, un mot mal traduit, une étape de trop.

Ce que vous cherchez, ce ne sont pas des félicitations. **Ce sont les
frottements.** Un vendeur qui hésite trois secondes devant un écran hésitera
trois secondes cent fois par jour.

### Le mois d'après — une pharmacie amie
Une seule, choisie parce que son gérant vous dira la vérité. Gratuitement,
pendant un mois. Vous apprendrez plus en quatre semaines qu'en six mois de
réflexion.

### Ensuite seulement — payer un hébergement
Quand une pharmacie vous dit « je veux continuer, combien ? », alors, et
seulement alors, cela vaut la peine de dépenser 26 $ par mois.

---

## 6. Ce à quoi ce logiciel doit vous servir personnellement

Il y a une réponse plus large que « gagner de l'argent ».

Une pharmacie mal tenue perd de l'argent de trois façons : elle jette des
médicaments périmés, elle est en rupture de ce que les gens viennent chercher,
et elle ne récupère jamais certaines créances. Ces trois pertes sont
silencieuses — elles n'apparaissent sur aucune facture.

À Bukavu, ce ne sont pas seulement des pertes comptables. **Une rupture, c'est
un malade qui repart sans son traitement.**

Un logiciel qui sort le bon lot, prévient avant la péremption et dit qui doit
quoi ne rend pas une pharmacie riche du jour au lendemain. Il fait quelque chose
de plus modeste et de plus solide : **il empêche les erreurs qu'on ne voit
pas.**

C'est ce que vous avez entre les mains. Le reste — les forfaits, les clientes,
la facturation — n'est que la façon de le faire vivre.

---

## En résumé

| Question | Réponse |
|---|---|
| **Qu'est-ce que j'ai ?** | Un logiciel de pharmacie louable à plusieurs pharmacies |
| **Ça marche ?** | Oui, sur votre ordinateur, gratuitement, aujourd'hui |
| **Qu'est-ce qui manque ?** | L'hébergement en ligne, pour qu'un tiers s'y connecte |
| **Ça coûte combien ?** | 0 $ pour tester · 7 à 26 $/mois en ligne |
| **Je fais quoi maintenant ?** | Vous l'ouvrez, vous le montrez à votre équipe, vous notez ce qui gêne |
| **Et après ?** | Une pharmacie amie, gratuitement, un mois |
| **Quand est-ce que je paie ?** | Quand quelqu'un vous demande combien ça coûte |

---

*Documents liés : `../GUIDE_DEMARRAGE.md` pour l'installation,
`GUIDE_COMMERCIAL.md` pour les chiffres et la facturation,
`ARCHITECTURE.md` pour la construction technique.*
