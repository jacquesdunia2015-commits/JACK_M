// medistat/js/core/langues.js
// Registre des 50 langues prises en charge, réparties sur tous les continents.
//
// Chaque entrée porte les métadonnées indispensables à un affichage correct :
//   code       — étiquette BCP 47 (ISO 639-1, ou 639-3 lorsqu'il n'existe pas)
//   nom        — nom de la langue DANS cette langue (endonyme), tel qu'il doit
//                figurer dans le sélecteur : un locuteur doit reconnaître sa
//                langue sans connaître le français
//   nomFr      — nom français, pour l'administration
//   sens       — "ltr" ou "rtl" ; conditionne la direction de toute l'interface
//   locale     — étiquette passée à Intl pour les nombres, dates et pluriels
//   continents — pour le regroupement du sélecteur
//   script     — utile au choix de la police et au repérage des écritures
//                non latines

// Sélection : les langues les plus parlées au monde, sous contrainte de
// couvrir les cinq continents. 15 pour l'Europe, 20 pour l'Asie et le
// Moyen-Orient, 11 pour l'Afrique, 2 pour les Amériques et 2 pour l'Océanie —
// étant entendu que l'anglais, l'espagnol, le portugais, le français et
// l'arabe couvrent à eux seuls plusieurs continents.
export const LANGUES = [
  /* ---------- Europe ---------- */
  { code: "fr",  nom: "Français",       nomFr: "Français",            sens: "ltr", locale: "fr-FR",  continents: ["Europe", "Afrique", "Amériques"], script: "latin" },
  { code: "en",  nom: "English",        nomFr: "Anglais",             sens: "ltr", locale: "en-GB",  continents: ["Europe", "Amériques", "Afrique", "Asie", "Océanie"], script: "latin" },
  { code: "es",  nom: "Español",        nomFr: "Espagnol",            sens: "ltr", locale: "es-ES",  continents: ["Europe", "Amériques"], script: "latin" },
  { code: "pt",  nom: "Português",      nomFr: "Portugais",           sens: "ltr", locale: "pt-BR",  continents: ["Europe", "Amériques", "Afrique"], script: "latin" },
  { code: "de",  nom: "Deutsch",        nomFr: "Allemand",            sens: "ltr", locale: "de-DE",  continents: ["Europe"], script: "latin" },
  { code: "it",  nom: "Italiano",       nomFr: "Italien",             sens: "ltr", locale: "it-IT",  continents: ["Europe"], script: "latin" },
  { code: "nl",  nom: "Nederlands",     nomFr: "Néerlandais",         sens: "ltr", locale: "nl-NL",  continents: ["Europe"], script: "latin" },
  { code: "ru",  nom: "Русский",        nomFr: "Russe",               sens: "ltr", locale: "ru-RU",  continents: ["Europe", "Asie"], script: "cyrillique" },
  { code: "pl",  nom: "Polski",         nomFr: "Polonais",            sens: "ltr", locale: "pl-PL",  continents: ["Europe"], script: "latin" },
  { code: "uk",  nom: "Українська",     nomFr: "Ukrainien",           sens: "ltr", locale: "uk-UA",  continents: ["Europe"], script: "cyrillique" },
  { code: "ro",  nom: "Română",         nomFr: "Roumain",             sens: "ltr", locale: "ro-RO",  continents: ["Europe"], script: "latin" },
  { code: "el",  nom: "Ελληνικά",       nomFr: "Grec",                sens: "ltr", locale: "el-GR",  continents: ["Europe"], script: "grec" },
  { code: "cs",  nom: "Čeština",        nomFr: "Tchèque",             sens: "ltr", locale: "cs-CZ",  continents: ["Europe"], script: "latin" },
  { code: "sv",  nom: "Svenska",        nomFr: "Suédois",             sens: "ltr", locale: "sv-SE",  continents: ["Europe"], script: "latin" },
  { code: "hu",  nom: "Magyar",         nomFr: "Hongrois",            sens: "ltr", locale: "hu-HU",  continents: ["Europe"], script: "latin" },

  /* ---------- Asie et Moyen-Orient ---------- */
  { code: "tr",  nom: "Türkçe",         nomFr: "Turc",                sens: "ltr", locale: "tr-TR",  continents: ["Asie", "Europe"], script: "latin" },
  { code: "ar",  nom: "العربية",         nomFr: "Arabe",               sens: "rtl", locale: "ar-001", continents: ["Asie", "Afrique"], script: "arabe" },
  { code: "he",  nom: "עברית",           nomFr: "Hébreu",              sens: "rtl", locale: "he-IL",  continents: ["Asie"], script: "hébreu" },
  { code: "fa",  nom: "فارسی",           nomFr: "Persan",              sens: "rtl", locale: "fa-IR",  continents: ["Asie"], script: "arabe" },
  { code: "ur",  nom: "اردو",            nomFr: "Ourdou",              sens: "rtl", locale: "ur-PK",  continents: ["Asie"], script: "arabe" },
  { code: "zh",  nom: "中文",            nomFr: "Chinois (mandarin)",  sens: "ltr", locale: "zh-CN",  continents: ["Asie"], script: "han" },
  { code: "ja",  nom: "日本語",           nomFr: "Japonais",            sens: "ltr", locale: "ja-JP",  continents: ["Asie"], script: "japonais" },
  { code: "ko",  nom: "한국어",           nomFr: "Coréen",              sens: "ltr", locale: "ko-KR",  continents: ["Asie"], script: "hangul" },
  { code: "hi",  nom: "हिन्दी",            nomFr: "Hindi",               sens: "ltr", locale: "hi-IN",  continents: ["Asie"], script: "devanagari" },
  { code: "bn",  nom: "বাংলা",           nomFr: "Bengali",             sens: "ltr", locale: "bn-BD",  continents: ["Asie"], script: "bengali" },
  { code: "ta",  nom: "தமிழ்",           nomFr: "Tamoul",              sens: "ltr", locale: "ta-IN",  continents: ["Asie"], script: "tamoul" },
  { code: "te",  nom: "తెలుగు",          nomFr: "Télougou",            sens: "ltr", locale: "te-IN",  continents: ["Asie"], script: "télougou" },
  { code: "mr",  nom: "मराठी",           nomFr: "Marathi",             sens: "ltr", locale: "mr-IN",  continents: ["Asie"], script: "devanagari" },
  { code: "vi",  nom: "Tiếng Việt",     nomFr: "Vietnamien",          sens: "ltr", locale: "vi-VN",  continents: ["Asie"], script: "latin" },
  { code: "th",  nom: "ไทย",             nomFr: "Thaï",                sens: "ltr", locale: "th-TH",  continents: ["Asie"], script: "thaï" },
  { code: "id",  nom: "Bahasa Indonesia", nomFr: "Indonésien",        sens: "ltr", locale: "id-ID",  continents: ["Asie"], script: "latin" },
  { code: "ms",  nom: "Bahasa Melayu",  nomFr: "Malais",              sens: "ltr", locale: "ms-MY",  continents: ["Asie"], script: "latin" },
  { code: "fil", nom: "Filipino",       nomFr: "Filipino",            sens: "ltr", locale: "fil-PH", continents: ["Asie"], script: "latin" },
  { code: "km",  nom: "ខ្មែរ",             nomFr: "Khmer",               sens: "ltr", locale: "km-KH",  continents: ["Asie"], script: "khmer" },
  { code: "ne",  nom: "नेपाली",           nomFr: "Népalais",            sens: "ltr", locale: "ne-NP",  continents: ["Asie"], script: "devanagari" },

  /* ---------- Afrique ---------- */
  { code: "sw",  nom: "Kiswahili",      nomFr: "Swahili",             sens: "ltr", locale: "sw-KE",  continents: ["Afrique"], script: "latin" },
  { code: "am",  nom: "አማርኛ",           nomFr: "Amharique",           sens: "ltr", locale: "am-ET",  continents: ["Afrique"], script: "guèze" },
  { code: "ha",  nom: "Hausa",          nomFr: "Haoussa",             sens: "ltr", locale: "ha-NG",  continents: ["Afrique"], script: "latin" },
  { code: "yo",  nom: "Yorùbá",         nomFr: "Yoruba",              sens: "ltr", locale: "yo-NG",  continents: ["Afrique"], script: "latin" },
  { code: "ig",  nom: "Igbo",           nomFr: "Igbo",                sens: "ltr", locale: "ig-NG",  continents: ["Afrique"], script: "latin" },
  { code: "zu",  nom: "isiZulu",        nomFr: "Zoulou",              sens: "ltr", locale: "zu-ZA",  continents: ["Afrique"], script: "latin" },
  { code: "af",  nom: "Afrikaans",      nomFr: "Afrikaans",           sens: "ltr", locale: "af-ZA",  continents: ["Afrique"], script: "latin" },
  { code: "so",  nom: "Soomaali",       nomFr: "Somali",              sens: "ltr", locale: "so-SO",  continents: ["Afrique"], script: "latin" },
  { code: "ln",  nom: "Lingála",        nomFr: "Lingala",             sens: "ltr", locale: "ln-CD",  continents: ["Afrique"], script: "latin" },
  { code: "rw",  nom: "Ikinyarwanda",   nomFr: "Kinyarwanda",         sens: "ltr", locale: "rw-RW",  continents: ["Afrique"], script: "latin" },
  { code: "mg",  nom: "Malagasy",       nomFr: "Malgache",            sens: "ltr", locale: "mg-MG",  continents: ["Afrique"], script: "latin" },

  /* ---------- Amériques ---------- */
  { code: "ht",  nom: "Kreyòl ayisyen", nomFr: "Créole haïtien",      sens: "ltr", locale: "ht-HT",  continents: ["Amériques"], script: "latin" },
  { code: "qu",  nom: "Runa Simi",      nomFr: "Quechua",             sens: "ltr", locale: "qu-PE",  continents: ["Amériques"], script: "latin" },

  /* ---------- Océanie ---------- */
  { code: "mi",  nom: "Te Reo Māori",   nomFr: "Maori",               sens: "ltr", locale: "mi-NZ",  continents: ["Océanie"], script: "latin" },
  { code: "tpi", nom: "Tok Pisin",      nomFr: "Tok pisin",           sens: "ltr", locale: "tpi-PG", continents: ["Océanie"], script: "latin" },
];

