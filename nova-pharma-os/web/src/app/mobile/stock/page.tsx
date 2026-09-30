import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { LIBELLE_NIVEAU, NIVEAUX, NiveauStock } from '@/lib/niveau-stock';
import { CLASSE_PEREMPTION, CLE_PEREMPTION, NiveauPeremption } from '@/lib/peremption';

interface LigneStock {
  product_id: string;
  sku: string;
  name: string;
  on_hand: string;
  available: string;
  reorder_point: string;
  stock_value: string;
  nearest_expiry: string | null;
  stock_level: NiveauStock;
  expiry_level: NiveauPeremption | null;
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
          {[...stock]
            .sort((a, b) => NIVEAUX.indexOf(a.stock_level) - NIVEAUX.indexOf(b.stock_level))
            .slice(0, 60)
            .map((l) => {
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
                <span className="mob-niveaux">
                  <span className={`niveau ${l.stock_level}`}>{t(LIBELLE_NIVEAU[l.stock_level])}</span>
                  {l.expiry_level && l.expiry_level !== 'eloignee' && (
                    <span className={`niveau ${CLASSE_PEREMPTION[l.expiry_level]}`}>
                      {t(CLE_PEREMPTION[l.expiry_level])}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
