'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { envoyer, nombreSaisi } from '@/lib/envoi';

export interface ProfilPublic {
  slug: string; is_published: boolean; headline: string | null; description: string | null; opening_hours: string | null;
  address_hint: string | null; whatsapp: string | null; on_duty_note: string | null; show_prices: boolean;
  accept_reservations: boolean; accept_prescriptions: boolean; latitude: string | null; longitude: string | null;
}

/** Réglages de la page publique, son adresse et un QR code à afficher à la porte. */
export function ReglagesPagePublique({ profil }: { profil: ProfilPublic }) {
  const router = useRouter();
  const [v, setV] = useState({
    isPublished: profil.is_published, headline: profil.headline ?? '', description: profil.description ?? '',
    openingHours: profil.opening_hours ?? '', addressHint: profil.address_hint ?? '', whatsapp: profil.whatsapp ?? '',
    onDutyNote: profil.on_duty_note ?? '', showPrices: profil.show_prices, acceptReservations: profil.accept_reservations,
    acceptPrescriptions: profil.accept_prescriptions, latitude: profil.latitude ?? '', longitude: profil.longitude ?? '',
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [adresse, setAdresse] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  useEffect(() => {
    const url = `${window.location.origin}/p/${profil.slug}`;
    setAdresse(url);
    void import('qrcode').then((QR) => QR.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(setQr));
  }, [profil.slug]);

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const r = await envoyer('/public-profile', {
        ...v, latitude: nombreSaisi(String(v.latitude)) ?? null, longitude: nombreSaisi(String(v.longitude)) ?? null,
      }, 'PUT');
      setMessage(r.ok ? { ton: 'info', texte: v.isPublished ? 'Page publiée.' : 'Réglages enregistrés (page non publiée).' } : { ton: 'danger', texte: r.message });
      if (r.ok) router.refresh();
    }}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="row" style={{ alignItems: 'flex-start', gap: '1.25rem' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label className="case"><input type="checkbox" checked={v.isPublished} onChange={maj('isPublished')} /> <strong>Page publiée</strong> : visible par tous à l’adresse ci-contre</label>
          <div className="grid grid-2" style={{ gap: '0 1rem', marginTop: '0.5rem' }}>
            <div className="field"><label htmlFor="pg-accroche">Accroche</label><input id="pg-accroche" value={v.headline} onChange={maj('headline')} placeholder="Votre pharmacie de quartier depuis 2010" /></div>
            <div className="field"><label htmlFor="pg-horaires">Horaires</label><input id="pg-horaires" value={v.openingHours} onChange={maj('openingHours')} placeholder="Lun–Sam 7 h 30–21 h · Dim 9 h–13 h" /></div>
            <div className="field"><label htmlFor="pg-repere">Repère pour nous trouver</label><input id="pg-repere" value={v.addressHint} onChange={maj('addressHint')} placeholder="En face du marché de Virunga" /></div>
            <div className="field"><label htmlFor="pg-wa">Numéro WhatsApp</label><input id="pg-wa" inputMode="tel" value={v.whatsapp} onChange={maj('whatsapp')} placeholder="par défaut, le téléphone de la pharmacie" /></div>
            <div className="field"><label htmlFor="pg-garde">Annonce</label><input id="pg-garde" value={v.onDutyNote} onChange={maj('onDutyNote')} placeholder="De garde ce week-end" /></div>
            <div className="field">
              <label htmlFor="pg-lat">Position GPS (facultatif)</label>
              <div className="row" style={{ gap: '0.35rem', flexWrap: 'nowrap' }}>
                <input id="pg-lat" value={v.latitude} onChange={maj('latitude')} placeholder="-1.6792" aria-label="Latitude" />
                <input value={v.longitude} onChange={maj('longitude')} placeholder="29.2228" aria-label="Longitude" />
              </div>
            </div>
          </div>
          <div className="field"><label htmlFor="pg-desc">Présentation</label><textarea id="pg-desc" rows={2} value={v.description} onChange={maj('description')} placeholder="Services : prise de tension, conseils, livraison dans le quartier…" /></div>
          <div className="row" style={{ gap: '1rem' }}>
            <label className="case"><input type="checkbox" checked={v.showPrices} onChange={maj('showPrices')} /> Afficher les prix</label>
            <label className="case"><input type="checkbox" checked={v.acceptReservations} onChange={maj('acceptReservations')} /> Réservations</label>
            <label className="case"><input type="checkbox" checked={v.acceptPrescriptions} onChange={maj('acceptPrescriptions')} /> Photos d’ordonnance</label>
          </div>
          <button type="submit" style={{ marginTop: '0.75rem' }}>Enregistrer</button>
        </div>
        <div className="qr-page-publique">
          {qr && <img src={qr} alt="QR code de la page publique" width={180} height={180} />}
          <div className="small mono" style={{ wordBreak: 'break-all' }}>{adresse}</div>
          <div className="row" style={{ gap: '0.35rem', justifyContent: 'center' }}>
            <button type="button" className="secondaire petit" onClick={() => void navigator.clipboard?.writeText(adresse)}>Copier</button>
            {profil.is_published && <a className="btn secondaire petit" href={adresse} target="_blank" rel="noopener noreferrer">Ouvrir</a>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Imprimez ce QR code et collez-le sur la vitrine ; partagez l’adresse sur WhatsApp.</p>
        </div>
      </div>
    </form>
  );
}

/** Actions sur une réservation : confirmer, prête, retirée, annulée ; message WhatsApp. */
export function ActionsReservation({ id, statut, peutPrevenir }: { id: string; statut: string; peutPrevenir: boolean }) {
  const router = useRouter();
  const [lien, setLien] = useState<{ id: string; url: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const passer = async (s: string) => {
    setErreur(null);
    const r = await envoyer(`/reservations/${id}/status`, { status: s });
    if (!r.ok) { setErreur(r.message); return; }
    setLien(null);
    router.refresh();
  };
  const prevenir = async () => {
    const r = await envoyer<{ id: string; send_link: string | null }>(`/reservations/${id}/notify`, {});
    if (!r.ok) { setErreur(r.message); return; }
    if (r.body.send_link) setLien({ id: r.body.id, url: r.body.send_link });
  };
  return (
    <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
      {statut === 'new' && <button type="button" className="petit" onClick={() => void passer('confirmed')}>Confirmer</button>}
      {['new', 'confirmed'].includes(statut) && <button type="button" className="petit" onClick={() => void passer('ready')}>Prête</button>}
      {statut === 'ready' && <button type="button" className="petit" onClick={() => void passer('collected')}>Retirée</button>}
      {peutPrevenir && ['new', 'confirmed', 'ready'].includes(statut) && (lien
        ? <a className="btn petit" href={lien.url} target="_blank" rel="noopener noreferrer" onClick={() => { void envoyer(`/messaging/messages/${lien.id}/sent`, {}); setLien(null); }}>Ouvrir WhatsApp</a>
        : <button type="button" className="secondaire petit" onClick={() => void prevenir()}>{statut === 'ready' ? 'Prévenir : prête' : 'Accuser réception'}</button>)}
      {['new', 'confirmed', 'ready'].includes(statut) && <button type="button" className="secondaire petit" onClick={() => void passer('cancelled')}>Annuler</button>}
      {erreur && <div className="small" style={{ color: 'var(--alerte)', width: '100%', textAlign: 'right' }}>{erreur}</div>}
    </div>
  );
}
