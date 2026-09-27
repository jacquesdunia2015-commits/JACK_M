import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fr, type Key } from './locales/fr';
import { DEFAULT_LANGUAGE, detectLanguage, findLanguage, type Language } from './languages';
import { setFormatLocale } from '../lib/format';
import { setErrorTranslator } from '../lib/api';

export type Dict = Partial<Record<Key, string>>;
export type Vars = Record<string, string | number | null | undefined>;
export type T = (key: Key, vars?: Vars) => string;

// Chaque langue est un fichier séparé, chargé à la demande (le français est inclus : c'est le repli).
const loaders = import.meta.glob<{ default: Dict }>(['./locales/*.ts', '!./locales/fr.ts']);

const STORAGE_KEY = 'locagest.lang';
function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function interpolate(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Traducteur : langue choisie, puis français pour toute clé absente. */
export function makeT(dict: Dict): T {
  return (key, vars) => interpolate(dict[key] ?? fr[key] ?? key, vars);
}

interface I18nState {
  lang: Language;
  t: T;
  setLang: (code: string) => void;
}
const I18nContext = createContext<I18nState>({
  lang: findLanguage(DEFAULT_LANGUAGE)!,
  t: makeT(fr),
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState(() => (findLanguage(stored()) ? stored()! : detectLanguage()));
  const [dict, setDict] = useState<Dict>(fr);
  const lang = findLanguage(code) ?? findLanguage(DEFAULT_LANGUAGE)!;

  useEffect(() => {
    let alive = true;
    const load = code === 'fr' ? Promise.resolve({ default: fr }) : loaders[`./locales/${code}.ts`]?.();
    (load ?? Promise.resolve({ default: fr })).then((m) => alive && setDict(m.default));
    return () => {
      alive = false;
    };
  }, [code]);

  const t = useMemo(() => makeT(dict), [dict]);

  // Réglés pendant le rendu (et non dans un effet) : les enfants rendus juste
  // après formatent déjà dates, montants et erreurs dans la bonne langue.
  setFormatLocale(lang.intl);
  setErrorTranslator((errCode, vars) => {
    if (errCode === 'not_found') return t('errors.not_found', { entity: t(`entity.${vars?.entity ?? 'resource'}` as Key) });
    const key = `errors.${errCode}` as Key;
    return key in fr ? t(key, vars) : null;
  });

  useEffect(() => {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir;
  }, [lang]);

  const setLang = useCallback((next: string) => {
    if (!findLanguage(next)) return;
    setCode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* navigation privée */
    }
  }, []);

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
