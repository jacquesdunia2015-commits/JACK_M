'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEVISES, PAYS } from '@/lib/pays';

export interface FicheFournisseur {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  country_code?: string | null;
  city?: string | null;
  address?: string | null;
  contact_name?: string | null;
  kind?: string | null;
  currency?: string | null;
  lead_time_days?: number | null;
  payment_terms_days?: number | null;
  notes?: string | null;
}

const NATURES = [
  { code: 'wholesaler', libelle: 'Dépôt / grossiste' },
  { code: 'semi_wholesaler', libelle: 'Semi-grossiste' },
  { code: 'importer', libelle: 'Importateur' },
  { code: 'manufacturer', libelle: 'Laboratoire / fabricant' },
];

/**
 * Enregistre un fournisseur, ou modifie sa fiche quand `fiche.id` est
 * fourni. Nom et téléphone suffisent ; le reste se complète plus tard.
 */
export default function FormulaireFournisseur({ fiche }: { fiche?: FicheFournisseur }) {
  const router = useRouter();
  const modification = Boolean(fiche?.id);
  const initial = {
    name: fiche?.name ?? '',
    phone: fiche?.phone ?? '',
    email: fiche?.email ?? '',
    countryCode: fiche?.country_code ?? '',
    city: fiche?.city ?? '',
    address: fiche?.address ?? '',
    contactName: fiche?.contact_name ?? '',
    kind: fiche?.kind ?? 'wholesaler',
    currency: fiche?.currency ?? '',
    leadTimeDays: String(fiche?.lead_time_days ?? 7),
    paymentTermsDays: String(fiche?.payment_terms_days ?? 0),
    notes: fiche?.notes ?? '',
  };
  const [champs, setChamps] = useState(initial);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer =
    (cle: keyof typeof champs) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    // Les champs laissés vides ne sont pas envoyés : l'API garde sa valeur
    // par défaut (création) ou la valeur actuelle (modification).
    const corps: Record<string, unknown> = {
      name: champs.name,
      phone: champs.phone,
      kind: champs.kind,
      leadTimeDays: Number(champs.leadTimeDays) || 0,
      paymentTermsDays: Number(champs.paymentTermsDays) || 0,
    };
    // Pays et devise vides : ceux de la pharmacie, que l'API connaît.
    for (const cle of ['email', 'city', 'address', 'contactName', 'notes', 'countryCode', 'currency'] as const) {
      if (champs[cle].trim()) corps[cle] = champs[cle].trim();
    }
    try {
      const response = await fetch(
        modification
          ? `/api/proxy/purchasing/suppliers/${fiche?.id}`
          : '/api/proxy/purchasing/suppliers',
        {
          method: modification ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Enregistrement refusé.' });
        return;
      }
      if (modification) {
        setMessage({ ton: 'info', texte: 'Fiche mise à jour.' });
        router.refresh();
      } else {
        router.push(`/pharmacie/fournisseurs/${body.id}`);
      }
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
          <label htmlFor="f-nom">Nom du dépôt ou du fournisseur</label>
          <input id="f-nom" value={champs.name} onChange={changer('name')} required minLength={2}
            placeholder="Ex. : Dépôt pharmaceutique Shalom" />
        </div>
        <div className="field">
          <label htmlFor="f-telephone">Téléphone</label>
          <input id="f-telephone" type="tel" inputMode="tel" value={champs.phone}
            onChange={changer('phone')} required placeholder="0991 234 567" />
        </div>
        <div className="field">
          <label htmlFor="f-email">Adresse e-mail</label>
          <input id="f-email" type="email" value={champs.email} onChange={changer('email')}
            placeholder="commandes@depot.cd" />
        </div>
        <div className="field">
          <label htmlFor="f-pays">Pays</label>
          <select id="f-pays" value={champs.countryCode} onChange={changer('countryCode')}>
            <option value="">Même pays que la pharmacie</option>
            {PAYS.map((p) => (
              <option key={p.code} value={p.code}>{p.nom}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-ville">Ville</label>
          <input id="f-ville" value={champs.city} onChange={changer('city')} placeholder="Bukavu" />
        </div>
        <div className="field">
          <label htmlFor="f-adresse">Adresse</label>
          <input id="f-adresse" value={champs.address} onChange={changer('address')}
            placeholder="Avenue, numéro, quartier" />
        </div>
        <div className="field">
          <label htmlFor="f-contact">Personne à contacter</label>
          <input id="f-contact" value={champs.contactName} onChange={changer('contactName')} />
        </div>
        <div className="field">
          <label htmlFor="f-nature">Type</label>
          <select id="f-nature" value={champs.kind} onChange={changer('kind')}>
            {NATURES.map((n) => (
              <option key={n.code} value={n.code}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-devise">Devise de ses prix</label>
          <select id="f-devise" value={champs.currency} onChange={changer('currency')}>
            <option value="">Devise de la pharmacie</option>
            {DEVISES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-delai">Délai de livraison (jours)</label>
          <input id="f-delai" type="number" min={0} value={champs.leadTimeDays}
            onChange={changer('leadTimeDays')} />
        </div>
        <div className="field">
          <label htmlFor="f-paiement">Délai de paiement (jours)</label>
          <input id="f-paiement" type="number" min={0} value={champs.paymentTermsDays}
            onChange={changer('paymentTermsDays')} />
        </div>
        <div className="field">
          <label htmlFor="f-notes">Remarques</label>
          <input id="f-notes" value={champs.notes} onChange={changer('notes')}
            placeholder="Jours de livraison, conditions…" />
        </div>
      </div>

      <button type="submit" disabled={envoi}>
        {envoi ? 'Enregistrement…' : modification ? 'Enregistrer les modifications' : 'Enregistrer le fournisseur'}
      </button>
    </form>
  );
}
