import { Client } from 'pg';

/**
 * Copie complète d'une base NOVA PHARMA OS vers une autre.
 *
 * Pourquoi : une base gratuite d'hébergeur expire (Render : 30 jours).
 * Avant l'échéance, on crée une nouvelle base — chez Render ou ailleurs,
 * gratuitement — et l'API y recopie tout au démarrage, depuis le réseau
 * de l'hébergeur : rien à installer chez soi.
 *
 * Garanties :
 * - la source n'est jamais modifiée : elle est lue dans une transaction
 *   annulée à la fin, y compris les réglages qu'il faut y poser pour lire ;
 * - la cible est remplie dans une seule transaction : la copie aboutit
 *   entièrement, ou la cible reste telle qu'elle était ;
 * - les deux bases doivent avoir exactement les mêmes migrations ;
 * - une cible qui contient déjà des pharmacies n'est pas écrasée, sauf
 *   demande explicite (forcer).
 *
 * Le cloisonnement des pharmacies est forcé pour le propriétaire des
 * tables : le temps de la copie, on le lève dans les deux transactions,
 * puis on le rétablit dans la cible avant de valider. Les clés étrangères
 * de la cible sont retirées pendant le remplissage puis recréées : leur
 * recréation revérifie toutes les lignes copiées.
 */

export interface ResultatCopie {
  copie: boolean;
  raison?: string;
  tables: number;
  lignes: number;
  detail: Record<string, number>;
}

interface Table {
  schema: string;
  nom: string;
  force: boolean;
}

const LOT_PARAMETRES = 30_000;
/** Toutes les valeurs voyagent en texte : aucune conversion de date ou de nombre en route. */
const TEXTE = { getTypeParser: () => (valeur: string) => valeur };

const id = (texte: string) => `"${texte.replace(/"/g, '""')}"`;
const qualifie = (t: Table) => `${id(t.schema)}.${id(t.nom)}`;

