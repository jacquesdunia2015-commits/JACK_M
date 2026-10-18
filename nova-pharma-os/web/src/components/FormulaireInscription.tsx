'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Les libellés arrivent en propriétés plutôt que d'être lus ici : la
 * langue vit dans un cookie, que seul un composant serveur sait lire.
 */
export interface LibellesInscription {
  officine: string;
  ville: string;
  nom: string;
  telephone: string;
  aideTelephone: string;
  email: string;
  motDePasse: string;
  aideMotDePasse: string;
  confirmation: string;
  confirmationDifferente: string;
  bouton: string;
  enCours: string;
  echec: string;
  serviceInjoignable: string;
}

export default function FormulaireInscription({
  libelles,
}: {
  libelles: LibellesInscription;
}) {
  const router = useRouter();
  const [champs, setChamps] = useState({
    pharmacyName: '',
    city: '',
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmation: '',
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer =
    (cle: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    // Vérifié ici plutôt qu'au serveur : c'est une faute de frappe, pas
    // une règle métier, et la signaler avant l'envoi évite un aller-retour.
    if (champs.password !== champs.confirmation) {
      setErreur(libelles.confirmationDifferente);
      return;
    }
    setEnvoi(true);
    try {
      const { confirmation: _confirmation, ...donnees } = champs;
      const response = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
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
        <label htmlFor="officine">{libelles.officine}</label>
        <input
          id="officine"
          value={champs.pharmacyName}
          onChange={changer('pharmacyName')}
          autoComplete="organization"
          required
          minLength={2}
        />
      </div>

      <div className="field">
        <label htmlFor="ville">{libelles.ville}</label>
        <input
          id="ville"
          value={champs.city}
          onChange={changer('city')}
          autoComplete="address-level2"
          placeholder="Bukavu"
        />
      </div>

      <div className="field">
        <label htmlFor="nom">{libelles.nom}</label>
        <input
          id="nom"
          value={champs.fullName}
          onChange={changer('fullName')}
          autoComplete="name"
          required
          minLength={2}
        />
      </div>

      <div className="field">
        <label htmlFor="telephone">{libelles.telephone}</label>
        <input
          id="telephone"
          type="tel"
          inputMode="tel"
          value={champs.phone}
          onChange={changer('phone')}
          autoComplete="tel"
          placeholder="0991 234 567"
          required
        />
        <p className="small muted" style={{ marginTop: '0.3rem', marginBottom: 0 }}>
          {libelles.aideTelephone}
        </p>
      </div>

      <div className="field">
        <label htmlFor="email">{libelles.email}</label>
        <input
          id="email"
          type="email"
          value={champs.email}
          onChange={changer('email')}
          autoComplete="email"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">{libelles.motDePasse}</label>
        <input
          id="password"
          type="password"
          value={champs.password}
          onChange={changer('password')}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="small muted" style={{ marginTop: '0.3rem', marginBottom: 0 }}>
          {libelles.aideMotDePasse}
        </p>
      </div>

      <div className="field">
        <label htmlFor="confirmation">{libelles.confirmation}</label>
        <input
          id="confirmation"
          type="password"
          value={champs.confirmation}
          onChange={changer('confirmation')}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <button type="submit" disabled={envoi} style={{ width: '100%' }}>
        {envoi ? libelles.enCours : libelles.bouton}
      </button>
    </form>
  );
}
