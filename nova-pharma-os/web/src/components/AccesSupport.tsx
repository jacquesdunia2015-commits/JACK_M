'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dateTime } from '@/lib/format';

export interface Grant {
  id: string; reason: string; mode: string; status: string;
  agent_name: string | null; agent_email: string | null;
  requested_at: string; approved_at: string | null; expires_at: string;
  requires_customer_approval: boolean; actions: string;
}

/**
 * Décision de la pharmacie sur une demande d'accès du support.
 * Rien ne s'ouvre sans un geste explicite du client.
 */
export default function AccesSupport({ grants }: { grants: Grant[] }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);

  async function decider(id: string, action: 'approve' | 'deny' | 'revoke') {
    setEnCours(id);
    try {
      await fetch(`/api/proxy/account/support-access/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  if (grants.length === 0) {
    return (
      <div className="empty">
        Aucun agent NOVA PHARMA OS n&apos;a demandé l&apos;accès à vos données.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Motif</th>
            <th>Portée</th>
            <th>Statut</th>
            <th className="num">Expire</th>
            <th className="num">Actions tracées</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {grants.map((g) => (
            <tr key={g.id}>
              <td>
                {g.agent_name ?? '—'}
                <br />
                <span className="small muted">{g.agent_email}</span>
              </td>
              <td className="small" style={{ maxWidth: 280 }}>
                {g.reason}
              </td>
              <td>
                <span className={`tag ${g.mode === 'read_only' ? '' : 'warn'}`}>
                  {g.mode === 'read_only' ? 'Lecture seule' : 'Lecture et écriture'}
                </span>
              </td>
              <td>
                <span
                  className={`tag ${
                    g.status === 'active'
                      ? 'ok'
                      : g.status === 'requested'
                        ? 'warn'
                        : 'muted'
                  }`}
                >
                  {
                    {
                      requested: 'En attente de votre accord',
                      active: 'Actif',
                      approved: 'Autorisé',
                      revoked: 'Révoqué',
                      denied: 'Refusé',
                      expired: 'Expiré',
                    }[g.status] ?? g.status
                  }
                </span>
              </td>
              <td className="num small">{dateTime(g.expires_at)}</td>
              <td className="num">{g.actions}</td>
              <td>
                {g.status === 'requested' && (
                  <div className="row" style={{ gap: '0.35rem' }}>
                    <button
                      className="petit"
                      disabled={enCours === g.id}
                      onClick={() => decider(g.id, 'approve')}
                    >
                      Autoriser
                    </button>
                    <button
                      className="petit secondaire"
                      disabled={enCours === g.id}
                      onClick={() => decider(g.id, 'deny')}
                    >
                      Refuser
                    </button>
                  </div>
                )}
                {g.status === 'active' && (
                  <button
                    className="petit danger"
                    disabled={enCours === g.id}
                    onClick={() => decider(g.id, 'revoke')}
                  >
                    Révoquer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
