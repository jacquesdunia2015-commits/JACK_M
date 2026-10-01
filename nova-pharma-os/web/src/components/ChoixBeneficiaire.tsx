'use client';

import { useEffect, useState } from 'react';

export interface Beneficiaire {
  id: string;
  member_number: string;
  full_name: string;
  principal_name: string | null;
  valid_until: string | null;
  is_active: boolean;
  coverage_percent: string;
  payer_id: string;
  payer_name: string;
}

/**
 * Recherche d'un bénéficiaire du tiers payant au comptoir : nom, numéro de
 * carte, matricule ou téléphone, toutes mutuelles et assurances confondues.
 */
export default function ChoixBeneficiaire({
  beneficiaire,
  onChange,
}: {
  beneficiaire: Beneficiaire | null;
  onChange: (b: Beneficiaire | null) => void;
}) {
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<Beneficiaire[]>([]);
  const [cherche, setCherche] = useState(false);

  useEffect(() => {
    if (beneficiaire || terme.trim().length < 2) { setResultats([]); return; }
    const minuteur = setTimeout(async () => {
      setCherche(true);
      try {
        const r = await fetch(`/api/proxy/payers/members?q=${encodeURIComponent(terme.trim())}`);
        setResultats(r.ok ? await r.json() : []);
      } finally {
        setCherche(false);
      }
    }, 250);
    return () => clearTimeout(minuteur);
  }, [terme, beneficiaire]);

  if (beneficiaire) {
    return (
      <div className="beneficiaire-choisi">
        <div>
          <strong>{beneficiaire.full_name}</strong>
          <div className="small muted">
            {beneficiaire.payer_name} · carte <span className="mono">{beneficiaire.member_number}</span> ·{' '}
            {Number(beneficiaire.coverage_percent).toLocaleString('fr-FR')} %
            {beneficiaire.principal_name ? ` · ayant droit de ${beneficiaire.principal_name}` : ''}
          </div>
        </div>
        <button type="button" className="secondaire petit" onClick={() => { onChange(null); setTerme(''); }}>Changer</button>
      </div>
    );
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <input
        id="choix-beneficiaire"
        value={terme}
        onChange={(e) => setTerme(e.target.value)}
        placeholder="Nom, n° de carte ou matricule…"
        autoComplete="off"
      />
      {(resultats.length > 0 || (terme.trim().length >= 2 && !cherche)) && (
        <div className="liste-choix">
          {resultats.map((b) => {
            const expiree = b.valid_until !== null && b.valid_until.slice(0, 10) < aujourdhui;
            const utilisable = b.is_active && !expiree;
            return (
              <button
                type="button"
                key={b.id}
                className="choix"
                disabled={!utilisable}
                onClick={() => onChange(b)}
              >
                <strong>{b.full_name}</strong>{' '}
                <span className="small muted">
                  {b.payer_name} · {b.member_number} · {Number(b.coverage_percent).toLocaleString('fr-FR')} %
                  {!b.is_active ? ' · carte désactivée' : expiree ? ' · carte expirée' : ''}
                </span>
              </button>
            );
          })}
          {resultats.length === 0 && (
            <div className="small muted" style={{ padding: '0.4rem 0.2rem' }}>
              Aucun bénéficiaire. Enregistrez sa carte dans Tiers payant.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
