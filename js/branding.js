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
const TAILLE_MAX = 320; // px : suffisant pour l'en-tête et l'impression

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

/** Place (ou retire) le logo de l'organisation dans l'en-tête. */
export function appliquerLogoEntete() {
  const marque = document.querySelector(".brand-logos") || document.querySelector(".app-brand");
  if (!marque) return;
  let el = document.getElementById("orgLogo");
  const src = getOrgLogo();
  if (!src) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("img");
    el.id = "orgLogo";
    el.className = "org-logo";
    marque.appendChild(el);
  }
  el.src = src;
  el.alt = getOrgName() || "Organisation";
  el.title = getOrgName() || "";
}

/**
 * Bloc HTML à insérer en tête des rapports imprimables : les deux logos
 * côte à côte. Vide si aucune organisation n'est configurée.
 */
export function enteteRapportHtml() {
  const src = getOrgLogo();
  if (!src) return "";
  const nom = getOrgName();
  return `<div class="rapport-marques" style="display:flex;align-items:center;gap:18px;margin-bottom:14px">
      <img src="${src}" alt="${nom}" style="height:64px">
      ${nom ? `<strong style="font-size:15px">${nom}</strong>` : ""}
    </div>`;
}

/**
 * Au tout premier lancement, propose le logo livré avec l'application
 * (assets/logo/organisation.png) s'il existe. Silencieux sinon.
 */
export async function chargerLogoParDefaut(nomParDefaut = "") {
  if (getOrgLogo()) return false;                 // l'utilisateur a déjà choisi
  // Version fichier unique : le logo est embarqué à la construction
  const embarque = typeof window !== "undefined" && window.__QC_ORG_LOGO;
  if (embarque) {
    setOrgLogo(embarque, window.__QC_ORG_NOM || nomParDefaut);
    appliquerLogoEntete();
    return true;
  }
  if (!/^https?:$/.test(location.protocol)) return false; // pas de fichier annexe hors ligne
  // Le site n'annonce un logo livré que si index.html contient la balise
  //   <meta name="qc-org-logo" content="assets/logo/organisation.png">
  // Sans elle, aucune requête réseau n'est tentée (pas de 404 au démarrage sur
  // les connexions lentes).
  const chemin = document.querySelector('meta[name="qc-org-logo"]')?.content;
  if (!chemin) return false;
  // Une seule tentative par appareil : si le fichier manque, on ne réessaie pas
  // à chaque lancement.
  try { if (localStorage.getItem(CLE_ESSAI)) return false; } catch { /* ignore */ }
  try { localStorage.setItem(CLE_ESSAI, "1"); } catch { /* ignore */ }
  try {
    const res = await fetch(chemin, { cache: "no-cache" });
    if (!res.ok) return false;
    const blob = await res.blob();
    const dataUrl = await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
    const nom = document.querySelector('meta[name="qc-org-nom"]')?.content || nomParDefaut;
    setOrgLogo(dataUrl, nom);
    appliquerLogoEntete();
    return true;
  } catch {
    return false;
  }
}
