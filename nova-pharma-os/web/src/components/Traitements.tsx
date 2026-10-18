'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ChoixClient, { type ClientChoisi } from '@/components/ChoixClient';
import { envoyer, nombreSaisi } from '@/lib/envoi';
import { designation } from '@/lib/format';
import { MALADIES } from '@/lib/traitements';

interface ProduitTrouve { id: string; name: string; dosage: string | null }

const aujourdhui = () => new Date().toLocaleDateString('en-CA');

/** Suivre le traitement d'un patient : qui, quel médicament, combien de jours dure une boîte. */
export function FormulaireTraitement() {
  const router = useRouter();
  const [client, setClient] = useState<ClientChoisi | null>(null);
  const [produit, setProduit] = useState<ProduitTrouve | null>(null);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<ProduitTrouve[]>([]);
  const [v, setV] = useState({
    condition: 'hypertension', daysPerUnit: '30', remindDaysBefore: '3',
    lastDispensedAt: aujourdhui(), lastQuantity: '1', notes: '',
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Change après chaque enregistrement : remet à zéro la recherche du patient.
  const [cle, setCle] = useState(0);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (produit || recherche.trim().length < 2) { setResultats([]); return; }
    const m = setTimeout(async () => {
      const r = await fetch(`/api/proxy/catalog/products?q=${encodeURIComponent(recherche.trim())}&pageSize=6`).catch(() => null);
      setResultats(r?.ok ? (await r.json()).data ?? [] : []);
    }, 220);
    return () => clearTimeout(m);
  }, [recherche, produit]);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !produit) { setMessage({ ton: 'danger', texte: 'Choisissez le patient et le médicament.' }); return; }
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer<{ sansTelephone: boolean }>('/treatments', {
      customerId: client.id, productId: produit.id, condition: v.condition,
      daysPerUnit: nombreSaisi(v.daysPerUnit), remindDaysBefore: Number(v.remindDaysBefore) || 0,
      lastDispensedAt: v.lastDispensedAt || undefined,
      lastQuantity: v.lastDispensedAt ? nombreSaisi(v.lastQuantity) : undefined,
      notes: v.notes.trim() || undefined,
    });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({
      ton: r.body.sansTelephone ? 'warn' : 'info',
      texte: r.body.sansTelephone
        ? `Traitement suivi. ${client.name} n’a pas de téléphone : ajoutez-le à sa fiche pour pouvoir le prévenir.`
        : `Traitement suivi. ${client.name} apparaîtra dans « À prévenir » quelques jours avant la fin de sa boîte.`,
    });
    setClient(null); setProduit(null); setRecherche(''); setCle((c) => c + 1);
    router.refresh();
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-2" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="tr-client">Patient</label>
          <ChoixClient key={cle} client={client} onChange={setClient} id="tr-client" />
        </div>
        <div className="field">
          <label htmlFor="tr-produit">Médicament</label>
          {produit ? (
            <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
              <strong>{designation(produit.name, produit.dosage)}</strong>
              <button type="button" className="secondaire petit" onClick={() => { setProduit(null); setRecherche(''); }}>Changer</button>
            </div>
          ) : (
            <>
              <input id="tr-produit" value={recherche} onChange={(e) => setRecherche(e.target.value)} autoComplete="off" placeholder="Nom du médicament" />
              {resultats.length > 0 && (
                <div className="offres-liste" style={{ marginTop: '0.4rem' }}>
                  {resultats.map((p) => (
                    <button type="button" key={p.id} className="offre" onClick={() => setProduit(p)}>
                      <strong>{designation(p.name, p.dosage)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="tr-maladie">Maladie</label>
          <select id="tr-maladie" value={v.condition} onChange={maj('condition')}>
            {Object.entries(MALADIES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tr-duree">Une boîte dure (jours)</label>
          <input id="tr-duree" inputMode="decimal" value={v.daysPerUnit} onChange={maj('daysPerUnit')} required pattern="[0-9]+([.,][0-9]+)?" />
          <span className="small muted">30 comprimés à 1 par jour : 30</span>
        </div>
        <div className="field">
          <label htmlFor="tr-avance">Prévenir (jours avant la fin)</label>
          <input id="tr-avance" inputMode="numeric" value={v.remindDaysBefore} onChange={maj('remindDaysBefore')} pattern="[0-9]+" />
        </div>
        <div className="field">
          <label htmlFor="tr-date">Dernière délivrance</label>
          <input id="tr-date" type="date" value={v.lastDispensedAt} onChange={maj('lastDispensedAt')} max={aujourdhui()} />
        </div>
        <div className="field">
          <label htmlFor="tr-qte">Boîtes délivrées ce jour-là</label>
          <input id="tr-qte" inputMode="decimal" value={v.lastQuantity} onChange={maj('lastQuantity')} pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="tr-notes">Remarques</label>
          <input id="tr-notes" value={v.notes} onChange={maj('notes')} placeholder="médecin, posologie…" />
        </div>
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Suivre ce traitement'}</button>
      <p className="small muted">Ensuite, chaque vente de ce médicament à ce patient recalcule toute seule la date de fin.</p>
    </form>
  );
}

/**
 * Rappel WhatsApp : le message est préparé par NOVA, puis envoyé depuis le
 * WhatsApp du téléphone de la pharmacie — aucun frais.
 */
export function RappelWhatsApp({ id, dejaPrevenu, telephone }: { id: string; dejaPrevenu: boolean; telephone: string | null }) {
  const router = useRouter();
  const [lien, setLien] = useState<{ messageId: string; url: string } | null>(null);
  const [parti, setParti] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (!telephone) return <span className="small muted">pas de téléphone</span>;
  if (parti) return <span className="tag ok">Message envoyé</span>;

  async function preparer() {
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer<{ id: string; send_link: string | null }>(`/treatments/${id}/remind`, { channel: 'whatsapp' });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    if (!r.body.send_link) { setErreur('Message envoyé par la passerelle.'); router.refresh(); return; }
    setLien({ messageId: r.body.id, url: r.body.send_link });
  }

  if (lien) {
    return (
      <a className="btn petit" href={lien.url} target="_blank" rel="noopener noreferrer"
        onClick={() => {
          setParti(true);
          void envoyer(`/messaging/messages/${lien.messageId}/sent`, {}).then(() => router.refresh());
        }}>
        Ouvrir WhatsApp
      </a>
    );
  }
  return (
    <>
      <button type="button" className={dejaPrevenu ? 'secondaire petit' : 'petit'} disabled={envoi} onClick={() => void preparer()}>
        {envoi ? '…' : dejaPrevenu ? 'Relancer' : 'Prévenir sur WhatsApp'}
      </button>
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
    </>
  );
}

/** Arrêter ou reprendre le suivi (traitement terminé, patient parti…). */
export function ArretTraitement({ id, actif }: { id: string; actif: boolean }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  return (
    <button type="button" className="secondaire petit" disabled={envoi}
      onClick={async () => {
        setEnvoi(true);
        const r = await envoyer(`/treatments/${id}`, { isActive: !actif }, 'PATCH');
        setEnvoi(false);
        if (r.ok) router.refresh();
      }}>
      {actif ? 'Arrêter' : 'Reprendre'}
    </button>
  );
}
