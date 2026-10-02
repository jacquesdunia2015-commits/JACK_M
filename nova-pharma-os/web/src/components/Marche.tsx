'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { envoyer, nombreSaisi } from '@/lib/envoi';
import { designation, money } from '@/lib/format';
import { DISPONIBILITE } from '@/lib/marche';

export interface OffreTrouvee {
  id: string; seller_id: string; name: string; dosage: string | null; presentation: string | null; manufacturer: string | null;
  unit_price: string; currency: string; min_quantity: string; availability: string; expiry_date: string | null;
  seller_name: string; seller_city: string | null; min_order_amount: string; delivery_zones: string | null; payment_terms: string | null;
}


interface Ligne { offre: OffreTrouvee; quantite: number }

/** Résultats de recherche et panier : une commande par vendeur. */
export function AchatMarche({ offres }: { offres: OffreTrouvee[] }) {
  const router = useRouter();
  const [panier, setPanier] = useState<Ligne[]>([]);
  const [message, setMessage] = useState<{ ton: string; texte: string; lien?: string | null } | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const parVendeur = panier.reduce<Record<string, Ligne[]>>((acc, l) => { (acc[l.offre.seller_id] ??= []).push(l); return acc; }, {});

  async function commander(vendeur: string) {
    setEnvoi(vendeur);
    setMessage(null);
    const lignes = parVendeur[vendeur];
    const r = await envoyer<{ number: string; total: number; whatsappLink: string | null }>('/market/orders', {
      sellerOrganizationId: vendeur, lines: lignes.map((l) => ({ offerId: l.offre.id, quantity: l.quantite })),
    });
    setEnvoi(null);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `Commande ${r.body.number} envoyée à ${lignes[0].offre.seller_name}.`, lien: r.body.whatsappLink });
    setPanier((p) => p.filter((l) => l.offre.seller_id !== vendeur));
    router.refresh();
  }

  return (
    <>
      {message && (
        <div className={`banner ${message.ton}`}>
          {message.texte}{' '}
          {message.lien && <a href={message.lien} target="_blank" rel="noopener noreferrer">Prévenir le vendeur sur WhatsApp</a>}
        </div>
      )}
      {offres.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produit</th><th>Vendeur</th><th className="num">Prix unitaire</th><th>Disponibilité</th><th>Quantité</th></tr></thead>
            <tbody>
              {offres.map((o) => {
                const dans = panier.find((l) => l.offre.id === o.id);
                return (
                  <tr key={o.id}>
                    <td>
                      <strong>{designation(o.name, o.dosage)}</strong>
                      <div className="small muted">{[o.presentation, o.manufacturer].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="small">
                      {o.seller_name}{o.seller_city ? ` — ${o.seller_city}` : ''}
                      <div className="muted">{[o.delivery_zones ? `livre : ${o.delivery_zones}` : null, Number(o.min_order_amount) > 0 ? `minimum ${money(o.min_order_amount, o.currency)}` : null].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="num">{money(o.unit_price, o.currency)}<div className="small muted">dès {Number(o.min_quantity).toLocaleString('fr-FR')}</div></td>
                    <td>
                      <span className={`tag ${DISPONIBILITE[o.availability]?.ton ?? 'muted'}`}>{DISPONIBILITE[o.availability]?.libelle ?? o.availability}</span>
                      {o.expiry_date && <div className="small muted">exp. {new Date(`${o.expiry_date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' })}</div>}
                    </td>
                    <td>
                      {dans ? (
                        <div className="row" style={{ gap: '0.3rem', flexWrap: 'nowrap' }}>
                          <input type="number" min={Number(o.min_quantity)} value={dans.quantite} aria-label="Quantité" style={{ width: '6rem' }}
                            onChange={(e) => setPanier((p) => p.map((l) => (l.offre.id === o.id ? { ...l, quantite: Number(e.target.value) || 0 } : l)))} />
                          <button type="button" className="secondaire petit" aria-label="Retirer" onClick={() => setPanier((p) => p.filter((l) => l.offre.id !== o.id))}>✕</button>
                        </div>
                      ) : (
                        <button type="button" className="petit" onClick={() => setPanier((p) => [...p, { offre: o, quantite: Number(o.min_quantity) }])}>Ajouter</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {Object.entries(parVendeur).map(([vendeur, lignes]) => {
        const total = lignes.reduce((s, l) => s + l.quantite * Number(l.offre.unit_price), 0);
        const minimum = Number(lignes[0].offre.min_order_amount);
        return (
          <div key={vendeur} className="panier-vendeur">
            <div>
              <strong>{lignes[0].offre.seller_name}</strong> · {lignes.length} produit(s) · <strong>{money(total, lignes[0].offre.currency)}</strong>
              {total < minimum && <span className="small" style={{ color: 'var(--attention)' }}> — minimum {money(minimum, lignes[0].offre.currency)}</span>}
              {lignes[0].offre.payment_terms && <div className="small muted">Règlement : {lignes[0].offre.payment_terms}</div>}
            </div>
            <button type="button" disabled={envoi === vendeur || total < minimum} onClick={() => void commander(vendeur)}>{envoi === vendeur ? 'Envoi…' : 'Envoyer la commande'}</button>
          </div>
        );
      })}
    </>
  );
}

/** Actions du vendeur sur une commande reçue. */
export function ActionsVente({ id, statut }: { id: string; statut: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const action = async (chemin: string, corps: unknown = {}) => {
    setErreur(null);
    const r = await envoyer(`/market/orders/${id}/${chemin}`, corps);
    if (!r.ok) { setErreur(r.message); return; }
    router.refresh();
  };
  return (
    <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
      {statut === 'sent' && <button type="button" className="petit" onClick={() => void action('accept')}>Accepter</button>}
      {statut === 'sent' && <button type="button" className="secondaire petit" onClick={() => { const n = window.prompt('Raison du refus ?', 'Rupture de stock'); if (n && n.trim().length >= 3) void action('reject', { note: n }); }}>Refuser</button>}
      {statut === 'accepted' && <button type="button" className="petit" onClick={() => void action('ship')}>Expédiée</button>}
      {erreur && <div className="small" style={{ color: 'var(--alerte)', width: '100%', textAlign: 'right' }}>{erreur}</div>}
    </div>
  );
}

interface ProduitTrouve { id: string; name: string; dosage: string | null }

/** Choisir un produit du catalogue de la pharmacie. */
function ChoixProduitCatalogue({ valeur, onChange, suggestion }: { valeur: ProduitTrouve | null; onChange: (p: ProduitTrouve | null) => void; suggestion: string }) {
  const [terme, setTerme] = useState(suggestion.split(' ')[0] ?? '');
  const [resultats, setResultats] = useState<ProduitTrouve[]>([]);
  useEffect(() => {
    if (valeur || terme.trim().length < 2) { setResultats([]); return; }
    const m = setTimeout(async () => {
      const r = await fetch(`/api/proxy/catalog/products?q=${encodeURIComponent(terme.trim())}&pageSize=6`).catch(() => null);
      setResultats(r?.ok ? (await r.json()).data ?? [] : []);
    }, 220);
    return () => clearTimeout(m);
  }, [terme, valeur]);
  if (valeur) return <span><strong>{designation(valeur.name, valeur.dosage)}</strong> <button type="button" className="secondaire petit" onClick={() => onChange(null)}>Changer</button></span>;
  return (
    <>
      <input value={terme} onChange={(e) => setTerme(e.target.value)} aria-label="Produit de mon catalogue" placeholder="Produit de mon catalogue" />
      {resultats.length > 0 && (
        <div className="offres-liste" style={{ marginTop: '0.3rem' }}>
          {resultats.map((p) => <button type="button" key={p.id} className="offre" onClick={() => onChange(p)}>{designation(p.name, p.dosage)}</button>)}
        </div>
      )}
    </>
  );
}

/** Réception d'une commande de la place de marché : produit, lot et péremption de chaque ligne. */
export function ReceptionMarche({ id, lignes }: { id: string; lignes: { name: string; quantity: number }[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(lignes.map(() => ({ produit: null as ProduitTrouve | null, lot: '', peremption: '' })));
  const [erreur, setErreur] = useState<string | null>(null);
  if (!ouvert) return <button type="button" className="petit" onClick={() => setOuvert(true)}>Réceptionner</button>;
  return (
    <form style={{ display: 'grid', gap: '0.5rem', minWidth: 320 }} onSubmit={async (e) => {
      e.preventDefault();
      setErreur(null);
      const choisies = v.map((x, index) => ({ ...x, index })).filter((x) => x.produit);
      const r = await envoyer(`/market/orders/${id}/receive`, {
        lines: choisies.map((x) => ({ index: x.index, productId: x.produit?.id, lotNumber: x.lot.trim() || undefined, expiryDate: x.peremption || undefined })),
      });
      if (!r.ok) { setErreur(r.message); return; }
      router.refresh();
    }}>
      {lignes.map((l, i) => (
        <div key={i} className="reception-ligne">
          <div className="small"><strong>{l.quantity.toLocaleString('fr-FR')} × {l.name}</strong></div>
          <ChoixProduitCatalogue valeur={v[i].produit} suggestion={l.name} onChange={(p) => setV((x) => x.map((y, j) => (j === i ? { ...y, produit: p } : y)))} />
          <div className="row" style={{ gap: '0.35rem' }}>
            <input aria-label="Lot" placeholder="Lot" value={v[i].lot} onChange={(e) => setV((x) => x.map((y, j) => (j === i ? { ...y, lot: e.target.value } : y)))} style={{ width: '8rem' }} />
            <input aria-label="Péremption" type="date" value={v[i].peremption} onChange={(e) => setV((x) => x.map((y, j) => (j === i ? { ...y, peremption: e.target.value } : y)))} />
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: '0.35rem' }}>
        <button type="submit" className="petit" disabled={!v.some((x) => x.produit)}>Entrer en stock</button>
        <button type="button" className="secondaire petit" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
    </form>
  );
}

export function AnnulerAchat({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="secondaire petit" onClick={async () => { if (window.confirm('Annuler cette commande ?')) { const r = await envoyer(`/market/orders/${id}/cancel`, {}); if (r.ok) router.refresh(); } }}>Annuler</button>;
}

export interface FicheVendeur {
  is_listed: boolean; display_name: string; city: string | null; province?: string | null; phone: string | null; whatsapp?: string | null;
  delivery_zones?: string | null; min_order_amount: string; payment_terms?: string | null; description?: string | null;
}

/** Fiche de vendeur : publiée, elle rend les offres visibles de toutes les pharmacies. */
export function FormulaireFicheVendeur({ fiche }: { fiche: FicheVendeur }) {
  const router = useRouter();
  const [v, setV] = useState({
    isListed: fiche.is_listed, displayName: fiche.display_name ?? '', city: fiche.city ?? '', whatsapp: fiche.whatsapp ?? fiche.phone ?? '',
    deliveryZones: fiche.delivery_zones ?? '', minOrderAmount: String(Number(fiche.min_order_amount ?? 0)), paymentTerms: fiche.payment_terms ?? '', description: fiche.description ?? '',
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/market/seller', { ...v, minOrderAmount: nombreSaisi(v.minOrderAmount) ?? 0 }, 'PUT');
      setMessage(r.ok ? { ton: 'info', texte: v.isListed ? 'Fiche publiée : vos offres actives sont visibles.' : 'Fiche enregistrée (non publiée).' } : { ton: 'danger', texte: r.message });
      if (r.ok) router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <label className="case"><input type="checkbox" checked={v.isListed} onChange={maj('isListed')} /> <strong>Vendre sur la place de marché</strong> (fiche et offres visibles des autres pharmacies)</label>
      <div className="grid grid-3" style={{ gap: '0 1rem', marginTop: '0.5rem' }}>
        <div className="field"><label htmlFor="mv-nom">Nom affiché</label><input id="mv-nom" value={v.displayName} onChange={maj('displayName')} required /></div>
        <div className="field"><label htmlFor="mv-ville">Ville</label><input id="mv-ville" value={v.city} onChange={maj('city')} /></div>
        <div className="field"><label htmlFor="mv-wa">WhatsApp des commandes</label><input id="mv-wa" inputMode="tel" value={v.whatsapp} onChange={maj('whatsapp')} /></div>
        <div className="field"><label htmlFor="mv-zones">Zones de livraison</label><input id="mv-zones" value={v.deliveryZones} onChange={maj('deliveryZones')} placeholder="Goma, Bukavu, Butembo" /></div>
        <div className="field"><label htmlFor="mv-min">Commande minimum</label><input id="mv-min" inputMode="decimal" value={v.minOrderAmount} onChange={maj('minOrderAmount')} /></div>
        <div className="field"><label htmlFor="mv-reglement">Règlement</label><input id="mv-reglement" value={v.paymentTerms} onChange={maj('paymentTerms')} placeholder="Comptant à la livraison" /></div>
      </div>
      <button type="submit">Enregistrer</button>
    </form>
  );
}

/** Nouvelle offre : un produit du catalogue (disponibilité suivie) ou un article libre. */
export function NouvelleOffre() {
  const router = useRouter();
  const [produit, setProduit] = useState<ProduitTrouve | null>(null);
  const [v, setV] = useState({ name: '', presentation: '', unitPrice: '', minQuantity: '1', availability: 'in_stock' });
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setErreur(null);
      const r = await envoyer('/market/offers', {
        productId: produit?.id, name: produit ? undefined : v.name.trim(), presentation: v.presentation.trim() || undefined,
        unitPrice: nombreSaisi(v.unitPrice), minQuantity: nombreSaisi(v.minQuantity), availability: v.availability,
      });
      if (!r.ok) { setErreur(r.message); return; }
      setProduit(null); setV({ name: '', presentation: '', unitPrice: '', minQuantity: '1', availability: 'in_stock' });
      router.refresh();
    }}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field"><label>Produit de mon catalogue</label><ChoixProduitCatalogue valeur={produit} onChange={setProduit} suggestion="" /></div>
        {!produit && <div className="field"><label htmlFor="no-nom">…ou article libre</label><input id="no-nom" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Gants d’examen" /></div>}
        <div className="field"><label htmlFor="no-pres">Présentation</label><input id="no-pres" value={v.presentation} onChange={(e) => setV({ ...v, presentation: e.target.value })} placeholder="Boîte de 100" /></div>
        <div className="field"><label htmlFor="no-prix">Prix unitaire</label><input id="no-prix" inputMode="decimal" value={v.unitPrice} onChange={(e) => setV({ ...v, unitPrice: e.target.value })} required /></div>
        <div className="field"><label htmlFor="no-min">Quantité minimum</label><input id="no-min" inputMode="decimal" value={v.minQuantity} onChange={(e) => setV({ ...v, minQuantity: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="no-dispo">Disponibilité</label>
          <select id="no-dispo" value={v.availability} onChange={(e) => setV({ ...v, availability: e.target.value })}>
            {Object.entries(DISPONIBILITE).filter(([c]) => c !== 'out').map(([c, d]) => <option key={c} value={c}>{d.libelle}</option>)}
          </select>
        </div>
      </div>
      <button type="submit">Publier l’offre</button>
    </form>
  );
}

export function BasculeOffre({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return <button type="button" className="secondaire petit" onClick={async () => { const r = await envoyer(`/market/offers/${id}`, { isActive: !active }, 'PATCH'); if (r.ok) router.refresh(); }}>{active ? 'Retirer' : 'Republier'}</button>;
}

export function ActualiserOffres() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="secondaire" onClick={async () => {
        const r = await envoyer<{ updated: number }>('/market/offers/refresh', {});
        setMessage(r.ok ? `${r.body.updated} offre(s) mise(s) à jour depuis votre stock.` : r.message);
        router.refresh();
      }}>Mettre à jour depuis mon stock</button>
      {message && <span className="small" style={{ marginLeft: '0.5rem' }}>{message}</span>}
    </>
  );
}
