import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { ActionsReservation, ReglagesPagePublique, type ProfilPublic } from '@/components/Reservations';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Reservation {
  id: string; number: string; customer_name: string; customer_phone: string; customer_id: string | null;
  lines: { productId: string; name: string; quantity: number; unitPrice: number; available: boolean }[];
  message: string | null; pickup_preference: string | null; has_prescription: boolean; has_photo: boolean;
  status: string; staff_note: string | null; created_at: string; handled_by_name: string | null;
}

const STATUTS: Record<string, { libelle: string; ton: string }> = {
  new: { libelle: 'Nouvelle', ton: 'danger' }, confirmed: { libelle: 'Confirmée', ton: 'warn' }, ready: { libelle: 'Prête', ton: 'ok' },
  collected: { libelle: 'Retirée', ton: 'muted' }, cancelled: { libelle: 'Annulée', ton: 'muted' },
};

/** Réservations et photos d'ordonnance reçues par la page publique. */
export default async function PageReservations({ searchParams }: { searchParams: Promise<{ tout?: string }> }) {
  const { peut } = await droits();
  if (!peut('sales.read')) return <AccesReserve titre={(await traduire()).t('nav.reservations')} />;
  const devise = await deviseSession();
  const { tout } = await searchParams;
  const [liste, profil] = await Promise.all([
    apiSafe<Reservation[]>(`/reservations${tout ? '?status=all' : ''}`, []),
    peut('settings.read') ? apiSafe<ProfilPublic | null>('/public-profile', null) : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Réservations</h1>
        <p>Les demandes de vos clients depuis votre page publique : médicaments réservés et photos d’ordonnance. Préparez, prévenez sur WhatsApp, encaissez au retrait.</p>
      </div>

      {profil && peut('settings.write') && (
        <section className="card">
          <Depliable resume={profil.is_published ? 'Votre page publique (publiée)' : 'Votre page publique — à publier'} ouvert={!profil.is_published}>
            <ReglagesPagePublique profil={profil} />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>{tout ? 'Toutes les demandes' : 'À traiter'}</h2>
          <a className="hint" href={tout ? '/pharmacie/reservations' : '/pharmacie/reservations?tout=1'}>{tout ? 'Seulement celles à traiter' : 'Voir aussi les demandes closes'}</a>
        </div>
        {liste.length === 0 ? (
          <Vide message="Aucune demande en attente." />
        ) : (
          <div className="liste-reservations">
            {liste.map((r) => (
              <article key={r.id} className="reservation">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className={`tag ${STATUTS[r.status]?.ton ?? 'muted'}`}>{STATUTS[r.status]?.libelle ?? r.status}</span>{' '}
                    <strong className="mono">{r.number}</strong> · {dateTime(r.created_at)}
                    <div><strong>{r.customer_name}</strong> · <a href={`tel:${r.customer_phone}`}>{r.customer_phone}</a>{r.customer_id ? <span className="small muted"> · client connu</span> : null}</div>
                    {r.pickup_preference && <div className="small">Passera : {r.pickup_preference}</div>}
                    {r.message && <div className="small">« {r.message} »</div>}
                  </div>
                  <ActionsReservation id={r.id} statut={r.status} peutPrevenir={peut('messaging.write')} />
                </div>
                {r.lines.length > 0 && (
                  <ul className="small" style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                    {r.lines.map((l) => (
                      <li key={l.productId}>
                        {l.quantity} × {l.name} — {money(l.unitPrice * l.quantity, devise)}{' '}
                        {!l.available && <span className="tag warn">pas en stock à la demande</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {r.has_photo && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary>Voir la photo de l’ordonnance</summary>
                    <img src={`/api/proxy/reservations/${r.id}/prescription`} alt={`Ordonnance de ${r.customer_name}`} className="photo-ordonnance" loading="lazy" />
                  </details>
                )}
                {r.has_prescription && !r.has_photo && <p className="small muted">Photo d’ordonnance effacée (30 jours après la clôture).</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