export async function copierBase(
  sourceUrl: string,
  cibleUrl: string,
  options: { forcer?: boolean; journal?: (message: string) => void } = {},
): Promise<ResultatCopie> {
  const journal = options.journal ?? ((m: string) => console.log(m));
  if (memeBase(sourceUrl, cibleUrl)) {
    throw new Error('La base source et la base cible sont la même : copie refusée.');
  }

  const source = new Client({ connectionString: sourceUrl });
  const cible = new Client({ connectionString: cibleUrl });
  await source.connect();
  await cible.connect();

  try {
    // ---- Mêmes migrations des deux côtés
    const migrations = async (c: Client) =>
      (await c.query<{ filename: string }>('SELECT filename FROM schema_migrations ORDER BY filename')).rows.map((r) => r.filename);
    const [ms, mc] = await Promise.all([migrations(source), migrations(cible)]);
    const manquantes = ms.filter((f) => !mc.includes(f));
    const enTrop = mc.filter((f) => !ms.includes(f));
    if (manquantes.length || enTrop.length) {
      throw new Error(
        'Les deux bases n’ont pas les mêmes migrations. ' +
          (manquantes.length ? `Absentes de la cible : ${manquantes.join(', ')}. ` : '') +
          (enTrop.length ? `Absentes de la source : ${enTrop.join(', ')}. ` : '') +
          'Déployez la même version de NOVA PHARMA OS sur les deux, puis recommencez.',
      );
    }

    // ---- Tables à copier (toutes, sauf le registre des migrations)
    const { rows: tables } = await cible.query<Table>(
      `SELECT n.nspname AS schema, c.relname AS nom, c.relforcerowsecurity AS force
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public', 'nova') AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition AND c.relname <> 'schema_migrations'
        ORDER BY n.nspname, c.relname`,
    );

    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await cible.query('BEGIN');
    // Lever le cloisonnement verrouille brièvement chaque table : on attend
    // au plus une minute qu'une requête en cours se termine.
    await source.query(`SET LOCAL lock_timeout = '60s'`);
    await source.query('SET LOCAL statement_timeout = 0');
    await cible.query('SET LOCAL statement_timeout = 0');
    try {
      // Lecture complète de la source : cloisonnement levé dans la
      // transaction de lecture, annulée à la fin.
      for (const t of tables) await source.query(`ALTER TABLE ${qualifie(t)} NO FORCE ROW LEVEL SECURITY`);

      // ---- Garde : ne pas écraser une base déjà en service
      await cible.query(`ALTER TABLE public.organizations NO FORCE ROW LEVEL SECURITY`);
      const { rows: [{ n }] } = await cible.query<{ n: string }>('SELECT count(*) AS n FROM public.organizations');
      if (Number(n) > 0 && !options.forcer) {
        await cible.query('ROLLBACK');
        await source.query('ROLLBACK');
        return {
          copie: false,
          raison: `La base cible contient déjà ${n} pharmacie(s) : copie ignorée pour ne rien écraser.`,
          tables: 0, lignes: 0, detail: {},
        };
      }

      // ---- Préparation de la cible
      const { rows: clesEtrangeres } = await cible.query<{ table_sql: string; nom: string; definition: string }>(
        `SELECT format('%I.%I', n.nspname, c.relname) AS table_sql, k.conname AS nom,
                pg_get_constraintdef(k.oid) AS definition
           FROM pg_constraint k
           JOIN pg_class c ON c.oid = k.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE k.contype = 'f' AND n.nspname IN ('public', 'nova')`,
      );
      for (const k of clesEtrangeres) await cible.query(`ALTER TABLE ${k.table_sql} DROP CONSTRAINT ${id(k.nom)}`);
      for (const t of tables) {
        await cible.query(`ALTER TABLE ${qualifie(t)} NO FORCE ROW LEVEL SECURITY`);
        await cible.query(`ALTER TABLE ${qualifie(t)} DISABLE TRIGGER USER`);
      }
      if (tables.length) await cible.query(`TRUNCATE ${tables.map(qualifie).join(', ')}`);

      // ---- Copie, table par table, par lots
      const detail: Record<string, number> = {};
      let total = 0;
      for (const t of tables) {
        const { rows: colonnes } = await cible.query<{ nom: string }>(
          `SELECT a.attname AS nom FROM pg_attribute a
            WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
            ORDER BY a.attnum`,
          [qualifie(t)],
        );
        if (colonnes.length === 0) continue;
        const liste = colonnes.map((c) => id(c.nom)).join(', ');
        const curseur = `copie_${t.nom}`.slice(0, 60);
        await source.query(`DECLARE ${id(curseur)} NO SCROLL CURSOR FOR SELECT ${liste} FROM ${qualifie(t)}`);
        const parLot = Math.max(1, Math.floor(LOT_PARAMETRES / colonnes.length));
        let copiees = 0;
        for (;;) {
          const lot = await source.query({ text: `FETCH ${parLot} FROM ${id(curseur)}`, rowMode: 'array', types: TEXTE });
          if (lot.rows.length === 0) break;
          const valeurs: unknown[] = [];
          const lignes = (lot.rows as unknown[][]).map((ligne) => {
            const marques = ligne.map((v) => {
              valeurs.push(v);
              return `$${valeurs.length}`;
            });
            return `(${marques.join(', ')})`;
          });
          await cible.query(
            `INSERT INTO ${qualifie(t)} (${liste}) OVERRIDING SYSTEM VALUE VALUES ${lignes.join(', ')}`,
            valeurs,
          );
          copiees += lot.rows.length;
        }
        await source.query(`CLOSE ${id(curseur)}`);
        detail[`${t.schema}.${t.nom}`] = copiees;
        total += copiees;
      }

      // ---- Séquences
      const { rows: sequences } = await source.query<{ seq: string; valeur: string | null; appelee: boolean }>(
        `SELECT format('%I.%I', schemaname, sequencename) AS seq, last_value AS valeur, last_value IS NOT NULL AS appelee
           FROM pg_sequences WHERE schemaname IN ('public', 'nova')`,
      );
      for (const s of sequences) {
        if (s.valeur !== null) await cible.query('SELECT setval($1::regclass, $2::bigint, true)', [s.seq, s.valeur]);
      }

      // ---- Rétablissement : clés étrangères (revérifiées), déclencheurs, cloisonnement
      for (const k of clesEtrangeres) {
        await cible.query(`ALTER TABLE ${k.table_sql} ADD CONSTRAINT ${id(k.nom)} ${k.definition}`);
      }
      for (const t of tables) {
        await cible.query(`ALTER TABLE ${qualifie(t)} ENABLE TRIGGER USER`);
        if (t.force) await cible.query(`ALTER TABLE ${qualifie(t)} FORCE ROW LEVEL SECURITY`);
      }
      await cible.query(`ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY`);

      // ---- Contrôle : même nombre de lignes de part et d'autre
      for (const t of tables) {
        const attendu = detail[`${t.schema}.${t.nom}`] ?? 0;
        const { rows: [{ n: avant }] } = await source.query<{ n: string }>(`SELECT count(*) AS n FROM ${qualifie(t)}`);
        if (Number(avant) !== attendu) {
          throw new Error(`Écart sur ${t.schema}.${t.nom} : ${avant} ligne(s) dans la source, ${attendu} copiée(s).`);
        }
      }

      await cible.query('COMMIT');
      await source.query('ROLLBACK');
      journal(`Copie terminée : ${tables.length} tables, ${total} lignes.`);
      return { copie: true, tables: tables.length, lignes: total, detail };
    } catch (erreur) {
      await cible.query('ROLLBACK').catch(() => undefined);
      await source.query('ROLLBACK').catch(() => undefined);
      throw erreur;
    }
  } finally {
    await source.end().catch(() => undefined);
    await cible.end().catch(() => undefined);
  }
}

/** Même serveur et même base : on ne copie pas une base sur elle-même. */
function memeBase(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname === y.hostname && (x.port || '5432') === (y.port || '5432') && x.pathname === y.pathname;
  } catch {
    return a === b;
  }
}
