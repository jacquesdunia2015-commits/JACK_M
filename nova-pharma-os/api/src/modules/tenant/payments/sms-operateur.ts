/**
 * Lecture des SMS de confirmation Mobile Money (M-Pesa, Orange Money,
 * Airtel Money, Afrimoney). Les opérateurs changent leurs formulations :
 * la lecture cherche des repères (montant suivi d'une devise, numéro,
 * mot « ID » ou « Réf. » suivi d'un code) plutôt qu'un modèle exact. Ce
 * qui n'est pas trouvé reste vide : la saisie manuelle prend le relais.
 */

export interface SmsLu {
  operator: string | null;
  direction: 'received' | 'sent' | null;
  amount: number | null;
  currency: string | null;
  phone: string | null;
  transactionId: string | null;
}

const OPERATEURS: [RegExp, string][] = [
  [/m-?pesa|vodacom/i, 'mpesa'],
  [/orange\s*money|\borange\b/i, 'orange'],
  [/airtel/i, 'airtel'],
  [/afri\s*money|africell/i, 'afrimoney'],
];

/** « 25.000,50 », « 25,000.50 », « 25 000 » → nombre. */
export function lireMontant(brut: string): number | null {
  let t = brut.replace(/[\s  ]/g, '');
  const point = t.lastIndexOf('.');
  const virgule = t.lastIndexOf(',');
  if (point >= 0 && virgule >= 0) {
    // Le dernier séparateur est la décimale.
    const dec = point > virgule ? '.' : ',';
    t = t.replace(dec === '.' ? /,/g : /\./g, '').replace(dec, '.');
  } else if (virgule >= 0 || point >= 0) {
    const sep = virgule >= 0 ? ',' : '.';
    const apres = t.length - t.lastIndexOf(sep) - 1;
    const occurrences = t.split(sep).length - 1;
    // « 25,000 » ou « 1.250.000 » : séparateur de milliers ; « 12,5 » : décimale.
    t = occurrences > 1 || apres === 3 ? t.split(sep).join('') : t.replace(sep, '.');
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const DEVISE: Record<string, string> = { CDF: 'CDF', FC: 'CDF', FRANCS: 'CDF', FRANC: 'CDF', USD: 'USD', $: 'USD', DOLLARS: 'USD' };

export function lireSmsOperateur(texte: string): SmsLu {
  const t = (texte ?? '').replace(/\s+/g, ' ').trim();
  const operator = OPERATEURS.find(([re]) => re.test(t))?.[1] ?? null;

  const direction = /\b(re[çc]u|received|cr[ée]dit[ée]|depot|dépôt|vous avez re)/i.test(t)
    ? 'received'
    : /\b(envoy[ée]|sent|transf[ée]r[ée] [àa]|pay[ée] [àa]|retrait)/i.test(t) ? 'sent' : null;

  // Montant : « 25 000 FC », « CDF 25,000.00 », « 10.50 USD », « $10.50 ».
  let amount: number | null = null;
  let currency: string | null = null;
  // Groupes de milliers de 3 chiffres exactement : un numéro de téléphone voisin n'est pas avalé.
  const NOMBRE = String.raw`(\d{1,3}(?:[\s.,\u00a0]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
  const apres = t.match(new RegExp(String.raw`${NOMBRE}\s?(CDF|FC|USD|\$|francs?|dollars)(?![A-Za-z])`, 'i'));
  const avant = t.match(new RegExp(String.raw`(CDF|FC|USD|\$)\s?${NOMBRE}`, 'i'));
  if (apres) { amount = lireMontant(apres[1]); currency = DEVISE[apres[2].toUpperCase()] ?? null; }
  else if (avant) { amount = lireMontant(avant[2]); currency = DEVISE[avant[1].toUpperCase()] ?? null; }

  // Numéro du payeur : forme congolaise (243 ou 0, puis 9 chiffres).
  const tel = t.match(/(?:\+?243|\b0)[\s.-]?(\d{2})[\s.-]?(\d{3})[\s.-]?(\d{4})\b/);
  const phone = tel ? `+243${tel[1]}${tel[2]}${tel[3]}` : null;

  // Identifiant de transaction : après « ID », « Réf. », « Trans ID »… ou en tête (style M-Pesa).
  const id =
    t.match(/(?:ID(?:\s*de)?\s*(?:la\s*)?transaction|trans(?:action)?\s*id|txn\s*id|r[ée]f(?:[ée]rence)?\.?|\bID)\s*[:#°n.]*\s*([A-Z0-9][A-Z0-9.\-]{4,})/i) ??
    t.match(/^([A-Z0-9]{8,14})\b(?=.*(?:confirm|re[çc]u))/i);
  const transactionId = id ? id[1].replace(/[.\-]+$/, '').toUpperCase() : null;

  return { operator, direction, amount, currency, phone, transactionId };
}
