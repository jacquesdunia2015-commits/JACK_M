import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import {
  AchatMarche, ActionsVente, ActualiserOffres, AnnulerAchat, BasculeOffre, FormulaireFicheVendeur, NouvelleOffre, ReceptionMarche,
  type FicheVendeur, type OffreTrouvee,
} from '@/components/Marche';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { dateTime, designation, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { DISPONIBILITE } from '@/lib/marche';

interface Commande {
  id: string; number: string; status: string; total: string; currency: string; buyer_name: string; buyer_city: string | null;
  buyer_phone: string | null; seller_name: string; buyer_note: string | null; seller_note: string | null; delivery_preference: string | null;
  lines: { name: string; presentation: string | null; quantity: number; unitPrice: number }[]; created_at: string;
  seller_b2b_order_id: string | null;
}
interface Offre { id: string; name: string; dosage: string | null; presentation: string | null; unit_price: string; currency: string; min_quantity: string; availability: string; is_active: boolean; product_id: string | null }

const STATUTS: Record<string, { libelle: string; ton: string }> = {
  sent: { libelle: 'Envoyée', ton: 'warn' }, accepted: { libelle: 'Acceptée', ton: 'ok' }, rejected: { libelle: 'Refusée', ton: 'danger' },
  shipped: { libelle: 'Expédiée', ton: 'ok' }, received: { libelle: 'Reçue', ton: 'muted' }, cancelled: { libelle: 'Annulée', ton: 'muted' },
};
const ONGLETS = [['acheter', 'Acheter'], ['achats', 'Mes commandes'], ['ventes', 'Commandes reçues'], ['vendre', 'Vendre']] as const;

/** Place de marché entre pharmacies et dépôts. */
export default async function PageMarche({ searchParams }: { searchParams: Promise<{ onglet?: string; q?: string; ville?: string }> }) {
  const { peut } = await droits();
  if (!peut('purchasing.read') && !peut('b2b.read')) return <AccesReserve titre={(await traduire()).t('nav.marche')} />;
  const sp = await searchParams;
  const onglet = ONGLETS.some(([c]) => c === sp.onglet) ? sp.onglet as string : 'acheter';

  const [offres, achats, ventes, fiche, mesOffres] = await Promise.all([
    onglet === 'acheter' && sp.q ? apiSafe<OffreTrouvee[]>(`/market/search?q=${encodeURIComponent(sp.q)}${sp.ville ? `&city=${encodeURIComponent(sp.ville)}` : ''}`, []) : Promise.resolve([]),
    onglet === 'achats' ? apiSafe<Commande[]>('/market/orders', []) : Promise.resolve([]),
    onglet === 'ventes' ? apiSafe<Commande[]>('/market/orders?side=sales', []) : Promise.resolve([]),
    onglet === 'vendre' ? apiSafe<FicheVendeur | null>('/market/seller', null) : Promise.resolve(null),
    onglet === 'vendre' ? apiSafe<Offre[]>('/market/offers/mine', []) : Promise.resolve([]),
  ]);
  const lignes = (c: Commande) => c.lines.map((l) => `${l.quantity.toLocaleString('fr-FR')} × ${l.name}`).join(' · ');

  return (
    <>
      <div className="page-head">
        <h1>Place de marché</h1>
        <p>Achetez directement aux dépôts et aux pharmacies de la plateforme, comparez les prix, et vendez vos surplus. Aucun paiement ne passe par NOVA : vous réglez comme d’habitude.</p>
      </div>
      <nav className="onglets" aria-label="Sections de la place de marché">
        {ONGLETS.map(([c, l]) => <Link key={c} href={`/pharmacie/marche?onglet=${c}`} className={onglet === c ? 'actif' : undefined} aria-current={onglet === c ? 'page' : undefined}>{l}</Link>)}
      </nav>

      {onglet === 'acheter' && (
        <section className="card">
          <form className="row" style={{ alignItems: 'end', gap: '0.75rem' }} method="get">
            <input type="hidden" name="onglet" value="acheter" />
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}><label htmlFor="mk-q">Produit</label><input id="mk-q" name="q" defaultValue={sp.q ?? ''} placeholder="Amoxicilline, gants, perfuseur…" required minLength={2} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="mk-ville">Ville de livraison (facultatif)</label><input id="mk-ville" name="ville" defaultValue={sp.ville ?? ''} placeholder="Goma" /></div>
            <button type="submit">Chercher</button>
          </form>
          {sp.q && offres.length === 0 && <Vide message="Aucune offre pour ce produit pour l’instant." />}
          <div style={{ marginTop: '0.75rem' }}><AchatMarche offres={offres} /></div>
        </section>
      )}

      {onglet === 'achats' && (
        <section className="card">
          {achats.length === 0 ? <Vide message="Aucune commande passée sur la place de marché." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Commande</th><th>Vendeur</th><th>Produits</th><th className="num">Total</th><th>État</th><th /></tr></thead>
                <tbody>
                  {achats.map((c) => (
                    <tr key={c.id}>
                      <td><span className="mono">{c.number}</span><div className="small muted">{dateTime(c.created_at)}</div></td>
                      <td>{c.seller_name}{c.seller_note && <div className="small muted">« {c.seller_note} »</div>}</td>
                      <td className="small">{lignes(c)}</td>
                      <td className="num">{money(c.total, c.currency)}</td>
                      <td><span className={`tag ${STATUTS[c.status]?.ton ?? 'muted'}`}>{STATUTS[c.status]?.libelle ?? c.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {['accepted', 'shipped'].includes(c.status) && peut('purchasing.receive') && <ReceptionMarche id={c.id} lignes={c.lines} />}
                        {['sent', 'accepted'].includes(c.status) && peut('purchasing.write') && <AnnulerAchat id={c.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'ventes' && (
        <section className="card">
          {ventes.length === 0 ? <Vide message="Aucune commande reçue. Publiez vos offres dans « Vendre »." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Commande</th><th>Acheteur</th><th>Produits</th><th className="num">Total</th><th>État</th><th /></tr></thead>
                <tbody>
                  {ventes.map((c) => (
                    <tr key={c.id}>
                      <td><span className="mono">{c.number}</span><div className="small muted">{dateTime(c.created_at)}</div></td>
                      <td>{c.buyer_name}<div className="small muted">{[c.buyer_city, c.buyer_phone].filter(Boolean).join(' · ')}</div>{c.delivery_preference && <div className="small">Livraison : {c.delivery_preference}</div>}</td>
                      <td className="small">{lignes(c)}{c.buyer_note && <div className="muted">« {c.buyer_note} »</div>}</td>
                      <td className="num">{money(c.total, c.currency)}</td>
                      <td>
                        <span className={`tag ${STATUTS[c.status]?.ton ?? 'muted'}`}>{STATUTS[c.status]?.libelle ?? c.status}</span>
                        {c.seller_b2b_order_id && <div className="small"><Link href="/pharmacie/b2b">commande professionnelle créée</Link></div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{peut('b2b.write') && <ActionsVente id={c.id} statut={c.status} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'vendre' && fiche && (
        <>
          <section className="card">
            <Depliable resume={fiche.is_listed ? 'Ma fiche de vendeur (publiée)' : 'Ma fiche de vendeur — à publier'} ouvert={!fiche.is_listed}>
              <FormulaireFicheVendeur fiche={fiche} />
            </Depliable>
          </section>
          <section className="card">
            <div className="card-head"><h2>Mes offres</h2>{peut('b2b.write') && <ActualiserOffres />}</div>
            {peut('b2b.write') && <Depliable resume="Publier une offre" ouvert={mesOffres.length === 0}><NouvelleOffre /></Depliable>}
            {mesOffres.length > 0 && (
              <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                <table>
                  <thead><tr><th>Produit</th><th className="num">Prix</th><th className="num">Minimum</th><th>Disponibilité</th><th /></tr></thead>
                  <tbody>
                    {mesOffres.map((o) => (
                      <tr key={o.id} className={o.is_active ? undefined : 'muted'}>
                        <td>{designation(o.name, o.dosage)}<div className="small muted">{o.presentation}{o.product_id ? ' · relié au stock' : ''}</div></td>
                        <td className="num">{money(o.unit_price, o.currency)}</td>
                        <td className="num">{Number(o.min_quantity).toLocaleString('fr-FR')}</td>
                        <td>{o.is_active ? <span className={`tag ${DISPONIBILITE[o.availability]?.ton ?? 'muted'}`}>{DISPONIBILITE[o.availability]?.libelle ?? o.availability}</span> : <span className="tag muted">Retirée</span>}</td>
                        <td style={{ textAlign: 'right' }}>{peut('b2b.write') && <BasculeOffre id={o.id} active={o.is_active} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
