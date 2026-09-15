# Cahier de recette — site éditorial de conseil à la consommation

Reprend les huit critères d'acceptation du **§ 10** du cahier des charges et
indique, pour chacun, comment il se vérifie et où il en est.

## Exécuter la recette

```bash
python3 tools/generer_site_conseil.py --strict     # génération + contrôles bloquants
python3 tools/verifier_site_conseil.py             # contrôles statiques (88 pages)
python3 tools/verifier_site_conseil.py --reseau    # + test réel des liens marchands

python3 -m http.server 8099 --directory conseil &
npm install --no-save playwright && npx playwright install chromium
node tools/tester_site_conseil.mjs                 # contrôles interactifs
```

Les trois commandes renvoient un code de sortie non nul en cas d'anomalie : elles
peuvent être branchées telles quelles dans une intégration continue.

---

## Critère 1 — Conformité fonctionnelle aux § 4 et 5

**Automatisé.** Le tableau de correspondance section par section figure dans
[SITE_CONSEIL.md](SITE_CONSEIL.md#1-ce-qui-est-livré-section-par-section).
Les contrôles suivants sont bloquants à la génération :

| Contrôle | Règle |
|---|---|
| Alternative textuelle de couverture | § 6.5 — publication refusée si `image_alt` est vide |
| Signature | § 5 — publication refusée si l'auteur n'est pas déclaré |
| Cohérence de l'arborescence | Rubrique et sous-rubrique doivent exister |
| Intégrité du référentiel produit | Tout produit cité doit exister |
| Collision d'identifiants | Page / rubrique / mot réservé |

**Interactif** (`tester_site_conseil.mjs`) : menu mobile et accordéon, recherche
au fil de la frappe, page de résultats, redirection d'un lien marchand,
formulaire d'inscription — case non pré-cochée, refus sans consentement,
annonce du double opt-in.

## Critère 2 — Seuils de performance du § 2.2

**Partiellement automatisé.** À chaque génération, le budget est contrôlé page
par page (poids et nombre de requêtes, assets et images compris) :

- budget : 1 200 Ko et 45 requêtes par page ;
- relevé actuel : page la plus lourde à **100 Ko et 16 requêtes** (article avec
  comparatif), site complet à 1,4 Mo.

Choix de conception concourant aux Core Web Vitals : aucune police à télécharger
(pile système), aucun script tiers, dimensions déclarées sur toutes les images,
hauteurs réservées pour les emplacements publicitaires, scripts en `defer`.

**Reste à faire après mise en ligne** : mesures Lighthouse mobile sur les trois
gabarits (accueil, rubrique, article) et surtout **données terrain au 75e
centile** (LCP < 2,0 s, INP < 200 ms, CLS < 0,1), qui ne peuvent pas être
constatées avant la mise en production.

## Critère 3 — Données structurées sans erreur

**Automatisé** : chaque bloc JSON-LD est analysé à la recette ; un bloc invalide
est une anomalie bloquante.

Types émis : `Organization` et `WebSite` + `SearchAction` (accueil),
`BreadcrumbList` (toutes pages de contenu), `Article` / `NewsArticle`,
`Person` (auteurs), `ItemList` + `Product` + `Review` (comparatifs),
`FAQPage` (articles à FAQ), `CollectionPage` (rubriques).

**Reste à faire** : passage au Rich Results Test de Google sur l'URL publiée,
qui exige un site en ligne.

## Critère 4 — Audit d'accessibilité (WCAG 2.1 AA / RGAA 4.1)

**Automatisé** : `lang` sur `<html>`, un seul `H1` par page, hiérarchie de titres
sans saut de niveau, `alt` sur toutes les images, dimensions déclarées, étiquette
associée à chaque champ de formulaire, lien d'évitement, zoom utilisateur non
bloqué, zones défilantes accessibles au clavier (`tabindex="0"` sur les tableaux).

Par conception : contrastes calculés sur la palette (`#17469E` sur blanc ≈ 8,6:1),
focus visible sur tous les éléments interactifs, zones tactiles ≥ 44 px,
`prefers-reduced-motion` respecté, HTML sémantique, ARIA limité au nécessaire.

**Reste à faire** : audit RGAA complet par un auditeur, avec tests au lecteur
d'écran — non automatisable.

## Critère 5 — Conformité RGPD, aucun cookie non essentiel avant consentement

**Automatisé et vérifié à deux niveaux :**

1. Statique : la recette échoue si une page charge une ressource tierce
   (script, image, iframe) — la liste des hôtes autorisés est vide.
2. Interactif : après un refus, le contexte navigateur est inspecté —
   **0 cookie déposé**.

Le bandeau applique les recommandations de la CNIL : refus aussi accessible que
l'acceptation dès le premier écran, granularité par finalité, aucune case
pré-cochée, preuve du choix journalisée (date, version du bandeau, détail),
consentement expirant au bout de six mois, réversibilité par le pied de page.

## Critère 6 — Tests multi-navigateurs et multi-appareils

**Partiellement automatisé** : le rendu est vérifié sous Chromium en 390 px et
1280 px, et la barre de navigation est mesurée sans chevauchement de 1 264 px à
1 920 px. Points de rupture couverts : 320, 768, 1024, 1264, 1408 px.

**Reste à faire** : passage sur Safari (macOS et iOS), Firefox et Edge, et sur
appareils réels.

## Critère 7 — Documentation

**Fait** : [guide de la rédaction](site/LISEZ-MOI.md) (publier, écrire un
article, blocs éditoriaux, ajouter une rubrique, un auteur, un produit),
[document de conformité](SITE_CONSEIL.md) (correspondance avec le cahier des
charges, arbitrages, écarts), et le présent cahier de recette. Les outils sont
commentés en français.

## Critère 8 — Aucune anomalie bloquante ou majeure ouverte

**État au dernier passage :**

```
Site généré dans conseil/
  70 pages HTML · 12 articles · 8 rubriques · 31 sous-rubriques · 4 auteurs · 18 produits
  Page la plus lourde : maison/meilleures-gourdes-isothermes/ — 100 Ko, 16 requêtes
  Poids total du site : 1,4 Mo

Recette du site — 88 pages contrôlées.
  Aucune anomalie bloquante.
  18 remarques : identifiant d'affiliation non renseigné dans l'URL (18 produits)

Contrôles interactifs : 11/11.
```

Les 18 remarques sont attendues : elles signalent les identifiants d'affiliation
`[ID]` à renseigner par l'éditeur. Elles disparaîtront une fois les comptes
partenaires ouverts. Les autres éléments restant à compléter sont listés au
[§ 4 du document de conformité](SITE_CONSEIL.md#4-points-à-traiter-avant-une-mise-en-ligne-réelle).
