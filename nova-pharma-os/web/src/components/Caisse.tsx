'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { money, quantity as fmtQty } from '@/lib/format';

interface Produit {
  id: string;
  sku: string;
  name: string;
  dosage: string | null;
  sale_price: string;
  available: string;
  requires_prescription: boolean;
  nearest_expiry: string | null;
}

interface LigneTicket {
  produit: Produit;
  quantite: number;
}

interface SessionCaisse {
  id: string;
  register_code: string;
  expected_cash: string;
  opening_float: string;
  currency: string;
}

const MOYENS = [
  { code: 'cash', label: 'Espèces' },
  { code: 'mobile_money', label: 'Mobile Money' },
  { code: 'card', label: 'Carte' },
  { code: 'bank_transfer', label: 'Virement' },
  { code: 'credit', label: 'Crédit client' },
];

export default function Caisse({
  sessionCaisse,
  lectureSeule,
}: {
  sessionCaisse: SessionCaisse | null;
  lectureSeule: boolean;
}) {
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Produit[]>([]);
  const [ticket, setTicket] = useState<LigneTicket[]>([]);
  const [moyen, setMoyen] = useState('cash');
  const [encaisse, setEncaisse] = useState('');
  const [patient, setPatient] = useState('');
  const [prescripteur, setPrescripteur] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champRecherche = useRef<HTMLInputElement>(null);

  const total = useMemo(
    () =>
      ticket.reduce(
        (somme, ligne) => somme + ligne.quantite * Number(ligne.produit.sale_price),
        0,
      ),
    [ticket],
  );

  const ordonnanceRequise = ticket.some((l) => l.produit.requires_prescription);

  const chercher = useCallback(async (terme: string) => {
    if (terme.trim().length < 2) {
      setResultats([]);
      return;
    }
    const response = await fetch(
      `/api/proxy/catalog/products?q=${encodeURIComponent(terme)}&pageSize=25`,
    );
    if (!response.ok) return;
    const body = await response.json();
    setResultats(body.data ?? []);
  }, []);

  useEffect(() => {
    const minuteur = setTimeout(() => void chercher(recherche), 220);
    return () => clearTimeout(minuteur);
  }, [recherche, chercher]);

  function ajouter(produit: Produit) {
    setTicket((lignes) => {
      const existante = lignes.find((l) => l.produit.id === produit.id);
      if (existante) {
        return lignes.map((l) =>
          l.produit.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l,
        );
      }
      return [...lignes, { produit, quantite: 1 }];
    });
    setRecherche('');
    setResultats([]);
    champRecherche.current?.focus();
  }

  function ajuster(id: string, quantite: number) {
    setTicket((lignes) =>
      quantite <= 0
        ? lignes.filter((l) => l.produit.id !== id)
        : lignes.map((l) => (l.produit.id === id ? { ...l, quantite } : l)),
    );
  }

  async function encaisser() {
    if (ticket.length === 0) return;
    setEnvoi(true);
    setMessage(null);

    const montant = moyen === 'cash' && encaisse ? Number(encaisse) : total;

    try {
      const response = await fetch('/api/proxy/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: ticket.map((l) => ({
            productId: l.produit.id,
            quantity: l.quantite,
          })),
          payments: [{ method: moyen, amount: Math.max(montant, total) }],
          ...(ordonnanceRequise
            ? {
                prescription: {
                  patientName: patient || undefined,
                  prescriberName: prescripteur || undefined,
                },
              }
            : {}),
          // Une clé d'opération protège d'un double encaissement en cas
          // de clic répété ou de réseau instable.
          clientOperationId: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setMessage({ ton: 'danger', texte: body.message ?? 'Vente refusée.' });
        return;
      }

      const rendu = Number(body.sale.change_given);
      setMessage({
        ton: 'info',
        texte:
          `Vente ${body.sale.number} enregistrée — ${money(body.sale.total)}` +
          (rendu > 0 ? ` · à rendre : ${money(rendu)}` : ''),
      });
      setTicket([]);
      setEncaisse('');
      setPatient('');
      setPrescripteur('');
    } catch {
      setMessage({ ton: 'danger', texte: 'Le service est injoignable.' });
    } finally {
      setEnvoi(false);
    }
  }

  if (!sessionCaisse) {
    return (
      <div className="banner warn">
        <strong>Aucune caisse ouverte</strong>
        Ouvrez une session de caisse avant d&apos;encaisser la première vente.
      </div>
    );
  }

  if (lectureSeule) {
    return (
      <div className="banner danger">
        <strong>Encaissement indisponible</strong>
        Votre abonnement est suspendu : les ventes sont bloquées jusqu&apos;à
        régularisation. Vos données restent consultables.
      </div>
    );
  }

  return (
    <div className="pos">
      <section className="card" style={{ marginBottom: 0 }}>
        <div className="card-head">
          <h2>Rechercher un produit</h2>
          <span className="hint">Nom, référence ou code-barres</span>
        </div>

        <input
          ref={champRecherche}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Paracétamol, PARA500, 3400930000011…"
          autoFocus
        />

        <div className="pos-results" style={{ marginTop: '0.75rem' }}>
          {resultats.map((produit) => {
            const dispo = Number(produit.available);
            return (
              <div
                key={produit.id}
                className="pos-item"
                onClick={() => dispo > 0 && ajouter(produit)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && dispo > 0 && ajouter(produit)}
                style={dispo <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              >
                <div>
                  <div className="pos-item-name">
                    {produit.name} {produit.dosage ?? ''}
                    {produit.requires_prescription && (
                      <span className="tag warn" style={{ marginLeft: '0.4rem' }}>
                        Ordonnance
                      </span>
                    )}
                  </div>
                  <div className="pos-item-meta">
                    {produit.sku} · {dispo > 0 ? `${fmtQty(dispo)} en stock` : 'rupture'}
                  </div>
                </div>
                <strong>{money(produit.sale_price)}</strong>
              </div>
            );
          })}
          {recherche.length >= 2 && resultats.length === 0 && (
            <div className="empty">Aucun produit ne correspond.</div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <div className="card-head">
          <h2>Ticket</h2>
          <span className="hint">{sessionCaisse.register_code}</span>
        </div>

        {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

        {ticket.length === 0 ? (
          <div className="empty">Le ticket est vide.</div>
        ) : (
          <>
            {ticket.map((ligne) => (
              <div className="ticket-line" key={ligne.produit.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ligne.produit.name}</div>
                  <div className="small muted">{money(ligne.produit.sale_price)} l&apos;unité</div>
                </div>
                <div className="qty">
                  <button
                    type="button"
                    className="secondaire"
                    onClick={() => ajuster(ligne.produit.id, ligne.quantite - 1)}
                    aria-label="Diminuer"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={ligne.quantite}
                    onChange={(e) => ajuster(ligne.produit.id, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="secondaire"
                    onClick={() => ajuster(ligne.produit.id, ligne.quantite + 1)}
                    aria-label="Augmenter"
                  >
                    +
                  </button>
                </div>
                <strong className="mono">
                  {money(ligne.quantite * Number(ligne.produit.sale_price))}
                </strong>
              </div>
            ))}

            <div className="ticket-total">
              <span>Total</span>
              <span className="mono">{money(total)}</span>
            </div>

            {ordonnanceRequise && (
              <div style={{ marginTop: '1rem' }}>
                <div className="banner warn" style={{ marginBottom: '0.75rem' }}>
                  Ce ticket contient un médicament délivré sur ordonnance.
                </div>
                <div className="field">
                  <label htmlFor="patient">Patient</label>
                  <input
                    id="patient"
                    value={patient}
                    onChange={(e) => setPatient(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="prescripteur">Prescripteur</label>
                  <input
                    id="prescripteur"
                    value={prescripteur}
                    onChange={(e) => setPrescripteur(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="moyen">Moyen de paiement</label>
              <select id="moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                {MOYENS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {moyen === 'cash' && (
              <div className="field">
                <label htmlFor="encaisse">Montant reçu</label>
                <input
                  id="encaisse"
                  type="number"
                  step="0.01"
                  value={encaisse}
                  onChange={(e) => setEncaisse(e.target.value)}
                  placeholder={total.toFixed(2)}
                />
                {Number(encaisse) > total && (
                  <p className="small" style={{ marginTop: '0.3rem', marginBottom: 0 }}>
                    À rendre : <strong>{money(Number(encaisse) - total)}</strong>
                  </p>
                )}
              </div>
            )}

            <button
              onClick={encaisser}
              disabled={envoi}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {envoi ? 'Enregistrement…' : `Encaisser ${money(total)}`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
