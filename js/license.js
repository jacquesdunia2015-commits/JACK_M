// Licences et abonnements de QualiCode.
//
// Fonctionnement 100 % hors ligne :
//  - essai gratuit de 5 jours au premier lancement (date stockée localement) ;
//  - ensuite, une clé de licence signée HMAC-SHA256 active l'application pour
//    la durée payée : jour, semaine, mois, an ou à vie ;
//  - les clés sont générées par le vendeur avec tools/generer_cle.py et
//    vérifiées ici sans aucun serveur.
//
// Honnêteté technique : le secret de signature est embarqué dans l'application
// (obligatoire pour vérifier hors ligne). Un utilisateur technique qui lit le
// code source peut donc fabriquer une clé. C'est une protection « honnête
// dissuasive » (comme les licences de WinRAR ou Sublime Text), pas un DRM
// inviolable — aucun logiciel local n'en a. Changez LICENSE_SECRET (ici ET
// dans tools/generer_cle.py) avant toute distribution commerciale.

import { t } from "./i18n.js";
import { buildPaymentsHtml } from "./payments.js";

const LICENSE_SECRET = "QualiCode-2026-CHANGEZ-MOI-avant-vente";
const STORE_KEY = "qualicode.license";
const TRIAL_DAYS = 5;
const DAY_MS = 86400000;

export const PLAN_LABELS = { day: "lic_plan_day", week: "lic_plan_week", month: "lic_plan_month", year: "lic_plan_year", life: "lic_plan_life" };

const enc2 = new TextEncoder();

