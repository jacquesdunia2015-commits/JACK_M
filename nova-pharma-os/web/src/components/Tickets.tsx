'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { STATUTS_TICKET } from '@/lib/tickets';

const CATEGORIES = [
  { code: 'question', label: 'Question' },
  { code: 'incident', label: 'Quelque chose ne marche pas' },
  { code: 'bug', label: 'Erreur de l’application' },
  { code: 'feature_request', label: 'Idée d’amélioration' },
  { code: 'billing', label: 'Abonnement et facturation' },
];


async function envoyer(url: string, methode: string, corps: unknown) {
  const response = await fetch(url, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Envoi refusé.');
  return body;
}

/** Ouvrir un ticket auprès du support NOVA PHARMA OS. */
export function NouveauTicket() {
  const router = useRouter();
  const [sujet, setSujet] = useState('');
  const [categorie, setCategorie] = useState('question');
  const [urgent, setUrgent] = useState(false);
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const ticket = await envoyer('/api/proxy/account/support/tickets', 'POST', {
        subject: sujet.trim(), description: description.trim(), category: categorie, priority: urgent ? 'high' : 'normal',
      });
      router.push(`/pharmacie/support/${ticket.id}`);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="grid grid-2" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="t-sujet">Objet</label>
          <input id="t-sujet" value={sujet} onChange={(e) => setSujet(e.target.value)} required minLength={3} placeholder="Ex. : la facture ne s'imprime pas" />
        </div>
        <div className="field">
          <label htmlFor="t-categorie">Nature</label>
          <select id="t-categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-description">Décrivez la situation</label>
        <textarea id="t-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10}
          placeholder="Ce que vous faisiez, ce qui s'est passé, le message affiché…" />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label className="case"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent : la vente est bloquée</label>
        <button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer au support'}</button>
      </div>
    </form>
  );
}

/**
 * Répondre sur un ticket. Côté NOVA PHARMA OS, on peut écrire une note
 * interne (invisible pour la pharmacie) et changer le statut.
 */
export function ReponseTicket({
  ticketId,
  espace,
  statut,
}: {
  ticketId: string;
  espace: 'pharmacie' | 'plateforme';
  statut: string;
}) {
  const router = useRouter();
  const [texte, setTexte] = useState('');
  const [interne, setInterne] = useState(false);
  const [nouveauStatut, setNouveauStatut] = useState(statut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = espace === 'pharmacie' ? `/api/proxy/account/support/tickets/${ticketId}` : `/api/proxy/platform/support/tickets/${ticketId}`;

  async function repondre(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (texte.trim()) {
        await envoyer(`${base}/messages`, 'POST', { body: texte.trim(), ...(espace === 'plateforme' ? { isInternalNote: interne } : {}) });
      }
      if (espace === 'plateforme' && nouveauStatut !== statut) await envoyer(base, 'PATCH', { status: nouveauStatut });
      setTexte('');
      router.refresh();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={repondre}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="field">
        <label htmlFor="t-reponse">{espace === 'pharmacie' ? 'Votre message' : 'Réponse'}</label>
        <textarea id="t-reponse" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} required={espace === 'pharmacie'} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {espace === 'plateforme' ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <label className="case"><input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} /> Note interne</label>
            <select aria-label="Statut" value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)} style={{ maxWidth: 240 }}>
              {Object.entries(STATUTS_TICKET).map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
            </select>
          </div>
        ) : <span />}
        <button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer'}</button>
      </div>
    </form>
  );
}
