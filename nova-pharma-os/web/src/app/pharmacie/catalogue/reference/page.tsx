import Link from 'next/link';
import ImportReference, { ProduitReference } from '@/components/ImportReference';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';

interface Reference {
  referenceCurrency: string;
  currency: string;
  categories: Record<string, string>;
  items: ProduitReference[];
}

/**
 * Catalogue de référence Goma–Bukavu : les médicaments et produits courants
 * au Kivu, à reprendre en un clic au lieu de les saisir un à un.
 */
export default async function PageCatalogueReference() {
  if (!(await droits()).peut('catalog.write')) return <AccesReserve titre={(await traduire()).t('nav.catalogue')} />;
  const ref = await apiSafe<Reference | null>('/catalog/reference', null);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/catalogue">← Catalogue</Link></p>
        <h1>Catalogue de référence Goma–Bukavu</h1>
        <p>
          {ref?.items.length ?? 100} médicaments et produits parmi les plus demandés dans les officines du Nord et du Sud-Kivu :
          paludisme, infections, diarrhées, douleurs, vers, tension et diabète, peau, planning familial, solutés et consommables.
        </p>
      </div>

      <section className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          Sélection établie d&apos;après la Liste nationale des médicaments essentiels de la RD Congo et les besoins les plus
          fréquents au comptoir. Les prix proposés sont indicatifs, en {ref?.referenceCurrency ?? 'USD'} : vérifiez-les et
          remplacez-les par les vôtres. Vous pourrez toujours les modifier ensuite depuis la fiche du produit.
        </p>
        {ref ? (
          <ImportReference
            produits={ref.items}
            categories={ref.categories}
            devise={ref.currency}
            deviseReference={ref.referenceCurrency}
          />
        ) : (
          <Vide message="Catalogue de référence indisponible pour le moment." />
        )}
      </section>
    </>
  );
}
