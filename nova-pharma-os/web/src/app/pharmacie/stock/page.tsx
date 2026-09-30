import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { estNiveau, LIBELLE_NIVEAU, NIVEAUX, NiveauStock } from '@/lib/niveau-stock';

interface LigneStock {
  product_id: string; sku: string; name: string; unit: string;
  reorder_point: string; on_hand: string; available: string;
  stock_value: string; lots: string; nearest_expiry: string | null;
  expired_quantity: string;
  sales_last_30_days: string; stock_level: NiveauStock; days_of_cover: number | null;
}

interface Alerte {
  id: string; kind: string; severity: string; message: string;
  sku: string; product_name: string; lot_number: string | null;
  expiry_date: string | null; created_at: string;
}

export default async function PageStock({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; niveau?: string }>;
}) {
  const { q, niveau } = await searchParams;
  const filtre = estNiveau(niveau) ? niveau : null;
  const { t } = await traduire();
  const requete = q ? `?search=${encodeURIComponent(q)}` : '';

  const [stock, alertes] = await Promise.all([
    apiSafe<LigneStock[]>(`/inventory/stock${requete}`, []),
    apiSafe<Alerte[]>('/inventory/alerts', []),
  ]);

  const valeurTotale = stock.reduce((s, l) => s + Number(l.stock_value), 0);
  const compte = Object.fromEntries(
    NIVEAUX.map((n) => [n, stock.filter((l) => l.stock_level === n).length]),
  ) as Record<NiveauStock, number>;
  // Le plus urgent en tête : un produit en rupture ne doit pas se perdre
  // entre deux produits bien approvisionnés.
  const lignes = stock
    .filter((l) => !filtre || l.stock_level === filtre)
    .sort((a, b) => NIVEAUX.indexOf(a.stock_level) - NIVEAUX.indexOf(b.stock_level));
  const lien = (n: NiveauStock | null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (n) params.set('niveau', n);
    const chaine = params.toString();
    return chaine ? `?${chaine}` : '?';
  };

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
          {filtre && <input type="hidden" name="niveau" value={filtre} />}
        </form>

        <nav className="niveaux" aria-label={t('stock.niveau')}>
          <a href={lien(null)} className={filtre ? '' : 'actif'}>
            {t('stock.tous')} <strong>{stock.length}</strong>
          </a>
          {NIVEAUX.map((n) => (
            <a key={n} href={lien(n)} className={filtre === n ? 'actif' : ''}>
              <span className={`niveau ${n}`} aria-hidden="true" />
              {t(LIBELLE_NIVEAU[n])} <strong>{compte[n]}</strong>
            </a>
          ))}
        </nav>
        <p className="small muted" style={{ marginTop: 0 }}>{t('stock.regle')}</p>

        {lignes.length === 0 ? (
          <Vide message={t('general.aucune_donnee')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('catalogue.produit')}</th>
                  <th>{t('stock.niveau')}</th>
                  <th className="num">{t('stock.en_stock')}</th>
                  <th className="num">{t('stock.couverture')}</th>
                  <th className="num">{t('stock.disponible')}</th>
                  <th className="num">{t('stock.seuil')}</th>
                  <th className="num">{t('stock.lots')}</th>
                  <th className="num">{t('stock.peremption_proche')}</th>
                  <th className="num">{t('general.valeur')}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  return (
                    <tr key={l.product_id} className={`niveau-${l.stock_level}`}>
                      <td>
                        {l.name}
                        <br />
                        <span className="small muted mono">{l.sku}</span>
                      </td>
                      <td>
                        <span className={`niveau ${l.stock_level}`}>
                          {t(LIBELLE_NIVEAU[l.stock_level])}
                        </span>
                      </td>
                      <td className="num">
                        {quantity(l.on_hand)} {l.unit}
                      </td>
                      <td className="num small">
                        {l.days_of_cover === null
                          ? '—'
                          : `≈ ${l.days_of_cover} ${t('stock.jours_abrege')}`}
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
