// Verrou d'application : un mot de passe est demandé à CHAQUE ouverture de
// QualiCode avant tout accès aux données (bibliothèque de projets comprise).
// Le mot de passe n'est jamais stocké : seul un condensat PBKDF2-SHA256 salé
// est conservé dans localStorage. Complémentaire du chiffrement AES-256 des
// fichiers .projx (js/crypto.js) : ici on protège l'accès à l'application sur
// la machine, là-bas on protège le fichier qui circule.

import { t } from "./i18n.js";

const STORE_KEY = "qualicode.applock";
const ITERATIONS = 310000;
const enc = new TextEncoder();

function b64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromB64(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function deriveHash(password, salt) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    256
  );
  return b64(bits);
}

export function hasAppLock() {
  return !!localStorage.getItem(STORE_KEY);
}

export async function setAppLock(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, iterations: ITERATIONS, salt: b64(salt), hash }));
}

export function removeAppLock() {
  localStorage.removeItem(STORE_KEY);
}

export async function verifyAppLock(password) {
  const rec = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (!rec) return true;
  const hash = await deriveHash(password, fromB64(rec.salt));
  return hash === rec.hash;
}

/** Affiche l'écran de verrouillage ; la promesse est résolue au déverrouillage. */
export function showLockScreen() {
  return new Promise(resolve => {
    document.getElementById("qcLockScreen")?.remove();
    const el = document.createElement("div");
    el.id = "qcLockScreen";
    el.innerHTML = `
      <div class="lock-card">
        <div class="lock-logo">🔐</div>
        <h1>QualiCode</h1>
        <p>${t("lock_enter")}</p>
        <form class="lock-form">
          <input type="password" id="lockPw" autocomplete="current-password" autofocus>
          <button type="submit" class="btn primary">${t("lock_unlock")}</button>
        </form>
        <p class="lock-msg" hidden></p>
      </div>`;
    document.body.appendChild(el);
    const input = el.querySelector("#lockPw");
    const msg = el.querySelector(".lock-msg");
    input.focus();
    el.querySelector(".lock-form").addEventListener("submit", async e => {
      e.preventDefault();
      const ok = await verifyAppLock(input.value);
      if (ok) { el.remove(); resolve(); }
      else {
        msg.textContent = t("lock_wrong");
        msg.hidden = false;
        input.value = "";
        input.focus();
        const card = el.querySelector(".lock-card");
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      }
    });
  });
}

/** Barrière d'entrée : ne rend la main que si l'application est déverrouillée. */
export async function applockGate() {
  if (!hasAppLock()) return;
  await showLockScreen();
}
