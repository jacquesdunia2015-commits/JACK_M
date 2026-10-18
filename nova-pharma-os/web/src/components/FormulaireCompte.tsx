'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface OptionRole {
  code: string;
  libelle: string;
}

/**
 * Création d'un compte par un administrateur : nom, téléphone, e-mail,
 * mot de passe et rôle.
 *
 * Le même formulaire sert à l'équipe d'une pharmacie (`roleCodes`, une
 * liste) et aux comptes internes du back-office (`role`, une valeur) ;
 * seul le format du rôle envoyé diffère. Les droits ne sont pas décidés
 * ici : l'API refuse la création à qui n'a pas la permission.
 */
export default function FormulaireCompte({
  destination,
  roles,
  champRole,
  roleParDefaut,
}: {
  destination: string;
  roles: OptionRole[];
  champRole: 'roleCodes' | 'role';
  roleParDefaut?: string;
}) {
  const router = useRouter();
  const vide = {
    fullName: '',
    phone: '',
    email: '',
    password: '',
    role: roleParDefaut ?? roles[0]?.code ?? '',
  };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer =
    (cle: keyof typeof champs) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const { role, ...identite } = champs;
      const response = await fetch(destination, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identite,
          [champRole]: champRole === 'roleCodes' ? (role ? [role] : []) : role,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Création refusée.' });
        return;
      }
      setMessage({
        ton: 'info',
        texte: `Compte créé pour ${body.full_name ?? champs.fullName}. Communiquez-lui son mot de passe de vive voix, jamais par écrit.`,
      });
      setChamps(vide);
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="compte-nom">Nom complet</label>
          <input
            id="compte-nom"
            value={champs.fullName}
            onChange={changer('fullName')}
            autoComplete="off"
            required
            minLength={2}
          />
        </div>

        <div className="field">
          <label htmlFor="compte-telephone">Téléphone</label>
          <input
            id="compte-telephone"
            type="tel"
            inputMode="tel"
            value={champs.phone}
            onChange={changer('phone')}
            autoComplete="off"
            placeholder="0991 234 567 ou +243 991 234 567"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="compte-email">Adresse e-mail</label>
          <input
            id="compte-email"
            type="email"
            value={champs.email}
            onChange={changer('email')}
            autoComplete="off"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="compte-mot-de-passe">Mot de passe (8 caractères minimum)</label>
          <input
            id="compte-mot-de-passe"
            type="password"
            value={champs.password}
            onChange={changer('password')}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div className="field">
          <label htmlFor="compte-role">Rôle</label>
          <select id="compte-role" value={champs.role} onChange={changer('role')} required>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" disabled={envoi}>
        {envoi ? 'Création…' : 'Créer le compte'}
      </button>
    </form>
  );
}
