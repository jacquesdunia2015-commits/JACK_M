// Adaptation téléphone (Android / iOS) : QualiCode passe d'une mise en page
// à 4 volets simultanés (bureau) à un volet unique commuté par une barre
// d'onglets en bas de l'écran, avec codage tactile par sélection + bouton
// flottant, et ruban dépliable en plein écran.
//
// Rien n'est retiré sur mobile : toutes les fonctions du ruban restent
// accessibles via le bouton ☰. Le basculement est automatique selon la
// largeur de l'écran (et suit la rotation du téléphone).

import { t } from "./i18n.js";

const MOBILE_MAX_WIDTH = 820;
const PANELS = [
  { id: "docs", icon: "📄", key: "m_docs" },
  { id: "codes", icon: "🏷️", key: "m_codes" },
  { id: "browser", icon: "📖", key: "m_text" },
  { id: "retrieved", icon: "🧲", key: "m_segments" },
];

let handlers = {};
let currentPanel = "browser";

export function isMobileLayout() {
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

/** Vrai si l'appareil est piloté au doigt (utile pour agrandir les cibles). */
export function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Affiche un seul volet (mobile). Sans effet en mise en page bureau. */
export function showMobilePanel(id) {
  currentPanel = id;
  document.body.dataset.mpanel = id;
  document.querySelectorAll("#mobileNav .mnav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.panel === id);
    b.setAttribute("aria-selected", b.dataset.panel === id ? "true" : "false");
  });
  closeRibbonSheet();
  // Remet le volet en haut : sur mobile on ne voit qu'un écran à la fois
  const body = document.querySelector(`#panel-${id} .panel-body`);
  if (body) body.scrollTop = body.scrollTop; // conserve la position, pas de saut
}

export function getMobilePanel() {
  return currentPanel;
}

function openRibbonSheet() {
  document.body.classList.add("ribbon-open");
  // Reprend le nom de l'onglet actif comme titre de la feuille
  const active = document.querySelector("#ribbonTabs button.active");
  const title = document.querySelector(".sheet-bar .sheet-title");
  if (active && title) title.textContent = active.textContent.trim();
  document.querySelector("#ribbon .ribbon-content")?.scrollTo(0, 0);
}

export function closeRibbonSheet() {
  document.body.classList.remove("ribbon-open");
}

function toggleRibbonSheet() {
  if (document.body.classList.contains("ribbon-open")) closeRibbonSheet();
  else openRibbonSheet();
}

/** Construit la barre d'onglets du bas, le bouton ☰ et le bouton de codage. */
function buildMobileChrome() {
  if (document.getElementById("mobileNav")) return;

  // Barre d'onglets inférieure
  const nav = document.createElement("nav");
  nav.id = "mobileNav";
  nav.setAttribute("role", "tablist");
  nav.innerHTML =
    PANELS.map(p => `<button class="mnav-btn" role="tab" data-panel="${p.id}">
        <span class="mnav-ico">${p.icon}</span><span class="mnav-lbl" data-i18n="${p.key}">${p.id}</span>
      </button>`).join("") +
    `<button class="mnav-btn" id="mnavMenu"><span class="mnav-ico">☰</span>
       <span class="mnav-lbl" data-i18n="m_menu">Menu</span></button>`;
  document.body.appendChild(nav);

  nav.querySelectorAll(".mnav-btn[data-panel]").forEach(b => {
    b.onclick = () => showMobilePanel(b.dataset.panel);
  });
  nav.querySelector("#mnavMenu").onclick = toggleRibbonSheet;

  // Bouton flottant « Coder la sélection » (apparaît après une sélection)
  const fab = document.createElement("button");
  fab.id = "codeFab";
  fab.hidden = true;
  fab.innerHTML = `🏷️ <span data-i18n="m_code_sel">Coder la sélection</span>`;
  document.body.appendChild(fab);
  fab.onclick = ev => {
    ev.preventDefault();
    const r = fab.getBoundingClientRect();
    handlers.onCodeSelection?.(r.left, r.top - 8);
  };

  // Voile qui referme le ruban quand on tape à côté (au-dessus de la feuille)
  const scrim = document.createElement("div");
  scrim.id = "ribbonScrim";
  scrim.onclick = closeRibbonSheet;
  document.body.appendChild(scrim);

  // Barre de titre de la feuille du ruban : nom de l'onglet + bouton fermer
  const content = document.querySelector("#ribbon .ribbon-content");
  if (content && !content.querySelector(".sheet-bar")) {
    const bar = document.createElement("div");
    bar.className = "sheet-bar";
    bar.innerHTML = `<span class="sheet-title"></span><button class="sheet-close" type="button">✕</button>`;
    bar.querySelector(".sheet-close").onclick = closeRibbonSheet;
    content.prepend(bar);
  }
}

