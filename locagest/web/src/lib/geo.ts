/**
 * Pays pris en charge et monnaie locale de chacun (ISO 3166 → ISO 4217).
 * Copie conforme de server/src/lib/geo.ts (un test vérifie qu'elles concordent).
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  // Afrique centrale
  CD: 'CDF', CG: 'XAF', CM: 'XAF', GA: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF', AO: 'AOA', ST: 'STN',
  // Afrique de l'Est et des Grands Lacs
  RW: 'RWF', BI: 'BIF', UG: 'UGX', KE: 'KES', TZ: 'TZS', ET: 'ETB', SS: 'SSP', SO: 'SOS', DJ: 'DJF', ER: 'ERN',
  // Afrique de l'Ouest
  SN: 'XOF', ML: 'XOF', CI: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF', GN: 'GNF', NG: 'NGN',
  GH: 'GHS', LR: 'LRD', SL: 'SLE', GM: 'GMD', MR: 'MRU', CV: 'CVE',
  // Afrique australe et océan Indien
  ZA: 'ZAR', ZM: 'ZMW', ZW: 'USD', MZ: 'MZN', MW: 'MWK', NA: 'NAD', BW: 'BWP', MG: 'MGA', MU: 'MUR', KM: 'KMF',
  // Afrique du Nord et monde arabe
  MA: 'MAD', DZ: 'DZD', TN: 'TND', EG: 'EGP', LY: 'LYD', SD: 'SDG', SA: 'SAR', AE: 'AED', QA: 'QAR', LB: 'LBP', JO: 'JOD',
  // Europe
  FR: 'EUR', BE: 'EUR', LU: 'EUR', DE: 'EUR', AT: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', IE: 'EUR',
  CH: 'CHF', GB: 'GBP', NO: 'NOK', SE: 'SEK', DK: 'DKK',
  // Amériques
  US: 'USD', CA: 'CAD', BR: 'BRL', MX: 'MXN', HT: 'HTG',
  // Asie
  CN: 'CNY', IN: 'INR', JP: 'JPY',
};

export const CURRENCIES = [...new Set(['USD', 'EUR', ...Object.values(COUNTRY_CURRENCY)])].sort();

/** Fuseau horaire du navigateur → pays (détection sans service externe). */
const TZ_COUNTRY: Record<string, string> = {
  'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD', 'Africa/Brazzaville': 'CG', 'Africa/Douala': 'CM',
  'Africa/Libreville': 'GA', 'Africa/Ndjamena': 'TD', 'Africa/Bangui': 'CF', 'Africa/Malabo': 'GQ', 'Africa/Luanda': 'AO',
  'Africa/Sao_Tome': 'ST', 'Africa/Kigali': 'RW', 'Africa/Bujumbura': 'BI', 'Africa/Kampala': 'UG', 'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ', 'Africa/Addis_Ababa': 'ET', 'Africa/Juba': 'SS', 'Africa/Mogadishu': 'SO',
  'Africa/Djibouti': 'DJ', 'Africa/Asmara': 'ER', 'Africa/Dakar': 'SN', 'Africa/Bamako': 'ML', 'Africa/Abidjan': 'CI',
  'Africa/Ouagadougou': 'BF', 'Africa/Porto-Novo': 'BJ', 'Africa/Lome': 'TG', 'Africa/Niamey': 'NE', 'Africa/Bissau': 'GW',
  'Africa/Conakry': 'GN', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Monrovia': 'LR', 'Africa/Freetown': 'SL',
  'Africa/Banjul': 'GM', 'Africa/Nouakchott': 'MR', 'Atlantic/Cape_Verde': 'CV', 'Africa/Johannesburg': 'ZA',
  'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW', 'Africa/Maputo': 'MZ', 'Africa/Blantyre': 'MW', 'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW', 'Indian/Antananarivo': 'MG', 'Indian/Mauritius': 'MU', 'Indian/Comoro': 'KM',
  'Africa/Casablanca': 'MA', 'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN', 'Africa/Cairo': 'EG', 'Africa/Tripoli': 'LY',
  'Africa/Khartoum': 'SD', 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Beirut': 'LB', 'Asia/Amman': 'JO',
  'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/Luxembourg': 'LU', 'Europe/Berlin': 'DE', 'Europe/Vienna': 'AT',
  'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE',
  'Europe/Zurich': 'CH', 'Europe/London': 'GB', 'Europe/Oslo': 'NO', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
  'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA', 'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX', 'America/Port-au-Prince': 'HT', 'Asia/Shanghai': 'CN', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Tokyo': 'JP',
};

/** Pays le plus probable pour chaque langue, quand le fuseau horaire ne suffit pas. */
const LANG_COUNTRY: Record<string, string> = {
  fr: 'FR', en: 'US', ln: 'CD', sw: 'TZ', kg: 'CD', lua: 'CD', rw: 'RW', rn: 'BI', bm: 'ML', wo: 'SN', ha: 'NG',
  yo: 'NG', am: 'ET', ar: 'SA', es: 'ES', pt: 'PT', it: 'IT', de: 'DE', nl: 'BE', nb: 'NO', zh: 'CN', hi: 'IN',
};

/** Pays de l'utilisateur : fuseau horaire, puis région de la langue du navigateur, puis langue de l'interface. */
export function detectCountry(lang: string): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  } catch {
    /* fuseau inconnu */
  }
  for (const l of typeof navigator !== 'undefined' ? navigator.languages ?? [] : []) {
    const region = l.split('-')[1]?.toUpperCase();
    if (region && COUNTRY_CURRENCY[region]) return region;
  }
  return LANG_COUNTRY[lang] ?? null;
}

export const currencyOf = (country: string | null | undefined) => (country && COUNTRY_CURRENCY[country]) || 'USD';

function displayNames(locale: string, type: 'region' | 'currency') {
  try {
    return new Intl.DisplayNames([locale, 'fr'], { type });
  } catch {
    return null;
  }
}

/** Nom du pays dans la langue de l'interface (données du navigateur). */
export function countryName(code: string, locale: string) {
  return displayNames(locale, 'region')?.of(code) ?? code;
}

export function currencyName(code: string, locale: string) {
  return displayNames(locale, 'currency')?.of(code) ?? code;
}

/** Pays triés par nom dans la langue de l'interface. */
export function sortedCountries(locale: string) {
  return Object.keys(COUNTRY_CURRENCY)
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Monnaies, la préférée en tête, puis dollar et euro, puis les autres par code. */
export function orderedCurrencies(preferred?: string | null) {
  const head = [preferred, 'USD', 'EUR'].filter((c, i, a): c is string => !!c && a.indexOf(c) === i);
  return [...head, ...CURRENCIES.filter((c) => !head.includes(c))];
}
