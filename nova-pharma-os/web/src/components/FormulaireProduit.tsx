'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const FORMES = [
  'comprimé', 'gélule', 'sirop', 'suspension buvable', 'solution injectable', 'perfusion',
  'pommade', 'crème', 'suppositoire', 'sachet', 'collyre', 'ovule', 'matériel médical',
];

/**
 * Ajout d'un produit ou d'un médicament au catalogue.
 *
 * Le nom et le prix de vente suffisent : la référence est tirée du nom si
 * elle reste vide. Un produit périssable est suivi par lot, avec sa date
 * de péremption, pour que la vente sorte d'abord le lot qui expire le
 * premier.
 */
export default function FormulaireProduit() {
  const router = useRouter();
  const vide = {
    name: '', dosage: '', dosageForm: '', packaging: '', salePrice: '', costPrice: '',
    reorderPoint: '', sku: '', requiresPrescription: false, hasExpiry: true,
  };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [cree, setCree] = useState<{ id: string; name: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer =
    (cle: keyof typeof champs) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const valeur = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setChamps((c) => ({ ...c, [cle]: valeur }));
    };
  const nombre = (texte: string) => Number(texte.replace(',', '.'));

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    setCree(null);
    const corps: Record<string, unknown> = {
      name: champs.name.trim(),
      salePrice: nombre(champs.salePrice),
      requiresPrescription: champs.requiresPrescription,
      hasExpiry: champs.hasExpiry,
      // Sans péremption, pas de lot à suivre : une boîte de gants en vaut une autre.
      isBatchTracked: champs.hasExpiry,
    };
    if (champs.costPrice.trim()) corps.costPrice = nombre(champs.costPrice);
    if (champs.reorderPoint.trim()) corps.reorderPoint = nombre(champs.reorderPoint);
    for (const cle of ['dosage', 'dosageForm', 'packaging', 'sku'] as const) {
      if (champs[cle].trim()) corps[cle] = champs[cle].trim();
    }
    try {
      const response = await fetch('/api/proxy/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Ajout refusé.' });
        return;
      }
      setCree({ id: body.id, name: body.name });
      setMessage({ ton: 'info', texte: `« ${body.name} » ajouté au catalogue (référence ${body.sku}).` });
      setChamps(vide);
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {message && (
        <div className={`banner ${message.ton}`}>
          {message.texte}
          {cree && (
            <>
              {' '}
              <Link href={`/pharmacie/stock?achat=${cree.id}#achat`}>
                Enregistrer un achat de ce produit
              </Link>
            </>
          )}
        </div>
      )}

      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="p-nom">Nom du produit ou du médicament</label>
          <input id="p-nom" value={champs.name} onChange={changer('name')} required minLength={2}
            placeholder="Ex. : Amoxicilline 500 mg" />
        </div>
        <div className="field">
          <label htmlFor="p-dosage">Dosage</label>
          <input id="p-dosage" value={champs.dosage} onChange={changer('dosage')} placeholder="Ex. : 500 mg" />
        </div>
        <div className="field">
          <label htmlFor="p-forme">Forme</label>
          <select id="p-forme" value={champs.dosageForm} onChange={changer('dosageForm')}>
            <option value="">—</option>
            {FORMES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-conditionnement">Conditionnement</label>
          <input id="p-conditionnement" value={champs.packaging} onChange={changer('packaging')}
            placeholder="Ex. : boîte de 20" />
        </div>
        <div className="field">
          <label htmlFor="p-vente">Prix de vente</label>
          <input id="p-vente" inputMode="decimal" value={champs.salePrice} onChange={changer('salePrice')}
            required pattern="[0-9]+([.,][0-9]+)?" placeholder="0,50" />
        </div>
        <div className="field">
          <label htmlFor="p-achat">Prix d&apos;achat habituel</label>
          <input id="p-achat" inputMode="decimal" value={champs.costPrice} onChange={changer('costPrice')}
            pattern="[0-9]+([.,][0-9]+)?" placeholder="0,30" />
        </div>
        <div className="field">
          <label htmlFor="p-seuil">Seuil de réapprovisionnement</label>
          <input id="p-seuil" type="number" min={0} value={champs.reorderPoint} onChange={changer('reorderPoint')}
            placeholder="Ex. : 20" />
        </div>
        <div className="field">
          <label htmlFor="p-reference">Référence (facultatif)</label>
          <input id="p-reference" value={champs.sku} onChange={changer('sku')} placeholder="Tirée du nom si vide" />
        </div>
        <div className="field" style={{ display: 'grid', gap: '0.4rem', alignContent: 'end' }}>
          <label className="case">
            <input type="checkbox" checked={champs.hasExpiry} onChange={changer('hasExpiry')} />
            Périssable : suivi par lot et date de péremption
          </label>
          <label className="case">
            <input type="checkbox" checked={champs.requiresPrescription} onChange={changer('requiresPrescription')} />
            Délivré sur ordonnance
          </label>
        </div>
      </div>

      <button type="submit" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter au catalogue'}</button>
    </form>
  );
}
