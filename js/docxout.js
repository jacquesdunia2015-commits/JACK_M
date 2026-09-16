// Export Word (.docx) natif, sans dépendance (§2.8, critère d'acceptation n°3).
// Un .docx est une archive ZIP ; on l'écrit ici en méthode STORE (sans
// compression) avec CRC-32, puis on y place le WordprocessingML minimal.

const textEncoder = new TextEncoder();

/* ---------- CRC-32 ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- Écriture ZIP (méthode STORE) ---------- */
function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** entries : [{ name, text }] → Blob ZIP */
export function buildZip(entries) {
  const { time, day } = dosDateTime();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const data = textEncoder.encode(entry.text);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version requise
    local.setUint16(6, 0x0800, true);      // noms en UTF-8
    local.setUint16(8, 0, true);           // méthode STORE
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, nameBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, day, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);        // offset de l'en-tête local
    central.push(cd.buffer, nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.byteLength ?? c.length;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);

  return new Blob([...parts, ...central, eocd.buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/* ---------- Construction du document Word ---------- */
const xmlEsc = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

// Un « run » de texte avec mise en forme optionnelle
function run(text, { bold, italic, color, size } = {}) {
  const props = [
    bold ? "<w:b/>" : "",
    italic ? "<w:i/>" : "",
    color ? `<w:color w:val="${color}"/>` : "",
    size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : "",
  ].join("");
  // xml:space="preserve" garde les espaces ; les sauts de ligne deviennent des <w:br/>
  const content = xmlEsc(text).split("\n").map(part =>
    `<w:t xml:space="preserve">${part}</w:t>`).join("<w:br/>");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${content}</w:r>`;
}

// Un paragraphe : liste de runs + propriétés (retrait, bordure gauche colorée, espacement)
function para(runs, { indent, leftBar, spaceBefore, spaceAfter } = {}) {
  const props = [
    leftBar ? `<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="${leftBar}"/></w:pBdr>` : "",
    indent ? `<w:ind w:left="${indent}"/>` : "",
    (spaceBefore || spaceAfter) ? `<w:spacing w:before="${spaceBefore || 0}" w:after="${spaceAfter || 0}"/>` : "",
  ].join("");
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${runs.join("")}</w:p>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/**
 * Génère un rapport Word : segments regroupés par code.
 * @param {object} opts { projectName, memo, codes: [{code, segments:[{docName, text, weight, comment}]}], labels }
 * @returns {Blob} le fichier .docx
 */
export function buildReportDocx({ projectName, memo, codes, labels }) {
  const body = [];
  body.push(para([run(projectName, { bold: true, size: "40" })], { spaceAfter: 120 }));
  body.push(para([run(labels.subtitle, { color: "666666", size: "20" })], { spaceAfter: 240 }));
  if (memo) {
    body.push(para([run(labels.projectMemo + " : ", { bold: true, size: "22" }), run(memo, { italic: true, size: "22" })], { spaceAfter: 240 }));
  }
  for (const group of codes) {
    if (!group.segments.length) continue;
    const color = (group.code.color || "#888888").replace("#", "");
    body.push(para(
      [run(`${group.code.name} (${group.segments.length})`, { bold: true, size: "28", color })],
      { leftBar: color, spaceBefore: 300, spaceAfter: 120 }
    ));
    for (const s of group.segments) {
      const src = s.weight !== 1 ? `${s.docName} · ${labels.weight} ${s.weight}` : s.docName;
      body.push(para([run(src, { bold: true, color: "555555", size: "18" })], { spaceBefore: 120 }));
      body.push(para([run(s.text, { size: "22" })], { indent: 400, leftBar: "CCCCCC", spaceAfter: 60 }));
      if (s.comment) {
        body.push(para([run("💬 " + s.comment, { italic: true, color: "777777", size: "18" })], { indent: 400, spaceAfter: 60 }));
      }
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join("")}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>`;

  return buildZip([
    { name: "[Content_Types].xml", text: CONTENT_TYPES },
    { name: "_rels/.rels", text: RELS },
    { name: "word/document.xml", text: documentXml },
  ]);
}
