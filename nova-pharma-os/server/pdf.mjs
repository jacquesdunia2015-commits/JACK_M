// NOVA PHARMA OS — Générateur PDF minimal, sans dépendance (§34 factures,
// bons de livraison). Repris et généralisé du moteur MediLab SaaS.

function pdfEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class Pdf {
  constructor() { this.ops = []; this.pages = []; }
  text(x, y, size, str, bold = false) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEsc(str)}) Tj ET`);
  }
  line(x1, y1, x2, y2, w = 0.7) {
    this.ops.push(`${w} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  }
  rect(x, y, w, h, gray) {
    this.ops.push(`${gray} g ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0 g`);
  }
  endPage() { this.pages.push(this.ops.join('\n')); this.ops = []; }
  build() {
    if (this.ops.length) this.endPage();
    const objs = [];
    const nPages = this.pages.length;
    const pageIds = [], contentIds = [];
    let nextId = 5;
    for (let i = 0; i < nPages; i++) { pageIds.push(nextId++); contentIds.push(nextId++); }
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Count ${nPages} /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    for (let i = 0; i < nPages; i++) {
      objs[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
      objs[contentIds[i]] = { stream: this.pages[i] };
    }
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets = [0];
    let pos = chunks[0].length;
    for (let id = 1; id < nextId; id++) {
      let body;
      if (typeof objs[id] === 'object') {
        const s = Buffer.from(objs[id].stream, 'latin1');
        body = Buffer.concat([
          Buffer.from(`${id} 0 obj\n<< /Length ${s.length} >>\nstream\n`, 'latin1'),
          s, Buffer.from('\nendstream\nendobj\n', 'latin1'),
        ]);
      } else {
        body = Buffer.from(`${id} 0 obj\n${objs[id]}\nendobj\n`, 'latin1');
      }
      offsets[id] = pos;
      chunks.push(body);
      pos += body.length;
    }
    const xrefPos = pos;
    let xref = `xref\n0 ${nextId}\n0000000000 65535 f \n`;
    for (let id = 1; id < nextId; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    xref += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
  }
}

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtMoney = (n) => `${Number(n).toFixed(2)} USD`;

/**
 * Construit une facture / bon de commande / bon de livraison générique.
 * @param {{titre:string, numero:string, organisation:object, tiers:{nom:string,lignesAdresse?:string[]}, dateLabel?:string, date:string, lignes:{libelle:string,quantite:number,prixUnitaire:number}[], notes?:string, pied?:string}} opts
 */
export function buildDocumentPdf(opts) {
  const pdf = new Pdf();
  const L = 50, R = 545, W = R - L;
  let y = 800;
  const org = opts.organisation || {};

  pdf.rect(0, 812, 595, 30, 0.92);
  pdf.text(L, 822, 14, org.nom || 'NOVA SANTÉ PHARMA', true);
  pdf.text(R - 150, 822, 9, `Édité le ${fmtDate(new Date().toISOString())}`);
  y = 785;
  pdf.text(L, y, 16, opts.titre.toUpperCase(), true); y -= 10;
  pdf.line(L, y, R, y, 1.2); y -= 22;

  pdf.text(L, y, 10, 'Destinataire', true);
  pdf.text(L + 300, y, 10, 'Document', true); y -= 14;
  pdf.text(L, y, 10, opts.tiers.nom || '—');
  pdf.text(L + 300, y, 10, `N° ${opts.numero}`); y -= 13;
  for (const ligneAdresse of opts.tiers.lignesAdresse || []) {
    pdf.text(L, y, 9, ligneAdresse); y -= 12;
  }
  pdf.text(L + 300, y + (opts.tiers.lignesAdresse ? 12 : 0), 10, `${opts.dateLabel || 'Date'} : ${fmtDate(opts.date)}`);
  y -= 8;

  pdf.rect(L, y - 4, W, 18, 0.88);
  pdf.text(L + 4, y, 9, 'Désignation', true);
  pdf.text(L + 300, y, 9, 'Quantité', true);
  pdf.text(L + 370, y, 9, 'Prix unitaire', true);
  pdf.text(L + 470, y, 9, 'Montant', true);
  y -= 18;
  let total = 0;
  for (const ligne of opts.lignes) {
    if (y < 90) {
      pdf.text(L, 40, 8, `${org.nom || 'NOVA SANTÉ PHARMA'} — ${opts.numero} — document confidentiel`);
      pdf.endPage();
      y = 800;
      pdf.rect(L, y - 4, W, 18, 0.88);
      pdf.text(L + 4, y, 9, 'Désignation (suite)', true);
      pdf.text(L + 300, y, 9, 'Quantité', true);
      pdf.text(L + 370, y, 9, 'Prix unitaire', true);
      pdf.text(L + 470, y, 9, 'Montant', true);
      y -= 18;
    }
    const montant = ligne.quantite * ligne.prixUnitaire;
    total += montant;
    pdf.text(L + 4, y, 9, ligne.libelle);
    pdf.text(L + 300, y, 9, String(ligne.quantite));
    pdf.text(L + 370, y, 9, fmtMoney(ligne.prixUnitaire));
    pdf.text(L + 470, y, 9, fmtMoney(montant));
    y -= 14;
    pdf.line(L, y + 6, R, y + 6, 0.3);
  }
  y -= 8;
  pdf.line(L + 350, y, R, y, 0.7); y -= 16;
  pdf.text(L + 370, y, 12, 'TOTAL', true);
  pdf.text(L + 470, y, 12, fmtMoney(total), true);
  y -= 30;

  if (opts.notes) {
    pdf.text(L, y, 9, opts.notes);
    y -= 20;
  }

  pdf.text(L, 40, 8, `${org.nom || 'NOVA SANTÉ PHARMA'} — ${opts.numero} — ${opts.pied || 'document confidentiel, réservé aux personnes autorisées.'}`);
  return { buffer: pdf.build(), total };
}
