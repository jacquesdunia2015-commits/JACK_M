import { deflateRawSync } from 'zlib';

/**
 * Classeur Excel (.xlsx) écrit sans bibliothèque : un .xlsx est une archive
 * zip de fichiers XML. Chaque feuille a une ligne d'en-tête figée et filtrable,
 * des largeurs de colonnes et des formats (montant, nombre, pourcentage, date)
 * qu'Excel, LibreOffice et Google Sheets reconnaissent.
 */

export type TypeColonne = 'texte' | 'nombre' | 'montant' | 'pourcent' | 'date';

export interface Colonne {
  titre: string;
  type?: TypeColonne;
  largeur?: number;
}

export interface Feuille {
  nom: string;
  colonnes: Colonne[];
  lignes: unknown[][];
  /** Lignes d'information au-dessus du tableau (titre, période…). */
  entete?: string[];
}

// --- Zip minimal (méthode « deflate »), avec CRC-32 -----------------------
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(donnees: Buffer): number {
  let c = 0xffffffff;
  for (const octet of donnees) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(fichiers: { nom: string; contenu: string }[]): Buffer {
  const morceaux: Buffer[] = [];
  const central: Buffer[] = [];
  let position = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, 'utf8');
    const brut = Buffer.from(f.contenu, 'utf8');
    const comprime = deflateRawSync(brut);
    const crc = crc32(brut);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // heure et date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprime.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    morceaux.push(local, nom, comprime);

    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(0x02014b50, 0);
    entree.writeUInt16LE(20, 4);
    entree.writeUInt16LE(20, 6);
    entree.writeUInt16LE(0x0800, 8);
    entree.writeUInt16LE(8, 10);
    entree.writeUInt32LE(0, 12);
    entree.writeUInt32LE(crc, 16);
    entree.writeUInt32LE(comprime.length, 20);
    entree.writeUInt32LE(brut.length, 24);
    entree.writeUInt16LE(nom.length, 28);
    entree.writeUInt32LE(position, 42);
    central.push(entree, nom);
    position += local.length + nom.length + comprime.length;
  }
  const tailleCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...morceaux, ...central, fin]);
}

// --- Feuilles -------------------------------------------------------------
const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Caractères de contrôle interdits en XML.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function lettre(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Styles : 0 normal, 1 en-tête, 2 montant, 3 nombre, 4 pourcentage, 5 date, 6 titre.
const STYLE: Record<TypeColonne, number> = { texte: 0, montant: 2, nombre: 3, pourcent: 4, date: 5 };

/** Jours depuis le 30/12/1899 : la date telle qu'Excel la compte. */
function dateExcel(valeur: unknown): number | null {
  const d = valeur instanceof Date ? valeur : new Date(String(valeur).length === 10 ? `${valeur}T00:00:00Z` : String(valeur));
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime() / 86_400_000 + 25569;
}

function cellule(ref: string, valeur: unknown, type: TypeColonne): string {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  if (type !== 'texte') {
    const n = type === 'date' ? dateExcel(valeur) : Number(valeur);
    if (n !== null && Number.isFinite(n)) return `<c r="${ref}" s="${STYLE[type]}"><v>${n}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${echapper(String(valeur))}</t></is></c>`;
}

function xmlFeuille(f: Feuille): string {
  const lignes: string[] = [];
  let r = 1;
  for (const info of f.entete ?? []) {
    lignes.push(`<row r="${r}"><c r="A${r}" t="inlineStr" s="${r === 1 ? 6 : 0}"><is><t xml:space="preserve">${echapper(info)}</t></is></c></row>`);
    r++;
  }
  if (f.entete?.length) r++; // une ligne vide avant le tableau
  const ligneTitres = r;
  lignes.push(`<row r="${r}">${f.colonnes.map((c, i) =>
    `<c r="${lettre(i)}${r}" t="inlineStr" s="1"><is><t xml:space="preserve">${echapper(c.titre)}</t></is></c>`).join('')}</row>`);
  for (const ligne of f.lignes) {
    r++;
    lignes.push(`<row r="${r}">${f.colonnes.map((c, i) => cellule(`${lettre(i)}${r}`, ligne[i], c.type ?? 'texte')).join('')}</row>`);
  }
  const derniere = lettre(Math.max(0, f.colonnes.length - 1));
  const colonnes = f.colonnes
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur ?? (c.type === 'texte' || !c.type ? 28 : 14)}" customWidth="1"/>`)
    .join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${ligneTitres}" topLeftCell="A${ligneTitres + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${colonnes}</cols>`
    + `<sheetData>${lignes.join('')}</sheetData>`
    + (f.lignes.length ? `<autoFilter ref="A${ligneTitres}:${derniere}${ligneTitres + f.lignes.length}"/>` : '')
    + '</worksheet>';
}

/** Nom de feuille accepté par Excel : 31 caractères, sans : \ / ? * [ ]. */
const nomFeuille = (nom: string, deja: Set<string>) => {
  let n = nom.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Feuille';
  for (let i = 2; deja.has(n.toLowerCase()); i++) n = `${n.slice(0, 28)} ${i}`;
  deja.add(n.toLowerCase());
  return n;
};

export function classeur(feuilles: Feuille[]): Buffer {
  const deja = new Set<string>();
  const noms = feuilles.map((f) => nomFeuille(f.nom, deja));
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot; %&quot;"/>'
    + '<numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>'
    + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="14"/><color rgb="FF0F7B6C"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFE6F4F1"/></patternFill></fill></fills>'
    + '<borders count="1"><border/></borders>'
    + '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
    + '<cellXfs count="7"><xf/>'
    + '<xf fontId="1" fillId="2" applyFont="1" applyFill="1"/>'
    + '<xf numFmtId="164" applyNumberFormat="1"/>'
    + '<xf numFmtId="3" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" applyNumberFormat="1"/>'
    + '<xf numFmtId="166" applyNumberFormat="1"/>'
    + '<xf fontId="2" applyFont="1"/>'
    + '</cellXfs></styleSheet>';
  const fichiers = [
    {
      nom: '[Content_Types].xml',
      contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + '</Types>',
    },
    {
      nom: '_rels/.rels',
      contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    {
      nom: 'xl/workbook.xml',
      contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + `<sheets>${noms.map((n, i) => `<sheet name="${echapper(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
        + '</workbook>',
    },
    {
      nom: 'xl/_rels/workbook.xml.rels',
      contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + '</Relationships>',
    },
    { nom: 'xl/styles.xml', contenu: styles },
    ...feuilles.map((f, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, contenu: xmlFeuille(f) })),
  ];
  return zip(fichiers);
}
