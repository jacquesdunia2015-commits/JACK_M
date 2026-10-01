'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyer, nombreSaisi } from '@/lib/envoi';

export interface Operateur { code: string; label: string; merchant_number: string | null }
export interface Attente { id: string; reference: string; operator_code: string; payer_phone: string; amount: string; currency: string }

/** Nouvelle demande d'encaissement : NOVA donne les instructions à dicter au client. */
export function NouvelleDemande({ operateurs }: { operateurs: Operateur[] }) {
  const router = useRouter();
  const [v, setV] = useState({ operatorCode: operateurs[0]?.code ?? 'mpesa', payerPhone: '', amount: '' });
  const [instructions, setInstructions] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <form className="row" style={{ alignItems: 'end', gap: '0.75rem' }} onSubmit={async (e) => {
      e.preventDefault();
      setErreur(null);
      const r = await envoyer<{ instructions: string; reference: string }>('/payments/mobile-money', { operatorCode: v.operatorCode, payerPhone: v.payerPhone.trim(), amount: nombreSaisi(v.amount) });
      if (!r.ok) { setErreur(r.message); return; }
      setInstructions(`${r.body.reference} — ${r.body.instructions}`);
      setV({ ...v, payerPhone: '', amount: '' });
      router.refresh();
    }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="mm-op">Opérateur</label>
        <select id="mm-op" value={v.operatorCode} onChange={(e) => setV({ ...v, operatorCode: e.target.value })}>
          {operateurs.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="mm-tel">Numéro du client</label>
        <input id="mm-tel" inputMode="tel" value={v.payerPhone} onChange={(e) => setV({ ...v, payerPhone: e.target.value })} required />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="mm-montant">Montant</label>
        <input id="mm-montant" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} required style={{ width: '8rem' }} />
      </div>
      <button type="submit">Demander le versement</button>
      {instructions && <div className="banner info" style={{ width: '100%', margin: 0 }}>{instructions}</div>}
      {erreur && <div className="banner danger" style={{ width: '100%', margin: 0 }}>{erreur}</div>}
    </form>
  );
}

