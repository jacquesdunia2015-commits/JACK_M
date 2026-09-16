// Import DOCX sans dépendance externe (§2.2 du cahier des charges).
// Un .docx est une archive ZIP ; le texte se trouve dans word/document.xml.
// Décompression via l'API native DecompressionStream ("deflate-raw").

const SIG_EOCD = 0x06054b50;   // End Of Central Directory
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Extrait un fichier d'une archive ZIP (retourne un Uint8Array) ou null s'il est absent
async function unzipEntry(buffer, entryName) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Recherche de l'End Of Central Directory depuis la fin (commentaire ZIP possible)
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("ZIP invalide");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true); // offset du répertoire central
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== SIG_CENTRAL) throw new Error("Répertoire central invalide");
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    if (name === entryName) {
      if (view.getUint32(localOffset, true) !== SIG_LOCAL) throw new Error("En-tête local invalide");
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) return data.slice();
      if (method === 8) return inflateRaw(data);
      throw new Error("Méthode de compression non gérée : " + method);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// Convertit le XML WordprocessingML en texte brut, paragraphe par paragraphe
function xmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML invalide");

  const paras = [];
  const walk = (node, out) => {
    for (const child of node.children) {
      switch (child.localName) {
        case "t": out.push(child.textContent); break;
        case "tab": out.push("\t"); break;
        case "br": case "cr": out.push("\n"); break;
        default: walk(child, out);
      }
    }
  };

  // Parcourt les paragraphes (w:p) dans l'ordre du document ; les cellules de
  // tableau contiennent leurs propres w:p et sont donc couvertes naturellement.
  const body = doc.getElementsByTagName("*");
  for (const el of body) {
    if (el.localName !== "p") continue;
    // Ignore les w:p imbriqués dans un autre w:p (cadres de texte)
    let parent = el.parentNode, nested = false;
    while (parent) { if (parent.localName === "p") { nested = true; break; } parent = parent.parentNode; }
    if (nested) continue;
    const out = [];
    walk(el, out);
    paras.push(out.join(""));
  }
  // Supprime les lignes vides répétées en fin/début et limite les suites de vides
  return paras.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extrait le texte d'un fichier .docx (File ou Blob). */
export async function extractDocxText(file) {
  const buffer = await file.arrayBuffer();
  const entry = await unzipEntry(buffer, "word/document.xml");
  if (!entry) throw new Error("word/document.xml introuvable — fichier DOCX invalide");
  return xmlToText(new TextDecoder("utf-8").decode(entry));
}
