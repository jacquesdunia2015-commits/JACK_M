/** Périodes des rapports, en jours du fuseau de Goma et Bukavu (UTC+2). */
const FUSEAU = 'Africa/Lubumbashi';

export const jourLocal = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const decaler = (jour: string, jours: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
};

export interface Periode { code: string; libelle: string; de: string; a: string }

export function periodes(): Periode[] {
  const auj = jourLocal();
  const debutMois = `${auj.slice(0, 8)}01`;
  const finMoisPrec = decaler(debutMois, -1);
  return [
    { code: 'jour', libelle: 'Aujourd’hui', de: auj, a: auj },
    { code: 'hier', libelle: 'Hier', de: decaler(auj, -1), a: decaler(auj, -1) },
    { code: '7j', libelle: '7 derniers jours', de: decaler(auj, -6), a: auj },
    { code: 'mois', libelle: 'Ce mois', de: debutMois, a: auj },
    { code: 'mois-prec', libelle: 'Mois précédent', de: `${finMoisPrec.slice(0, 8)}01`, a: finMoisPrec },
    { code: '90j', libelle: '90 derniers jours', de: decaler(auj, -89), a: auj },
  ];
}

/** Tous les jours de la période, pour un graphique sans trou. */
export function joursEntre(de: string, a: string, max = 92): string[] {
  const jours: string[] = [];
  for (let j = de; j <= a && jours.length < max; j = decaler(j, 1)) jours.push(j);
  return jours;
}

export const valide = (j?: string) => (j && /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : undefined);
