'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dateTime } from '@/lib/format';
import { TauxDuJour as Taux, fixeAujourdhui } from '@/lib/devises';

const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));

/**
 * Taux du jour de la caisse : « 1 USD = 2 850 FC ». Tant qu'il n'est pas
 * fixé, la caisse n'encaisse que dans la devise de la pharmacie ; fixé un
 * autre jour, il reste utilisable mais signalé.
 */
export default function TauxDuJour({
  devise,
  taux,
  modifiable,
}: {
  devise: string;
  taux: Taux | null;
  modifiable: boolean;
}) {
  const router = useRouter();
  // La devise forte en base : 1 USD = x CDF, que la pharmacie compte en dollars ou en francs.
  const base = taux?.base_currency ?? (devise === 'CDF' ? 'USD' : devise);
  const [cotee, setCotee] = useState(taux?.quote_currency ?? 'CDF');
  const [valeur, setValeur] = useState(taux ? String(Number(taux.rate)).replace('.', ',') : '');
  const [pas, setPas] = useState(taux ? String(Number(taux.change_rounding)) : '50');
  const [ouvert, setOuvert] = useState(!taux);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const aJour = fixeAujourdhui(taux);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await fetch('/api/proxy/cash/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrency: base, quoteCurrency: cotee, rate: nombre(valeur), changeRounding: nombre(pas || '0'),
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(body.message ?? 'Taux refusé.'); return; }
      setOuvert(false);
      router.refresh();
    } catch {
      setErreur('Service injoignable. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className={`card taux-du-jour${taux && !aJour ? ' a-revoir' : ''}`}>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-label">Taux du jour</div>
          {taux ? (
            <div>
              <strong className="mono" style={{ fontSize: '1.15rem' }}>
                1 {taux.base_currency} = {Number(taux.rate).toLocaleString('fr-FR')} {taux.quote_currency === 'CDF' ? 'FC' : taux.quote_currency}
              </strong>
              <span className="small muted">
                {' '}· fixé le {dateTime(taux.created_at)}{taux.set_by_name ? ` par ${taux.set_by_name}` : ''}
                {Number(taux.change_rounding) > 0 ? ` · monnaie rendue par ${Number(taux.change_rounding).toLocaleString('fr-FR')} ${taux.quote_currency === 'CDF' ? 'FC' : taux.quote_currency}` : ''}
              </span>
              {!aJour && <div className="small" style={{ color: 'var(--alerte)' }}>Ce taux n’a pas été fixé aujourd’hui : vérifiez-le.</div>}
            </div>
          ) : (
            <div className="small">
              Aucun taux : la caisse n’encaisse qu’en {devise}. Fixez le taux pour accepter aussi l’autre devise.
            </div>
          )}
        </div>
        {modifiable && !ouvert && (
          <button type="button" className="secondaire" onClick={() => setOuvert(true)}>Changer le taux</button>
        )}
      </div>

      {modifiable && ouvert && (
        <form onSubmit={enregistrer} style={{ marginTop: '0.75rem' }}>
          {erreur && <div className="banner danger">{erreur}</div>}
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="taux-valeur">1 {base} =</label>
              <input id="taux-valeur" inputMode="decimal" value={valeur} required pattern="[0-9\s]+([.,][0-9]+)?"
                onChange={(e) => setValeur(e.target.value)} placeholder="2850" style={{ width: '9rem' }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="taux-cotee">Devise</label>
              <select id="taux-cotee" value={cotee} onChange={(e) => setCotee(e.target.value)} disabled={Boolean(taux)}>
                {['CDF', 'USD', 'EUR'].filter((c) => c !== base).map((c) => <option key={c} value={c}>{c === 'CDF' ? 'FC (CDF)' : c}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="taux-pas">Monnaie rendue par</label>
              <input id="taux-pas" inputMode="decimal" value={pas} pattern="[0-9]+([.,][0-9]+)?"
                onChange={(e) => setPas(e.target.value)} style={{ width: '6rem' }} />
            </div>
            <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer le taux'}</button>
            {taux && <button type="button" className="secondaire" onClick={() => setOuvert(false)}>Annuler</button>}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            « Monnaie rendue par » : la plus petite coupure que vous rendez (50 ou 100 FC). La monnaie est arrondie à cette coupure.
          </p>
        </form>
      )}
    </section>
  );
}
