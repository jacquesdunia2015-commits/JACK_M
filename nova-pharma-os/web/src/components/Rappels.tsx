'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { envoyer } from '@/lib/envoi';
import { designation } from '@/lib/format';
import { ACTIONS_RAPPEL, SOURCES_RAPPEL, TYPES_RAPPEL } from '@/lib/rappels';

interface ProduitTrouve { id: string; name: string; dosage: string | null }

/** Choisir un produit du catalogue (facultatif). */
function ChoixProduit({ produit, onChange }: { produit: ProduitTrouve | null; onChange: (p: ProduitTrouve | null) => void }) {
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<ProduitTrouve[]>([]);
  useEffect(() => {
    if (produit || terme.trim().length < 2) { setResultats([]); return; }
    const m = setTimeout(async () => {
      const r = await fetch(`/api/proxy/catalog/products?q=${encodeURIComponent(terme.trim())}&pageSize=6`).catch(() => null);
      setResultats(r?.ok ? (await r.json()).data ?? [] : []);
    }, 220);
    return () => clearTimeout(m);
  }, [terme, produit]);
  if (produit) {
    return (
      <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <strong>{designation(produit.name, produit.dosage)}</strong>
        <button type="button" className="secondaire petit" onClick={() => { onChange(null); setTerme(''); }}>Changer</button>
      </div>
    );
  }
  return (
    <>
      <input id="rp-produit" value={terme} onChange={(e) => setTerme(e.target.value)} autoComplete="off" placeholder="Rechercher dans le catalogue (facultatif)" />
      {resultats.length > 0 && (
        <div className="offres-liste" style={{ marginTop: '0.4rem' }}>
          {resultats.map((p) => (
            <button type="button" key={p.id} className="offre" onClick={() => onChange(p)}><strong>{designation(p.name, p.dosage)}</strong></button>
          ))}
        </div>
      )}
    </>
  );
}

