/** Libellé et couleur de chaque statut de réquisition. */
export const STATUTS_REQUISITION: Record<string, { libelle: string; ton: string }> = {
  brouillon: { libelle: 'Brouillon', ton: 'warn' },
  envoyee: { libelle: 'Envoyée', ton: 'ok' },
  recue: { libelle: 'Reçue', ton: 'ok' },
  annulee: { libelle: 'Annulée', ton: 'danger' },
};
