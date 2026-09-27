/**
 * Pays pris en charge et monnaie locale de chacun (ISO 3166 → ISO 4217).
 * Copie conforme de web/src/lib/geo.ts (un test vérifie qu'elles concordent).
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

/** Monnaies acceptées : celles des pays, plus le dollar et l'euro. */
export const CURRENCIES = [...new Set(['USD', 'EUR', ...Object.values(COUNTRY_CURRENCY)])].sort() as [string, ...string[]];
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY).sort() as [string, ...string[]];
