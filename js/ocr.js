// js/ocr.js — OCR des PDF scannés par IA (clé API de l'utilisateur).
// Un PDF scanné ne contient pas de texte : chaque page est une photo.
// On extrait NATIVEMENT les images JPEG embarquées (flux /DCTDecode), puis
// l'IA les transcrit — mêmes garde-fous que les Suggestions IA : clé locale,
// consentement explicite (les images partent vers le service), validation.

const MAX_PAGES = 20;

// Extrait les images JPEG embarquées d'un PDF (pages scannées)
export function extractPdfImages(ab) {
  const bytes = new Uint8Array(ab);
  // Représentation binaire → chaîne latin1 par blocs (fichiers volumineux)
  const parts = [];
  for (let i = 0; i < bytes.length; i += 32768)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  const raw = parts.join("");

  const blobs = [];
  let pos = 0;
  while (pos < raw.length && blobs.length < MAX_PAGES) {
    const si = raw.indexOf("stream", pos);
    if (si === -1) break;
    const after = si + 6;
    let ds;
    if (raw[after] === "\r" && raw[after + 1] === "\n") ds = after + 2;
    else if (raw[after] === "\n") ds = after + 1;
    else { pos = si + 7; continue; }
    const ei = raw.indexOf("endstream", ds);
    if (ei === -1) break;
    let de = ei;
    while (de > ds && (raw[de - 1] === "\n" || raw[de - 1] === "\r")) de--;

    const dictStart = Math.max(0, raw.lastIndexOf("<<", si));
    const dict = raw.slice(dictStart, si);
    if (/\/DCTDecode/.test(dict) && /\/Subtype\s*\/Image/.test(dict)) {
      blobs.push(new Blob([bytes.slice(ds, de)], { type: "image/jpeg" }));
    }
    pos = ei + 9;
  }
  return blobs;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Transcrit chaque page-image via l'API Anthropic (vision), avec la clé de l'utilisateur
export async function ocrImages({ apiKey, model, blobs, onProgress }) {
  const pages = [];
  for (let i = 0; i < blobs.length; i++) {
    if (onProgress) onProgress(i + 1, blobs.length);
    const data = await blobToBase64(blobs[i]);
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
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
            { type: "text", text: "Transcris fidèlement TOUT le texte lisible de cette page scannée, dans l'ordre de lecture, en conservant les paragraphes. Réponds UNIQUEMENT avec le texte transcrit, sans commentaire. Si la page est illisible, réponds : [page illisible]" },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error("cle-invalide");
      if (resp.status === 429) throw new Error("quota");
      let msg = "HTTP " + resp.status;
      try { msg = (await resp.json()).error?.message || msg; } catch { /* corps illisible */ }
      throw new Error(msg);
    }
    const out = await resp.json();
    pages.push((out.content || []).map(b => b.text || "").join("").trim());
  }
  return pages.map((p, i) => (blobs.length > 1 ? `— Page ${i + 1} —\n` : "") + p).join("\n\n");
}
