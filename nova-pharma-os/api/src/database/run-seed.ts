import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { loadEnv } from './load-env';

/**
 * Amorce les comptes internes NOVA PHARMA OS.
 *
 * Idempotent : relancer ce script ne duplique rien et ne réinitialise
 * aucun mot de passe existant.
 */
const PLATFORM_USERS = [
  {
    email: 'admin@novapharmaos.com',
    fullName: 'Super administrateur',
    role: 'super_admin',
    envVar: 'SEED_SUPER_ADMIN_PASSWORD',
  },
  {
    email: 'support@novapharmaos.com',
    fullName: 'Administrateur support',
    role: 'support_admin',
    envVar: 'SEED_SUPPORT_PASSWORD',
  },
  {
    email: 'commercial@novapharmaos.com',
    fullName: 'Gestionnaire commercial',
    role: 'commercial',
    envVar: 'SEED_COMMERCIAL_PASSWORD',
  },
];

async function main(): Promise<void> {
  loadEnv();
  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_ADMIN_URL ou DATABASE_URL est requis.');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const created: string[] = [];
    const kept: string[] = [];

    for (const user of PLATFORM_USERS) {
      const password = process.env[user.envVar] ?? 'NovaPharma2026!';
      const { rows } = await client.query(
        `INSERT INTO platform_users (email, full_name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING email`,
        [user.email, user.fullName, bcrypt.hashSync(password, 10), user.role],
      );
      if (rows.length > 0) created.push(`${user.email} (${user.role})`);
      else kept.push(user.email);
    }

    console.log(
      created.length > 0
        ? `Comptes internes créés :\n${created.map((u) => `  • ${u}`).join('\n')}`
        : 'Aucun compte interne à créer.',
    );
    if (kept.length > 0) {
      console.log(`Déjà présents : ${kept.join(', ')}`);
    }
    if (!process.env.SEED_SUPER_ADMIN_PASSWORD && created.length > 0) {
      console.log(
        '\nMot de passe par défaut : NovaPharma2026!\n' +
          'Changez-le à la première connexion, ou définissez SEED_SUPER_ADMIN_PASSWORD.',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
