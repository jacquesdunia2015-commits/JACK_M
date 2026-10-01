'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyer, nombreSaisi } from '@/lib/envoi';
import { TYPES_PAYEUR } from '@/lib/tiers-payant';

export interface Payeur {
  id: string; code: string; name: string; kind: string; coverage_percent: string;
  per_sale_ceiling: string | null; contact_name: string | null; phone: string | null;
  email: string | null; address: string | null; payment_days: number; notes: string | null; is_active: boolean;
}

const champ = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** Créer ou modifier un organisme payeur. */
export function FormulairePayeur({ payeur }: { payeur?: Payeur }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: payeur?.name ?? '', kind: payeur?.kind ?? 'mutuelle',
    coveragePercent: champ(payeur ? Number(payeur.coverage_percent) : 80),
    perSaleCeiling: champ(payeur?.per_sale_ceiling ? Number(payeur.per_sale_ceiling) : null),
    contactName: payeur?.contact_name ?? '', phone: payeur?.phone ?? '', email: payeur?.email ?? '',
    address: payeur?.address ?? '', paymentDays: String(payeur?.payment_days ?? 30), notes: payeur?.notes ?? '',
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const corps = {
      name: v.name.trim(), kind: v.kind, coveragePercent: nombreSaisi(v.coveragePercent),
      perSaleCeiling: nombreSaisi(v.perSaleCeiling) ?? (payeur ? null : undefined),
      contactName: v.contactName.trim() || undefined, phone: v.phone.trim() || undefined,
      email: v.email.trim() || undefined, address: v.address.trim() || undefined,
      paymentDays: Number(v.paymentDays) || 0, notes: v.notes.trim() || undefined,
    };
    const r = payeur ? await envoyer(`/payers/${payeur.id}`, corps, 'PATCH') : await envoyer<{ id: string }>('/payers', corps);
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    if (payeur) { setMessage({ ton: 'info', texte: 'Organisme mis à jour.' }); router.refresh(); return; }
    router.push(`/pharmacie/tiers-payant/${(r.body as { id: string }).id}`);
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="tp-nom">Nom de l’organisme</label>
          <input id="tp-nom" value={v.name} onChange={maj('name')} required placeholder="Mutuelle de santé Umoja, SNEL, ONG…" />
        </div>
        <div className="field">
          <label htmlFor="tp-type">Type</label>
          <select id="tp-type" value={v.kind} onChange={maj('kind')}>
            {Object.entries(TYPES_PAYEUR).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tp-taux">Part prise en charge (%)</label>
          <input id="tp-taux" inputMode="decimal" value={v.coveragePercent} onChange={maj('coveragePercent')} required pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="tp-plafond">Plafond par vente (facultatif)</label>
          <input id="tp-plafond" inputMode="decimal" value={v.perSaleCeiling} onChange={maj('perSaleCeiling')} pattern="[0-9]+([.,][0-9]+)?" placeholder="aucun" />
        </div>
        <div className="field">
          <label htmlFor="tp-delai">Délai de règlement (jours)</label>
          <input id="tp-delai" inputMode="numeric" value={v.paymentDays} onChange={maj('paymentDays')} pattern="[0-9]+" />
        </div>
        <div className="field">
          <label htmlFor="tp-contact">Personne de contact</label>
          <input id="tp-contact" value={v.contactName} onChange={maj('contactName')} />
        </div>
        <div className="field">
          <label htmlFor="tp-tel">Téléphone</label>
          <input id="tp-tel" inputMode="tel" value={v.phone} onChange={maj('phone')} />
        </div>
        <div className="field">
          <label htmlFor="tp-mail">E-mail</label>
          <input id="tp-mail" type="email" value={v.email} onChange={maj('email')} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="tp-adresse">Adresse</label>
          <input id="tp-adresse" value={v.address} onChange={maj('address')} />
        </div>
        <div className="field">
          <label htmlFor="tp-notes">Remarques</label>
          <input id="tp-notes" value={v.notes} onChange={maj('notes')} placeholder="médicaments exclus, pièces à joindre…" />
        </div>
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : payeur ? 'Enregistrer les modifications' : 'Enregistrer l’organisme'}</button>
    </form>
  );
}

