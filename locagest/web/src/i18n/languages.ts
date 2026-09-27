/**
 * Langues de l'interface. `reviewed` : traduction relue par un locuteur ; les
 * autres sont marquées « à relire » dans le sélecteur. `intl` sert au format
 * des dates et des nombres. Garder la liste alignée sur server/src/lib/locales.ts.
 */
export interface Language {
  code: string;
  name: string; // nom dans la langue elle-même
  french: string; // nom en français
  dir: 'ltr' | 'rtl';
  intl: string;
  reviewed: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français', french: 'Français', dir: 'ltr', intl: 'fr-FR', reviewed: true },
  { code: 'en', name: 'English', french: 'Anglais', dir: 'ltr', intl: 'en-GB', reviewed: true },
  // Langues nationales de la RDC
  { code: 'ln', name: 'Lingála', french: 'Lingala', dir: 'ltr', intl: 'fr-CD', reviewed: false },
  { code: 'sw', name: 'Kiswahili', french: 'Swahili', dir: 'ltr', intl: 'sw', reviewed: false },
  { code: 'kg', name: 'Kikongo', french: 'Kikongo', dir: 'ltr', intl: 'fr-CD', reviewed: false },
  { code: 'lua', name: 'Tshiluba', french: 'Tshiluba', dir: 'ltr', intl: 'fr-CD', reviewed: false },
  // Afrique centrale, de l'Est et de l'Ouest
  { code: 'rw', name: 'Ikinyarwanda', french: 'Kinyarwanda', dir: 'ltr', intl: 'rw', reviewed: false },
  { code: 'rn', name: 'Ikirundi', french: 'Kirundi', dir: 'ltr', intl: 'fr-BI', reviewed: false },
  { code: 'bm', name: 'Bamanankan', french: 'Bambara', dir: 'ltr', intl: 'fr-ML', reviewed: false },
  { code: 'wo', name: 'Wolof', french: 'Wolof', dir: 'ltr', intl: 'fr-SN', reviewed: false },
  { code: 'ha', name: 'Hausa', french: 'Haoussa', dir: 'ltr', intl: 'ha', reviewed: false },
  { code: 'yo', name: 'Yorùbá', french: 'Yoruba', dir: 'ltr', intl: 'yo', reviewed: false },
  { code: 'am', name: 'አማርኛ', french: 'Amharique', dir: 'ltr', intl: 'am', reviewed: false },
  // Autres langues
  { code: 'ar', name: 'العربية', french: 'Arabe', dir: 'rtl', intl: 'ar-u-nu-latn', reviewed: false },
  { code: 'es', name: 'Español', french: 'Espagnol', dir: 'ltr', intl: 'es-ES', reviewed: false },
  { code: 'pt', name: 'Português', french: 'Portugais', dir: 'ltr', intl: 'pt-PT', reviewed: false },
  { code: 'it', name: 'Italiano', french: 'Italien', dir: 'ltr', intl: 'it-IT', reviewed: false },
  { code: 'de', name: 'Deutsch', french: 'Allemand', dir: 'ltr', intl: 'de-DE', reviewed: false },
  { code: 'nl', name: 'Nederlands (Vlaams)', french: 'Néerlandais / flamand', dir: 'ltr', intl: 'nl-BE', reviewed: false },
  { code: 'nb', name: 'Norsk', french: 'Norvégien', dir: 'ltr', intl: 'nb-NO', reviewed: false },
  { code: 'zh', name: '中文（简体）', french: 'Chinois (mandarin)', dir: 'ltr', intl: 'zh-CN', reviewed: false },
  { code: 'hi', name: 'हिन्दी', french: 'Hindi', dir: 'ltr', intl: 'hi-IN', reviewed: false },
];

export const DEFAULT_LANGUAGE = 'fr';

export function findLanguage(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/** Langue du navigateur si elle est proposée, sinon le français. */
export function detectLanguage(): string {
  const prefs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const base = p.toLowerCase().split('-')[0];
    const code = base === 'no' || base === 'nn' ? 'nb' : base;
    if (findLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
