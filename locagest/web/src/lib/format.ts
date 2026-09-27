export type Level = 'vert' | 'jaune' | 'orange' | 'rouge';

/** Styles des niveaux d'alerte ; les libellés sont dans les traductions (level.*). */
export const LEVELS: Record<Level, { emoji: string; badge: string; dot: string; pulse: string; color: string }> = {
  vert: { emoji: '🟢', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', pulse: '', color: '#10b981' },
  jaune: {
    emoji: '🟡', badge: 'bg-yellow-50 text-yellow-800 ring-yellow-300', dot: 'bg-yellow-400',
    pulse: 'alert-pulse-slow [--pulse-color:rgb(234_179_8/0.5)]', color: '#facc15',
  },
  orange: {
    emoji: '🟠', badge: 'bg-orange-50 text-orange-800 ring-orange-300', dot: 'bg-orange-500',
    pulse: 'alert-pulse [--pulse-color:rgb(249_115_22/0.55)]', color: '#f97316',
  },
  rouge: {
    emoji: '🔴', badge: 'bg-red-50 text-red-800 ring-red-300', dot: 'bg-red-500',
    pulse: 'alert-pulse [--pulse-color:rgb(239_68_68/0.55)]', color: '#ef4444',
  },
};
export const LEVEL_ORDER: Level[] = ['rouge', 'orange', 'jaune', 'vert'];

export const PROPERTY_TYPES = ['maison', 'appartement', 'studio', 'villa', 'chambre', 'bureau', 'autre'] as const;
export const PROPERTY_STATUSES = ['vacante', 'occupee', 'maintenance'] as const;
export const PROPERTY_STATUS_CLS: Record<string, string> = {
  vacante: 'bg-sky-50 text-sky-800 ring-sky-200',
  occupee: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  maintenance: 'bg-slate-100 text-slate-700 ring-slate-300',
};
export const CONDITIONS = ['bon', 'moyen', 'a_renover'] as const;
export const PAYMENT_METHODS = ['especes', 'mobile_money', 'virement', 'autre'] as const;
export const PAYMENT_STATE_CLS: Record<string, string> = {
  paye: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  partiel: 'bg-sky-50 text-sky-800 ring-sky-200',
  a_venir: 'bg-slate-100 text-slate-700 ring-slate-300',
  en_retard: 'bg-orange-50 text-orange-800 ring-orange-300',
  impaye: 'bg-red-50 text-red-800 ring-red-300',
};

// Locale des formats (dates, nombres), réglée par le fournisseur de traductions.
let intl = 'fr-FR';
export function setFormatLocale(locale: string) {
  intl = locale;
}

/** Montant dans sa monnaie, au format de la langue de l'interface (« 1 500 $ », « 25 000 FC », « €300 »…). */
export function money(n: number | null | undefined, currency = 'USD') {
  const value = n ?? 0;
  let s: string;
  try {
    s = new Intl.NumberFormat(intl, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    s = `${new Intl.NumberFormat(intl).format(value)} ${currency}`;
  }
  return s.replace('CDF', 'FC').replace(/\bXAF\b|\bXOF\b/, 'F CFA');
}

/** Plusieurs monnaies à la fois : « 1 500 $ · 250 000 FC » (monnaies à zéro omises). */
export function moneyAll(totals: Record<string, number> | null | undefined, fallbackCurrency = 'USD') {
  const entries = Object.entries(totals ?? {}).filter(([, v]) => v);
  if (!entries.length) return money(0, fallbackCurrency);
  return entries.map(([c, v]) => money(v, c)).join(' · ');
}

const utc = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day || 1));
};

export function date(d: string | null | undefined) {
  if (!d) return '—';
  return utc(d).toLocaleDateString(intl, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function dateTime(d: string) {
  return new Date(d).toLocaleString(intl, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function month(p: string) {
  return utc(p.slice(0, 7) + '-01').toLocaleDateString(intl, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shortMonth(p: string) {
  return utc(p.slice(0, 7) + '-01').toLocaleDateString(intl, { month: 'short', timeZone: 'UTC' });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function address(p: { numero?: string | null; avenue?: string | null; quartier?: string | null; commune?: string; province?: string }) {
  return [[p.numero, p.avenue].filter(Boolean).join(' '), p.quartier, p.commune, p.province].filter(Boolean).join(', ');
}
