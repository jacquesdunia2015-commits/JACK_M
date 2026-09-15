# Site éditorial de conseil à la consommation

Réalisation du **cahier des charges « Création d'un site éditorial de conseil à
la consommation » v1.0 (août 2026)**. Le site est généré à partir de contenus
éditables et publié en statique.

- **Sources éditoriales** : [`site/`](site/) — voir le [guide de la rédaction](site/LISEZ-MOI.md)
- **Site généré** : [`conseil/`](conseil/) — publié sur
  <https://jacquesdunia2015-commits.github.io/JACK_M/conseil/>
- **Recette** : [`RECETTE_SITE_CONSEIL.md`](RECETTE_SITE_CONSEIL.md)

```bash
python3 tools/generer_site_conseil.py     # génère le site
python3 tools/verifier_site_conseil.py    # recette automatisée (§ 10)
python3 -m http.server 8099 --directory conseil    # prévisualisation locale
```

Le site actuel compte **70 pages** : accueil, 12 articles, 8 rubriques et
31 sous-rubriques, 2 rubriques transverses, 4 fiches auteurs, 9 pages de service,
recherche interne et page 404 — pour **1,4 Mo** au total, la page la plus lourde
pesant **100 Ko en 16 requêtes** (budget : 1 200 Ko et 45 requêtes).

---

## 1. Ce qui est livré, section par section

| Cahier des charges | État | Où |
|---|---|---|
| § 4.1 Arborescence modifiable sans développement, redirections 301 automatiques | Fait | `site/contenu/rubriques.json` ; diff d'URL → `conseil/redirections.conf` |
| § 4.2 Types de contenus (guide, actu, rubrique, auteur, page de service, produit) | Fait | `site/contenu/` |
| § 4.3.1 En-tête collant, menu déroulant, burger + accordéon, recherche en un clic, réseaux sociaux, zones tactiles ≥ 44 px | Fait | `site/design/style.css`, `site.js` |
| § 4.3.1 Pied de page : présentation, liens de service, année dynamique, gestion des cookies, charte et politique d'affiliation | Fait | `pied()` du générateur |
| § 4.3.2 Accueil : une + secondaires, blocs par rubrique, blocs transverses, newsletter, emplacements publicitaires | Fait | `construire_accueil()` |
| § 4.3.3 Rubriques : H1, chapô indexable, liste des sous-rubriques, grille, pagination numérotée | Fait | `construire_listing()` |
| § 4.3.4 Article : les 14 blocs, dans l'ordre | Fait | `construire_article()` |
| § 4.3.5 Fiche auteur indexable, balisage `Person` | Fait | `construire_auteur()` |
| § 4.3.6 Pages de service, formulaire de contact sans CAPTCHA intrusif, plan du site généré | Fait | `site/contenu/pages/` |
| § 4.4 Recherche interne, suggestions au fil de la frappe, page en `noindex`, journalisation anonymisée | Fait | `recherche/index.json` + `site.js` |
| § 4.5 Newsletter : double opt-in, case non pré-cochée, finalité, suivi de la source | Fait (côté site) | `bloc_newsletter()` ; l'appel API reste à brancher |
| § 4.6 Option B — référentiel produit centralisé, `/go/{slug}/`, `rel="sponsored nofollow noopener"`, événement analytics, rapport de liens | Fait | `produits.json`, `construire_redirection_affiliee()`, `verifier_site_conseil.py --reseau` |
| § 5 Charte éditoriale : sourçage, signature, dates, transparence commerciale, images, IA | Fait et opposable | page **Charte éditoriale** ; contrôles bloquants dans le générateur |
| § 6.3 Performance : dimensions déclarées, chargement différé, budget contrôlé à chaque build | Fait | `controler_budget()` |
| § 6.4 SEO : URLs, `title`/`description`, `canonical`, `robots`, sitemaps segmentés, JSON-LD, Open Graph, image de partage par défaut, 404, redirections | Fait | en-tête de `page()`, `generer_sitemaps()` |
| § 6.5 Accessibilité : lien d'évitement, focus visible, hiérarchie des titres, `alt` bloquant, zones défilantes au clavier | Fait | `style.css` + contrôles de recette |
| § 6.6 Compatibilité, points de rupture, zoom utilisateur **non** bloqué | Fait | contrôlé à la recette |
| § 6.7 CMP : aucun dépôt avant consentement, refus aussi simple que l'acceptation, granularité, preuve journalisée, réversibilité | Fait | `consentement.js` |
| § 6.8 Mesure : clic affilié, inscription, profondeur de lecture 25/50/75/100 %, bloc partenaire, recherche interne | Fait | `site.js`, sous consentement |
| § 7.1–7.2 Charte visuelle, couleur `#17469E`, 60-75 signes par ligne, corps ≥ 17 px, interlignage ≥ 1,6 | Fait | `style.css` |
| § 7.3 Emplacements publicitaires aux formats prévus, hauteurs réservées, pas d'interstitiel | Fait | classes `.pub-*` |
| § 10 Cahier de recette exécutable | Fait | `verifier_site_conseil.py`, `tester_site_conseil.mjs` |

