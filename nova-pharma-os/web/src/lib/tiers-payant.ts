/** Libellés du tiers payant, utilisables côté serveur comme côté client. */
export const TYPES_PAYEUR: Record<string, string> = {
  mutuelle: 'Mutuelle de santé',
  assurance: 'Assurance',
  entreprise: 'Entreprise (convention)',
  ong: 'ONG ou programme',
  autre: 'Autre',
};

export const STATUTS_RELEVE: Record<string, { libelle: string; ton: string }> = {
  draft: { libelle: 'Brouillon', ton: 'muted' },
  sent: { libelle: 'Présenté', ton: 'warn' },
  partially_paid: { libelle: 'Réglé en partie', ton: 'warn' },
  paid: { libelle: 'Réglé', ton: 'ok' },
  cancelled: { libelle: 'Annulé', ton: 'danger' },
};

/** Premier et dernier jour du mois précédent, au format AAAA-MM-JJ. */
export function moisPrecedent(aujourdhui = new Date()): { debut: string; fin: string } {
  const debut = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth() - 1, 1));
  const fin = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 0));
  return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}
