'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Actions de cycle de vie d'une pharmacie cliente.
 *
 * Chaque action exige un motif : c'est ce motif qui est consigné dans le
 * journal d'audit de la plateforme, et qui rend la décision explicable
 * plusieurs mois plus tard.
 */
export default function ActionsPharmacie({
  organizationId,
  statut,
}: {
  organizationId: string;
  statut: string;
}) {
  const router = useRouter();
  const [motif, setMotif] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function agir(action: string, corps: Record<string, unknown>) {
    setEnvoi(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/proxy/platform/organizations/${organizationId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        },
      );
      const body = await response.json();
      setMessage({
        ton: response.ok ? 'info' : 'danger',
        texte: body.message ?? (response.ok ? 'Opération effectuée.' : 'Opération refusée.'),
      });
      if (response.ok) {
        setMotif('');
        router.refresh();
      }
    } finally {
      setEnvoi(false);
    }
  }

  const motifTropCourt = motif.trim().length < 5;

  return (
    <>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <div className="field">
        <label htmlFor="motif">Motif de l&apos;intervention</label>
        <input
          id="motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Consigné au journal d'audit de la plateforme"
        />
      </div>

      <div className="row">
        {statut !== 'suspended' && statut !== 'terminated' && (
          <button
            className="secondaire"
            disabled={envoi || motifTropCourt}
            onClick={() => agir('suspend', { reason: motif })}
          >
            Suspendre
          </button>
        )}
        {statut === 'suspended' && (
          <button
            disabled={envoi || motifTropCourt}
            onClick={() => agir('reactivate', { reason: motif })}
          >
            Réactiver
          </button>
        )}
        {statut !== 'terminated' && (
          <button
            className="danger"
            disabled={envoi || motifTropCourt}
            onClick={() => agir('terminate', { reason: motif, retentionDays: 365 })}
          >
            Résilier
          </button>
        )}
        <div className="spacer" />
        <button
          className="secondaire"
          disabled={envoi}
          onClick={() => agir('backups', {})}
        >
          Sauvegarder maintenant
        </button>
      </div>

      <p className="small muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        La suspension ne supprime aucune donnée : la pharmacie conserve un accès en
        lecture seule. La résiliation ouvre une période de conservation
        contractuelle avant archivage.
      </p>
    </>
  );
}
