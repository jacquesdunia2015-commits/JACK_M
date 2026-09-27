// Co-marquage : afficher le logo d'une organisation à côté de celui de
// QualiCode (en-tête de l'application et rapports imprimables).
//
// Usage prévu :
//  - votre propre organisation (APSA…) sur vos postes et vos démonstrations ;
//  - argument commercial : une université ou une ONG cliente peut afficher SON
//    logo dans l'application, ce que ne permettent ni MAXQDA ni NVivo.
//
// Le logo est redimensionné puis conservé en base64 dans le navigateur
// (localStorage) : il suit l'appareil, jamais le fichier projet — un .projx
// envoyé à un collègue ne transporte pas votre identité visuelle.
//
// Un logo par défaut peut aussi être livré avec l'application : déposez le
// fichier dans assets/logo/organisation.png et il sera proposé au premier
// lancement (voir chargerLogoParDefaut).

const CLE = "qualicode.orgLogo";
const CLE_NOM = "qualicode.orgName";
const CLE_ESSAI = "qualicode.orgLogoTried";
const CLE_DRAPEAU = "qualicode.orgFlag";
const TAILLE_MAX = 320; // px : suffisant pour l'en-tête et l'impression

/* ----------------------------------------------------------------
   Drapeaux nationaux
   Dessinés au format officiel (proportions 3:2), en SVG : quelques
   centaines d'octets chacun, nets à toutes les tailles, et disponibles
   hors ligne sans aucune requête réseau.
---------------------------------------------------------------- */
const DRAPEAUX = {
  // République démocratique du Congo (drapeau de 2006) : champ bleu ciel,
  // bande diagonale rouge bordée de jaune du bas du guindant vers le haut du
  // battant, étoile jaune à cinq branches au canton supérieur du guindant.
  cd: {
    nom: "République démocratique du Congo",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="600" fill="#007FFF"/>
<line x1="-140" y1="740" x2="1040" y2="-140" stroke="#F7D618" stroke-width="172"/>
<line x1="-140" y1="740" x2="1040" y2="-140" stroke="#CE1021" stroke-width="112"/>
<polygon fill="#F7D618" points="160.0,44.0 181.6,110.3 251.3,110.3 194.9,151.3 216.4,217.7 160.0,176.7 103.6,217.7 125.1,151.3 68.7,110.3 138.4,110.3"/>
</svg>`,
  },
  // Rwanda (2001) : bleu, jaune, vert ; soleil à 24 rayons en haut à droite.
  rw: {
    nom: "Rwanda",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="600" fill="#20603D"/>
<rect width="900" height="450" fill="#FAD201"/>
<rect width="900" height="300" fill="#00A1DE"/>
<g fill="#E5BE01"><circle cx="680" cy="150" r="52"/>
<path d="M731.9,146.2L776.0,150.0L731.9,153.8ZM731.1,159.7L772.7,174.8L729.1,167.1ZM726.8,172.6L763.1,198.0L723.0,179.2ZM719.4,184.0L747.9,217.9L714.0,189.4ZM709.2,193.0L728.0,233.1L702.6,196.8ZM697.1,199.1L704.8,242.7L689.7,201.1ZM683.8,201.9L680.0,246.0L676.2,201.9ZM670.3,201.1L655.2,242.7L662.9,199.1ZM657.4,196.8L632.0,233.1L650.8,193.0ZM646.0,189.4L612.1,217.9L640.6,184.0ZM637.0,179.2L596.9,198.0L633.2,172.6ZM630.9,167.1L587.3,174.8L628.9,159.7ZM628.1,153.8L584.0,150.0L628.1,146.2ZM628.9,140.3L587.3,125.2L630.9,132.9ZM633.2,127.4L596.9,102.0L637.0,120.8ZM640.6,116.0L612.1,82.1L646.0,110.6ZM650.8,107.0L632.0,66.9L657.4,103.2ZM662.9,100.9L655.2,57.3L670.3,98.9ZM676.2,98.1L680.0,54.0L683.8,98.1ZM689.7,98.9L704.8,57.3L697.1,100.9ZM702.6,103.2L728.0,66.9L709.2,107.0ZM714.0,110.6L747.9,82.1L719.4,116.0ZM723.0,120.8L763.1,102.0L726.8,127.4ZM729.1,132.9L772.7,125.2L731.1,140.3Z"/></g>
</svg>`,
  },
  // Bénin : bande verte au guindant, jaune et rouge au battant.
  bj: {
    nom: "Bénin",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="300" fill="#FCD116"/>
<rect y="300" width="900" height="300" fill="#E8112D"/>
<rect width="360" height="600" fill="#008751"/>
</svg>`,
  },
};

/** Liste des drapeaux disponibles : [{ code, nom, src }]. */
export function listeDrapeaux() {
  return Object.entries(DRAPEAUX).map(([code, d]) => ({ code, nom: d.nom, src: drapeauSrc(code) }));
}

/** Data-URL d'un drapeau intégré ; chaîne vide si le code est inconnu. */
export function drapeauSrc(code) {
  const d = DRAPEAUX[code];
  if (!d) return "";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(d.svg.replace(/\n\s*/g, ""));
}

export function getOrgFlag() {
  try { return localStorage.getItem(CLE_DRAPEAU) || ""; } catch { return ""; }
}

/** `code` : clé de DRAPEAUX ("cd", "rw"…), une data-URL d'image, ou "" pour aucun. */
export function setOrgFlag(code) {
  try {
    if (code) localStorage.setItem(CLE_DRAPEAU, code); else localStorage.removeItem(CLE_DRAPEAU);
    localStorage.setItem(CLE_ESSAI, "1");
  } catch { /* stockage indisponible */ }
}

/** Source affichable du drapeau retenu (code intégré ou image personnelle). */
function sourceDrapeau() {
  const v = getOrgFlag();
  if (!v) return { src: "", nom: "" };
  if (v.startsWith("data:")) return { src: v, nom: getOrgName() || "Drapeau" };
  return { src: drapeauSrc(v), nom: DRAPEAUX[v]?.nom || "" };
}

/**
 * Vignette de remplacement quand aucun fichier de logo n'a encore été fourni :
 * les initiales de l'organisation sur une pastille aux couleurs de QualiCode.
 * Ce n'est PAS le logo officiel de l'organisation — juste un repère visuel
 * temporaire, remplacé dès qu'une image est chargée.
 */
export function badgeOrg(nom) {
  // « APSA — Actions pour… » : on garde le sigle tel quel s'il y en a un ;
  // « Université de Parakou » : on prend les initiales des mots significatifs.
  const premier = (nom || "").trim().split(/[\s—–]+/)[0] || "";
  const initiales = /^[A-ZÀ-Þ0-9]{2,5}$/.test(premier)
    ? premier
    : ((nom || "").trim().split(/[\s—–-]+/)
        .filter(m => m.length > 2 || /^[A-ZÀ-Þ]/.test(m))
        .map(m => m[0] || "").join("").toUpperCase().slice(0, 4) || "?");
  const largeur = 60 + initiales.length * 42;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="160" viewBox="0 0 ${largeur} 160">
<rect width="${largeur}" height="160" rx="34" fill="#26567d"/>
<text x="${largeur / 2}" y="108" text-anchor="middle" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="76" font-weight="700" fill="#ffffff" letter-spacing="2">${initiales}</text>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/\n\s*/g, ""));
}

export function getOrgLogo() {
  try { return localStorage.getItem(CLE) || ""; } catch { return ""; }
}

export function getOrgName() {
  try { return localStorage.getItem(CLE_NOM) || ""; } catch { return ""; }
}

export function setOrgLogo(dataUrl, nom = "") {
  try {
    if (dataUrl) localStorage.setItem(CLE, dataUrl); else localStorage.removeItem(CLE);
    if (nom) localStorage.setItem(CLE_NOM, nom); else localStorage.removeItem(CLE_NOM);
    // Choix délibéré de l'utilisateur : ne plus proposer le logo livré, même
    // s'il vient de retirer le sien.
    localStorage.setItem(CLE_ESSAI, "1");
  } catch { /* stockage indisponible */ }
}

/**
 * Redimensionne une image de logo en PNG (transparence conservée) pour ne pas
 * alourdir le stockage. Retourne une data-URL.
 */
export function logoVersDataUrl(file) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("lecture impossible"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image illisible"));
      img.onload = () => {
        const ratio = Math.min(1, TAILLE_MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(file);
  });
}

/**
 * Place (ou retire) le logo de l'organisation et le drapeau dans l'en-tête,
 * à droite du logo QualiCode et sur la même ligne.
 */
export function appliquerLogoEntete() {
  const marque = document.querySelector(".brand-logos") || document.querySelector(".app-brand");
  if (!marque) return;

  const nom = getOrgName();
  // Logo de l'organisation : image fournie, sinon vignette d'initiales si un
  // nom est configuré, sinon rien du tout.
  const vrai = getOrgLogo();
  const srcLogo = vrai || (nom ? badgeOrg(nom) : "");
  // La plaque blanche sert à détacher un vrai logo (souvent transparent) du
  // fond ; la vignette d'initiales est déjà opaque et s'en passe.
  poserImage(marque, "orgLogo", "org-logo" + (vrai ? "" : " is-badge"), srcLogo,
    nom || "Organisation");

  // Drapeau national, toujours en dernier
  const dr = sourceDrapeau();
  poserImage(marque, "orgFlag", "org-flag", dr.src, dr.nom);

  // Trois marques sur une ligne : on réduit l'ensemble pour ne pas manger la
  // place des onglets du ruban.
  marque.classList.toggle("co-brand", !!(srcLogo || dr.src));
}

function poserImage(parent, id, classe, src, titre) {
  let el = document.getElementById(id);
  if (!src) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("img");
    el.id = id;
    parent.appendChild(el);
  } else if (el.parentNode !== parent || el.nextSibling) {
    parent.appendChild(el); // garde l'ordre logo → drapeau
  }
  el.className = classe;
  el.src = src;
  el.alt = titre;
  el.title = titre;
}

/**
 * Bloc HTML à insérer en tête des rapports imprimables : logo de
 * l'organisation, nom, et drapeau. Vide si rien n'est configuré.
 */
export function enteteRapportHtml() {
  const nom = getOrgName();
  const srcLogo = getOrgLogo() || (nom ? badgeOrg(nom) : "");
  const dr = sourceDrapeau();
  if (!srcLogo && !dr.src) return "";
  return `<div class="rapport-marques" style="display:flex;align-items:center;gap:18px;margin-bottom:14px">
      ${srcLogo ? `<img src="${srcLogo}" alt="${nom}" style="height:64px">` : ""}
      ${nom ? `<strong style="font-size:15px">${nom}</strong>` : ""}
      ${dr.src ? `<img src="${dr.src}" alt="${dr.nom}" title="${dr.nom}" style="height:44px;border:1px solid #ccc;margin-left:auto">` : ""}
    </div>`;
}

const meta = nom => document.querySelector(`meta[name="${nom}"]`)?.content || "";

/**
 * Au tout premier lancement sur un appareil, adopte le co-marquage livré avec
 * l'application : nom de l'organisation, drapeau, et fichier de logo s'il est
 * fourni. Tout se règle dans les balises <meta> de index.html :
 *
 *   <meta name="qc-org-nom"      content="APSA">
 *   <meta name="qc-org-drapeau"  content="cd">
 *   <meta name="qc-org-logo"     content="assets/logo/organisation.png">
 *
 * Dès que l'utilisateur a fait son propre choix (fenêtre 🏛️), cette fonction
 * ne touche plus à rien.
 */
export async function chargerLogoParDefaut(nomParDefaut = "") {
  let dejaChoisi = false;
  try { dejaChoisi = !!localStorage.getItem(CLE_ESSAI); } catch { /* ignore */ }
  if (dejaChoisi) return false;

  const nom = meta("qc-org-nom") || nomParDefaut;
  const drapeau = meta("qc-org-drapeau");
  let change = false;

  // 1. Nom (affiché en vignette d'initiales tant qu'aucune image n'est fournie)
  if (nom) { try { localStorage.setItem(CLE_NOM, nom); } catch { /* ignore */ } change = true; }
  // 2. Drapeau national
  if (drapeau && DRAPEAUX[drapeau]) {
    try { localStorage.setItem(CLE_DRAPEAU, drapeau); } catch { /* ignore */ }
    change = true;
  }

  // 3. Fichier de logo. Version fichier unique : embarqué à la construction.
  const embarque = typeof window !== "undefined" && window.__QC_ORG_LOGO;
  if (embarque) {
    setOrgLogo(embarque, window.__QC_ORG_NOM || nom);
    appliquerLogoEntete();
    return true;
  }
  // Version site : uniquement si index.html annonce un fichier. Sans la balise,
  // aucune requête réseau n'est tentée (pas de 404 au démarrage sur connexion
  // lente) ; la vignette d'initiales suffit en attendant.
  const chemin = /^https?:$/.test(location.protocol) ? meta("qc-org-logo") : "";
  if (!chemin) {
    if (change) appliquerLogoEntete();
    return change;
  }
  // Une seule tentative par appareil : si le fichier manque, on ne réessaie pas.
  try { localStorage.setItem(CLE_ESSAI, "1"); } catch { /* ignore */ }
  try {
    const res = await fetch(chemin, { cache: "no-cache" });
    if (!res.ok) { appliquerLogoEntete(); return change; }
    const blob = await res.blob();
    const dataUrl = await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
    setOrgLogo(dataUrl, nom);
    appliquerLogoEntete();
    return true;
  } catch {
    appliquerLogoEntete();
    return change;
  }
}
