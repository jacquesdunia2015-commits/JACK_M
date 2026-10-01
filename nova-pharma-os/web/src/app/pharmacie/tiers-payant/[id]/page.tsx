import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import {
  ActivationBeneficiaire, EtablirReleve, FormulaireBeneficiaire, FormulairePayeur, Payeur,
} from '@/components/TiersPayant';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { date, dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { STATUTS_RELEVE, TYPES_PAYEUR, moisPrecedent } from '@/lib/tiers-payant';

interface Fiche {
  payer: Payeur;
  members: {
    id: string; member_number: string; full_name: string; principal_name: string | null; phone: string | null;
    coverage_percent: string | null; annual_ceiling: string | null; valid_until: string | null;
    is_active: boolean; consumed_this_year: string;
  }[];
  claims: {
    id: string; number: string; period_start: string; period_end: string; status: string;
    total: string; balance: string; due_date: string | null; sales: string;
  }[];
  unclaimed: {
    id: string; number: string; sold_at: string; total: string; payer_share: string; patient_share: string;
    authorization_number: string | null; member_name: string | null; member_number: string | null;
  }[];
}

/** Un organisme payeur : ses bénéficiaires, les ventes à lui présenter, ses relevés. */
export default async function PagePayeur({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('customers.read')) return <AccesReserve titre={(await traduire()).t('nav.tiers_payant')} />;
  const { id } = await params;
  const devise = await deviseSession();
  const f = await apiSafe<Fiche | null>(`/payers/${id}`, null);
  if (!f) notFound();
  const p = f.payer;
  const periode = moisPrecedent();
  const aPresenter = f.unclaimed.reduce((s, v) => s + Number(v.payer_share), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/tiers-payant">← Tiers payant</Link></p>
        <h1>{p.name}</h1>
        <p>
          <span className="tag">{TYPES_PAYEUR[p.kind] ?? p.kind}</span>{' '}
          <span className="mono">{p.code}</span> · prise en charge <strong>{Number(p.coverage_percent).toLocaleString('fr-FR')} %</strong>
          {p.per_sale_ceiling ? ` · au plus ${money(p.per_sale_ceiling, devise)} par vente` : ''}
          {' '}· règlement à {p.payment_days} jours
          {[p.contact_name, p.phone, p.email].filter(Boolean).length ? ` · ${[p.contact_name, p.phone, p.email].filter(Boolean).join(' · ')}` : ''}
          {!p.is_active && <> <span className="tag muted">inactif</span></>}
        </p>
      </div>

      {peut('customers.write') && (
        <section className="card">
          <Depliable resume="Modifier l’organisme">
            <FormulairePayeur payeur={p} />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Bénéficiaires</h2>
          <span className="hint">{f.members.filter((m) => m.is_active).length} carte(s) active(s)</span>
        </div>
        {peut('customers.write') && (
          <Depliable resume="Ajouter un bénéficiaire" ouvert={f.members.length === 0}>
            <FormulaireBeneficiaire payeurId={p.id} tauxPayeur={Number(p.coverage_percent)} />
          </Depliable>
        )}
        {f.members.length === 0 ? (
          <Vide message="Aucun bénéficiaire : ajoutez les cartes ou matricules des membres." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bénéficiaire</th>
                  <th>Carte</th>
                  <th className="num">Taux</th>
                  <th className="num">Consommé cette année</th>
                  <th>Validité</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {f.members.map((m) => {
                  const expiree = m.valid_until !== null && m.valid_until.slice(0, 10) < today;
                  return (
                    <tr key={m.id} className={m.is_active ? '' : 'muted'}>
                      <td>
                        <strong>{m.full_name}</strong>
                        {m.principal_name && <><br /><span className="small muted">ayant droit de {m.principal_name}</span></>}
                        {m.phone && <><br /><span className="small muted">{m.phone}</span></>}
                      </td>
                      <td className="mono">{m.member_number}</td>
                      <td className="num">{Number(m.coverage_percent ?? p.coverage_percent).toLocaleString('fr-FR')} %</td>
                      <td className="num">
                        {money(m.consumed_this_year, devise)}
                        {m.annual_ceiling && <><br /><span className="small muted">sur {money(m.annual_ceiling, devise)}</span></>}
                      </td>
                      <td>
                        {!m.is_active ? <span className="tag muted">désactivée</span>
                          : expiree ? <span className="tag danger">expirée le {date(m.valid_until)}</span>
                            : m.valid_until ? date(m.valid_until) : '—'}
                      </td>
                      <td>{peut('customers.write') && <ActivationBeneficiaire id={m.id} actif={m.is_active} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {peut('customers.credit') && (
        <section className="card">
          <div className="card-head">
            <h2>Ventes à présenter</h2>
            <span className="hint">{f.unclaimed.length} vente(s) · {money(aPresenter, devise)} à la charge de l’organisme</span>
          </div>
          <EtablirReleve payeurId={p.id} debut={periode.debut} fin={periode.fin} />
          {f.unclaimed.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vente</th>
                    <th>Bénéficiaire</th>
                    <th>Bon</th>
                    <th className="num">Montant</th>
                    <th className="num">Part patient</th>
                    <th className="num">Part organisme</th>
                  </tr>
                </thead>
                <tbody>
                  {f.unclaimed.map((v) => (
                    <tr key={v.id}>
                      <td className="small">{dateTime(v.sold_at)}</td>
                      <td><Link href={`/pharmacie/ventes/${v.id}`} className="mono">{v.number}</Link></td>
                      <td>{v.member_name ?? '—'}<br /><span className="small muted mono">{v.member_number}</span></td>
                      <td className="small">{v.authorization_number ?? '—'}</td>
                      <td className="num">{money(v.total, devise)}</td>
                      <td className="num">{money(v.patient_share, devise)}</td>
                      <td className="num"><strong>{money(v.payer_share, devise)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {peut('customers.credit') && f.claims.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Relevés</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Relevé</th>
                  <th>Période</th>
                  <th className="num">Ventes</th>
                  <th className="num">Total</th>
                  <th className="num">Reste dû</th>
                  <th>Échéance</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {f.claims.map((c) => {
                  const s = STATUTS_RELEVE[c.status] ?? { libelle: c.status, ton: 'muted' };
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/pharmacie/tiers-payant/releves/${c.id}`} className="mono">{c.number}</Link></td>
                      <td className="small">{date(c.period_start)} → {date(c.period_end)}</td>
                      <td className="num">{c.sales}</td>
                      <td className="num">{money(c.total, devise)}</td>
                      <td className="num">{money(c.balance, devise)}</td>
                      <td className="small">{c.due_date ? date(c.due_date) : '—'}</td>
                      <td><span className={`tag ${s.ton}`}>{s.libelle}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
