/**
 * Données de démonstration : un bailleur avec des baux couvrant les quatre
 * couleurs d'alerte, un locataire avec accès à son espace, et un administrateur.
 *   npm run seed
 * Identifiants : demo@locagest.app / demo1234 · locataire@locagest.app / demo1234
 *                admin@locagest.app / admin1234
 */
import bcrypt from 'bcryptjs';
import { pool, transaction } from './pool.js';
import { migrate } from './migrate.js';
import { addDays, addMonths, firstOfMonth, today } from '../lib/dates.js';

async function main() {
  await migrate();
  const ref = today();
  const hash = await bcrypt.hash('demo1234', 10);
  await transaction(async (c) => {
    await c.query(
      "DELETE FROM users WHERE email IN ('demo@locagest.app', 'locataire@locagest.app', 'admin@locagest.app', 'dakar@locagest.app')",
    );
    await c.query(
      `INSERT INTO users(email, password_hash, full_name, role, plan) VALUES ('admin@locagest.app', $1, 'Administrateur', 'admin', 'enterprise')`,
      [await bcrypt.hash('admin1234', 10)],
    );
    const owner = (
      await c.query(
        `INSERT INTO users(email, password_hash, full_name, phone, role, plan, country, currency, locale)
         VALUES ('demo@locagest.app', $1, 'Jean-Pierre Mbala', '+243 81 000 0000', 'bailleur', 'pro', 'CD', 'USD', 'fr') RETURNING id`,
        [hash],
      )
    ).rows[0].id;

    const props = [
      ['Maison Kintambo', 'maison', 'Kinshasa', 'Kintambo', 'Jamaïque', 'Av. Kabinda', '12', 3, 1, 1, 1, 1, 450],
      ['Appartement Gombe B3', 'appartement', 'Kinshasa', 'Gombe', 'Golf', 'Bd du 30 Juin', '45', 2, 1, 1, 0, 1, 900],
      ['Studio Limete', 'studio', 'Kinshasa', 'Limete', 'Industriel', '7e Rue', '8', 1, 0, 1, 0, 1, 250],
      ['Villa Ngaliema', 'villa', 'Kinshasa', 'Ngaliema', 'Binza Pigeon', 'Av. Nguma', '3', 4, 2, 3, 1, 1, 1500],
      ['Maison Lemba', 'maison', 'Kinshasa', 'Lemba', 'Righini', 'Av. de l’Université', '101', 2, 1, 0, 1, 1, 300],
    ];
    const propertyIds: number[] = [];
    for (const p of props) {
      const r = await c.query(
        `INSERT INTO properties(owner_id, title, type, province, commune, quartier, avenue, numero, bedrooms, living_rooms,
           toilets_internal, toilets_external, kitchens, monthly_rent, currency, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'USD','Bien de démonstration') RETURNING id`,
        [owner, ...p],
      );
      propertyIds.push(r.rows[0].id);
    }

    const tenants = [
      ['Grâce', 'Kabeya', 'locataire@locagest.app', '+243 82 111 1111', 'CD-001234', 'Congolaise', 'Infirmière', 'Hôpital du Cinquantenaire'],
      ['Patrick', 'Ilunga', null, '+243 97 222 2222', 'CD-005678', 'Congolaise', 'Enseignant', 'Collège Boboto'],
      ['Aline', 'Mukendi', null, '+243 89 333 3333', 'CD-009012', 'Congolaise', 'Comptable', 'Rawbank'],
      ['Samuel', 'Tshibanda', null, '+243 81 444 4444', 'CD-003456', 'Congolaise', 'Ingénieur', 'SNEL'],
    ];
    const tenantIds: number[] = [];
    for (const t of tenants) {
      const r = await c.query(
        `INSERT INTO tenants(owner_id, first_name, last_name, email, phone, id_number, nationality, profession, employer, rating)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,4) RETURNING id`,
        [owner, ...t],
      );
      tenantIds.push(r.rows[0].id);
    }
    await c.query(
      `INSERT INTO tenants(owner_id, first_name, last_name, phone, id_number, blacklisted, blacklist_reason, rating)
       VALUES ($1, 'Marc', 'Lukusa', '+243 99 555 5555', 'CD-007777', TRUE, '4 mois de loyers impayés en 2025', 1)`,
      [owner],
    );

    // Garanties : vert (120 j), jaune (45 j), orange (12 j), rouge (expirée depuis 5 j)
    const offsets = [120, 45, 12, -5];
    for (let i = 0; i < 4; i++) {
      const expires = addDays(ref, offsets[i]);
      const start = addMonths(expires, -12);
      const rent = props[i][12] as number;
      const lease = (
        await c.query(
          `INSERT INTO leases(owner_id, property_id, tenant_id, start_date, end_date, guarantee_expires_on, monthly_rent,
             currency, guarantee_amount, auto_renew, terms)
           VALUES ($1,$2,$3,$4,$5,$5,$6,'USD',$7,$8,'Le locataire s’engage à entretenir le bien en bon père de famille.') RETURNING id`,
          [owner, propertyIds[i], tenantIds[i], start, expires, rent, rent * 3, i % 2 === 0],
        )
      ).rows[0].id;
      await c.query("UPDATE properties SET status = 'occupee' WHERE id = $1", [propertyIds[i]]);
      // Loyers payés depuis le début du bail ; le 3e locataire n'a pas payé le mois en cours
      for (let m = 12; m >= 0; m--) {
        const period = firstOfMonth(addMonths(ref, -m));
        if (period < firstOfMonth(start) || period > firstOfMonth(expires)) continue;
        if (i === 2 && m === 0) continue;
        await c.query(
          `INSERT INTO payments(owner_id, lease_id, period, amount, paid_on, method) VALUES ($1,$2,$3,$4,$5,$6)`,
          [owner, lease, period, rent, addDays(period, 2), m % 2 ? 'mobile_money' : 'especes'],
        );
      }
    }

    const portal = (
      await c.query(
        `INSERT INTO users(email, password_hash, full_name, role, landlord_id) VALUES ('locataire@locagest.app', $1, 'Grâce Kabeya', 'locataire', $2) RETURNING id`,
        [hash, owner],
      )
    ).rows[0].id;
    await c.query('UPDATE tenants SET user_id = $1 WHERE id = $2', [portal, tenantIds[0]]);

    // Un second bailleur, au Sénégal (franc CFA, wolof), pour la répartition par pays
    const dakar = (
      await c.query(
        `INSERT INTO users(email, password_hash, full_name, phone, role, country, currency, locale)
         VALUES ('dakar@locagest.app', $1, 'Awa Diop', '+221 77 000 0000', 'bailleur', 'SN', 'XOF', 'wo') RETURNING id`,
        [hash],
      )
    ).rows[0].id;
    const villa = (
      await c.query(
        `INSERT INTO properties(owner_id, title, type, province, commune, quartier, bedrooms, living_rooms, toilets_internal,
           kitchens, monthly_rent, currency, status)
         VALUES ($1, 'Appartement Mermoz', 'appartement', 'Dakar', 'Mermoz-Sacré-Cœur', 'Mermoz', 2, 1, 1, 1, 250000, 'XOF', 'occupee')
         RETURNING id`,
        [dakar],
      )
    ).rows[0].id;
    const moussa = (
      await c.query(
        `INSERT INTO tenants(owner_id, first_name, last_name, phone, nationality, profession)
         VALUES ($1, 'Moussa', 'Ndiaye', '+221 76 111 1111', 'Sénégalaise', 'Commerçant') RETURNING id`,
        [dakar],
      )
    ).rows[0].id;
    const dakarEnd = addDays(ref, 20);
    const dakarLease = (
      await c.query(
        `INSERT INTO leases(owner_id, property_id, tenant_id, start_date, end_date, guarantee_expires_on, monthly_rent, currency, guarantee_amount)
         VALUES ($1,$2,$3,$4,$5,$5,250000,'XOF',500000) RETURNING id`,
        [dakar, villa, moussa, addMonths(dakarEnd, -12), dakarEnd],
      )
    ).rows[0].id;
    // Loyers payés par Mobile Money depuis le début du bail
    for (let m = 12; m >= 0; m--) {
      const period = firstOfMonth(addMonths(ref, -m));
      if (period < firstOfMonth(addMonths(dakarEnd, -12))) continue;
      await c.query(
        `INSERT INTO payments(owner_id, lease_id, period, amount, paid_on, method) VALUES ($1,$2,$3,250000,$4,'mobile_money')`,
        [dakar, dakarLease, period, addDays(period, 3)],
      );
    }

    // Une conversation de démonstration, avec un message non lu pour le bailleur
    await c.query(
      `INSERT INTO messages(owner_id, tenant_id, sender_role, body, read_at, created_at) VALUES
        ($1, $2, 'bailleur', 'Bonjour Madame Kabeya, le robinet de la cuisine a-t-il bien été réparé ?', now() - interval '2 days', now() - interval '2 days'),
        ($1, $2, 'locataire', 'Oui, le plombier est passé hier. Merci !', now() - interval '1 day', now() - interval '1 day'),
        ($1, $2, 'locataire', 'Je voulais aussi savoir si je peux payer le loyer d''octobre par Mobile Money.', NULL, now() - interval '3 hours')`,
      [owner, tenantIds[0]],
    );
  });
  console.log('Données de démonstration créées.');
  console.log('  Bailleur   : demo@locagest.app / demo1234');
  console.log('  Locataire  : locataire@locagest.app / demo1234');
  console.log('  Admin      : admin@locagest.app / admin1234');
  console.log('  Bailleur au Sénégal (FCFA, wolof) : dakar@locagest.app / demo1234');
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
