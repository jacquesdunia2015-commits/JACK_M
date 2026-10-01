import Depliable from '@/components/Depliable';
import { ImportInteractions, NouvelleInteraction } from '@/components/Interactions';
import TableInteractions, { type LigneInteraction } from '@/components/TableInteractions';
import { apiSafe } from '@/lib/api';

/** Back-office : liste de référence des interactions, partagée par toutes les pharmacies. */
export default async function PageInteractionsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const r = await apiSafe<{ interactions: LigneInteraction[] } | null>(`/platform/interactions${q ? `?q=${encodeURIComponent(q)}` : ''}`, null);
  if (!r) return <div className="page-head"><h1>Interactions</h1><p>Réservé aux super-administrateurs et au support.</p></div>;
  return (
    <>
      <div className="page-head">
        <h1>Interactions médicamenteuses</h1>
        <p>Liste partagée par toutes les pharmacies, utilisée par l’alerte de la caisse. Faites-la valider par un pharmacien ; complétez-la au fil des besoins ou par import.</p>
      </div>
      <section className="card"><Depliable resume="Ajouter une interaction" ouvert={false}><NouvelleInteraction /></Depliable></section>
      <section className="card"><Depliable resume="Importer une liste (CSV)" ouvert={false}><ImportInteractions /></Depliable></section>
      <section className="card">
        <form className="row" style={{ alignItems: 'end', gap: '0.75rem', marginBottom: '0.75rem' }} method="get">
          <div className="field" style={{ margin: 0, flex: 1 }}><label htmlFor="ia-q">Chercher</label><input id="ia-q" name="q" defaultValue={q ?? ''} /></div>
          <button type="submit" className="secondaire">Chercher</button>
        </form>
        <TableInteractions lignes={r.interactions} gestion />
      </section>
    </>
  );
}
