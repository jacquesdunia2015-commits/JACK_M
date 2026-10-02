import PDFDocument from 'pdfkit';
import {
  ENCRE, EnteteOfficine, FOND_ENTETE, GRIS, TRAIT, VERT,
  dateFr, ecrireEntete, ecrirePied, montant, nomOfficine as nomDe, quantite, tamponDe,
} from '../../../common/pdf/mise-en-page';

export type { EnteteOfficine };

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
  const fin = tamponDe(doc);
  const nomOfficine = nomDe(entree.officine);
  const largeur = doc.page.width - 96;

  entree.groupes.forEach((groupe, index) => {
    if (index > 0) doc.addPage();
    const references = [`N° ${entree.numero}`, `Date : ${dateFr(entree.date)}`];
    if (entree.souhaiteeLe) references.push(`Livraison souhaitée : ${dateFr(entree.souhaiteeLe)}`);
    let y = ecrireEntete(doc, entree.officine, 'RÉQUISITION', references);

    // --- Destinataire
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
      doc.rect(48, y, largeur, 20).fill(FOND_ENTETE);
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

    ecrirePied(doc, `${nomOfficine} · Réquisition ${entree.numero} · établie avec NOVA PHARMA OS`);
  });

  doc.end();
  return fin;
}
