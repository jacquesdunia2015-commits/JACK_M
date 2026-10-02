'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EVENEMENT_FILE, lireFile } from '@/lib/hors-ligne';
import { money } from '@/lib/format';

export default function OuvertureCaisse({
  devise = 'USD',
  autre = null,
  autresDevises = [],
  sessionOuverte,
  lectureSeule,
}: {
  /** Devise de la pharmacie, pour les montants affichés. */
  devise?: string;
  /** Seconde devise de la caisse (francs), si un taux est fixé. */
  autre?: string | null;
  /** Attendu de la caisse ouverte dans chaque autre devise. */
  autresDevises?: { currency: string; expected_cash: string }[];
  sessionOuverte: { id: string; expected_cash: string } | null;
  lectureSeule: boolean;
}) {
  const router = useRouter();
  const [fonds, setFonds] = useState('50');
  const [fondsAutre, setFondsAutre] = useState('');
  const [compte, setCompte] = useState('');
  const [comptesAutres, setComptesAutres] = useState<Record<string, string>>({});
  const libelle = (d: string) => (d === 'CDF' ? 'FC' : d);
  // Les ventes gardées sur ce poste pendant une coupure doivent être
  // envoyées avant de compter la caisse : sinon l'attendu serait faux.
  const [enAttente, setEnAttente] = useState(0);
  useEffect(() => {
    const lire = () => setEnAttente(lireFile().length);
    lire();
    window.addEventListener(EVENEMENT_FILE, lire);
    return () => window.removeEventListener(EVENEMENT_FILE, lire);
  }, []);
  const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));
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
      const body = await response.json().catch(() => ({}));
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
        {message && <div className="banner info">{message}</div>}
        {erreur && <div className="erreur">{erreur}</div>}
        <div className="row">
          <div style={{ maxWidth: 200 }}>
            <label htmlFor="fonds">Fonds de caisse{autre ? ` en ${libelle(devise)}` : ''}</label>
            <input
              id="fonds"
              inputMode="decimal"
              value={fonds}
              onChange={(e) => setFonds(e.target.value)}
            />
          </div>
          {autre && (
            <div style={{ maxWidth: 200 }}>
              <label htmlFor="fonds-autre">Fonds en {libelle(autre)}</label>
              <input
                id="fonds-autre"
                inputMode="decimal"
                value={fondsAutre}
                onChange={(e) => setFondsAutre(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
          <button
            disabled={envoi}
            style={{ marginTop: '1.35rem' }}
            onClick={() =>
              appeler('/api/proxy/cash/sessions', {
                registerCode: 'CAISSE-1',
                openingFloat: nombre(fonds) || 0,
                ...(autre ? { openingFloats: [{ currency: autre, amount: nombre(fondsAutre) || 0 }] } : {}),
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
      {enAttente > 0 && (
        <div className="banner warn">
          {enAttente} vente(s) faite(s) hors connexion ne sont pas encore envoyées : attendez le retour du réseau
          (ou régularisez-les) avant de clôturer.
        </div>
      )}
      <div className="row">
        <div style={{ maxWidth: 220 }}>
          <label htmlFor="compte">Espèces comptées{autresDevises.length ? ` en ${libelle(devise)}` : ''}</label>
          <input
            id="compte"
            inputMode="decimal"
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            placeholder={Number(sessionOuverte.expected_cash).toFixed(2)}
          />
          <span className="muted small">
            Attendu : <strong>{money(sessionOuverte.expected_cash, devise)}</strong>
          </span>
        </div>
        {autresDevises.map((a) => (
          <div key={a.currency} style={{ maxWidth: 220 }}>
            <label htmlFor={`compte-${a.currency}`}>Espèces comptées en {libelle(a.currency)}</label>
            <input
              id={`compte-${a.currency}`}
              inputMode="decimal"
              value={comptesAutres[a.currency] ?? ''}
              onChange={(e) => setComptesAutres((c) => ({ ...c, [a.currency]: e.target.value }))}
              placeholder={String(Number(a.expected_cash))}
            />
            <span className="muted small">
              Attendu : <strong>{money(a.expected_cash, a.currency)}</strong>
            </span>
          </div>
        ))}
        <div className="spacer" />
        <button
          className="secondaire"
          disabled={envoi || enAttente > 0 || compte === '' || autresDevises.some((a) => !(comptesAutres[a.currency] ?? '').trim())}
          style={{ marginTop: '1.35rem' }}
          onClick={async () => {
            const res = await appeler(
              `/api/proxy/cash/sessions/${sessionOuverte.id}/close`,
              {
                countedCash: nombre(compte),
                countedOther: autresDevises.map((a) => ({ currency: a.currency, amount: nombre(comptesAutres[a.currency]) })),
              },
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
