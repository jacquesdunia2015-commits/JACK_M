// Tarifs et canaux de paiement de QualiCode.
//
// IMPORTANT (à lire avant commercialisation) : une application 100 % locale ne
// peut pas encaisser un paiement toute seule. Le circuit est donc :
//   1. le client paie par l'un des canaux ci-dessous (lien Stripe, PayPal,
//      mobile money, virement, crypto…) ;
//   2. le vendeur reçoit la notification de paiement (e-mail / SMS de
//      l'opérateur ou du prestataire) ;
//   3. le vendeur génère une clé de licence avec tools/generer_cle.py et
//      l'envoie au client (e-mail ou WhatsApp) ;
//   4. le client colle la clé dans « 💳 Abonnement » → l'application s'active,
//      même hors ligne.
// Pour automatiser l'étape 2→3 (livraison instantanée de la clé), il faut un
// petit serveur avec les webhooks du prestataire — voir PRICING.md §5.
//
// PERSONNALISEZ PAY_CONFIG avec VOS liens et numéros marchands réels avant de
// distribuer l'application. Les valeurs « À CONFIGURER » sont des exemples.

import { t } from "./i18n.js";

/** Grille tarifaire en dollars US — deux zones (parité de pouvoir d'achat). */
export const PRICING = {
  currency: "USD",
  zones: [
    { id: "afrique", label: "Afrique (tarif solidaire)", day: 1.5, week: 6, month: 15, year: 99, life: 199 },
    { id: "international", label: "International", day: 4, week: 15, month: 29, year: 199, life: 399 },
  ],
  institution: { afrique: 990, international: 1990, seats: 10 },
  trialDays: 5,
};

/** Canaux de paiement affichés au client. À remplacer par vos comptes réels. */
export const PAY_CONFIG = {
  contactEmail: "jacquesdunia2015@gmail.com",
  whatsapp: "+257 00 00 00 00", // À CONFIGURER : votre numéro WhatsApp Business
  stripeLink: "", // À CONFIGURER : lien « Payment Link » créé sur stripe.com (Visa, Mastercard)
  paypalLink: "", // À CONFIGURER : ex. https://paypal.me/VotreNom
  aggregatorLink: "", // À CONFIGURER : page de paiement CinetPay / Flutterwave / PawaPay (mobile money + cartes)
  mobileMoney: [
    { op: "Orange Money", number: "À CONFIGURER", name: "Nom du marchand" },
    { op: "MTN MoMo", number: "À CONFIGURER", name: "Nom du marchand" },
    { op: "Airtel Money", number: "À CONFIGURER", name: "Nom du marchand" },
  ],
  crypto: [
    { coin: "USDT (TRC-20)", address: "À CONFIGURER" },
    { coin: "Bitcoin (BTC)", address: "À CONFIGURER" },
  ],
};

const fmt = v => "$" + (Number.isInteger(v) ? v : v.toFixed(2));

/** Tableau HTML des formules (essai, jour, semaine, mois, an, à vie). */
export function buildPricingHtml() {
  const rows = [
    ["pay_plan_trial", z => t("pay_free") + " · 5 " + t("pay_days")],
    ["pay_plan_day", z => fmt(z.day)],
    ["pay_plan_week", z => fmt(z.week)],
    ["pay_plan_month", z => fmt(z.month)],
    ["pay_plan_year", z => fmt(z.year)],
    ["pay_plan_life", z => fmt(z.life)],
  ];
  const zs = PRICING.zones;
  let h = `<table class="pay-table"><thead><tr><th>${t("pay_plan")}</th>`;
  for (const z of zs) h += `<th>${z.label}</th>`;
  h += "</tr></thead><tbody>";
  for (const [key, cell] of rows) {
    h += `<tr><td>${t(key)}</td>`;
    for (const z of zs) h += `<td>${cell(z)}</td>`;
    h += "</tr>";
  }
  h += "</tbody></table>";
  return h;
}

/** Liste HTML des canaux de paiement configurés + marche à suivre. */
export function buildPaymentsHtml() {
  const c = PAY_CONFIG;
  const li = [];
  if (c.aggregatorLink) li.push(`<li>📱 <b>Mobile money</b> (Orange, MTN, Airtel) &amp; cartes : <a href="${c.aggregatorLink}" target="_blank" rel="noopener">${c.aggregatorLink}</a></li>`);
  for (const m of c.mobileMoney) {
    if (m.number && !/CONFIGURER/.test(m.number)) li.push(`<li>📱 <b>${m.op}</b> : ${m.number} (${m.name})</li>`);
  }
  if (c.stripeLink) li.push(`<li>💳 <b>Visa / Mastercard (Stripe)</b> : <a href="${c.stripeLink}" target="_blank" rel="noopener">${c.stripeLink}</a></li>`);
  if (c.paypalLink) li.push(`<li>🅿️ <b>PayPal</b> : <a href="${c.paypalLink}" target="_blank" rel="noopener">${c.paypalLink}</a></li>`);
  for (const k of c.crypto) {
    if (k.address && !/CONFIGURER/.test(k.address)) li.push(`<li>₿ <b>${k.coin}</b> : <code>${k.address}</code></li>`);
  }
  const channels = li.length
    ? `<ul class="pay-channels">${li.join("")}</ul>`
    : `<p class="hint">${t("pay_not_configured")}</p>`;
  return `
    ${buildPricingHtml()}
    <h3>${t("pay_how_title")}</h3>
    <ol class="pay-steps">
      <li>${t("pay_step1")}</li>
      <li>${t("pay_step2")} <b>${c.contactEmail}</b>${c.whatsapp && !/00 00/.test(c.whatsapp) ? " / WhatsApp " + c.whatsapp : ""}</li>
      <li>${t("pay_step3")}</li>
    </ol>
    ${channels}`;
}
