'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FormulaireConnexion({
  space,
}: {
  space: 'pharmacy' | 'platform';
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          space,
          organizationSlug: organizationSlug || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setErreur(body.message ?? 'Connexion impossible.');
        return;
      }
      router.push(body.redirectTo);
      router.refresh();
    } catch {
      setErreur("Le service est injoignable. Vérifiez votre connexion.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {erreur && <div className="erreur">{erreur}</div>}

      <div className="field">
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {space === 'pharmacy' && (
        <div className="field">
          <label htmlFor="slug">
            Identifiant de la pharmacie <span className="muted">(facultatif)</span>
          </label>
          <input
            id="slug"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            placeholder="nova-sante-pharma"
          />
          <p className="small muted" style={{ marginTop: '0.3rem', marginBottom: 0 }}>
            À renseigner seulement si votre adresse sert dans plusieurs pharmacies.
          </p>
        </div>
      )}

      <button type="submit" disabled={envoi} style={{ width: '100%' }}>
        {envoi ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
