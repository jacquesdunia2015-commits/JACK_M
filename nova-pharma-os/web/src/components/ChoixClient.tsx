'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/format';

export interface ClientChoisi {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  credit_limit: string;
  outstanding_balance: string;
  is_credit_blocked: boolean;
  loyalty_points?: number;
  group_id?: string | null;
  group_name?: string | null;
  /** Remise de la catégorie du client, si elle est active. */
  group_discount?: string | null;
}

/**
 * Choisir un client du fichier par son nom, son code ou son téléphone —
 * pour une vente à crédit, qui doit toujours savoir qui doit la somme.
 */
export default function ChoixClient({
  client,
  onChange,
  devise = 'USD',
  id = 'choix-client',
}: {
  client: ClientChoisi | null;
  onChange: (client: ClientChoisi | null) => void;
  devise?: string;
  id?: string;
}) {
  const [terme, setTerme] = useState('');
  const [trouves, setTrouves] = useState<ClientChoisi[]>([]);

  useEffect(() => {
    if (client || terme.trim().length < 2) {
      setTrouves([]);
      return;
    }
    const minuteur = setTimeout(() => {
      fetch(`/api/proxy/customers?search=${encodeURIComponent(terme.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((liste: ClientChoisi[]) => setTrouves(liste.slice(0, 6)))
        .catch(() => setTrouves([]));
    }, 250);
    return () => clearTimeout(minuteur);
  }, [terme, client]);

  if (client) {
    const plafond = Number(client.credit_limit);
    return (
      <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <span>
          <strong>{client.name}</strong> <span className="small muted mono">{client.code}</span>
          <br />
          <span className="small muted">
            Encours {money(client.outstanding_balance, devise)}
            {plafond > 0 ? ` / plafond ${money(plafond, devise)}` : ''}
          </span>
          {client.is_credit_blocked && <span className="tag danger" style={{ marginLeft: '0.35rem' }}>Crédit bloqué</span>}
          {client.group_name && (
            <span className="tag ok" style={{ marginLeft: '0.35rem' }}>
              {client.group_name}{Number(client.group_discount) > 0 ? ` −${Number(client.group_discount).toLocaleString('fr-FR')} %` : ''}
            </span>
          )}
        </span>
        <button type="button" className="secondaire petit" onClick={() => { onChange(null); setTerme(''); }}>Changer</button>
      </div>
    );
  }

  return (
    <>
      <input id={id} value={terme} onChange={(e) => setTerme(e.target.value)} autoComplete="off"
        placeholder="Nom, code ou téléphone du client" />
      {trouves.length > 0 && (
        <div className="offres-liste" style={{ marginTop: '0.4rem' }}>
          {trouves.map((c) => (
            <button type="button" key={c.id} className="offre" onClick={() => onChange(c)}>
              <strong>{c.name}</strong>
              <span className="small">{[c.code, c.phone].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      {terme.trim().length >= 2 && trouves.length === 0 && (
        <p className="small muted" style={{ margin: '0.3rem 0 0' }}>Aucun client trouvé : ajoutez-le d&apos;abord dans Clients.</p>
      )}
    </>
  );
}