/** Enregistrer un rappel reçu (lettre du grossiste, du fabricant…). */
export function FormulaireRappel() {
  const router = useRouter();
  const [produit, setProduit] = useState<ProduitTrouve | null>(null);
  const [v, setV] = useState({ kind: 'recall', title: '', productName: '', lots: '', source: 'grossiste', reference: '', description: '', actionRequired: 'return' });
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<{ recall: { id: string } }>('/recalls', {
      kind: v.kind, title: v.title.trim(), productId: produit?.id, productName: v.productName.trim() || undefined,
      lotNumbers: v.lots.split(/[,;\n]+/).map((l) => l.trim()).filter(Boolean),
      source: v.source, reference: v.reference.trim() || undefined, description: v.description.trim() || undefined,
      actionRequired: v.actionRequired,
    });
    setEnvoi(false);
    if (!r.ok) { setMessage(r.message); return; }
    router.push(`/pharmacie/rappels/${r.body.recall.id}`);
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className="banner danger">{message}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="rp-type">Type</label>
          <select id="rp-type" value={v.kind} onChange={maj('kind')}>
            {Object.entries(TYPES_RAPPEL).map(([c, t]) => <option key={c} value={c}>{t.libelle}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="rp-titre">Objet</label>
          <input id="rp-titre" value={v.title} onChange={maj('title')} required minLength={4} placeholder="Rappel du lot P2304 de Paracétamol 500 mg" />
        </div>
        <div className="field">
          <label htmlFor="rp-produit">Produit du catalogue</label>
          <ChoixProduit produit={produit} onChange={setProduit} />
        </div>
        {!produit && (
          <div className="field">
            <label htmlFor="rp-nom">…ou nom du produit</label>
            <input id="rp-nom" value={v.productName} onChange={maj('productName')} placeholder="Paracétamol 500 mg" />
          </div>
        )}
        <div className="field">
          <label htmlFor="rp-lots">Numéros de lot</label>
          <input id="rp-lots" value={v.lots} onChange={maj('lots')} placeholder="P2304, P2305" />
          <span className="small muted">Séparés par des virgules. Majuscules, espaces et tirets ne comptent pas.</span>
        </div>
        <div className="field">
          <label htmlFor="rp-source">Source</label>
          <select id="rp-source" value={v.source} onChange={maj('source')}>
            {Object.entries(SOURCES_RAPPEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rp-ref">Référence de l’avis</label>
          <input id="rp-ref" value={v.reference} onChange={maj('reference')} placeholder="n° de lettre ou d’alerte" />
        </div>
        <div className="field">
          <label htmlFor="rp-action">Conduite demandée</label>
          <select id="rp-action" value={v.actionRequired} onChange={maj('actionRequired')}>
            {Object.entries(ACTIONS_RAPPEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="rp-desc">Détails</label>
        <textarea id="rp-desc" rows={2} value={v.description} onChange={maj('description')} />
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Recherche des lots…' : 'Enregistrer et bloquer les lots trouvés'}</button>
    </form>
  );
}

/** Actions sur un rappel ouvert : quarantaine, destruction ou retour, fausse alerte. */
export function ActionsRappel({ id, lotsABloquer, aDuStock }: { id: string; lotsABloquer: number; aDuStock: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'destroyed' | 'returned' | 'released'>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function appel(chemin: string, corps: unknown, succes: (b: Record<string, unknown>) => string) {
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<Record<string, unknown>>(chemin, corps);
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: succes(r.body) });
    setMode(null); setNote('');
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="row" style={{ gap: '0.5rem' }}>
        {lotsABloquer > 0 && (
          <button type="button" disabled={envoi} onClick={() => void appel(`/recalls/${id}/quarantine`, {}, (b) => `${b.quarantined} lot(s) mis en quarantaine : ils ne se vendent plus.`)}>
            Mettre en quarantaine ({lotsABloquer})
          </button>
        )}
        <button type="button" className="secondaire" onClick={() => setMode('destroyed')}>{aDuStock ? 'Détruire le stock' : 'Clore (aucun stock)'}</button>
        {aDuStock && <button type="button" className="secondaire" onClick={() => setMode('returned')}>Retourner au fournisseur</button>}
        <button type="button" className="secondaire" onClick={() => setMode('released')}>Fausse alerte</button>
      </div>
      {mode && (
        <form className="row" style={{ alignItems: 'end' }} onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'released') void appel(`/recalls/${id}/release`, { note }, () => 'Quarantaine levée, rappel clos.');
          else void appel(`/recalls/${id}/withdraw`, { resolution: mode, note: note || undefined }, (b) => `${b.units} unité(s) sorties du stock, rappel clos.`);
        }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 240 }}>
            <label htmlFor="rp-note">{mode === 'released' ? 'Pourquoi le lot n’est-il pas concerné ?' : mode === 'returned' ? 'Bon de retour (facultatif)' : 'Procès-verbal de destruction (facultatif)'}</label>
            <input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} required={mode === 'released'} minLength={mode === 'released' ? 5 : undefined} />
          </div>
          <button type="submit" disabled={envoi}>Confirmer</button>
          <button type="button" className="secondaire" onClick={() => setMode(null)}>Annuler</button>
        </form>
      )}
    </div>
  );
}

/** Message WhatsApp gratuit pour un client qui a acheté un lot concerné. */
export function PrevenirClient({ rappelId, clientId, telephone }: { rappelId: string; clientId: string; telephone: string | null }) {
  const router = useRouter();
  const [lien, setLien] = useState<{ id: string; url: string } | null>(null);
  const [parti, setParti] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!telephone) return <span className="small muted">pas de téléphone</span>;
  if (parti) return <span className="tag ok">Message envoyé</span>;
  if (lien) {
    return (
      <a className="btn petit" href={lien.url} target="_blank" rel="noopener noreferrer" onClick={() => {
        setParti(true);
        void envoyer(`/messaging/messages/${lien.id}/sent`, {}).then(() => router.refresh());
      }}>Ouvrir WhatsApp</a>
    );
  }
  return (
    <>
      <button type="button" className="petit" onClick={async () => {
        const r = await envoyer<{ id: string; send_link: string | null }>(`/recalls/${rappelId}/notify`, { customerId: clientId });
        if (!r.ok) { setErreur(r.message); return; }
        if (r.body.send_link) setLien({ id: r.body.id, url: r.body.send_link }); else setParti(true);
      }}>Prévenir sur WhatsApp</button>
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
    </>
  );
}

