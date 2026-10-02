/**
 * Pays proposés pour la fiche d'un fournisseur : ceux d'où viennent le plus
 * souvent les produits des pharmacies de la région des Grands Lacs. L'API
 * en connaît l'indicatif téléphonique (common/telephone.ts).
 */
export const PAYS: { code: string; nom: string }[] = [
  { code: 'CD', nom: 'RD Congo' },
  { code: 'RW', nom: 'Rwanda' },
  { code: 'BI', nom: 'Burundi' },
  { code: 'UG', nom: 'Ouganda' },
  { code: 'TZ', nom: 'Tanzanie' },
  { code: 'KE', nom: 'Kenya' },
  { code: 'CG', nom: 'Congo-Brazzaville' },
  { code: 'ZM', nom: 'Zambie' },
  { code: 'AO', nom: 'Angola' },
  { code: 'CF', nom: 'Centrafrique' },
  { code: 'SS', nom: 'Soudan du Sud' },
  { code: 'CM', nom: 'Cameroun' },
  { code: 'ZA', nom: 'Afrique du Sud' },
  { code: 'NG', nom: 'Nigeria' },
  { code: 'SN', nom: 'Sénégal' },
  { code: 'CI', nom: "Côte d'Ivoire" },
  { code: 'ML', nom: 'Mali' },
  { code: 'MA', nom: 'Maroc' },
  { code: 'EG', nom: 'Égypte' },
  { code: 'AE', nom: 'Émirats arabes unis' },
  { code: 'IN', nom: 'Inde' },
  { code: 'CN', nom: 'Chine' },
  { code: 'BE', nom: 'Belgique' },
  { code: 'FR', nom: 'France' },
  { code: 'DE', nom: 'Allemagne' },
  { code: 'NL', nom: 'Pays-Bas' },
  { code: 'CH', nom: 'Suisse' },
  { code: 'GB', nom: 'Royaume-Uni' },
  { code: 'US', nom: 'États-Unis' },
];

export const DEVISES = ['USD', 'CDF', 'RWF', 'BIF', 'UGX', 'TZS', 'KES', 'EUR'];

export function nomPays(code: string | null | undefined): string {
  if (!code) return '—';
  return PAYS.find((p) => p.code === code)?.nom ?? code;
}

/** Lien WhatsApp d'un numéro international (+243991234567 → wa.me/243991234567). */
export function lienWhatsApp(telephone: string | null | undefined): string | null {
  const chiffres = telephone?.replace(/\D/g, '');
  return chiffres ? `https://wa.me/${chiffres}` : null;
}
