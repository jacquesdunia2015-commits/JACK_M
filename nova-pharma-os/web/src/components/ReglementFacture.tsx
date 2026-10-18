'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MOYENS = [
  { code: 'cash', label: 'Espèces' },
  { code: 'mobile_money', label: 'Mobile Money' },
  { code: 'bank_transfer', label: 'Virement' },
  { code: 'card', label: 'Carte' },
];

/** Encaisser tout ou partie de ce qui reste dû sur une facture. */
export default function ReglementFacture({
  factureId,
  clientId,
  reste,
}: {
  factureId: string;
  clientId: string;
  reste: number;
}) {
  const router = useRouter();
  const [montant, setMontant] = useState(String(reste).replace('.', ','));
  const [moyen, setMoyen] = useState('cash');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function encaisser(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proxy/customers/${clientId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: factureId,
          amount: Number(montant.replace(',', '.')),
          method: moyen,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          // Un double clic ne compte jamais deux fois le même règlement.
          clientOperationId: `reglement-${factureId}-${Date.now()}`,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ton: 'danger', texte: (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Règlement refusé.' });
        return;
      }
      setMessage({ ton: 'info', texte: 'Règlement enregistré.' });
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={encaisser}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="r-montant">Montant reçu</label>
          <input id="r-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} required pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="r-moyen">Moyen</label>
          <select id="r-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
            {MOYENS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-reference">Référence (facultatif)</label>
          <input id="r-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction" />
        </div>
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Encaisser le règlement'}</button>
    </form>
  );
}
