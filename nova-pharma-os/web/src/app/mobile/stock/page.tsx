import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface LigneStock {
  product_id: string;
  sku: string;
  name: string;
  on_hand: string;
  available: string;
  reorder_point: string;
  stock_value: string;
  nearest_expiry: string | null;
}

export default async function PageStockMobile({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { t } = await traduire();
  const requete = q ? `?search=${encodeURIComponent(q)}` : '';
  const stock = await apiSafe<LigneStock[]>(`/inventory/stock${requete}`, []);

  return (
    <>
      <h1 className="mob-titre">{t('nav.stock')}</h1>

      <form className="mob-formulaire" method="get">
        <input
          className="mob-recherche"
          name="q"
          defaultValue={q ?? ''}
          placeholder={t('caisse.rechercher_produit')}
          inputMode="search"
        />
      </form>

      {stock.length === 0 ? (
        <p className="mob-vide">{t('general.aucune_donnee')}</p>
      ) : (
        <ul className="mob-liste">
          {stock.slice(0, 60).map((l) => {
            const bas = Number(l.available) <= Number(l.reorder_point);
            return (
              <li key={l.product_id}>
                <div>
                  <strong>{l.name}</strong>
                  <span className="mob-note">
                    {quantity(l.available)} {t('stock.disponible').toLowerCase()} ·{' '}
                    {money(l.stock_value)}
                    {l.nearest_expiry ? ` · ${date(l.nearest_expiry)}` : ''}
                  </span>
                </div>
                {bas && <span className="mob-etat failed">{t('stock.stock_bas')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
