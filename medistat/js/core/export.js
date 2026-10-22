// medistat/js/core/export.js
// Exports, impressions et échanges de données — articles 8.3 et 18.
// Génération PDF (moteur interne, sans bibliothèque), CSV, Excel (SpreadsheetML
// et XLSX réel), JSON, et interopérabilité HL7 FHIR R4 avec codification LOINC.

import { calculerAge, interpreterResultat } from "./model.js";

/* ===================== Téléchargement ===================== */

export function telecharger(contenu, nomFichier, type = "application/octet-stream") {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ===================== CSV ===================== */

// Séparateur point-virgule et BOM UTF-8 : c'est ce qu'attend Excel en
// configuration française. Sans cela, les accents sont illisibles.
export function versCSV(lignes, entetes = null, { separateur = ";", bom = true } = {}) {
  const echapper = v => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return new RegExp(`["${separateur}\n\r]`).test(s)
      ? '"' + s.replaceAll('"', '""') + '"'
      : s;
  };
  const cols = entetes || (lignes.length ? Object.keys(lignes[0]) : []);
  const out = [cols.map(echapper).join(separateur)];
  for (const l of lignes) {
    out.push(cols.map(c => echapper(Array.isArray(l) ? l[cols.indexOf(c)] : l[c])).join(separateur));
  }
  return (bom ? "﻿" : "") + out.join("\r\n");
}

// Lecture d'un CSV, avec détection automatique du séparateur
export function depuisCSV(texte, { separateur = null } = {}) {
  let t = String(texte).replace(/^﻿/, "");
  const sep = separateur || detecterSeparateur(t);
  const lignes = [];
  let champ = "", ligne = [], dansGuillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else if (c !== "\r") champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  if (!lignes.length) return { entetes: [], lignes: [], objets: [] };
  const entetes = lignes[0].map(h => h.trim());
  const corps = lignes.slice(1).filter(l => l.some(c => String(c).trim() !== ""));
  return {
    entetes, lignes: corps, separateur: sep,
    objets: corps.map(l => Object.fromEntries(entetes.map((h, i) => [h, l[i] ?? ""]))),
  };
}

function detecterSeparateur(texte) {
  const premiere = texte.split(/\r?\n/)[0] || "";
  const candidats = [";", ",", "\t", "|"];
  let meilleur = ";", max = 0;
  for (const c of candidats) {
    const n = premiere.split(c).length - 1;
    if (n > max) { max = n; meilleur = c; }
  }
  return meilleur;
}

/* ===================== Excel ===================== */

