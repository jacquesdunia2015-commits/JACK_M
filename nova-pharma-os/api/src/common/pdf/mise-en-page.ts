/**
 * Mise en page commune des documents PDF remis aux tiers (réquisitions,
 * factures) : en-tête de l'officine avec son logo, formats de nombres et
 * de dates, pied de page.
 */

export interface EnteteOfficine {
  legal_name: string;
  trade_name: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_data: string | null;
  tax_id?: string | null;
  license_number?: string | null;
  [colonne: string]: unknown;
}

export const VERT = '#0f7b6c';
export const ENCRE = '#10201d';
export const GRIS = '#5b6b68';
export const TRAIT = '#dbe3e1';
export const FOND_ENTETE = '#e6f4f1';

/** Colonnes de l'officine à lire pour l'en-tête. */
export const COLONNES_OFFICINE =
  'legal_name, trade_name, address, city, phone, email, logo_data, tax_id, license_number';

/**
 * Montant lisible avec les polices standard du PDF : espace simple comme
 * séparateur de milliers. L'espace fine insécable de toLocaleString('fr')
 * n'existe pas dans ces polices et s'imprimerait comme un signe parasite.
 */
export function montant(valeur: number, devise: string | null): string {
  const [entier, decimales] = Math.abs(valeur).toFixed(2).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${valeur < 0 ? '-' : ''}${groupe},${decimales}${devise ? ` ${devise}` : ''}`;
}

export function quantite(valeur: number): string {
  const [entier, decimales] = (Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(3).replace(/0+$/, '')).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimales ? `${groupe},${decimales}` : groupe;
}

export function dateFr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date) : date;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Logo en data URL → image utilisable par le PDF (PNG ou JPEG). */
export function imageLogo(dataUrl: string | null): Buffer | null {
  const m = dataUrl?.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
}

export const nomOfficine = (officine: EnteteOfficine) => officine.trade_name || officine.legal_name;

/**
 * En-tête : logo et coordonnées de l'officine à gauche, titre du document
 * et ses références à droite. Renvoie l'ordonnée sous l'en-tête.
 */
export function ecrireEntete(
  doc: PDFKit.PDFDocument,
  officine: EnteteOfficine,
  titre: string,
  references: string[],
): number {
  const haut = 48;
  const largeur = doc.page.width - 96;
  const logo = imageLogo(officine.logo_data);

  let xTexte = 48;
  if (logo) {
    try {
      doc.image(logo, 48, haut, { fit: [64, 64] });
      xTexte = 128;
    } catch {
      xTexte = 48;
    }
  }
  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(15).text(nomOfficine(officine), xTexte, haut, { width: 300 });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  const coordonnees = [
    officine.address,
    officine.city,
    officine.phone ? `Tél. ${officine.phone}` : null,
    officine.email,
    officine.license_number ? `Autorisation n° ${officine.license_number}` : null,
    officine.tax_id ? `N° impôt : ${officine.tax_id}` : null,
  ].filter(Boolean) as string[];
  for (const ligne of coordonnees) doc.text(ligne, xTexte, doc.y, { width: 300 });
  const basGauche = doc.y;

  doc.font('Helvetica-Bold').fontSize(18).fillColor(VERT)
    .text(titre, 48, haut, { width: largeur, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(ENCRE);
  doc.y += 2;
  for (const ligne of references) doc.text(ligne, 48, doc.y, { width: largeur, align: 'right' });

  return Math.max(doc.y, basGauche, haut + 70) + 18;
}

/**
 * Pied de page. Il est écrit sous la marge basse : sans lever cette marge
 * le temps de l'écrire, le générateur ouvrirait une page blanche.
 */
export function ecrirePied(doc: PDFKit.PDFDocument, texte: string): void {
  const largeur = doc.page.width - 96;
  const margeBasse = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(
    texte, 48, doc.page.height - 40, { width: largeur, align: 'center', lineBreak: false },
  );
  doc.page.margins.bottom = margeBasse;
}

/** Rassemble le flux du document en un seul tampon. */
export function tamponDe(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));
}
