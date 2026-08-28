import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface LigneStock {
  product_id: string; sku: string; name: string; unit: string;
  reorder_point: string; on_hand: string; available: string;
  stock_value: string; lots: string; nearest_expiry: string | null;
  expired_quantity: string;
}

interface Alerte {
  id: string; kind: string; severity: string; message: string;
  sku: string; product_name: string; lot_number: string | null;
  expiry_date: string | null; created_at: string;
}

export default async function PageStock({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { t } = await traduire();
  const requete = q ? `?search=${encodeURIComponent(q)}` : '';

  const [stock, alertes] = await Promise.all([
    apiSafe<LigneStock[]>(`/inventory/stock${requete}`, []),
    apiSafe<Alerte[]>('/inventory/alerts', []),
  ]);

  const valeurTotale = stock.reduce((s, l) => s + Number(l.stock_value), 0);

  return (
    <>
      <div className="page-head">
        <h1>{t('stock.titre')}</h1>
        <p>{t('stock.sous_titre')}</p>
      </div>

      {alertes.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t('stock.alertes_ouvertes')}</h2>
            <span className="hint">{alertes.length} {t('general.a_traiter')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('general.nature')}</th>
                  <th>{t('catalogue.produit')}</th>
                  <th>{t('general.lot')}</th>
                  <th>{t('general.message')}</th>
                  <th className="num">{t('general.echeance')}</th>
                </tr>
              </thead>
              <tbody>
                {alertes.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Etiquette statut={a.kind} />
                    </td>
                    <td>
                      {a.product_name}
                      <br />
                      <span className="small muted mono">{a.sku}</span>
                    </td>
                    <td className="mono small">{a.lot_number ?? '—'}</td>
                    <td className="small">{a.message}</td>
                    <td className="num small">{date(a.expiry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>{t('stock.positions')}</h2>
          <span className="hint">{t('stock.valeur_totale')} : {money(valeurTotale)}</span>
        </div>

        <form style={{ marginBottom: '1rem', maxWidth: 360 }}>
          <input name="q" defaultValue={q ?? ''} placeholder={`${t('caisse.rechercher_produit')}…`} />
        </form>

        {stock.length === 0 ? (
          <Vide message={t('general.aucune_donnee')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('catalogue.produit')}</th>
                  <th className="num">{t('stock.en_stock')}</th>
                  <th className="num">{t('stock.disponible')}</th>
                  <th className="num">{t('stock.seuil')}</th>
                  <th className="num">{t('stock.lots')}</th>
                  <th className="num">{t('stock.peremption_proche')}</th>
                  <th className="num">{t('general.valeur')}</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((l) => {
                  const enStock = Number(l.on_hand);
                  const seuil = Number(l.reorder_point);
                  const sousSeuil = seuil > 0 && enStock <= seuil;
                  return (
                    <tr key={l.product_id}>
                      <td>
                        {l.name}
                        <br />
                        <span className="small muted mono">{l.sku}</span>
                      </td>
                      <td className="num">
                        {enStock <= 0 ? (
                          <span className="tag danger">{t('stock.rupture')}</span>
                        ) : (
                          <span className={sousSeuil ? 'tag warn' : ''}>
                            {quantity(l.on_hand)} {l.unit}
                          </span>
                        )}
                      </td>
                      <td className="num">{quantity(l.available)}</td>
                      <td className="num muted">{quantity(l.reorder_point)}</td>
                      <td className="num">{l.lots}</td>
                      <td className="num">{date(l.nearest_expiry)}</td>
                      <td className="num">{money(l.stock_value)}</td>
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
