import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, openContract } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { LEASE_STATUS, LEVELS, LEVEL_ORDER, PAYMENT_METHODS, PAYMENT_STATES, address, date, money, month, todayISO, type Level } from '../lib/format';
import { AlertBadge, Badge, Empty, ErrorBox, Field, Loading, PageHeader, Row } from '../components/ui';

export function Leases() {
  const [params, setParams] = useSearchParams();
  const level = params.get('level') ?? '';
  const status = params.get('status') ?? 'actif';
  const { data, error, loading } = useFetch<any[]>(`/leases?status=${status}&level=${level}`);
  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Baux & garanties" subtitle="Classés par date d'expiration de la garantie" actions={<Link to="/baux/nouveau" className="btn-primary">+ Nouveau bail</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter('level', '')} className={`btn ${!level ? 'bg-slate-800 text-white' : 'btn-secondary'}`}>Toutes</button>
        {LEVEL_ORDER.map((l) => (
          <button key={l} onClick={() => setFilter('level', l)} className={`btn ${level === l ? 'bg-slate-800 text-white' : 'btn-secondary'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${LEVELS[l].dot}`} aria-hidden /> {LEVELS[l].label}
          </button>
        ))}
        <select className="input ml-auto max-w-48" value={status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="actif">Baux actifs</option>
          <option value="renouvele">Renouvelés (archives)</option>
          <option value="termine">Terminés (archives)</option>
          <option value="">Tous</option>
        </select>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title="Aucun bail ne correspond" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Garantie</th><th className="th">Propriété</th><th className="th">Locataire</th>
                <th className="th">Expiration</th><th className="th">Loyer</th><th className="th">Action recommandée</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td"><AlertBadge level={l.guarantee.level} days={l.guarantee.daysRemaining} /></td>
                  <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/baux/${l.id}`}>{l.property_title}</Link></td>
                  <td className="td">{l.first_name} {l.last_name}</td>
                  <td className="td whitespace-nowrap">{date(l.guarantee_expires_on)}</td>
                  <td className="td whitespace-nowrap">{money(l.monthly_rent, l.currency)}</td>
                  <td className="td text-xs text-slate-500">{l.guarantee.level ? LEVELS[l.guarantee.level as Level].action : LEASE_STATUS[l.status]}</td>
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
  propertyId: '', tenantId: '', startDate: todayISO(), endDate: '', guaranteeExpiresOn: '', monthlyRent: 0,
  currency: 'USD', guaranteeAmount: 0, terms: '', autoRenew: false,
};

function oneYearLater(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  const x = new Date(Date.UTC(y + 1, m - 1, day - 1));
  return x.toISOString().slice(0, 10);
}

export function LeaseForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, propertyId: params.get('propertyId') ?? '', tenantId: params.get('tenantId') ?? '', endDate: oneYearLater(todayISO()) });
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmBlacklist, setConfirmBlacklist] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) {
      api(`/leases/${id}`).then((l) =>
        setForm({
          propertyId: String(l.property_id), tenantId: String(l.tenant_id), startDate: l.start_date, endDate: l.end_date,
          guaranteeExpiresOn: l.guarantee_expires_on === l.end_date ? '' : l.guarantee_expires_on, monthlyRent: l.monthly_rent,
          currency: l.currency, guaranteeAmount: l.guarantee_amount, terms: l.terms ?? '', autoRenew: l.auto_renew,
        }),
        (e) => setError(e.message),
      );
    } else {
      api<any[]>('/properties').then(setProperties, (e) => setError(e.message));
      api<any[]>('/tenants').then(setTenants, (e) => setError(e.message));
    }
  }, [id]);

  // Préremplit loyer et devise depuis la propriété choisie
  useEffect(() => {
    if (id) return;
    const p = properties.find((x) => String(x.id) === form.propertyId);
    if (p) setForm((f) => ({ ...f, monthlyRent: p.monthly_rent, currency: p.currency, guaranteeAmount: f.guaranteeAmount || p.monthly_rent * 3 }));
  }, [form.propertyId, properties, id]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'startDate' && typeof v === 'string' && v ? { endDate: oneYearLater(v) } : {}) }));
  };

  const tenant = tenants.find((t) => String(t.id) === form.tenantId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, acceptBlacklisted: confirmBlacklist };
      const l = await api(id ? `/leases/${id}` : '/leases', { method: id ? 'PUT' : 'POST', body });
      navigate(`/baux/${l.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={id ? 'Modifier le bail' : 'Nouveau bail'} />
      <form onSubmit={submit} className="space-y-6">
        <ErrorBox error={error} />
        {!id && (
          <section className="card grid gap-4 md:grid-cols-2">
            <h2 className="font-semibold md:col-span-2">Parties</h2>
            <Field label="Propriété" hint="Seules les propriétés sans bail actif sont proposées">
              <select className="input" required value={form.propertyId} onChange={set('propertyId')}>
                <option value="">Choisir…</option>
                {properties.filter((p) => !p.current_lease_id).map((p) => <option key={p.id} value={p.id}>{p.title} — {p.commune}</option>)}
              </select>
            </Field>
            <Field label="Locataire">
              <select className="input" required value={form.tenantId} onChange={set('tenantId')}>
                <option value="">Choisir…</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.last_name} {t.first_name}{t.blacklisted ? ' ⛔' : ''}{t.current_property ? ` (loge à ${t.current_property})` : ''}</option>)}
              </select>
            </Field>
            {(properties.length === 0 || tenants.length === 0) && (
              <p className="text-sm text-slate-500 md:col-span-2">
                Il faut au moins une <Link className="text-brand-700 underline" to="/proprietes/nouvelle">propriété</Link> et un{' '}
                <Link className="text-brand-700 underline" to="/locataires/nouveau">locataire</Link>.
              </p>
            )}
            {tenant?.blacklisted && (
              <label className="flex items-start gap-2 rounded-lg bg-slate-900 p-3 text-sm text-white md:col-span-2">
                <input type="checkbox" className="mt-1" checked={confirmBlacklist} onChange={(e) => setConfirmBlacklist(e.target.checked)} />
                Ce locataire est sur la liste noire ({tenant.blacklist_reason}). Je confirme vouloir lui louer ce bien.
              </label>
            )}
          </section>
        )}

        <section className="card grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">Durée et garantie</h2>
          <Field label="Début du bail"><input className="input" type="date" required value={form.startDate} onChange={set('startDate')} /></Field>
          <Field label="Fin du bail"><input className="input" type="date" required value={form.endDate} onChange={set('endDate')} /></Field>
          <Field label="Expiration de la garantie" hint="Laisser vide = fin du bail. Pilote les alertes couleur.">
            <input className="input" type="date" value={form.guaranteeExpiresOn} onChange={set('guaranteeExpiresOn')} />
          </Field>
          <Field label="Loyer mensuel"><input className="input" type="number" min={0} step="0.01" required value={form.monthlyRent} onChange={set('monthlyRent')} /></Field>
          <Field label="Devise">
            <select className="input" value={form.currency} onChange={set('currency')}>
              <option value="USD">Dollar (USD)</option>
              <option value="CDF">Franc congolais (FC)</option>
            </select>
          </Field>
          <Field label="Montant de la garantie"><input className="input" type="number" min={0} step="0.01" value={form.guaranteeAmount} onChange={set('guaranteeAmount')} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-3">
            <input type="checkbox" checked={form.autoRenew} onChange={set('autoRenew')} /> Clause de renouvellement automatique (tacite reconduction)
          </label>
          <Field label="Termes et conditions particulières" className="md:col-span-3">
            <textarea className="input" rows={4} value={form.terms} onChange={set('terms')} />
          </Field>
        </section>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le bail'}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Annuler</button>
        </div>
      </form>
    </>
  );
}

