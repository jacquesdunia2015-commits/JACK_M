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

Deux comptes sont créés automatiquement pour vos essais.

### Pour tester comme une pharmacie
| | |
|---|---|
| Adresse | `gerant@pharmacie-demo.cd` |
| Mot de passe | `Pharmacie2026!` |

Vous arrivez sur le tableau de bord d'une pharmacie qui a déjà : 8 produits,
du stock réparti sur des lots, 4 ventes passées, 2 clients, et une alerte de
péremption. C'est **une vraie pharmacie en fonctionnement**, pas un décor.

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
