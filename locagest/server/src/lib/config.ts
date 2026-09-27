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
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
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
