import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AttribuerFournisseur, DocumentFournisseur, StatutRequisition } from '@/components/ActionsRequisition';
import { apiSafe } from '@/lib/api';
import { dateCourte } from '@/lib/peremption';
import { nomPays } from '@/lib/pays';
import { STATUTS_REQUISITION as STATUTS } from '@/lib/requisitions';

interface Ligne {
  id: string; product_id: string | null; sku: string | null; product_name: string;
  presentation: string | null; quantity: string; supplier_id: string | null;
  supplier_name: string | null; supplier_phone: string | null; supplier_email: string | null;
  supplier_city: string | null; supplier_country: string | null;
  unit_price: string | null; currency: string | null; notes: string | null;
}

interface Requisition {
  id: string; number: string; status: string; needed_by: string | null; notes: string | null;
  created_at: string; sent_at: string | null; created_by_name: string | null; lines: Ligne[];
}

const montant = (valeur: number, devise: string | null) =>
  `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${devise ? ` ${devise}` : ''}`;
const qte = (v: string) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

/** Une réquisition : ce qui est demandé à chaque fournisseur, et son document. */
export default async function PageRequisition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, fournisseurs] = await Promise.all([
    apiSafe<Requisition | null>(`/purchasing/requisitions/${id}`, null),
    apiSafe<{ id: string; name: string; is_active: boolean }[]>('/purchasing/suppliers', []),
  ]);
  if (!r) notFound();
  const actifs = fournisseurs.filter((f) => f.is_active);

  // Une section par fournisseur : c'est aussi le découpage du PDF.
  const groupes = new Map<string, Ligne[]>();
  for (const l of r.lines) {
    const cle = l.supplier_id ?? '';
    groupes.set(cle, [...(groupes.get(cle) ?? []), l]);
  }

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/requisitions">← Réquisitions</Link></p>
        <h1 className="mono">{r.number}</h1>
        <p>
          <span className={`tag ${STATUTS[r.status]?.ton ?? ''}`}>{STATUTS[r.status]?.libelle ?? r.status}</span>
          {' '}Créée le {new Date(r.created_at).toLocaleDateString('fr-FR')}
          {r.created_by_name ? ` par ${r.created_by_name}` : ''}
          {r.needed_by ? ` · livraison souhaitée le ${dateCourte(r.needed_by)}` : ''}
          {r.sent_at ? ` · envoyée le ${new Date(r.sent_at).toLocaleDateString('fr-FR')}` : ''}
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Document complet</h2>
          <span className="hint">Un fournisseur par page</span>
        </div>
        <DocumentFournisseur requisitionId={r.id} numero={r.number} fournisseur={null}
          resume={r.lines.map((l) => `- ${l.product_name} : ${qte(l.quantity)}`).join('\n')} />
        <div style={{ marginTop: '0.9rem' }}>
          <StatutRequisition requisitionId={r.id} statut={r.status} />
        </div>
        {r.notes && <p className="small" style={{ marginBottom: 0 }}><strong>Remarques :</strong> {r.notes}</p>}
      </section>

      {[...groupes.entries()].map(([fournisseurId, lignes]) => {
        const f = lignes[0];
        const totaux = new Map<string, number>();
        for (const l of lignes) {
          if (l.unit_price !== null) totaux.set(l.currency ?? '', (totaux.get(l.currency ?? '') ?? 0) + Number(l.unit_price) * Number(l.quantity));
        }
        return (
          <section className="card" key={fournisseurId || 'aucun'}>
            <div className="card-head">
              <h2>{fournisseurId ? f.supplier_name : 'Fournisseur à choisir'}</h2>
              <span className="hint">
                {fournisseurId
                  ? [f.supplier_phone, f.supplier_email, [f.supplier_city, f.supplier_country ? nomPays(f.supplier_country) : null].filter(Boolean).join(', ')]
                      .filter(Boolean).join(' · ')
                  : r.status === 'brouillon'
                    ? 'Choisissez un fournisseur pour chaque produit'
                    : 'Repassez la réquisition en brouillon pour attribuer ces produits'}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="num">Quantité</th>
                    <th className="num">Prix unitaire</th>
                    <th className="num">Montant</th>
                    {!fournisseurId && r.status === 'brouillon' && <th>Fournisseur</th>}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.product_id ? <Link href={`/pharmacie/stock/${l.product_id}`}>{l.product_name}</Link> : l.product_name}
                        {(l.presentation || l.sku) && <><br /><span className="small muted">{[l.presentation, l.sku].filter(Boolean).join(' · ')}</span></>}
                      </td>
                      <td className="num">{qte(l.quantity)}</td>
                      <td className="num">{l.unit_price === null ? '—' : montant(Number(l.unit_price), l.currency)}</td>
                      <td className="num">{l.unit_price === null ? '—' : montant(Number(l.unit_price) * Number(l.quantity), l.currency)}</td>
                      {!fournisseurId && r.status === 'brouillon' && (
                        <td>
                          <AttribuerFournisseur requisitionId={r.id} lignes={r.lines} ligneId={l.id} fournisseurs={actifs} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {[...totaux.entries()].map(([devise, total]) => (
              <p key={devise} className="num" style={{ textAlign: 'right', margin: '0.6rem 0' }}>
                Total estimé : <strong>{montant(total, devise || null)}</strong>
              </p>
            ))}
            {fournisseurId && (
              <DocumentFournisseur
                requisitionId={r.id}
                numero={r.number}
                fournisseur={{ id: fournisseurId, nom: f.supplier_name as string, telephone: f.supplier_phone, email: f.supplier_email }}
                resume={lignes.map((l) => `- ${l.product_name}${l.presentation ? ` (${l.presentation})` : ''} : ${qte(l.quantity)}`).join('\n')}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
