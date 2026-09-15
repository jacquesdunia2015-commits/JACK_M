// Contrôle de la période d'accès libre (js/license.js), sans navigateur.
//
// Il vérifie surtout le piège qui a motivé ce test : le compteur d'essai ne
// doit PAS tourner pendant la période gratuite. S'il tournait, les 5 jours
// d'essai de chaque utilisateur seraient consommés par la promotion, et tout
// le monde se retrouverait bloqué le même jour — à l'heure précise où la
// vente commence. Le pire moment possible.
//
// On simule localStorage et le DOM, puis on fige l'horloge pour parcourir
// les trois moments : pendant la période, après, et pour un client payant.
//
// Lancement :  node tools/verifier_acces_libre.mjs


const boutique = new Map();
globalThis.localStorage = {
  getItem: k => (boutique.has(k) ? boutique.get(k) : null),
  setItem: (k, v) => boutique.set(k, String(v)),
  removeItem: k => boutique.delete(k),
};
// `crypto` est déjà exposé par Node en lecture seule : inutile de le remplacer.
globalThis.document = { documentElement: { lang: "fr" } };

const lic = await import(new URL("../js/license.js", import.meta.url).href);

const ok = [], ko = [];
const dire = (n, c, d = "") => { (c ? ok : ko).push(n);
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}${d ? " — " + d : ""}`); };

const FIN = lic.ACCES_LIBRE_JUSQU_AU;
const jour = iso => new Date(iso + "T12:00:00").getTime();
const vraiNow = Date.now;
const figer = ms => { Date.now = () => ms; };
const rendre = () => { Date.now = vraiNow; };

console.log(`\nPériode d'accès libre déclarée : jusqu'au ${FIN}\n`);

// 1 — Pendant la période
figer(jour("2026-09-20"));
boutique.clear();
let st = await lic.licenseStatus();
dire("pendant la période : accès libre", st.state === "libre", st.state);
dire("le nombre de jours restants est cohérent", st.daysLeft > 50 && st.daysLeft < 62, st.daysLeft + " j");

// 2 — Le compteur d'essai ne doit PAS avoir démarré
const enregistre = JSON.parse(boutique.get("qualicode.license") || "{}");
dire("l'essai n'est pas entamé pendant la période",
  enregistre.trialStart === undefined, "trialStart=" + enregistre.trialStart);

// 3 — Deux mois d'usage quotidien, puis fin de période
for (const d of ["2026-09-25", "2026-10-10", "2026-10-31", "2026-11-14"]) {
  figer(jour(d)); await lic.licenseStatus();
}
figer(jour("2026-11-15"));
st = await lic.licenseStatus();
dire("le dernier jour est encore libre", st.state === "libre", st.state);

// 4 — Le lendemain : l'essai de 5 jours démarre, personne n'est bloqué
figer(jour("2026-11-16"));
st = await lic.licenseStatus();
dire("après la période, l'essai démarre (pas de blocage)", st.state === "trial", st.state);
dire("les 5 jours d'essai sont intacts", st.daysLeft === 5, st.daysLeft + " j");

// 5 — L'essai s'épuise ensuite normalement
figer(jour("2026-11-22"));
st = await lic.licenseStatus();
dire("l'essai expiré rebascule sur l'abonnement", st.state === "expired", st.state + "/" + st.reason);

// 6 — Un client qui a payé voit sa licence, même pendant la période
boutique.clear();
figer(jour("2026-09-20"));
const cle = await lic.makeKey("month", "2026-12-31", "Client Test", "");
await lic.activateKey(cle);
st = await lic.licenseStatus();
dire("un client payant voit sa licence, pas l'accès libre",
  st.state === "active" && st.plan === "month", st.state);

// 7 — Coupure : si la date est vide, rien ne change au comportement d'origine
dire("accesLibreActif() est faux après la date", !lic.accesLibreActif(jour("2026-11-16")));
dire("accesLibreActif() est vrai avant la date", lic.accesLibreActif(jour("2026-10-01")));

rendre();
console.log(`\nBILAN : ${ok.length} réussis, ${ko.length} en échec\n`);
process.exit(ko.length ? 1 : 0);
