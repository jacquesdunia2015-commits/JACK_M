import PDFDocument from 'pdfkit';
import {
  ENCRE, EnteteOfficine, FOND_ENTETE, GRIS, TRAIT, VERT,
  dateFr, ecrireEntete, ecrirePied, montant, nomOfficine, quantite, tamponDe,
} from '../../../common/pdf/mise-en-page';

export interface ClientPdf {
  nom: string;
  code: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  numeroImpot: string | null;
}

export interface LigneFacturePdf {
  designation: string;
  detail: string | null;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montant: number;
}

const LIBELLES_PAIEMENT: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  bank_local: 'Banque',
  credit: 'À crédit',
  manual: 'Autre',
  insurance: 'Prise en charge',
  loyalty: 'Points fidélité',
};

/**
 * Facture remise au client : officine et logo, client, articles, totaux
 * toutes taxes comprises, règlements et reste à payer.
 */
export function documentFacture(entree: {
  officine: EnteteOfficine;
  numero: string;
  date: string | Date;
  echeance: string | null;
  numeroVente: string | null;
  devise: string;
  statut: string;
  client: ClientPdf | null;
  ordonnance: { patient: string | null; prescripteur: string | null } | null;
  lignes: LigneFacturePdf[];
  sousTotal: number;
  remise: number;
  taxe: number;
  total: number;
  paye: number;
  paiements: { moyen: string; fournisseur: string | null; montant: number; reference: string | null }[];
  /** Monnaie rendue sur les espèces reçues. */
  rendu: number;
  vendeur: string | null;
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `Facture ${entree.numero}`,
      Author: nomOfficine(entree.officine),
      Creator: 'NOVA PHARMA OS',
    },
  });
  const fin = tamponDe(doc);
  const largeur = doc.page.width - 96;
  const devise = entree.devise;

  const references = [`N° ${entree.numero}`, `Date : ${dateFr(entree.date)}`];
  if (entree.numeroVente) references.push(`Vente ${entree.numeroVente}`);
  if (entree.echeance) references.push(`Échéance : ${dateFr(entree.echeance)}`);
  let y = ecrireEntete(doc, entree.officine, 'FACTURE', references);

  // --- Client
  const hauteurClient = 66;
  doc.roundedRect(48, y, largeur, hauteurClient, 6).lineWidth(0.8).strokeColor(TRAIT).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('FACTURÉ À', 60, y + 9);
  if (entree.client) {
    const c = entree.client;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(ENCRE)
      .text(c.nom, 60, y + 21, { width: largeur - 24, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
      [c.telephone ? `Tél. ${c.telephone}` : null, c.email, [c.adresse, c.ville].filter(Boolean).join(', ') || null]
        .filter(Boolean).join('   ·   ') || ' ',
      60, y + 38, { width: largeur - 24, lineBreak: false },
    );
    const refs = [c.code ? `Client ${c.code}` : null, c.numeroImpot ? `N° impôt : ${c.numeroImpot}` : null].filter(Boolean);
    if (refs.length) doc.text(refs.join('   ·   '), 60, y + 50, { width: largeur - 24, lineBreak: false });
  } else {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(ENCRE).text('Client comptant', 60, y + 21);
  }
  y += hauteurClient + 12;

  if (entree.ordonnance && (entree.ordonnance.patient || entree.ordonnance.prescripteur)) {
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
      ['Sur ordonnance', entree.ordonnance.patient ? `patient : ${entree.ordonnance.patient}` : null,
        entree.ordonnance.prescripteur ? `prescripteur : ${entree.ordonnance.prescripteur}` : null]
        .filter(Boolean).join(' · '),
      48, y, { width: largeur },
    );
    y = doc.y + 8;
  }

  // --- Articles
  const colonnes = [
    { titre: 'N°', x: 48, l: 24, align: 'left' as const },
    { titre: 'Désignation', x: 74, l: 214, align: 'left' as const },
    { titre: 'Qté', x: 290, l: 50, align: 'right' as const },
    { titre: 'Prix unitaire', x: 342, l: 76, align: 'right' as const },
    { titre: 'Remise', x: 420, l: 42, align: 'right' as const },
    { titre: 'Montant', x: 464, l: largeur + 48 - 464, align: 'right' as const },
  ];
  const entete = () => {
    doc.rect(48, y, largeur, 20).fill(FOND_ENTETE);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERT);
    for (const c of colonnes) doc.text(c.titre.toUpperCase(), c.x + 4, y + 6, { width: c.l - 8, align: c.align });
    y += 24;
  };
  entete();

  entree.lignes.forEach((l, i) => {
    doc.font('Helvetica-Bold').fontSize(9.5);
    const hauteurNom = doc.heightOfString(l.designation, { width: colonnes[1].l - 8 });
    doc.font('Helvetica').fontSize(8);
    const hauteurDetail = l.detail ? doc.heightOfString(l.detail, { width: colonnes[1].l - 8 }) : 0;
    const hauteur = Math.max(18, hauteurNom + hauteurDetail + 8);
    if (y + hauteur > doc.page.height - 120) {
      doc.addPage();
      y = 48;
      entete();
    }
    doc.font('Helvetica').fontSize(9.5).fillColor(GRIS).text(String(i + 1), colonnes[0].x + 4, y, { width: colonnes[0].l - 8 });
    doc.font('Helvetica-Bold').fillColor(ENCRE).text(l.designation, colonnes[1].x + 4, y, { width: colonnes[1].l - 8 });
    if (l.detail) doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(l.detail, colonnes[1].x + 4, doc.y, { width: colonnes[1].l - 8 });
    doc.font('Helvetica').fontSize(9.5).fillColor(ENCRE)
      .text(quantite(l.quantite), colonnes[2].x + 4, y, { width: colonnes[2].l - 8, align: 'right' })
      .text(montant(l.prixUnitaire, null), colonnes[3].x + 4, y, { width: colonnes[3].l - 8, align: 'right' })
      .text(l.remise > 0 ? `${quantite(l.remise)} %` : '—', colonnes[4].x + 4, y, { width: colonnes[4].l - 8, align: 'right' })
      .text(montant(l.montant, null), colonnes[5].x + 4, y, { width: colonnes[5].l - 8, align: 'right' });
    y += hauteur;
    doc.moveTo(48, y - 3).lineTo(48 + largeur, y - 3).lineWidth(0.5).strokeColor(TRAIT).stroke();
  });

  // --- Totaux
  const lignesTotaux: [string, string, boolean][] = [];
  if (entree.remise > 0) {
    lignesTotaux.push(['Sous-total', montant(entree.sousTotal, devise), false]);
    lignesTotaux.push(['Remise', montant(-entree.remise, devise), false]);
  }
  lignesTotaux.push(['Total TTC', montant(entree.total, devise), true]);
  if (entree.taxe > 0) lignesTotaux.push(['dont taxes', montant(entree.taxe, devise), false]);
  lignesTotaux.push(['Payé', montant(entree.paye, devise), false]);
  const reste = Math.round((entree.total - entree.paye) * 100) / 100;
  if (reste > 0) lignesTotaux.push(['Reste à payer', montant(reste, devise), true]);

  if (y + lignesTotaux.length * 16 + 90 > doc.page.height - 60) {
    doc.addPage();
    y = 48;
  }
  y += 6;
  for (const [libelle, valeur, fort] of lignesTotaux) {
    doc.font(fort ? 'Helvetica-Bold' : 'Helvetica').fontSize(fort ? 11 : 9.5).fillColor(ENCRE)
      .text(libelle, 330, y, { width: 110, align: 'right' })
      .text(valeur, 444, y, { width: largeur + 48 - 444, align: 'right' });
    y += fort ? 17 : 14;
  }

  // Tampon de statut, à gauche des totaux.
  const tampon = entree.statut === 'cancelled' ? 'ANNULÉE' : reste <= 0 ? 'PAYÉE' : null;
  if (tampon) {
    const couleur = entree.statut === 'cancelled' ? '#b42318' : VERT;
    const yTampon = y - lignesTotaux.length * 15 + 6;
    doc.save().rotate(-8, { origin: [120, yTampon + 20] });
    doc.roundedRect(60, yTampon, 130, 36, 6).lineWidth(2).strokeColor(couleur).stroke();
    doc.font('Helvetica-Bold').fontSize(18).fillColor(couleur).text(tampon, 60, yTampon + 9, { width: 130, align: 'center' });
    doc.restore();
  }

  // --- Règlements
  y += 8;
  if (entree.paiements.length > 0) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ENCRE).text('Règlement', 48, y);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
      entree.paiements
        .map((p) => {
          const moyen = LIBELLES_PAIEMENT[p.moyen] ?? p.moyen;
          const precision = [p.fournisseur, p.reference ? `réf. ${p.reference}` : null].filter(Boolean).join(', ');
          return `${moyen}${precision ? ` (${precision})` : ''} : ${montant(p.montant, devise)}`;
        })
        .concat(entree.rendu > 0 ? [`monnaie rendue : ${montant(entree.rendu, devise)}`] : [])
        .join('   ·   '),
      48, doc.y + 2, { width: largeur },
    );
    y = doc.y + 14;
  }

  // --- Signature
  const ySignature = Math.min(Math.max(y + 10, doc.page.height - 160), doc.page.height - 110);
  doc.font('Helvetica').fontSize(9).fillColor(GRIS)
    .text(`Servi par : ${entree.vendeur ?? '________________'}`, 48, ySignature)
    .text('Signature et cachet de la pharmacie :', 300, ySignature);
  doc.moveTo(300, ySignature + 44).lineTo(48 + largeur, ySignature + 44).lineWidth(0.5).strokeColor(TRAIT).stroke();
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRIS)
    .text('Merci de votre confiance. Conservez cette facture : elle vous sera demandée pour tout échange ou remboursement.',
      48, ySignature + 56, { width: largeur, align: 'center' });

  ecrirePied(doc, `${nomOfficine(entree.officine)} · Facture ${entree.numero} · établie avec NOVA PHARMA OS`);

  doc.end();
  return fin;
}