// Classeur XLSX authentique — archive ZIP conforme à la norme OOXML.
// Écrit sans bibliothèque : le ZIP est assemblé octet par octet (stockage
// sans compression, parfaitement valide et accepté par Excel et LibreOffice).
export function versXLSX(feuilles) {
  // feuilles : [{ nom, entetes, lignes }]
  const fichiers = [];
  const esc = s => String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  const colonne = n => {
    let s = "";
    n++;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  const feuillesXml = feuilles.map((f, fi) => {
    const lignes = [];
    const toutes = [f.entetes, ...f.lignes];
    toutes.forEach((ligne, ri) => {
      const cellules = (ligne || []).map((v, ci) => {
        const ref = `${colonne(ci)}${ri + 1}`;
        const num = typeof v === "number" ? v
          : (typeof v === "string" && v !== "" && Number.isFinite(Number(v.replace(",", "."))) &&
             /^-?[\d\s.,]+$/.test(v) ? Number(v.replace(/\s/g, "").replace(",", ".")) : null);
        if (num !== null && Number.isFinite(num)) {
          return `<c r="${ref}"${ri === 0 ? ' s="1"' : ""}><v>${num}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join("");
      lignes.push(`<row r="${ri + 1}">${cellules}</row>`);
    });
    const nbCols = Math.max(...toutes.map(l => (l || []).length), 1);
    return {
      nom: `xl/worksheets/sheet${fi + 1}.xml`,
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${Array.from({ length: nbCols }, (_, i) =>
  `<col min="${i + 1}" max="${i + 1}" width="18" customWidth="1"/>`).join("")}</cols>
<sheetData>${lignes.join("")}</sheetData></worksheet>`,
    };
  });

  fichiers.push({
    nom: "[Content_Types].xml",
    contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`,
  });
  fichiers.push({
    nom: "_rels/.rels",
    contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  });
  fichiers.push({
    nom: "xl/workbook.xml",
    contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${feuilles.map((f, i) =>
  `<sheet name="${esc((f.nom || `Feuille${i + 1}`).slice(0, 31).replace(/[\\/?*[\]:]/g, "-"))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`,
  });
  fichiers.push({
    nom: "xl/_rels/workbook.xml.rels",
    contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });
  // Style 1 : entêtes en gras sur fond bleu
  fichiers.push({
    nom: "xl/styles.xml",
    contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17334F"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`,
  });
  fichiers.push(...feuillesXml);

  return construireZip(fichiers);
}

/* ===================== Archive ZIP (sans compression) ===================== */

// Implémentation minimale du format ZIP : suffisante pour produire des .xlsx
// valides et des paquets de sauvegarde, sans dépendance externe.
function construireZip(fichiers) {
  const encodeur = new TextEncoder();
  const entrees = fichiers.map(f => ({
    nom: encodeur.encode(f.nom),
    donnees: typeof f.contenu === "string" ? encodeur.encode(f.contenu) : f.contenu,
  }));

  const morceaux = [];
  const central = [];
  let offset = 0;

  for (const e of entrees) {
    const crc = crc32(e.donnees);
    const entete = new Uint8Array(30 + e.nom.length);
    const vue = new DataView(entete.buffer);
    vue.setUint32(0, 0x04034b50, true);   // signature d'entrée locale
    vue.setUint16(4, 20, true);            // version minimale
    vue.setUint16(6, 0x0800, true);        // drapeau : noms de fichiers en UTF-8
    vue.setUint16(8, 0, true);             // méthode : stockage
    vue.setUint16(10, 0, true);            // heure
    vue.setUint16(12, 0x21, true);         // date (1er janvier 1980)
    vue.setUint32(14, crc, true);
    vue.setUint32(18, e.donnees.length, true);
    vue.setUint32(22, e.donnees.length, true);
    vue.setUint16(26, e.nom.length, true);
    vue.setUint16(28, 0, true);
    entete.set(e.nom, 30);
    morceaux.push(entete, e.donnees);

    const cd = new Uint8Array(46 + e.nom.length);
    const vc = new DataView(cd.buffer);
    vc.setUint32(0, 0x02014b50, true);     // signature d'entrée centrale
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, 0, true);
    vc.setUint16(14, 0x21, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, e.donnees.length, true);
    vc.setUint32(24, e.donnees.length, true);
    vc.setUint16(28, e.nom.length, true);
    vc.setUint32(42, offset, true);
    cd.set(e.nom, 46);
    central.push(cd);

    offset += entete.length + e.donnees.length;
  }

  const tailleCentral = central.reduce((a, c) => a + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, entrees.length, true);
  vf.setUint16(10, entrees.length, true);
  vf.setUint32(12, tailleCentral, true);
  vf.setUint32(16, offset, true);

  return new Blob([...morceaux, ...central, fin],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

let tableCRC = null;
function crc32(donnees) {
  if (!tableCRC) {
    tableCRC = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCRC[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) {
    crc = tableCRC[(crc ^ donnees[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ===================== PDF ===================== */

// Moteur PDF interne. Produit un document PDF 1.4 valide, en polices standard
// (Helvetica), avec pagination, en-tête, pied de page et tableaux.
// Encodage WinAnsi : les accents français sont correctement rendus.
export class DocumentPDF {
  constructor({ format = "A4", marge = 50, titre = "Document", auteur = "MediStat" } = {}) {
    const formats = { A4: [595.28, 841.89], A5: [419.53, 595.28], Letter: [612, 792] };
    [this.largeur, this.hauteur] = formats[format] || formats.A4;
    this.marge = marge;
    this.titre = titre;
    this.auteur = auteur;
    this.pages = [];
    this.contenu = [];
    this.y = this.hauteur - marge;
    this.numeroPage = 0;
    this.entete = null;
    this.piedDePage = null;
    this.nouvellePage();
  }

  nouvellePage() {
    if (this.contenu.length) this.pages.push(this.contenu.join("\n"));
    this.contenu = [];
    this.numeroPage++;
    this.y = this.hauteur - this.marge;
    if (this.entete) this.entete(this);
  }

  // Échappement et conversion vers WinAnsi (CP1252)
  _txt(s) {
    const str = String(s ?? "");
    let out = "";
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (ch === "\\" || ch === "(" || ch === ")") { out += "\\" + ch; continue; }
      if (c < 128) { out += ch; continue; }
      // Caractères spécifiques à WinAnsi
      const winansi = {
        "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
        "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "'": 145,
        "'": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
        "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159,
      };
      const code = winansi[ch] ?? (c <= 255 ? c : null);
      if (code === null) { out += "?"; continue; }  // hors WinAnsi
      out += "\\" + code.toString(8).padStart(3, "0");
    }
    return out;
  }

  // Largeur approchée d'un texte, pour centrer et découper les lignes
  largeurTexte(texte, taille = 10, gras = false) {
    // Helvetica : largeur moyenne ≈ 0,50 em, gras ≈ 0,55 em
    const facteur = gras ? 0.55 : 0.5;
    let l = 0;
    for (const c of String(texte)) {
      l += "iljtfI.,;:'|!".includes(c) ? 0.28 : "mwMW@".includes(c) ? 0.83 : facteur;
    }
    return l * taille;
  }

  texte(txt, x, y, { taille = 10, gras = false, couleur = null, aligne = "gauche" } = {}) {
    const police = gras ? "/F2" : "/F1";
    let posX = x;
    if (aligne === "centre") posX = x - this.largeurTexte(txt, taille, gras) / 2;
    else if (aligne === "droite") posX = x - this.largeurTexte(txt, taille, gras);
    const c = couleur ? `${couleur.join(" ")} rg\n` : "0 0 0 rg\n";
    this.contenu.push(`BT\n${c}${police} ${taille} Tf\n${posX.toFixed(2)} ${y.toFixed(2)} Td\n(${this._txt(txt)}) Tj\nET`);
    return this;
  }

  ligne(txt, options = {}) {
    const taille = options.taille || 10;
    const interligne = options.interligne || taille * 1.45;
    if (this.y - interligne < this.marge + 40) this.nouvellePage();
    this.y -= interligne;
    this.texte(txt, options.x ?? this.marge, this.y, options);
    return this;
  }

  // Paragraphe avec retour à la ligne automatique
  paragraphe(txt, options = {}) {
    const taille = options.taille || 10;
    const largeurMax = options.largeur || (this.largeur - 2 * this.marge);
    const mots = String(txt).split(/\s+/);
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? ligne + " " + mot : mot;
      if (this.largeurTexte(essai, taille, options.gras) > largeurMax && ligne) {
        this.ligne(ligne, options);
        ligne = mot;
      } else ligne = essai;
    }
    if (ligne) this.ligne(ligne, options);
    return this;
  }

  espace(h = 10) { this.y -= h; return this; }

  trait(options = {}) {
    const y = options.y ?? this.y - 4;
    const c = options.couleur || [0.75, 0.78, 0.82];
    this.contenu.push(
      `${c.join(" ")} RG\n${options.epaisseur || 0.8} w\n` +
      `${options.x1 ?? this.marge} ${y.toFixed(2)} m ${options.x2 ?? (this.largeur - this.marge)} ${y.toFixed(2)} l S`);
    return this;
  }

  rectangle(x, y, l, h, { remplissage = null, bordure = null, epaisseur = 0.8 } = {}) {
    let ops = "";
    if (remplissage) ops += `${remplissage.join(" ")} rg\n`;
    if (bordure) ops += `${bordure.join(" ")} RG\n${epaisseur} w\n`;
    const mode = remplissage && bordure ? "B" : remplissage ? "f" : "S";
    this.contenu.push(`${ops}${x.toFixed(2)} ${y.toFixed(2)} ${l.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    return this;
  }

  // Tableau paginé : l'en-tête se répète sur chaque page
  tableau(entetes, lignes, options = {}) {
    const largeurTotale = this.largeur - 2 * this.marge;
    const largeurs = options.largeurs ||
      entetes.map(() => largeurTotale / entetes.length);
    const taille = options.taille || 9;
    const hauteurLigne = options.hauteurLigne || 18;
    const couleurEntete = options.couleurEntete || [0.09, 0.2, 0.31];
    const alignements = options.alignements || entetes.map(() => "gauche");

    const dessinerEntete = () => {
      if (this.y - hauteurLigne < this.marge + 40) this.nouvellePage();
      this.y -= hauteurLigne;
      this.rectangle(this.marge, this.y - 4, largeurTotale, hauteurLigne, { remplissage: couleurEntete });
      let x = this.marge;
      entetes.forEach((h, i) => {
        const px = alignements[i] === "droite" ? x + largeurs[i] - 5
          : alignements[i] === "centre" ? x + largeurs[i] / 2 : x + 5;
        this.texte(h, px, this.y + 1, {
          taille, gras: true, couleur: [1, 1, 1],
          aligne: alignements[i] === "gauche" ? "gauche" : alignements[i],
        });
        x += largeurs[i];
      });
    };

    dessinerEntete();
    lignes.forEach((ligne, ri) => {
      if (this.y - hauteurLigne < this.marge + 40) { this.nouvellePage(); dessinerEntete(); }
      this.y -= hauteurLigne;
      if (ri % 2 === 1) {
        this.rectangle(this.marge, this.y - 4, largeurTotale, hauteurLigne, { remplissage: [0.96, 0.97, 0.98] });
      }
      let x = this.marge;
      ligne.forEach((cell, i) => {
        const valeur = cell && typeof cell === "object" ? cell.texte : cell;
        const couleur = cell && typeof cell === "object" ? cell.couleur : null;
        const gras = cell && typeof cell === "object" ? cell.gras : false;
        const px = alignements[i] === "droite" ? x + largeurs[i] - 5
          : alignements[i] === "centre" ? x + largeurs[i] / 2 : x + 5;
        // Tronque proprement si la colonne est trop étroite
        let txt = String(valeur ?? "");
        while (this.largeurTexte(txt, taille, gras) > largeurs[i] - 10 && txt.length > 3) {
          txt = txt.slice(0, -2) + "…";
        }
        this.texte(txt, px, this.y + 1, {
          taille, gras, couleur,
          aligne: alignements[i] === "gauche" ? "gauche" : alignements[i],
        });
        x += largeurs[i];
      });
      this.trait({ y: this.y - 5, couleur: [0.88, 0.9, 0.92], epaisseur: 0.4 });
    });
    this.y -= 6;
    return this;
  }

  // Assemblage final du fichier PDF
  produire() {
    if (this.contenu.length) this.pages.push(this.contenu.join("\n"));
    if (this.piedDePage) {
      // Le pied de page est ajouté après coup, car il mentionne le nombre total
      this.pages = this.pages.map((p, i) => {
        const sauvegarde = this.contenu;
        this.contenu = [];
        this.piedDePage(this, i + 1, this.pages.length);
        const pied = this.contenu.join("\n");
        this.contenu = sauvegarde;
        return p + "\n" + pied;
      });
    }

    const objets = [];
    const ajouter = s => { objets.push(s); return objets.length; };

    const nbPages = this.pages.length;
    const idPages = 1;
    const idCatalogue = 2;
    const idPoliceR = 3, idPoliceG = 4;
    let idCourant = 5;
    const idsPages = [], idsContenus = [];
    for (let i = 0; i < nbPages; i++) { idsPages.push(idCourant++); idsContenus.push(idCourant++); }
    const idInfo = idCourant++;

    objets[idPages - 1] = `<< /Type /Pages /Kids [${idsPages.map(i => `${i} 0 R`).join(" ")}] /Count ${nbPages} >>`;
    objets[idCatalogue - 1] = `<< /Type /Catalog /Pages ${idPages} 0 R >>`;
    objets[idPoliceR - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objets[idPoliceG - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    this.pages.forEach((flux, i) => {
      objets[idsPages[i] - 1] =
        `<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 ${this.largeur.toFixed(2)} ${this.hauteur.toFixed(2)}] ` +
        `/Resources << /Font << /F1 ${idPoliceR} 0 R /F2 ${idPoliceG} 0 R >> >> /Contents ${idsContenus[i]} 0 R >>`;
      objets[idsContenus[i] - 1] = `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`;
    });
    const dateP = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15).replace("T", "");
    objets[idInfo - 1] =
      `<< /Title (${this._txt(this.titre)}) /Author (${this._txt(this.auteur)}) ` +
      `/Producer (MediStat) /CreationDate (D:${dateP}Z) >>`;

    let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets = [0];
    for (let i = 0; i < objets.length; i++) {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${objets[i] || "<< >>"}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objets.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objets.length + 1} /Root ${idCatalogue} 0 R /Info ${idInfo} 0 R >>\n`;
    pdf += `startxref\n${xref}\n%%EOF`;

    // Conversion en octets sans altérer les caractères déjà encodés en Latin-1
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: "application/pdf" });
  }
}

/* ===================== Compte rendu de laboratoire ===================== */

// Rendu PDF d'un compte rendu d'analyses, conforme à la mise en page attendue
// d'un formulaire clinique (article 18).
export function compteRenduLaboratoire({
  etablissement, patient, demande, resultats, tests, validateur, signature,
}) {
  const pdf = new DocumentPDF({
    titre: `Compte rendu d'analyses — ${patient.nom} ${patient.prenom}`,
    auteur: etablissement?.nom || "MediStat",
  });

  pdf.entete = d => {
    d.rectangle(0, d.hauteur - 78, d.largeur, 78, { remplissage: [0.09, 0.2, 0.31] });
    d.texte(etablissement?.nom || "Établissement de santé", d.marge, d.hauteur - 34,
      { taille: 16, gras: true, couleur: [1, 1, 1] });
    const coords = [etablissement?.adresse, etablissement?.ville, etablissement?.telephone]
      .filter(Boolean).join(" — ");
    if (coords) d.texte(coords, d.marge, d.hauteur - 52, { taille: 8, couleur: [0.8, 0.85, 0.9] });
    d.texte("COMPTE RENDU D'ANALYSES", d.largeur - d.marge, d.hauteur - 34,
      { taille: 12, gras: true, couleur: [1, 1, 1], aligne: "droite" });
    d.texte(`N° ${demande.numero || demande.id}`, d.largeur - d.marge, d.hauteur - 52,
      { taille: 9, couleur: [0.8, 0.85, 0.9], aligne: "droite" });
    d.y = d.hauteur - 100;
  };

  pdf.piedDePage = (d, page, total) => {
    d.trait({ y: 58, couleur: [0.8, 0.82, 0.85] });
    d.texte(
      "Document produit par MediStat — la validité de ce compte rendu est attestée par la signature électronique du biologiste.",
      d.marge, 44, { taille: 7, couleur: [0.45, 0.5, 0.55] });
    d.texte(`Page ${page} / ${total}`, d.largeur - d.marge, 44,
      { taille: 8, couleur: [0.45, 0.5, 0.55], aligne: "droite" });
  };

  pdf.entete(pdf);

  // Bloc d'identification du patient
  const age = calculerAge(patient.dateNaissance);
  pdf.rectangle(pdf.marge, pdf.y - 74, pdf.largeur - 2 * pdf.marge, 76,
    { remplissage: [0.96, 0.97, 0.98], bordure: [0.85, 0.87, 0.9] });
  const c1 = pdf.marge + 12, c2 = pdf.largeur / 2 + 10;
  let ly = pdf.y - 12;
  pdf.texte("PATIENT", c1, ly, { taille: 8, gras: true, couleur: [0.35, 0.4, 0.45] });
  pdf.texte("EXAMEN", c2, ly, { taille: 8, gras: true, couleur: [0.35, 0.4, 0.45] });
  ly -= 15;
  pdf.texte(`${patient.nom.toUpperCase()} ${patient.prenom}`, c1, ly, { taille: 11, gras: true });
  pdf.texte(`Prescripteur : ${demande.prescripteurNom || "—"}`, c2, ly, { taille: 9 });
  ly -= 13;
  pdf.texte(`IPP : ${patient.ipp}   —   ${patient.sexe === "F" ? "Féminin" : patient.sexe === "M" ? "Masculin" : "—"}   —   ${age?.label || "—"}`,
    c1, ly, { taille: 9 });
  pdf.texte(`Prélèvement : ${formaterDate(demande.datePrelevement || demande.date)}`, c2, ly, { taille: 9 });
  ly -= 13;
  pdf.texte(`Né(e) le ${formaterDate(patient.dateNaissance, false)}`, c1, ly, { taille: 9 });
  pdf.texte(`Édition : ${formaterDate(new Date())}`, c2, ly, { taille: 9 });
  pdf.y -= 90;

  // Résultats groupés par catégorie d'examen
  const parCategorie = new Map();
  for (const r of resultats) {
    const test = tests.find(t => t.code === r.testCode) || {};
    const cat = test.categorie || "AUTRES";
    if (!parCategorie.has(cat)) parCategorie.set(cat, []);
    parCategorie.get(cat).push({ r, test });
  }

  let anomalies = 0, critiques = 0;
  for (const [categorie, entrees] of parCategorie) {
    pdf.espace(8);
    pdf.ligne(categorie, { taille: 11, gras: true, couleur: [0.09, 0.2, 0.31] });
    pdf.trait({ couleur: [0.09, 0.2, 0.31], epaisseur: 1 });
    pdf.espace(2);

    const lignes = entrees.map(({ r, test }) => {
      const interpretation = interpreterResultat(r.valeur, test);
      if (interpretation.horsNorme) anomalies++;
      if (interpretation.critique) critiques++;
      const couleur = interpretation.critique ? [0.86, 0.15, 0.15]
        : interpretation.horsNorme ? [0.85, 0.5, 0.05] : null;
      const ref = (Number.isFinite(Number(test.valeurRefMin)) && Number.isFinite(Number(test.valeurRefMax)))
        ? `${formaterNombre(test.valeurRefMin)} – ${formaterNombre(test.valeurRefMax)}` : "—";
      return [
        test.nom || r.testCode,
        { texte: r.valeurTexte != null && r.valeurTexte !== "" ? String(r.valeurTexte) : formaterNombre(r.valeur),
          gras: true, couleur },
        test.unite || "",
        ref,
        { texte: interpretation.symbole || "", couleur, gras: true },
      ];
    });

    pdf.tableau(["Analyse", "Résultat", "Unité", "Valeurs de référence", ""], lignes, {
      largeurs: [175, 80, 55, 130, 55],
      alignements: ["gauche", "droite", "gauche", "centre", "centre"],
    });
  }

  // Commentaire du biologiste
  const commentaires = resultats.filter(r => r.commentaireBiologiste).map(r => r.commentaireBiologiste);
  if (commentaires.length) {
    pdf.espace(10);
    pdf.ligne("COMMENTAIRE DU BIOLOGISTE", { taille: 9, gras: true, couleur: [0.35, 0.4, 0.45] });
    for (const c of [...new Set(commentaires)]) pdf.paragraphe(c, { taille: 9 });
  }

  // Alerte sur valeurs critiques
  if (critiques > 0) {
    pdf.espace(10);
    pdf.rectangle(pdf.marge, pdf.y - 30, pdf.largeur - 2 * pdf.marge, 32,
      { remplissage: [0.99, 0.92, 0.92], bordure: [0.86, 0.15, 0.15] });
    pdf.texte(`⚠ ${critiques} VALEUR(S) CRITIQUE(S) — le prescripteur doit être alerté sans délai.`,
      pdf.marge + 12, pdf.y - 19, { taille: 10, gras: true, couleur: [0.7, 0.1, 0.1] });
    pdf.y -= 42;
  }

  // Signature électronique
  pdf.espace(14);
  pdf.trait();
  pdf.espace(6);
  if (signature) {
    pdf.ligne(`Validé et signé électroniquement par ${signature.signataireNom}`,
      { taille: 9, gras: true });
    pdf.ligne(`${signature.signataireRole === "biologiste" ? "Biologiste médical" : signature.signataireRole} — le ${formaterDate(signature.date)}`,
      { taille: 8, couleur: [0.4, 0.45, 0.5] });
    pdf.ligne(`Empreinte d'intégrité (SHA-256) : ${signature.empreinteContenu.slice(0, 32)}…`,
      { taille: 7, couleur: [0.55, 0.58, 0.62] });
  } else {
    pdf.ligne("DOCUMENT NON VALIDÉ — résultats provisoires, ne pas utiliser à des fins diagnostiques.",
      { taille: 9, gras: true, couleur: [0.86, 0.15, 0.15] });
  }

  return { pdf, blob: pdf.produire(), anomalies, critiques };
}

// Écriture française des nombres : virgule décimale. Un compte rendu médical
// francophone affichant « 1.26 g/L » passe pour un document mal localisé.
function formaterNombre(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return String(v);
  return String(n).replace(".", ",");
}

function formaterDate(d, avecHeure = true) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = date.getFullYear();
  if (!avecHeure) return `${jj}/${mm}/${aaaa}`;
  return `${jj}/${mm}/${aaaa} à ${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

/* ===================== HL7 FHIR R4 (article 8.3) ===================== */

// Conversion des entités de la Solution vers les ressources FHIR standard,
// afin de permettre l'interconnexion avec d'autres systèmes de santé.

export function patientVersFHIR(patient, etablissement) {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: [{
      use: "usual",
      system: `urn:oid:medistat:${etablissement?.code || "ETS"}:ipp`,
      value: patient.ipp,
    }],
    active: !patient.archive,
    name: [{ use: "official", family: patient.nom, given: [patient.prenom].filter(Boolean) }],
    telecom: [
      patient.telephone ? { system: "phone", value: patient.telephone, use: "mobile" } : null,
      patient.email ? { system: "email", value: patient.email } : null,
    ].filter(Boolean),
    gender: patient.sexe === "M" ? "male" : patient.sexe === "F" ? "female" : "other",
    birthDate: patient.dateNaissance,
    address: patient.adresse ? [{
      use: "home", text: patient.adresse, city: patient.ville, country: patient.pays,
    }] : [],
    managingOrganization: etablissement ? { reference: `Organization/${etablissement.id}`, display: etablissement.nom } : undefined,
  };
}

export function resultatVersFHIR(resultat, test, patient, demande) {
  const interpretation = interpreterResultat(resultat.valeur, test);
  const codeInterpretation = interpretation.statut === "haut" || interpretation.statut === "critique_haut" ? "H"
    : interpretation.statut === "bas" || interpretation.statut === "critique_bas" ? "L" : "N";
  const numerique = Number(String(resultat.valeur).replace(",", "."));

  return {
    resourceType: "Observation",
    id: resultat.id,
    status: resultat.statut === "valide" || resultat.statut === "rendu" ? "final"
      : resultat.statut === "corrige" ? "corrected" : "preliminary",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: "laboratory", display: "Laboratory",
      }],
    }],
    // Codification LOINC lorsqu'elle est renseignée au catalogue
    code: {
      coding: [
        test?.loinc ? { system: "http://loinc.org", code: test.loinc, display: test.nom } : null,
        { system: "urn:oid:medistat:tests", code: resultat.testCode, display: test?.nom || resultat.testCode },
      ].filter(Boolean),
      text: test?.nom || resultat.testCode,
    },
    subject: { reference: `Patient/${patient.id}`, display: `${patient.nom} ${patient.prenom}` },
    effectiveDateTime: demande?.datePrelevement || resultat.dateSaisie,
    issued: resultat.dateValidation || resultat.dateSaisie,
    performer: resultat.validePar ? [{ reference: `Practitioner/${resultat.validePar}` }] : [],
    ...(Number.isFinite(numerique)
      ? { valueQuantity: { value: numerique, unit: test?.unite || resultat.unite, system: "http://unitsofmeasure.org" } }
      : { valueString: String(resultat.valeurTexte ?? resultat.valeur ?? "") }),
    interpretation: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
        code: interpretation.critique ? (codeInterpretation === "H" ? "HH" : "LL") : codeInterpretation,
        display: interpretation.label,
      }],
    }],
    referenceRange: (Number.isFinite(Number(test?.valeurRefMin)) || Number.isFinite(Number(test?.valeurRefMax))) ? [{
      low: Number.isFinite(Number(test?.valeurRefMin))
        ? { value: Number(test.valeurRefMin), unit: test.unite } : undefined,
      high: Number.isFinite(Number(test?.valeurRefMax))
        ? { value: Number(test.valeurRefMax), unit: test.unite } : undefined,
    }] : [],
    note: resultat.commentaireBiologiste ? [{ text: resultat.commentaireBiologiste }] : [],
  };
}

export function demandeVersFHIR(demande, patient) {
  return {
    resourceType: "ServiceRequest",
    id: demande.id,
    identifier: [{ value: demande.numero }],
    status: demande.statut === "rendue" ? "completed"
      : demande.statut === "annulee" ? "revoked" : "active",
    intent: "order",
    priority: demande.urgence === "vital" ? "stat" : demande.urgence === "urgent" ? "urgent" : "routine",
    category: [{
      coding: [{ system: "http://snomed.info/sct", code: "108252007", display: "Laboratory procedure" }],
    }],
    subject: { reference: `Patient/${patient.id}` },
    authoredOn: demande.date,
    requester: demande.prescripteurId ? { reference: `Practitioner/${demande.prescripteurId}` } : undefined,
  };
}

// Assemble un lot FHIR complet, prêt à être transmis à un autre système
export function lotFHIR(ressources, { type = "collection" } = {}) {
  return {
    resourceType: "Bundle",
    id: `medistat-${Date.now().toString(36)}`,
    type,
    timestamp: new Date().toISOString(),
    total: ressources.length,
    entry: ressources.map(r => ({
      fullUrl: `urn:uuid:${r.id}`,
      resource: r,
    })),
  };
}

// Export FHIR complet du dossier d'un patient
export function dossierPatientFHIR(patient, etablissement, demandes, resultats, tests) {
  const ressources = [patientVersFHIR(patient, etablissement)];
  for (const d of demandes) ressources.push(demandeVersFHIR(d, patient));
  for (const r of resultats) {
    const test = tests.find(t => t.code === r.testCode);
    ressources.push(resultatVersFHIR(r, test, patient, demandes.find(d => d.id === r.demandeId)));
  }
  return lotFHIR(ressources);
}

/* ===================== Table LOINC de référence ===================== */

// Correspondances LOINC des analyses les plus courantes, pour amorcer le
// catalogue d'un établissement et garantir l'interopérabilité dès l'origine.
export const LOINC_COURANTS = [
  { code: "GLY", loinc: "2345-7", nom: "Glucose sérique", unite: "g/L", categorie: "BIOCHIM", min: 0.7, max: 1.1, critMin: 0.4, critMax: 3 },
  { code: "HB", loinc: "718-7", nom: "Hémoglobine", unite: "g/dL", categorie: "HEMATO", min: 12, max: 16, critMin: 7, critMax: 20 },
  { code: "GB", loinc: "6690-2", nom: "Leucocytes", unite: "10³/µL", categorie: "HEMATO", min: 4, max: 10, critMin: 1, critMax: 30 },
  { code: "PLQ", loinc: "777-3", nom: "Plaquettes", unite: "10³/µL", categorie: "HEMATO", min: 150, max: 400, critMin: 50, critMax: 1000 },
  { code: "HT", loinc: "4544-3", nom: "Hématocrite", unite: "%", categorie: "HEMATO", min: 37, max: 47 },
  { code: "CREAT", loinc: "2160-0", nom: "Créatinine sérique", unite: "mg/L", categorie: "BIOCHIM", min: 6, max: 12, critMax: 50 },
  { code: "UREE", loinc: "3094-0", nom: "Urée sérique", unite: "g/L", categorie: "BIOCHIM", min: 0.15, max: 0.45 },
  { code: "ASAT", loinc: "1920-8", nom: "ASAT (SGOT)", unite: "UI/L", categorie: "BIOCHIM", min: 5, max: 40 },
  { code: "ALAT", loinc: "1742-6", nom: "ALAT (SGPT)", unite: "UI/L", categorie: "BIOCHIM", min: 5, max: 41 },
  { code: "NA", loinc: "2951-2", nom: "Sodium sérique", unite: "mmol/L", categorie: "BIOCHIM", min: 135, max: 145, critMin: 120, critMax: 160 },
  { code: "K", loinc: "2823-3", nom: "Potassium sérique", unite: "mmol/L", categorie: "BIOCHIM", min: 3.5, max: 5.1, critMin: 2.5, critMax: 6.5 },
  { code: "CRP", loinc: "1988-5", nom: "Protéine C réactive", unite: "mg/L", categorie: "BIOCHIM", min: 0, max: 5 },
  { code: "TSH", loinc: "3016-3", nom: "TSH", unite: "mUI/L", categorie: "HORMONO", min: 0.4, max: 4 },
  { code: "HBA1C", loinc: "4548-4", nom: "Hémoglobine glyquée HbA1c", unite: "%", categorie: "BIOCHIM", min: 4, max: 6 },
  { code: "CHOL", loinc: "2093-3", nom: "Cholestérol total", unite: "g/L", categorie: "BIOCHIM", min: 1.4, max: 2 },
  { code: "TG", loinc: "2571-8", nom: "Triglycérides", unite: "g/L", categorie: "BIOCHIM", min: 0.5, max: 1.5 },
  { code: "TP", loinc: "5902-2", nom: "Taux de prothrombine", unite: "%", categorie: "COAG", min: 70, max: 100 },
  { code: "INR", loinc: "6301-6", nom: "INR", unite: "", categorie: "COAG", min: 0.8, max: 1.2, critMax: 5 },
  { code: "PALU", loinc: "32700-7", nom: "Recherche de Plasmodium (goutte épaisse)", unite: "", categorie: "PARASITO", type: "qualitatif" },
  { code: "VIH", loinc: "75622-1", nom: "Sérologie VIH 1+2", unite: "", categorie: "SEROLOGIE", type: "qualitatif" },
  { code: "HBS", loinc: "5196-1", nom: "Antigène HBs", unite: "", categorie: "SEROLOGIE", type: "qualitatif" },
  { code: "WIDAL", loinc: "22588-8", nom: "Sérodiagnostic de Widal", unite: "", categorie: "SEROLOGIE", type: "qualitatif" },
  { code: "ECBU", loinc: "630-4", nom: "Examen cytobactériologique des urines", unite: "", categorie: "MICROBIO", type: "qualitatif" },
  { code: "GS", loinc: "882-1", nom: "Groupe sanguin ABO/Rhésus", unite: "", categorie: "HEMATO", type: "qualitatif" },
];

/* ===================== Export pour logiciels statistiques ===================== */

// Produit un jeu de données rectangulaire exploitable dans R, SPSS, Stata,
// jamovi ou Excel — et le script R correspondant, prêt à exécuter.
export function exportStatistique(lignes, variables, { nom = "medistat", anonymise = true } = {}) {
  const csv = versCSV(lignes, variables.map(v => v.code));

  const typeR = v => v.type === "numerique" ? "numeric"
    : v.type === "date" ? "Date" : "factor";
  const script = `# ${nom} — jeu de données exporté depuis MediStat
# ${new Date().toLocaleDateString("fr-FR")}${anonymise ? "\n# Données pseudonymisées : aucun identifiant direct n'est présent." : ""}
# Le même fichier s'importe dans SPSS, Stata, jamovi ou Excel.

donnees <- read.csv2("${nom}.csv", encoding = "UTF-8", check.names = FALSE)
str(donnees)
summary(donnees)

# Typage des variables
${variables.map(v => `donnees$\`${v.code}\` <- as.${typeR(v)}(donnees$\`${v.code}\`)`).join("\n")}

# Description des variables quantitatives
quanti <- names(donnees)[sapply(donnees, is.numeric)]
for (v in quanti) {
  cat("\\n--", v, "--\\n")
  print(summary(donnees[[v]]))
  cat("écart-type :", sd(donnees[[v]], na.rm = TRUE), "\\n")
}

# Tableaux de fréquences des variables qualitatives
quali <- names(donnees)[sapply(donnees, is.factor)]
for (v in quali) {
  cat("\\n--", v, "--\\n")
  print(table(donnees[[v]], useNA = "ifany"))
}

# Exemples d'analyses
# t.test(${variables.find(v => v.type === "numerique")?.code || "variable"} ~ groupe, data = donnees)
# chisq.test(table(donnees$var1, donnees$var2))
# cor.test(donnees$var1, donnees$var2, method = "spearman")
# summary(lm(y ~ x1 + x2, data = donnees))
`;

  const syntaxeSPSS = `* ${nom} — syntaxe SPSS produite par MediStat.
GET DATA /TYPE=TXT /FILE="${nom}.csv" /DELIMITERS=";" /QUALIFIER='"'
  /FIRSTCASE=2 /VARIABLES=
${variables.map(v => `  ${v.code.replace(/[^\w]/g, "_")} ${v.type === "numerique" ? "F8.2" : "A50"}`).join("\n")}.
EXECUTE.

DESCRIPTIVES VARIABLES=${variables.filter(v => v.type === "numerique").map(v => v.code.replace(/[^\w]/g, "_")).join(" ") || "ALL"}
  /STATISTICS=MEAN STDDEV MIN MAX SKEWNESS KURTOSIS.

FREQUENCIES VARIABLES=${variables.filter(v => v.type !== "numerique").map(v => v.code.replace(/[^\w]/g, "_")).join(" ") || "ALL"}.
`;

  return { csv, script, syntaxeSPSS, nomFichier: `${nom}.csv` };
}
