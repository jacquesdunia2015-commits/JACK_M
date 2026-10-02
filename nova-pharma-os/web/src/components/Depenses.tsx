'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyer, nombreSaisi } from '@/lib/envoi';
import { money } from '@/lib/format';
import { CATEGORIES_DEPENSE, MOYENS_DEPENSE } from '@/lib/depenses';

const aujourdhui = () => new Date().toLocaleDateString('en-CA');

/** Saisir une dépense : loyer, salaires, SNEL, carburant du groupe… */
export function FormulaireDepense({ devise, assujetti, caisseOuverte, taux }: {
  devise: string; assujetti: boolean; caisseOuverte: boolean;
  /** Dernier taux du jour fixé dans Caisse. */
  taux: { base_currency: string; quote_currency: string; rate: string } | null;
}) {
  const router = useRouter();
  const vide = {
    expenseDate: aujourdhui(), category: 'carburant', label: '', supplierName: '', amount: '', currency: devise,
    exchangeRate: '', paymentMethod: 'cash', fromCash: caisseOuverte, normalizedInvoice: false, normalizedReference: '', vatAmount: '', notes: '',
  };
  const [v, setV] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  const autre = taux ? (taux.base_currency === devise ? taux.quote_currency : taux.base_currency) : null;

  const montant = nombreSaisi(v.amount) ?? 0;
  const tauxSaisi = nombreSaisi(v.exchangeRate) ?? (taux ? Number(taux.rate) : 0);
  const enDevise = v.currency !== devise && tauxSaisi > 0
    ? (taux && v.currency === taux.quote_currency ? montant / tauxSaisi : montant * tauxSaisi)
    : null;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<{ number: string }>('/expenses', {
      expenseDate: v.expenseDate || undefined, category: v.category, label: v.label.trim(),
      supplierName: v.supplierName.trim() || undefined, amount: montant, currency: v.currency,
      exchangeRate: v.currency !== devise ? nombreSaisi(v.exchangeRate) : undefined,
      paymentMethod: v.paymentMethod, fromCash: v.paymentMethod === 'cash' && v.fromCash,
      normalizedInvoice: v.normalizedInvoice, normalizedReference: v.normalizedReference.trim() || undefined,
      vatAmount: nombreSaisi(v.vatAmount), notes: v.notes.trim() || undefined,
    });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `Dépense ${r.body.number} enregistrée${v.paymentMethod === 'cash' && v.fromCash ? ', sortie de la caisse' : ''}.` });
    setV({ ...vide, category: v.category, paymentMethod: v.paymentMethod, currency: v.currency });
    router.refresh();
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="dp-cat">Catégorie</label>
          <select id="dp-cat" value={v.category} onChange={maj('category')}>
            {Object.entries(CATEGORIES_DEPENSE).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="dp-libelle">Libellé</label>
          <input id="dp-libelle" value={v.label} onChange={maj('label')} required minLength={2} placeholder="Gasoil du groupe, loyer d’octobre, salaire de Grâce…" />
        </div>
        <div className="field">
          <label htmlFor="dp-montant">Montant payé</label>
          <div className="row" style={{ gap: '0.35rem', flexWrap: 'nowrap' }}>
            <input id="dp-montant" inputMode="decimal" value={v.amount} onChange={maj('amount')} required pattern="[0-9 ]+([.,][0-9]+)?" style={{ flex: 1 }} />
            <select aria-label="Devise" value={v.currency} onChange={maj('currency')} style={{ width: '6rem' }}>
              <option value={devise}>{devise === 'CDF' ? 'FC' : devise}</option>
              {autre && <option value={autre}>{autre === 'CDF' ? 'FC' : autre}</option>}
            </select>
          </div>
          {enDevise !== null && <span className="small muted">soit {money(enDevise, devise)}</span>}
        </div>
        {v.currency !== devise && (
          <div className="field">
            <label htmlFor="dp-taux">Taux (1 {taux?.base_currency ?? 'USD'} = … {taux?.quote_currency === 'CDF' ? 'FC' : taux?.quote_currency ?? ''})</label>
            <input id="dp-taux" inputMode="decimal" value={v.exchangeRate} onChange={maj('exchangeRate')} placeholder={taux ? String(Number(taux.rate)) : ''} pattern="[0-9 ]+([.,][0-9]+)?" />
          </div>
        )}
        <div className="field">
          <label htmlFor="dp-date">Date</label>
          <input id="dp-date" type="date" value={v.expenseDate} onChange={maj('expenseDate')} max={aujourdhui()} required />
        </div>
        <div className="field">
          <label htmlFor="dp-moyen">Payée par</label>
          <select id="dp-moyen" value={v.paymentMethod} onChange={maj('paymentMethod')}>
            {Object.entries(MOYENS_DEPENSE).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
          {v.paymentMethod === 'cash' && caisseOuverte && (
            <label className="case small" style={{ marginTop: '0.3rem' }}>
              <input type="checkbox" checked={v.fromCash} onChange={maj('fromCash')} /> sortie de la caisse ouverte
            </label>
          )}
        </div>
        <div className="field">
          <label htmlFor="dp-fournisseur">Payée à (facultatif)</label>
          <input id="dp-fournisseur" value={v.supplierName} onChange={maj('supplierName')} placeholder="SNEL, bailleur, station…" />
        </div>
      </div>
      <fieldset className="cadre-fiscal">
        <legend>Facture du fournisseur</legend>
        <label className="case">
          <input type="checkbox" checked={v.normalizedInvoice} onChange={maj('normalizedInvoice')} />
          J’ai reçu une <strong>facture normalisée</strong> (avec QR code et numéro du dispositif fiscal)
        </label>
        <div className="grid grid-2" style={{ gap: '0 1rem' }}>
          {v.normalizedInvoice && (
            <div className="field">
              <label htmlFor="dp-ref">Référence de la facture normalisée</label>
              <input id="dp-ref" value={v.normalizedReference} onChange={maj('normalizedReference')} required placeholder="numéro, code DEF…" />
            </div>
          )}
          {assujetti && (
            <div className="field">
              <label htmlFor="dp-tva">TVA indiquée sur la facture ({devise === 'CDF' ? 'FC' : devise})</label>
              <input id="dp-tva" inputMode="decimal" value={v.vatAmount} onChange={maj('vatAmount')} pattern="[0-9 ]+([.,][0-9]+)?" placeholder="0" />
              <span className="small muted">Récupérable seulement avec une facture normalisée.</span>
            </div>
          )}
        </div>
      </fieldset>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
    </form>
  );
}