/** Confirmer un versement : en collant le SMS de l'opérateur (recommandé) ou en tapant l'identifiant. */
export function ConfirmerVersement({ id }: { id: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'sms' | 'id'>(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = async () => {
    setErreur(null);
    const r = mode === 'sms'
      ? await envoyer(`/payments/mobile-money/${id}/confirm-sms`, { text: texte })
      : await envoyer(`/payments/mobile-money/${id}/confirm`, { operatorReference: texte.trim() });
    if (!r.ok) { setErreur(r.message); return; }
    setMode(null); setTexte('');
    router.refresh();
  };
  if (!mode) {
    return (
      <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
        <button type="button" className="petit" onClick={() => setMode('sms')}>Coller le SMS</button>
        <button type="button" className="secondaire petit" onClick={() => setMode('id')}>Taper l’identifiant</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.35rem', minWidth: 260 }}>
      {mode === 'sms'
        ? <textarea rows={3} aria-label="SMS de l’opérateur" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Collez ici le SMS reçu sur le téléphone marchand" />
        : <input aria-label="Identifiant de transaction" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Identifiant de transaction" />}
      <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
        <button type="button" className="petit" onClick={() => void valider()} disabled={texte.trim().length < 4}>Confirmer</button>
        <button type="button" className="secondaire petit" onClick={() => { setMode(null); setTexte(''); setErreur(null); }}>Annuler</button>
      </div>
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
    </div>
  );
}

/** Lien de transfert automatique des SMS depuis le téléphone marchand. */
export function LienTransfertSms({ etat, peutRegler }: { etat: { token_hint: string; is_active: boolean; last_received_at: string | null } | null; peutRegler: boolean }) {
  const router = useRouter();
  const [lien, setLien] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const creer = async () => {
    if (etat?.is_active && !window.confirm('Un nouveau lien remplace l’ancien : il faudra le recopier dans l’application du téléphone. Continuer ?')) return;
    const r = await envoyer<{ token: string }>('/payments/mobile-money/sms-link', {});
    if (!r.ok) { setErreur(r.message); return; }
    setLien(`${window.location.origin}/api/public/mobile-money/sms/${r.body.token}`);
    router.refresh();
  };
  const couper = async () => {
    const r = await envoyer('/payments/mobile-money/sms-link', undefined, 'DELETE');
    if (r.ok) { setLien(null); router.refresh(); }
  };
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <p style={{ margin: 0 }}>
        État : {etat?.is_active
          ? <><span className="tag ok">Actif</span> lien {etat.token_hint}{etat.last_received_at ? ` · dernier SMS reçu le ${new Date(etat.last_received_at).toLocaleString('fr-FR')}` : ' · aucun SMS reçu pour l’instant'}</>
          : <span className="tag muted">Non configuré</span>}
      </p>
      {lien && (
        <div className="banner warn" style={{ margin: 0 }}>
          <strong>Votre lien secret (affiché une seule fois) :</strong>
          <div className="mono" style={{ wordBreak: 'break-all', margin: '0.35rem 0' }}>{lien}</div>
          <button type="button" className="secondaire petit" onClick={() => void navigator.clipboard?.writeText(lien)}>Copier</button>
        </div>
      )}
      {peutRegler && (
        <div className="row" style={{ gap: '0.5rem' }}>
          <button type="button" className={etat?.is_active ? 'secondaire' : ''} onClick={() => void creer()}>{etat?.is_active ? 'Créer un nouveau lien' : 'Créer le lien secret'}</button>
          {etat?.is_active && <button type="button" className="secondaire" onClick={() => void couper()}>Couper le transfert</button>}
        </div>
      )}
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
      <ol className="small" style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
        <li>Sur le téléphone Android qui reçoit les SMS Mobile Money de la pharmacie, installez une application gratuite de transfert de SMS vers une adresse web (« SMS Forwarder », « SMS to URL Forwarder »…).</li>
        <li>Réglez-la pour ne transférer que les SMS des opérateurs (expéditeurs M-PESA, Orange Money, Airtel Money…), en méthode POST, avec le texte du SMS dans un champ <span className="mono">text</span> (ou <span className="mono">message</span>) et l’expéditeur dans <span className="mono">from</span>.</li>
        <li>Collez le lien secret comme adresse de destination. Chaque versement attendu sera confirmé tout seul ; les SMS ambigus attendent ci-dessous.</li>
      </ol>
    </div>
  );
}

/** SMS reçus sans correspondance certaine : à rapprocher ou à écarter. */
export function SmsEnAttente({ id, attentes }: { id: string; attentes: Attente[] }) {
  const router = useRouter();
  const [choix, setChoix] = useState(attentes[0]?.id ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
      {attentes.length > 0 && (
        <>
          <select aria-label="Versement attendu" value={choix} onChange={(e) => setChoix(e.target.value)}>
            {attentes.map((a) => <option key={a.id} value={a.id}>{a.reference} · {a.payer_phone} · {Number(a.amount).toLocaleString('fr-FR')} {a.currency}</option>)}
          </select>
          <button type="button" className="petit" onClick={async () => {
            const r = await envoyer(`/payments/mobile-money/sms/${id}/match`, { collectionId: choix });
            if (!r.ok) { setErreur(r.message); return; }
            router.refresh();
          }}>Rapprocher</button>
        </>
      )}
      <button type="button" className="secondaire petit" onClick={async () => { const r = await envoyer(`/payments/mobile-money/sms/${id}/ignore`, {}); if (r.ok) router.refresh(); }}>Écarter</button>
      {erreur && <div className="small" style={{ color: 'var(--alerte)', width: '100%', textAlign: 'right' }}>{erreur}</div>}
    </div>
  );
}