export function LeaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: l, error, loading, reload } = useFetch<any>(`/leases/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);

  if (loading && !l) return <Loading />;
  if (!l) return <ErrorBox error={error} />;

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const terminate = () =>
    confirm('Clôturer ce bail ? La propriété redeviendra vacante.') &&
    act(async () => {
      await api(`/leases/${id}/terminate`, { method: 'POST' });
      await reload();
    });

  const g = l.guarantee;
  const active = l.status === 'actif';
  const lvl = g.level ? LEVELS[g.level as Level] : null;

  return (
    <>
      <PageHeader
        title={`Bail — ${l.property_title}`}
        subtitle={<>{l.first_name} {l.last_name} · {address(l)}</>}
        actions={
          <>
            <button className="btn-secondary" onClick={() => act(() => openContract(l.id))}>📄 Contrat</button>
            {active && <Link to={`/baux/${l.id}/modifier`} className="btn-secondary">Modifier</Link>}
            {active && <button className="btn-primary" onClick={() => setRenewing(!renewing)}>Renouveler</button>}
            {active && <button className="btn-danger" onClick={terminate}>Clôturer</button>}
          </>
        }
      />
      <ErrorBox error={actionError} />
      {!active && (
        <div className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Bail archivé ({LEASE_STATUS[l.status]}).
        </div>
      )}
      {renewing && <RenewForm lease={l} onDone={(newId) => navigate(`/baux/${newId}`)} onCancel={() => setRenewing(false)} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={`card ${lvl ? lvl.badge + ' ring-1 ' + lvl.pulse : ''}`}>
          <h2 className="mb-3 font-semibold">Garantie</h2>
          {lvl ? (
            <>
              <p className="text-4xl font-bold">{lvl.emoji} {g.daysRemaining > 0 ? `${g.daysRemaining} j` : 'Expirée'}</p>
              <p className="mt-1 text-sm">{g.daysRemaining > 0 ? `avant expiration, le ${date(l.guarantee_expires_on)}` : `depuis le ${date(l.guarantee_expires_on)}`}</p>
              <p className="mt-3 text-sm font-medium">➜ {g.action}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Bail clôturé — plus d'alerte.</p>
          )}
          <p className="mt-3 text-sm">Montant : <strong>{money(l.guarantee_amount, l.currency)}</strong></p>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">Conditions</h2>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <div>
              <Row label="Début">{date(l.start_date)}</Row>
              <Row label="Fin">{date(l.end_date)}</Row>
              <Row label="Renouvellement auto.">{l.auto_renew ? 'Oui' : 'Non'}</Row>
            </div>
            <div>
              <Row label="Loyer">{money(l.monthly_rent, l.currency)} / mois</Row>
              <Row label="Statut">{LEASE_STATUS[l.status]}</Row>
              <Row label="Locataire"><Link className="text-brand-700 hover:underline" to={`/locataires/${l.tenant_id}`}>{l.first_name} {l.last_name}</Link></Row>
            </div>
          </dl>
          {l.terms && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{l.terms}</p>}
          {l.previous_lease_id && <p className="mt-3 text-sm"><Link className="text-brand-700 hover:underline" to={`/baux/${l.previous_lease_id}`}>← Bail précédent</Link></p>}
        </section>
      </div>

      <Payments lease={l} reload={reload} />

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Alertes envoyées pour ce bail</h2>
        {l.alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune alerte envoyée. Les emails partent à 30, 14 et 7 jours de l'expiration, puis le jour même, et après 5, 10 et 15 jours de retard de loyer.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {l.alerts.map((a: any) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{LEVELS[a.level as Level].emoji} {a.message}</span>
                <span className="text-slate-500">{a.recipient_type} · {a.recipient} · {new Date(a.created_at).toLocaleString('fr-FR')} · {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RenewForm({ lease, onDone, onCancel }: { lease: any; onDone: (id: number) => void; onCancel: () => void }) {
  const start = (() => {
    const [y, m, d] = lease.end_date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  })();
  const [form, setForm] = useState({ startDate: start, endDate: oneYearLater(start), monthlyRent: lease.monthly_rent, guaranteeAmount: lease.guarantee_amount });
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api(`/leases/${lease.id}/renew`, { method: 'POST', body: form });
      onDone(r.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="card mb-6 grid gap-4 border-brand-600 md:grid-cols-4">
      <h2 className="font-semibold md:col-span-4">Renouveler le bail</h2>
      <div className="md:col-span-4"><ErrorBox error={error} /></div>
      <Field label="Nouveau début"><input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
      <Field label="Nouvelle fin"><input className="input" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
      <Field label={`Loyer (${lease.currency})`}><input className="input" type="number" min={0} step="0.01" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })} /></Field>
      <Field label="Garantie"><input className="input" type="number" min={0} step="0.01" value={form.guaranteeAmount} onChange={(e) => setForm({ ...form, guaranteeAmount: Number(e.target.value) })} /></Field>
      <p className="text-xs text-slate-500 md:col-span-4">Le bail actuel sera archivé (statut « renouvelé ») et conservé dans l'historique.</p>
      <div className="flex gap-2 md:col-span-4">
        <button className="btn-primary">Confirmer le renouvellement</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function Payments({ lease, reload }: { lease: any; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ period: todayISO().slice(0, 7), amount: lease.monthly_rent, paidOn: todayISO(), method: 'especes', reference: '' });
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/leases/${lease.id}/payments`, { method: 'POST', body: form });
      setOpen(false);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (pid: number) => {
    if (!confirm('Supprimer ce paiement ?')) return;
    await api(`/leases/${lease.id}/payments/${pid}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await reload();
  };
  const schedule = [...lease.schedule].reverse();

  return (
    <section className="card mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Loyers</h2>
        <button className="btn-primary" onClick={() => setOpen(!open)}>+ Enregistrer un paiement</button>
      </div>
      <ErrorBox error={error} />
      {open && (
        <form onSubmit={submit} className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-5">
          <Field label="Mois concerné"><input className="input" type="month" required value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
          <Field label={`Montant (${lease.currency})`}><input className="input" type="number" min={0.01} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Payé le"><input className="input" type="date" required value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} /></Field>
          <Field label="Moyen">
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Référence"><input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="N° transaction…" /></Field>
          <div className="md:col-span-5"><button className="btn-primary">Enregistrer</button></div>
        </form>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600">Échéancier</h3>
          {schedule.length === 0 ? <p className="text-sm text-slate-500">Le bail n'a pas encore commencé.</p> : (
            <ul className="divide-y divide-slate-100">
              {schedule.map((s: any) => (
                <li key={s.period} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="capitalize">{month(s.period)}</span>
                  <span className="text-slate-500">{money(s.paid, lease.currency)} / {money(s.rent, lease.currency)}</span>
                  <Badge className={PAYMENT_STATES[s.state].cls}>{PAYMENT_STATES[s.state].label}{s.daysLate && s.state !== 'paye' ? ` · ${s.daysLate} j` : ''}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600">Paiements reçus</h3>
          {lease.payments.length === 0 ? <p className="text-sm text-slate-500">Aucun paiement enregistré.</p> : (
            <ul className="divide-y divide-slate-100">
              {lease.payments.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{date(p.paid_on)} · <span className="capitalize">{month(p.period)}</span></span>
                  <span className="text-slate-500">{PAYMENT_METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ''}</span>
                  <span className="font-medium">{money(p.amount, lease.currency)}</span>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-700 hover:underline" aria-label="Supprimer le paiement">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
