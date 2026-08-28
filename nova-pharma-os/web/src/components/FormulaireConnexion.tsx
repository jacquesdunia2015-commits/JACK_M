'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Les libellés arrivent en propriétés plutôt que d'être lus ici : la
 * langue vit dans un cookie, que seul un composant serveur sait lire.
 */
export interface LibellesConnexion {
  email: string;
  motDePasse: string;
  identifiant: string;
  facultatif: string;
  aideIdentifiant: string;
  bouton: string;
  enCours: string;
  echec: string;
  serviceInjoignable: string;
}

export default function FormulaireConnexion({
  space,
  libelles,
}: {
  space: 'pharmacy' | 'platform';
  libelles: LibellesConnexion;
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
        setErreur(body.message ?? libelles.echec);
        return;
      }
      router.push(body.redirectTo);
      router.refresh();
    } catch {
      setErreur(libelles.serviceInjoignable);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {erreur && <div className="erreur">{erreur}</div>}

      <div className="field">
        <label htmlFor="email">{libelles.email}</label>
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
        <label htmlFor="password">{libelles.motDePasse}</label>
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
            {libelles.identifiant} <span className="muted">({libelles.facultatif})</span>
          </label>
          <input
            id="slug"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            placeholder="nova-sante-pharma"
          />
          <p className="small muted" style={{ marginTop: '0.3rem', marginBottom: 0 }}>
            {libelles.aideIdentifiant}
          </p>
        </div>
      )}

      <button type="submit" disabled={envoi} style={{ width: '100%' }}>
        {envoi ? libelles.enCours : libelles.bouton}
      </button>
    </form>
  );
}
