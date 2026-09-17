#!/usr/bin/env node
/* =====================================================================
 * NOVA PHARMA OS — lanceur unique
 *
 * Démarre toute l'application sur un ordinateur ordinaire, sans rien
 * installer d'autre que Node.js et sans dépenser un centime :
 *
 *   1. installe les dépendances au premier lancement ;
 *   2. démarre une base PostgreSQL embarquée (aucune installation
 *      système : les fichiers vivent dans le dossier du projet) ;
 *   3. applique les migrations et crée les comptes ;
 *   4. démarre l'API et l'interface ;
 *   5. affiche l'adresse à saisir sur les téléphones du même Wi-Fi.
 *
 * Usage :  node demarrer.mjs
 * ===================================================================== */

import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(fileURLToPath(import.meta.url));
const DOSSIER_API = join(RACINE, 'api');
const DOSSIER_WEB = join(RACINE, 'web');
const DOSSIER_DONNEES = join(RACINE, 'donnees');
const DOSSIER_BASE = join(DOSSIER_DONNEES, 'base');

const PORT_BASE = Number(process.env.NOVA_PORT_BASE ?? 5433);
const PORT_API = Number(process.env.NOVA_PORT_API ?? 3001);
const PORT_WEB = Number(process.env.NOVA_PORT_WEB ?? 3000);
const MOT_DE_PASSE_BASE = 'nova_local';

/**
 * Mot de passe du rôle applicatif.
 *
 * L'application ne se connecte jamais avec l'administrateur de la base.
 * C'est une règle de sûreté, pas une précaution de style : un
 * superutilisateur PostgreSQL ignore les politiques de cloisonnement, et
 * chaque pharmacie verrait alors les données des autres — sans message
 * d'erreur, sans rien d'anormal à l'écran.
 *
 * La base n'écoute que sur cette machine ; ce mot de passe ne protège
 * donc rien d'exposé au réseau.
 */
const MOT_DE_PASSE_APPLICATIF = 'nova_app_local';
const ROLE_APPLICATIF = 'nova_app';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processusEnfants = [];
let postgres = null;
let urlBaseChoisie = null;
let arretEnCours = false;

// ---------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------
const COULEURS = process.stdout.isTTY && process.platform !== 'win32';
const vert = (t) => (COULEURS ? `\x1b[32m${t}\x1b[0m` : t);
const gras = (t) => (COULEURS ? `\x1b[1m${t}\x1b[0m` : t);
const gris = (t) => (COULEURS ? `\x1b[90m${t}\x1b[0m` : t);
const rouge = (t) => (COULEURS ? `\x1b[31m${t}\x1b[0m` : t);

let numeroEtape = 0;
function etape(titre) {
  numeroEtape += 1;
  console.log(`\n${gras(`[${numeroEtape}/6]`)} ${titre}`);
}
function info(texte) {
  console.log(`      ${gris(texte)}`);
}
function succes(texte) {
  console.log(`      ${vert('✓')} ${texte}`);
}
function echec(texte) {
  console.log(`      ${rouge('✗')} ${texte}`);
}

// ---------------------------------------------------------------------
// Vérifications préalables
// ---------------------------------------------------------------------
function verifierNode() {
  const majeure = Number(process.versions.node.split('.')[0]);
  if (majeure < 20) {
    console.error(
      rouge(`\nVotre version de Node.js (${process.versions.node}) est trop ancienne.`),
    );
    console.error("Installez Node.js 20 ou plus récent depuis https://nodejs.org");
    process.exit(1);
  }
}

function executer(commande, arguments_, dossier, options = {}) {
  const resultat = spawnSync(commande, arguments_, {
    cwd: dossier,
    stdio: options.silencieux ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...options.env },
  });
  if (resultat.status !== 0 && !options.tolerant) {
    if (options.silencieux) {
      console.error(String(resultat.stderr ?? resultat.stdout ?? ''));
    }
    throw new Error(`Échec : ${commande} ${arguments_.join(' ')}`);
  }
  return resultat;
}

