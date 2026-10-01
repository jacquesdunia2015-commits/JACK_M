/** Libellés des rappels de lots, utilisables côté serveur comme côté client. */
export const TYPES_RAPPEL: Record<string, { libelle: string; ton: string }> = {
  recall: { libelle: 'Rappel de lot', ton: 'warn' },
  falsified: { libelle: 'Produit falsifié', ton: 'danger' },
  quality: { libelle: 'Défaut de qualité', ton: 'warn' },
};

export const SOURCES_RAPPEL: Record<string, string> = {
  acorep: 'ACOREP (autorité de réglementation)',
  oms: 'OMS — alerte produit médical',
  fabricant: 'Fabricant',
  grossiste: 'Grossiste ou dépôt',
  autre: 'Autre source',
};

export const ACTIONS_RAPPEL: Record<string, string> = {
  quarantine: 'Bloquer le lot en attendant les instructions',
  return: 'Retourner au fournisseur',
  destroy: 'Détruire',
  inform: 'Informer les patients',
};

export const ISSUES_RAPPEL: Record<string, string> = {
  destroyed: 'Stock détruit',
  returned: 'Stock retourné au fournisseur',
  released: 'Fausse alerte, quarantaine levée',
  no_stock: 'Aucun stock concerné',
};
