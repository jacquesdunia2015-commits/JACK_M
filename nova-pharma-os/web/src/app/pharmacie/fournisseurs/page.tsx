import Link from 'next/link';
import FormulaireFournisseur from '@/components/FormulaireFournisseur';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { lienWhatsApp, nomPays } from '@/lib/pays';

interface Fournisseur {
  id: string; name: string; phone: string | null; email: string | null;
  city: string | null; country_code: string | null; is_active: boolean;
  products: string; available_products: string;
}

interface Offre {
  id: string; name: string; sku: string | null; presentation: string | null;
  price: string; currency: string | null; min_order_quantity: string;
  is_available: boolean; is_cheapest: boolean; price_updated_at: string;
  supplier_id: string; supplier_name: string; supplier_city: string | null;
  supplier_phone: string | null; article: string;
}

const prix = (valeur: string, devise: string | null) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: devise ?? 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(Number(valeur));

/**
 * Répertoire des fournisseurs : les dépôts de la pharmacie, leurs
 * coordonnées, et la comparaison de leurs prix produit par produit.
 */
export default async function PageFournisseurs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; produit?: string }>;
}) {
  const { q, produit } = await searchParams;
  const recherche = produit?.trim() ?? '';
  const [fournisseurs, offres] = await Promise.all([
    apiSafe<Fournisseur[]>(`/purchasing/suppliers${q ? `?search=${encodeURIComponent(q)}` : ''}`, []),
    recherche.length >= 2
      ? apiSafe<Offre[]>(`/purchasing/suppliers/price-comparison?search=${encodeURIComponent(recherche)}`, [])
      : Promise.resolve([] as Offre[]),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Fournisseurs</h1>
        <p>Vos dépôts pharmaceutiques, leurs coordonnées, leurs produits et leurs prix.</p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Comparer les prix</h2>
          <span className="hint">Le moins cher des fournisseurs qui l&apos;ont en stock est surligné</span>
        </div>
        <form style={{ marginBottom: '1rem', maxWidth: 420 }}>
          <input name="produit" defaultValue={recherche} placeholder="Nom du produit ou du médicament…" />
          {q && <input type="hidden" name="q" value={q} />}
        </form>
        {recherche.length >= 2 &&
          (offres.length === 0 ? (
            <Vide message={`Aucun fournisseur n'a « ${recherche} » dans son catalogue.`} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Fournisseur</th>
                    <th className="num">Prix</th>
                    <th className="num">Minimum</th>
                    <th>Disponibilité</th>
                    <th className="num">Prix du</th>
                  </tr>
                </thead>
                <tbody>
                  {offres.map((o) => (
                    <tr key={o.id} className={o.is_cheapest ? 'offre-meilleure' : ''}>
                      <td>
                        {o.name}
                        {o.presentation && <><br /><span className="small muted">{o.presentation}</span></>}
                      </td>
                      <td>
                        <Link href={`/pharmacie/fournisseurs/${o.supplier_id}`}>{o.supplier_name}</Link>
                        <br />
                        <span className="small muted">{[o.supplier_city, o.supplier_phone].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="num">
                        <strong>{prix(o.price, o.currency)}</strong>
                        {o.is_cheapest && <><br /><span className="tag ok">Le moins cher</span></>}
                      </td>
                      <td className="num small">{Number(o.min_order_quantity)}</td>
                      <td>
                        <span className={`tag ${o.is_available ? 'ok' : 'danger'}`}>
                          {o.is_available ? 'Disponible' : 'En rupture'}
                        </span>
                      </td>
                      <td className="num small">{new Date(o.price_updated_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Vos fournisseurs</h2>
          <span className="hint">{fournisseurs.length} fournisseur(s)</span>
        </div>
        <form style={{ marginBottom: '1rem', maxWidth: 360 }}>
          <input name="q" defaultValue={q ?? ''} placeholder="Nom, ville ou téléphone…" />
          {recherche && <input type="hidden" name="produit" value={recherche} />}
        </form>
        {fournisseurs.length === 0 ? (
          <Vide message="Aucun fournisseur enregistré. Ajoutez le premier ci-dessous." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fournisseur</th>
                  <th>Téléphone</th>
                  <th>Adresse e-mail</th>
                  <th>Ville, pays</th>
                  <th className="num">Produits</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {fournisseurs.map((f) => {
                  const whatsapp = lienWhatsApp(f.phone);
                  return (
                    <tr key={f.id}>
                      <td><Link href={`/pharmacie/fournisseurs/${f.id}`}><strong>{f.name}</strong></Link></td>
                      <td className="small">
                        {f.phone ? (
                          <>
                            <a href={`tel:${f.phone}`} className="mono">{f.phone}</a>
                            {whatsapp && <> · <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="small">{f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : '—'}</td>
                      <td className="small">{[f.city, nomPays(f.country_code)].filter((v) => v && v !== '—').join(', ') || '—'}</td>
                      <td className="num small">
                        {f.available_products} / {f.products}
                      </td>
                      <td>
                        <span className={`tag ${f.is_active ? 'ok' : 'danger'}`}>
                          {f.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Enregistrer un fournisseur</h2>
          <span className="hint">Nom et téléphone suffisent ; le reste peut attendre</span>
        </div>
        <FormulaireFournisseur />
      </section>
    </>
  );
}
