// js/ai.js — Suggestions de codage par IA, avec la clé API de l'utilisateur.
// Garde-fous :
//  • la clé est stockée sur CET ordinateur (localStorage), jamais dans le .projx
//    qui circule entre codeurs ;
//  • aucun envoi sans confirmation explicite (données anonymisées) ;
//  • l'IA ne code jamais toute seule : elle propose, le chercheur valide.

const AI_KEY = "qualicode.ai";

export const AI_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (rapide, économique)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (plus fin, plus cher)" },
];

export function getAiConfig() {
  try { return JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch { return {}; }
}
export function saveAiConfig(cfg) {
  try { localStorage.setItem(AI_KEY, JSON.stringify(cfg)); } catch { /* stockage indisponible */ }
}

// Découpe le document en paragraphes numérotés avec leur position (offset)
export function docParagraphs(text) {
  const out = [];
  let offset = 0;
  for (const p of text.split("\n")) {
    out.push({ start: offset, text: p });
    offset += p.length + 1;
  }
  return out.filter(p => p.text.trim().length > 0);
}

function buildPrompt(docName, paragraphs, codes) {
  const codeList = codes.map(c =>
    `- « ${c.name} »${c.definition ? ` : ${c.definition.slice(0, 200)}` : ""}`).join("\n");
  const paras = paragraphs.map((p, i) => `[¶${i}] ${p.text}`).join("\n");
  return `Tu es un assistant de codage pour l'analyse qualitative (analyse thématique).

LIVRE DE CODES du projet :
${codeList || "(aucun code encore défini)"}

DOCUMENT « ${docName} » (paragraphes numérotés) :
${paras}

TÂCHE : propose des codages. Pour chaque passage pertinent, indique :
- "para" : le numéro du paragraphe (l'entier après ¶)
- "code" : le nom EXACT d'un code du livre de codes ; si aucun ne convient et qu'un thème émergent important apparaît, propose un nouveau nom court et mets "nouveau": true
- "extrait" : la citation EXACTE, mot pour mot, copiée du paragraphe (30 à 200 caractères)
- "justification" : une phrase courte expliquant le choix

Règles : ne code que ce qui est réellement pertinent (qualité avant quantité, 15 suggestions maximum) ; l'« extrait » doit être une sous-chaîne exacte du paragraphe indiqué ; ignore les questions de l'enquêteur, code les réponses des participants.

Réponds UNIQUEMENT avec un tableau JSON, sans texte autour :
[{"para": 0, "code": "…", "extrait": "…", "justification": "…", "nouveau": false}]`;
}

// Appelle l'API Anthropic depuis le navigateur avec la clé de l'utilisateur.
export async function suggestCodes({ apiKey, model, docName, paragraphs, codes }) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      messages: [{ role: "user", content: buildPrompt(docName, paragraphs, codes) }],
    }),
  });
  if (!resp.ok) {
    let msg = "HTTP " + resp.status;
    try { msg = (await resp.json()).error?.message || msg; } catch { /* corps illisible */ }
    if (resp.status === 401) throw new Error("cle-invalide");
    if (resp.status === 429) throw new Error("quota");
    throw new Error(msg);
  }
  const data = await resp.json();
  const raw = (data.content || []).map(b => b.text || "").join("");
  // Tolère les clôtures markdown éventuelles autour du JSON
  const jsonText = raw.replace(/^[\s\S]*?(\[)/, "$1").replace(/\][\s\S]*$/, "]");
  let arr;
  try { arr = JSON.parse(jsonText); } catch { throw new Error("reponse-illisible"); }
  if (!Array.isArray(arr)) throw new Error("reponse-illisible");

  // Validation + calcul des positions exactes dans le document
  const out = [];
  for (const s of arr.slice(0, 30)) {
    const idx = Number(s.para);
    const p = paragraphs[idx];
    if (!p || !s.code || !s.extrait) continue;
    const excerpt = String(s.extrait);
    const at = p.text.indexOf(excerpt);
    const start = at >= 0 ? p.start + at : p.start;
    const end = at >= 0 ? start + excerpt.length : p.start + p.text.length;
    out.push({
      code: String(s.code).trim(),
      isNew: !!s.nouveau,
      excerpt: at >= 0 ? excerpt : p.text,
      why: String(s.justification || ""),
      start, end,
    });
  }
  return out;
}
