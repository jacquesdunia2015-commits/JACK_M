'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ChoixClient, { type ClientChoisi } from '@/components/ChoixClient';
import { envoyer, nombreSaisi } from '@/lib/envoi';

export interface ProgrammeFidelite {
  is_enabled: boolean; points_per_unit: number; point_value: number;
  min_redeem_points: number; max_redeem_percent: number; welcome_points: number;
}

export interface Categorie { id: string; code: string; name: string; discount_percent: string; is_active: boolean; customers: number }

const champ = (n: number) => String(n).replace('.', ',');

/** Réglages du programme : ce qu'un dollar rapporte, ce que vaut un point, les limites. */
export function ReglagesFidelite({ programme, devise }: { programme: ProgrammeFidelite; devise: string }) {
  const router = useRouter();
  const [v, setV] = useState({
    isEnabled: programme.is_enabled,
    pointsPerUnit: champ(programme.points_per_unit), pointValue: champ(programme.point_value),
    minRedeemPoints: String(programme.min_redeem_points), maxRedeemPercent: champ(programme.max_redeem_percent),
    welcomePoints: String(programme.welcome_points),
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const unite = devise === 'CDF' ? 'FC' : devise;
  const gain = nombreSaisi(v.pointsPerUnit) ?? 0;
  const valeur = nombreSaisi(v.pointValue) ?? 0;
  const retour = gain * valeur * 100;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer('/loyalty/program', {
      isEnabled: v.isEnabled, pointsPerUnit: nombreSaisi(v.pointsPerUnit), pointValue: nombreSaisi(v.pointValue),
      minRedeemPoints: Number(v.minRedeemPoints) || 0, maxRedeemPercent: nombreSaisi(v.maxRedeemPercent),
      welcomePoints: Number(v.welcomePoints) || 0,
    }, 'PUT');
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: v.isEnabled ? 'Programme enregistré : les ventes à un client identifié rapportent des points.' : 'Programme enregistré (désactivé).' });
    router.refresh();
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <label className="case" style={{ marginBottom: '0.75rem' }}>
        <input type="checkbox" checked={v.isEnabled} onChange={(e) => setV((x) => ({ ...x, isEnabled: e.target.checked }))} />
        <strong>Programme de fidélité activé</strong>
      </label>
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="fi-gain">Points gagnés pour 1 {unite} payé</label>
          <input id="fi-gain" inputMode="decimal" value={v.pointsPerUnit} onChange={maj('pointsPerUnit')} pattern="[0-9]+([.,][0-9]+)?" required />
        </div>
        <div className="field">
          <label htmlFor="fi-valeur">Valeur d’un point ({unite})</label>
          <input id="fi-valeur" inputMode="decimal" value={v.pointValue} onChange={maj('pointValue')} pattern="[0-9]+([.,][0-9]+)?" required />
          <span className="small muted">100 points = {(valeur * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {unite}</span>
        </div>
        <div className="field">
          <label htmlFor="fi-seuil">Utilisables à partir de (points)</label>
          <input id="fi-seuil" inputMode="numeric" value={v.minRedeemPoints} onChange={maj('minRedeemPoints')} pattern="[0-9]+" />
        </div>
        <div className="field">
          <label htmlFor="fi-max">Part d’une vente payable en points (%)</label>
          <input id="fi-max" inputMode="decimal" value={v.maxRedeemPercent} onChange={maj('maxRedeemPercent')} pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="fi-bienvenue">Points offerts à l’inscription</label>
          <input id="fi-bienvenue" inputMode="numeric" value={v.welcomePoints} onChange={maj('welcomePoints')} pattern="[0-9]+" />
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Avec ces réglages, le client récupère <strong>{retour.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</strong> de ce qu’il dépense.
        Entre 1 et 5 % est courant. Les points se gagnent sur ce que le client paie lui-même (ni tiers payant, ni crédit, ni points).
      </p>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer les réglages'}</button>
    </form>
  );
}

/** Créer une catégorie de clients avec sa remise permanente. */
export function NouvelleCategorie() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [taux, setTaux] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="row" style={{ alignItems: 'end' }} onSubmit={async (e) => {
      e.preventDefault();
      setMessage(null);
      const r = await envoyer('/loyalty/groups', { name: nom.trim(), discountPercent: nombreSaisi(taux) ?? 0 });
      if (!r.ok) { setMessage(r.message); return; }
      setNom(''); setTaux('');
      router.refresh();
    }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="cat-nom">Nouvelle catégorie</label>
        <input id="cat-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Personnel, Clients fidèles, 3ᵉ âge…" required minLength={2} />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="cat-taux">Remise (%)</label>
        <input id="cat-taux" inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} pattern="[0-9]+([.,][0-9]+)?" required style={{ width: '6rem' }} />
      </div>
      <button type="submit">Ajouter</button>
      {message && <span className="small" style={{ color: 'var(--alerte)' }}>{message}</span>}
    </form>
  );
}

