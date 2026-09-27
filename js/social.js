// js/social.js — Import de données de réseaux sociaux SANS API :
// on lit les fichiers d'export que l'utilisateur possède déjà.
//  • WhatsApp : « Exporter la discussion » → .txt (Android et iOS)
//  • X/Twitter, YouTube, Facebook… : exports CSV ou JSON d'outils de collecte
// Aucune connexion aux plateformes : conforme à leurs conditions d'utilisation.

/* ---------- Détection du format ---------- */
export function detectSocialFormat(filename, text) {
  const head = text.slice(0, 4000);
  // Les regex WhatsApp sont ancrées ligne par ligne
  const headLines = head.split("\n").slice(0, 30);
  if (headLines.some(l => WA_ANDROID_RE.test(l) || WA_IOS_RE.test(l))) return "whatsapp";
  const name = filename.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv")) return "csv";
  const t = head.trimStart();
  if (t.startsWith("[") || t.startsWith("{")) return "json";
  if (head.includes(",") || head.includes(";")) return "csv";
  return null;
}

/* ---------- WhatsApp ---------- */
// Android : « 12/03/2026, 14:23 - Jean: message » (variantes : « à 14:23 », h avec point)
const WA_ANDROID_RE = /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s*(?:à\s*)?(\d{1,2}[:.]\d{2})\s*-\s([^:]+?):\s([\s\S]*)$/;
// iOS : « [12/03/2026, 14:23:45] Jean: message » (avec parfois ~ devant le nom)
const WA_IOS_RE = /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s*(\d{1,2}[:.]\d{2})(?::\d{2})?\]\s~?\s?([^:]+?):\s([\s\S]*)$/;
// Lignes système (chiffrement, création du groupe…) : datées mais sans « Auteur : »
const WA_SYSTEM_ANDROID = /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s*(?:à\s*)?(\d{1,2}[:.]\d{2})\s*-\s(.*)$/;
const WA_SYSTEM_IOS = /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s*(\d{1,2}[:.]\d{2})(?::\d{2})?\]\s(.*)$/;

export function parseWhatsApp(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/‎/g, "").split("\n");
  const messages = [];
  let system = 0, current = null;
  for (const line of lines) {
    const m = WA_ANDROID_RE.exec(line) || WA_IOS_RE.exec(line);
    if (m) {
      if (current) messages.push(current);
      current = { date: m[1], time: m[2], author: m[3].trim(), text: m[4] };
      continue;
    }
    if (WA_SYSTEM_ANDROID.test(line) || WA_SYSTEM_IOS.test(line)) {
      if (current) { messages.push(current); current = null; }
      system++;
      continue;
    }
    // Suite d'un message multi-lignes
    if (current) current.text += "\n" + line;
  }
  if (current) messages.push(current);
  return { messages, system };
}

// Transforme les messages en texte de document : locuteurs « Nom : » (mis en
// évidence par QualiCode) + séparateurs de journée.
export function buildChatDocument(messages, { mergeConsecutive = true } = {}) {
  const out = [];
  let lastDate = null, lastAuthor = null;
  for (const msg of messages) {
    const body = msg.text.trim();
    if (!body || body === "<Médias omis>" || body === "<Media omitted>" || /^<.*>$/.test(body)) continue;
    if (msg.date !== lastDate) {
      out.push(`— ${msg.date} —`);
      lastDate = msg.date;
      lastAuthor = null;
    }
    if (mergeConsecutive && msg.author === lastAuthor && out.length) {
      out[out.length - 1] += "\n" + body;
    } else {
      out.push(`${msg.author} : ${body}`);
      lastAuthor = msg.author;
    }
  }
  return out.join("\n\n");
}

export function chatStats(messages) {
  const authors = new Map();
  for (const m of messages) authors.set(m.author, (authors.get(m.author) || 0) + 1);
  return {
    count: messages.length,
    authors: [...authors.entries()].sort((a, b) => b[1] - a[1]),
    firstDate: messages[0]?.date ?? "",
    lastDate: messages[messages.length - 1]?.date ?? "",
  };
}

/* ---------- CSV / JSON génériques (X/Twitter, YouTube, Facebook…) ---------- */
// Analyseur CSV autonome (guillemets, séparateur , ou ;)
export function parseCsvRows(text) {
  const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], field = "", inQ = false;
  const src = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; if (row.some(f => f.trim() !== "")) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field);
  if (row.some(f => f.trim() !== "")) rows.push(row);
  return rows;
}

// JSON : accepte un tableau d'objets, ou un objet contenant un tableau
// (clés courantes : data, items, results, posts, comments, messages).
export function parseJsonRecords(text) {
  const data = JSON.parse(text);
  let arr = Array.isArray(data) ? data
    : data.data || data.items || data.results || data.posts || data.comments || data.messages;
  if (!Array.isArray(arr)) throw new Error("no-array");
  arr = arr.filter(x => x && typeof x === "object");
  // Aplatis un niveau (ex. {node:{...}} ou {snippet:{...}})
  arr = arr.map(x => {
    const keys = Object.keys(x);
    if (keys.length === 1 && typeof x[keys[0]] === "object") return x[keys[0]];
    return x;
  });
  const headers = [...new Set(arr.flatMap(o => Object.keys(o).filter(k => typeof o[k] !== "object")))];
  const rows = arr.map(o => headers.map(h => o[h] == null ? "" : String(o[h])));
  return [headers, ...rows];
}

// Devine les colonnes auteur / texte / date d'après les en-têtes
const AUTHOR_HINTS = ["author", "auteur", "user", "username", "screen_name", "name", "nom", "from", "channel", "commenter"];
const TEXT_HINTS = ["text", "texte", "message", "content", "contenu", "comment", "commentaire", "body", "tweet", "post", "description", "title"];
const DATE_HINTS = ["date", "created", "time", "timestamp", "published", "publie"];

function guessCol(headers, hints) {
  const low = headers.map(h => String(h).toLowerCase());
  for (const hint of hints) {
    const i = low.findIndex(h => h === hint);
    if (i !== -1) return i;
  }
  for (const hint of hints) {
    const i = low.findIndex(h => h.includes(hint));
    if (i !== -1) return i;
  }
  return -1;
}

export function guessMapping(headers) {
  return {
    author: guessCol(headers, AUTHOR_HINTS),
    text: guessCol(headers, TEXT_HINTS),
    date: guessCol(headers, DATE_HINTS),
  };
}

// Construit le texte du document : « Auteur (date) : contenu », un post par paragraphe
export function buildPostsDocument(rows, { author, text, date }) {
  const out = [];
  for (const r of rows) {
    const body = (text >= 0 ? r[text] : "").trim();
    if (!body) continue;
    const a = author >= 0 ? (r[author] || "").trim() : "";
    const d = date >= 0 ? (r[date] || "").trim() : "";
    const prefix = a ? `${a}${d ? ` (${d})` : ""} : ` : (d ? `(${d}) ` : "");
    out.push(prefix + body);
  }
  return { text: out.join("\n\n"), count: out.length };
}
