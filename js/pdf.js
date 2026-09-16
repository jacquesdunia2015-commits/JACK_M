// js/pdf.js — Extracteur de texte PDF minimal (texte natif, pas de PDF scannés)
// Supporte FlateDecode; ne nécessite aucune dépendance externe.

export async function extractPdfText(ab) {
  const bytes = new Uint8Array(ab);
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50) // %P
    throw new Error("Ce fichier n'est pas un PDF valide.");

  const raw = binStr(bytes);

  // Trouver tous les blocs stream...endstream
  const streams = [];
  let pos = 0;
  while (pos < raw.length) {
    const si = raw.indexOf('stream', pos);
    if (si === -1) break;
    const after = si + 6;
    let ds;
    if (raw[after] === '\r' && raw[after + 1] === '\n') ds = after + 2;
    else if (raw[after] === '\n') ds = after + 1;
    else { pos = si + 7; continue; }

    let ei = raw.indexOf('endstream', ds);
    if (ei === -1) break;
    // L'EOL précédant 'endstream' ne fait pas partie des données ; les
    // décompresseurs stricts rejettent tout octet excédentaire.
    let de = ei;
    while (de > ds && (raw[de - 1] === '\n' || raw[de - 1] === '\r')) de--;

    // Dictionnaire de l'objet (on cherche en arrière depuis 'stream')
    const dictEnd = si;
    let dictStart = dictEnd - 1;
    while (dictStart > 0 && raw.slice(dictStart - 2, dictStart) !== '<<') dictStart--;
    dictStart = Math.max(0, raw.lastIndexOf('<<', dictEnd));
    const dict = raw.slice(dictStart, dictEnd);

    streams.push({ dict, data: bytes.slice(ds, de) });
    pos = ei + 9;
  }

  // Extraire le texte de chaque stream
  const texts = [];
  for (const { dict, data } of streams) {
    try {
      let content;
      const isFlate = /\/FlateDecode|\/Fl\b/.test(dict);
      const isHex   = /\/ASCIIHexDecode/.test(dict);
      const hasType = /\/Type\s*\//.test(dict);
      const isXObj  = /\/Subtype\s*\/Form/.test(dict);
      // Skip metadata-only streams
      if (/\/Type\s*\/XRef|\/Type\s*\/ObjStm/.test(dict)) continue;

      if (isFlate) {
        content = await inflate(data);
        if (!content) continue;
      } else if (!hasType || isXObj) {
        content = binStr(data);
      } else {
        continue;
      }

      const t = parsePdfOps(content);
      if (t.trim().length > 3) texts.push(t);
    } catch { /* stream illisible, on passe */ }
  }

  if (!texts.length) throw new Error("Impossible d'extraire le texte de ce PDF. Vérifiez qu'il n'est pas scanné (image) et qu'il n'est pas protégé.");
  return texts.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Décompression deflate (FlateDecode PDF)
async function inflate(bytes) {
  for (const fmt of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(fmt);
      const w = ds.writable.getWriter();
      const r = ds.readable.getReader();
      // Les rejets de write/close sont signalés aussi par r.read() ;
      // on les neutralise pour éviter une rejection non interceptée.
      w.write(bytes.slice(0)).catch(() => {});
      w.close().catch(() => {});
      const chunks = [];
      for (;;) {
        const { done, value } = await r.read();
        if (done) break;
        chunks.push(value);
      }
      const len = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(len);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return new TextDecoder('latin1').decode(out);
    } catch { /* essayer le format suivant */ }
  }
  return null;
}

// Parser les opérateurs de texte PDF (BT...ET), dans l'ordre du flux :
// les déplacements verticaux (Td/TD/Tm/T*) deviennent des sauts de ligne.
function parsePdfOps(content) {
  const out = [];
  let lastY = null;
  const btRe = /BT([\s\S]*?)ET/g;
  let bm;
  const opRe =
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(T[dD])|(?:(?:-?\d+(?:\.\d+)?\s+){4})(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm|T\*|(\((?:[^)\\]|\\.)*\))\s*(?:Tj|'|")|(\[[\s\S]*?\])\s*TJ|<([0-9A-Fa-f\s]*)>\s*Tj/g;
  while ((bm = btRe.exec(content)) !== null) {
    const block = bm[1];
    opRe.lastIndex = 0;
    let m;
    while ((m = opRe.exec(block)) !== null) {
      if (m[3]) {                       // x y Td/TD : déplacement relatif
        if (parseFloat(m[2]) !== 0) out.push('\n');
      } else if (m[5] !== undefined) {  // matrice Tm : position absolue
        const y = parseFloat(m[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) out.push('\n');
        lastY = y;
      } else if (m[0] === 'T*') {
        out.push('\n');
      } else if (m[6]) {
        out.push(decodeLiteral(m[6].slice(1, -1)));
      } else if (m[7]) {
        // Tableau TJ : chaînes + crénage (grand écart négatif = espace)
        const arrRe = /(\((?:[^)\\]|\\.)*\))|<([0-9A-Fa-f\s]*)>|(-?\d+(?:\.\d+)?)/g;
        let am;
        while ((am = arrRe.exec(m[7])) !== null) {
          if (am[1]) out.push(decodeLiteral(am[1].slice(1, -1)));
          else if (am[2]) out.push(decodeHex(am[2]));
          else if (parseFloat(am[3]) < -200) out.push(' ');
        }
      } else if (m[8] !== undefined) {
        out.push(decodeHex(m[8]));
      }
    }
    out.push('\n');
  }
  return out.join('');
}

function decodeLiteral(s) {
  return s
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\(.)/g, '$1');
}

function decodeHex(hex) {
  const h = hex.replace(/\s/g, '');
  let out = '';
  for (let i = 0; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return out;
}

function binStr(bytes) {
  // Convertir en binaire par blocs pour éviter stack overflow sur grands fichiers
  const chunkSize = 32768;
  const parts = [];
  for (let i = 0; i < bytes.length; i += chunkSize)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  return parts.join('');
}