export const CODES_LANGUES = LANGUES.map(l => l.code);

const PAR_CODE = new Map(LANGUES.map(l => [l.code, l]));

export function langue(code) {
  return PAR_CODE.get(String(code || "").toLowerCase()) || null;
}

export function estRTL(code) {
  return langue(code)?.sens === "rtl";
}

// Regroupement par continent, pour le sélecteur de langue
export function parContinent() {
  const ordre = ["Afrique", "Amériques", "Asie", "Europe", "Océanie"];
  const groupes = new Map(ordre.map(c => [c, []]));
  for (const l of LANGUES) {
    // Une langue transcontinentale (arabe, anglais, français…) est proposée
    // dans chacun de ses continents : c'est là que l'utilisateur la cherche.
    for (const c of l.continents) {
      if (groupes.has(c)) groupes.get(c).push(l);
    }
  }
  for (const liste of groupes.values()) {
    liste.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }
  return groupes;
}

// Détermine la langue à utiliser au démarrage, par ordre de priorité :
// choix explicite mémorisé, puis préférences du navigateur, puis français.
export function detecterLangue(prefere = null) {
  if (prefere && PAR_CODE.has(prefere)) return prefere;
  const candidats = typeof navigator !== "undefined"
    ? [...(navigator.languages || []), navigator.language].filter(Boolean)
    : [];
  for (const brut of candidats) {
    const bas = String(brut).toLowerCase();
    if (PAR_CODE.has(bas)) return bas;
    // « fr-CA » doit retrouver « fr », « zh-Hant » doit retrouver « zh »
    const base = bas.split("-")[0];
    if (PAR_CODE.has(base)) return base;
  }
  return "fr";
}

// Langue de correspondance pour un patient : on accepte un code approximatif
// (saisie libre, import depuis un autre système) et on retombe sur la langue
// de l'établissement si rien ne correspond.
export function langueSure(code, defaut = "fr") {
  if (!code) return defaut;
  const bas = String(code).toLowerCase().trim();
  if (PAR_CODE.has(bas)) return bas;
  const base = bas.split(/[-_]/)[0];
  if (PAR_CODE.has(base)) return base;
  // Recherche par endonyme ou par nom français, tolérante à la casse
  const trouve = LANGUES.find(l =>
    l.nom.toLowerCase() === bas || l.nomFr.toLowerCase() === bas);
  return trouve ? trouve.code : defaut;
}
