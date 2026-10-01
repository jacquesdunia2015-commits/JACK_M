# Démarrer NOVA PHARMA OS — guide pas à pas

**Gratuit. Sur votre propre ordinateur. Accessible depuis les téléphones de votre équipe.**

Ce guide s'adresse à une personne qui n'est pas informaticienne. Suivez les étapes
dans l'ordre. Comptez **20 à 40 minutes la première fois**, puis **une minute** les
fois suivantes.

---

## Avant de commencer : ce que vous devez savoir

NOVA PHARMA OS **n'est pas** un fichier qu'on ouvre par double-clic, comme QualiCode.
C'est un logiciel qui a besoin d'un ordinateur allumé pour fonctionner — comme la
caisse d'un supermarché ou le logiciel d'une banque.

Cela veut dire :

- **Un ordinateur joue le rôle de serveur.** Le vôtre. Il doit rester allumé pendant
  que votre équipe utilise l'application.
- **Les téléphones s'y connectent par le Wi-Fi.** Ils doivent être sur le **même
  réseau Wi-Fi** que cet ordinateur.
- **Quand vous éteignez l'ordinateur, l'application s'arrête.** Vos données restent
  enregistrées ; elles reviennent au prochain démarrage.

C'est parfait pour **tester avec votre équipe** sans rien dépenser. Ce n'est pas
suffisant pour vendre à de vraies pharmacies éloignées — pour cela, il faudra un
hébergeur, et cela coûtera de l'argent. Ce guide ne traite que de la phase de test.

---

## Étape 1 — Installer Node.js (une seule fois)

Node.js est le moteur qui fait tourner l'application. C'est gratuit.

1. Ouvrez le site **https://nodejs.org**
2. Cliquez sur le gros bouton vert marqué **« LTS »** (la version recommandée)
3. Ouvrez le fichier téléchargé
4. Cliquez **Suivant** à chaque étape, sans rien changer
5. Cliquez **Terminer**

> **Comment savoir si ça a marché ?**
> L'étape 3 vous le dira. Si Node.js manque, l'application vous l'écrira en clair.

---

## Étape 2 — Récupérer NOVA PHARMA OS

1. Ouvrez **https://github.com/jacquesdunia2015-commits/JACK_M**
2. Choisissez la branche **`claude/nova-pharma-saas-specs-bzcesi`**
   *(bouton gris en haut à gauche, marqué « main » ou « branch »)*
3. Cliquez le bouton vert **« Code »**, puis **« Download ZIP »**
4. Ouvrez le fichier ZIP téléchargé et **extrayez-le** dans un dossier facile à
   retrouver — par exemple sur le **Bureau**

Vous obtenez un dossier contenant un sous-dossier **`nova-pharma-os`**.
C'est celui-là qui nous intéresse.

---

## Étape 3 — Démarrer l'application

Entrez dans le dossier **`nova-pharma-os`**, puis :

### Sur Windows
Double-cliquez sur **`DEMARRER-WINDOWS.bat`**

> Si Windows affiche un avertissement bleu « Windows a protégé votre ordinateur » :
> cliquez sur **« Informations complémentaires »**, puis **« Exécuter quand même »**.
> Cet avertissement apparaît pour tout fichier téléchargé d'internet.

### Sur Mac
Double-cliquez sur **`demarrer-mac.command`**

> Si le Mac refuse en disant que le fichier vient d'un développeur non identifié :
> faites un **clic droit** sur le fichier, choisissez **« Ouvrir »**, puis
> confirmez **« Ouvrir »**.

### Sur Linux
Ouvrez un terminal dans le dossier et tapez :
```
./demarrer-linux.sh
```

---

## Étape 4 — Attendre

Une fenêtre noire s'ouvre et affiche l'avancement :

```
[1/6] Vérification des dépendances
[2/6] Démarrage de la base de données
[3/6] Configuration
[4/6] Préparation des données
[5/6] Construction de l'application
[6/6] Démarrage des serveurs
```

**La première fois, c'est long** — l'ordinateur télécharge et prépare tout ce qu'il
faut. Comptez 20 à 40 minutes selon votre connexion internet. **Ne fermez pas la
fenêtre.** Laissez-la travailler.

Les fois suivantes, tout est déjà prêt : le démarrage prend moins d'une minute.

Quand c'est terminé, vous lisez :

```
════════════════════════════════════════════
  L'APPLICATION EST PRÊTE
════════════════════════════════════════════

  Sur cet ordinateur :
    http://localhost:3000

  Sur les téléphones du même Wi-Fi :
    http://192.168.1.42:3000
```

---

## Étape 5 — Ouvrir l'application

### Sur l'ordinateur
Ouvrez votre navigateur (Chrome, Firefox, Edge) et tapez :

```
http://localhost:3000
```

### Sur un téléphone
1. Vérifiez que le téléphone est sur **le même Wi-Fi** que l'ordinateur
2. Ouvrez le navigateur du téléphone
3. Tapez l'adresse affichée par la fenêtre noire — celle qui commence par
   **`http://192.168.`** — par exemple `http://192.168.1.42:3000`

> **Astuce.** Cette adresse est longue à retaper. Une fois la page ouverte sur le
> téléphone, utilisez **« Ajouter à l'écran d'accueil »** dans le menu du navigateur :
> une icône apparaîtra, comme pour une vraie application.

---

## Étape 6 — Se connecter

