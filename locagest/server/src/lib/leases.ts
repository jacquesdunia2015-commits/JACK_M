import { guaranteeStatus } from './alerts.js';
import { today } from './dates.js';

export const LEASE_SELECT = `
  SELECT l.*,
         p.title AS property_title, p.province, p.commune, p.quartier, p.avenue, p.numero, p.type AS property_type,
         t.first_name, t.last_name, t.email AS tenant_email, t.phone AS tenant_phone
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN tenants t ON t.id = l.tenant_id`;

export function formatAddress(r: { numero?: string | null; avenue?: string | null; quartier?: string | null; commune: string; province: string }) {
  const street = [r.numero, r.avenue].filter(Boolean).join(', av. ');
  return [street, r.quartier && `Q. ${r.quartier}`, `C. ${r.commune}`, r.province].filter(Boolean).join(' — ');
}

/** Ajoute au bail son statut de garantie (couleur, jours restants). */
export function withGuarantee<T extends { guarantee_expires_on: string; status: string }>(lease: T, ref = today()) {
  const g = guaranteeStatus(lease.guarantee_expires_on, ref);
  return {
    ...lease,
    guarantee: lease.status === 'actif' ? g : { ...g, level: null as null, action: 'Bail clôturé' },
  };
}
