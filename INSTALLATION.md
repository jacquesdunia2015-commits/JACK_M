# 📲 Installer QualiCode — guide de dépannage

Ce document répond à **deux situations précises** :

1. « Le site ne répond pas » (`ERR_CONNECTION_TIMED_OUT`) ;
2. « QualiCode ne s'installe pas », sur téléphone ou sur ordinateur.

---

## 1. Comprendre : pourquoi une adresse web est nécessaire

Une application web ne peut s'installer (icône sur l'écran d'accueil) **que si
elle est ouverte depuis une adresse `https://`**. C'est une règle des
navigateurs eux-mêmes :

| Comment vous ouvrez QualiCode | Fonctionne ? | Installable ? |
|---|:---:|:---:|
| Fichier `QualiCode.html` reçu par WhatsApp / clé USB | ✅ oui, tout marche | ❌ jamais |
| Adresse `https://…` dans Chrome (Android) ou Safari (iPhone) | ✅ | ✅ |
| Adresse `https://…` dans Chrome / Edge (ordinateur) | ✅ | ✅ |
| Raccourci créé par les scripts `installateurs/` (ordinateur) | ✅ | ✅ icône bureau |

Autrement dit : **sur ordinateur, vous n'avez besoin d'aucune connexion** (voir
§3). Sur téléphone, il faut une adresse web accessible **une seule fois** —
ensuite l'application fonctionne hors ligne pour toujours.

---

## 2. Si le site ne répond pas (`ERR_CONNECTION_TIMED_OUT`)

Cette erreur ne vient pas de QualiCode : votre réseau n'atteint pas le serveur.
C'est fréquent avec `github.io`, bloqué ou très ralenti par certains
fournisseurs d'accès africains. Trois solutions, de la plus simple à la plus
durable.

### a) Réessayer depuis un autre réseau
Wi-Fi d'un cybercafé, d'une université, partage de connexion d'un autre
opérateur. Il suffit d'**une seule visite réussie** pour installer
l'application ; ensuite elle fonctionne sans réseau.

*(Depuis la version actuelle, le site ne charge plus que ~130 Ko : environ
40 secondes même sur une connexion à 3 Ko/s, contre 4 minutes auparavant.)*

### b) Publier QualiCode sur un autre hébergeur (recommandé, 2 minutes, gratuit)

1. Sur un ordinateur ayant internet, récupérez le fichier
   **`dist/QualiCode_site.zip`** (généré par `python3 tools/faire_paquet_web.py`).
2. Allez sur un hébergeur statique gratuit qui accepte le glisser-déposer —
   par exemple **Netlify Drop** (`app.netlify.com/drop`), **Cloudflare Pages**
   ou **Vercel**.
3. Déposez le zip (ou le dossier décompressé). Vous obtenez en quelques
   secondes une adresse du type `https://qualicode-xyz.netlify.app`.
4. Ouvrez cette adresse sur le téléphone → installez l'application.

Cette adresse vous appartient : c'est aussi celle que vous donnerez à vos
clients quand vous commercialiserez QualiCode. Un hébergeur qui répond bien
depuis l'Afrique de l'Est/Centrale est un vrai atout commercial.

### c) Vérifier GitHub Pages (si vous tenez à cette adresse)
Dans le dépôt : **Settings → Pages** → la source doit être la branche
`gh-pages`. Le déploiement se fait automatiquement à chaque envoi de code, et
il vérifie désormais que les fichiers d'installation sont présents.

---

## 3. Sur ordinateur : installation **sans aucune connexion**

C'est la voie la plus sûre, et elle ne dépend d'aucun site.

1. Récupérez le dossier `installateurs/` **et** le fichier `QualiCode.html`
   (ils sont fournis ensemble dans le paquet `QualiCode_installation.zip`).
2. Lancez le script de votre système :
   - **Windows** : double-clic sur `Windows-Installer-QualiCode.bat`
     *(si Windows affiche « Windows a protégé votre ordinateur » : cliquez
     « Informations complémentaires » → « Exécuter quand même ». Le script est
     un simple fichier texte, lisible dans le Bloc-notes.)*
   - **Linux** : `bash Linux-installer-qualicode.sh`
   - **macOS** : double-clic sur `macOS-installer-qualicode.command`
     *(si macOS refuse : clic droit → Ouvrir → Ouvrir.)*
3. Une icône **QualiCode** apparaît sur le bureau (et dans le menu Démarrer /
   la liste des applications).

Si Chrome ou Edge est installé, le raccourci ouvre QualiCode **en mode
application** : fenêtre propre, sans barre d'adresse — l'aspect d'un logiciel
installé. Sinon il s'ouvre dans le navigateur par défaut.

Rien n'est écrit dans le registre Windows, aucun droit administrateur n'est
demandé. Pour désinstaller : supprimez les raccourcis et le dossier
`%LOCALAPPDATA%\QualiCode` (Windows) ou lancez
`bash Linux-installer-qualicode.sh --desinstaller` (Linux).

---

## 4. Sur téléphone : la marche à suivre exacte

