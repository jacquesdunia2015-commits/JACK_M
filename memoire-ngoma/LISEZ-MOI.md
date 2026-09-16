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
| `Memoire_Ngoma_SIMULATION.projx` | Le projet QualiCode complet, à ouvrir par **Accueil ▸ Ouvrir (.projx)** |

Le projet contient 15 documents, 79 codes en 11 familles (dont 21 inductifs),
1 220 segments codés, 20 mémos, 8 requêtes sauvegardées, une carte conceptuelle
et un double codage sur trois entretiens.

### `sources/`

Les scripts qui produisent les livrables. Une source unique alimente à la fois
les documents Word et le projet QualiCode : les deux ne peuvent donc pas
diverger.

```bash
cd memoire-ngoma/sources
node construire.mjs      # → Memoire_Ngoma_SIMULATION.projx
npm install docx         # nécessaire uniquement pour les documents Word
node faire-docx.mjs      # → annexes remplies + transcriptions
node faire-guide.mjs     # → guide d'utilisation
```

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
