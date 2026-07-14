// js/imagecode.js — Codage de zones d'images (photos de terrain, affiches…)
// L'image est recompressée à l'import (JPEG ≤ 1600 px) puis stockée dans le
// projet en dataURL. Les zones codées sont des rectangles normalisés (0–1),
// stockés dans les segments (s.rect) — elles suivent l'image à toute taille.

// Lit un fichier image, le réduit et le compresse pour le stockage local
export async function fileToDataUrl(file, maxDim = 1600, quality = 0.85) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function isImageFile(file) {
  return (file.type || "").startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || "");
}

// Construit la vue de codage : image + calques des zones + tracé à la souris.
// onRectDrawn(rectNormalisé, clientX, clientY) — onSegmentClick(segId)
export function buildImageView({ doc, segments, getCode, hint, onRectDrawn, onSegmentClick }) {
  const wrap = document.createElement("div");
  wrap.className = "img-code-wrap";

  const img = document.createElement("img");
  img.src = doc.imageData;
  img.draggable = false;
  wrap.appendChild(img);

  // Calques des zones déjà codées
  for (const s of segments) {
    if (!s.rect) continue;
    const code = getCode(s.codeId);
    const ov = document.createElement("div");
    ov.className = "img-zone";
    ov.style.left = (s.rect.x * 100) + "%";
    ov.style.top = (s.rect.y * 100) + "%";
    ov.style.width = (s.rect.w * 100) + "%";
    ov.style.height = (s.rect.h * 100) + "%";
    ov.style.borderColor = code?.color || "#888";
    ov.style.background = (code?.color || "#888") + "33"; // ~20 % d'opacité
    ov.title = (code?.name || "?") + (s.comment ? " — " + s.comment : "");
    const lbl = document.createElement("span");
    lbl.className = "img-zone-lbl";
    lbl.style.background = code?.color || "#888";
    lbl.textContent = code?.name || "?";
    ov.appendChild(lbl);
    ov.addEventListener("mousedown", e => e.stopPropagation());
    ov.addEventListener("click", e => { e.stopPropagation(); onSegmentClick(s.id); });
    wrap.appendChild(ov);
  }

  if (hint) {
    const p = document.createElement("div");
    p.className = "img-hint";
    p.textContent = hint;
    wrap.appendChild(p);
  }

  // Tracé d'une nouvelle zone (élastique)
  let start = null, rubber = null;
  const relPos = e => {
    const r = img.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  wrap.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    start = relPos(e);
    rubber = document.createElement("div");
    rubber.className = "img-rubber";
    wrap.appendChild(rubber);
    const onMove = ev => {
      const p = relPos(ev);
      const x = Math.min(start.x, p.x), y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x), h = Math.abs(p.y - start.y);
      Object.assign(rubber.style, { left: x * 100 + "%", top: y * 100 + "%", width: w * 100 + "%", height: h * 100 + "%" });
    };
    const onUp = ev => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const p = relPos(ev);
      const rect = {
        x: Math.min(start.x, p.x), y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
      };
      rubber.remove(); rubber = null; start = null;
      // Zone trop petite = simple clic : ignorée
      if (rect.w > 0.02 && rect.h > 0.02) onRectDrawn(rect, ev.clientX, ev.clientY);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  return wrap;
}
