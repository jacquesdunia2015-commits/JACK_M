-- =====================================================================
-- NOVA PHARMA OS — 025 : double authentification (codes à usage unique)
--
-- Un mot de passe deviné ou volé ne suffit plus : la personne qui active
-- la double authentification saisit, après son mot de passe, le code à
-- 6 chiffres de son application (Google Authenticator, 2FAS…). Pas de SMS,
-- donc aucun frais.
--
--   totp_pending_secret : secret proposé, en attente du premier code juste ;
--   totp_secret         : secret actif (double authentification activée) ;
--   totp_last_step      : dernier pas de 30 s accepté — un code ne sert qu'une fois ;
--   totp_recovery_codes : empreintes SHA-256 des codes de secours restants.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN totp_secret         text,
  ADD COLUMN totp_pending_secret text,
  ADD COLUMN totp_enabled_at     timestamptz,
  ADD COLUMN totp_last_step      bigint,
  ADD COLUMN totp_recovery_codes text[] NOT NULL DEFAULT '{}';

ALTER TABLE platform_users
  ADD COLUMN totp_secret         text,
  ADD COLUMN totp_pending_secret text,
  ADD COLUMN totp_enabled_at     timestamptz,
  ADD COLUMN totp_last_step      bigint,
  ADD COLUMN totp_recovery_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN failed_login_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until        timestamptz;
