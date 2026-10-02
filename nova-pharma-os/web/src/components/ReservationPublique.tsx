'use client';

import { useEffect, useState } from 'react';
import type { PagePharmacie } from '@/app/p/[slug]/page';
import { designation, money } from '@/lib/format';

interface Produit { id: string; name: string; dosage: string | null; form: string | null; price: number | null; available: boolean; prescription: boolean }
interface Ligne { produit: Produit; quantite: number }

const STATUTS: Record<string, string> = {
  new: 'Reçue — la pharmacie va la traiter', confirmed: 'Confirmée — en préparation', ready: 'Prête — passez la récupérer',
  collected: 'Retirée', cancelled: 'Annulée',
};

/** Réduit une photo à 1600 px de côté et la recompresse en JPEG (une ordonnance reste lisible, l'envoi reste léger). */
async function reduirePhoto(fichier: File): Promise<string> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const echelle = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * echelle); c.height = Math.round(img.height * echelle);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function appel<T>(chemin: string, corps?: unknown): Promise<{ ok: true; body: T } | { ok: false; message: string }> {
  try {
    const r = await fetch(`/api/public/${chemin}`, corps === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { const m = (b as { message?: unknown }).message; return { ok: false, message: Array.isArray(m) ? m.join(' ') : (m as string) ?? 'Demande refusée.' }; }
    return { ok: true, body: b as T };
  } catch {
    return { ok: false, message: 'Pas de connexion. Réessayez dans un instant.' };
  }
}

export default function ReservationPublique({ pharmacie: p }: { pharmacie: PagePharmacie }) {
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<Produit[]>([]);
  const [cherche, setCherche] = useState(false);
  const [panier, setPanier] = useState<Ligne[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [v, setV] = useState({ name: '', phone: '', pickup: '', message: '', website: '' });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suivi, setSuivi] = useState({ numero: '', phone: '' });
  const [etat, setEtat] = useState<string | null>(null);

  useEffect(() => {
    if (terme.trim().length < 2) { setResultats([]); setCherche(false); return; }
    const m = setTimeout(async () => {
      const r = await appel<Produit[]>(`pharmacies/${p.slug}/products?q=${encodeURIComponent(terme.trim())}`);
      setResultats(r.ok ? r.body : []);
      setCherche(true);
    }, 250);
    return () => clearTimeout(m);
  }, [terme, p.slug]);

  const ajouter = (pr: Produit) => setPanier((l) => (l.some((x) => x.produit.id === pr.id) ? l : [...l, { produit: pr, quantite: 1 }]));
  const total = panier.reduce((s, l) => s + (l.produit.price ?? 0) * l.quantite, 0);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await appel<{ number: string; message: string }>(`pharmacies/${p.slug}/reservations`, {
      name: v.name.trim(), phone: v.phone.trim(), pickup: v.pickup.trim() || undefined, message: v.message.trim() || undefined,
      website: v.website || undefined, prescriptionPhoto: photo ?? undefined,
      lines: panier.map((l) => ({ productId: l.produit.id, quantity: l.quantite })),
    });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `${r.body.message} Votre numéro : ${r.body.number} — gardez-le pour suivre votre demande.` });
    setSuivi({ numero: r.body.number, phone: v.phone });
    setPanier([]); setPhoto(null);
  }

  return (
    <>
      {p.acceptReservations && (
        <section className="card">
          <h2>Chercher un médicament</h2>
          <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Nom du médicament" aria-label="Nom du médicament" autoComplete="off" />
          {resultats.length > 0 && (
            <ul className="pp-resultats">
              {resultats.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{designation(r.name, r.dosage)}</strong>
                    <div className="small">
                      {r.available ? <span className="tag ok">Disponible</span> : <span className="tag warn">Sur commande</span>}
                      {r.prescription && <span className="tag muted" style={{ marginLeft: '0.3rem' }}>Sur ordonnance</span>}
                      {r.price !== null && <span className="muted"> · {money(r.price, p.currency)}</span>}
                    </div>
                  </div>
                  <button type="button" className="petit" onClick={() => ajouter(r)} disabled={panier.some((l) => l.produit.id === r.id)}>
                    {panier.some((l) => l.produit.id === r.id) ? 'Ajouté' : 'Réserver'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cherche && resultats.length === 0 && <p className="small muted">Rien trouvé : écrivez-le dans le message, la pharmacie vous répondra.</p>}
        </section>
      )}

      <form className="card" onSubmit={envoyer}>
        <h2>Ma demande</h2>
        {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
        {panier.length > 0 && (
          <ul className="pp-panier">
            {panier.map((l) => (
              <li key={l.produit.id}>
                <span>{designation(l.produit.name, l.produit.dosage)}</span>
                <span className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                  <input type="number" min={1} max={99} value={l.quantite} aria-label="Quantité" style={{ width: '4.5rem' }}
                    onChange={(e) => setPanier((x) => x.map((y) => (y.produit.id === l.produit.id ? { ...y, quantite: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } : y)))} />
                  <button type="button" className="secondaire petit" onClick={() => setPanier((x) => x.filter((y) => y.produit.id !== l.produit.id))} aria-label="Retirer">✕</button>
                </span>
              </li>
            ))}
            {p.showPrices && total > 0 && <li className="small muted"><span>Total indicatif, à payer au comptoir</span><strong>{money(total, p.currency)}</strong></li>}
          </ul>
        )}
        {p.acceptPrescriptions && (
          <div className="field">
            <label htmlFor="pp-photo">Photo de l’ordonnance (facultatif)</label>
            <input id="pp-photo" type="file" accept="image/*" capture="environment" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) { setPhoto(null); return; }
              try { setPhoto(await reduirePhoto(f)); } catch { setMessage({ ton: 'danger', texte: 'Cette image ne peut pas être lue : reprenez la photo.' }); }
            }} />
            {photo && <img src={photo} alt="Aperçu de l’ordonnance" className="pp-apercu" />}
          </div>
        )}
        <div className="grid grid-2" style={{ gap: '0 1rem' }}>
          <div className="field"><label htmlFor="pp-nom">Votre nom</label><input id="pp-nom" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required minLength={2} /></div>
          <div className="field"><label htmlFor="pp-tel">Votre téléphone (WhatsApp)</label><input id="pp-tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} required placeholder="099 123 4567" /></div>
          <div className="field"><label htmlFor="pp-retrait">Quand passerez-vous ?</label><input id="pp-retrait" value={v.pickup} onChange={(e) => setV({ ...v, pickup: e.target.value })} placeholder="Ce soir après 17 h" /></div>
          <div className="field"><label htmlFor="pp-msg">Message (facultatif)</label><input id="pp-msg" value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></div>
        </div>
        {/* Champ piège, invisible pour les personnes. */}
        <input className="pp-piege" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} name="website" />
        <button type="submit" disabled={envoi || (panier.length === 0 && !photo)}>{envoi ? 'Envoi…' : 'Envoyer ma demande'}</button>
        <p className="small muted" style={{ marginBottom: 0 }}>Votre numéro ne sert qu’à la pharmacie pour vous prévenir.</p>
      </form>

      <section className="card">
        <h2>Suivre ma demande</h2>
        <form className="row" style={{ alignItems: 'end', gap: '0.5rem' }} onSubmit={async (e) => {
          e.preventDefault();
          const r = await appel<{ status: string }>(`pharmacies/${p.slug}/reservations/${encodeURIComponent(suivi.numero.trim())}?phone=${encodeURIComponent(suivi.phone)}`);
          setEtat(r.ok ? STATUTS[r.body.status] ?? r.body.status : r.message);
        }}>
          <div className="field" style={{ margin: 0 }}><label htmlFor="pp-num">Numéro</label><input id="pp-num" value={suivi.numero} onChange={(e) => setSuivi({ ...suivi, numero: e.target.value })} placeholder="RES-2026-00001" required /></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="pp-tel2">Téléphone</label><input id="pp-tel2" inputMode="tel" value={suivi.phone} onChange={(e) => setSuivi({ ...suivi, phone: e.target.value })} required /></div>
          <button type="submit" className="secondaire">Voir</button>
        </form>
        {etat && <p style={{ marginBottom: 0 }}><strong>{etat}</strong></p>}
      </section>
    </>
  );
}