function b64u(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(s) {
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
}

async function hmacHex(payload) {
  const key = await crypto.subtle.importKey("raw", enc2.encode(LICENSE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc2.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

/**
 * CODE APPAREIL — la clé du contrôle commercial.
 *
 * Chaque installation reçoit un code court, aléatoire et stable (ex. K7QP-3M2X).
 * Le client le lit dans « 💳 Abonnement » et le communique à l'achat ; le vendeur
 * génère alors une clé VERROUILLÉE sur cet appareil, qui ne fonctionnera nulle
 * part ailleurs. C'est ce qui permet de distribuer librement le fichier
 * (WhatsApp, e-mail, clé USB) tout en gardant la maîtrise des abonnements :
 * le fichier circule, mais chaque clé ne sert qu'à un seul appareil.
 *
 * Une clé sans code appareil reste acceptée partout (pratique pour un client
 * qui change de téléphone, ou pour une licence de démonstration).
 */
const DEVICE_KEY = "qualicode.device";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 : dictés sans erreur

export function deviceCode() {
  let code = localStorage.getItem(DEVICE_KEY);
  if (!code) {
    const r = crypto.getRandomValues(new Uint8Array(8));
    code = [...r].map(b => ALPHABET[b % ALPHABET.length]).join("");
    code = code.slice(0, 4) + "-" + code.slice(4);
    localStorage.setItem(DEVICE_KEY, code);
  }
  return code;
}

/** Fabrique une clé (utilisé par les tests ; le vendeur utilise tools/generer_cle.py). */
export async function makeKey(plan, expIso, licensee, device = "") {
  const payload = `${plan}|${expIso}|${licensee || ""}|${device}`;
  return `QC1-${b64u(payload)}-${await hmacHex(payload)}`;
}

/** Vérifie une clé ; retourne { ok, plan, exp, licensee, device } ou { ok:false, reason }. */
export async function verifyKey(key) {
  try {
    const m = /^QC1-([A-Za-z0-9_-]+)-([0-9a-f]{20})$/.exec((key || "").trim());
    if (!m) return { ok: false, reason: "format" };
    const payload = fromB64u(m[1]);
    if ((await hmacHex(payload)) !== m[2]) return { ok: false, reason: "signature" };
    const [plan, exp, licensee, device] = payload.split("|");
    if (!PLAN_LABELS[plan] || !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return { ok: false, reason: "format" };
    // Clé verrouillée sur un appareil : refusée ailleurs
    if (device && device !== deviceCode()) return { ok: false, reason: "device" };
    return { ok: true, plan, exp, licensee, device };
  } catch {
    return { ok: false, reason: "format" };
  }
}

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
}

function writeStore(rec) {
  localStorage.setItem(STORE_KEY, JSON.stringify(rec));
}

/** Active une clé après vérification (et refuse une clé déjà expirée). */
export async function activateKey(key) {
  const v = await verifyKey(key);
  if (!v.ok) return v;
  if (endOfDay(v.exp) < Date.now()) return { ok: false, reason: "expired" };
  const rec = readStore();
  rec.key = key.trim();
  writeStore(rec);
  return v;
}

function endOfDay(iso) {
  return new Date(iso + "T23:59:59").getTime();
}

/** État courant : { state: "active"|"trial"|"expired", daysLeft, plan, exp, reason }. */
export async function licenseStatus() {
  const rec = readStore();
  const now = Date.now();

  // Détection grossière de recul d'horloge (> 36 h en arrière)
  const tampered = rec.lastSeen && now < rec.lastSeen - 1.5 * DAY_MS;
  rec.lastSeen = Math.max(now, rec.lastSeen || 0);
  if (!rec.trialStart) rec.trialStart = now;
  writeStore(rec);

  if (rec.key) {
    const v = await verifyKey(rec.key);
    if (v.ok && endOfDay(v.exp) >= now && !tampered) {
      return { state: "active", plan: v.plan, exp: v.exp, licensee: v.licensee, daysLeft: Math.ceil((endOfDay(v.exp) - now) / DAY_MS) };
    }
    if (v.ok && endOfDay(v.exp) < now) return { state: "expired", reason: "key", plan: v.plan, exp: v.exp };
  }
  if (tampered) return { state: "expired", reason: "clock" };

  const elapsed = now - rec.trialStart;
  const daysLeft = Math.ceil((TRIAL_DAYS * DAY_MS - elapsed) / DAY_MS);
  if (daysLeft > 0) return { state: "trial", daysLeft };
  return { state: "expired", reason: "trial" };
}

/** Texte court pour la barre d'état. */
export function licenseBadge(st) {
  if (st.state === "active") return "💳 " + t(PLAN_LABELS[st.plan]) + (st.plan === "life" ? "" : " → " + st.exp);
  if (st.state === "trial") return "⏳ " + t("lic_trial_badge").replace("{n}", st.daysLeft);
  return "⛔ " + t("lic_expired_badge");
}

/**
 * Barrière d'abonnement : si l'essai et la licence sont expirés, affiche un
 * écran bloquant (saisie de clé + tarifs + canaux de paiement). Les données ne
 * sont jamais prises en otage : un bouton exporte le projet même expiré.
 * `onExport` est fourni par app.js. Résout quand une clé valide est saisie.
 */
export async function licenseGate(onExport) {
  const st = await licenseStatus();
  if (st.state !== "expired") return st;
  return new Promise(resolve => {
    document.getElementById("qcLicScreen")?.remove();
    const el = document.createElement("div");
    el.id = "qcLicScreen";
    el.innerHTML = `
      <div class="lock-card lic-card">
        <div class="lock-logo">💳</div>
        <h1>QualiCode</h1>
        <p><b>${t(st.reason === "clock" ? "lic_clock_msg" : "lic_expired_msg")}</b></p>
        <form class="lock-form">
          <input type="text" id="licKeyIn" placeholder="QC1-…" spellcheck="false">
          <button type="submit" class="btn primary">${t("lic_activate")}</button>
        </form>
        <p class="lock-msg" hidden></p>
        <details class="lic-pay"><summary>${t("lic_buy_title")}</summary>${buildPaymentsHtml()}</details>
        <button type="button" class="btn lic-export">📦 ${t("lic_export_btn")}</button>
      </div>`;
    document.body.appendChild(el);
    const input = el.querySelector("#licKeyIn");
    const msg = el.querySelector(".lock-msg");
    input.focus();
    el.querySelector(".lic-export").onclick = () => onExport && onExport();
    el.querySelector(".lock-form").addEventListener("submit", async e => {
      e.preventDefault();
      const r = await activateKey(input.value);
      if (r.ok) { el.remove(); resolve(await licenseStatus()); }
      else {
        msg.textContent = t(r.reason === "expired" ? "lic_key_expired" : "lic_invalid");
        msg.hidden = false;
      }
    });
  });
}