Deux pharmacies sont créées automatiquement, et c'est voulu : l'une reçoit
vos vraies données, l'autre sert à s'exercer sans rien casser.

### NOVA SANTÉ PHARMA — votre officine

C'est **votre** pharmacie, celle de Bukavu. Trois comptes sont prêts :

| Qui | Adresse | Mot de passe |
|---|---|---|
| Gérant | `gerant@nova-sante-pharma.cd` | `NovaSante2026!` |
| Vendeur | `vendeur@nova-sante-pharma.cd` | `Vendeur2026!` |
| Livreur | `livreur@nova-sante-pharma.cd` | `Livreur2026!` |

Le vendeur et le livreur sont faits pour l'**application mobile** : ouvrez
`http://…:3000/mobile` sur leur téléphone.

Vous y trouvez un catalogue de 18 produits courants d'une officine de Bukavu,
et **un stock à zéro**. Ce n'est pas un oubli : un stock inventé vous ferait
vendre des boîtes qui ne sont pas sur l'étagère. Le stock se remplit à votre
premier achat réel — voir « Vos premiers gestes » plus bas.

### Pharmacie de démonstration — pour s'exercer

| | |
|---|---|
| Adresse | `gerant@pharmacie-demo.cd` |
| Mot de passe | `Pharmacie2026!` |

Celle-ci a déjà 8 produits, du stock réparti sur des lots, 4 ventes passées,
2 clients et une alerte de péremption. Servez-vous-en pour former l'équipe :
une erreur ici n'a aucune conséquence.

Les deux pharmacies ne se voient pas l'une l'autre. Une vente d'exercice
n'apparaîtra jamais dans les comptes de NOVA SANTÉ PHARMA.

### Pour tester comme l'éditeur (vous)
En bas de la page de connexion, cliquez **« Back-office NOVA PHARMA OS »**.

| | |
|---|---|
| Adresse | `admin@novapharmaos.com` |
| Mot de passe | `NovaPharma2026!` |

Vous voyez vos pharmacies clientes, leurs abonnements, votre revenu mensuel.

> ⚠️ **Ces mots de passe sont publics** — ils sont écrits dans ce guide. Ils
> conviennent pour tester entre vous. Le jour où de vraies données de patients ou
> d'argent entreront dans le système, il faudra les changer.

---

## Vos premiers gestes dans NOVA SANTÉ PHARMA

Connectez-vous en **gérant**, puis, dans cet ordre :

**1. Complétez le catalogue.** Le plus rapide : *Catalogue* →
**Catalogue de référence Goma–Bukavu** → *Choisir et ajouter*. Cent médicaments
et produits courants au Kivu (voir plus bas) s'ajoutent en un clic. Pour un
produit absent de cette liste, ouvrez *Catalogue*, puis **Ajouter un produit
ou un médicament** : le nom, le dosage, la forme, le conditionnement, le prix
de vente et le prix d'achat habituel. La référence est tirée du nom si vous la
laissez vide. Cochez *Périssable* pour tout ce qui a une date de péremption, et
*Délivré sur ordonnance* quand c'est le cas. Pour corriger un produit plus tard
(son prix surtout), ouvrez sa fiche (cliquez sur son nom) : **Modifier le
produit** change le nom, le dosage, les prix, le seuil de réapprovisionnement,
l'alerte de péremption ; **Archiver le produit** le retire de la caisse et du
catalogue sans effacer son historique.

**2. Enregistrez un achat.** Ouvrez *Stock et lots*, puis **Enregistrer un
achat (entrée en stock)**. Prenez une facture réelle et saisissez-la ligne par
ligne : chaque produit, la **quantité achetée**, le prix d'achat, le **numéro
de lot** et la **date de péremption**. *Ajouter un produit à cet achat* ajoute
une ligne ; le total s'affiche en bas. Le fournisseur est facultatif : sans
lui, l'achat est rangé dans « achats divers ». C'est ce geste qui crée le
stock, dans tous les forfaits. L'application refuse un produit périssable
sans date de péremption, et un double clic n'enregistre jamais l'achat deux
fois.

**3. Faites une vente.** Ouvrez *Caisse*. Le stock que vous venez de recevoir
apparaît. À la sortie, l'application prend d'elle-même le lot qui périme le
plus tôt : vous n'avez rien à surveiller.

**4. Suivez ce qui entre et ce qui sort.** Dans *Stock et lots*, les colonnes
*Acheté (30 j)* et *Vendu (30 j)* donnent les quantités du mois. Cliquez sur le
nom d'un produit : sa fiche montre le total acheté, le total vendu, les autres
mouvements (casse, périmés, inventaire) et chaque mouvement, avec la date, le
lot et la personne. Le stock affiché est exactement la somme de ces lignes.

À partir de là, l'officine tourne. Le reste — clients à crédit, livraisons,
rappels WhatsApp, encaissement Mobile Money — s'ajoute quand vous en avez
besoin.

---

## Le catalogue de référence Goma–Bukavu

Menu *Catalogue* → **Catalogue de référence Goma–Bukavu** (tous les forfaits).

Cent médicaments et produits que l'on retrouve dans presque toutes les
officines du Nord et du Sud-Kivu, rangés en seize familles : antipaludiques
(artéméther-luméfantrine adulte et enfant, ASAQ, artésunate injectable,
quinine…), antibiotiques, douleur et fièvre, vermifuges, SRO et zinc,
estomac, toux et allergie, vitamines et fer, tension, diabète, peau, yeux,
santé de la femme et planning familial, solutés, consommables de soins et
tests rapides du paludisme.

