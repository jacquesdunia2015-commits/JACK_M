import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LEVELS, type Level } from '../lib/format';
import { useT } from '../i18n';

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>{children}</span>;
}

/** Pastille couleur de garantie ; les niveaux d'alerte pulsent. */
export function AlertBadge({ level, days }: { level: Level | null; days?: number }) {
  const t = useT();
  if (!level) return <Badge className="bg-slate-100 text-slate-600 ring-slate-200">{t('alert.closed')}</Badge>;
  const l = LEVELS[level];
  const label = t(`level.${level}`);
  const txt =
    days === undefined ? label : days > 0 ? t('alert.days', { n: days }) : days === 0 ? t('alert.today') : t('alert.expiredDays', { n: -days });
  return (
    <Badge className={`${l.badge} ${l.pulse}`}>
      <span className={`h-2 w-2 rounded-full ${l.dot}`} aria-hidden />
      {txt}
      <span className="sr-only"> — {label}</span>
    </Badge>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
}

export function Loading() {
  const t = useT();
  return <div className="py-16 text-center text-sm text-slate-500">{t('common.loading')}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-3 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, to, className = '' }: { label: string; value: ReactNode; sub?: ReactNode; to?: string; className?: string }) {
  const inner = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className={`card block hover:border-brand-600 ${className}`}>{inner}</Link>
  ) : (
    <div className={`card ${className}`}>{inner}</div>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-amber-500" title={`${value}/5`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end font-medium text-slate-800">{children ?? '—'}</dd>
    </div>
  );
}
