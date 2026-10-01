'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const message = (body: { message?: unknown }, repli: string) =>
  (Array.isArray(body.message) ? body.message.join(' ') : (body.message as string)) ?? repli;

async function poster(url: string, corps?: unknown) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(message(body, 'Opération refusée.'));
  return body;
}

const SUIVANTS: Record<string, { statut: string; libelle: string; secondaire?: boolean }[]> = {
  draft: [{ statut: 'confirmed', libelle: 'Confirmer la commande' }, { statut: 'cancelled', libelle: 'Annuler', secondaire: true }],
  submitted: [{ statut: 'confirmed', libelle: 'Confirmer la commande' }, { statut: 'cancelled', libelle: 'Annuler', secondaire: true }],
  confirmed: [{ statut: 'preparing', libelle: 'Mettre en préparation' }, { statut: 'cancelled', libelle: 'Annuler', secondaire: true }],
  preparing: [{ statut: 'ready', libelle: 'Marquer prête' }, { statut: 'cancelled', libelle: 'Annuler', secondaire: true }],
  ready: [{ statut: 'cancelled', libelle: 'Annuler', secondaire: true }],
};

/** Faire avancer une commande professionnelle, puis la livrer et la facturer. */
export function ActionsCommandeB2b({
  commandeId,
  statut,
  conditions,
  total,
}: {
  commandeId: string;
  statut: string;
  conditions: string;
  /** Montant de la commande, encaissé à la livraison quand elle est au comptant. */
  total: number;
}) {
  const router = useRouter();
  const [moyen, setMoyen] = useState('cash');
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const livrable = !['delivered', 'invoiced', 'cancelled'].includes(statut);

  const agir = async (fn: () => Promise<unknown>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="row">
        {(SUIVANTS[statut] ?? []).map((s) => (
          <button key={s.statut} type="button" className={s.secondaire ? 'secondaire' : ''} disabled={envoi}
            onClick={() => agir(() => poster(`/api/proxy/b2b/orders/${commandeId}/status`, { status: s.statut }))}>
            {s.libelle}
          </button>
        ))}
      </div>
      {livrable && (
        <div className="row" style={{ alignItems: 'end' }}>
          {conditions !== 'credit' && (
            <>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="b2b-moyen">Règlement à la livraison</label>
                <select id="b2b-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                  <option value="cash">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Virement</option>
                </select>
              </div>
              {moyen !== 'cash' && (
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="b2b-reference">Référence</label>
                  <input id="b2b-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction" />
                </div>
              )}
            </>
          )}
          <button type="button" disabled={envoi} onClick={() => agir(() =>
            // Comptant : le montant est encaissé par le moyen choisi ; à crédit,
            // l'API l'impute à l'encours du client.
            poster(`/api/proxy/b2b/orders/${commandeId}/fulfil`, conditions === 'credit' ? {} : {
              payments: [{ method: moyen, amount: total, ...(reference.trim() ? { reference: reference.trim() } : {}) }],
            }),
          )}>
            {envoi ? 'Livraison…' : 'Livrer et facturer (sortie du stock)'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Transformer un devis accepté en commande. */
export function ConvertirDevis({ devisId }: { devisId: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <button type="button" disabled={envoi} onClick={async () => {
        setEnvoi(true);
        setErreur(null);
        try {
          const body = await poster(`/api/proxy/b2b/quotes/${devisId}/convert`);
          router.push(`/pharmacie/b2b/commandes/${body.order.id}`);
        } catch (e) {
          setErreur((e as Error).message);
          setEnvoi(false);
        }
      }}>
        {envoi ? 'Transformation…' : 'Transformer en commande'}
      </button>
      {erreur && <span className="small" style={{ color: 'var(--alerte)' }}>{erreur}</span>}
    </div>
  );
}
