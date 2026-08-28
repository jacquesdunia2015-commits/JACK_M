import { cookies } from 'next/headers';
import { ar } from './dictionnaires/ar';
import { bm } from './dictionnaires/bm';
import { de } from './dictionnaires/de';
import { en } from './dictionnaires/en';
import { es } from './dictionnaires/es';
import { fr, type CleTraduction, type Dictionnaire } from './dictionnaires/fr';
import { hi } from './dictionnaires/hi';
import { ln } from './dictionnaires/ln';
import { pt } from './dictionnaires/pt';
import { rn } from './dictionnaires/rn';
import { rw } from './dictionnaires/rw';
import { sw } from './dictionnaires/sw';
import { swCD } from './dictionnaires/sw-CD';
import { wo } from './dictionnaires/wo';
import { zh } from './dictionnaires/zh';
import { LANGUE_PAR_DEFAUT, trouverLangue, type Langue } from './langues';

export type { CleTraduction, Dictionnaire };
export { LANGUES, LANGUE_PAR_DEFAUT, trouverLangue } from './langues';
export type { Langue } from './langues';

export const COOKIE_LANGUE = 'nova_langue';

const DICTIONNAIRES: Record<string, Dictionnaire> = {
  fr,
  en,
  es,
  de,
  pt,
  ar,
  zh,
  hi,
  sw,
  'sw-CD': swCD,
  ln,
  rw,
  rn,
  wo,
  bm,
};

export type Traduire = (cle: CleTraduction) => string;

/**
 * Construit la fonction de traduction pour une langue donnée.
 *
 * Le repli sur le français n'est pas une politesse : les dictionnaires
 * sont typés d'après le français, donc aucune clé ne peut manquer à la
 * compilation. Le repli ne couvre que le cas où un code de langue
 * inconnu arriverait par le cookie — un navigateur, un proxy ou une
 * ancienne session peuvent en envoyer un.
 */
export function traducteurPour(code: string | undefined): {
  t: Traduire;
  langue: Langue;
} {
  const langue = trouverLangue(code);
  const dico = DICTIONNAIRES[langue.code] ?? DICTIONNAIRES[LANGUE_PAR_DEFAUT];
  return { langue, t: (cle) => dico[cle] ?? fr[cle] };
}

/** Langue choisie par la personne connectée, lue depuis le cookie. */
export async function langueActive(): Promise<Langue> {
  const store = await cookies();
  return trouverLangue(store.get(COOKIE_LANGUE)?.value);
}

/** Raccourci pour les composants serveur : `const { t } = await traduire();` */
export async function traduire(): Promise<{ t: Traduire; langue: Langue }> {
  const store = await cookies();
  return traducteurPour(store.get(COOKIE_LANGUE)?.value);
}

/** Libellés du formulaire de connexion, qui est un composant client. */
export function libellesConnexion(t: Traduire) {
  return {
    email: t('connexion.email'),
    motDePasse: t('connexion.mot_de_passe'),
    identifiant: t('connexion.identifiant_pharmacie'),
    facultatif: t('connexion.facultatif'),
    aideIdentifiant: t('connexion.aide_identifiant'),
    bouton: t('connexion.bouton'),
    enCours: t('connexion.en_cours'),
    echec: t('connexion.echec'),
    serviceInjoignable: t('connexion.service_injoignable'),
  };
}
