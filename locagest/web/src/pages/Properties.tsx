import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { CONDITIONS, PROPERTY_STATUS, PROPERTY_TYPES, LEASE_STATUS, address, date, money } from '../lib/format';
import { AlertBadge, Badge, Empty, ErrorBox, Field, Loading, PageHeader, Row } from '../components/ui';

export function Properties() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, error, loading } = useFetch<any[]>(`/properties?status=${status}&q=${encodeURIComponent(q)}`);

  return (
    <>
      <PageHeader title="Propriétés" subtitle="Votre portefeuille immobilier" actions={<Link to="/proprietes/nouvelle" className="btn-primary">+ Ajouter une propriété</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Rechercher (nom, commune, quartier…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(PROPERTY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title="Aucune propriété">
          <Link to="/proprietes/nouvelle" className="btn-primary">Ajouter ma première propriété</Link>
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
                  <Badge className={PROPERTY_STATUS[p.status].cls}>{PROPERTY_STATUS[p.status].label}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{address(p)}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{PROPERTY_TYPES[p.type]} · {p.bedrooms} ch.</span>
                  <span className="font-semibold text-slate-900">{money(p.monthly_rent, p.currency)}<span className="font-normal text-slate-500">/mois</span></span>
                </div>
                {p.current_tenant && <p className="mt-2 text-xs text-slate-500">Locataire : {p.current_tenant}</p>}
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
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
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
      <PageHeader title={id ? 'Modifier la propriété' : 'Nouvelle propriété'} />
      <form onSubmit={submit} className="space-y-6">
        <ErrorBox error={error} />
        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">Identification</h2>
          <Field label="Intitulé" className="md:col-span-2"><input className="input" required value={form.title} onChange={set('title')} placeholder="Ex. Maison Kintambo" /></Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={set('type')}>
              {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <select className="input" value={form.status} onChange={set('status')}>
              {Object.entries(PROPERTY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">Adresse</h2>
          <Field label="Province"><input className="input" required value={form.province} onChange={set('province')} /></Field>
          <Field label="Commune"><input className="input" required value={form.commune} onChange={set('commune')} /></Field>
          <Field label="Quartier"><input className="input" value={form.quartier} onChange={set('quartier')} /></Field>
          <Field label="Avenue / rue" className="md:col-span-2"><input className="input" value={form.avenue} onChange={set('avenue')} /></Field>
          <Field label="Numéro"><input className="input" value={form.numero} onChange={set('numero')} /></Field>
        </section>

        <section className="card grid grid-cols-2 gap-4 md:grid-cols-5">
          <h2 className="col-span-2 font-semibold md:col-span-5">Caractéristiques</h2>
          {num('bedrooms', 'Chambres')}
          {num('livingRooms', 'Salons')}
          {num('toiletsInternal', 'Toilettes internes')}
          {num('toiletsExternal', 'Toilettes externes')}
          {num('kitchens', 'Cuisines')}
          <Field label="État" className="col-span-2">
            <select className="input" value={form.condition} onChange={set('condition')}>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Description" className="col-span-2 md:col-span-5">
            <textarea className="input" rows={3} value={form.description} onChange={set('description')} />
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">Location</h2>
          <Field label="Loyer mensuel"><input className="input" type="number" min={0} step="0.01" required value={form.monthlyRent} onChange={set('monthlyRent')} /></Field>
          <Field label="Devise">
            <select className="input" value={form.currency} onChange={set('currency')}>
              <option value="USD">Dollar (USD)</option>
              <option value="CDF">Franc congolais (FC)</option>
            </select>
          </Field>
          <Field label="Disponible à partir du"><input className="input" type="date" value={form.availableFrom} onChange={set('availableFrom')} /></Field>
        </section>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Annuler</button>
        </div>
      </form>
    </>
  );
}

export function PropertyDetail() {
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
    if (!confirm('Supprimer cette photo ?')) return;
    await api(`/properties/${id}/photos/${photoId}`, { method: 'DELETE' }).catch((e) => setActionError(e.message));
    await reload();
  };
  const remove = async () => {
    if (!confirm('Supprimer définitivement cette propriété ?')) return;
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
            {!active && <Link to={`/baux/nouveau?propertyId=${p.id}`} className="btn-primary">Créer un bail</Link>}
            <Link to={`/proprietes/${p.id}/modifier`} className="btn-secondary">Modifier</Link>
            <button onClick={remove} className="btn-danger">Supprimer</button>
          </>
        }
      />
      <ErrorBox error={actionError} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Galerie photos</h2>
            <label className="btn-secondary cursor-pointer">
              {uploading ? 'Envoi…' : '+ Ajouter des photos'}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
            </label>
          </div>
          {p.photos.length === 0 ? (
            <Empty title="Aucune photo">JPEG, PNG ou WebP, 5 Mo maximum par photo.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {p.photos.map((ph: any) => (
                <div key={ph.id} className="group relative overflow-hidden rounded-lg bg-slate-100">
                  <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={ph.name ?? ''} className="aspect-[4/3] w-full object-cover" /></a>
                  <button onClick={() => removePhoto(ph.id)} className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-red-700 opacity-0 shadow group-hover:opacity-100 focus:opacity-100">
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
          {p.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{p.description}</p>}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">Fiche</h2>
          <dl>
            <Row label="Statut"><Badge className={PROPERTY_STATUS[p.status].cls}>{PROPERTY_STATUS[p.status].label}</Badge></Row>
            <Row label="Type">{PROPERTY_TYPES[p.type]}</Row>
            <Row label="Loyer">{money(p.monthly_rent, p.currency)} / mois</Row>
            <Row label="État">{CONDITIONS[p.condition]}</Row>
            <Row label="Chambres">{p.bedrooms}</Row>
            <Row label="Salons">{p.living_rooms}</Row>
            <Row label="Toilettes int. / ext.">{p.toilets_internal} / {p.toilets_external}</Row>
            <Row label="Cuisines">{p.kitchens}</Row>
            <Row label="Disponible le">{date(p.available_from)}</Row>
          </dl>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Historique des baux</h2>
        {p.leases.length === 0 ? <Empty title="Aucun bail pour cette propriété" /> : <LeaseTable leases={p.leases} show="tenant" />}
      </section>
    </>
  );
}

export function LeaseTable({ leases, show }: { leases: any[]; show: 'tenant' | 'property' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="th">{show === 'tenant' ? 'Locataire' : 'Propriété'}</th>
            <th className="th">Période</th>
            <th className="th">Loyer</th>
            <th className="th">Statut</th>
            <th className="th">Garantie</th>
          </tr>
        </thead>
        <tbody>
          {leases.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/baux/${l.id}`}>{show === 'tenant' ? `${l.first_name} ${l.last_name}` : l.property_title}</Link></td>
              <td className="td whitespace-nowrap">{date(l.start_date)} → {date(l.end_date)}</td>
              <td className="td whitespace-nowrap">{money(l.monthly_rent, l.currency)}</td>
              <td className="td">{LEASE_STATUS[l.status]}</td>
              <td className="td"><AlertBadge level={l.guarantee.level} days={l.guarantee.daysRemaining} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
