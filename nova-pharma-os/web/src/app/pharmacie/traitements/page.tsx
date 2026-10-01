import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { ArretTraitement, FormulaireTraitement, RappelWhatsApp } from '@/components/Traitements';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { date, designation, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { echeance, ETATS_TRAITEMENT, MALADIES } from '@/lib/traitements';

interface Traitement {
  id: string; customer_id: string; customer_name: string; customer_phone: string | null;
  product_name: string; product_dosage: string | null; condition: string;
  days_per_unit: string; remind_days_before: number; last_dispensed_at: string | null;
  last_quantity: string | null; next_refill_date: string | null; days_left: number | null;
  etat: string; deja_prevenu: boolean; reminders_sent: number; last_reminded_at: string | null;
  is_active: boolean; notes: string | null;
}

/**
 * Traitements suivis des malades chroniques : qui prévenir aujourd'hui
 * avant la fin de sa boîte, et la liste complète des patients suivis.
 */
export default async function PageTraitements() {
  const { peut } = await droits();
  if (!peut('customers.read')) return <AccesReserve titre={(await traduire()).t('nav.traitements')} />;
  const tous = await apiSafe<Traitement[]>('/treatments', []);
  const aPrevenir = tous.filter((t) => t.etat === 'a_prevenir' || t.etat === 'en_retard');
  const actifs = tous.filter((t) => t.is_active);
  const peutPrevenir = peut('messaging.write');

  return (
    <>
      <div className="page-head">
        <h1>Traitements suivis</h1>
        <p>
          Diabète, hypertension, VIH, asthme… Prévenez vos patients quelques jours avant la fin de leur boîte :
          ils ne coupent pas leur traitement et reviennent chez vous. Le message part du WhatsApp de la pharmacie, sans frais.
        </p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
        <div className="stat">
          <div className="stat-label">À prévenir</div>
          <div className="stat-value">{aPrevenir.filter((t) => !t.deja_prevenu).length}</div>
          <div className="stat-note">{aPrevenir.filter((t) => t.deja_prevenu).length} déjà prévenu(s)</div>
        </div>
        <div className="stat">
          <div className="stat-label">Boîte finie, pas revenu</div>
          <div className="stat-value">{tous.filter((t) => t.etat === 'en_retard').length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Patients suivis</div>
          <div className="stat-value">{new Set(actifs.map((t) => t.customer_id)).size}</div>
          <div className="stat-note">{actifs.length} traitement(s) en cours</div>
        </div>
      </div>

      {peut('customers.write') && (
        <section className="card">
          <Depliable resume="Suivre le traitement d’un patient" ouvert={tous.length === 0}>
            <FormulaireTraitement />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>À prévenir</h2>
          <span className="hint">Boîte finie ou qui finit bientôt</span>
        </div>
        {aPrevenir.length === 0 ? (
          <Vide message="Personne à prévenir pour l’instant." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Patient</th><th>Médicament</th><th>Fin de la boîte</th><th>État</th><th /></tr>
              </thead>
              <tbody>
                {aPrevenir.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.customer_name}</strong>
                      <div className="small muted">{t.customer_phone ?? 'pas de téléphone'}</div>
                    </td>
                    <td>
                      {designation(t.product_name, t.product_dosage)}
                      <div className="small muted">{MALADIES[t.condition] ?? t.condition}</div>
                    </td>
                    <td>
                      {date(t.next_refill_date)}
                      <div className="small muted">{echeance(t.days_left)}</div>
                    </td>
                    <td>
                      <span className={`tag ${ETATS_TRAITEMENT[t.etat]?.ton ?? 'muted'}`}>{ETATS_TRAITEMENT[t.etat]?.libelle ?? t.etat}</span>
                      {t.deja_prevenu && <div className="small muted">prévenu le {date(t.last_reminded_at)}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {peutPrevenir && <RappelWhatsApp id={t.id} dejaPrevenu={t.deja_prevenu} telephone={t.customer_phone} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Tous les traitements suivis</h2>
          <span className="hint">Chaque vente au patient recalcule la date de fin</span>
        </div>
        {tous.length === 0 ? (
          <Vide message="Aucun traitement suivi : commencez par vos patients diabétiques et hypertendus fidèles." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Patient</th><th>Médicament</th><th>Une boîte</th><th>Dernière délivrance</th><th>Fin</th><th>État</th><th /></tr>
              </thead>
              <tbody>
                {tous.map((t) => (
                  <tr key={t.id} className={t.is_active ? undefined : 'muted'}>
                    <td>{t.customer_name}</td>
                    <td>
                      {designation(t.product_name, t.product_dosage)}
                      <div className="small muted">{MALADIES[t.condition] ?? t.condition}{t.notes ? ` · ${t.notes}` : ''}</div>
                    </td>
                    <td>{quantity(t.days_per_unit)} j</td>
                    <td>
                      {t.last_dispensed_at ? date(t.last_dispensed_at) : '—'}
                      {t.last_quantity && <div className="small muted">{quantity(t.last_quantity)} boîte(s)</div>}
                    </td>
                    <td>{t.next_refill_date ? date(t.next_refill_date) : '—'}</td>
                    <td>
                      <span className={`tag ${ETATS_TRAITEMENT[t.etat]?.ton ?? 'muted'}`}>{ETATS_TRAITEMENT[t.etat]?.libelle ?? t.etat}</span>
                      {t.reminders_sent > 0 && <div className="small muted">{t.reminders_sent} rappel(s)</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {peut('customers.write') && <ArretTraitement id={t.id} actif={t.is_active} />}
                    </td>
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