La sélection s'appuie sur la Liste nationale des médicaments essentiels de la
RD Congo et sur les demandes les plus fréquentes au comptoir. Chaque produit
arrive complet : nom, DCI, forme, conditionnement, unité de vente (plaquette,
flacon, ampoule…), famille, et les repères *sur ordonnance*, *stupéfiant* ou
*chaîne du froid*.

**1.** Tout est coché d'office. Filtrez par famille et décochez ce que vous ne
vendez pas.

**2.** Vérifiez les prix. Ceux proposés sont **indicatifs, en dollars** : un
ordre de grandeur de la région, à remplacer par les vôtres. Si votre pharmacie
compte en francs congolais, les prix indicatifs ne sont pas repris : saisissez
votre prix de vente pour chaque produit coché.

**3.** *Ajouter … produit(s) à mon catalogue*. Un produit déjà présent (même
référence ou même nom) n'est jamais créé deux fois.

Il reste ensuite à enregistrer leur stock, comme pour tout produit (*Stock et
lots* → *Enregistrer un achat*).

## Établir, imprimer et partager la facture d'un client

Menu *Factures* (tous les forfaits). Une vente a toujours son reçu. La
**facture** se fait à la demande du client : pour son assurance, son employeur,
ou simplement pour la garder.

**À la caisse, juste après la vente.** Sous le message « Vente … enregistrée »,
ouvrez **Établir la facture de la vente**. Tapez le nom et le téléphone du
client :

- s'il est **déjà dans votre fichier**, il vous est proposé dès les premières
  lettres ou chiffres : cliquez dessus ;
- sinon, il y est **ajouté** automatiquement. S'il revient avec son numéro écrit
  autrement (« 0991 234 567 » ou « +243 991-234-567 »), il est reconnu ;
- sans nom, la facture est établie pour un **client comptant**.

**Plus tard.** Menu *Factures* → *Ventes récentes* → **Établir la facture**
sur la bonne vente.

La facture reçoit son numéro (FA-2026-000001…). Elle s'ouvre avec les mêmes
boutons que les réquisitions :

- **Ouvrir le PDF / imprimer** : la facture au logo de la pharmacie, avec le
  client, chaque article avec son lot et sa date d'expiration, le total TTC,
  le règlement, la monnaie rendue et le reste à payer. Un tampon indique
  « PAYÉE » ou « ANNULÉE ». Le bas de page porte « Servi par » et une place
  pour le cachet ;
- **Partager le PDF** : depuis le téléphone, directement par WhatsApp, e-mail…
- **WhatsApp** et **E-mail** : un message au client, le montant déjà écrit.

Une vente n'a qu'**une** facture : la redemander rouvre la même. Une vente à
crédit est facturée d'office. Sa facture montre ce qui reste dû et son
échéance, selon le délai de crédit du client. Une vente annulée ne peut plus
être facturée, et sa facture passe « annulée ».

Pour retrouver les factures d'un client : *Clients* → lien **Factures** sous
son nom, ou la recherche de la page *Factures* (numéro, nom ou téléphone).

---

## Enregistrer vos fournisseurs et leurs prix

Menu *Fournisseurs* (dans tous les forfaits, même Starter).

**1. Enregistrez le dépôt.** Au bas de la page, *Enregistrer un fournisseur* :
son nom et son **téléphone** suffisent. Ajoutez si vous l'avez son adresse
e-mail, son **pays**, sa **ville**, son adresse, la personne à contacter et
son délai de livraison. Tapez le numéro comme vous le composez : pour un dépôt
de Kampala, choisissez *Ouganda* et l'application ajoute +256 d'elle-même.
Deux fournisseurs ne peuvent pas avoir le même numéro : c'est presque toujours
le même dépôt saisi deux fois.

**2. Notez ce qu'il propose et à quel prix.** Sur la fiche du fournisseur,
*Produits et prix* : le nom du produit ou du médicament, sa présentation
(« boîte de 100 gélules »), le prix, la devise, la quantité minimum, et les
**dates de fabrication et d'expiration** du lot qu'il vous annonce. Le
produit n'a pas besoin d'être déjà dans votre catalogue ; s'il y est, choisissez-le
dans la liste qui s'affiche pendant la frappe.

- **Modifier**, sur une ligne, change le prix et les dates ; la date du prix
  se met à jour.
- La date d'expiration prend la même couleur que dans votre stock (voir
  *Lire les couleurs du stock*). L'application refuse une expiration
  antérieure à la fabrication, ou une fabrication dans le futur.
- Cliquez sur **Disponible** / **En rupture** quand le dépôt vous signale un
  manque.
- À chaque **réception** de marchandise, le prix réellement payé et la date
  d'expiration du lot reçu remplacent les anciens, sans rien ressaisir.

**3. Comparez.** En haut de la page *Fournisseurs*, tapez le nom d'un produit :
tous les dépôts qui le proposent s'affichent, le moins cher d'abord. **Le moins
cher de ceux qui l'ont en stock** est surligné en vert — un dépôt en rupture,
ou dont le produit est **périmé**, ne compte pas, même s'il est moins cher. Les
dates de fabrication et d'expiration de chaque offre s'affichent à côté du prix :
à prix égal, préférez la date la plus éloignée. On ne compare que des prix dans
la même devise.