/** Affiche/masque le bouton flottant selon qu'un texte est sélectionné. */
function watchSelection() {
  const update = () => {
    const fab = document.getElementById("codeFab");
    if (!fab) return;
    if (!isMobileLayout() || currentPanel !== "browser") { fab.hidden = true; return; }
    const sel = window.getSelection();
    const browser = document.getElementById("docBrowser");
    const ok = sel && !sel.isCollapsed && sel.rangeCount &&
      browser && browser.contains(sel.getRangeAt(0).commonAncestorContainer) &&
      sel.toString().trim().length > 0;
    fab.hidden = !ok;
    // Mémorise la sélection tant qu'elle existe : sur téléphone, toucher le
    // bouton l'efface avant que le clic ne soit traité.
    if (ok) handlers.onSelectionActive?.();
  };
  document.addEventListener("selectionchange", () => setTimeout(update, 60));
  document.addEventListener("touchend", () => setTimeout(update, 120));
}

/**
 * Active l'adaptation mobile et la maintient à jour (rotation, redimensionnement).
 * handlers : { onCodeSelection(x, y) } — ouvre le sélecteur de codes.
 */
export function initMobile(h = {}) {
  handlers = h;
  buildMobileChrome();
  watchSelection();

  const apply = () => {
    const m = isMobileLayout();
    document.body.classList.toggle("mobile", m);
    document.body.classList.toggle("touch", isTouchDevice());
    if (m) {
      if (!document.body.dataset.mpanel) showMobilePanel("browser");
    } else {
      document.body.removeAttribute("data-mpanel");
      closeRibbonSheet();
      const fab = document.getElementById("codeFab");
      if (fab) fab.hidden = true;
    }
  };
  apply();
  window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).addEventListener("change", apply);
  window.addEventListener("orientationchange", () => setTimeout(apply, 200));

  // Un onglet du ruban ouvre la feuille correspondante sur mobile
  document.getElementById("ribbonTabs")?.addEventListener("click", () => {
    if (isMobileLayout()) openRibbonSheet();
  });
  // Toute action du ruban referme la feuille (on retourne au travail)
  document.querySelector("#ribbon .ribbon-content")?.addEventListener("click", e => {
    if (isMobileLayout() && e.target.closest(".rbtn")) closeRibbonSheet();
  });
}

/** Sur mobile, ouvrir un document bascule automatiquement sur le texte. */
export function focusTextPanel() {
  if (isMobileLayout()) showMobilePanel("browser");
}

// ── Installation sur l'écran d'accueil (téléphone ET ordinateur) ────────────
// Sur Android/Chrome/Edge, le navigateur signale que l'application peut être
// installée via « beforeinstallprompt » : on garde l'événement pour proposer
// l'installation au bon moment (bandeau discret, ou bouton du ruban).
const BANNER_SNOOZE_KEY = "qualicode.installSnooze";
const SNOOZE_DAYS = 14;
let installPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  document.dispatchEvent(new CustomEvent("qc-installable"));
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  document.getElementById("installBanner")?.remove();
  document.dispatchEvent(new CustomEvent("qc-installed"));
});

/** Vrai si le navigateur propose l'installation native (Chrome, Edge, Android). */
export function canInstallNatively() {
  return !!installPrompt;
}

/** Vrai sur iPhone/iPad, où l'installation passe par le menu Partager de Safari. */
export function isIosSafari() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function snoozed() {
  const until = Number(localStorage.getItem(BANNER_SNOOZE_KEY) || 0);
  return Date.now() < until;
}

