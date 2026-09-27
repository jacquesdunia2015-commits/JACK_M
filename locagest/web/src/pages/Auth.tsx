import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field } from '../components/ui';
import { LanguagePicker } from '../components/LanguagePicker';
import { CountrySelect, CurrencySelect } from '../components/GeoSelect';
import { currencyOf, detectCountry } from '../lib/geo';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="h-14 w-14" />
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">LocaGest</h1>
          <p className="text-sm text-slate-500">{t('auth.tagline')}</p>
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          {children}
        </div>
        <LanguagePicker className="mx-auto mt-4 max-w-64" />
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={t('auth.login.title')}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label={t('field.email')}>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('field.password')}>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('auth.login.busy') : t('auth.login.submit')}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {t('auth.login.noAccount')} <Link to="/inscription" className="font-medium text-brand-700 hover:underline">{t('auth.login.createAccount')}</Link>
      </p>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  // Pays détecté (fuseau horaire, langue) ; la monnaie suit le pays tant qu'on ne la change pas soi-même.
  const [country, setCountry] = useState(() => detectCountry(lang.code) ?? '');
  const [currency, setCurrency] = useState(() => currencyOf(detectCountry(lang.code)));
  const [currencyTouched, setCurrencyTouched] = useState(false);
  useEffect(() => {
    if (!currencyTouched) setCurrency(currencyOf(country));
  }, [country, currencyTouched]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, locale: lang.code, country: country || null, currency });
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={t('auth.register.title')}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label={t('field.fullName')}><input className="input" required value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label={t('field.email')}><input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label={t('field.phoneOptional')}><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+243 …" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('geo.country')}><CountrySelect value={country} onChange={setCountry} /></Field>
          <Field label={t('geo.defaultCurrency')}>
            <CurrencySelect value={currency} preferred={currencyOf(country)} onChange={(v) => { setCurrency(v); setCurrencyTouched(true); }} />
          </Field>
        </div>
        <Field label={t('field.password')} hint={t('auth.passwordHint')}>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('auth.register.busy') : t('auth.register.submit')}</button>
        <p className="text-center text-xs text-slate-500">{t('auth.register.starter')}</p>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {t('auth.register.hasAccount')} <Link to="/" className="font-medium text-brand-700 hover:underline">{t('auth.register.login')}</Link>
      </p>
    </Shell>
  );
}
