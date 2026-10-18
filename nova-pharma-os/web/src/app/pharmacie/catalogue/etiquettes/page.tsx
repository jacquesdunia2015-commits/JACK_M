import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import PlancheEtiquettes from '@/components/PlancheEtiquettes';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';

/** Étiquettes code-barres à imprimer pour les produits choisis. */
export default async function PageEtiquettes({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  if (!(await droits()).peut('catalog.read')) return <AccesReserve titre={(await traduire()).t('nav.catalogue')} />;
  const { ids } = await searchParams;
  const devise = await deviseSession();
  const liste = (ids ?? '').split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  return (
    <>
      <div className="page-head no-print">
        <p className="small"><Link href="/pharmacie/catalogue">← Catalogue</Link></p>
        <h1>Étiquettes code-barres</h1>
        <p>
          Collez-les sur les boîtes qui n’ont pas de code-barres (codes internes « 29… »), ou sur les rayons.
          À la caisse, le scan ajoute le produit au ticket.
        </p>
      </div>
      <PlancheEtiquettes devise={devise} idsInitiaux={liste} />
    </>
  );
}
