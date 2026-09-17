import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money } from '@/lib/format';

interface Client {
  id: string; code: string; kind: string; name: string; phone: string | null;
  city: string | null; credit_limit: string; outstanding_balance: string;
  is_credit_blocked: boolean; purchases: string; lifetime_value: string;
  last_purchase_at: string | null;
}

interface BalanceAgee {
  id: string; code: string; name: string; kind: string;
  outstanding_balance: string; not_due: string; days_1_30: string;
  days_31_60: string; days_61_90: string; days_over_90: string;
}

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q, kind } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (kind) params.set('kind', kind);

  const [clients, balance] = await Promise.all([
    apiSafe<Client[]>(`/customers?${params}`, []),
    apiSafe<BalanceAgee[]>('/customers/aged-receivables', []),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Clients</h1>
        <p>Particuliers et clients professionnels (B2B), encours et historique.</p>
      </div>

      {balance.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Balance âgée des créances</h2>
            <span className="hint">Ancienneté des sommes dues</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="num">Non échu</th>
                  <th className="num">1–30 j</th>
                  <th className="num">31–60 j</th>
                  <th className="num">61–90 j</th>
                  <th className="num">+ 90 j</th>
                  <th className="num">Total dû</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.name}
                      <br />
                      <span className="small muted mono">{b.code}</span>
                    </td>
                    <td className="num">{money(b.not_due)}</td>
                    <td className="num">{money(b.days_1_30)}</td>
                    <td className="num">{money(b.days_31_60)}</td>
                    <td className="num">{money(b.days_61_90)}</td>
                    <td className="num">
                      {Number(b.days_over_90) > 0 ? (
                        <span className="tag danger">{money(b.days_over_90)}</span>
                      ) : (
                        money(b.days_over_90)
                      )}
                    </td>
                    <td className="num">
                      <strong>{money(b.outstanding_balance)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Fichier clients</h2>
          <span className="hint">{clients.length} client(s)</span>
        </div>

        <form className="row" style={{ marginBottom: '1rem' }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nom, code ou téléphone…"
            style={{ maxWidth: 320 }}
          />
          <select name="kind" defaultValue={kind ?? ''} style={{ maxWidth: 220 }}>
            <option value="">Tous les clients</option>
            <option value="individual">Particuliers</option>
            <option value="professional">Professionnels (B2B)</option>
          </select>
          <button type="submit" className="secondaire">
            Filtrer
          </button>
        </form>

        {clients.length === 0 ? (
          <Vide message="Aucun client enregistré." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Téléphone</th>
                  <th className="num">Achats</th>
                  <th className="num">Cumul</th>
                  <th className="num">Encours</th>
                  <th className="num">Plafond</th>
                  <th className="num">Dernier achat</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const encours = Number(c.outstanding_balance);
                  const plafond = Number(c.credit_limit);
                  const tendu = plafond > 0 && encours / plafond > 0.8;
                  return (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <br />
                        <span className="small muted mono">{c.code}</span>
                      </td>
                      <td>
                        <span className="tag">
                          {c.kind === 'professional' ? 'Professionnel' : 'Particulier'}
                        </span>
                        {c.is_credit_blocked && (
                          <span className="tag danger" style={{ marginLeft: '0.3rem' }}>
                            Crédit bloqué
                          </span>
                        )}
                      </td>
                      <td className="small">{c.phone ?? '—'}</td>
                      <td className="num">{c.purchases}</td>
                      <td className="num">{money(c.lifetime_value)}</td>
                      <td className="num">
                        {encours > 0 ? (
                          <span className={tendu ? 'tag danger' : 'tag warn'}>
                            {money(encours)}
                          </span>
                        ) : (
                          money(0)
                        )}
                      </td>
                      <td className="num muted">{money(c.credit_limit)}</td>
                      <td className="num small">{date(c.last_purchase_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
