/** Niveaux d'interaction (Thésaurus ANSM), utilisables côté serveur comme côté client. */
export const NIVEAUX_INTERACTION: Record<string, { libelle: string; ton: string }> = {
  contre_indication: { libelle: 'Contre-indication', ton: 'danger' },
  deconseillee: { libelle: 'Association déconseillée', ton: 'danger' },
  precaution: { libelle: 'Précaution d’emploi', ton: 'warn' },
  a_prendre_en_compte: { libelle: 'À prendre en compte', ton: 'muted' },
};

export interface AlerteInteraction {
  interactionId: string; severity: string; effect: string; advice: string | null; source: string | null;
  products: { id: string; name: string; origin: 'ticket' | 'traitement' }[];
}
