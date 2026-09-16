# Co-marquage : logo de l'organisation + drapeau national

QualiCode peut afficher **trois marques côte à côte** : son propre logo, celui
de votre organisation (APSA, une université, une ONG) et **votre drapeau
national** — dans l'en-tête de l'application et en tête des rapports
imprimables.

Les drapeaux fournis (🇨🇩 RD Congo `cd`, 🇷🇼 Rwanda `rw`, 🇧🇯 Bénin `bj`) sont
dessinés en SVG dans `js/branding.js` : quelques centaines d'octets, nets à
toutes les tailles, disponibles **hors ligne** sans aucune requête réseau. Pour
ajouter un pays, complétez l'objet `DRAPEAUX` du même fichier.

## Solution 1 — chaque utilisateur choisit son logo (aucune manipulation ici)

Dans l'application : onglet **Accueil** → **🏛️ Logo de l'organisation** → nom de
l'organisation → *Choisir une image* → drapeau → **OK**.

Tant qu'aucune image n'est fournie, une **vignette portant le sigle** est
affichée (ce n'est pas le logo officiel : elle disparaît dès qu'un fichier est
chargé).

Ces réglages sont conservés dans le navigateur de l'appareil. Ils ne sont
**jamais** inclus dans le fichier projet `.projx` que vous partagez.

## Solution 2 — livrer le logo avec l'application (pour toute une équipe)

Le logo est alors déjà présent au premier lancement, sans manipulation de la
part des utilisateurs.

1. Le **nom** et le **drapeau** fonctionnent immédiatement, sans aucun fichier.
   Dans `index.html` :

       <meta name="qc-org-nom" content="APSA">
       <meta name="qc-org-drapeau" content="cd">

   Codes disponibles : `cd` (RD Congo), `rw` (Rwanda), `bj` (Bénin), ou vide.

2. Pour le **logo officiel**, déposez votre fichier ici, sous le nom exact :

       assets/logo/organisation.png

   Format PNG, fond transparent de préférence, hauteur ≥ 160 px.
   (Il sera réduit à 320 px de côté maximum au chargement.)

   Puis, dans `index.html`, **décommentez** la ligne :

       <meta name="qc-org-logo" content="assets/logo/organisation.png">

   Sans cette balise, aucune requête réseau n'est tentée au démarrage — c'est
   volontaire, pour ne pas ralentir les connexions lentes.

3. Reconstruisez les paquets :

       python3 tools/build_standalone.py     # fichier unique (logo embarqué en base64)
       python3 tools/faire_paquet_web.py     # dossier à héberger

   Le nom peut être changé au moment de la construction :

       QC_ORG_NOM="APSA" python3 tools/build_standalone.py

Dans les deux cas, l'utilisateur reste libre de remplacer ces marques par les
siennes ou de les retirer (bouton **Tout retirer**). Un client qui achète
QualiCode change simplement ces deux ou trois lignes pour son propre nom, son
propre logo et son propre drapeau.
