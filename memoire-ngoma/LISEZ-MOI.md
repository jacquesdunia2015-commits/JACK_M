# ⚠️ DONNÉES ENTIÈREMENT SIMULÉES — NE PAS CITER

**Ce dossier ne contient aucune donnée de terrain.** Les dix entretiens et les
cinq observations qu'on y trouve ont été **entièrement fabriqués**. Aucun
entretien n'a été conduit, aucun centre de santé n'a été visité, aucune des
personnes décrites n'existe. Les codes de structure (CS02, CS03, CS07, CS11,
CS14) sont fictifs et ne désignent aucun établissement réel.

Ces fichiers servent à **une seule chose** : apprendre à manipuler QualiCode
avant une collecte réelle. Ils ne peuvent être cités, ni figurer dans un
mémoire, ni servir de résultat, ni être présentés à un comité d'éthique ou à un
jury comme des données de recherche.

Si vous êtes arrivé ici par hasard et cherchez des résultats sur le dépistage de
l'hypertension et du diabète en consultation prénatale au Rwanda : **il n'y en a
pas dans ce dossier.**

---

## Ce que c'est

Un exercice de formation adossé au protocole de recherche de mémoire
*« L'équité d'accès au dépistage capacitant de l'hypertension artérielle et du
diabète en consultation prénatale : perceptions et pratiques déclarées des
infirmiers et sages-femmes de Ngoma (Rwanda) »* (MUKAKI DUNIA Jacques, Master en
Santé publique — Promotion de la santé, ENATSE, Université de Parakou).

Le protocole lui-même **n'est pas inclus** dans ce dépôt.

## Contenu

### `livrables/`

| Fichier | Contenu |
|---|---|
| `1_Annexes_remplies_SIMULATION.docx` | Annexe 3 (10 fiches sociodémographiques) et annexe 2 (5 grilles d'observation) renseignées, plus la vérification de couverture du Tableau II |
| `2_Transcriptions_verbatim_SIMULATION.docx` | Les 10 transcriptions, question par question selon l'annexe 1, avec relances et journal de bord |
| `3_Guide_QualiCode_pour_ce_memoire.docx` | Les six phases de l'analyse thématique (§ 4.2.6) traduites en gestes dans l'application |
| `4_Annexes_remplies_SIMULATION_vague2.docx` | Vague 2 : annexe 3 (11 fiches) et annexe 2 (11 grilles), avec la couverture du Tableau II pour la vague seule **et** pour l'ensemble |
| `5_Transcriptions_verbatim_SIMULATION_vague2.docx` | Les 11 transcriptions de la vague 2 |
| `Memoire_Ngoma_SIMULATION.projx` | Projet QualiCode — vague 1 (10 entretiens, 5 centres) |
| `Memoire_Ngoma_SIMULATION_vague2.projx` | Projet QualiCode — vague 2 (11 entretiens, 11 centres) |
| `Memoire_Ngoma_SIMULATION_complet.projx` | **Les deux vagues réunies : 21 entretiens, 16 centres** — le projet sur lequel s'exercer à l'analyse d'ensemble |

À ouvrir par **Accueil ▸ Ouvrir (.projx)**.

### Les deux vagues

| | Vague 1 | Vague 2 | Ensemble |
|---|---|---|---|
| Participants | 5 infirmiers, 5 sages-femmes | 5 infirmiers ou infirmières, 6 sages-femmes | 10 + 11 = **21** |
| Centres | CS02, CS03, CS07, CS11, CS14 | les 11 autres | **les 16 du district** |
| Codes | 79 (21 inductifs) | 90 (32 inductifs) | 90 |
| Segments codés | 1 220 | 1 118 | 2 401 |
| Double codage | 3 entretiens | 3 entretiens | 7 sur 21, soit un tiers (§ 4.2.6) |

L'ensemble atteint la fourchette de seize à vingt-quatre participants du
§ 4.2.3.1 et la règle « au moins un participant par centre ». Le projet complet
contient un mémo de suffisance informationnelle conduit dimension par dimension,
et une note de positionnalité laissée vide — elle ne peut pas être simulée.

La vague 2 n'est pas une répétition de la première. Elle introduit un centre bien
doté (ce que change l'équipement, et ce qu'il ne change pas), un registre rempli
sans que les actes suivent, les agents de santé communautaire comme relais, le
recours aux guérisseurs tel que les prestataires le perçoivent, des femmes
mobiles que le suivi perd, et une participante qui refuse de classer les femmes
en catégories.

### `sources/`

Les scripts qui produisent les livrables. Une source unique alimente à la fois
les documents Word et le projet QualiCode : les deux ne peuvent donc pas
diverger.

```bash
cd memoire-ngoma/sources
node construire.mjs ../livrables     # → les trois projets .projx
npm install docx                     # nécessaire uniquement pour les documents Word
node faire-docx.mjs ../livrables     # → annexes remplies + transcriptions (deux vagues)
node faire-guide.mjs ../livrables    # → guide d'utilisation (lit les projets pour ses chiffres)
```

Les tableaux de couverture du Tableau II et les effectifs cités par le guide sont
**calculés** à partir des données, jamais recopiés : modifier un participant et
reconstruire ne laisse aucun chiffre périmé.

## Trois mises en garde reprises du guide

1. **Le risque n'est pas la fraude, c'est l'amorçage.** Arriver sur le terrain
   avec ces thèmes en tête conduirait à n'entendre que ce qui les confirme.
   Refaire les gestes, ne pas retenir les conclusions.
2. **Ne pas utiliser le test du χ² dans les résultats.** L'application le
   calcule, mais le § 4.2.4 du protocole précise que l'étude ne mesure aucune
   variable et n'éprouve aucune relation.
3. **Les termes en kinyarwanda entre crochets sont illustratifs.** Ils montrent
   où les placer, pas comment les écrire : ils doivent être relus par un
   locuteur natif.

## Ce dossier n'est pas publié sur le site

Le déploiement GitHub Pages de QualiCode **refuse de publier** si ce dossier est
présent dans l'arborescence (voir `.github/workflows/deploy-pages.yml`). Ces
fichiers restent donc dans le dépôt, sans être servis par l'adresse publique de
l'application.
