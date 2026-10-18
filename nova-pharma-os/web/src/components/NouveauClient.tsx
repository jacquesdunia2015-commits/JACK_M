'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Ajouter un client au fichier : un particulier, ou un client professionnel
 * (clinique, ONG, autre pharmacie) avec son plafond et son délai de crédit.
 */
export default function NouveauClient() {
  const router = useRouter();
  const vide = { name: '', phone: '', email: '', city: '', address: '', kind: 'individual', taxId: '', creditLimit: '', creditDays: '' };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (cle: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }));
  const pro = champs.kind === 'professional';

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const corps: Record<string, unknown> = { name: champs.name.trim(), kind: champs.kind };
    for (const cle of ['phone', 'email', 'city', 'address', 'taxId'] as const) if (champs[cle].trim()) corps[cle] = champs[cle].trim();
    if (pro && champs.creditLimit.trim()) corps.creditLimit = Number(champs.creditLimit.replace(',', '.'));
    if (pro && champs.creditDays.trim()) corps.creditDays = Number(champs.creditDays);
    try {
      const response = await fetch('/api/proxy/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ton: 'danger', texte: (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Ajout refusé.' });
        return;
      }
      setMessage({ ton: 'info', texte: `« ${body.name} » ajouté au fichier (${body.code}).` });
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
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="c-nom">Nom</label>
          <input id="c-nom" value={champs.name} onChange={changer('name')} required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="c-telephone">Téléphone</label>
          <input id="c-telephone" value={champs.phone} onChange={changer('phone')} inputMode="tel" placeholder="0991 234 567" />
        </div>
        <div className="field">
          <label htmlFor="c-type">Type</label>
          <select id="c-type" value={champs.kind} onChange={changer('kind')}>
            <option value="individual">Particulier</option>
            <option value="professional">Professionnel (clinique, ONG, pharmacie…)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-email">E-mail</label>
          <input id="c-email" type="email" value={champs.email} onChange={changer('email')} />
        </div>
        <div className="field">
          <label htmlFor="c-ville">Ville</label>
          <input id="c-ville" value={champs.city} onChange={changer('city')} />
        </div>
        <div className="field">
          <label htmlFor="c-adresse">Adresse</label>
          <input id="c-adresse" value={champs.address} onChange={changer('address')} />
        </div>
        {pro && (
          <>
            <div className="field">
              <label htmlFor="c-impot">N° impôt / RCCM</label>
              <input id="c-impot" value={champs.taxId} onChange={changer('taxId')} />
            </div>
            <div className="field">
              <label htmlFor="c-plafond">Plafond de crédit</label>
              <input id="c-plafond" inputMode="decimal" value={champs.creditLimit} onChange={changer('creditLimit')} pattern="[0-9]+([.,][0-9]+)?" placeholder="0 : pas de crédit" />
            </div>
            <div className="field">
              <label htmlFor="c-delai">Délai de paiement (jours)</label>
              <input id="c-delai" type="number" min={0} value={champs.creditDays} onChange={changer('creditDays')} />
            </div>
          </>
        )}
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter le client'}</button>
    </form>
  );
}
