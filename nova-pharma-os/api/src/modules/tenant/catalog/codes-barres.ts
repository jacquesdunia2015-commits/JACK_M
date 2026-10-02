import { BusinessRuleException } from '../../../common/http/exceptions';

/** Chiffre de contrôle GS1 (EAN-8, UPC-A, EAN-13, GTIN-14) des chiffres donnés. */
export function chiffreControle(chiffres: string): number {
  let somme = 0;
  // De droite à gauche : poids 3, 1, 3, 1…
  for (let i = chiffres.length - 1, poids = 3; i >= 0; i--, poids = 4 - poids) {
    somme += Number(chiffres[i]) * poids;
  }
  return (10 - (somme % 10)) % 10;
}

/**
 * Normalise et contrôle un code-barres saisi ou scanné. Les codes GS1
 * numériques (8, 12, 13 ou 14 chiffres) doivent avoir un chiffre de contrôle
 * juste : une faute de frappe est refusée plutôt qu'enregistrée.
 */
export function codeValide(brut: string): { code: string; kind: string } {
  const code = (brut ?? '').trim().replace(/\s+/g, '');
  if (!/^[0-9A-Za-z\-.$/+%]{4,48}$/.test(code)) {
    throw new BusinessRuleException(`Code-barres invalide : « ${brut} ».`);
  }
  if (/^\d+$/.test(code) && [8, 12, 13, 14].includes(code.length)) {
    if (chiffreControle(code.slice(0, -1)) !== Number(code.slice(-1))) {
      throw new BusinessRuleException(
        `Code-barres ${code} : le dernier chiffre (contrôle) ne correspond pas. Vérifiez la saisie ou scannez-le.`,
      );
    }
    const kind = { 8: 'ean8', 12: 'upca', 13: 'ean13', 14: 'gtin14' }[code.length as 8 | 12 | 13 | 14];
    return { code, kind };
  }
  return { code, kind: 'autre' };
}

/**
 * Code interne pour un produit sans code-barres : EAN-13 du préfixe GS1
 * « 29 », réservé à l'usage interne d'un magasin — il ne peut pas
 * correspondre à un produit du commerce.
 */
export function codeInterne(numero: number): string {
  const corps = `29${String(numero).padStart(10, '0')}`;
  return corps + chiffreControle(corps);
}
