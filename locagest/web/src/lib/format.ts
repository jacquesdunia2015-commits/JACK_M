export type Level = 'vert' | 'jaune' | 'orange' | 'rouge';

export const LEVELS: Record<Level, { label: string; emoji: string; badge: string; dot: string; range: string; action: string; pulse: string }> = {
  vert: {
    label: 'Normal', emoji: '🟢', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500',
    range: '60 jours et plus', action: 'Aucune action immédiate', pulse: '',
  },
  jaune: {
    label: 'Attention', emoji: '🟡', badge: 'bg-yellow-50 text-yellow-800 ring-yellow-300', dot: 'bg-yellow-400',
    range: '30 à 59 jours', action: 'Préparer le renouvellement, contacter le locataire', pulse: 'alert-pulse-slow [--pulse-color:rgb(234_179_8/0.5)]',
  },
  orange: {
    label: 'Urgent', emoji: '🟠', badge: 'bg-orange-50 text-orange-800 ring-orange-300', dot: 'bg-orange-500',
    range: '1 à 29 jours', action: 'Relancer le locataire, préparer les documents', pulse: 'alert-pulse [--pulse-color:rgb(249_115_22/0.55)]',
  },
  rouge: {
    label: 'Critique', emoji: '🔴', badge: 'bg-red-50 text-red-800 ring-red-300', dot: 'bg-red-500',
    range: 'Expirée', action: 'Action immédiate, régulariser la situation', pulse: 'alert-pulse [--pulse-color:rgb(239_68_68/0.55)]',
  },
};
export const LEVEL_ORDER: Level[] = ['rouge', 'orange', 'jaune', 'vert'];

export function money(n: number | null | undefined, currency = 'USD') {
  const v = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: currency === 'CDF' ? 0 : 2 }).format(n ?? 0);
  return currency === 'CDF' ? `${v} FC` : `${v} $`;
}

export function date(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export function month(p: string) {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const PROPERTY_TYPES: Record<string, string> = {
  maison: 'Maison', appartement: 'Appartement', studio: 'Studio', villa: 'Villa', chambre: 'Chambre', bureau: 'Bureau', autre: 'Autre',
};
export const PROPERTY_STATUS: Record<string, { label: string; cls: string }> = {
  vacante: { label: 'Vacante', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  occupee: { label: 'Occupée', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  maintenance: { label: 'En maintenance', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
};
export const CONDITIONS: Record<string, string> = { bon: 'Bon état', moyen: 'État moyen', a_renover: 'À rénover' };
export const LEASE_STATUS: Record<string, string> = { actif: 'Actif', termine: 'Terminé', renouvele: 'Renouvelé' };
export const PAYMENT_METHODS: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile Money', virement: 'Virement', autre: 'Autre',
};
export const PAYMENT_STATES: Record<string, { label: string; cls: string }> = {
  paye: { label: 'Payé', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  partiel: { label: 'Partiel', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  a_venir: { label: 'À venir', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  en_retard: { label: 'En retard', cls: 'bg-orange-50 text-orange-800 ring-orange-300' },
  impaye: { label: 'Impayé', cls: 'bg-red-50 text-red-800 ring-red-300' },
};

export function address(p: { numero?: string | null; avenue?: string | null; quartier?: string | null; commune?: string; province?: string }) {
  return [[p.numero, p.avenue].filter(Boolean).join(' '), p.quartier, p.commune, p.province].filter(Boolean).join(', ');
}
