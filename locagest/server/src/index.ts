import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createApp } from './app.js';
import { config } from './lib/config.js';
import { migrate } from './db/migrate.js';
import { one, query } from './db/pool.js';
import { startAlertScheduler } from './lib/notifier.js';

async function ensureAdmin() {
  const { email, password } = config.admin;
  if (!email || !password) return;
  const exists = await one('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists) return;
  await query(`INSERT INTO users(email, password_hash, full_name, role, plan) VALUES ($1,$2,'Administrateur','admin','enterprise')`, [
    email.toLowerCase(),
    await bcrypt.hash(password, 10),
  ]);
  console.log(`Compte administrateur créé : ${email}`);
}

async function main() {
  await migrate();
  await ensureAdmin();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const app = createApp({ webDist: path.resolve(here, '../../web/dist') });
  app.listen(config.port, () => console.log(`LocaGest API sur http://localhost:${config.port}`));
  startAlertScheduler();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