// ---------------------------------------------------------------------
// 1. Dépendances
// ---------------------------------------------------------------------
function installerDependances() {
  etape('Vérification des dépendances');

  for (const [nom, dossier] of [
    ['API', DOSSIER_API],
    ['interface', DOSSIER_WEB],
  ]) {
    if (existsSync(join(dossier, 'node_modules'))) {
      succes(`Dépendances de l'${nom} déjà présentes.`);
      continue;
    }
    info(`Installation des dépendances de l'${nom}… (quelques minutes la première fois)`);
    executer(NPM, ['install', '--no-audit', '--no-fund'], dossier);
    succes(`Dépendances de l'${nom} installées.`);
  }

  // Le module de base embarquée vit à la racine du projet.
  if (!existsSync(join(RACINE, 'node_modules', 'embedded-postgres'))) {
    info('Installation de la base de données embarquée…');
    executer(NPM, ['install', '--no-audit', '--no-fund'], RACINE);
    succes('Base de données embarquée installée.');
  } else {
    succes('Base de données embarquée déjà présente.');
  }
}

/**
 * Sous macOS et Linux, npm ne rétablit pas toujours le droit d'exécution
 * sur les binaires extraits d'une archive. Sans cela, le démarrage de la
 * base échoue avec un message peu parlant (EACCES).
 */
function reparerDroitsBinaires() {
  if (process.platform === 'win32') return;
  const racineBinaires = join(RACINE, 'node_modules', '@embedded-postgres');
  if (!existsSync(racineBinaires)) return;

  for (const paquet of readdirSync(racineBinaires)) {
    const dossierBin = join(racineBinaires, paquet, 'native', 'bin');
    if (!existsSync(dossierBin)) continue;
    for (const fichier of readdirSync(dossierBin)) {
      try {
        chmodSync(join(dossierBin, fichier), 0o755);
      } catch {
        // Sans droits suffisants, on laisse le démarrage signaler l'erreur.
      }
    }
  }
}

// ---------------------------------------------------------------------
// 2. Base de données
// ---------------------------------------------------------------------
/**
 * Base de données.
 *
 * Par défaut, une base PostgreSQL est embarquée dans le dossier du
 * projet : rien à installer. Si vous disposez déjà d'un PostgreSQL,
 * indiquez-le et le lanceur s'en servira :
 *
 *   NOVA_DATABASE_URL=postgresql://user:motdepasse@localhost:5432/nova
 */
async function demarrerBase() {
  etape('Démarrage de la base de données');

  if (process.env.NOVA_DATABASE_URL) {
    urlBaseChoisie = process.env.NOVA_DATABASE_URL;
    succes('Utilisation de la base PostgreSQL que vous avez indiquée.');
    info(urlBaseChoisie.replace(/:[^:@/]+@/, ':•••@'));
    return;
  }

  reparerDroitsBinaires();

  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  } catch (erreur) {
    throw new Error(
      "La base de données embarquée n'a pas pu être chargée.\n" +
        `      Détail : ${erreur.message}\n` +
        '      Solution de repli : installez PostgreSQL, puis relancez avec\n' +
        '        NOVA_DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/nova',
    );
  }
  const premiereFois = !existsSync(DOSSIER_BASE);

  mkdirSync(DOSSIER_DONNEES, { recursive: true });
  postgres = new EmbeddedPostgres({
    databaseDir: DOSSIER_BASE,
    user: 'postgres',
    password: MOT_DE_PASSE_BASE,
    port: PORT_BASE,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });

  try {
    if (premiereFois) {
      info('Première initialisation de la base… (une seule fois)');
      await postgres.initialise();
    }
    await postgres.start();
    if (premiereFois) await postgres.createDatabase('nova');
  } catch (erreur) {
    postgres = null;
    throw new Error(
      "La base de données embarquée n'a pas démarré.\n" +
        `      Détail : ${erreur.message}\n` +
        '      Solution de repli : installez PostgreSQL, puis relancez avec\n' +
        '        NOVA_DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/nova',
    );
  }

  urlBaseChoisie =
    `postgresql://postgres:${MOT_DE_PASSE_BASE}@127.0.0.1:${PORT_BASE}/nova`;
  succes(premiereFois ? 'Base de données créée.' : 'Base de données démarrée.');
  info(`Vos données sont stockées dans : ${DOSSIER_DONNEES}`);
}

