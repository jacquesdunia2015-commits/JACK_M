import PDFDocument from 'pdfkit';
import {
  ENCRE, EnteteOfficine, FOND_ENTETE, GRIS, TRAIT, VERT,
  dateFr, ecrireEntete, ecrirePied, montant, nomOfficine, tamponDe,
} from '../../../common/pdf/mise-en-page';

export interface LigneReleve {
  date: string;
  vente: string;
  beneficiaire: string;
  carte: string;
  principal: string | null;
  bon: string | null;
  total: number;
  partPatient: number;
  partPayeur: number;
  taux: number;
}

const MOYENS: Record<string, string> = {
  bank_transfer: 'Virement', cash: 'Espèces', mobile_money: 'Mobile Money', bank_local: 'Banque', manual: 'Autre',
};

/**
 * Relevé présenté à un organisme payeur : une ligne par vente prise en
 * charge sur la période (bénéficiaire, carte, bon de prise en charge,
 * montant, part du patient, part du payeur), total à régler, signature.
 */
export function documentReleve(entree: {
  officine: EnteteOfficine;
  numero: string;
  debut: string;
  fin: string;
  echeance: string | null;
  statut: string;
  devise: string;
  payeur: {
    nom: string; code: string; contact: string | null; telephone: string | null;
    email: string | null; adresse: string | null;
  };
  lignes: LigneReleve[];
  total: number;
  paye: number;
  reglements: { moyen: string; montant: number; reference: string | null; date: string }[];
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 48,
    info: { Title: `Relevé ${entree.numero}`, Author: nomOfficine(entree.officine), Creator: 'NOVA PHARMA OS' },
  });
  const fin = tamponDe(doc);
  const largeur = doc.page.width - 96;
  const devise = entree.devise;

  const references = [
    `N° ${entree.numero}`,
    `Période du ${dateFr(entree.debut)} au ${dateFr(entree.fin)}`,
  ];
  if (entree.echeance) references.push(`À régler avant le ${dateFr(entree.echeance)}`);
  let y = ecrireEntete(doc, entree.officine, 'RELEVÉ DE TIERS PAYANT', references);

  // --- Organisme
  const p = entree.payeur;
  doc.roundedRect(48, y, largeur, 52, 6).lineWidth(0.8).strokeColor(TRAIT).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('ORGANISME PAYEUR', 60, y + 9);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ENCRE).text(`${p.nom} (${p.code})`, 60, y + 21, { width: largeur - 24, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
    [p.contact, p.telephone ? `Tél. ${p.telephone}` : null, p.email, p.adresse].filter(Boolean).join('   ·   ') || ' ',
    60, y + 37, { width: largeur - 24, lineBreak: false },
  );
  y += 64;

  // --- Ventes
  const colonnes = [
    { titre: 'Date', l: 62, align: 'left' as const },
    { titre: 'Vente', l: 92, align: 'left' as const },
    { titre: 'Bénéficiaire', l: 170, align: 'left' as const },
    { titre: 'Carte', l: 88, align: 'left' as const },
    { titre: 'Bon', l: 70, align: 'left' as const },
    { titre: 'Montant', l: 70, align: 'right' as const },
    { titre: 'Taux', l: 40, align: 'right' as const },
    { titre: 'Part patient', l: 70, align: 'right' as const },
    { titre: 'Part payeur', l: 0, align: 'right' as const },
  ];
  let x = 48;
  const xs = colonnes.map((c) => { const d = x; x += c.l; return d; });
  colonnes[colonnes.length - 1].l = 48 + largeur - xs[xs.length - 1];

  const entete = () => {
    doc.rect(48, y, largeur, 20).fill(FOND_ENTETE);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(VERT);
    colonnes.forEach((c, i) => doc.text(c.titre.toUpperCase(), xs[i] + 4, y + 6, { width: c.l - 8, align: c.align }));
    y += 24;
  };
  entete();

  for (const l of entree.lignes) {
    const nom = l.principal ? `${l.beneficiaire} (ayant droit de ${l.principal})` : l.beneficiaire;
    doc.font('Helvetica').fontSize(8.5);
    const hauteur = Math.max(16, doc.heightOfString(nom, { width: colonnes[2].l - 8 }) + 6);
    if (y + hauteur > doc.page.height - 110) {
      doc.addPage();
      y = 48;
      entete();
    }
    const valeurs = [
      dateFr(l.date), l.vente, nom, l.carte, l.bon ?? '—',
      montant(l.total, null), `${l.taux.toLocaleString('fr-FR')} %`, montant(l.partPatient, null), montant(l.partPayeur, null),
    ];
    valeurs.forEach((v, i) => {
      doc.font(i === 8 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(i === 2 || i === 8 ? ENCRE : GRIS)
        .text(v, xs[i] + 4, y, { width: colonnes[i].l - 8, align: colonnes[i].align });
    });
    y += hauteur;
    doc.moveTo(48, y - 3).lineTo(48 + largeur, y - 3).lineWidth(0.5).strokeColor(TRAIT).stroke();
  }

  // --- Totaux
  if (y + 110 > doc.page.height - 60) {
    doc.addPage();
    y = 48;
  }
  y += 8;
  const yTotaux = y;
  const reste = Math.round((entree.total - entree.paye) * 100) / 100;
  const totaux: [string, string, boolean][] = [
    [`${entree.lignes.length} vente(s) — total à la charge de ${p.nom}`, montant(entree.total, devise), true],
  ];
  if (entree.paye > 0) {
    totaux.push(['Déjà réglé', montant(entree.paye, devise), false]);
    totaux.push(['Reste à régler', montant(reste, devise), true]);
  }
  for (const [libelle, valeur, fort] of totaux) {
    doc.font(fort ? 'Helvetica-Bold' : 'Helvetica').fontSize(fort ? 11 : 9.5).fillColor(ENCRE)
      .text(libelle, 48, y, { width: largeur - 130, align: 'right' })
      .text(valeur, 48 + largeur - 125, y, { width: 125, align: 'right' });
    y += fort ? 17 : 14;
  }
  // Tampon de statut, à gauche des totaux.
  const tampon = entree.statut === 'cancelled' ? 'ANNULÉ' : reste <= 0 && entree.total > 0 ? 'RÉGLÉ' : null;
  if (tampon) {
    const couleur = entree.statut === 'cancelled' ? '#b42318' : VERT;
    doc.save().rotate(-8, { origin: [130, yTotaux + 18] });
    doc.roundedRect(60, yTotaux, 130, 36, 6).lineWidth(2).strokeColor(couleur).stroke();
    doc.font('Helvetica-Bold').fontSize(18).fillColor(couleur).text(tampon, 60, yTotaux + 9, { width: 130, align: 'center' });
    doc.restore();
    y = Math.max(y, yTotaux + 50);
  }
  if (entree.reglements.length) {
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(
      'Règlements reçus : ' + entree.reglements
        .map((r) => `${dateFr(r.date)} ${MOYENS[r.moyen] ?? r.moyen}${r.reference ? ` réf. ${r.reference}` : ''} ${montant(r.montant, devise)}`)
        .join('   ·   '),
      48, y + 2, { width: largeur },
    );
    y = doc.y + 6;
  }

  // --- Signatures
  const ySignature = Math.min(Math.max(y + 14, doc.page.height - 130), doc.page.height - 100);
  doc.font('Helvetica').fontSize(9).fillColor(GRIS)
    .text('Pour la pharmacie (signature et cachet) :', 48, ySignature)
    .text(`Pour ${p.nom} (visa) :`, 48 + largeur / 2, ySignature);
  doc.moveTo(48, ySignature + 40).lineTo(48 + largeur / 2 - 30, ySignature + 40).lineWidth(0.5).strokeColor(TRAIT).stroke();
  doc.moveTo(48 + largeur / 2, ySignature + 40).lineTo(48 + largeur, ySignature + 40).stroke();

  ecrirePied(doc, `${nomOfficine(entree.officine)} · Relevé ${entree.numero} · établi avec NOVA PHARMA OS`);
  doc.end();
  return fin;
}
