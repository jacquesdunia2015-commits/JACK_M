import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const config = {
  isTest,
  databaseUrl: required(
    'DATABASE_URL',
    isTest ? 'postgres://locagest:locagest@localhost:5432/locagest_test' : undefined,
  ),
  jwtSecret: required('JWT_SECRET', isTest ? 'secret-de-test' : undefined),
  port: Number(process.env.PORT ?? 4000),
  timezone: process.env.APP_TIMEZONE ?? 'Africa/Kinshasa',
  // Adresse publique (liens des emails). Render la fournit dans RENDER_EXTERNAL_URL.
  appUrl: process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173',
  // Derrière un proxy (Render, Nginx…), l'adresse IP du visiteur est dans X-Forwarded-For :
  // indispensable pour limiter les tentatives de connexion par visiteur et non globalement.
  trustProxy: Boolean(process.env.TRUST_PROXY ?? process.env.RENDER),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'LocaGest <no-reply@locagest.app>',
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  },
};
