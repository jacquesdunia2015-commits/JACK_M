/**
 * Langues prises en charge par l'interface.
 *
 * `revue` indique si la traduction a été relue par une personne dont
 * c'est la langue maternelle. Les traductions non relues sont utilisables
 * — mieux vaut une phrase perfectible dans sa langue qu'une phrase
 * parfaite dans une langue qu'on ne lit pas — mais l'interface le signale
 * honnêtement plutôt que de laisser croire à un travail achevé.
 */
export interface Langue {
  code: string;
  nom: string;
  nomLocal: string;
  direction: 'ltr' | 'rtl';
  revue: boolean;
}

export const LANGUES: Langue[] = [
  { code: 'fr',    nom: 'Français',            nomLocal: 'Français',    direction: 'ltr', revue: true },
  { code: 'en',    nom: 'Anglais',             nomLocal: 'English',     direction: 'ltr', revue: true },
  { code: 'es',    nom: 'Espagnol',            nomLocal: 'Español',     direction: 'ltr', revue: true },
  { code: 'de',    nom: 'Allemand',            nomLocal: 'Deutsch',     direction: 'ltr', revue: true },
  { code: 'pt',    nom: 'Portugais',           nomLocal: 'Português',   direction: 'ltr', revue: true },
  { code: 'ar',    nom: 'Arabe',               nomLocal: 'العربية',      direction: 'rtl', revue: false },
  { code: 'zh',    nom: 'Chinois',             nomLocal: '中文',         direction: 'ltr', revue: false },
  { code: 'hi',    nom: 'Hindi',               nomLocal: 'हिन्दी',        direction: 'ltr', revue: false },
  { code: 'sw',    nom: 'Kiswahili',           nomLocal: 'Kiswahili',   direction: 'ltr', revue: false },
  { code: 'sw-CD', nom: 'Kiswahili (RD Congo)', nomLocal: 'Kiswahili ya Kongo', direction: 'ltr', revue: false },
  { code: 'ln',    nom: 'Lingala',             nomLocal: 'Lingála',     direction: 'ltr', revue: false },
  { code: 'rw',    nom: 'Kinyarwanda',         nomLocal: 'Ikinyarwanda', direction: 'ltr', revue: false },
  { code: 'rn',    nom: 'Kirundi',             nomLocal: 'Ikirundi',    direction: 'ltr', revue: false },
  { code: 'wo',    nom: 'Wolof',               nomLocal: 'Wolof',       direction: 'ltr', revue: false },
  { code: 'bm',    nom: 'Bambara',             nomLocal: 'Bamanankan',  direction: 'ltr', revue: false },
];

export const LANGUE_PAR_DEFAUT = 'fr';

export function trouverLangue(code: string | undefined): Langue {
  return (
    LANGUES.find((l) => l.code === code) ??
    LANGUES.find((l) => l.code === LANGUE_PAR_DEFAUT)!
  );
}
