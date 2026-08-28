// Accès aux manuels PDF (Guide d'utilisation, Manuel du débutant).
//
// IMPORTANT — poids de chargement. Les deux PDF pèsent ~700 Ko : ils ne sont
// JAMAIS téléchargés au démarrage, ce qui est décisif sur une connexion lente.
//  - Version en ligne : le PDF n'est récupéré (docs/*.pdf) qu'au moment où
//    l'utilisateur clique le bouton ; le site ne charge alors que ~130 Ko.
//  - Fichier unique (standalone) : les PDF sont embarqués par
//    tools/embarquer_docs.py dans window.__QC_PDFS — disponibles hors ligne.

import { downloadBlob } from "./export.js";

const FILES = {
  guide: "QualiCode_Guide_utilisation.pdf",
  manuel: "QualiCode_Manuel_debutant.pdf",
};

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

/** Récupère le PDF demandé ("guide" | "manuel") : embarqué, sinon téléchargé. */
async function getPdf(which) {
  const embedded = window.__QC_PDFS?.[which];
  if (embedded) return fromBase64(embedded);
  const res = await fetch("docs/" + FILES[which]);
  if (!res.ok) throw new Error("PDF indisponible (" + res.status + ")");
  return await res.blob();
}

async function download(which) {
  downloadBlob(FILES[which], await getPdf(which));
}

export async function downloadGuidePdf() {
  return download("guide");
}

export async function downloadManuelPdf() {
  return download("manuel");
}
