'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyer } from '@/lib/envoi';
import { RUBRIQUES_RAPPORT, type CorrespondanceDhis2, type ReglagesProgrammes } from '@/lib/programmes-publics';

/** Codes de la structure : code du programme, identifiants DHIS2, stock maximum. */
export function FormReglagesProgrammes({ reglages }: { reglages: ReglagesProgrammes }) {
  const router = useRouter();
  const [v, setV] = useState({
    facilityCode: reglages.facilityCode ?? '', dhis2OrgUnit: reglages.dhis2OrgUnit ?? '',
    dhis2DataSet: reglages.dhis2DataSet ?? '', maxMonths: String(reglages.maxMonths),
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/reports/public-programs/settings', {
        facilityCode: v.facilityCode, dhis2OrgUnit: v.dhis2OrgUnit.trim(), dhis2DataSet: v.dhis2DataSet.trim(),
        maxMonths: Number(v.maxMonths.replace(',', '.')),
      }, 'PUT');
      setMessage(r.ok ? { ton: 'info', texte: 'Codes enregistrés.' } : { ton: 'danger', texte: r.message });
      if (r.ok) router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-2" style={{ gap: '0 1rem' }}>
        <div className="field"><label htmlFor="pp-code">Code de la structure (programme, zone de santé)</label><input id="pp-code" value={v.facilityCode} onChange={maj('facilityCode')} maxLength={60} /></div>
        <div className="field">
          <label htmlFor="pp-max">Stock maximum (mois de consommation)</label>
          <input id="pp-max" value={v.maxMonths} onChange={maj('maxMonths')} inputMode="decimal" style={{ width: '7rem' }} />
        </div>
        <div className="field">
          <label htmlFor="pp-ou">Unité d’organisation DHIS2</label>
          <input id="pp-ou" value={v.dhis2OrgUnit} onChange={maj('dhis2OrgUnit')} maxLength={11} className="mono" placeholder="11 caractères" />
        </div>
        <div className="field">
          <label htmlFor="pp-ds">Formulaire DHIS2 (data set, facultatif)</label>
          <input id="pp-ds" value={v.dhis2DataSet} onChange={maj('dhis2DataSet')} maxLength={11} className="mono" placeholder="11 caractères" />
        </div>
      </div>
      <p className="small muted">Ces codes sont donnés par le bureau de la zone de santé ou le programme : NOVA ne les invente pas.</p>
      <button type="submit">Enregistrer</button>
    </form>
  );
}

/** Relier un produit à son code national et, rubrique par rubrique, à un élément de données DHIS2. */
export function FormCorrespondance({ produits }: { produits: { id: string; libelle: string; nationalCode: string | null; dhis2: CorrespondanceDhis2 }[] }) {
  const router = useRouter();
  const [produitId, setProduitId] = useState('');
  const [code, setCode] = useState('');
  const [champs, setChamps] = useState<Record<string, { de: string; coc: string }>>({});
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const choisir = (id: string) => {
    setProduitId(id); setMessage(null);
    const p = produits.find((x) => x.id === id);
    setCode(p?.nationalCode ?? '');
    setChamps(Object.fromEntries(RUBRIQUES_RAPPORT.map((r) => [r.cle, { de: p?.dhis2[r.cle]?.de ?? '', coc: p?.dhis2[r.cle]?.coc ?? '' }])));
  };
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const dhis2 = Object.fromEntries(Object.entries(champs).filter(([, c]) => c.de.trim())
        .map(([k, c]) => [k, c.coc.trim() ? { de: c.de.trim(), coc: c.coc.trim() } : { de: c.de.trim() }]));
      const r = await envoyer(`/reports/public-programs/mappings/${produitId}`, { nationalCode: code, dhis2 }, 'PUT');
      setMessage(r.ok ? { ton: 'info', texte: 'Correspondance enregistrée.' } : { ton: 'danger', texte: r.message });
      if (r.ok) router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-2" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="pc-produit">Produit</label>
          <select id="pc-produit" value={produitId} onChange={(e) => choisir(e.target.value)} required>
            <option value="">— Choisir —</option>
            {produits.map((p) => <option key={p.id} value={p.id}>{p.libelle}{p.nationalCode ? ` (${p.nationalCode})` : ''}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="pc-code">Code national du produit</label><input id="pc-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={60} disabled={!produitId} /></div>
      </div>
      {produitId && (
        <div className="table-wrap"><table>
          <thead><tr><th>Rubrique</th><th>Élément de données DHIS2</th><th>Combinaison de catégories (facultatif)</th></tr></thead>
          <tbody>
            {RUBRIQUES_RAPPORT.map((r) => (
              <tr key={r.cle}>
                <td>{r.libelle}</td>
                {(['de', 'coc'] as const).map((k) => (
                  <td key={k}>
                    <input aria-label={`${r.libelle} — ${k === 'de' ? 'élément' : 'combinaison'}`} className="mono" maxLength={11}
                      value={champs[r.cle]?.[k] ?? ''} onChange={(e) => setChamps((x) => ({ ...x, [r.cle]: { ...x[r.cle], [k]: e.target.value } }))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <button type="submit" disabled={!produitId}>Enregistrer la correspondance</button>
    </form>
  );
}

/** Import CSV des correspondances, fourni par le programme ou préparé dans Excel. */
export function ImportCorrespondances() {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [resultat, setResultat] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer<{ products: number; errors: { line: number; message: string }[] }>('/reports/public-programs/mappings/import', { csv });
      if (!r.ok) { setResultat(r.message); return; }
      setResultat(`${r.body.products} produit(s) relié(s)${r.body.errors.length ? ` — erreurs : ${r.body.errors.map((x) => `ligne ${x.line} (${x.message})`).join(' ; ')}` : ''}.`);
      router.refresh();
    }}>
      <div className="field">
        <label htmlFor="pc-csv">Lignes CSV (séparateur « ; ») : reference_nova;code_national;rubrique;data_element;category_option_combo</label>
        <textarea id="pc-csv" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} className="mono" placeholder="PARA500;MED-0107;consumed;fbfJHSPpUQD;" />
        <span className="small muted">Rubriques : {RUBRIQUES_RAPPORT.map((r) => r.cle).join(', ')}. Une ligne par produit et par rubrique ; rubrique vide pour le code national seul.</span>
      </div>
      <button type="submit" disabled={!csv.trim()}>Importer</button>
      {resultat && <p className="small">{resultat}</p>}
    </form>
  );
}
