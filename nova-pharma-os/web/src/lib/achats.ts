/** Statuts des commandes fournisseurs et des commandes de professionnels, en clair. */
export const STATUTS_COMMANDE: Record<string, { libelle: string; ton: string }> = {
  draft: { libelle: 'Brouillon', ton: 'muted' },
  submitted: { libelle: 'Transmise', ton: 'warn' },
  confirmed: { libelle: 'Confirmée', ton: 'warn' },
  preparing: { libelle: 'En préparation', ton: 'warn' },
  ready: { libelle: 'Prête', ton: 'warn' },
  shipped: { libelle: 'Expédiée', ton: 'warn' },
  partially_received: { libelle: 'Reçue en partie', ton: 'warn' },
  received: { libelle: 'Reçue', ton: 'ok' },
  delivered: { libelle: 'Livrée', ton: 'ok' },
  invoiced: { libelle: 'Facturée', ton: 'ok' },
  cancelled: { libelle: 'Annulée', ton: 'muted' },
  sent: { libelle: 'Envoyé', ton: 'warn' },
  accepted: { libelle: 'Accepté', ton: 'ok' },
  rejected: { libelle: 'Refusé', ton: 'danger' },
  expired: { libelle: 'Expiré', ton: 'muted' },
  converted: { libelle: 'Transformé en commande', ton: 'ok' },
};

export const statutCommande = (statut: string) => STATUTS_COMMANDE[statut] ?? { libelle: statut, ton: 'muted' };