export function BasculeCategorie({ id, actif }: { id: string; actif: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className="secondaire petit" onClick={async () => {
      const r = await envoyer(`/loyalty/groups/${id}`, { isActive: !actif }, 'PATCH');
      if (r.ok) router.refresh();
    }}>
      {actif ? 'Désactiver' : 'Réactiver'}
    </button>
  );
}

/**
 * Pour un client : le ranger dans une catégorie, offrir ou retirer des
 * points (toujours avec un motif).
 */
export function GererClient({ categories }: { categories: Categorie[] }) {
  const router = useRouter();
  const [client, setClient] = useState<ClientChoisi | null>(null);
  const [cle, setCle] = useState(0);
  const [categorie, setCategorie] = useState('');
  const [points, setPoints] = useState('');
  const [motif, setMotif] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);

  async function classer() {
    if (!client) return;
    const r = await envoyer(`/loyalty/customers/${client.id}/group`, { groupId: categorie || null }, 'PUT');
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    const nom = categories.find((c) => c.id === categorie)?.name;
    setMessage({ ton: 'info', texte: nom ? `${client.name} est rangé dans « ${nom} ».` : `${client.name} n’a plus de catégorie.` });
    router.refresh();
  }

  async function ajuster(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    const n = Number(points.replace(/\s/g, ''));
    const r = await envoyer<{ balance_after: number }>(`/loyalty/customers/${client.id}/adjust`, { points: n, reason: motif.trim() });
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `${n > 0 ? '+' : ''}${n} points pour ${client.name} : nouveau solde ${r.body.balance_after}.` });
    setPoints(''); setMotif(''); setClient(null); setCle((c) => c + 1);
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="field" style={{ margin: 0, maxWidth: 480 }}>
        <label htmlFor="gc-client">Client</label>
        <ChoixClient key={cle} client={client} onChange={(c) => { setClient(c); setCategorie(c?.group_id ?? ''); }} id="gc-client" />
      </div>
      {client && (
        <>
          <div className="small">Solde : <strong>{client.loyalty_points ?? 0}</strong> points{client.group_name ? ` · catégorie ${client.group_name}` : ''}</div>
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="gc-cat">Catégorie</label>
              <select id="gc-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                <option value="">Aucune</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (−{Number(c.discount_percent).toLocaleString('fr-FR')} %)</option>
                ))}
              </select>
            </div>
            <button type="button" className="secondaire" onClick={() => void classer()}>Ranger</button>
          </div>
          <form className="row" style={{ alignItems: 'end' }} onSubmit={ajuster}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="gc-points">Points (+ offrir, − retirer)</label>
              <input id="gc-points" value={points} onChange={(e) => setPoints(e.target.value)} pattern="-?[0-9]+" required style={{ width: '8rem' }} />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
              <label htmlFor="gc-motif">Motif</label>
              <input id="gc-motif" value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={3} placeholder="Geste commercial, correction…" />
            </div>
            <button type="submit">Enregistrer</button>
          </form>
        </>
      )}
    </div>
  );
}