/** Ajouter un bénéficiaire (carte ou matricule) à un organisme. */
export function FormulaireBeneficiaire({ payeurId, tauxPayeur }: { payeurId: string; tauxPayeur: number }) {
  const router = useRouter();
  const vide = { memberNumber: '', fullName: '', principalName: '', phone: '', coveragePercent: '', annualCeiling: '', validUntil: '' };
  const [v, setV] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const r = await envoyer(`/payers/${payeurId}/members`, {
      memberNumber: v.memberNumber.trim(), fullName: v.fullName.trim(),
      principalName: v.principalName.trim() || undefined, phone: v.phone.trim() || undefined,
      coveragePercent: nombreSaisi(v.coveragePercent), annualCeiling: nombreSaisi(v.annualCeiling),
      validUntil: v.validUntil || undefined,
    });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ton: 'danger', texte: r.message }); return; }
    setMessage({ ton: 'info', texte: `${v.fullName.trim()} (carte ${v.memberNumber.trim()}) est enregistré.` });
    setV(vide);
    router.refresh();
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="bn-carte">N° de carte ou matricule</label>
          <input id="bn-carte" value={v.memberNumber} onChange={maj('memberNumber')} required />
        </div>
        <div className="field">
          <label htmlFor="bn-nom">Nom du bénéficiaire</label>
          <input id="bn-nom" value={v.fullName} onChange={maj('fullName')} required />
        </div>
        <div className="field">
          <label htmlFor="bn-principal">Adhérent principal (ayant droit)</label>
          <input id="bn-principal" value={v.principalName} onChange={maj('principalName')} placeholder="si conjoint ou enfant" />
        </div>
        <div className="field">
          <label htmlFor="bn-tel">Téléphone</label>
          <input id="bn-tel" inputMode="tel" value={v.phone} onChange={maj('phone')} />
        </div>
        <div className="field">
          <label htmlFor="bn-taux">Taux propre (%)</label>
          <input id="bn-taux" inputMode="decimal" value={v.coveragePercent} onChange={maj('coveragePercent')} pattern="[0-9]+([.,][0-9]+)?" placeholder={`${tauxPayeur} (celui de l’organisme)`} />
        </div>
        <div className="field">
          <label htmlFor="bn-plafond">Plafond annuel</label>
          <input id="bn-plafond" inputMode="decimal" value={v.annualCeiling} onChange={maj('annualCeiling')} pattern="[0-9]+([.,][0-9]+)?" placeholder="aucun" />
        </div>
        <div className="field">
          <label htmlFor="bn-validite">Carte valable jusqu’au</label>
          <input id="bn-validite" type="date" value={v.validUntil} onChange={maj('validUntil')} />
        </div>
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Ajouter le bénéficiaire'}</button>
    </form>
  );
}

/** Désactiver ou réactiver un bénéficiaire. */
export function ActivationBeneficiaire({ id, actif }: { id: string; actif: boolean }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  return (
    <button type="button" className="secondaire petit" disabled={envoi} onClick={async () => {
      setEnvoi(true);
      const r = await envoyer(`/payers/members/${id}`, { isActive: !actif }, 'PATCH');
      setEnvoi(false);
      if (r.ok) router.refresh();
    }}>
      {actif ? 'Désactiver' : 'Réactiver'}
    </button>
  );
}

/** Établir le relevé d'une période. */
export function EtablirReleve({ payeurId, debut, fin }: { payeurId: string; debut: string; fin: string }) {
  const router = useRouter();
  const [d, setD] = useState(debut);
  const [f, setF] = useState(fin);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form className="row" style={{ alignItems: 'end' }} onSubmit={async (e) => {
      e.preventDefault();
      setEnvoi(true);
      setErreur(null);
      const r = await envoyer<{ id: string }>('/payers/claims', { payerId: payeurId, periodStart: d, periodEnd: f });
      setEnvoi(false);
      if (!r.ok) { setErreur(r.message); return; }
      router.push(`/pharmacie/tiers-payant/releves/${(r.body as { id: string }).id}`);
    }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="rl-debut">Du</label>
        <input id="rl-debut" type="date" value={d} onChange={(e) => setD(e.target.value)} required />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="rl-fin">au</label>
        <input id="rl-fin" type="date" value={f} onChange={(e) => setF(e.target.value)} required />
      </div>
      <button type="submit" disabled={envoi}>{envoi ? 'Établissement…' : 'Établir le relevé'}</button>
      {erreur && <span className="small" style={{ color: 'var(--alerte)', flexBasis: '100%' }}>{erreur}</span>}
    </form>
  );
}

/** Présenter, encaisser ou annuler un relevé. */
export function ActionsReleve({ id, statut, reste }: { id: string; statut: string; reste: number }) {
  const router = useRouter();
  const [montant, setMontant] = useState(String(reste).replace('.', ','));
  const [moyen, setMoyen] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const agir = async (chemin: string, corps?: unknown) => {
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer(chemin, corps ?? {});
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    router.refresh();
  };
  if (statut === 'cancelled' || statut === 'paid') return null;
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="row">
        {statut === 'draft' && (
          <button type="button" disabled={envoi} onClick={() => agir(`/payers/claims/${id}/send`)}>Marquer comme présenté au payeur</button>
        )}
        {statut !== 'partially_paid' && (
          <button type="button" className="secondaire" disabled={envoi} onClick={() => agir(`/payers/claims/${id}/cancel`)}>
            Annuler le relevé
          </button>
        )}
      </div>
      <form className="row" style={{ alignItems: 'end' }} onSubmit={(e) => {
        e.preventDefault();
        void agir(`/payers/claims/${id}/payments`, { amount: nombreSaisi(montant), method: moyen, reference: reference.trim() || undefined });
      }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rg-montant">Règlement reçu</label>
          <input id="rg-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} required pattern="[0-9\s]+([.,][0-9]+)?" style={{ width: '8rem' }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rg-moyen">Moyen</label>
          <select id="rg-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
            <option value="bank_transfer">Virement</option>
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_local">Chèque ou banque</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rg-ref">Référence</label>
          <input id="rg-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="n° de virement" />
        </div>
        <button type="submit" disabled={envoi}>Enregistrer le règlement</button>
      </form>
    </div>
  );
}
