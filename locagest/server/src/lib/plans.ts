export type Plan = 'starter' | 'pro' | 'enterprise';

/** Limites des offres (cahier des charges §7). null = illimité. */
export const PLANS: Record<Plan, { label: string; maxProperties: number | null; maxTenants: number | null; price: string }> =
  {
    starter: { label: 'Starter', maxProperties: 3, maxTenants: 10, price: '5-10 $/mois' },
    pro: { label: 'Pro', maxProperties: 20, maxTenants: null, price: '20-30 $/mois' },
    enterprise: { label: 'Enterprise', maxProperties: null, maxTenants: null, price: 'Sur devis' },
  };