La recherche ignore les accents : « metro » trouve « Métronidazole ».

Depuis la liste, le numéro de chaque dépôt s'appelle d'un clic, ou ouvre
WhatsApp pour lui passer commande.

---

## Réquisitionner auprès de vos fournisseurs

Menu *Réquisitions* (tous les forfaits).

**1. Mettez votre logo, une fois pour toutes.** En bas de la page, *Logo de la
pharmacie* : une image PNG ou JPEG de 500 Ko au plus, carrée de préférence. Elle
s'imprime en tête de chaque réquisition.

**2. Créez la réquisition.** *Nouvelle réquisition* : pour chaque produit, tapez
son nom et la quantité voulue. Les offres de vos fournisseurs s'affichent
aussitôt sous la ligne, **la moins chère d'abord** — parmi celles qui sont
disponibles et non périmées — avec la quantité minimum et la date d'expiration.
L'application retient d'office la moins chère ; cliquez sur une autre offre pour
la préférer. Si vous demandez moins que le minimum du fournisseur, elle vous le
signale. Un produit sans offre peut attendre : « à choisir plus tard ».

**3. Envoyez-la.** La page de la réquisition présente une section par
fournisseur, avec son total estimé et quatre boutons :

- **Ouvrir le PDF / imprimer** : le bon au logo de la pharmacie, avec les
  coordonnées du fournisseur, les quantités, les prix de son catalogue et une
  place pour la signature et le cachet ;
- **Partager le PDF** : depuis un téléphone, l'envoie directement par WhatsApp,
  e-mail ou toute autre application ; depuis un ordinateur, l'enregistre pour
  le joindre à votre message ;
- **WhatsApp** et **E-mail** : ouvrent un message au fournisseur, la liste des
  produits déjà écrite.

*Document complet* réunit tous les fournisseurs, un par page. Marquez ensuite la
réquisition **envoyée**, puis **reçue** ; à la livraison, enregistrez l'achat dans
*Stock et lots* comme d'habitude.

## Les fournisseurs de chaque médicament

Sur la fiche d'un produit (cliquez sur son nom dans *Stock et lots* ou
*Catalogue*), la section **Fournisseurs de ce produit** compare les prix de tous
les dépôts qui le proposent, avec minimum, fabrication, expiration et
disponibilité ; le moins cher disponible et non périmé est surligné. Le
formulaire en dessous ajoute un fournisseur pour ce produit, ou met à jour son
prix. Le bouton **Réquisitionner** ouvre une réquisition avec ce produit.

Chaque achat mis en stock garde son fournisseur : la colonne *Dernier
fournisseur* de *Stock et lots* et la colonne *Fournisseur* des mouvements de la
fiche le montrent.

## Commander à un fournisseur et réceptionner la livraison

Menu *Achats*. Pour un achat payé et livré sur-le-champ, *Stock et lots* →
*Enregistrer un achat* suffit ; la commande sert quand la marchandise arrive
plus tard, ou en plusieurs fois.

**1. Partez des suggestions.** En haut de la page, les produits qui vont
manquer sont groupés par fournisseur : **Commander chez …** ouvre une commande
déjà remplie, avec les quantités proposées. Sinon, **Nouvelle commande
fournisseur** part d'une page blanche.

**2. Vérifiez la commande.** Choisissez le fournisseur, puis chaque produit et
sa quantité. Le prix unitaire est repris de **son catalogue** quand il y figure,
sinon du prix d'achat habituel du produit ; il reste modifiable. *Créer la
commande* l'enregistre en **brouillon**.

**3. Transmettez-la.** Envoyez-la au fournisseur comme d'habitude (téléphone,
WhatsApp, réquisition PDF), puis **Marquer comme transmise au fournisseur**.

**4. Réceptionnez.** À la livraison, ouvrez la commande : chaque produit
propose la quantité qui reste à recevoir. Corrigez-la si le fournisseur livre
moins, saisissez le **lot** et la **date de péremption** (obligatoires pour un
médicament qui périme) et, si vous l'avez, le numéro de sa facture.
**Enregistrer la réception** fait entrer la marchandise en stock aussitôt. La
commande passe « reçue en partie » — le reste reste proposé pour la livraison
suivante — puis « reçue ». La liste des réceptions garde chaque livraison.

## Vendre aux professionnels : commandes et devis

Menu *Commandes B2B*, pour les cliniques, ONG et autres pharmacies enregistrées comme
**clients professionnels** (*Clients* → *Ajouter un client* → professionnel).

**1. Établissez un devis ou une commande.** **Nouvelle commande ou devis** :
choisissez le document, le client, puis les produits. Le prix proposé est le
**prix de gros** du produit (à défaut son prix de vente), avec une remise en %
par ligne si vous le souhaitez. Une commande se règle **comptant à la
livraison** ou **à crédit**, dans la limite du plafond du client. Un
médicament sur ordonnance peut être livré à un professionnel sans ordonnance
de patient ; au comptoir, l'ordonnance reste exigée.

**2. Faites-la avancer.** Sur la page de la commande : *Confirmer*, *Mettre en
préparation*, *Marquer prête* — ou *Annuler*.

