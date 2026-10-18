/**
 * Contexte d'exécution d'une requête.
 *
 * Il détermine ce que la base de données laisse voir et écrire : chaque
 * transaction positionne ces valeurs via SET LOCAL, et les politiques
 * Row-Level Security s'y réfèrent. Une requête sans contexte ne voit
 * aucune donnée métier.
 */
export type ActorKind = 'user' | 'platform_user' | 'api_key' | 'system';

export interface RequestContext {
  /** Organisation (pharmacie cliente) ciblée. Absente en contexte plateforme pur. */
  organizationId?: string | null;
  /** Branche courante, pour les opérations rattachées à un point de vente. */
  branchId?: string | null;
  /** Identifiant de l'acteur : utilisateur pharmacie ou utilisateur interne. */
  actorId?: string | null;
  actorKind: ActorKind;
  actorLabel?: string | null;
  /** Contexte back-office SaaS NOVA PHARMA OS. */
  platform: boolean;
  /**
   * Lecture seule. Positionné pour :
   *  - un accès support temporaire en mode read_only ;
   *  - une organisation suspendue (consultation des données critiques) ;
   *  - la consultation d'archives.
   */
  readonly: boolean;
  /** Rôle plateforme : super_admin | support_admin | commercial. */
  platformRole?: string | null;
  /** Permissions effectives de l'utilisateur pharmacie. */
  permissions?: string[];
  /** Modules activés par le forfait souscrit. */
  modules?: string[];
  /** Accès support en cours, tracé dans support_access_events. */
  supportGrantId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const SYSTEM_CONTEXT: RequestContext = {
  actorKind: 'system',
  actorLabel: 'system',
  platform: true,
  readonly: false,
  platformRole: 'super_admin',
};

/** Contexte système restreint à une organisation (tâches planifiées). */
export function systemTenantContext(organizationId: string): RequestContext {
  return {
    organizationId,
    actorKind: 'system',
    actorLabel: 'system',
    platform: false,
    readonly: false,
  };
}