/** Back-office : publier une alerte à toutes les pharmacies du pays. */
export function FormulaireAlerte() {
  const router = useRouter();
  const vide = { kind: 'recall', title: '', productName: '', matchTerms: '', manufacturer: '', lots: '', source: 'acorep', reference: '', description: '', actionRequired: 'return', countryCode: 'CD' };
  const [v, setV] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/platform/product-alerts', {
        kind: v.kind, title: v.title.trim(), productName: v.productName.trim(), matchTerms: v.matchTerms.trim() || undefined,
        manufacturer: v.manufacturer.trim() || undefined, lotNumbers: v.lots.split(/[,;\n]+/).map((l) => l.trim()).filter(Boolean),
        source: v.source, reference: v.reference.trim() || undefined, description: v.description.trim() || undefined,
        actionRequired: v.actionRequired, countryCode: v.countryCode || null,
      });
      if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
      setMessage({ ton: 'info', texte: 'Alerte publiée : chaque pharmacie la verra à sa prochaine ouverture de « Rappels de lots », avec ses lots concernés.' });
      setV(vide);
      router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="al-type">Type</label>
          <select id="al-type" value={v.kind} onChange={maj('kind')}>
            {Object.entries(TYPES_RAPPEL).map(([c, t]) => <option key={c} value={c}>{t.libelle}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="al-titre">Objet</label>
          <input id="al-titre" value={v.title} onChange={maj('title')} required minLength={4} />
        </div>
        <div className="field">
          <label htmlFor="al-produit">Produit</label>
          <input id="al-produit" value={v.productName} onChange={maj('productName')} required placeholder="Paracétamol 500 mg comprimés" />
        </div>
        <div className="field">
          <label htmlFor="al-mots">Mots à retrouver dans le produit</label>
          <input id="al-mots" value={v.matchTerms} onChange={maj('matchTerms')} placeholder="paracétamol 500" />
          <span className="small muted">Tous doivent figurer dans le nom, la molécule ou le dosage.</span>
        </div>
        <div className="field">
          <label htmlFor="al-lots">Numéros de lot</label>
          <input id="al-lots" value={v.lots} onChange={maj('lots')} placeholder="vide : tous les lots" />
        </div>
        <div className="field">
          <label htmlFor="al-fabricant">Fabricant indiqué</label>
          <input id="al-fabricant" value={v.manufacturer} onChange={maj('manufacturer')} />
        </div>
        <div className="field">
          <label htmlFor="al-source">Source</label>
          <select id="al-source" value={v.source} onChange={maj('source')}>
            {Object.entries(SOURCES_RAPPEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="al-ref">Référence</label>
          <input id="al-ref" value={v.reference} onChange={maj('reference')} placeholder="ACOREP/2026/117, Medical Product Alert n°…" />
        </div>
        <div className="field">
          <label htmlFor="al-action">Conduite demandée</label>
          <select id="al-action" value={v.actionRequired} onChange={maj('actionRequired')}>
            {Object.entries(ACTIONS_RAPPEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="al-pays">Pays</label>
          <select id="al-pays" value={v.countryCode} onChange={maj('countryCode')}>
            <option value="CD">RD Congo</option>
            <option value="">Toutes les pharmacies</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="al-desc">Détails pour les pharmaciens</label>
        <textarea id="al-desc" rows={2} value={v.description} onChange={maj('description')} />
      </div>
      <button type="submit">Publier l’alerte</button>
    </form>
  );
}

export function BasculeAlerte({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className="secondaire petit" onClick={async () => {
      const r = await envoyer(`/platform/product-alerts/${id}`, { isActive: !active }, 'PATCH');
      if (r.ok) router.refresh();
    }}>{active ? 'Retirer' : 'Republier'}</button>
  );
}
