# 📲 Installer QualiCode en un clic

QualiCode s'installe **comme une vraie application** — une icône sur l'écran
d'accueil du téléphone ou sur le bureau de l'ordinateur, un clic pour ouvrir,
et **ça marche sans internet**. Choisissez la ligne qui vous correspond.

> ⚠️ **À lire d'abord — la règle qui bloque tout le monde.**
> Un fichier `QualiCode.html` **ouvert depuis « Fichiers », WhatsApp ou une clé
> USB ne peut PAS être installé** : aucun navigateur, sur aucun téléphone, ne
> l'autorise (règle de sécurité des navigateurs). Pour obtenir l'icône sur un
> téléphone, il faut **ouvrir l'adresse web** de QualiCode :
> **https://jacquesdunia2015-commits.github.io/JACK_M/**
> Sur ordinateur sans internet, utilisez les scripts plus bas : ils créent
> l'icône sans passer par le navigateur.
>
> L'application vous le dit d'elle-même : bouton **📲** en haut de l'écran →
> elle affiche ce qui manque et l'adresse à ouvrir.
>
> **Si l'adresse ne répond pas** (« ce site est inaccessible ») : votre réseau
> la bloque. Voir **[INSTALLATION.md](../INSTALLATION.md)** — on y explique
> comment publier QualiCode ailleurs en 2 minutes, gratuitement.

| Vous êtes sur… | Faites ceci |
|---|---|
| **Téléphone Android** (Chrome) | Ouvrez **l'adresse web** → répondez « Installer » au bandeau, ou **menu ⋮** en haut à droite → « Installer l'application » / « Ajouter à l'écran d'accueil ». ⚠️ Sur Android il n'y a **pas** de bouton ⬆️ : ce bouton n'existe que sur iPhone. |
| **iPhone / iPad** (Safari) | Ouvrez **l'adresse web** dans **Safari** (pas Chrome, pas le navigateur de WhatsApp) → bouton **Partager ⬆️** dans la barre du **bas** de Safari (en haut à droite sur iPad) → faites défiler → **« Sur l'écran d'accueil »**. |
| **Ordinateur avec Chrome ou Edge** (Windows, Mac, Linux) | Ouvrez l'adresse → cliquez l'icône **⊕ / 💻** à droite de la barre d'adresse → « Installer ». Ou, dans QualiCode : **Accueil → 📲 Installer l'application**. |
| **Ordinateur sans internet** (fichier reçu par clé USB ou WhatsApp) | Utilisez les scripts ci-dessous : ils créent l'icône sur le bureau. |

## Les scripts d'installation hors ligne

Ils ne demandent **aucun droit administrateur**, n'installent rien dans le
système et ne se connectent nulle part. Ils copient simplement l'application
dans votre dossier personnel et créent les raccourcis.

Placez le fichier `QualiCode.html` **à côté du script**, puis :

- **Windows** : double-cliquez `Windows-Installer-QualiCode.bat`
  → icône sur le Bureau + entrée dans le menu Démarrer. Si Chrome ou Edge est
  présent, l'icône ouvre QualiCode **en fenêtre d'application** (sans barre
  d'adresse), comme un logiciel installé.
  *(Si Windows affiche un avertissement « Windows a protégé votre
  ordinateur », cliquez « Informations complémentaires » → « Exécuter quand
  même » : le script n'est pas signé, mais son contenu est lisible dans un
  éditeur de texte.)*
- **Linux** : `bash Linux-installer-qualicode.sh`
  → QualiCode apparaît dans le menu des applications et sur le bureau.
  Désinstallation : `bash Linux-installer-qualicode.sh --desinstaller`
- **macOS** : double-cliquez `macOS-installer-qualicode.command`
  → icône QualiCode sur le Bureau.
  *(Si macOS refuse : clic droit sur le fichier → Ouvrir → Ouvrir.)*

## Ce que l'installation apporte

- **Un clic** : l'icône ouvre QualiCode directement, sans passer par le
  navigateur ni chercher un fichier.
- **Plein écran**, sans barre d'adresse : on gagne de la place à l'écran.
- **Hors ligne** : une fois installée, l'application fonctionne sans
  connexion — utile sur le terrain.
- **Ouverture directe des projets** : après l'installation depuis un site
  (Chrome/Edge), double-cliquer un fichier `.projx` ou `.qdpx` lance
  QualiCode avec le projet déjà chargé.
- **Raccourcis** : un clic droit sur l'icône propose « Mes projets »,
  « Nouveau projet » et « Manuel du débutant ».

## Vos données restent chez vous

L'installation ne change rien à la confidentialité : les projets sont
enregistrés **sur votre appareil** (base locale du navigateur), jamais sur un
serveur. Pensez à exporter régulièrement un fichier `.projx` de sauvegarde
(Accueil → 💾 Enregistrer).