**3. Livrez et facturez.** **Livrer et facturer** sort les produits du stock
(lots qui périment le plus tôt d'abord) et établit la facture. Au comptant,
choisissez le moyen de règlement (espèces, Mobile Money avec sa référence,
virement) : la facture est « réglée ». À crédit, la somme s'ajoute à l'encours
du client et la facture reste « à régler » jusqu'à son paiement (voir plus bas).
La facture s'imprime et se partage comme celle d'un client du comptoir.

**4. Un devis accepté devient une commande** d'un clic : **Transformer en
commande**, sans rien ressaisir.

---

## Lire les couleurs du stock

Dans *Stock et lots*, chaque produit porte une couleur, et les plus urgents
remontent en haut de la liste :

| Couleur | Signification | Quand |
|---|---|---|
| 🔴 **Rouge — Rupture** | Plus rien en stock | Quantité à zéro |
| 🟠 **Orange — Presque épuisé** | À commander tout de suite | Moins d'**une semaine** de ventes, ou la moitié du seuil |
| 🟡 **Jaune — Il en reste peu** | À prévoir dans la prochaine commande | Moins de **deux semaines** de ventes, ou le seuil atteint |
| 🟢 **Vert — Suffisant** | Rien à faire | Au-delà |

L'application **estime** combien de jours vont durer vos boîtes : elle regarde
ce que vous avez vendu ces 30 derniers jours. Si vous vendez 3 boîtes par jour
et qu'il en reste 15, cela fait environ 5 jours : orange. La colonne
*Couverture estimée* affiche ce nombre de jours.

Pour un produit qui ne s'est pas encore vendu, elle se fie au **seuil** que vous
avez fixé dans le catalogue ; sans seuil non plus, 5 unités ou moins passent
en orange et 10 ou moins en jaune. Cliquez sur une couleur, au-dessus du
tableau, pour n'afficher que ces produits.

### Les couleurs des dates d'expiration

La colonne *Péremption la plus proche* suit la même logique, pour le lot qui
expire le premier :

| Couleur | Signification | Quand (réglage par défaut) |
|---|---|---|
| 🔴 **Rouge — Périmé** | À retirer de la vente | Date passée |
| 🟠 **Orange — Expire bientôt** | À écouler en priorité, ou à retourner au fournisseur | Dans les **90 jours** |
| 🟡 **Jaune — À surveiller** | À garder à l'œil | Dans les **180 jours** |
| 🟢 **Vert — Date éloignée** | Rien à faire | Au-delà |

Les 90 jours peuvent être changés **produit par produit** (délai d'alerte de
péremption, fixé à l'import du catalogue — l'écran *Catalogue* ne le modifie pas
encore) : le jaune suit toujours le double de ce délai. Les
mêmes couleurs apparaissent sur le tableau de bord, dans l'application mobile
et chez vos fournisseurs. Une seconde rangée de boutons, au-dessus du tableau,
filtre les produits par couleur de péremption.

---

## Créer des comptes

Chaque compte se crée avec les trois mêmes informations : **un numéro de
téléphone, une adresse e-mail et un mot de passe** (8 caractères au
minimum). On se connecte avec l'adresse e-mail ; le téléphone sert à joindre
la personne. Tapez le numéro comme vous le composez — `0991 234 567` — :
l'application ajoute d'elle-même l'indicatif du pays (+243 en RD Congo).

Qui crée quoi :

| Compte | Qui le crée | Où |
|---|---|---|
| **Une nouvelle pharmacie** et son administrateur | La personne elle-même | Page de connexion → *Créer un compte* |
| **Un membre de l'équipe** (vendeur, caissier, livreur…) | L'administrateur de la pharmacie | Espace pharmacie → *Équipe* → *Ajouter un membre* |
| **Un compte interne** NOVA PHARMA OS (support, commercial, super-administrateur) | Un super-administrateur uniquement | Back-office → *Équipe* |

**Une nouvelle pharmacie.** Sur la page de connexion, cliquez sur *Créer un compte*.
Indiquez le nom de l'officine, votre
nom, votre téléphone, votre adresse e-mail et votre mot de passe (deux fois).
La pharmacie est créée en période d'essai, vous en êtes l'administrateur, et
vous entrez directement dans votre espace.

**Un membre de l'équipe.** Ouvrez *Équipe*, remplissez *Ajouter un membre*,
choisissez son rôle, puis *Créer le compte*. Donnez-lui son mot de passe
**de vive voix**, jamais par écrit.

**Un compte interne.** Ces comptes voient toutes les pharmacies clientes :
il n'existe donc **aucune inscription publique** pour eux. Seul un
super-administrateur les crée, depuis le menu *Équipe* du back-office — le
menu n'apparaît même pas pour les autres rôles.

**Votre propre compte de super-administrateur — à faire dès l'installation.**
Le tout premier super-administrateur n'est créé par personne : l'installation
le livre, `admin@novapharmaos.com`, avec le mot de passe `NovaPharma2026!` —
un mot de passe **public**, écrit dans ce guide. Remplacez-le par le vôtre :

1. Connectez-vous au back-office avec `admin@novapharmaos.com`.
2. Ouvrez *Équipe*, remplissez *Créer un compte interne* avec **votre** nom,
   téléphone, adresse e-mail et mot de passe, rôle **Super administrateur**.
3. Déconnectez-vous, puis reconnectez-vous avec votre nouveau compte.
4. Dans *Équipe*, cliquez sur **Désactiver** en face de
   `admin@novapharmaos.com`, puis en face de `support@…` et `commercial@…`
   (mêmes mots de passe publics). Leurs sessions sont fermées aussitôt.

Votre propre ligne affiche « vous » au lieu du bouton : on ne peut pas
désactiver son propre compte, ce qui évite de s'enfermer dehors.

> Pour fermer l'inscription publique (par exemple avant un lancement), démarrez
> l'API avec `INSCRIPTION_PUBLIQUE=off`. Par sécurité, les inscriptions sont
> aussi limitées à 20 par heure (`INSCRIPTION_LIMITE_PAR_HEURE`).

---

## Mettre votre logo

Déposez votre image ici :

```
nova-pharma-os/web/public/logo.png
```

Puis arrêtez l'application (Ctrl + C) et relancez-la. Votre logo remplace le
carré vert « NP » **partout** : page de connexion, barre latérale de la
pharmacie, back-office et application mobile.

| | |
|---|---|
| Nom du fichier | `logo.png` — ou `logo.svg`, `logo.jpg`, `logo.webp` |
| Forme | **Carrée**, sinon l'image sera déformée |
| Taille conseillée | 256 × 256 pixels au minimum |
| Fond | Transparent (PNG) ou de couleur unie, au choix |

Tant qu'aucun fichier n'est déposé, le monogramme « NP » s'affiche : l'interface
reste finie, sans image cassée ni carré vide.

> **L'icône de l'onglet et de l'écran d'accueil ne change pas toute seule.**
> Elle vit dans deux fichiers séparés, `web/public/icone-192.png` et
> `web/public/icone-512.png`. Pour la changer aussi, remplacez ces deux
> fichiers par votre logo aux dimensions correspondantes (192 × 192 et
> 512 × 512), en gardant exactement les mêmes noms.

---

## Installer l'application sur un téléphone

L'application s'installe **sans passer par le Play Store ni l'App Store**, donc
sans compte développeur et sans frais.

### Sur Android
1. Ouvrez `http://ADRESSE:3000/mobile` dans **Chrome** (l'adresse est affichée
   au démarrage, voir l'étape 5).
2. Menu **⋮** en haut à droite → **Ajouter à l'écran d'accueil**.
3. L'icône verte « NOVA » apparaît avec vos autres applications.

### Sur iPhone
1. Ouvrez la même adresse dans **Safari** (pas Chrome : sur iPhone, seul Safari
   sait installer).
2. Bouton **Partager** (le carré avec une flèche) → **Sur l'écran d'accueil**.

### Ce que le vendeur y trouve
- **Vendre** — chercher un produit, l'ajouter, encaisser. Le stock bouge
  immédiatement, comme au comptoir.
- **Stock** — vérifier une disponibilité sans revenir à l'ordinateur.
- **Tournée** — pour un livreur : ses livraisons du jour, un bouton par étape,
  et le nom de la personne qui reçoit le colis à la remise.

> **Sans réseau, l'application ne vend pas.** C'est volontaire : afficher un
> stock d'hier ferait vendre un lot déjà écoulé. Elle affiche un message clair
> plutôt que des chiffres faux.

---

## Envoyer un reçu par WhatsApp ou SMS — gratuitement

Après une vente, saisissez le numéro du client et appuyez sur **Envoyer le
reçu**. L'application prépare le message, puis ouvre **WhatsApp sur votre
téléphone** avec le texte déjà écrit. Vous appuyez sur envoyer.

**C'est votre téléphone qui envoie, donc ça ne coûte rien à la pharmacie.**
Aucun compte, aucun abonnement, aucun contrat.

Le message reste enregistré dans NOVA PHARMA OS : vous pouvez toujours montrer
ce qui a été écrit à un client, et à quelle date.

Quatre modèles sont livrés : reçu de vente, rappel de paiement, livraison en
route, et reçu par SMS. Ils se modifient dans les réglages.

> **Plus tard, si le volume grandit.** Au-delà d'une trentaine de messages par
> jour, ouvrir l'écran à chaque fois devient pénible. Il existe alors un mode
> « passerelle » où l'application envoie toute seule — mais cela demande un
> compte payant chez un opérateur de messagerie. Le passage de l'un à l'autre
> ne fait rien perdre : les messages déjà envoyés restent dans le même journal.

---

## Encaisser par Mobile Money

Après une vente, appuyez sur **Encaisser Mobile Money**. L'application affiche
ce qu'il faut dire au client :

> M-Pesa (Vodacom) — 12,50 $US · Composez *1122# · Référence à conserver : MM-260828-0001

Le client compose, l'argent arrive sur le compte marchand de la pharmacie, et
l'opérateur lui renvoie un identifiant de transaction. **Vous saisissez cet
identifiant**, et le versement se rattache automatiquement à la vente.

Pourquoi cet identifiant est obligatoire : c'est lui qui prouve le versement.
Et il est **unique** — si quelqu'un essaie d'enregistrer deux fois la même
transaction, l'application refuse et dit sous quelle référence elle a déjà été
encaissée. C'est cette règle qui fait tenir la caisse en fin de journée.

Quatre opérateurs sont préparés : M-Pesa, Airtel Money, Orange Money et
Afrimoney. Saisissez votre numéro marchand dans les réglages, il sera dicté
avec les instructions.

> **Aucune intégration avec l'opérateur n'est nécessaire**, et donc aucun frais.
> L'argent passe par le circuit habituel ; ce que l'application apporte, c'est
> de savoir à quelle vente il correspond et de ne jamais le compter deux fois.

---

## Vos clients, leurs crédits et leurs règlements

Menu *Clients* → **Ajouter un client** : un particulier, ou un client
professionnel (clinique, ONG, autre pharmacie) avec son plafond et son délai
de crédit. Une vente « Crédit client » inscrit la somme à son encours et
produit une facture « à régler ». Quand le client paie, ouvrez cette facture
(*Factures*, ou le lien **Factures** sous son nom) : **Encaisser un
règlement**, montant et moyen (espèces, Mobile Money…). La facture passe
« partiellement réglée » puis « réglée », et l'encours du client baisse
d'autant. La balance âgée en haut de *Clients* montre depuis combien de temps
chaque somme est due.

## Écrire au support

Menu *Support* → **Écrire au support NOVA PHARMA OS** : l'objet, la nature
(question, panne, idée…) et ce qui s'est passé. Cochez *Urgent* si la vente
est bloquée. Le ticket reçoit une référence ; ouvrez-le pour lire les
réponses de l'équipe et répondre à votre tour.

Chaque personne ne voit dans le menu que ce que son rôle lui permet : le
vendeur, par exemple, a la caisse, le stock, le catalogue, les factures et
les clients. Une page ouverte sans le droit nécessaire affiche « Accès
réservé ».

## Retrouver les guides dans l'application

Les trois documents — celui-ci, le guide commercial et « Que faire avec NOVA
PHARMA OS » — sont **lisibles depuis l'application elle-même**, menu
*Documents* (en bas de la barre latérale, côté pharmacie comme côté
back-office).

Chacun peut aussi être **téléchargé en Word** d'un clic, pour l'imprimer,
l'annoter ou l'envoyer par courriel à un confrère.

> Les fichiers Word sont produits à partir des textes du dépôt. Si vous
> modifiez un guide, relancez `python3 scripts/markdown-vers-word.py` pour
> régénérer les `.docx`, puis redémarrez l'application.

---

## Changer la langue de l'application

En haut à droite de chaque écran, un menu déroulant donne la langue. Il est
aussi présent sur la page de connexion, avant même d'entrer vos identifiants —
utile si un membre de l'équipe ne lit pas le français.

**Quinze langues sont disponibles :** français, anglais, espagnol, allemand,
portugais, arabe, chinois, hindi, kiswahili, **kiswahili de la RD Congo**,
lingala, kinyarwanda, kirundi, wolof et bambara.

Le choix est mémorisé sur l'appareil : chaque vendeur peut travailler dans sa
langue sans changer celle des autres. En arabe, toute la page se retourne de
droite à gauche.

> **À savoir, en toute franchise.** Le français, l'anglais, l'espagnol,
> l'allemand et le portugais ont été rédigés avec soin. Les dix autres langues
> sont utilisables mais **n'ont pas encore été relues par une personne dont
> c'est la langue maternelle** — l'application le signale elle-même sur la page
> de connexion. Faites-les lire par vos vendeurs à Bukavu : corriger un mot
> demande une minute, et c'est exactement le genre de retour à récolter pendant
> vos essais.
>
> Ce qui reste en français quel que soit le choix : les **noms des médicaments**
> (ce sont vos données, pas l'interface), les **dates** et les **montants**.

---

## Étape 7 — Arrêter l'application

Revenez dans la fenêtre noire et appuyez sur **Ctrl + C** (les deux touches ensemble).

L'application s'arrête proprement et **vos données sont conservées**. Au prochain
démarrage, vous retrouverez tout.

---

## Que faire tester à votre équipe

Voici un parcours d'essai qui montre l'essentiel en vingt minutes :

1. **Vendre au comptoir** — Menu *Caisse*. Tapez « para » dans la recherche,
   cliquez sur le Paracétamol, choisissez la quantité, encaissez en espèces.
   → *Observez :* l'application choisit toute seule le lot qui périme le plus tôt.
2. **Essayer de vendre un médicament sur ordonnance** — cherchez « Amoxicilline ».
   → *Observez :* l'application réclame le nom du patient et du prescripteur.
3. **Regarder le stock** — Menu *Stock et lots*.
   → *Observez :* l'alerte sur l'insuline dont la péremption approche.
4. **Voir un client professionnel** — Menu *Clients*, ouvrez « Clinique du Lac ».
   → *Observez :* son encours de crédit et sa balance âgée.
5. **Fermer la caisse** — Menu *Caisse*, comptez l'argent, saisissez le montant.
   → *Observez :* l'écart est calculé et conservé.
6. **Passer côté éditeur** — déconnectez-vous, entrez dans le back-office.
   → *Observez :* la pharmacie que vous venez d'utiliser, son abonnement, son essai.
7. **Changer de langue** — en haut à droite, choisissez *Kiswahili ya Kongo*.
   → *Observez :* les menus, les titres et les alertes passent en swahili ;
   notez les mots qui sonnent faux, ce sont eux qu'il faudra corriger.
8. **Vendre depuis un téléphone** — ouvrez `/mobile` sur le téléphone d'un
   vendeur, cherchez « para », encaissez.
   → *Observez :* la vente apparaît aussitôt sur l'ordinateur.
9. **Envoyer un reçu WhatsApp** — juste après la vente, saisissez votre propre
   numéro et appuyez sur *Envoyer le reçu*.
   → *Observez :* WhatsApp s'ouvre, message déjà écrit. Vous recevez le reçu.
10. **Encaisser en Mobile Money** — puis essayez de saisir **deux fois** la même
    référence de transaction.
    → *Observez :* la deuxième est refusée, avec le numéro de l'encaissement
    déjà enregistré. C'est ce qui protège votre caisse.
11. **Commander et réceptionner** — Menu *Achats*, *Commander chez …* sous les
    suggestions, créez la commande, transmettez-la, puis réceptionnez la moitié
    des quantités.
    → *Observez :* le stock augmente aussitôt ; le reste attend la livraison
    suivante, et la commande est « reçue en partie ».
12. **Livrer une clinique** — Menu *Commandes B2B*, une commande pour « Clinique du Lac »,
    confirmez-la, puis *Livrer et facturer*.
    → *Observez :* la facture est établie et le stock a baissé.

---

## Si quelque chose ne marche pas

### « Node.js n'est pas installé »
Reprenez l'étape 1. Après l'installation, **fermez et rouvrez** la fenêtre noire.

### La fenêtre noire s'ouvre puis se ferme aussitôt
Le message d'erreur a disparu trop vite. Pour le lire :
- **Windows** : clic droit dans le dossier → « Ouvrir dans le Terminal » →
  tapez `node demarrer.mjs`
- **Mac / Linux** : ouvrez le Terminal, allez dans le dossier avec `cd`, puis
  tapez `node demarrer.mjs`

### « L'API n'a pas démarré » ou « L'interface n'a pas démarré »
La fenêtre affiche maintenant les derniers messages du serveur, juste en dessous.
Ce sont eux qui disent ce qui bloque.

Cause la plus fréquente : **un autre programme occupe déjà le port**. Relancez en
choisissant d'autres numéros :
```
NOVA_PORT_WEB=3100 NOVA_PORT_API=3101 node demarrer.mjs
```
Sur Windows :
```
set NOVA_PORT_WEB=3100 && set NOVA_PORT_API=3101 && node demarrer.mjs
```

### « La base de données embarquée n'a pas démarré »
L'application installe normalement sa propre base, sans que vous ayez rien à faire.
Si cela échoue sur votre machine, installez PostgreSQL vous-même :

1. Téléchargez-le sur **https://www.postgresql.org/download/**
2. Pendant l'installation, notez le **mot de passe** que vous choisissez
3. Créez une base nommée `nova`
4. Relancez en indiquant votre base :
```
NOVA_DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/nova node demarrer.mjs
```

### Le téléphone n'ouvre pas la page
Vérifiez, dans l'ordre :
1. Le téléphone est-il sur **le même Wi-Fi** que l'ordinateur ? (pas en données mobiles)
2. Avez-vous bien tapé l'adresse **complète**, avec `http://` au début et `:3000` à la fin ?
3. Le **pare-feu** de l'ordinateur bloque peut-être la connexion. Sur Windows, à la
   première ouverture, une fenêtre demande d'autoriser Node.js : répondez
   **« Autoriser l'accès »**. Si vous avez répondu « Annuler », cherchez
   « Pare-feu Windows » → « Autoriser une application » → cochez Node.js.

### L'adresse du téléphone a changé
C'est normal : la box Wi-Fi attribue les adresses et peut en changer après un
redémarrage. Relancez l'application : elle affiche toujours l'adresse du moment.

### Je veux tout recommencer à zéro
Supprimez le dossier **`donnees`** qui se trouve dans `nova-pharma-os`, puis
relancez. Attention : **cela efface toutes les données saisies**.

### La recherche ne trouve pas un mot accentué
Les bases créées sur votre ordinateur avant la version d'octobre 2026 ne gèrent
pas bien les accents. Si vous n'y avez saisi que des essais, recommencez à zéro
(ci-dessus) : la nouvelle base est créée correctement. La version hébergée n'est
pas concernée.

---

## Questions fréquentes

**Est-ce que ça coûte quelque chose ?**
Non. Tout ce que décrit ce guide est gratuit. Node.js est gratuit, la base de
données est gratuite, l'application est la vôtre.

**Combien de personnes peuvent l'utiliser en même temps ?**
Sur un ordinateur ordinaire, une dizaine sans difficulté. Largement assez pour
tester avec votre équipe.

**Mes données sont-elles envoyées quelque part ?**
Non. Tout reste dans le dossier `donnees` sur votre ordinateur. Rien ne sort de
votre Wi-Fi.

**Comment sauvegarder mes données ?**
Arrêtez l'application (Ctrl + C), puis copiez le dossier `donnees` sur une clé USB.
Pour restaurer, remettez ce dossier à sa place.

**Une pharmacie à Goma peut-elle s'y connecter ?**
Non — pas avec cette installation. Le Wi-Fi ne dépasse pas les murs du bâtiment.
Pour qu'une pharmacie éloignée accède au logiciel, il faut un hébergeur sur
internet, ce qui devient payant. Voir le document
[`docs/GUIDE_COMMERCIAL.md`](docs/GUIDE_COMMERCIAL.md).

**Puis-je laisser l'ordinateur allumé jour et nuit ?**
Oui. Vérifiez seulement que la mise en veille est désactivée, sinon l'application
s'interrompt quand l'écran s'éteint.
