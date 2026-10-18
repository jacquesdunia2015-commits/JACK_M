'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { envoyer } from '@/lib/envoi';
import { NIVEAUX_INTERACTION, type AlerteInteraction } from '@/lib/interactions';

/** Alertes d'interaction affichées à la caisse : elles informent, ne bloquent pas. */
export function AlertesInteractions({ productIds, customerId }: { productIds: string[]; customerId?: string | null }) {
  const [alertes, setAlertes] = useState<AlerteInteraction[]>([]);
  const cle = [...productIds].sort().join(',') + (customerId ?? '');
  useEffect(() => {
    if (productIds.length === 0 || (productIds.length < 2 && !customerId)) { setAlertes([]); return; }
    const m = setTimeout(async () => {
      const r = await envoyer<{ alerts: AlerteInteraction[] }>('/interactions/check', { productIds, ...(customerId ? { customerId } : {}) });
      setAlertes(r.ok ? r.body.alerts : []);
    }, 400);
    return () => clearTimeout(m);
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!alertes.length) return null;
  return (
    <div className="alertes-interactions" role="alert">
      {alertes.map((a, i) => {
        const n = NIVEAUX_INTERACTION[a.severity] ?? { libelle: a.severity, ton: 'warn' };
        return (
          <div key={i} className={`banner ${n.ton === 'danger' ? 'danger' : 'warn'}`} style={{ margin: 0 }}>
            <strong>{n.libelle} : {a.products.map((p) => `${p.name}${p.origin === 'traitement' ? ' (traitement suivi du patient)' : ''}`).join(' + ')}</strong>
            <div className="small">{a.effect}{a.advice ? ` Conduite : ${a.advice}` : ''}</div>
          </div>
        );
      })}
      <p className="small muted" style={{ margin: 0 }}>Information pour le pharmacien, issue d’une liste non exhaustive : la vente reste possible.</p>
    </div>
  );
}

/** Back-office : ajouter une interaction. */
export function NouvelleInteraction() {
  const router = useRouter();
  const vide = { termA: '', termB: '', severity: 'deconseillee', effect: '', advice: '', source: '' };
  const [v, setV] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/platform/interactions', { ...v, advice: v.advice || undefined, source: v.source || undefined });
      setMessage(r.ok ? { ton: 'info', texte: 'Interaction ajoutée.' } : { ton: 'danger', texte: r.message });
      if (r.ok) { setV(vide); router.refresh(); }
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field"><label htmlFor="ia-a">Substance ou classe</label><input id="ia-a" value={v.termA} onChange={maj('termA')} required placeholder="warfarine, ou classe:avk" /></div>
        <div className="field"><label htmlFor="ia-b">Avec</label><input id="ia-b" value={v.termB} onChange={maj('termB')} required placeholder="classe:ains" /></div>
        <div className="field">
          <label htmlFor="ia-n">Niveau</label>
          <select id="ia-n" value={v.severity} onChange={maj('severity')}>{Object.entries(NIVEAUX_INTERACTION).map(([c, n]) => <option key={c} value={c}>{n.libelle}</option>)}</select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="ia-e">Effet</label><input id="ia-e" value={v.effect} onChange={maj('effect')} required minLength={5} /></div>
        <div className="field"><label htmlFor="ia-s">Source</label><input id="ia-s" value={v.source} onChange={maj('source')} placeholder="Thésaurus ANSM" /></div>
        <div className="field" style={{ gridColumn: 'span 3' }}><label htmlFor="ia-c">Conduite à tenir</label><input id="ia-c" value={v.advice} onChange={maj('advice')} /></div>
      </div>
      <button type="submit">Ajouter</button>
    </form>
  );
}

/** Back-office : importer une liste CSV. */
export function ImportInteractions() {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [resultat, setResultat] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer<{ added: number; updated: number; errors: { line: number; message: string }[] }>('/platform/interactions/import', { csv });
      if (!r.ok) { setResultat(r.message); return; }
      setResultat(`${r.body.added} ajoutée(s), ${r.body.updated} mise(s) à jour${r.body.errors.length ? ` — erreurs : ${r.body.errors.map((x) => `ligne ${x.line} (${x.message})`).join(' ; ')}` : ''}.`);
      router.refresh();
    }}>
      <div className="field">
        <label htmlFor="ia-csv">Lignes CSV (séparateur « ; ») : terme_a;terme_b;niveau;effet;conduite;source</label>
        <textarea id="ia-csv" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} className="mono" placeholder="warfarine;classe:ains;deconseillee;Risque hémorragique.;Préférer le paracétamol.;Thésaurus ANSM" />
        <span className="small muted">Niveaux : contre_indication, deconseillee, precaution, a_prendre_en_compte. Une paire déjà connue est mise à jour.</span>
      </div>
      <button type="submit" disabled={!csv.trim()}>Importer</button>
      {resultat && <p className="small">{resultat}</p>}
    </form>
  );
}

export function BasculeInteraction({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return <button type="button" className="secondaire petit" onClick={async () => { const r = await envoyer(`/platform/interactions/${id}`, { isActive: !active }, 'PATCH'); if (r.ok) router.refresh(); }}>{active ? 'Désactiver' : 'Réactiver'}</button>;
}
