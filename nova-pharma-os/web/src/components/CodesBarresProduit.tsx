'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CodeBarresSvg from '@/components/CodeBarresSvg';
import ScanCodeBarres from '@/components/ScanCodeBarres';
import { envoyer } from '@/lib/envoi';

const TYPES: Record<string, string> = {
  ean13: 'EAN-13', ean8: 'EAN-8', upca: 'UPC-A', gtin14: 'GTIN-14', internal: 'code interne', autre: 'autre format',
};

/**
 * Codes-barres d'un produit : ceux de la boîte (saisis ou scannés), ou un
 * code interne créé par NOVA quand la boîte n'en a pas, à imprimer en
 * étiquette.
 */
export default function CodesBarresProduit({
  produitId,
  codes,
}: {
  produitId: string;
  codes: { barcode: string; kind: string; is_primary: boolean }[];
}) {
  const router = useRouter();
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function ajouter(code: string) {
    if (!code.trim()) return;
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<{ barcode: string; deja: boolean }>(`/catalog/products/${produitId}/barcodes`, { barcode: code });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: r.body.deja ? `Le code ${r.body.barcode} est déjà celui de ce produit.` : `Code ${r.body.barcode} ajouté.` });
    setSaisie('');
    router.refresh();
  }

  async function retirer(code: string) {
    if (!window.confirm(`Retirer le code ${code} de ce produit ?`)) return;
    const r = await envoyer(`/catalog/products/${produitId}/barcodes/${encodeURIComponent(code)}`, undefined, 'DELETE');
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    router.refresh();
  }

  async function codeInterne() {
    setEnvoi(true);
    const r = await envoyer<{ created: number; items: { barcode: string }[] }>('/catalog/barcodes/internal', { productIds: [produitId] });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `Code interne ${r.body.items[0]?.barcode ?? ''} créé : imprimez l’étiquette et collez-la sur les boîtes.` });
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      {codes.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Aucun code-barres. Scannez celui de la boîte, ou créez un code interne si la boîte n’en a pas.
        </p>
      ) : (
        <div className="codes-produit">
          {codes.map((c) => (
            <div key={c.barcode} className="code-produit">
              <div style={{ width: 150 }}><CodeBarresSvg code={c.barcode} hauteur={28} /></div>
              <div className="small">
                {TYPES[c.kind] ?? c.kind}{c.is_primary ? ' · principal' : ''}
                <br />
                <button type="button" className="lien" onClick={() => void retirer(c.barcode)}>Retirer</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <form className="row" style={{ alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); void ajouter(saisie); }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="cb-saisie">Ajouter un code</label>
          <input id="cb-saisie" value={saisie} onChange={(e) => setSaisie(e.target.value)} inputMode="numeric"
            placeholder="Scannez ou tapez le code" autoComplete="off" />
        </div>
        <button type="submit" disabled={envoi || !saisie.trim()}>Ajouter</button>
        <ScanCodeBarres onCode={(code) => void ajouter(code)} libelle="Scanner la boîte" />
        {codes.length === 0 && (
          <button type="button" className="secondaire" disabled={envoi} onClick={() => void codeInterne()}>Créer un code interne</button>
        )}
        {codes.length > 0 && (
          <Link className="btn secondaire" href={`/pharmacie/catalogue/etiquettes?ids=${produitId}`}>Imprimer des étiquettes</Link>
        )}
      </form>
    </div>
  );
}
