import { describe, expect, it } from 'vitest';
import { fr } from './locales/fr';
import { LANGUAGES } from './languages';
import { LOCALES } from '../../../server/src/lib/locales';
import { interpolate, makeT } from './index';

const files = import.meta.glob<{ default: Record<string, string> }>('./locales/*.ts', { eager: true });
const dicts = Object.fromEntries(Object.entries(files).map(([p, m]) => [p.replace(/^.*\/(.*)\.ts$/, '$1'), m.default]));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('traductions', () => {
  it('chaque langue proposée a son fichier, et la liste est celle du serveur', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual([...LOCALES].sort());
    expect(Object.keys(dicts).sort()).toEqual(LANGUAGES.map((l) => l.code).sort());
  });

  for (const lang of LANGUAGES.filter((l) => l.code !== 'fr')) {
    it(`${lang.code} (${lang.french}) : toutes les clés, mêmes valeurs insérées, aucun texte vide`, () => {
      const d = dicts[lang.code];
      expect(Object.keys(d).sort()).toEqual(Object.keys(fr).sort());
      for (const [k, v] of Object.entries(fr)) {
        expect(d[k]?.trim(), `${lang.code} ${k} vide`).toBeTruthy();
        expect(placeholders(d[k]), `${lang.code} ${k}`).toEqual(placeholders(v));
      }
    });
  }

  it('insère les valeurs et se replie sur le français', () => {
    expect(interpolate('Bonjour {name}', { name: 'Awa' })).toBe('Bonjour Awa');
    const t = makeT({ 'nav.properties': 'Properties' });
    expect(t('nav.properties')).toBe('Properties');
    expect(t('nav.tenants')).toBe('Locataires');
    expect(t('errors.not_found', { entity: 'Bail' })).toBe('Bail introuvable.');
  });
});
