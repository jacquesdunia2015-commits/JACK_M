/** Libellés des traitements suivis, utilisables côté serveur comme côté client. */
export const MALADIES: Record<string, string> = {
  hypertension: 'Hypertension',
  diabete: 'Diabète',
  vih: 'VIH (antirétroviraux)',
  asthme: 'Asthme',
  epilepsie: 'Épilepsie',
  cardiaque: 'Maladie cardiaque',
  tuberculose: 'Tuberculose',
  drepanocytose: 'Drépanocytose',
  autre: 'Autre traitement long',
};

export const ETATS_TRAITEMENT: Record<string, { libelle: string; ton: string }> = {
  en_retard: { libelle: 'Boîte finie', ton: 'danger' },
  a_prevenir: { libelle: 'À prévenir', ton: 'warn' },
  en_cours: { libelle: 'En cours', ton: 'ok' },
  sans_date: { libelle: 'Date inconnue', ton: 'muted' },
  arrete: { libelle: 'Arrêté', ton: 'muted' },
};

/** « dans 3 j », « aujourd'hui », « depuis 5 j ». */
export function echeance(joursRestants: number | null): string {
  if (joursRestants === null) return '—';
  if (joursRestants === 0) return 'aujourd’hui';
  if (joursRestants === 1) return 'demain';
  return joursRestants > 0 ? `dans ${joursRestants} j` : `depuis ${-joursRestants} j`;
}
