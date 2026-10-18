'use client';

import { useEffect, useState } from 'react';
import { envoyer } from '@/lib/envoi';

/** Changer son mot de passe : l'actuel, puis le nouveau deux fois. */
export function ChangerMotDePasse() {
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const faible = nouveau.length > 0 && (nouveau.length < 8 || !/\d/.test(nouveau) || !/[A-Za-zÀ-ÿ]/.test(nouveau));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (nouveau !== confirmation) { setMessage({ ton: 'danger', texte: 'Les deux nouveaux mots de passe ne sont pas identiques.' }); return; }
    setEnvoi(true);
    try {
      const r = await fetch('/api/compte/mot-de-passe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: actuel, newPassword: nouveau }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage({ ton: 'danger', texte: body.message ?? 'Changement refusé.' }); return; }
      setMessage({ ton: 'info', texte: `${body.message} Vous restez connecté sur cet appareil.` });
      setActuel(''); setNouveau(''); setConfirmation('');
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} style={{ maxWidth: 420 }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="field">
        <label htmlFor="mdp-actuel">Mot de passe actuel</label>
        <input id="mdp-actuel" type="password" value={actuel} onChange={(e) => setActuel(e.target.value)} autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="mdp-nouveau">Nouveau mot de passe</label>
        <input id="mdp-nouveau" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" required minLength={8} />
        <span className="small" style={{ color: faible ? 'var(--alerte)' : 'var(--gris)' }}>
          Au moins 8 caractères, avec des lettres et au moins un chiffre. Une phrase courte est plus sûre qu’un mot.
        </span>
      </div>
      <div className="field">
        <label htmlFor="mdp-confirmation">Nouveau mot de passe, encore une fois</label>
        <input id="mdp-confirmation" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required />
      </div>
      <button type="submit" disabled={envoi || faible}>{envoi ? 'Enregistrement…' : 'Changer le mot de passe'}</button>
      <p className="small muted">Toutes vos autres sessions (autres ordinateurs, téléphones) seront fermées.</p>
    </form>
  );
}

/**
 * Double authentification : un QR code à scanner avec une application
 * gratuite, un premier code pour confirmer, puis les codes de secours à
 * garder en lieu sûr.
 */
export function DoubleAuthentification() {
  const [etat, setEtat] = useState<{ enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number } | null>(null);
  const [preparation, setPreparation] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [secours, setSecours] = useState<string[] | null>(null);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const r = await fetch('/api/proxy/auth/2fa');
    if (r.ok) setEtat(await r.json());
  };
  useEffect(() => { void charger(); }, []);

  useEffect(() => {
    if (!preparation) { setQr(null); return; }
    void import('qrcode').then((QR) =>
      QR.toDataURL(preparation.otpauthUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setQr),
    );
  }, [preparation]);

  async function preparer() {
    setMessage(null);
    const r = await envoyer<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {});
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setPreparation(r.body);
  }

  async function activer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code: code.trim() });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setSecours(r.body.recoveryCodes);
    setPreparation(null);
    setCode('');
    void charger();
  }

  async function desactiver(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer('/auth/2fa/disable', { password: motDePasse, code: code.trim() });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: 'Double authentification désactivée. Votre mot de passe seul ouvre désormais le compte.' });
    setMotDePasse(''); setCode('');
    void charger();
  }

  if (!etat) return <p className="muted">Chargement…</p>;

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      {secours && (
        <div className="banner warn codes-secours">
          <strong>Vos codes de secours — notez-les maintenant</strong>
          Chacun ouvre votre compte une seule fois si vous perdez votre téléphone. Ils ne seront plus jamais affichés.
          <ul className="mono">{secours.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="row">
            <button type="button" className="secondaire petit" onClick={() => void navigator.clipboard?.writeText(secours.join('\n'))}>Copier</button>
            <button type="button" className="secondaire petit" onClick={() => window.print()}>Imprimer</button>
            <button type="button" className="petit" onClick={() => setSecours(null)}>Je les ai notés</button>
          </div>
        </div>
      )}

      {etat.enabled ? (
        <>
          <p style={{ margin: 0 }}>
            <span className="tag ok">Activée</span> depuis le {new Date(etat.enabledAt as string).toLocaleDateString('fr-FR')} ·{' '}
            {etat.recoveryCodesLeft} code(s) de secours restant(s).
          </p>
          <form onSubmit={desactiver} className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="d-mdp">Mot de passe</label>
              <input id="d-mdp" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" required />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="d-code">Code ou code de secours</label>
              <input id="d-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required style={{ width: '10rem' }} />
            </div>
            <button type="submit" className="secondaire" disabled={envoi}>Désactiver</button>
          </form>
        </>
      ) : preparation ? (
        <form onSubmit={activer} style={{ display: 'grid', gap: '0.75rem' }}>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
            <li>Installez une application d’authentification gratuite : Google Authenticator, Microsoft Authenticator ou 2FAS.</li>
            <li>Dans l’application, ajoutez un compte et scannez ce QR code.</li>
            <li>Saisissez ci-dessous le code à 6 chiffres qu’elle affiche.</li>
          </ol>
          <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
            {qr ? <img src={qr} alt="QR code à scanner avec l’application d’authentification" width={220} height={220} className="qr-2fa" /> : <div style={{ width: 220, height: 220 }} />}
            <div className="small">
              Pas de caméra ? Saisissez cette clé dans l’application :
              <div className="mono cle-2fa">{preparation.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
            </div>
          </div>
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="a-code">Code affiché par l’application</label>
              <input id="a-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="\d{3}\s?\d{3}" required style={{ width: '10rem' }} />
            </div>
            <button type="submit" disabled={envoi}>Activer</button>
            <button type="button" className="secondaire" onClick={() => setPreparation(null)}>Annuler</button>
          </div>
        </form>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            <span className="tag muted">Désactivée</span> Avec la double authentification, un mot de passe volé ne suffit plus :
            à chaque connexion, NOVA demande aussi le code de votre téléphone. Gratuit, sans SMS.
          </p>
          <div><button type="button" onClick={() => void preparer()}>Activer la double authentification</button></div>
        </>
      )}
    </div>
  );
}
