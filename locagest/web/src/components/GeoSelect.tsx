import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { currencyName, orderedCurrencies, sortedCountries } from '../lib/geo';

/** Liste des pays, nommés dans la langue de l'interface. */
export function CountrySelect({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const { lang, t } = useI18n();
  const countries = useMemo(() => sortedCountries(lang.intl), [lang.intl]);
  return (
    <select className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('geo.chooseCountry')}</option>
      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  );
}

/** Liste des monnaies (code + nom local), la monnaie préférée en tête. */
export function CurrencySelect({ value, onChange, preferred }: { value: string; onChange: (v: string) => void; preferred?: string | null }) {
  const { lang } = useI18n();
  const list = useMemo(() => orderedCurrencies(preferred), [preferred]);
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((c) => <option key={c} value={c}>{c} — {currencyName(c, lang.intl)}</option>)}
    </select>
  );
}
