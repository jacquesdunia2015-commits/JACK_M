/** Libellés de la place de marché, utilisables côté serveur comme côté client. */
export const DISPONIBILITE: Record<string, { libelle: string; ton: string }> = {
  in_stock: { libelle: 'En stock', ton: 'ok' }, limited: { libelle: 'Stock limité', ton: 'warn' },
  on_order: { libelle: 'Sur commande', ton: 'muted' }, out: { libelle: 'Épuisé', ton: 'danger' },
};
