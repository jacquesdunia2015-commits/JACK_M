import AccesReserve from '@/components/AccesReserve';
import TableInteractions, { type LigneInteraction } from '@/components/TableInteractions';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';

/** Consultation de la liste de référence des interactions. */
export default async function PageInteractions({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { peut } = await droits();
  if (!peut('catalog.read')) return <AccesReserve titre={(await traduire()).t('nav.interactions')} />;
  const { q } = await searchParams;
  const r = await apiSafe<{ interactions: LigneInteraction[]; classes: { code: string; label: string; members: string[] }[] }>(
    `/interactions${q ? `?q=${encodeURIComponent(q)}` : ''}`, { interactions: [], classes: [] },
  );
  return (
    <>
      <div className="page-head">
        <h1>Interactions médicamenteuses</h1>
        <p>
          La caisse signale d’elle-même ces associations entre les produits d’un ticket, et avec les traitements suivis du patient.
          Liste de départ non exhaustive (niveaux du Thésaurus ANSM), tenue par NOVA PHARMA OS : elle aide, elle ne remplace pas le jugement du pharmacien.
        </p>
      </div>
      <section className="card">
        <form className="row" style={{ alignItems: 'end', gap: '0.75rem' }} method="get">
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label htmlFor="it-q">Substance (DCI) ou classe</label>
            <input id="it-q" name="q" defaultValue={q ?? ''} placeholder="warfarine, ibuprofène, statines…" />
          </div>
          <button type="submit">Chercher</button>
        </form>
      </section>
      <section className="card">
        {r.interactions.length === 0 ? <Vide message="Aucune interaction connue pour cette recherche." /> : <TableInteractions lignes={r.interactions.filter((i) => i.is_active)} />}
      </section>
      <section className="card">
        <details className="depliable">
          <summary>Classes thérapeutiques ({r.classes.length})</summary>
          <ul className="small" style={{ margin: '0.5rem 0 0' }}>
            {r.classes.map((c) => <li key={c.code}><strong>{c.label}</strong> : {c.members.join(', ')}</li>)}
          </ul>
        </details>
      </section>
    </>
  );
}
