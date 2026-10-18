import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import {
  BasculeCategorie, GererClient, NouvelleCategorie, ReglagesFidelite,
  type Categorie, type ProgrammeFidelite,
} from '@/components/Fidelite';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Programme extends ProgrammeFidelite {
  outstandingPoints: number; outstandingValue: number; customersWithPoints: number;
  month: { earned: number; redeemed: number; redeemedValue: number };
}

interface Tableau {
  customers: { id: string; code: string; name: string; phone: string | null; loyalty_points: number; group_name: string | null; last_entry_at: string | null }[];
  entries: { id: string; kind: string; points: number; balance_after: number; amount: string | null; reason: string | null; created_at: string; customer_name: string; sale_number: string | null }[];
}

const MOUVEMENTS: Record<string, string> = {
  earn: 'Gagnés', redeem: 'Utilisés', reverse: 'Annulation', adjust: 'Ajustement', welcome: 'Bienvenue',
};

/**
 * Fidélité : points gagnés à chaque achat et utilisés à la caisse, remise
 * permanente par catégorie de clients.
 */
export default async function PageFidelite() {
  const { peut } = await droits();
  if (!peut('customers.read')) return <AccesReserve titre={(await traduire()).t('nav.fidelite')} />;
  const devise = await deviseSession();
  const [programme, tableau, categories] = await Promise.all([
    apiSafe<Programme | null>('/loyalty/program', null),
    apiSafe<Tableau>('/loyalty/dashboard', { customers: [], entries: [] }),
    apiSafe<Categorie[]>('/loyalty/groups', []),
  ]);
  const gerer = peut('customers.write');

  return (
    <>
      <div className="page-head">
        <h1>Fidélité</h1>
        <p>
          Récompensez les clients qui reviennent : des points à chaque achat, utilisables à la caisse, et une remise
          permanente pour certaines catégories (personnel, clients fidèles…). Gratuit, sans carte à imprimer : le client est reconnu par son nom ou son téléphone.
        </p>
      </div>

      {programme && (
        <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
          <div className="stat">
            <div className="stat-label">Points en circulation</div>
            <div className="stat-value">{programme.outstandingPoints.toLocaleString('fr-FR')}</div>
            <div className="stat-note">soit {money(programme.outstandingValue, devise)} de remises promises · {programme.customersWithPoints} client(s)</div>
          </div>
          <div className="stat">
            <div className="stat-label">Ce mois-ci</div>
            <div className="stat-value">+{programme.month.earned.toLocaleString('fr-FR')}</div>
            <div className="stat-note">{programme.month.redeemed.toLocaleString('fr-FR')} point(s) utilisé(s) · {money(programme.month.redeemedValue, devise)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Programme</div>
            <div className="stat-value">{programme.is_enabled ? 'Activé' : 'Désactivé'}</div>
            <div className="stat-note">
              {programme.is_enabled
                ? `${programme.points_per_unit.toLocaleString('fr-FR')} point(s) par ${devise === 'CDF' ? 'FC' : devise} · 100 points = ${money(programme.point_value * 100, devise)}`
                : 'Activez-le ci-dessous'}
            </div>
          </div>
        </div>
      )}

      {gerer && programme && (
        <section className="card">
          <Depliable resume="Réglages du programme de points" ouvert={!programme.is_enabled}>
            <ReglagesFidelite programme={programme} devise={devise} />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Catégories de clients et remises</h2>
          <span className="hint">La remise s’applique d’office à la caisse dès que le client est choisi</span>
        </div>
        {categories.length === 0 ? (
          <Vide message="Aucune catégorie : créez par exemple « Personnel » à 10 % ou « Clients fidèles » à 5 %." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Catégorie</th><th>Remise</th><th>Clients</th><th>État</th><th /></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong> <span className="small muted mono">{c.code}</span></td>
                    <td>{Number(c.discount_percent).toLocaleString('fr-FR')} %</td>
                    <td>{c.customers}</td>
                    <td><span className={`tag ${c.is_active ? 'ok' : 'muted'}`}>{c.is_active ? 'Active' : 'Désactivée'}</span></td>
                    <td style={{ textAlign: 'right' }}>{gerer && <BasculeCategorie id={c.id} actif={c.is_active} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gerer && <div style={{ marginTop: '0.75rem' }}><NouvelleCategorie /></div>}
      </section>

      {gerer && (
        <section className="card">
          <div className="card-head"><h2>Un client</h2><span className="hint">Ranger dans une catégorie, offrir ou retirer des points</span></div>
          <GererClient categories={categories} />
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Meilleurs clients</h2><span className="hint">Par points détenus</span></div>
        {tableau.customers.length === 0 ? (
          <Vide message="Aucun client n’a encore de points. Choisissez le client à la caisse pour qu’il en gagne." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Catégorie</th><th style={{ textAlign: 'right' }}>Points</th><th style={{ textAlign: 'right' }}>Valeur</th><th>Dernier mouvement</th></tr></thead>
              <tbody>
                {tableau.customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}<div className="small muted">{[c.code, c.phone].filter(Boolean).join(' · ')}</div></td>
                    <td>{c.group_name ?? '—'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{c.loyalty_points.toLocaleString('fr-FR')}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{programme ? money(c.loyalty_points * programme.point_value, devise) : '—'}</td>
                    <td className="small">{c.last_entry_at ? dateTime(c.last_entry_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Derniers mouvements</h2></div>
        {tableau.entries.length === 0 ? (
          <Vide message="Aucun mouvement de points." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Client</th><th>Mouvement</th><th style={{ textAlign: 'right' }}>Points</th><th style={{ textAlign: 'right' }}>Solde</th><th>Détail</th></tr></thead>
              <tbody>
                {tableau.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="small">{dateTime(e.created_at)}</td>
                    <td>{e.customer_name}</td>
                    <td>{MOUVEMENTS[e.kind] ?? e.kind}</td>
                    <td className="mono" style={{ textAlign: 'right', color: e.points < 0 ? 'var(--alerte)' : 'var(--ok)' }}>{e.points > 0 ? '+' : ''}{e.points}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{e.balance_after}</td>
                    <td className="small">{e.reason ?? ''}{e.amount ? ` · ${money(e.amount, devise)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