Une fois l'adresse web ouverte (§2) :

- **Android (Chrome)** : menu **⋮** en haut à droite → **« Installer
  l'application »** (ou « Ajouter à l'écran d'accueil »).
  ⚠️ Il n'y a **pas** de bouton ⬆️ sur Android : ce bouton n'existe que sur
  iPhone.
- **iPhone / iPad** : ouvrez l'adresse **dans Safari** (pas Chrome, pas le
  navigateur intégré de WhatsApp) → bouton **Partager ⬆️** dans la barre du
  **bas** → faites défiler → **« Sur l'écran d'accueil »**.

Le bouton **📲** en haut de QualiCode affiche à tout moment un diagnostic :
il indique laquelle des conditions n'est pas remplie et ce qu'il faut faire.

---

## 4 ter. Selon VOTRE navigateur (la cause n° 1 des échecs)

Tous les navigateurs de téléphone ne savent pas installer, et ceux qui savent
ne le font pas au même endroit. QualiCode **reconnaît le vôtre** et affiche la
bonne marche à suivre (bouton 📲).

| Navigateur | Peut installer ? | Où cliquer |
|---|:---:|---|
| **Navigateur intégré de WhatsApp / Facebook / Messenger** | ❌ **jamais** | Bouton **« 🌐 Ouvrir dans Chrome »** de QualiCode, ou menu ⋮ de la fenêtre → « Ouvrir dans Chrome » |
| **Chrome** (Android) | ✅ | Menu **⋮** → « Installer l'application » |
| **Samsung Internet** | ✅ | Menu **☰** (en bas à droite) → « Ajouter la page à » → « Écran d'accueil » |
| **Firefox** (Android) | ✅ | Menu **⋮** → « Installer » |
| **Opera** (Android) | ✅ | Menu **⋮ / ≡** → « Ajouter à… » → « Écran d'accueil » |
| **Edge** (Android) | ✅ | Menu **≡** (en bas) → « Ajouter à l'écran d'accueil » |
| **UC Browser** | ❌ peu fiable | Ouvrez plutôt dans Chrome |
| **Chrome ou Firefox sur iPhone** | ❌ **jamais** (règle d'Apple) | Ouvrez l'adresse **dans Safari** |
| **Safari** (iPhone/iPad) | ✅ | **Partager ⬆️** (barre du bas) → « Sur l'écran d'accueil » |

> 💡 **Le piège le plus courant** : on reçoit le lien par WhatsApp, on le touche,
> et WhatsApp l'ouvre dans son **mini-navigateur intégré**, qui ne peut rien
> installer. QualiCode le détecte et affiche un bouton **« Ouvrir dans Chrome »**
> qui règle le problème en un toucher.

---

## 4 bis. « Ça ne s'installe toujours pas sur le téléphone »

Ouvrez QualiCode depuis l'adresse web, puis touchez le bouton **📲** en haut de
l'écran, puis **🔍 Vérifier maintenant**. QualiCode teste alors *réellement*, une
par une, les conditions exigées par Chrome et affiche le résultat :

| Ligne du diagnostic | Si elle est ❌ rouge |
|---|---|
| **Adresse sécurisée (https)** | Vous avez ouvert un fichier local, ou une adresse en `http://`. Ouvrez l'adresse `https://…`. |
| **Fiche d'installation téléchargée** | Le manifeste n'a pas pu être récupéré (réseau coupé, ou site incomplet). Rechargez ; si l'erreur persiste, votre hébergeur ne sert pas tous les fichiers. |
| **Icône 192 / 512 px accessible** | Une icône manque sur le serveur : republiez le paquet `QualiCode_site.zip` **en entier**. |
| **Mode hors ligne actif** | Le service worker n'a pas encore pris le contrôle : **rechargez la page une fois** (c'est normal à la toute première visite). |
| **Proposition d'installation du navigateur** ℹ️ | Ce n'est **pas** bloquant : Chrome ne propose pas toujours l'installation automatiquement. Passez par le **menu ⋮ → « Installer l'application »**. |

Si tout est vert et que le menu ⋮ ne propose toujours rien :
- vérifiez que **QualiCode n'est pas déjà installé** (le diagnostic vous le dit ;
  cherchez l'icône dans la liste des applications) ;
- fermez l'onglet, rouvrez l'adresse, laissez la page se charger **entièrement**,
  puis rouvrez le menu ⋮ ;
- assurez-vous d'être dans **Chrome** et non dans le navigateur intégré de
  WhatsApp/Facebook, qui n'installe rien.

Le bouton **📋 Copier le diagnostic** met tout le rapport dans le presse-papiers :
vous pouvez l'envoyer tel quel pour obtenir de l'aide.

---

## 5. Et si rien n'est possible ?

Ce n'est pas grave : **QualiCode fonctionne parfaitement sans être installé.**
Le fichier `QualiCode.html` ouvert depuis « Fichiers » offre exactement les
mêmes fonctions, les mêmes données, la même sauvegarde. L'installation
n'apporte que le confort : une icône, le plein écran et l'ouverture en un clic.
