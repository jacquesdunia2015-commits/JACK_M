# Ajouter le logo de votre organisation (APSA, université, ONG…)

QualiCode peut afficher **deux logos côte à côte** : le sien et celui de votre
organisation — dans l'en-tête de l'application et en tête des rapports
imprimables.

## Solution 1 — chaque utilisateur choisit son logo (aucune manipulation ici)

Dans l'application : onglet **Accueil** → **🏛️ Logo de l'organisation** →
*Choisir une image* → nom de l'organisation → **OK**.

Le logo est conservé dans le navigateur de l'appareil. Il n'est **jamais** inclus
dans le fichier projet `.projx` que vous partagez.

## Solution 2 — livrer le logo avec l'application (pour toute une équipe)

Le logo est alors déjà présent au premier lancement, sans manipulation de la
part des utilisateurs.

1. Déposez votre fichier ici, sous le nom exact :

       assets/logo/organisation.png

   Format PNG, fond transparent de préférence, hauteur ≥ 160 px.
   (Il sera réduit à 320 px de côté maximum au chargement.)

2. Dans `index.html`, **décommentez** la ligne :

       <meta name="qc-org-logo" content="assets/logo/organisation.png">

   et ajustez le nom affiché :

       <meta name="qc-org-nom" content="APSA">

   Sans cette balise, aucune requête réseau n'est tentée au démarrage — c'est
   volontaire, pour ne pas ralentir les connexions lentes.

3. Reconstruisez les paquets :

       python3 tools/build_standalone.py     # fichier unique (logo embarqué en base64)
       python3 tools/faire_paquet_web.py     # dossier à héberger

   Le nom peut être changé au moment de la construction :

       QC_ORG_NOM="APSA" python3 tools/build_standalone.py

Dans les deux cas, l'utilisateur reste libre de remplacer le logo par le sien
ou de le retirer (bouton **Retirer le logo**).
