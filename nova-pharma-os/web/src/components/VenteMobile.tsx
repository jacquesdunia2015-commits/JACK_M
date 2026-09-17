'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/format';

interface Produit {
  id: string;
  sku: string;
  name: string;
  dosage: string | null;
  sale_price: string;
  available: string;
  requires_prescription: boolean;
}

interface Ligne {
  produit: Produit;
  quantite: number;
}

export interface LibellesVente {
  rechercher: string;
  aide: string;
  ticket: string;
  ticketVide: string;
  total: string;
  moyen: string;
  especes: string;
  mobileMoney: string;
  credit: string;
  encaisser: string;
  enregistrement: string;
  aucunProduit: string;
  venteEnregistree: string;
  patient: string;
  prescripteur: string;
  ordonnanceRequise: string;
  encaisserMm: string;
  referenceOperateur: string;
  confirmer: string;
  envoyerRecu: string;
  ouvrirWhatsapp: string;
  telephone: string;
  lectureSeule: string;
}

/**
 * Vente au comptoir depuis un téléphone.
 *
 * Le déroulé est celui du terrain : on cherche, on ajoute, on encaisse.
 * Deux prolongements propres au mobile, qui n'existent pas sur le poste
 * fixe :
 *
 *  • le Mobile Money, où la référence de transaction dictée par le
 *    client est saisie sur place — c'est elle qui vaut preuve ;
 *  • le reçu WhatsApp, envoyé depuis le téléphone du vendeur, donc sans
 *    aucun frais pour la pharmacie.
 */
