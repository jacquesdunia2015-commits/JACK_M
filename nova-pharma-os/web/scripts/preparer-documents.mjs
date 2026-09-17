/**
 * Prépare les documents de NOVA PHARMA OS pour l'affichage dans
 * l'application.
 *
 * Les guides vivent à la racine du dépôt, en Markdown : c'est là qu'on
 * les écrit et qu'on les relit. Ce script les convertit en fragments
 * HTML rangés dans un module TypeScript, et copie les versions Word dans
 * les fichiers publics.
 *
 * Pourquoi un module généré plutôt qu'une lecture de disque au moment de
 * l'affichage : une lecture de fichier dépend du dossier de travail du
 * serveur, qui n'est pas le même selon la façon dont on lance
 * l'application. Un module importé, lui, est figé à la construction et
 * se comporte partout de la même manière.
 *
 * Lancement : automatique avant `dev` et avant `build`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(ICI, '..');
const RACINE = resolve(WEB, '..');

const DOCUMENTS = [
  {
    id: 'que-faire',
    markdown: 'docs/QUE_FAIRE_AVEC_NOVA_PHARMA_OS.md',
    word: 'docs/word/QUE_FAIRE_AVEC_NOVA_PHARMA_OS.docx',
    titre: 'Que faire avec NOVA PHARMA OS',
    resume:
      "Ce que le produit est, ce qu'il sait faire, ce qui lui manque, et dans quel ordre avancer.",
    icone: '◈',
  },
  {
    id: 'demarrage',
    markdown: 'GUIDE_DEMARRAGE.md',
    word: 'docs/word/GUIDE_DEMARRAGE.docx',
    titre: 'Guide de démarrage',
    resume:
      "Installer et lancer l'application gratuitement, sur un ordinateur et sur les téléphones de l'équipe.",
    icone: '▷',
  },
  {
    id: 'commercial',
    markdown: 'docs/GUIDE_COMMERCIAL.md',
    word: 'docs/word/GUIDE_COMMERCIAL.docx',
    titre: 'Guide commercial',
    resume:
      "Ce que coûte le service, comment facturer les pharmacies clientes, et les étapes jusqu'à la première vente.",
    icone: '▤',
  },
];

// ---------------------------------------------------------------------
// Markdown vers HTML
//
// Couvre ce que ces documents emploient : titres, gras, italique, code,
// liens, listes, citations, tableaux, filets. Pas davantage — le reste
// n'apparaît pas dans ces textes, et un convertisseur complet serait
// beaucoup de code sans lecteur.
// ---------------------------------------------------------------------
// Marqueur de mise de côté des extraits de code. Il doit être absent des
// documents : deux arobases suivies d'un mot n'apparaissent dans aucun
// des trois.
const MARQUE_CODE = '@@NOVACODE@@';

function echapper(texte) {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function enLigne(texte) {
  // Le code est mis de côté en premier : son contenu ne doit pas être
  // relu comme du Markdown, sinon des astérisques à l'intérieur d'un
  // extrait deviendraient du gras.
  const codes = [];
  let travail = texte.replace(/`([^`]+)`/g, (_, contenu) => {
    codes.push(echapper(contenu));
    return `${MARQUE_CODE}${codes.length - 1}${MARQUE_CODE}`;
  });

  travail = echapper(travail);
  travail = travail.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, libelle, cible) =>
    // Les guides renvoient soit vers l'extérieur, soit vers un autre
    // fichier du dépôt. Le second cas ne mène nulle part depuis un
    // navigateur : il est rendu en simple relief, sans lien mort.
    /^https?:/.test(cible)
      ? `<a href="${cible}" target="_blank" rel="noreferrer">${libelle}</a>`
      : `<span class="doc-renvoi">${libelle}</span>`,
  );
  travail = travail.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  travail = travail.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  const reprise = new RegExp(`${MARQUE_CODE}(\\d+)${MARQUE_CODE}`, 'g');
  return travail.replace(reprise, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

function cellules(ligne) {
  return ligne
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

function versHtml(markdown) {
  const lignes = markdown.split('\n');
  const sortie = [];
  let i = 0;

  while (i < lignes.length) {
    const nu = lignes[i].trim();

    if (!nu) {
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(nu)) {
      sortie.push('<hr/>');
      i += 1;
      continue;
    }

    const titre = nu.match(/^(#{1,6})\s+(.*)$/);
    if (titre) {
      // Le titre du document occupe déjà le h1 de la page : les niveaux
      // du corps descendent tous d'un cran.
      const niveau = Math.min(titre[1].length + 1, 6);
      sortie.push(`<h${niveau}>${enLigne(titre[2])}</h${niveau}>`);
      i += 1;
      continue;
    }

    if (nu.startsWith('```')) {
      i += 1;
      const bloc = [];
      while (i < lignes.length && !lignes[i].trim().startsWith('```')) {
        bloc.push(echapper(lignes[i]));
        i += 1;
      }
      i += 1;
      sortie.push(`<pre><code>${bloc.join('\n')}</code></pre>`);
      continue;
    }

    if (
      nu.startsWith('|') &&
      i + 1 < lignes.length &&
      /^\|[\s:|-]+\|$/.test(lignes[i + 1].trim())
    ) {
      const entetes = cellules(nu);
      i += 2;
      const corps = [];
      while (i < lignes.length && lignes[i].trim().startsWith('|')) {
        corps.push(cellules(lignes[i]));
        i += 1;
      }
      const th = entetes.map((c) => `<th>${enLigne(c)}</th>`).join('');
      const tr = corps
        .map((r) => `<tr>${r.map((c) => `<td>${enLigne(c)}</td>`).join('')}</tr>`)
        .join('');
      sortie.push(
        `<div class="doc-tableau"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`,
      );
      continue;
    }

    if (nu.startsWith('>')) {
      const bloc = [];
      while (i < lignes.length && lignes[i].trim().startsWith('>')) {
        bloc.push(lignes[i].trim().replace(/^>+\s?/, ''));
        i += 1;
      }
      const paragraphes = bloc
        .join('\n')
        .split('\n\n')
        .map((p) => p.replace(/\n/g, ' ').trim())
        .filter(Boolean)
        .map((p) => `<p>${enLigne(p)}</p>`)
        .join('');
      sortie.push(`<blockquote>${paragraphes}</blockquote>`);
      continue;
    }

    if (/^([-*+]|\d+\.)\s+/.test(nu)) {
      const ordonnee = /^\d+\.\s/.test(nu);
      const elements = [];
      while (i < lignes.length) {
        const courante = lignes[i];
        const debut = courante.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
        if (debut) {
          elements.push(debut[1].trim());
          i += 1;
        } else if (courante.trim() && /^[ \t]/.test(courante) && elements.length) {
          // Ligne de continuation indentée : elle appartient au point
          // précédent, pas à un nouveau.
          elements[elements.length - 1] += ` ${courante.trim()}`;
          i += 1;
        } else {
          break;
        }
      }
      const balise = ordonnee ? 'ol' : 'ul';
      sortie.push(
        `<${balise}>${elements.map((e) => `<li>${enLigne(e)}</li>`).join('')}</${balise}>`,
      );
      continue;
    }

    const bloc = [];
    while (
      i < lignes.length &&
      lignes[i].trim() &&
      !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|\||```|-{3,}$)/.test(lignes[i])
    ) {
      bloc.push(lignes[i].trim());
      i += 1;
    }
    if (bloc.length) sortie.push(`<p>${enLigne(bloc.join(' '))}</p>`);
    else i += 1;
  }

  return sortie.join('\n');
}

// ---------------------------------------------------------------------

const dossierPublic = join(WEB, 'public/documents');
mkdirSync(dossierPublic, { recursive: true });
mkdirSync(join(WEB, 'src/contenu'), { recursive: true });

const prepares = [];
for (const doc of DOCUMENTS) {
  const source = join(RACINE, doc.markdown);
  if (!existsSync(source)) {
    console.warn(`  ! document introuvable, ignoré : ${doc.markdown}`);
    continue;
  }

  const markdown = readFileSync(source, 'utf8');
  // La première ligne « # Titre » devient l'en-tête de la page : elle est
  // retirée du corps pour ne pas s'afficher deux fois.
  const sansTitre = markdown.replace(/^#\s+.*\n/, '');

  let fichierWord = null;
  const word = join(RACINE, doc.word);
  if (existsSync(word)) {
    const nom = doc.word.split('/').pop();
    copyFileSync(word, join(dossierPublic, nom));
    fichierWord = `/documents/${nom}`;
  }

  prepares.push({
    id: doc.id,
    titre: doc.titre,
    resume: doc.resume,
    icone: doc.icone,
    html: versHtml(sansTitre),
    fichierWord,
  });
}

const module = `/**
 * Documents de NOVA PHARMA OS, convertis depuis le Markdown du dépôt.
 *
 * FICHIER GÉNÉRÉ — ne pas modifier à la main. Il est réécrit par
 * \`scripts/preparer-documents.mjs\`, lancé avant chaque \`dev\` et chaque
 * \`build\`. Pour changer un texte, modifiez le Markdown à la racine du
 * dépôt.
 */
export interface DocumentAide {
  id: string;
  titre: string;
  resume: string;
  icone: string;
  /** Fragment HTML produit à la construction, depuis nos propres fichiers. */
  html: string;
  /** Chemin du .docx à télécharger, null si le fichier n'a pas été généré. */
  fichierWord: string | null;
}

export const DOCUMENTS: DocumentAide[] = ${JSON.stringify(prepares, null, 2)};

export function trouverDocument(id: string): DocumentAide | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}
`;

writeFileSync(join(WEB, 'src/contenu/documents.ts'), module, 'utf8');
console.log(`  ${prepares.length} document(s) préparé(s) pour l'application`);
