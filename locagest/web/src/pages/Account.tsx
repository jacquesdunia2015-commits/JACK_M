import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field, PageHeader } from '../components/ui';
import { CountrySelect, CurrencySelect } from '../components/GeoSelect';
import { LanguagePicker } from '../components/LanguagePicker';
import { currencyOf } from '../lib/geo';

export function Account() {
  const { user, setUser } = useAuth();
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '', phone: user?.phone ?? '', currentPassword: '', newPassword: '',
    country: user?.country ?? '', currency: user?.currency ?? 'USD',
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    try {
      const body = {
        fullName: form.fullName, phone: form.phone, country: form.country || null, currency: form.currency, locale: lang.code,
        ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
      };
      const r = await api('/auth/me', { method: 'PATCH', body });
      setUser(r.user);
      setForm({ ...form, currentPassword: '', newPassword: '' });
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title={t('account.title')} subtitle={user.email} />
      {user.role === 'bailleur' && (
        <section className="card mb-6">
          <h2 className="font-semibold">{t('layout.plan', { plan: user.planInfo.label })}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {user.planInfo.maxProperties ? t('account.maxProperties', { n: user.planInfo.maxProperties }) : t('account.unlimitedProperties')} ·{' '}
            {user.planInfo.maxTenants ? t('account.maxTenants', { n: user.planInfo.maxTenants }) : t('account.unlimitedTenants')} · {user.planInfo.price}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t('account.changePlan')}</p>
        </section>
      )}
      <form onSubmit={submit} className="card max-w-xl space-y-4">
        <ErrorBox error={error} />
        {ok && <p className="text-sm text-emerald-700">{t('account.saved')}</p>}
        <Field label={t('field.fullName')}><input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label={t('field.phone')}><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>

        <h3 className="pt-2 text-sm font-semibold text-slate-700">{t('account.region')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('geo.country')}>
            <CountrySelect value={form.country} onChange={(country) => setForm({ ...form, country, currency: country ? currencyOf(country) : form.currency })} />
          </Field>
          {user.role !== 'locataire' && (
            <Field label={t('geo.defaultCurrency')} hint={t('geo.defaultCurrencyHint')}>
              <CurrencySelect value={form.currency} preferred={currencyOf(form.country)} onChange={(currency) => setForm({ ...form, currency })} />
            </Field>
          )}
        </div>
        <div>
          <span className="label">{t('lang.label')}</span>
          <LanguagePicker />
        </div>

        <h3 className="pt-2 text-sm font-semibold text-slate-700">{t('account.changePassword')}</h3>
        <Field label={t('account.currentPassword')}><input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
        <Field label={t('account.newPassword')}><input className="input" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
        <button className="btn-primary">{t('common.save')}</button>
      </form>
    </>
  );
}
