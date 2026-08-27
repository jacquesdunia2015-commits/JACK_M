'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '@/lib/format';

export default function OuvertureCaisse({
  sessionOuverte,
  lectureSeule,
}: {
  sessionOuverte: { id: string; expected_cash: string } | null;
  lectureSeule: boolean;
}) {
  const router = useRouter();
  const [fonds, setFonds] = useState('50');
  const [compte, setCompte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function appeler(url: string, corps: unknown) {
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const body = await response.json();
      if (!response.ok) {
        setErreur(body.message ?? 'Opération refusée.');
        return null;
      }
      router.refresh();
      return body;
    } finally {
      setEnvoi(false);
    }
  }

  if (lectureSeule) return null;

  if (!sessionOuverte) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Ouvrir la caisse</h2>
          <span className="hint">Indiquez le fonds de caisse initial</span>
        </div>
        {erreur && <div className="erreur">{erreur}</div>}
        <div className="row">
          <div style={{ maxWidth: 200 }}>
            <label htmlFor="fonds">Fonds de caisse</label>
            <input
              id="fonds"
              type="number"
              step="0.01"
              value={fonds}
              onChange={(e) => setFonds(e.target.value)}
            />
          </div>
          <button
            disabled={envoi}
            style={{ marginTop: '1.35rem' }}
            onClick={() =>
              appeler('/api/proxy/cash/sessions', {
                registerCode: 'CAISSE-1',
                openingFloat: Number(fonds),
              })
            }
          >
            Ouvrir la caisse
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Clôturer la caisse</h2>
        <span className="hint">
          Comptez les espèces en caisse : l&apos;écart éventuel est conservé
        </span>
      </div>
      {erreur && <div className="erreur">{erreur}</div>}
      {message && <div className="banner info">{message}</div>}
      <div className="row">
        <div style={{ maxWidth: 220 }}>
          <label htmlFor="compte">Espèces comptées</label>
          <input
            id="compte"
            type="number"
            step="0.01"
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            placeholder={Number(sessionOuverte.expected_cash).toFixed(2)}
          />
        </div>
        <span className="muted small" style={{ marginTop: '1.5rem' }}>
          Attendu : <strong>{money(sessionOuverte.expected_cash)}</strong>
        </span>
        <div className="spacer" />
        <button
          className="secondaire"
          disabled={envoi || compte === ''}
          style={{ marginTop: '1.35rem' }}
          onClick={async () => {
            const res = await appeler(
              `/api/proxy/cash/sessions/${sessionOuverte.id}/close`,
              { countedCash: Number(compte) },
            );
            if (res) setMessage(res.message);
          }}
        >
          Clôturer
        </button>
      </div>
    </section>
  );
}
