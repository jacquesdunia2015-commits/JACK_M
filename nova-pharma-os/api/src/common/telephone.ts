import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Numéros de téléphone : une seule règle pour toute l'application.
 *
 * On reçoit des numéros écrits de toutes les façons — « 0991 234 567 »,
 * « +243 991-234-567 », « 00243991234567 ». Ils doivent tous désigner le
 * même abonné, qu'on les enregistre sur un compte ou qu'on y envoie un
 * message WhatsApp.
 */

/**
 * Indicatifs des pays d'où viennent, le plus souvent, les fournisseurs des
 * pharmacies de la région des Grands Lacs. Un numéro national (« 0772… »)
 * d'un dépôt de Kampala doit recevoir +256, pas l'indicatif de la pharmacie.
 */
export const INDICATIFS_PAYS: Record<string, string> = {
  CD: '+243', CG: '+242', RW: '+250', BI: '+257', UG: '+256', TZ: '+255',
  KE: '+254', ZM: '+260', AO: '+244', CF: '+236', SS: '+211', CM: '+237',
  ZA: '+27', NG: '+234', SN: '+221', CI: '+225', ML: '+223', MA: '+212',
  EG: '+20', AE: '+971', IN: '+91', CN: '+86', BE: '+32', FR: '+33',
  DE: '+49', NL: '+31', CH: '+41', GB: '+44', US: '+1',
};

/**
 * Chiffres internationaux d'un numéro, sans le « + » : 243991234567.
 *
 * Un numéro qui commence par 0 est un numéro national : le 0 tombe au
 * profit de l'indicatif du pays (+243 par défaut, la RD Congo).
 */
export function chiffresTelephone(
  brut: string | null | undefined,
  indicatifParDefaut = '+243',
): string | null {
  if (!brut) return null;
  const chiffres = brut.replace(/[^\d+]/g, '');
  if (!chiffres) return null;

  const indicatif = indicatifParDefaut.replace(/\D/g, '');
  if (chiffres.startsWith('+')) return chiffres.slice(1);
  if (chiffres.startsWith('00')) return chiffres.slice(2);
  // Un zéro initial est le zéro national : il tombe au profit de l'indicatif.
  if (chiffres.startsWith('0')) return indicatif + chiffres.slice(1);
  if (chiffres.startsWith(indicatif)) return chiffres;
  return indicatif + chiffres;
}

/**
 * Numéro au format international (+243991234567), ou null s'il ne peut
 * pas en être un.
 *
 * Un numéro international compte au plus 15 chiffres ; en dessous de 8,
 * ce n'est pas un numéro joignable. Mieux vaut refuser à la création
 * qu'enregistrer un numéro qu'on ne pourra jamais appeler.
 */
export function normaliserTelephone(
  brut: string | null | undefined,
  indicatifParDefaut = '+243',
): string | null {
  const chiffres = chiffresTelephone(brut, indicatifParDefaut);
  if (!chiffres || !/^\d{8,15}$/.test(chiffres)) return null;
  return `+${chiffres}`;
}

/**
 * Validation d'un champ téléphone dans une requête.
 *
 * Le contrôle se fait avec l'indicatif de la RD Congo ; le service
 * renormalise ensuite avec celui du pays de la pharmacie. Le nombre de
 * chiffres ne dépend pas de l'indicatif retenu, ce qui suffit à écarter
 * les saisies qui ne peuvent pas être un numéro.
 */
export function EstTelephone(options?: ValidationOptions) {
  return (objet: object, propriete: string) =>
    registerDecorator({
      name: 'estTelephone',
      target: objet.constructor,
      propertyName: propriete,
      options: {
        message:
          'Numéro de téléphone invalide : indiquez-le avec l’indicatif du pays ' +
          '(+243…) ou en commençant par 0.',
        ...options,
      },
      validator: {
        validate: (valeur: unknown) =>
          typeof valeur === 'string' && normaliserTelephone(valeur) !== null,
      },
    });
}