export function AnnulerDepense({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  return (
    <button type="button" className="secondaire petit" disabled={envoi} onClick={async () => {
      const raison = window.prompt(`Pourquoi annuler la dépense ${numero} ?`, 'Saisie en double');
      if (!raison || raison.trim().length < 5) return;
      setEnvoi(true);
      const r = await envoyer<{ cashReturned: boolean }>(`/expenses/${id}/cancel`, { reason: raison });
      setEnvoi(false);
      if (!r.ok) { window.alert(r.message); return; }
      router.refresh();
    }}>
      Annuler
    </button>
  );
}

/** Régime fiscal : assujettie à la TVA ou non, numéro du dispositif fiscal. */
export function ReglagesFiscaux({ assujetti, numeroDef }: { assujetti: boolean; numeroDef: string | null }) {
  const router = useRouter();
  const [a, setA] = useState(assujetti);
  const [def, setDef] = useState(numeroDef ?? '');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/finance/settings', { vatRegistered: a, defNumber: def.trim() || null }, 'PUT');
      setMessage(r.ok ? { ton: 'info', texte: 'Régime fiscal enregistré.' } : { ton: 'danger', texte: r.message });
      if (r.ok) router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <label className="case">
        <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />
        La pharmacie est <strong>assujettie à la TVA</strong> (chiffre d’affaires annuel d’au moins 80 000 000 FC, ou sur option)
      </label>
      {a && (
        <div className="field" style={{ maxWidth: 360, marginTop: '0.5rem' }}>
          <label htmlFor="rf-def">Numéro de votre dispositif fiscal (MCF ou e-MCF)</label>
          <input id="rf-def" value={def} onChange={(e) => setDef(e.target.value)} placeholder="délivré par la DGI" />
        </div>
      )}
      <button type="submit" className="secondaire" style={{ marginTop: '0.5rem' }}>Enregistrer</button>
    </form>
  );
}

/** Référence de la facture normalisée d'une vente, notée après son émission par le dispositif fiscal. */
export function ReferenceNormalisee({ venteId, reference }: { venteId: string; reference: string | null }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(reference ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  if (!edition) {
    return (
      <span>
        {reference ? <span className="mono">{reference}</span> : <span className="muted">non notée</span>}{' '}
        <button type="button" className="secondaire petit" onClick={() => setEdition(true)}>{reference ? 'Modifier' : 'Noter'}</button>
      </span>
    );
  }
  return (
    <form className="row" style={{ alignItems: 'center', gap: '0.4rem' }} onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer(`/sales/${venteId}/normalized-reference`, { reference: valeur.trim() || null }, 'PUT');
      if (!r.ok) { setErreur(r.message); return; }
      setEdition(false);
      router.refresh();
    }}>
      <input aria-label="Référence de la facture normalisée" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="numéro, code DEF…" style={{ minWidth: 240 }} />
      <button type="submit" className="petit">Enregistrer</button>
      <button type="button" className="secondaire petit" onClick={() => setEdition(false)}>Annuler</button>
      {erreur && <span className="small" style={{ color: 'var(--alerte)' }}>{erreur}</span>}
    </form>
  );
}
