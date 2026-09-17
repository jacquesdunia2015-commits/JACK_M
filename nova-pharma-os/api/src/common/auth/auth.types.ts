/** Charge utile des jetons d'accès. */
export interface AccessTokenPayload {
  sub: string;
  kind: 'user' | 'platform_user';
  /** Organisation pour un utilisateur pharmacie. */
  org?: string;
  /** Branche par défaut. */
  branch?: string;
  /** Rôle plateforme pour un utilisateur interne. */
  role?: string;
  /** Accès support temporaire actif (utilisateur interne uniquement). */
  grant?: string;
  email: string;
  name: string;
}

export interface AuthenticatedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