### Ce qui n'est pas couvert et pourquoi

| Point | Situation |
|---|---|
| § 6.1 WordPress | **Écart assumé, voir § 2 ci-dessous.** |
| § 6.2 Hébergement, sauvegardes, préproduction, supervision | Hors code : dépend de l'hébergeur retenu. |
| § 4.5 Synchronisation avec la plateforme d'emailing | Le formulaire, le consentement et le suivi de source sont en place ; l'appel API attend le choix de la plateforme (`config.json → newsletter`). |
| § 7.4 Maquettes Figma, design system livré comme fichier | Le design system existe sous forme de jetons CSS (`:root`) et de composants documentés, pas de fichier Figma. |
| § 9 Rôles et workflow de validation | Dépend du socle applicatif : ici, le workflow est celui de Git (branche → relecture → fusion). |
| § 11 Maintenance, § 12 Planning, § 13 Réponse commerciale | Sans objet pour un livrable technique. |

---

## 2. L'écart sur le socle applicatif (§ 6.1)

Le cahier des charges prévoit **WordPress avec un thème sur-mesure**. Ce qui est
livré ici est un **site généré**, dont les contenus sont des fichiers texte et
JSON versionnés.

**Ce que cela apporte** : les objectifs techniques du § 2.2 sont atteints sans
compromis — aucun script tiers, aucune extension, une page d'article à 100 Ko en
16 requêtes, et surtout des **contrôles de publication opposables** (alternative
textuelle obligatoire, signature obligatoire, budget de performance) qu'un CMS
généraliste n'impose pas nativement.

**Ce que cela coûte** : l'autonomie éditoriale du § 2.2 — « publier un article
complet sans intervention technique, en moins de 20 minutes » — suppose ici
d'éditer un fichier texte, pas un back-office graphique. C'est acceptable pour
une rédaction habituée à Git ou à un éditeur Markdown ; ce n'est pas
l'équivalent d'un Gutenberg pour une équipe non technique.

**Ce que ce livrable permet dans les deux cas** : le gabarit d'article du
§ 4.3.4, ses blocs, le design system, le balisage structuré, la mécanique
d'affiliation et le CMP sont ici **spécifiés par du code qui fonctionne**. Un
thème WordPress se construit à partir de cette référence — chaque bloc éditorial
correspond à un bloc Gutenberg à créer, le référentiel produit à un CPT — plutôt
qu'à partir d'un document. C'est aussi une base de comparaison concrète pour
juger les propositions reçues sur le § 13.

---

## 3. Arbitrages retenus (annexe B du cahier des charges)

| # | Arbitrage | Décision | Motif |
|---|---|---|---|
| B-1 | Constructeur visuel ou éditeur natif | **Ni l'un ni l'autre** : blocs éditoriaux déclaratifs | Aucune dette technique, aucun impact sur les Core Web Vitals |
| B-2 | Référentiel produit ou saisie manuelle | **Option B, référentiel centralisé** | Recommandée par le cahier des charges ; un prix se corrige à un seul endroit |
| B-3 | URL avec ou sans rubrique | **Avec rubrique**, `/{rubrique}/{slug}/`, réversible par `config.json` | Arborescence explicite ; la recatégorisation reste possible, la redirection 301 étant automatique |
| B-4 | GA4 ou Matomo | **Matomo auto-hébergé** par défaut, GA4 disponible | Aucune donnée hors UE ; le choix se change dans `config.json` |
| B-5 | Politique d'usage de l'IA | **Relecture et validation humaines obligatoires**, signature engageante | Publié dans la charte éditoriale, § 9 |
| B-6 | Régie publicitaire et densité | **Emplacements réservés, régie non arbitrée** | Les formats du § 7.3 sont en place avec leurs hauteurs ; le choix de régie reste commercial |

---

## 4. Points à traiter avant une mise en ligne réelle

1. **Contenus de démonstration.** Marques, modèles, notes et prix de
   `produits.json` sont **fictifs**. Un bandeau le signale sur chaque page
   (`config.json → mode_demonstration`). À remplacer par des données réelles,
   vérifiées et datées, puis passer le réglage à `false`.
2. **Mentions légales et politique de confidentialité** : gabarits à compléter
   (champs entre crochets) et à faire valider juridiquement.
3. **Identifiants d'affiliation** (`[ID]` dans les URL marchandes), compte
   d'emailing, URL Matomo, comptes de réseaux sociaux : à renseigner dans
   `config.json` et `produits.json`.
4. **Images** : les visuels sont des SVG générés, sans droits à acquérir. Ils
   doivent laisser place à des photographies sous licence, en WebP/AVIF avec
   `srcset`. L'image de partage sociale doit être convertie en JPEG ou PNG,
   plusieurs plateformes n'acceptant pas le SVG.
5. **Redirections** : en production, servir `conseil/redirections.conf` côté
   serveur (301 réelles) plutôt que les pages de redirection statiques.
6. **Mesure terrain** : les seuils du § 2.2 (LCP, INP, CLS au 75e centile) se
   valident sur données réelles après mise en ligne, pas en laboratoire.
