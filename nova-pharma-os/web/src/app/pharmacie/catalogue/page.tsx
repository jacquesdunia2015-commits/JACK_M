import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { money, quantity } from '@/lib/format';

interface Produit {
  id: string; sku: string; name: string; commercial_name: string | null;
  dosage: string | null; dosage_form: string | null; packaging: string | null;
  unit: string; sale_price: string; cost_price: string; wholesale_price: string;
  requires_prescription: boolean; is_controlled: boolean; is_cold_chain: boolean;
  category_name: string | null; inn: string | null; on_hand: string;
}

export default async function PageCatalogue({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const params = new URLSearchParams({ pageSize: '50' });
  if (q) params.set('q', q);
  if (page) params.set('page', page);

  const data = await apiSafe<{
    data: Produit[];
    pagination: { page: number; pages: number; total: number };
  }>(`/catalog/products?${params}`, {
    data: [],
    pagination: { page: 1, pages: 0, total: 0 },
  });

  return (
    <>
      <div className="page-head">
        <h1>Catalogue</h1>
        <p>{data.pagination.total} référence(s) au catalogue.</p>
      </div>

      <section className="card">
        <form style={{ marginBottom: '1rem', maxWidth: 400 }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nom, référence, molécule ou code-barres…"
          />
        </form>

        {data.data.length === 0 ? (
          <Vide message="Aucun produit ne correspond." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Molécule</th>
                  <th>Catégorie</th>
                  <th className="num">Prix de revient</th>
                  <th className="num">Prix de vente</th>
                  <th className="num">Marge</th>
                  <th className="num">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => {
                  const pv = Number(p.sale_price);
                  const pr = Number(p.cost_price);
                  const marge = pv > 0 ? ((pv - pr) / pv) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.dosage ? ` ${p.dosage}` : ''}
                        <div className="small muted">
                          <span className="mono">{p.sku}</span>
                          {p.packaging ? ` · ${p.packaging}` : ''}
                        </div>
                        <div className="row" style={{ gap: '0.3rem', marginTop: '0.2rem' }}>
                          {p.requires_prescription && (
                            <span className="tag warn">Ordonnance</span>
                          )}
                          {p.is_controlled && <span className="tag danger">Contrôlé</span>}
                          {p.is_cold_chain && <span className="tag">Chaîne du froid</span>}
                        </div>
                      </td>
                      <td className="small">{p.inn ?? '—'}</td>
                      <td className="small">{p.category_name ?? '—'}</td>
                      <td className="num">{money(p.cost_price)}</td>
                      <td className="num">
                        <strong>{money(p.sale_price)}</strong>
                      </td>
                      <td className="num">
                        {marge.toFixed(0)} %
                      </td>
                      <td className="num">{quantity(p.on_hand)}</td>
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
