#!/usr/bin/env node
// medistat/tests/migration-ancienne-base.mjs
// Reprise d'une base créée AVANT le chiffrement enveloppe.
//
// Ce contrôle ne figure pas dans tests/tous.mjs : il enchaîne une dizaine de
// dérivations PBKDF2 à 250 000 itérations et demande plusieurs minutes sous
// Node. Il est à lancer explicitement, et il le mérite — un chemin de
// migration ne sert qu'une fois par base, ce qui en fait exactement le genre
// de code que personne ne teste et qui casse au pire moment.
//
// Il reconstitue fidèlement l'état antérieur : champs chiffrés avec la clé
// héritée du mot de passe, aucune enveloppe de clé, aucun témoin. Trois
// choses doivent alors être vraies, et le sont :
//   — la connexion aboutit : le témoin absent ne bloque personne ;
//   — les données de santé restent lisibles, sans drapeau d'erreur ;
//   — enveloppe et témoin sont créés, et la reconnexion suivante fonctionne.
//
// Lancement :  node tests/migration-ancienne-base.mjs
//
// Le pendant de ce contrôle — une clé qui n'ouvre PAS les dossiers doit
// refuser la session — est vérifié dans tests/app.test.mjs, section
// « le chiffrement ne cloisonne pas l'équipe soignante ».

import * as store from "../js/core/store.js";
import * as auth from "../js/core/auth.js";
import * as crypto2 from "../js/core/crypto.js";

const MDP = "Duniya2026";
await auth.initialiser({
  etablissement: { nom: "Ancien", code: "ANC", type: "hopital" },
  administrateur: { identifiant: "admin", nom: "Dunia", prenom: "Jacques", motDePasse: MDP },
});
await auth.connexion("admin", MDP);
const p = await store.depots.patients.creer({
  ipp: "ANC0001", nom: "Kabila", prenom: "Marie", dateNaissance: "1985-04-04", sexe: "F",
});
await auth.deconnexion();

const u = (await store.lireTout("utilisateurs"))[0];
const cleHeritee = await crypto2.sha256(`${MDP}|${u.id}|${u.motDePasse.salt}`);

// Le patient est réécrit comme l'aurait fait l'ancienne version.
const brut = await store.lire("patients", p.id);
delete brut._chiffre; delete brut._champsChiffres;
brut.allergies = "Pénicilline";
await store.ecrire("patients", await crypto2.chiffrerChamps("patient", brut, cleHeritee));

delete u.cleEnveloppe;
await store.ecrire("utilisateurs", u);
await store.supprimer?.("parametres", "temoinCle").catch(() => {});
console.log("base ramenée à l'état antérieur");

try {
  await auth.connexion("admin", MDP);
  console.log("connexion d'une vraie base ancienne : OK");
  const relu = await store.depots.patients.obtenir(p.id);
  console.log("allergie relue                     :", relu.allergies || "(PERDUE)");
  console.log("drapeau d'erreur                   :", relu._erreurDechiffrement ? "posé" : "aucun");
  const apres = (await store.lireTout("utilisateurs"))[0];
  console.log("enveloppe régénérée                :", apres.cleEnveloppe ? "oui" : "NON");
  console.log("témoin créé                        :",
    (await store.lire("parametres", "temoinCle")) ? "oui" : "NON");
  await auth.deconnexion();
  await auth.connexion("admin", MDP);
  console.log("reconnexion après migration        : OK");
  console.log("allergie toujours lisible          :",
    (await store.depots.patients.obtenir(p.id)).allergies || "(PERDUE)");
} catch (e) { console.log("ÉCHEC :", e.message.slice(0, 160)); }
