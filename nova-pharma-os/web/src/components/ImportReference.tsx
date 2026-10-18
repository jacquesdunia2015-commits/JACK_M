'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export interface ProduitReference {
  code: string;
  name: string;
  inn: string | null;
  dosageForm: string;
  packaging: string;
  unit: string;
  categoryCode: string;
  salePrice: number;
  costPrice: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  isColdChain: boolean;
  inCatalog: boolean;
}

const enChamp = (v: number) => String(v).replace('.', ',');
const enNombre = (v: string) => Number(v.replace(',', '.'));

/**
 * Reprendre le catalogue de référence : tout cocher d'un coup ou choisir,
 * ajuster les prix de vente et d'achat à ceux de la pharmacie, importer.
 */
export default function ImportReference({
  produits,
  categories,
  devise,
  deviseReference,
}: {
  produits: ProduitReference[];
  categories: Record<string, string>;
  devise: string;
  deviseReference: string;
}) {
  const router = useRouter();
  const memeDevise = devise === deviseReference;
  const [coches, setCoches] = useState<Set<string>>(
    () => new Set(produits.filter((p) => !p.inCatalog).map((p) => p.code)),
  );
  const [prix, setPrix] = useState<Record<string, { vente: string; achat: string }>>(() =>
    Object.fromEntries(
      produits.map((p) => [p.code, memeDevise ? { vente: enChamp(p.salePrice), achat: enChamp(p.costPrice) } : { vente: '', achat: '' }]),
    ),
  );
  const [categorie, setCategorie] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const visibles = useMemo(
    () => produits.filter((p) => !categorie || p.categoryCode === categorie),
    [produits, categorie],
  );
  const aImporter = produits.filter((p) => coches.has(p.code) && !p.inCatalog);
  const sansPrix = aImporter.filter((p) => !(enNombre(prix[p.code].vente) >= 0) || prix[p.code].vente.trim() === '');

  const basculer = (code: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  const toutesVisibles = visibles.filter((p) => !p.inCatalog).every((p) => coches.has(p.code));
  const basculerVisibles = () =>
    setCoches((c) => {
      const n = new Set(c);
      for (const p of visibles.filter((x) => !x.inCatalog)) {
        if (toutesVisibles) n.delete(p.code);
        else n.add(p.code);
      }
      return n;
    });

  async function importer() {
    setMessage(null);
    if (sansPrix.length > 0) {
      setMessage({ ton: 'danger', texte: `Indiquez le prix de vente de ${sansPrix.length} produit(s) coché(s), en ${devise}.` });
      return;
    }
    setEnvoi(true);
    try {
      const response = await fetch('/api/proxy/catalog/reference/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: aImporter.map((p) => ({
            code: p.code,
            salePrice: enNombre(prix[p.code].vente),
            ...(prix[p.code].achat.trim() ? { costPrice: enNombre(prix[p.code].achat) } : {}),
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ton: 'danger', texte: (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Import refusé.' });
        return;
      }
      setMessage({
        ton: 'info',
        texte: `${body.created} produit(s) ajouté(s) à votre catalogue. Il reste à enregistrer leur stock (Stock → Entrée de stock).`,
      });
      setCoches(new Set());
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      {!memeDevise && (
        <div className="banner warn">
          Vos prix sont en <strong>{devise}</strong> : les prix indicatifs ({deviseReference}) ne sont pas repris.
          Saisissez votre prix de vente pour chaque produit coché.
        </div>
      )}
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ maxWidth: 320 }} aria-label="Catégorie">
          <option value="">Toutes les catégories ({produits.length})</option>
          {Object.entries(categories).map(([code, nom]) => (
            <option key={code} value={code}>{nom} ({produits.filter((p) => p.categoryCode === code).length})</option>
          ))}
        </select>
        <button type="button" className="secondaire petit" onClick={basculerVisibles}>
          {toutesVisibles ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      <div className="table-wrap">
        <table className="reference-table">
          <thead>
            <tr>
              <th aria-label="Choisir" />
              <th>Produit</th>
              <th>Vente à l&apos;unité</th>
              <th className="num">Prix de vente ({devise})</th>
              <th className="num">Prix d&apos;achat ({devise})</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.code} className={p.inCatalog ? 'present' : ''}>
                <td>
                  <input type="checkbox" aria-label={`Choisir ${p.name}`} checked={p.inCatalog || coches.has(p.code)}
                    disabled={p.inCatalog} onChange={() => basculer(p.code)} />
                </td>
                <td>
                  <strong>{p.name}</strong>
                  {p.requiresPrescription && <span className="tag warn" style={{ marginLeft: '0.35rem' }}>Ordonnance</span>}
                  {p.isControlled && <span className="tag danger" style={{ marginLeft: '0.35rem' }}>Stupéfiant</span>}
                  {p.isColdChain && <span className="tag" style={{ marginLeft: '0.35rem' }}>Froid</span>}
                  {p.inCatalog && <span className="tag ok" style={{ marginLeft: '0.35rem' }}>Déjà au catalogue</span>}
                  <br />
                  <span className="small muted">{[p.inn, p.dosageForm, categories[p.categoryCode]].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="small">{p.packaging}</td>
                <td className="num">
                  <input className="prix" inputMode="decimal" aria-label={`Prix de vente de ${p.name}`} disabled={p.inCatalog}
                    value={prix[p.code].vente} placeholder={memeDevise ? '' : 'à saisir'} pattern="[0-9]+([.,][0-9]+)?"
                    onChange={(e) => setPrix((x) => ({ ...x, [p.code]: { ...x[p.code], vente: e.target.value } }))} />
                </td>
                <td className="num">
                  <input className="prix" inputMode="decimal" aria-label={`Prix d'achat de ${p.name}`} disabled={p.inCatalog}
                    value={prix[p.code].achat} placeholder="facultatif" pattern="[0-9]+([.,][0-9]+)?"
                    onChange={(e) => setPrix((x) => ({ ...x, [p.code]: { ...x[p.code], achat: e.target.value } }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="reference-barre">
        {message ? <div className={`banner ${message.ton}`} style={{ margin: 0 }}>{message.texte}</div> : (
          <span className="small muted">{aImporter.length} produit(s) coché(s) · {produits.filter((p) => p.inCatalog).length} déjà au catalogue</span>
        )}
        <button type="button" onClick={importer} disabled={envoi || aImporter.length === 0}>
          {envoi ? 'Import…' : `Ajouter ${aImporter.length} produit(s) à mon catalogue`}
        </button>
      </div>
    </>
  );
}
