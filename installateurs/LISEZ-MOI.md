# 📲 Installer QualiCode en un clic

QualiCode s'installe **comme une vraie application** — une icône sur l'écran
d'accueil du téléphone ou sur le bureau de l'ordinateur, un clic pour ouvrir,
et **ça marche sans internet**. Choisissez la ligne qui vous correspond.

| Vous êtes sur… | Faites ceci |
|---|---|
| **Téléphone Android** (Chrome) | Ouvrez l'adresse de QualiCode → répondez « Installer » au bandeau, ou menu ⋮ → « Installer l'application ». |
| **iPhone / iPad** (Safari) | Ouvrez l'adresse → bouton **Partager ⬆️** en bas → **« Sur l'écran d'accueil »**. |
| **Ordinateur avec Chrome ou Edge** (Windows, Mac, Linux) | Ouvrez l'adresse → cliquez l'icône **⊕ / 💻** à droite de la barre d'adresse → « Installer ». Ou, dans QualiCode : **Accueil → 📲 Installer l'application**. |
| **Ordinateur sans internet** (fichier reçu par clé USB ou WhatsApp) | Utilisez les scripts ci-dessous : ils créent l'icône sur le bureau. |

## Les scripts d'installation hors ligne

Ils ne demandent **aucun droit administrateur**, n'installent rien dans le
système et ne se connectent nulle part. Ils copient simplement l'application
dans votre dossier personnel et créent les raccourcis.

Placez le fichier `QualiCode.html` **à côté du script**, puis :

- **Windows** : double-cliquez `Windows-Installer-QualiCode.bat`
  → icône sur le Bureau + entrée dans le menu Démarrer.
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
