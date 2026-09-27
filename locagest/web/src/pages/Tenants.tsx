import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { Badge, Empty, ErrorBox, Field, Loading, PageHeader, Row, Stars } from '../components/ui';
import { LeaseTable } from './Properties';
import { useT } from '../i18n';

export function Tenants() {
  const t = useT();
  const [q, setQ] = useState('');
  const [blacklisted, setBlacklisted] = useState(false);
  const { data, error, loading } = useFetch<any[]>(`/tenants?q=${encodeURIComponent(q)}${blacklisted ? '&blacklisted=true' : ''}`);

  return (
    <>
      <PageHeader title={t('nav.tenants')} actions={<Link to="/locataires/nouveau" className="btn-primary">+ {t('ten.add')}</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder={t('ten.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={blacklisted} onChange={(e) => setBlacklisted(e.target.checked)} />
          {t('ten.blacklistOnly')}
        </label>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title={blacklisted ? t('ten.noneBlacklisted') : t('ten.none')} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">{t('ten.col.name')}</th><th className="th">{t('ten.col.contact')}</th><th className="th">{t('ten.field.profession')}</th>
                <th className="th">{t('ten.col.currentHome')}</th><th className="th">{t('ten.col.rating')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td">
                    <Link to={`/locataires/${x.id}`} className="font-medium text-brand-700 hover:underline">{x.last_name} {x.first_name}</Link>
                    {x.blacklisted && <Badge className="ms-2 bg-slate-900 text-white ring-slate-900">{t('ten.blacklist')}</Badge>}
                  </td>
                  <td className="td">{x.phone ?? '—'}<div className="text-xs text-slate-500">{x.email}</div></td>
                  <td className="td">{x.profession ?? '—'}<div className="text-xs text-slate-500">{x.employer}</div></td>
                  <td className="td">{x.current_property ?? <span className="text-slate-400">—</span>}</td>
                  <td className="td"><Stars value={x.rating} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '', idNumber: '', nationality: '', profession: '', employer: '',
  previousHousing: '', rating: '' as number | '', ratingNote: '', blacklisted: false, blacklistReason: '',
};

export function TenantForm() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api(`/tenants/${id}`).then((x) =>
      setForm({
        firstName: x.first_name, lastName: x.last_name, email: x.email ?? '', phone: x.phone ?? '', idNumber: x.id_number ?? '',
        nationality: x.nationality ?? '', profession: x.profession ?? '', employer: x.employer ?? '', previousHousing: x.previous_housing ?? '',
        rating: x.rating ?? '', ratingNote: x.rating_note ?? '', blacklisted: x.blacklisted, blacklistReason: x.blacklist_reason ?? '',
      }),
      (e) => setError(e.message),
    );
  }, [id]);

  // Vérification liste noire à la saisie d'un nouveau locataire
  useEffect(() => {
    if (id || (!form.idNumber && !form.phone)) return setWarning(null);
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ idNumber: form.idNumber, phone: form.phone, email: form.email });
      const r = await api<{ matches: any[] }>(`/tenants/check-blacklist?${params}`).catch(() => ({ matches: [] }));
      setWarning(
        r.matches.length
          ? t('ten.blacklistWarning', { names: r.matches.map((m) => `${m.first_name} ${m.last_name} (${m.blacklist_reason})`).join(', ') })
          : null,
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [id, form.idNumber, form.phone, form.email, t]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const x = await api(id ? `/tenants/${id}` : '/tenants', { method: id ? 'PUT' : 'POST', body: form });
      navigate(`/locataires/${x.id}`);
    } catch (err) {
      setError((err as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={id ? t('ten.editTitle') : t('ten.newTitle')} />
      <form onSubmit={submit} className="space-y-6">
        <ErrorBox error={error} />
        {warning && <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">{warning}</div>}
        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{t('ten.section.identity')}</h2>
          <Field label={t('ten.field.firstName')}><input className="input" required value={form.firstName} onChange={set('firstName')} /></Field>
          <Field label={t('ten.field.lastName')}><input className="input" required value={form.lastName} onChange={set('lastName')} /></Field>
          <Field label={t('field.phone')}><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></Field>
          <Field label={t('field.email')} hint={t('ten.emailHint')}><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label={t('ten.field.idNumber')}><input className="input" value={form.idNumber} onChange={set('idNumber')} /></Field>
          <Field label={t('ten.field.nationality')}><input className="input" value={form.nationality} onChange={set('nationality')} /></Field>
          <Field label={t('ten.field.profession')}><input className="input" value={form.profession} onChange={set('profession')} /></Field>
          <Field label={t('ten.field.employer')}><input className="input" value={form.employer} onChange={set('employer')} /></Field>
          <Field label={t('ten.field.previousHousing')} className="md:col-span-2">
            <textarea className="input" rows={2} value={form.previousHousing} onChange={set('previousHousing')} placeholder={t('ten.field.previousHousingPlaceholder')} />
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{t('ten.section.rating')}</h2>
          <Field label={t('ten.field.rating')}>
            <select className="input" value={form.rating} onChange={set('rating')}>
              <option value="">{t('ten.notRated')}</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}
            </select>
          </Field>
          <Field label={t('ten.field.ratingNote')}><input className="input" value={form.ratingNote} onChange={set('ratingNote')} placeholder={t('ten.field.ratingNotePlaceholder')} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            <input type="checkbox" checked={form.blacklisted} onChange={set('blacklisted')} />
            {t('ten.field.blacklisted')}
          </label>
          {form.blacklisted && (
            <Field label={t('ten.field.blacklistReason')} className="md:col-span-2"><input className="input" required value={form.blacklistReason} onChange={set('blacklistReason')} /></Field>
          )}
        </section>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
        </div>
      </form>
    </>
  );
}

export function TenantDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: x, error, loading, reload } = useFetch<any>(`/tenants/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [portalMsg, setPortalMsg] = useState<string | null>(null);

  if (loading && !x) return <Loading />;
  if (!x) return <ErrorBox error={error} />;

  const remove = async () => {
    if (!confirm(t('ten.confirmDelete'))) return;
    try {
      await api(`/tenants/${id}`, { method: 'DELETE' });
      navigate('/locataires');
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const openPortal = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api(`/tenants/${id}/portal`, { method: 'POST', body: { password } });
      setPortalMsg(t('ten.portal.opened', { email: x.email }));
      setPassword('');
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  const closePortal = async () => {
    await api(`/tenants/${id}/portal`, { method: 'DELETE' });
    setPortalMsg(null);
    await reload();
  };
  const hasActive = x.leases.some((l: any) => l.status === 'actif');

  return (
    <>
      <PageHeader
        title={`${x.first_name} ${x.last_name}`}
        subtitle={x.profession ? `${x.profession}${x.employer ? ` — ${x.employer}` : ''}` : undefined}
        actions={
          <>
            {!hasActive && !x.blacklisted && <Link to={`/baux/nouveau?tenantId=${x.id}`} className="btn-primary">{t('common.createLease')}</Link>}
            <Link to={`/messages/${x.id}`} className="btn-secondary">💬 {t('ten.message')}</Link>
            <Link to={`/locataires/${x.id}/modifier`} className="btn-secondary">{t('common.edit')}</Link>
            <button onClick={remove} className="btn-danger">{t('common.delete')}</button>
          </>
        }
      />
      <ErrorBox error={actionError} />
      {x.blacklisted && (
        <div className="mb-4 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">⛔ {t('ten.blacklistBanner', { reason: x.blacklist_reason })}</div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">{t('ten.profile')}</h2>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <div>
              <Row label={t('field.phone')}>{x.phone}</Row>
              <Row label={t('field.email')}>{x.email}</Row>
              <Row label={t('ten.field.idNumberShort')}>{x.id_number}</Row>
            </div>
            <div>
              <Row label={t('ten.field.nationality')}>{x.nationality}</Row>
              <Row label={t('ten.col.rating')}><Stars value={x.rating} /></Row>
              <Row label={t('ten.field.ratingNote')}>{x.rating_note}</Row>
            </div>
          </dl>
          {x.previous_housing && (
            <p className="mt-3 text-sm text-slate-600">{t('ten.previousHousingValue', { value: x.previous_housing })}</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">{t('ten.portal.title')}</h2>
          <p className="mb-3 text-sm text-slate-500">{t('ten.portal.hint')}</p>
          {x.portal?.active ? (
            <div className="space-y-2 text-sm">
              <p>✅ {t('ten.portal.active', { email: x.portal.email })}</p>
              <button onClick={closePortal} className="btn-secondary w-full">{t('ten.portal.disable')}</button>
            </div>
          ) : null}
          <form onSubmit={openPortal} className="mt-3 space-y-2">
            <input className="input" type="text" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('ten.portal.passwordPlaceholder')} disabled={!x.email} />
            <button className="btn-primary w-full" disabled={!x.email}>{x.portal?.active ? t('ten.portal.reset') : t('ten.portal.open')}</button>
            {!x.email && <p className="text-xs text-slate-500">{t('ten.portal.needEmail')}</p>}
          </form>
          {portalMsg && <p className="mt-2 text-sm text-emerald-700">{portalMsg}</p>}
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">{t('ten.housingHistory')}</h2>
        {x.leases.length === 0 ? <Empty title={t('ten.noLeases')} /> : <LeaseTable leases={x.leases} show="property" />}
      </section>
    </>
  );
}
