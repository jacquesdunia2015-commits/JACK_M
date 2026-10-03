// tests/aide-fichiers.mjs — relecture des fichiers produits par QualiCode.
//
// Les .docx et les .qdpx de QualiCode sont des archives ZIP écrites à la main,
// octet par octet, sans bibliothèque. Un en-tête mal rempli produit un fichier
// que Word ou MAXQDA refusent d'ouvrir — sans que rien n'ait « planté » côté
// QualiCode. Il faut donc relire l'archive comme le ferait le logiciel de
// destination : en passant par le répertoire central, et en vérifiant le CRC.

function crc32(octets) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }
  c = 0xFFFFFFFF;
  for (let i = 0; i < octets.length; i++) c = table[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Lit une archive ZIP (méthode STORE) depuis un Blob.
 * Retourne { entrees: Map(nom → texte), crcValides: bool, nombre }.
 */
export async function lireZip(blob) {
  const tampon = await blob.arrayBuffer();
  const octets = new Uint8Array(tampon);
  const vue = new DataView(tampon);

  let eocd = -1;
  for (let i = octets.length - 22; i >= 0; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("archive illisible : fin de répertoire central absente");

  const nombre = vue.getUint16(eocd + 10, true);
  let pos = vue.getUint32(eocd + 16, true);
  const entrees = new Map();
  const dec = new TextDecoder();
  let crcValides = true;

  for (let n = 0; n < nombre; n++) {
    if (vue.getUint32(pos, true) !== 0x02014b50) throw new Error("entrée de répertoire central invalide");
    const methode = vue.getUint16(pos + 10, true);
    const crcAttendu = vue.getUint32(pos + 16, true);
    const taille = vue.getUint32(pos + 20, true);
    const lgNom = vue.getUint16(pos + 28, true);
    const lgExtra = vue.getUint16(pos + 30, true);
    const lgCmt = vue.getUint16(pos + 32, true);
    const debutLocal = vue.getUint32(pos + 42, true);
    const nom = dec.decode(octets.subarray(pos + 46, pos + 46 + lgNom));

    if (vue.getUint32(debutLocal, true) !== 0x04034b50)
      throw new Error("en-tête local invalide pour " + nom);
    if (methode !== 0) throw new Error("méthode de compression inattendue pour " + nom);

    const lgNomLocal = vue.getUint16(debutLocal + 26, true);
    const lgExtraLocal = vue.getUint16(debutLocal + 28, true);
    const debut = debutLocal + 30 + lgNomLocal + lgExtraLocal;
    const donnees = octets.subarray(debut, debut + taille);
    if (crc32(donnees) !== crcAttendu) crcValides = false;

    entrees.set(nom, dec.decode(donnees));
    pos += 46 + lgNom + lgExtra + lgCmt;
  }
  return { entrees, crcValides, nombre };
}

/**
 * Contrôle de bonne formation d'un XML, sans analyseur : équilibre des balises
 * et échappement des caractères réservés. Cela suffit à détecter ce qui casse
 * réellement un import — un « & » nu ou une balise non refermée.
 */
export function xmlBienForme(xml) {
  // Déclaration, commentaires et sections CDATA : hors du contrôle d'équilibre.
  xml = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "")
           .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const pile = [];
  const re = /<(\/?)([A-Za-z_][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m, dernier = 0;
  while ((m = re.exec(xml)) !== null) {
    // Le texte entre deux balises ne doit contenir ni « < » ni « & » nu.
    const texte = xml.slice(dernier, m.index);
    if (/[<]/.test(texte)) return `caractère « < » non échappé : …${texte.slice(-30)}`;
    if (/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/.test(texte))
      return `esperluette non échappée : …${texte.slice(-30)}`;
    dernier = re.lastIndex;
    if (m[4] === "/") continue;              // balise auto-fermante
    if (m[1] === "/") {
      if (pile.pop() !== m[2]) return `balise fermante inattendue : </${m[2]}>`;
    } else pile.push(m[2]);
  }
  if (pile.length) return `balise non refermée : <${pile[pile.length - 1]}>`;
  return null; // bien formé
}

/**
 * Analyseur CSV conforme (RFC 4180) : champs entre guillemets, guillemets
 * doublés, sauts de ligne à l'intérieur d'un champ. C'est ainsi qu'Excel et R
 * liront le fichier ; les relire autrement ne prouverait rien.
 * Retourne un tableau d'enregistrements, chacun étant un tableau de champs.
 */
export function lireCsv(texte, separateur = ";") {
  texte = texte.replace(/^\uFEFF/, "");
  const enregistrements = [];
  let champs = [], champ = "", entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; }
        else entreGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"' && champ === "") { entreGuillemets = true; }
    else if (c === separateur) { champs.push(champ); champ = ""; }
    else if (c === "\r" && texte[i + 1] === "\n") {
      champs.push(champ); enregistrements.push(champs); champs = []; champ = ""; i++;
    } else if (c === "\n") {
      champs.push(champ); enregistrements.push(champs); champs = []; champ = "";
    } else champ += c;
  }
  if (champ !== "" || champs.length) { champs.push(champ); enregistrements.push(champs); }
  return enregistrements;
}

/** Vrai si le Blob commence par la marque d'ordre des octets UTF-8 (Excel). */
export async function commenceParBom(blob) {
  const o = new Uint8Array(await blob.arrayBuffer());
  return o[0] === 0xEF && o[1] === 0xBB && o[2] === 0xBF;
}
