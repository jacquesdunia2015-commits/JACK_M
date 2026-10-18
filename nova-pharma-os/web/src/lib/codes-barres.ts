/**
 * Dessin des codes-barres pour les étiquettes : EAN-13 (et UPC-A, EAN-8)
 * pour les codes du commerce et les codes internes « 29… », Code 128 pour
 * tout autre code. Le résultat est une suite de modules (1 = barre,
 * 0 = espace) que l'étiquette transforme en SVG.
 */

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Chiffre de contrôle GS1 des chiffres donnés (sans le chiffre de contrôle). */
export function chiffreControle(chiffres: string): number {
  let somme = 0;
  for (let i = chiffres.length - 1, poids = 3; i >= 0; i--, poids = 4 - poids) somme += Number(chiffres[i]) * poids;
  return (10 - (somme % 10)) % 10;
}

export const gs1Valide = (code: string) =>
  /^\d+$/.test(code) && [8, 12, 13].includes(code.length) && chiffreControle(code.slice(0, -1)) === Number(code.slice(-1));

function ean13(code: string): string {
  const d = code.split('').map(Number);
  const parite = PARITE[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parite[i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + '101';
}

function ean8(code: string): string {
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += L[d[i]];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += R[d[i]];
  return bits + '101';
}

// Code 128 : largeurs barre/espace de chaque valeur (0 à 106).
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function largeursVersBits(largeurs: string): string {
  return largeurs.split('').map((w, i) => (i % 2 === 0 ? '1' : '0').repeat(Number(w))).join('');
}

/** Code 128, jeu B (caractères ASCII imprimables). */
function code128(texte: string): string {
  const valeurs = [104];
  for (const c of texte) {
    const v = c.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error('Caractère non imprimable en Code 128 B');
    valeurs.push(v);
  }
  const controle = valeurs.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103;
  valeurs.push(controle, 106);
  return valeurs.map((v) => largeursVersBits(C128[v])).join('');
}

export interface DessinCode {
  bits: string;
  format: 'ean13' | 'ean8' | 'code128';
  /** Texte lisible sous les barres. */
  texte: string;
}

/** Modules à dessiner pour un code donné, dans le format qui lui convient. */
export function dessiner(code: string): DessinCode {
  if (gs1Valide(code)) {
    if (code.length === 13) return { bits: ean13(code), format: 'ean13', texte: code };
    if (code.length === 12) return { bits: ean13(`0${code}`), format: 'ean13', texte: code };
    return { bits: ean8(code), format: 'ean8', texte: code };
  }
  return { bits: code128(code), format: 'code128', texte: code };
}
