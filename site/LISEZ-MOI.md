# Guide de la rédaction

Tout le site se pilote depuis ce dossier. **Aucun fichier HTML n'est à modifier
à la main** : ils sont tous régénérés à partir des contenus ci-dessous.

```
site/
├── config.json              Marque, couleurs, URL, réglages (mesure, affiliation, newsletter)
├── contenu/
│   ├── rubriques.json       Arborescence : rubriques, sous-rubriques, chapôs
│   ├── auteurs.json         Fiches auteurs (signature obligatoire)
│   ├── produits.json        Référentiel produit réutilisable + liens marchands
│   ├── redirections.json    Redirections 301 saisies à la main
│   ├── articles/*.md        Un fichier = un article
│   └── pages/*.md           Pages de service
└── design/                  Feuille de style et scripts
```

## Publier

```bash
python3 tools/generer_site_conseil.py     # génère le site dans conseil/
python3 tools/verifier_site_conseil.py    # recette automatisée
```

Le générateur **refuse de publier** si :

- l'image de couverture d'un article n'a pas d'alternative textuelle (`image_alt`) ;
- l'auteur d'un article n'existe pas dans `auteurs.json` (la signature est obligatoire) ;
- la rubrique ou la sous-rubrique déclarée n'existe pas dans `rubriques.json` ;
- un bloc renvoie à un produit absent de `produits.json` ;
- un identifiant de page entre en conflit avec une rubrique ou un mot réservé.

Il **avertit** (sans bloquer) si une balise `title` dépasse 60 signes, si une
`meta_description` dépasse 155 signes ou est absente, ou si une page dépasse le
budget de poids ou de requêtes fixé dans `config.json`.

## Écrire un article

Créez `site/contenu/articles/mon-article.md`. Le nom du fichier devient l'adresse
de la page. L'en-tête se termine par une ligne `---`, le corps suit.

```
titre: Les meilleurs X en 2026
type: guide                     # guide | actu
rubrique: maison                # identifiant repris de rubriques.json
sous_rubrique: cuisine          # facultatif
auteur: camille-renaud          # identifiant repris de auteurs.json
publie_le: 2026-06-02
maj_le: 2026-08-12              # facultatif — affiché seulement s'il diffère
transverses: ["made-in-france"] # facultatif : made-in-france, ecoresponsable
meta_titre: …                   # ≤ 60 signes ; à défaut, le titre est repris
meta_description: …             # ≤ 155 signes ; à défaut, le chapô est repris
chapo: Deux ou trois phrases qui posent le sujet et la promesse.
image_alt: Description de l'image de couverture     # OBLIGATOIRE
image_legende: Légende affichée sous l'image
thematiques: ["…"]              # encadré « Complément d'informations »
mots_cles: ["…"]                # idem + maillage « En rapport avec votre article »
lieu: France                    # idem + balisage contentLocation
expertise_auteur: …             # idem, signal E-E-A-T
affiliation: true               # affiche la mention avant le premier lien commercial
partenaire: true                # bandeau « Article partenaire »
partenaire_nom: Nom de l'annonceur
produits: ["slug-1", "slug-2"]  # produits cités (pour le suivi des liens)
---

Le corps de l'article commence ici.
```

Le temps de lecture, le fil d'Ariane, les données structurées, les blocs de
recommandation et l'image de partage sont calculés automatiquement.

### Mise en forme du corps

`## Intertitre`, `### Sous-intertitre`, `- liste`, `1. liste numérotée`,
`> citation`, `**gras**`, `*italique*`, `` `code` ``, tableaux `| … | … |`.

Les liens : `[texte](https://exemple.fr)` pour un lien externe — il reçoit
automatiquement `target="_blank" rel="noopener"` et un pictogramme.
`[texte](/contact/)` pour un lien interne, toujours écrit depuis la racine du site.

### Blocs éditoriaux

````
::: aretenir titre="L'essentiel en dix secondes"
- Premier point
- Deuxième point
:::

::: chiffres
- 10 Mt | de nourriture gaspillée chaque année en France | https://www.ademe.fr/
:::

::: comparatif produits="slug-1,slug-2,slug-3" colonnes="Capacité,Poids,Garantie"
:::

::: produit slug="slug-1"
:::

::: citation auteur="Camille Renaud" fonction="Rédactrice en chef"
Le texte de la citation.
:::

::: faq
? La question posée
! La réponse apportée.
:::
````

Les colonnes d'un comparatif reprennent les clés `specs` des fiches produits.
Le bloc `faq` alimente le balisage `FAQPage` ; le bloc `comparatif` alimente
`ItemList` / `Product`.

## Ajouter une rubrique

Ajoutez une entrée dans `rubriques.json` (identifiant, nom, titre, chapô, et la
liste `sous`). La navigation, le pied de page, le plan du site et les sitemaps
se mettent à jour seuls. **Si vous renommez l'identifiant d'un contenu existant,
la redirection 301 est créée automatiquement** au prochain build : le générateur
compare les adresses au fichier `.urls.json` du build précédent et publie les
règles dans `conseil/redirections.conf` (nginx et Apache).

## Ajouter un produit

Une fiche par produit dans `produits.json`, réutilisable dans autant d'articles
que nécessaire. Mettre à jour un prix ou un lien marchand à un seul endroit met
à jour tous les articles concernés. Le site n'expose jamais l'URL marchande :
il publie `/go/{identifiant}/`, qui porte `rel="sponsored nofollow noopener"` et
déclenche l'événement de mesure `clic_affilie`.

Renseignez toujours `verifie_le` : la date du relevé de prix est affichée au
lecteur.

## Règles éditoriales opposables

Elles sont publiées sur le site (page **Charte éditoriale**) et engagent la
rédaction : sourçage des données chiffrées, signature, affichage des dates de
mise à jour, mention d'affiliation avant le premier lien commercial, bandeau
« Article partenaire » sur les contenus sponsorisés, droits des images,
relecture humaine obligatoire de tout contenu assisté par IA.
