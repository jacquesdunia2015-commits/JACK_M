/** Statuts d'une facture client, en clair et en couleur. */
export const STATUTS_FACTURE: Record<string, { libelle: string; ton: string }> = {
  issued: { libelle: 'À régler', ton: 'warn' },
  partially_paid: { libelle: 'Partiellement réglée', ton: 'warn' },
  paid: { libelle: 'Réglée', ton: 'ok' },
  overdue: { libelle: 'En retard', ton: 'danger' },
  cancelled: { libelle: 'Annulée', ton: 'muted' },
  credited: { libelle: 'Avoir émis', ton: 'muted' },
};

export const statutFacture = (statut: string) => STATUTS_FACTURE[statut] ?? { libelle: statut, ton: 'muted' };

export const MOYENS_PAIEMENT: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  bank_local: 'Banque',
  credit: 'À crédit',
  manual: 'Autre',
};