function snooze() {
  localStorage.setItem(BANNER_SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
}

/**
 * Bandeau discret « Installer QualiCode » : s'affiche quand le navigateur
 * l'autorise (Android, Chrome/Edge sur ordinateur) ou sur iPhone (instructions).
 * Refusé une fois, il ne revient pas avant deux semaines.
 * `onInstall` reçoit le résultat de promptInstall() pour afficher un message.
 */
export function initInstallBanner(onInstall) {
  const build = () => {
    if (isInstalled() || snoozed() || document.getElementById("installBanner")) return;
    if (!installPrompt && !isIosSafari()) return; // rien à proposer (Firefox, Safari macOS…)
    const el = document.createElement("div");
    el.id = "installBanner";
    el.innerHTML = `
      <span class="ib-ico">📲</span>
      <span class="ib-text">${t("m_install_banner")}</span>
      <button class="btn primary ib-yes">${t("m_install_yes")}</button>
      <button class="btn ib-no">${t("m_install_later")}</button>`;
    document.body.appendChild(el);
    el.querySelector(".ib-yes").onclick = async () => {
      el.remove();
      onInstall?.(await promptInstall());
    };
    el.querySelector(".ib-no").onclick = () => { snooze(); el.remove(); };
  };
  // Laisse l'utilisateur voir l'application d'abord (bandeau après 12 s)
  setTimeout(build, 12000);
  document.addEventListener("qc-installable", () => setTimeout(build, 1500));
}

/**
 * Ouverture « en un clic » d'un fichier .projx / .qdpx depuis le système :
 * quand QualiCode est installé, double-cliquer un projet le lance directement
 * (API File Handling — Chrome/Edge sur ordinateur et Android).
 */
export function initFileHandler(onFiles) {
  if (!("launchQueue" in window) || !window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async params => {
    if (!params?.files?.length) return;
    const files = [];
    for (const handle of params.files) {
      try { files.push(await handle.getFile()); } catch { /* accès refusé */ }
    }
    if (files.length) onFiles(files);
  });
}

/** Vrai si l'application tourne déjà en mode « installée » (plein écran). */
export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

/** Adresse web publique de QualiCode (seule voie possible pour installer). */
export const SITE_URL = "https://jacquesdunia2015-commits.github.io/JACK_M/";

/**
 * Diagnostic d'installation : dit précisément CE QUI BLOQUE.
 * Les navigateurs n'installent une application que si elle est ouverte depuis
 * une adresse https (ou localhost) : un fichier .html ouvert depuis « Fichiers »
 * ou WhatsApp ne peut PAS être installé, quel que soit le téléphone.
 */
export async function installDiagnostic() {
  const ua = navigator.userAgent;
  const secure = location.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(location.hostname);
  const isFile = !/^https?:$/.test(location.protocol);

  let swReady = false;
  if ("serviceWorker" in navigator && secure) {
    try { swReady = !!(await navigator.serviceWorker.getRegistration()); } catch { /* refusé */ }
  }

  return {
    installed: isInstalled(),
    context: isFile ? "file" : (secure ? "web" : "insecure"),
    platform: /Android/.test(ua) ? "android" : (/iPad|iPhone|iPod/.test(ua) ? "ios" : "desktop"),
    iosSafari: isIosSafari(),
    // Chrome/Edge/Samsung Internet savent installer ; Firefox et Safari macOS non
    chromiumLike: /Chrome|CriOS|Chromium|Edg|SamsungBrowser/.test(ua),
    hasManifest: !!document.querySelector("link[rel=manifest]"),
    secure, swReady,
    nativePrompt: !!installPrompt,
    siteUrl: SITE_URL,
  };
}

/**
 * Propose l'installation. Retourne :
 *  "installed" (déjà installée), "accepted" / "dismissed" (choix de
 *  l'utilisateur dans la fenêtre native), "manual" (navigateur sans invite
 *  native : iOS/Safari, Firefox → instructions à afficher).
 */
export async function promptInstall() {
  if (isInstalled()) return "installed";
  if (!installPrompt) return "manual";
  installPrompt.prompt();
  const choice = await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  return choice?.outcome === "accepted" ? "accepted" : "dismissed";
}

/** Enregistre le service worker (installation « application » + hors ligne). */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Inutile (et impossible) en file:// : le fichier unique est déjà hors ligne
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
