import Link from 'next/link';
import FormulaireRequisition, {
  FournisseurRequisition, ProduitRequisition,
} from '@/components/FormulaireRequisition';
import LogoPharmacie from '@/components/LogoPharmacie';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateCourte } from '@/lib/peremption';
import { STATUTS_REQUISITION as STATUTS } from '@/lib/requisitions';

interface Requisition {
  id: string; number: string; status: string; needed_by: string | null; created_at: string;
  created_by_name: string | null; lines: string; suppliers: string; supplier_names: string | null;
  estimated_total: string; currency: string | null;
}

/**
 * Réquisitions : dire à chaque fournisseur ce qu'on lui demande, à partir
 * de la comparaison de leurs prix, et lui envoyer le document en PDF.
 */
export default async function PageRequisitions({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string }>;
}) {
  const { produit } = await searchParams;
  const [requisitions, catalogue, fournisseurs, logo] = await Promise.all([
    apiSafe<Requisition[]>('/purchasing/requisitions', []),
    apiSafe<{ data: ProduitRequisition[] }>('/catalog/products?pageSize=200', { data: [] }),
    apiSafe<(FournisseurRequisition & { is_active: boolean })[]>('/purchasing/suppliers', []),
    apiSafe<{ logo: string | null }>('/admin/logo', { logo: null }),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Réquisitions</h1>
        <p>Ce qu&apos;il faut acheter, chez quel fournisseur, au meilleur prix — puis le bon en PDF à envoyer.</p>
      </div>

      <section className="card" id="nouvelle">
        <details className="depliable" open={Boolean(produit) || requisitions.length === 0}>
          <summary>Nouvelle réquisition</summary>
          <FormulaireRequisition
            produits={catalogue.data}
            fournisseurs={fournisseurs.filter((f) => f.is_active)}
            produitInitial={produit}
          />
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Vos réquisitions</h2>
          <span className="hint">{requisitions.length} réquisition(s)</span>
        </div>
        {requisitions.length === 0 ? (
          <Vide message="Aucune réquisition pour l'instant." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Statut</th>
                  <th>Fournisseurs</th>
                  <th className="num">Produits</th>
                  <th className="num">Total estimé</th>
                  <th className="num">Livraison souhaitée</th>
                  <th className="num">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/pharmacie/requisitions/${r.id}`} className="mono"><strong>{r.number}</strong></Link></td>
                    <td><span className={`tag ${STATUTS[r.status]?.ton ?? ''}`}>{STATUTS[r.status]?.libelle ?? r.status}</span></td>
                    <td className="small">{r.supplier_names ?? 'À choisir'}</td>
                    <td className="num">{r.lines}</td>
                    <td className="num">
                      {Number(r.estimated_total) > 0
                        ? `${Number(r.estimated_total).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency ?? ''}`
                        : '—'}
                    </td>
                    <td className="num small">{dateCourte(r.needed_by)}</td>
                    <td className="num small">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Logo de la pharmacie</h2>
          <span className="hint">Imprimé en tête de chaque réquisition</span>
        </div>
        <LogoPharmacie logo={logo.logo} />
      </section>
    </>
  );
}
