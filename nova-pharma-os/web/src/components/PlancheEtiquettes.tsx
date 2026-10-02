'use client';

import { useCallback, useEffect, useState } from 'react';
import CodeBarresSvg from '@/components/CodeBarresSvg';
import { envoyer } from '@/lib/envoi';
import { money } from '@/lib/format';

interface DonneesEtiquette {
  id: string; name: string; dosage: string | null; sku: string; sale_price: string;
  barcode: string | null; kind: string | null;
}

/** Formats courants : planches A4 autocollantes et rouleaux d'imprimante d'étiquettes. */
const FORMATS = {
  'a4-24': { libelle: 'Planche A4 — 24 étiquettes (70 × 37 mm)', page: 'A4', marge: '0', colonnes: 3, l: '70mm', h: '37mm' },
  'a4-40': { libelle: 'Planche A4 — 40 étiquettes (52,5 × 29,7 mm)', page: 'A4', marge: '0', colonnes: 4, l: '52.5mm', h: '29.7mm' },
  'rouleau-50x30': { libelle: 'Rouleau — 50 × 30 mm', page: '50mm 30mm', marge: '0', colonnes: 1, l: '50mm', h: '30mm' },
  'rouleau-40x25': { libelle: 'Rouleau — 40 × 25 mm', page: '40mm 25mm', marge: '0', colonnes: 1, l: '40mm', h: '25mm' },
} as const;
type Format = keyof typeof FORMATS;

/**
 * Étiquettes code-barres à imprimer : choisir les produits et le nombre
 * d'étiquettes de chacun, le format (planche A4 ou rouleau), avec ou sans
 * prix. Un produit sans code-barres reçoit d'abord un code interne.
 */
export default function PlancheEtiquettes({ devise, idsInitiaux }: { devise: string; idsInitiaux: string[] }) {
  const [choix, setChoix] = useState<Record<string, number>>(Object.fromEntries(idsInitiaux.map((id) => [id, 1])));
  const [donnees, setDonnees] = useState<DonneesEtiquette[]>([]);
  const [format, setFormat] = useState<Format>('a4-24');
  const [avecPrix, setAvecPrix] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<{ id: string; name: string; sku: string; dosage: string | null }[]>([]);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const ids = Object.keys(choix);

  const charger = useCallback(async (liste: string[]) => {
    if (!liste.length) { setDonnees([]); return; }
    const r = await fetch(`/api/proxy/catalog/labels?ids=${liste.join(',')}`);
    setDonnees(r.ok ? await r.json() : []);
  }, []);
  useEffect(() => { void charger(ids); }, [ids.join(','), charger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recherche.trim().length < 2) { setResultats([]); return; }
    const m = setTimeout(async () => {
      const r = await fetch(`/api/proxy/catalog/products?q=${encodeURIComponent(recherche.trim())}&pageSize=20`);
      setResultats(r.ok ? (await r.json()).data ?? [] : []);
    }, 220);
    return () => clearTimeout(m);
  }, [recherche]);

  const sansCode = donnees.filter((d) => !d.barcode);
  async function creerCodes() {
    const r = await envoyer<{ created: number }>('/catalog/barcodes/internal', { productIds: sansCode.map((d) => d.id) });
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `${r.body.created} code(s) interne(s) créé(s).` });
    void charger(ids);
  }

  const f = FORMATS[format];
  const etiquettes = donnees
    .filter((d) => d.barcode)
    .flatMap((d) => Array.from({ length: Math.max(0, choix[d.id] ?? 0) }, (_, i) => ({ ...d, cle: `${d.id}-${i}` })));

  return (
    <>
      {/* Taille de page selon le format choisi : planche A4 ou étiquette du rouleau. */}
      <style>{`@media print { @page { size: ${f.page}; margin: ${f.marge}; } }`}</style>

      <section className="card no-print">
        <div className="card-head"><h2>Produits</h2><span className="hint">{ids.length} choisi(s) · {etiquettes.length} étiquette(s)</span></div>
        {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="et-recherche">Ajouter un produit</label>
          <input id="et-recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom ou référence…" autoComplete="off" />
        </div>
        {resultats.length > 0 && (
          <div className="liste-choix" style={{ maxWidth: 420, marginBottom: '0.75rem' }}>
            {resultats.map((p) => (
              <button type="button" key={p.id} className="choix" disabled={p.id in choix}
                onClick={() => { setChoix((c) => ({ ...c, [p.id]: 1 })); setRecherche(''); }}>
                <strong>{p.name}</strong> <span className="small muted">{p.dosage ?? ''} {p.sku}</span>
              </button>
            ))}
          </div>
        )}
        {donnees.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th>Code-barres</th><th className="num">Prix</th><th className="num">Étiquettes</th><th /></tr></thead>
              <tbody>
                {donnees.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong> <span className="small muted">{d.dosage ?? ''}</span></td>
                    <td className="mono small">{d.barcode ?? <span className="tag warn">sans code</span>}</td>
                    <td className="num">{money(d.sale_price, devise)}</td>
                    <td className="num">
                      <input type="number" min={0} max={500} value={choix[d.id] ?? 0} style={{ width: '5rem' }}
                        aria-label={`Nombre d’étiquettes de ${d.name}`}
                        onChange={(e) => setChoix((c) => ({ ...c, [d.id]: Math.max(0, Math.min(500, Number(e.target.value) || 0)) }))} />
                    </td>
                    <td>
                      <button type="button" className="lien" onClick={() => setChoix((c) => { const n = { ...c }; delete n[d.id]; return n; })}>Retirer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sansCode.length > 0 && (
          <div className="banner warn" style={{ marginTop: '0.75rem' }}>
            {sansCode.length} produit(s) sans code-barres.{' '}
            <button type="button" className="lien" onClick={() => void creerCodes()}>Créer leurs codes internes</button>
          </div>
        )}
        <div className="row" style={{ alignItems: 'end', marginTop: '0.75rem' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="et-format">Format</label>
            <select id="et-format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {Object.entries(FORMATS).map(([c, v]) => <option key={c} value={c}>{v.libelle}</option>)}
            </select>
          </div>
          <label className="case" style={{ marginBottom: '0.6rem' }}>
            <input type="checkbox" checked={avecPrix} onChange={(e) => setAvecPrix(e.target.checked)} /> Afficher le prix
          </label>
          <button type="button" disabled={!etiquettes.length} onClick={() => window.print()}>Imprimer {etiquettes.length} étiquette(s)</button>
        </div>
      </section>

      <div
        className={`zone-impression planche planche-${format}`}
        style={{ gridTemplateColumns: `repeat(${f.colonnes}, ${f.l})`, ['--etiquette-h' as string]: f.h }}
      >
        {etiquettes.map((e) => (
          <div key={e.cle} className="etiquette-produit" style={{ width: f.l, height: f.h }}>
            <div className="etiquette-nom">{e.name}{e.dosage && !e.name.includes(e.dosage) ? ` ${e.dosage}` : ''}</div>
            {avecPrix && <div className="etiquette-prix">{money(e.sale_price, devise)}</div>}
            <div className="etiquette-code"><CodeBarresSvg code={e.barcode as string} hauteur={30} /></div>
          </div>
        ))}
      </div>
    </>
  );
}