// ---------------------------------------------------------------------
// 3. Configuration
// ---------------------------------------------------------------------
/**
 * Dérive l'adresse de connexion de l'application à partir de celle de
 * l'administrateur, en n'en changeant que l'identité.
 *
 * Les deux visent la même base : seule la façon de s'y connecter change.
 * L'administrateur sert aux migrations, qui créent les tables ; le rôle
 * applicatif sert à tout le reste, et lui reste soumis au cloisonnement.
 */
function urlRoleApplicatif(urlAdministrateur) {
  const url = new URL(urlAdministrateur);
  url.username = ROLE_APPLICATIF;
  url.password = MOT_DE_PASSE_APPLICATIF;
  return url.toString();
}

function ecrireConfiguration() {
  etape('Configuration');

  const urlBase = urlBaseChoisie;
  const urlApplicative = urlRoleApplicatif(urlBase);
  const secret = `local-${Buffer.from(RACINE).toString('base64url').slice(0, 32)}`;

  writeFileSync(
    join(DOSSIER_API, '.env'),
    [
      '# Fichier produit automatiquement par demarrer.mjs — ne pas modifier à la main.',
      'NODE_ENV=production',
      `PORT=${PORT_API}`,
      'API_PREFIX=api',
      `DATABASE_URL=${urlApplicative}`,
      `DATABASE_ADMIN_URL=${urlBase}`,
      `NOVA_APP_PASSWORD=${MOT_DE_PASSE_APPLICATIF}`,
      `JWT_SECRET=${secret}`,
      'SCHEDULER_ENABLED=true',
      'BACKUP_DIR=../donnees/sauvegardes',
      `CORS_ORIGINS=http://localhost:${PORT_WEB}`,
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(DOSSIER_WEB, '.env.local'),
    [
      '# Fichier produit automatiquement par demarrer.mjs — ne pas modifier à la main.',
      `NOVA_API_URL=http://127.0.0.1:${PORT_API}/api`,
      '',
    ].join('\n'),
    'utf8',
  );

  succes('Configuration écrite.');
}

// ---------------------------------------------------------------------
// 4. Migrations et données de départ
// ---------------------------------------------------------------------
function preparerDonnees() {
  etape('Préparation des données');

  info('Application des migrations…');
  executer(NPM, ['run', 'migrate'], DOSSIER_API, { silencieux: true });
  succes('Structure de la base à jour.');

  info('Vérification du compte de connexion de l\'application…');
  executer(NPM, ['run', 'role:app'], DOSSIER_API, { silencieux: true });
  succes('Compte applicatif en place, sans droit de contourner le cloisonnement.');

  info('Vérification des comptes…');
  executer(NPM, ['run', 'seed'], DOSSIER_API, { silencieux: true });
  succes('Comptes en place. Les mots de passe existants ne sont pas modifiés.');

  // Deux pharmacies distinctes, et c'est voulu : NOVA SANTÉ PHARMA
  // reçoit les vraies données de l'officine, la démonstration sert à
  // s'exercer sans risque. Les mélanger dans une seule ferait perdre
  // l'un ou l'autre — un stock d'exercice fausserait les comptes, et un
  // essai raté abîmerait les vraies écritures.
  for (const [libelle, script] of [
    ['NOVA SANTÉ PHARMA', 'seed:nova-sante'],
    ['pharmacie de démonstration', 'seed:demo'],
  ]) {
    info(`Préparation de la ${libelle}…`);
    const resultat = executer(NPM, ['run', script], DOSSIER_API, {
      silencieux: true,
      tolerant: true,
    });
    if (resultat.status === 0) {
      succes(`${libelle} en place.`);
    } else {
      info(`La ${libelle} n'a pas pu être préparée ; ` +
           "l'application démarre quand même.");
    }
  }
}

// ---------------------------------------------------------------------
// 5. Construction de l'interface
// ---------------------------------------------------------------------
function construireApplication() {
  etape("Construction de l'application");

  if (existsSync(join(DOSSIER_API, 'dist', 'main.js'))) {
    succes('API déjà construite.');
  } else {
    info("Construction de l'API…");
    executer(NPM, ['run', 'build'], DOSSIER_API, { silencieux: true });
    succes('API construite.');
  }

  if (existsSync(join(DOSSIER_WEB, '.next', 'BUILD_ID'))) {
    succes('Interface déjà construite.');
  } else {
    info('Construction de l\'interface… (quelques minutes la première fois)');
    executer(NPM, ['run', 'build'], DOSSIER_WEB, { silencieux: true });
    succes('Interface construite.');
  }
}

// ---------------------------------------------------------------------
// 6. Démarrage des serveurs
// ---------------------------------------------------------------------
/**
 * Démarre un serveur en conservant ses dernières lignes de sortie.
 *
 * Un démarrage qui échoue sans montrer pourquoi est inexploitable pour
 * qui n'est pas développeur : on garde donc les derniers messages sous
 * la main, pour les afficher si le serveur ne répond pas.
 */
function lancer(nom, commande, arguments_, dossier, env) {
  const enfant = spawn(commande, arguments_, {
    cwd: dossier,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });

  const dernieresLignes = [];
  const retenir = (donnees) => {
    for (const ligne of String(donnees).split('\n')) {
      if (ligne.trim()) dernieresLignes.push(ligne.trimEnd());
    }
    while (dernieresLignes.length > 15) dernieresLignes.shift();
  };
  enfant.stdout?.on('data', retenir);
  enfant.stderr?.on('data', retenir);

  const suivi = { nom, enfant, dernieresLignes };
  enfant.on('error', (erreur) => {
    retenir(erreur.message);
    echec(`${nom} : ${erreur.message}`);
  });
  enfant.on('exit', (code) => {
    if (code !== 0 && code !== null && !arretEnCours) {
      echec(`${nom} s'est arrêté (code ${code}).`);
    }
  });

  processusEnfants.push(suivi);
  return suivi;
}

/** Rapporte l'échec d'un serveur avec les messages qu'il a produits. */
function echecServeur(suivi, message) {
  const journal = suivi.dernieresLignes.length
    ? `\n\n      Derniers messages de ${suivi.nom} :\n` +
      suivi.dernieresLignes.map((l) => `        ${l}`).join('\n')
    : '';
  return new Error(message + journal);
}

async function attendre(url, secondes) {
  const echeance = Date.now() + secondes * 1000;
  while (Date.now() < echeance) {
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (reponse.ok || reponse.status < 500) return true;
    } catch {
      // Le serveur n'est pas encore prêt.
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function adressesLocales() {
  const adresses = [];
  for (const cartes of Object.values(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family === 'IPv4' && !carte.internal) adresses.push(carte.address);
    }
  }
  return adresses;
}

async function demarrerServeurs() {
  etape('Démarrage des serveurs');

  const api = lancer('API', NPM, ['run', 'start:prod'], DOSSIER_API, {});
  if (!(await attendre(`http://127.0.0.1:${PORT_API}/api/health`, 90))) {
    throw echecServeur(api, "L'API n'a pas démarré.");
  }
  succes('API démarrée.');

  // L'interface écoute sur toutes les cartes réseau pour que les
  // téléphones du même Wi-Fi puissent l'atteindre. L'API, elle, reste
  // sur la machine : le navigateur ne lui parle jamais directement.
  const interface_ = lancer(
    'Interface',
    NPM,
    ['run', 'start', '--', '-H', '0.0.0.0', '-p', String(PORT_WEB)],
    DOSSIER_WEB,
    {},
  );
  if (!(await attendre(`http://127.0.0.1:${PORT_WEB}/connexion`, 90))) {
    throw echecServeur(interface_, "L'interface n'a pas démarré.");
  }
  succes('Interface démarrée.');
}

// ---------------------------------------------------------------------
// Arrêt propre
// ---------------------------------------------------------------------
async function arreter(code = 0) {
  if (arretEnCours) return;
  arretEnCours = true;

  console.log(`\n${gras('Arrêt en cours…')}`);
  for (const { enfant } of processusEnfants) {
    try {
      enfant.kill('SIGTERM');
    } catch {
      // Le processus s'est peut-être déjà arrêté.
    }
  }
  await new Promise((r) => setTimeout(r, 1200));

  if (postgres) {
    try {
      await postgres.stop();
      console.log(`${vert('✓')} Base de données arrêtée proprement. Vos données sont conservées.`);
    } catch {
      console.log('La base de données s\'est arrêtée.');
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => void arreter(0));
process.on('SIGTERM', () => void arreter(0));

// ---------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------
async function principal() {
  console.log(gras('\n╔════════════════════════════════════════════════════╗'));
  console.log(gras('║              N O V A   P H A R M A   O S           ║'));
  console.log(gras('║   Gestion de pharmacie — démarrage sur cet ordinateur ║'));
  console.log(gras('╚════════════════════════════════════════════════════╝'));

  verifierNode();
  installerDependances();
  await demarrerBase();
  ecrireConfiguration();
  preparerDonnees();
  construireApplication();
  await demarrerServeurs();

  const adresses = adressesLocales();
  console.log(`\n${gras('═'.repeat(56))}`);
  console.log(gras("  L'APPLICATION EST PRÊTE"));
  console.log(gras('═'.repeat(56)));

  console.log(`\n  ${gras('Sur cet ordinateur :')}`);
  console.log(`    ${vert(`http://localhost:${PORT_WEB}`)}`);

  if (adresses.length > 0) {
    console.log(`\n  ${gras('Sur les téléphones du même Wi-Fi :')}`);
    for (const adresse of adresses) {
      console.log(`    ${vert(`http://${adresse}:${PORT_WEB}`)}`);
    }
    console.log(gris('    (le téléphone doit être sur le même réseau Wi-Fi que cet ordinateur)'));
  } else {
    console.log(`\n  ${gris('Aucun réseau détecté : accès depuis cet ordinateur uniquement.')}`);
  }

  console.log(`\n  ${gras('NOVA SANTÉ PHARMA — votre officine :')}`);
  console.log('    Gérant         gerant@nova-sante-pharma.cd   /  NovaSante2026!');
  console.log('    Vendeur        vendeur@nova-sante-pharma.cd  /  Vendeur2026!');
  console.log('    Livreur        livreur@nova-sante-pharma.cd  /  Livreur2026!');
  console.log(gris('    Stock à zéro : il se remplit à votre première réception.'));

  console.log(`\n  ${gras('Pour s\'exercer sans risque :')}`);
  console.log('    Démonstration  gerant@pharmacie-demo.cd      /  Pharmacie2026!');
  console.log('    Back-office    admin@novapharmaos.com        /  NovaPharma2026!');

  console.log(`\n  ${gris('Changez ces mots de passe avant de saisir de vraies données.')}`);

  console.log(`\n  ${gris('Pour arrêter : appuyez sur Ctrl + C dans cette fenêtre.')}`);
  console.log(`${gras('═'.repeat(56))}\n`);

  // Maintient le processus en vie jusqu'à l'interruption.
  await new Promise(() => {});
}

principal().catch(async (erreur) => {
  console.error(`\n${rouge('Le démarrage a échoué.')}`);
  console.error(`${erreur.message}\n`);
  console.error("Consultez GUIDE_DEMARRAGE.md, section « Si quelque chose ne marche pas ».");
  await arreter(1);
});
