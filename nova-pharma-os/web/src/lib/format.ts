/** Mise en forme des montants, quantités et dates, en français. */

export function money(value: unknown, currency = 'USD'): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function quantity(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(amount);
}

export function percent(value: unknown): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  )} %`;
}

export function date(value: unknown): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
    new Date(value as string),
  );
}

export function dateTime(value: unknown): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value as string));
}

/** Nombre de jours restants, en clair. */
export function daysUntil(value: unknown): string {
  if (!value) return '—';
  const days = Math.ceil(
    (new Date(value as string).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return `échu depuis ${Math.abs(days)} j`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Essai gratuit',
  trialing: 'Essai gratuit',
  active: 'Actif',
  pending_payment: 'Paiement en attente',
  past_due: 'En retard de paiement',
  suspended: 'Suspendu',
  cancelled: 'Résilié',
  terminated: 'Résilié',
  expired: 'Expiré',
  archived: 'Archivé',
  prospect: 'Prospect',
  draft: 'Brouillon',
  issued: 'Émise',
  paid: 'Réglée',
  partially_paid: 'Partiellement réglée',
  overdue: 'En retard',
  credited: 'Créditée',
  completed: 'Terminée',
  open: 'Ouvert',
  in_progress: 'En cours',
  pending_customer: 'En attente du client',
  resolved: 'Résolu',
  closed: 'Clos',
  requested: 'En attente de validation',
  approved: 'Autorisé',
  revoked: 'Révoqué',
  denied: 'Refusé',
  read_only: 'Lecture seule',
  read_write: 'Lecture et écriture',
  out_of_stock: 'Rupture',
  low_stock: 'Stock bas',
  expiring: 'Péremption proche',
  expired_lot: 'Lot périmé',
};

export function statusLabel(status: unknown): string {
  const key = String(status ?? '');
  return STATUS_LABELS[key] ?? key;
}

export function statusTone(status: unknown): 'ok' | 'warn' | 'danger' | 'muted' {
  const key = String(status ?? '');
  if (['active', 'paid', 'completed', 'resolved', 'approved'].includes(key)) return 'ok';
  if (['trial', 'trialing', 'pending_payment', 'issued', 'open', 'requested', 'low_stock', 'expiring'].includes(key))
    return 'warn';
  if (['suspended', 'past_due', 'overdue', 'cancelled', 'terminated', 'expired', 'out_of_stock', 'denied', 'revoked'].includes(key))
    return 'danger';
  return 'muted';
}
