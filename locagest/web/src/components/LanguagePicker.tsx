import { useI18n } from '../i18n';
import { LANGUAGES } from '../i18n/languages';

/** Choix de la langue ; les traductions non relues par un locuteur portent la marque ✎. */
export function LanguagePicker({ onChange, className = '' }: { onChange?: (code: string) => void; className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={className}>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span aria-hidden>🌐</span>
        <span className="sr-only">{t('lang.label')}</span>
        <select
          className="input py-1.5"
          value={lang.code}
          onChange={(e) => {
            setLang(e.target.value);
            onChange?.(e.target.value);
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
              {l.reviewed ? '' : ' ✎'}
            </option>
          ))}
        </select>
      </label>
      {!lang.reviewed && <p className="mt-1 text-xs text-slate-500">✎ {t('lang.unreviewed')}</p>}
    </div>
  );
}
