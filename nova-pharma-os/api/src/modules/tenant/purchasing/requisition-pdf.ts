import PDFDocument from 'pdfkit';

export interface EnteteOfficine {
  legal_name: string;
  trade_name: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_data: string | null;
  [colonne: string]: unknown;
}

export interface LignePdf {
  designation: string;
  presentation: string | null;
  reference: string | null;
  quantite: number;
  prixUnitaire: number | null;
  devise: string | null;
  notes: string | null;
}

export interface GroupeFournisseur {
  fournisseur: {
    nom: string;
    telephone: string | null;
    email: string | null;
    ville: string | null;
    pays: string | null;
  } | null;
  lignes: LignePdf[];
}

const VERT = '#0f7b6c';
const ENCRE = '#10201d';
const GRIS = '#5b6b68';
const TRAIT = '#dbe3e1';

/**
 * Montant lisible avec les polices standard du PDF : espace simple comme
 * séparateur de milliers. L'espace fine insécable de toLocaleString('fr')
 * n'existe pas dans ces polices et s'imprimerait comme un signe parasite.
 */
function montant(valeur: number, devise: string | null): string {
  const [entier, decimales] = valeur.toFixed(2).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${groupe},${decimales}${devise ? ` ${devise}` : ''}`;
}

function quantite(valeur: number): string {
  const [entier, decimales] = (Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(3).replace(/0+$/, '')).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimales ? `${groupe},${decimales}` : groupe;
}

function dateFr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : date;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Logo en data URL → image utilisable par le PDF (PNG ou JPEG). */
function imageLogo(dataUrl: string | null): Buffer | null {
  const m = dataUrl?.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
}

/**
 * Document de réquisition, un fournisseur par page : ce que la pharmacie
 * lui demande, en quelle quantité, au prix de son catalogue.
 */
export function documentRequisition(entree: {
  officine: EnteteOfficine;
  numero: string;
  date: Date;
  souhaiteeLe: string | null;
  notes: string | null;
  demandeur: string | null;
  groupes: GroupeFournisseur[];
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `Réquisition ${entree.numero}`,
      Author: entree.officine.trade_name || entree.officine.legal_name,
      Creator: 'NOVA PHARMA OS',
    },
  });
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const logo = imageLogo(entree.officine.logo_data);
  const nomOfficine = entree.officine.trade_name || entree.officine.legal_name;
  const largeur = doc.page.width - 96;

  entree.groupes.forEach((groupe, index) => {
    if (index > 0) doc.addPage();
    const haut = 48;

    // --- En-tête : logo et coordonnées de la pharmacie
    let xTexte = 48;
    if (logo) {
      try {
        doc.image(logo, 48, haut, { fit: [64, 64] });
        xTexte = 128;
      } catch {
        xTexte = 48;
      }
    }
    doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(15).text(nomOfficine, xTexte, haut, { width: 300 });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS);
    const coordonnees = [
      entree.officine.address,
      entree.officine.city,
      entree.officine.phone ? `Tél. ${entree.officine.phone}` : null,
      entree.officine.email,
    ].filter(Boolean) as string[];
    for (const ligne of coordonnees) doc.text(ligne, xTexte, doc.y, { width: 300 });

    doc.font('Helvetica-Bold').fontSize(18).fillColor(VERT)
      .text('RÉQUISITION', 48, haut, { width: largeur, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(ENCRE)
      .text(`N° ${entree.numero}`, 48, doc.y + 2, { width: largeur, align: 'right' })
      .text(`Date : ${dateFr(entree.date)}`, { width: largeur, align: 'right' });
    if (entree.souhaiteeLe) {
      doc.text(`Livraison souhaitée : ${dateFr(entree.souhaiteeLe)}`, { width: largeur, align: 'right' });
    }

    // --- Destinataire
    let y = Math.max(doc.y, haut + 80) + 18;
    doc.roundedRect(48, y, largeur, 62, 6).lineWidth(0.8).strokeColor(TRAIT).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('À L’ATTENTION DE', 60, y + 9);
    if (groupe.fournisseur) {
      const f = groupe.fournisseur;
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ENCRE).text(f.nom, 60, y + 21, { width: largeur - 24 });
      doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
        [f.telephone ? `Tél. ${f.telephone}` : null, f.email, [f.ville, f.pays].filter(Boolean).join(', ') || null]
          .filter(Boolean).join('   ·   '),
        60, y + 38, { width: largeur - 24 },
      );
    } else {
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ENCRE)
        .text('Fournisseur à choisir', 60, y + 21);
    }
    y += 80;

    // --- Tableau
    const colonnes = [
      { titre: 'N°', x: 48, l: 24, align: 'left' as const },
      { titre: 'Désignation', x: 74, l: 236, align: 'left' as const },
      { titre: 'Quantité', x: 312, l: 60, align: 'right' as const },
      { titre: 'Prix unitaire', x: 374, l: 80, align: 'right' as const },
      { titre: 'Montant', x: 456, l: largeur + 48 - 456, align: 'right' as const },
    ];
    const entete = () => {
      doc.rect(48, y, largeur, 20).fill('#e6f4f1');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERT);
      for (const c of colonnes) doc.text(c.titre.toUpperCase(), c.x + 4, y + 6, { width: c.l - 8, align: c.align });
      y += 24;
    };
    entete();

    const totaux = new Map<string, number>();
    groupe.lignes.forEach((l, i) => {
      const detail = [l.presentation, l.reference, l.notes].filter(Boolean).join(' · ');
      doc.font('Helvetica-Bold').fontSize(9.5);
      const hauteurNom = doc.heightOfString(l.designation, { width: colonnes[1].l - 8 });
      doc.font('Helvetica').fontSize(8);
      const hauteurDetail = detail ? doc.heightOfString(detail, { width: colonnes[1].l - 8 }) : 0;
      const hauteur = Math.max(18, hauteurNom + hauteurDetail + 8);
      if (y + hauteur > doc.page.height - 130) {
        doc.addPage();
        y = 48;
        entete();
      }
      const total = l.prixUnitaire === null ? null : l.prixUnitaire * l.quantite;
      if (total !== null) totaux.set(l.devise ?? '', (totaux.get(l.devise ?? '') ?? 0) + total);

      doc.font('Helvetica').fontSize(9.5).fillColor(GRIS).text(String(i + 1), colonnes[0].x + 4, y, { width: colonnes[0].l - 8 });
      doc.font('Helvetica-Bold').fillColor(ENCRE).text(l.designation, colonnes[1].x + 4, y, { width: colonnes[1].l - 8 });
      if (detail) doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(detail, colonnes[1].x + 4, doc.y, { width: colonnes[1].l - 8 });
      doc.font('Helvetica').fontSize(9.5).fillColor(ENCRE)
        .text(quantite(l.quantite), colonnes[2].x + 4, y, { width: colonnes[2].l - 8, align: 'right' })
        .text(l.prixUnitaire === null ? '—' : montant(l.prixUnitaire, l.devise), colonnes[3].x + 4, y, { width: colonnes[3].l - 8, align: 'right' })
        .text(total === null ? '—' : montant(total, l.devise), colonnes[4].x + 4, y, { width: colonnes[4].l - 8, align: 'right' });
      y += hauteur;
      doc.moveTo(48, y - 3).lineTo(48 + largeur, y - 3).lineWidth(0.5).strokeColor(TRAIT).stroke();
    });

    // --- Totaux, par devise : on n'additionne pas des dollars et des francs
    y += 4;
    for (const [devise, total] of totaux) {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ENCRE)
        .text(`Total estimé : ${montant(total, devise || null)}`, 48, y, { width: largeur, align: 'right' });
      y = doc.y + 2;
    }
    if (totaux.size > 0) {
      doc.font('Helvetica').fontSize(8).fillColor(GRIS)
        .text('Prix indicatifs tirés du catalogue du fournisseur, à confirmer à la livraison.', 48, y + 2, { width: largeur, align: 'right' });
    }

    // --- Remarques et signature
    y = Math.max(doc.y + 20, y + 20);
    if (entree.notes) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ENCRE).text('Remarques', 48, y);
      doc.font('Helvetica').fontSize(9).fillColor(ENCRE).text(entree.notes, 48, doc.y + 2, { width: largeur });
      y = doc.y + 16;
    }
    const ySignature = Math.min(Math.max(y, doc.page.height - 170), doc.page.height - 130);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS)
      .text(`Demandé par : ${entree.demandeur ?? '________________'}`, 48, ySignature)
      .text('Signature et cachet :', 330, ySignature);
    doc.moveTo(330, ySignature + 44).lineTo(48 + largeur, ySignature + 44).lineWidth(0.5).strokeColor(TRAIT).stroke();

    // Le pied de page est sous la marge basse : sans lever cette marge le
    // temps de l'écrire, le générateur ouvrirait une page blanche.
    const margeBasse = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(
      `${nomOfficine} · Réquisition ${entree.numero} · établie avec NOVA PHARMA OS`,
      48, doc.page.height - 40, { width: largeur, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = margeBasse;
  });

  doc.end();
  return fin;
}
