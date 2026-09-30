'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PartagePdf from '@/components/PartagePdf';
import { money } from '@/lib/format';

export interface FactureEmise {
  invoice: { id: string; number: string; total: string; currency: string; status: string };
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  created: boolean;
}

interface ClientTrouve {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** La facture en PDF : impression, partage, WhatsApp ou e-mail au client. */
export function DocumentFacture({
  factureId,
  numero,
  total,
  devise,
  client,
}: {
  factureId: string;
  numero: string;
  total: string;
  devise: string;
  client: { name: string; phone: string | null; email: string | null } | null;
}) {
  const nomClient = client?.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return (
    <PartagePdf
      url={`/api/proxy/invoices/${factureId}/pdf`}
      nomFichier={`${numero}${nomClient ? `-${nomClient}` : ''}.pdf`}
      titre={`Facture ${numero}`}
      texte={`Bonjour${client ? ` ${client.name}` : ''},\nVoici votre facture ${numero} d'un montant de ${money(total, devise)}.\nMerci de votre confiance.`}
      telephone={client?.phone}
      email={client?.email}
    />
  );
}

/**
 * Établir la facture d'une vente. Le client se choisit dans le fichier en
 * tapant son nom ou son téléphone ; sinon, le nom et le téléphone saisis
 * l'y ajoutent. Sans nom, la facture est au nom d'un client comptant.
 */
export function EmettreFacture({
  venteId,
  clientConnu = false,
  onEmise,
}: {
  venteId: string;
  /** La vente est déjà au nom d'un client : la facture le reprend. */
  clientConnu?: boolean;
  /** Sans rappel, on ouvre la facture émise. */
  onEmise?: (facture: FactureEmise) => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [choisi, setChoisi] = useState<ClientTrouve | null>(null);
  const [trouves, setTrouves] = useState<ClientTrouve[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Clients du fichier qui correspondent à ce qui est tapé.
  useEffect(() => {
    const terme = (telephone.replace(/\D/g, '').length >= 4 ? telephone : nom).trim();
    if (clientConnu || choisi || terme.length < 2) {
      setTrouves([]);
      return;
    }
    const minuteur = setTimeout(() => {
      fetch(`/api/proxy/customers?search=${encodeURIComponent(terme)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((liste: ClientTrouve[]) => setTrouves(liste.slice(0, 5)))
        .catch(() => setTrouves([]));
    }, 250);
    return () => clearTimeout(minuteur);
  }, [nom, telephone, choisi, clientConnu]);

  async function emettre(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const response = await fetch('/api/proxy/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: venteId,
          ...(choisi
            ? { customerId: choisi.id }
            : nom.trim()
              ? {
                  customer: {
                    name: nom.trim(),
                    ...(telephone.trim() ? { phone: telephone.trim() } : {}),
                    ...(email.trim() ? { email: email.trim() } : {}),
                  },
                }
              : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErreur((Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Facture refusée.');
        return;
      }
      if (onEmise) onEmise(body as FactureEmise);
      else router.push(`/pharmacie/factures/${body.invoice.id}`);
    } catch {
      setErreur('Service injoignable. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={emettre} className="facture-client">
      {erreur && <div className="banner danger">{erreur}</div>}
      {clientConnu ? null : choisi ? (
        <div className="row" style={{ alignItems: 'center' }}>
          <span>
            Client du fichier : <strong>{choisi.name}</strong>{' '}
            <span className="small muted mono">{choisi.code}{choisi.phone ? ` · ${choisi.phone}` : ''}</span>
          </span>
          <button type="button" className="secondaire petit" onClick={() => setChoisi(null)}>Changer</button>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ gap: '0 1rem' }}>
            <div className="field">
              <label htmlFor={`fc-nom-${venteId}`}>Nom du client</label>
              <input id={`fc-nom-${venteId}`} value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder="Laisser vide : client comptant" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`fc-tel-${venteId}`}>Téléphone</label>
              <input id={`fc-tel-${venteId}`} value={telephone} onChange={(e) => setTelephone(e.target.value)}
                inputMode="tel" placeholder="0991 234 567" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`fc-email-${venteId}`}>E-mail (facultatif)</label>
              <input id={`fc-email-${venteId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {trouves.length > 0 && (
            <div className="offres-liste" style={{ marginBottom: '0.75rem' }}>
              {trouves.map((c) => (
                <button type="button" key={c.id} className="offre" onClick={() => setChoisi(c)}>
                  <strong>{c.name}</strong>
                  <span className="small">{[c.code, c.phone].filter(Boolean).join(' · ')}</span>
                  <span className="small muted">Déjà client : choisir</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button type="submit" disabled={envoi}>{envoi ? 'Établissement…' : 'Établir la facture'}</button>
    </form>
  );
}
