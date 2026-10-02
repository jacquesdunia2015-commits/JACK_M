import Link from 'next/link';
import { notFound } from 'next/navigation';
import ActivationFournisseur from '@/components/ActivationFournisseur';
import CatalogueFournisseur, {
  ArticleFournisseur, ProduitCatalogue,
} from '@/components/CatalogueFournisseur';
import FormulaireFournisseur, { FicheFournisseur } from '@/components/FormulaireFournisseur';
import { apiSafe } from '@/lib/api';
import { lienWhatsApp, nomPays } from '@/lib/pays';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';

interface Fournisseur extends FicheFournisseur {
  id: string; name: string; code: string; is_active: boolean; currency: string | null;
  products: ArticleFournisseur[];
}

/** Fiche d'un fournisseur : coordonnées, catalogue et prix. */
export default async function PageFournisseur({ params }: { params: Promise<{ id: string }> }) {
  if (!(await droits()).peut('suppliers.read')) return <AccesReserve titre={(await traduire()).t('nav.fournisseurs')} />;
  const { id } = await params;
  const [fournisseur, catalogue] = await Promise.all([
    apiSafe<Fournisseur | null>(`/purchasing/suppliers/${id}`, null),
    apiSafe<{ data: ProduitCatalogue[] }>('/catalog/products?pageSize=1000', { data: [] }),
  ]);
  if (!fournisseur) notFound();
  const whatsapp = lienWhatsApp(fournisseur.phone);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/fournisseurs">← Fournisseurs</Link></p>
        <h1>{fournisseur.name}</h1>
        <p>
          {[fournisseur.city, nomPays(fournisseur.country_code)].filter((v) => v && v !== '—').join(', ')}
          {fournisseur.phone && (
            <>
              {' · '}<a href={`tel:${fournisseur.phone}`} className="mono">{fournisseur.phone}</a>
              {whatsapp && <>{' · '}<a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></>}
            </>
          )}
          {fournisseur.email && <>{' · '}<a href={`mailto:${fournisseur.email}`}>{fournisseur.email}</a></>}
        </p>
      </div>

      {!fournisseur.is_active && (
        <div className="banner warn">
          Ce fournisseur est désactivé : il n&apos;apparaît plus dans la comparaison des prix.
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Produits et prix</h2>
          <span className="hint">
            « Modifier » change le prix et les dates ; un clic sur la disponibilité la bascule
          </span>
        </div>
        <CatalogueFournisseur
          fournisseurId={fournisseur.id}
          articles={fournisseur.products}
          produits={catalogue.data}
          devise={fournisseur.currency ?? 'USD'}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Coordonnées</h2>
          <span className="hint mono">{fournisseur.code}</span>
        </div>
        <FormulaireFournisseur fiche={fournisseur} />
        <div style={{ marginTop: '1rem' }}>
          <ActivationFournisseur id={fournisseur.id} actif={fournisseur.is_active} nom={fournisseur.name} />
        </div>
      </section>
    </>
  );
}
