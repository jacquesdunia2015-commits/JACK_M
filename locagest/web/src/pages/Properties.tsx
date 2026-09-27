import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { CONDITIONS, PROPERTY_STATUSES, PROPERTY_STATUS_CLS, PROPERTY_TYPES, address, date, money } from '../lib/format';
import { AlertBadge, Badge, Empty, ErrorBox, Field, Loading, PageHeader, Row } from '../components/ui';
import { useT } from '../i18n';
import { useAuth } from '../lib/auth';
import { CurrencySelect } from '../components/GeoSelect';

export function Properties() {
  const t = useT();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, error, loading } = useFetch<any[]>(`/properties?status=${status}&q=${encodeURIComponent(q)}`);

  return (
    <>
      <PageHeader title={t('nav.properties')} subtitle={t('prop.subtitle')} actions={<Link to="/proprietes/nouvelle" className="btn-primary">+ {t('prop.add')}</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder={t('prop.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('prop.allStatuses')}</option>
          {PROPERTY_STATUSES.map((k) => <option key={k} value={k}>{t(`propStatus.${k}`)}</option>)}
        </select>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title={t('prop.none')}>
          <Link to="/proprietes/nouvelle" className="btn-primary">{t('prop.addFirst')}</Link>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} to={`/proprietes/${p.id}`} className="card block overflow-hidden p-0 hover:shadow-md">
              <div className="flex h-40 items-center justify-center bg-slate-100 text-4xl">
                {p.photos[0] ? <img src={p.photos[0].url} alt="" className="h-full w-full object-cover" /> : <span aria-hidden>🏠</span>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{p.title}</p>
                  <Badge className={PROPERTY_STATUS_CLS[p.status]}>{t(`propStatus.${p.status as 'vacante'}`)}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{address(p)}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t(`propType.${p.type as 'maison'}`)} · {t('prop.bedroomsShort', { n: p.bedrooms })}</span>
                  <span className="font-semibold text-slate-900">{t('common.perMonth', { amount: money(p.monthly_rent, p.currency) })}</span>
                </div>
                {p.current_tenant && <p className="mt-2 text-xs text-slate-500">{t('prop.currentTenant', { name: p.current_tenant })}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const EMPTY = {
  title: '', province: 'Kinshasa', commune: '', quartier: '', avenue: '', numero: '', type: 'maison', description: '',
  bedrooms: 1, livingRooms: 1, toiletsInternal: 1, toiletsExternal: 0, kitchens: 1, condition: 'bon',
  monthlyRent: 0, currency: 'USD', availableFrom: '', status: 'vacante',
};

export function PropertyForm() {
  const t = useT();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  // Nouvelle propriété : monnaie par défaut du bailleur (celle de son pays)
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY, currency: user?.currency ?? 'USD' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api(`/properties/${id}`).then((p) =>
      setForm({
        title: p.title, province: p.province, commune: p.commune, quartier: p.quartier ?? '', avenue: p.avenue ?? '',
        numero: p.numero ?? '', type: p.type, description: p.description ?? '', bedrooms: p.bedrooms, livingRooms: p.living_rooms,
        toiletsInternal: p.toilets_internal, toiletsExternal: p.toilets_external, kitchens: p.kitchens, condition: p.condition,
        monthlyRent: p.monthly_rent, currency: p.currency, availableFrom: p.available_from ?? '', status: p.status,
      }),
      (e) => setError(e.message),
    );
  }, [id]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api(id ? `/properties/${id}` : '/properties', { method: id ? 'PUT' : 'POST', body: form });
      navigate(`/proprietes/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const num = (k: keyof typeof EMPTY, label: string) => (
    <Field label={label}><input className="input" type="number" min={0} max={100} value={form[k] as number} onChange={set(k)} /></Field>
  );

  return (
    <>
      <PageHeader title={id ? t('prop.editTitle') : t('prop.newTitle')} />
      <form onSubmit={submit} className="space-y-6">
        <ErrorBox error={error} />
        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{t('prop.section.identity')}</h2>
          <Field label={t('prop.field.title')} className="md:col-span-2"><input className="input" required value={form.title} onChange={set('title')} placeholder={t('prop.field.titlePlaceholder')} /></Field>
          <Field label={t('prop.field.type')}>
            <select className="input" value={form.type} onChange={set('type')}>
              {PROPERTY_TYPES.map((k) => <option key={k} value={k}>{t(`propType.${k}`)}</option>)}
            </select>
          </Field>
          <Field label={t('common.status')}>
            <select className="input" value={form.status} onChange={set('status')}>
              {PROPERTY_STATUSES.map((k) => <option key={k} value={k}>{t(`propStatus.${k}`)}</option>)}
            </select>
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">{t('prop.section.address')}</h2>
          <Field label={t('prop.field.province')}><input className="input" required value={form.province} onChange={set('province')} /></Field>
          <Field label={t('prop.field.commune')}><input className="input" required value={form.commune} onChange={set('commune')} /></Field>
          <Field label={t('prop.field.quartier')}><input className="input" value={form.quartier} onChange={set('quartier')} /></Field>
          <Field label={t('prop.field.avenue')} className="md:col-span-2"><input className="input" value={form.avenue} onChange={set('avenue')} /></Field>
          <Field label={t('prop.field.numero')}><input className="input" value={form.numero} onChange={set('numero')} /></Field>
        </section>

        <section className="card grid grid-cols-2 gap-4 md:grid-cols-5">
          <h2 className="col-span-2 font-semibold md:col-span-5">{t('prop.section.features')}</h2>
          {num('bedrooms', t('prop.field.bedrooms'))}
          {num('livingRooms', t('prop.field.livingRooms'))}
          {num('toiletsInternal', t('prop.field.toiletsInternal'))}
          {num('toiletsExternal', t('prop.field.toiletsExternal'))}
          {num('kitchens', t('prop.field.kitchens'))}
          <Field label={t('prop.field.condition')} className="col-span-2">
            <select className="input" value={form.condition} onChange={set('condition')}>
              {CONDITIONS.map((k) => <option key={k} value={k}>{t(`condition.${k}`)}</option>)}
            </select>
          </Field>
          <Field label={t('prop.field.description')} className="col-span-2 md:col-span-5">
            <textarea className="input" rows={3} value={form.description} onChange={set('description')} />
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">{t('prop.section.rental')}</h2>
          <Field label={t('field.monthlyRent')}><input className="input" type="number" min={0} step="0.01" required value={form.monthlyRent} onChange={set('monthlyRent')} /></Field>
          <Field label={t('field.currency')}>
            <CurrencySelect value={form.currency} preferred={user?.currency} onChange={(currency) => setForm({ ...form, currency })} />
          </Field>
          <Field label={t('prop.field.availableFrom')}><input className="input" type="date" value={form.availableFrom} onChange={set('availableFrom')} /></Field>
        </section>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
        </div>
      </form>
    </>
  );
}

export function PropertyDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: p, error, loading, reload } = useFetch<any>(`/properties/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (loading && !p) return <Loading />;
  if (!p) return <ErrorBox error={error} />;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('photos', f));
    setUploading(true);
    setActionError(null);
    try {
      await api(`/properties/${id}/photos`, { method: 'POST', body: fd });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const removePhoto = async (photoId: number) => {
    if (!confirm(t('prop.confirmDeletePhoto'))) return;
    await api(`/properties/${id}/photos/${photoId}`, { method: 'DELETE' }).catch((e) => setActionError(e.message));
    await reload();
  };
  const remove = async () => {
    if (!confirm(t('prop.confirmDelete'))) return;
    try {
      await api(`/properties/${id}`, { method: 'DELETE' });
      navigate('/proprietes');
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const active = p.leases.find((l: any) => l.status === 'actif');

  return (
    <>
      <PageHeader
        title={p.title}
        subtitle={address(p)}
        actions={
          <>
            {!active && <Link to={`/baux/nouveau?propertyId=${p.id}`} className="btn-primary">{t('common.createLease')}</Link>}
            <Link to={`/proprietes/${p.id}/modifier`} className="btn-secondary">{t('common.edit')}</Link>
            <button onClick={remove} className="btn-danger">{t('common.delete')}</button>
          </>
        }
      />
      <ErrorBox error={actionError} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t('prop.gallery')}</h2>
            <label className="btn-secondary cursor-pointer">
              {uploading ? t('prop.uploading') : `+ ${t('prop.addPhotos')}`}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
            </label>
          </div>
          {p.photos.length === 0 ? (
            <Empty title={t('prop.noPhotos')}>{t('prop.photoHint')}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {p.photos.map((ph: any) => (
                <div key={ph.id} className="group relative overflow-hidden rounded-lg bg-slate-100">
                  <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={ph.name ?? ''} className="aspect-[4/3] w-full object-cover" /></a>
                  <button onClick={() => removePhoto(ph.id)} className="absolute end-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-red-700 opacity-0 shadow group-hover:opacity-100 focus:opacity-100">
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
          {p.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{p.description}</p>}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">{t('prop.sheet')}</h2>
          <dl>
            <Row label={t('common.status')}><Badge className={PROPERTY_STATUS_CLS[p.status]}>{t(`propStatus.${p.status as 'vacante'}`)}</Badge></Row>
            <Row label={t('prop.field.type')}>{t(`propType.${p.type as 'maison'}`)}</Row>
            <Row label={t('field.rent')}>{t('common.perMonth', { amount: money(p.monthly_rent, p.currency) })}</Row>
            <Row label={t('prop.field.condition')}>{t(`condition.${p.condition as 'bon'}`)}</Row>
            <Row label={t('prop.field.bedrooms')}>{p.bedrooms}</Row>
            <Row label={t('prop.field.livingRooms')}>{p.living_rooms}</Row>
            <Row label={t('prop.toilets')}>{p.toilets_internal} / {p.toilets_external}</Row>
            <Row label={t('prop.field.kitchens')}>{p.kitchens}</Row>
            <Row label={t('prop.availableOn')}>{date(p.available_from)}</Row>
          </dl>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">{t('prop.leaseHistory')}</h2>
        {p.leases.length === 0 ? <Empty title={t('prop.noLeases')} /> : <LeaseTable leases={p.leases} show="tenant" />}
      </section>
    </>
  );
}

export function LeaseTable({ leases, show }: { leases: any[]; show: 'tenant' | 'property' }) {
  const t = useT();
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="th">{show === 'tenant' ? t('field.tenant') : t('field.property')}</th>
            <th className="th">{t('lease.period')}</th>
            <th className="th">{t('field.rent')}</th>
            <th className="th">{t('common.status')}</th>
            <th className="th">{t('lease.guarantee')}</th>
          </tr>
        </thead>
        <tbody>
          {leases.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/baux/${l.id}`}>{show === 'tenant' ? `${l.first_name} ${l.last_name}` : l.property_title}</Link></td>
              <td className="td whitespace-nowrap">{date(l.start_date)} → {date(l.end_date)}</td>
              <td className="td whitespace-nowrap">{money(l.monthly_rent, l.currency)}</td>
              <td className="td">{t(`leaseStatus.${l.status as 'actif'}`)}</td>
              <td className="td"><AlertBadge level={l.guarantee.level} days={l.guarantee.daysRemaining} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