export default function VenteMobile({
  libelles,
  lectureSeule,
}: {
  libelles: LibellesVente;
  lectureSeule: boolean;
}) {
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Produit[]>([]);
  const [ticket, setTicket] = useState<Ligne[]>([]);
  const [moyen, setMoyen] = useState('cash');
  const [patient, setPatient] = useState('');
  const [prescripteur, setPrescripteur] = useState('');
  const [telephone, setTelephone] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [venteId, setVenteId] = useState<string | null>(null);
  const [venteNumero, setVenteNumero] = useState<string | null>(null);
  // Le total est retenu à part : le ticket est vidé dès la vente
  // enregistrée, et l'encaissement Mobile Money vient après.
  const [venteTotal, setVenteTotal] = useState(0);
  const [collecteId, setCollecteId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [referenceOperateur, setReferenceOperateur] = useState('');
  const [lienRecu, setLienRecu] = useState<string | null>(null);

  const total = ticket.reduce(
    (s, l) => s + Number(l.produit.sale_price) * l.quantite,
    0,
  );
  const ordonnanceRequise = ticket.some((l) => l.produit.requires_prescription);

  useEffect(() => {
    const terme = recherche.trim();
    if (terme.length < 2) {
      setResultats([]);
      return;
    }
    const minuteur = setTimeout(async () => {
      const reponse = await fetch(
        `/api/proxy/catalog/products?q=${encodeURIComponent(terme)}&pageSize=20`,
      );
      if (!reponse.ok) return;
      const corps = await reponse.json();
      setResultats(corps.data ?? []);
    }, 250);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  function ajouter(produit: Produit) {
    setTicket((lignes) => {
      const existante = lignes.find((l) => l.produit.id === produit.id);
      return existante
        ? lignes.map((l) =>
            l.produit.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l,
          )
        : [...lignes, { produit, quantite: 1 }];
    });
    setRecherche('');
    setResultats([]);
  }

  function changerQuantite(id: string, delta: number) {
    setTicket((lignes) =>
      lignes
        .map((l) => (l.produit.id === id ? { ...l, quantite: l.quantite + delta } : l))
        .filter((l) => l.quantite > 0),
    );
  }

  async function encaisser() {
    if (ticket.length === 0 || envoi) return;
    setEnvoi(true);
    setMessage(null);
    try {
      const reponse = await fetch('/api/proxy/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: ticket.map((l) => ({ productId: l.produit.id, quantity: l.quantite })),
          payments: [{ method: moyen, amount: total }],
          ...(ordonnanceRequise
            ? {
                prescription: {
                  patientName: patient || undefined,
                  prescriberName: prescripteur || undefined,
                },
              }
            : {}),
          // Sur un téléphone, un réseau qui coupe au mauvais moment fait
          // souvent appuyer deux fois. La clé d'opération garantit
          // qu'une seule vente est enregistrée.
          clientOperationId: `mob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const corps = await reponse.json();
      if (!reponse.ok) {
        setMessage({ ton: 'danger', texte: corps.message ?? 'Vente refusée.' });
        return;
      }
      setVenteId(corps.sale.id);
      setVenteNumero(corps.sale.number);
      setVenteTotal(Number(corps.sale.total));
      setTicket([]);
      setPatient('');
      setPrescripteur('');
      setMessage({
        ton: 'ok',
        texte: `${libelles.venteEnregistree} — ${corps.sale.number} · ${money(corps.sale.total)}`,
      });
    } catch {
      setMessage({ ton: 'danger', texte: 'Le service est injoignable.' });
    } finally {
      setEnvoi(false);
    }
  }

  async function demanderMobileMoney() {
    if (!venteId || !telephone) return;
    const reponse = await fetch('/api/proxy/payments/mobile-money', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorCode: 'mpesa',
        payerPhone: telephone,
        amount: venteTotal,
        saleId: venteId,
      }),
    });
    const corps = await reponse.json();
    if (!reponse.ok) {
      setMessage({ ton: 'danger', texte: corps.message ?? 'Demande refusée.' });
      return;
    }
    setCollecteId(corps.id);
    setInstructions(corps.instructions);
  }

  async function confirmerMobileMoney() {
    if (!collecteId || !referenceOperateur.trim()) return;
    const reponse = await fetch(`/api/proxy/payments/mobile-money/${collecteId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorReference: referenceOperateur.trim() }),
    });
    const corps = await reponse.json();
    setMessage(
      reponse.ok
        ? { ton: 'ok', texte: `${corps.reference} · ${money(corps.amount)}` }
        : { ton: 'danger', texte: corps.message ?? 'Confirmation refusée.' },
    );
    if (reponse.ok) {
      setCollecteId(null);
      setInstructions(null);
      setReferenceOperateur('');
    }
  }

  async function preparerRecu() {
    if (!venteNumero || !telephone) return;
    const reponse = await fetch('/api/proxy/messaging/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'whatsapp',
        to: telephone,
        templateCode: 'receipt',
        category: 'receipt',
        entity: 'sale',
        entityId: venteId,
        variables: { numero: venteNumero, montant: money(venteTotal) },
      }),
    });
    const corps = await reponse.json();
    if (!reponse.ok) {
      setMessage({ ton: 'danger', texte: corps.message ?? 'Message refusé.' });
      return;
    }
    setLienRecu(corps.send_link);
  }

  if (lectureSeule) {
    return <p className="mob-vide">{libelles.lectureSeule}</p>;
  }

  return (
    <>
      {message && <div className={`mob-message ${message.ton}`}>{message.texte}</div>}

      <input
        className="mob-recherche"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder={libelles.rechercher}
        inputMode="search"
        autoComplete="off"
      />

      {resultats.length > 0 && (
        <ul className="mob-resultats">
          {resultats.map((p) => (
            <li key={p.id}>
              <button onClick={() => ajouter(p)}>
                <strong>{p.name}</strong>
                <span className="mob-note">
                  {money(p.sale_price)} · {p.available}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {recherche.trim().length >= 2 && resultats.length === 0 && (
        <p className="mob-vide">{libelles.aucunProduit}</p>
      )}

      <h2 className="mob-sous-titre">{libelles.ticket}</h2>
      {ticket.length === 0 ? (
        <p className="mob-vide">{libelles.ticketVide}</p>
      ) : (
        <ul className="mob-ticket">
          {ticket.map((l) => (
            <li key={l.produit.id}>
              <span className="mob-ticket-nom">{l.produit.name}</span>
              <span className="mob-quantite">
                <button onClick={() => changerQuantite(l.produit.id, -1)} aria-label="-">
                  −
                </button>
                <b>{l.quantite}</b>
                <button onClick={() => changerQuantite(l.produit.id, 1)} aria-label="+">
                  +
                </button>
              </span>
              <span className="mob-ticket-prix">
                {money(Number(l.produit.sale_price) * l.quantite)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ordonnanceRequise && (
        <div className="mob-ordonnance">
          <p>{libelles.ordonnanceRequise}</p>
          <input
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            placeholder={libelles.patient}
          />
          <input
            value={prescripteur}
            onChange={(e) => setPrescripteur(e.target.value)}
            placeholder={libelles.prescripteur}
          />
        </div>
      )}

      {ticket.length > 0 && (
        <>
          <div className="mob-total">
            <span>{libelles.total}</span>
            <b>{money(total)}</b>
          </div>

          <div className="mob-moyens">
            {[
              { code: 'cash', label: libelles.especes },
              { code: 'mobile_money', label: libelles.mobileMoney },
              { code: 'credit', label: libelles.credit },
            ].map((m) => (
              <button
                key={m.code}
                className={moyen === m.code ? 'actif' : ''}
                onClick={() => setMoyen(m.code)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button className="mob-bouton" onClick={encaisser} disabled={envoi}>
            {envoi ? libelles.enregistrement : libelles.encaisser}
          </button>
        </>
      )}

      {venteNumero && (
        <div className="mob-apres-vente">
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder={libelles.telephone}
            inputMode="tel"
          />

          <button className="mob-bouton secondaire" onClick={preparerRecu}>
            {libelles.envoyerRecu}
          </button>
          {lienRecu && (
            <a className="mob-bouton" href={lienRecu} target="_blank" rel="noreferrer">
              {libelles.ouvrirWhatsapp}
            </a>
          )}

          <button className="mob-bouton secondaire" onClick={demanderMobileMoney}>
            {libelles.encaisserMm}
          </button>
          {instructions && (
            <>
              <p className="mob-instructions">{instructions}</p>
              <input
                value={referenceOperateur}
                onChange={(e) => setReferenceOperateur(e.target.value)}
                placeholder={libelles.referenceOperateur}
              />
              <button className="mob-bouton" onClick={confirmerMobileMoney}>
                {libelles.confirmer}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
