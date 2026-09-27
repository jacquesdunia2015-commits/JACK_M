import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { Badge, Empty, ErrorBox, Field, Loading, PageHeader, Row, Stars } from '../components/ui';
import { LeaseTable } from './Properties';

export function Tenants() {
  const [q, setQ] = useState('');
  const [blacklisted, setBlacklisted] = useState(false);
  const { data, error, loading } = useFetch<any[]>(`/tenants?q=${encodeURIComponent(q)}${blacklisted ? '&blacklisted=true' : ''}`);

  return (
    <>
      <PageHeader title="Locataires" actions={<Link to="/locataires/nouveau" className="btn-primary">+ Ajouter un locataire</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Nom, téléphone, n° d'identité…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={blacklisted} onChange={(e) => setBlacklisted(e.target.checked)} />
          Liste noire uniquement
        </label>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title={blacklisted ? 'Personne sur la liste noire' : 'Aucun locataire'} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Nom</th><th className="th">Contact</th><th className="th">Profession</th>
                <th className="th">Logement actuel</th><th className="th">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td">
                    <Link to={`/locataires/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.last_name} {t.first_name}</Link>
                    {t.blacklisted && <Badge className="ml-2 bg-slate-900 text-white ring-slate-900">Liste noire</Badge>}
                  </td>
                  <td className="td">{t.phone ?? '—'}<div className="text-xs text-slate-500">{t.email}</div></td>
                  <td className="td">{t.profession ?? '—'}<div className="text-xs text-slate-500">{t.employer}</div></td>
                  <td className="td">{t.current_property ?? <span className="text-slate-400">—</span>}</td>
                  <td className="td"><Stars value={t.rating} /></td>
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
  firstName: '', lastName: '', email: '', phone: '', idNumber: '', nationality: 'Congolaise', profession: '', employer: '',
  previousHousing: '', rating: '' as number | '', ratingNote: '', blacklisted: false, blacklistReason: '',
};

export function TenantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api(`/tenants/${id}`).then((t) =>
      setForm({
        firstName: t.first_name, lastName: t.last_name, email: t.email ?? '', phone: t.phone ?? '', idNumber: t.id_number ?? '',
        nationality: t.nationality ?? '', profession: t.profession ?? '', employer: t.employer ?? '', previousHousing: t.previous_housing ?? '',
        rating: t.rating ?? '', ratingNote: t.rating_note ?? '', blacklisted: t.blacklisted, blacklistReason: t.blacklist_reason ?? '',
      }),
      (e) => setError(e.message),
    );
  }, [id]);

  // Vérification liste noire à la saisie d'un nouveau locataire
  useEffect(() => {
    if (id || (!form.idNumber && !form.phone)) return setWarning(null);
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ idNumber: form.idNumber, phone: form.phone, email: form.email });
      const r = await api<{ matches: any[] }>(`/tenants/check-blacklist?${params}`).catch(() => ({ matches: [] }));
      setWarning(r.matches.length ? `Attention : ${r.matches.map((m) => `${m.first_name} ${m.last_name} (${m.blacklist_reason})`).join(', ')} figure sur votre liste noire avec ces coordonnées.` : null);
    }, 500);
    return () => clearTimeout(t);
  }, [id, form.idNumber, form.phone, form.email]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api(id ? `/tenants/${id}` : '/tenants', { method: id ? 'PUT' : 'POST', body: form });
      navigate(`/locataires/${t.id}`);
    } catch (err) {
      setError((err as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={id ? 'Modifier le locataire' : 'Nouveau locataire'} />
      <form onSubmit={submit} className="space-y-6">
        <ErrorBox error={error} />
        {warning && <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">{warning}</div>}
        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">Identité et contacts</h2>
          <Field label="Prénom"><input className="input" required value={form.firstName} onChange={set('firstName')} /></Field>
          <Field label="Nom"><input className="input" required value={form.lastName} onChange={set('lastName')} /></Field>
          <Field label="Téléphone"><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email" hint="Nécessaire pour les alertes email et l'espace locataire"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="N° de carte d'identité / passeport"><input className="input" value={form.idNumber} onChange={set('idNumber')} /></Field>
          <Field label="Nationalité"><input className="input" value={form.nationality} onChange={set('nationality')} /></Field>
          <Field label="Profession"><input className="input" value={form.profession} onChange={set('profession')} /></Field>
          <Field label="Employeur"><input className="input" value={form.employer} onChange={set('employer')} /></Field>
          <Field label="Logements précédents" className="md:col-span-2">
            <textarea className="input" rows={2} value={form.previousHousing} onChange={set('previousHousing')} placeholder="Adresses, bailleurs, durées…" />
          </Field>
        </section>

        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">Évaluation</h2>
          <Field label="Note de fiabilité">
            <select className="input" value={form.rating} onChange={set('rating')}>
              <option value="">Non noté</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}
            </select>
          </Field>
          <Field label="Commentaire"><input className="input" value={form.ratingNote} onChange={set('ratingNote')} placeholder="Ponctualité, respect du bien…" /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            <input type="checkbox" checked={form.blacklisted} onChange={set('blacklisted')} />
            Inscrire sur la liste noire (mauvais payeur)
          </label>
          {form.blacklisted && (
            <Field label="Motif" className="md:col-span-2"><input className="input" required value={form.blacklistReason} onChange={set('blacklistReason')} /></Field>
          )}
        </section>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Annuler</button>
        </div>
      </form>
    </>
  );
}

export function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: t, error, loading, reload } = useFetch<any>(`/tenants/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [portalMsg, setPortalMsg] = useState<string | null>(null);

  if (loading && !t) return <Loading />;
  if (!t) return <ErrorBox error={error} />;

  const remove = async () => {
    if (!confirm('Supprimer définitivement ce locataire ?')) return;
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
      setPortalMsg(`Accès ouvert. Communiquez au locataire son identifiant (${t.email}) et ce mot de passe.`);
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
  const hasActive = t.leases.some((l: any) => l.status === 'actif');

  return (
    <>
      <PageHeader
        title={`${t.first_name} ${t.last_name}`}
        subtitle={t.profession ? `${t.profession}${t.employer ? ` — ${t.employer}` : ''}` : undefined}
        actions={
          <>
            {!hasActive && !t.blacklisted && <Link to={`/baux/nouveau?tenantId=${t.id}`} className="btn-primary">Créer un bail</Link>}
            <Link to={`/locataires/${t.id}/modifier`} className="btn-secondary">Modifier</Link>
            <button onClick={remove} className="btn-danger">Supprimer</button>
          </>
        }
      />
      <ErrorBox error={actionError} />
      {t.blacklisted && (
        <div className="mb-4 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">⛔ Liste noire : {t.blacklist_reason}</div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">Profil</h2>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <div>
              <Row label="Téléphone">{t.phone}</Row>
              <Row label="Email">{t.email}</Row>
              <Row label="N° d'identité">{t.id_number}</Row>
            </div>
            <div>
              <Row label="Nationalité">{t.nationality}</Row>
              <Row label="Note"><Stars value={t.rating} /></Row>
              <Row label="Commentaire">{t.rating_note}</Row>
            </div>
          </dl>
          {t.previous_housing && (
            <p className="mt-3 text-sm text-slate-600"><span className="font-medium">Logements précédents :</span> {t.previous_housing}</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">Espace locataire</h2>
          <p className="mb-3 text-sm text-slate-500">Le locataire consulte son bail, sa garantie et ses loyers en ligne.</p>
          {t.portal?.active ? (
            <div className="space-y-2 text-sm">
              <p>✅ Accès actif : <strong>{t.portal.email}</strong></p>
              <button onClick={closePortal} className="btn-secondary w-full">Désactiver l'accès</button>
            </div>
          ) : null}
          <form onSubmit={openPortal} className="mt-3 space-y-2">
            <input className="input" type="text" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (8 caractères min.)" disabled={!t.email} />
            <button className="btn-primary w-full" disabled={!t.email}>{t.portal?.active ? 'Réinitialiser le mot de passe' : "Ouvrir l'accès"}</button>
            {!t.email && <p className="text-xs text-slate-500">Renseignez d'abord l'email du locataire.</p>}
          </form>
          {portalMsg && <p className="mt-2 text-sm text-emerald-700">{portalMsg}</p>}
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Historique des logements</h2>
        {t.leases.length === 0 ? <Empty title="Aucun bail enregistré" /> : <LeaseTable leases={t.leases} show="property" />}
      </section>
    </>
  );
}
