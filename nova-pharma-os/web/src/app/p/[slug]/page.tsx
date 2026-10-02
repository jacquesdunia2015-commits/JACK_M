import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReservationPublique from '@/components/ReservationPublique';
import { API_URL } from '@/lib/api';

export interface PagePharmacie {
  slug: string; name: string; address: string | null; city: string | null; phone: string | null; email: string | null;
  logo: string | null; currency: string; headline: string | null; description: string | null; openingHours: string | null;
  addressHint: string | null; whatsapp: string | null; onDutyNote: string | null; showPrices: boolean;
  acceptReservations: boolean; acceptPrescriptions: boolean; latitude: number | null; longitude: number | null;
}

async function charger(slug: string): Promise<PagePharmacie | null> {
  const r = await fetch(`${API_URL}/public/pharmacies/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null);
  return r?.ok ? r.json() : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await charger((await params).slug);
  return p
    ? { title: `${p.name} — pharmacie${p.city ? ` à ${p.city}` : ''}`, description: p.headline ?? `Horaires, médicaments disponibles et réservation en ligne : ${p.name}.` }
    : { title: 'Pharmacie introuvable' };
}

const chiffres = (t: string | null) => (t ?? '').replace(/\D/g, '');

/** Page publique d'une pharmacie : ouverte à tous, sans compte. */
export default async function PagePublique({ params }: { params: Promise<{ slug: string }> }) {
  const p = await charger((await params).slug);
  if (!p) notFound();
  // La ville n'est ajoutée que si l'adresse ne la contient pas déjà.
  const adresse = p.address && p.city && p.address.toLowerCase().includes(p.city.toLowerCase())
    ? p.address : [p.address, p.city].filter(Boolean).join(', ');
  const carte = p.latitude !== null && p.longitude !== null
    ? `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`
    : adresse ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${p.name} ${adresse}`)}` : null;

  return (
    <main className="page-publique">
      <header className="pp-entete">
        {p.logo && <img src={p.logo} alt="" className="pp-logo" />}
        <div>
          <h1>{p.name}</h1>
          {p.headline && <p className="pp-accroche">{p.headline}</p>}
          {p.onDutyNote && <p className="tag ok">{p.onDutyNote}</p>}
        </div>
      </header>

      <section className="card pp-infos">
        {p.openingHours && <p><strong>Horaires</strong><br />{p.openingHours}</p>}
        {adresse && <p><strong>Adresse</strong><br />{adresse}{p.addressHint ? <><br /><span className="muted">{p.addressHint}</span></> : null}</p>}
        <div className="row" style={{ gap: '0.5rem' }}>
          {p.whatsapp && <a className="btn" href={`https://wa.me/${chiffres(p.whatsapp).replace(/^0/, '243')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {p.phone && <a className="btn secondaire" href={`tel:${p.phone.replace(/\s/g, '')}`}>Appeler</a>}
          {carte && <a className="btn secondaire" href={carte} target="_blank" rel="noopener noreferrer">Itinéraire</a>}
        </div>
        {p.description && <p style={{ marginBottom: 0 }}>{p.description}</p>}
      </section>

      {(p.acceptReservations || p.acceptPrescriptions) ? (
        <ReservationPublique pharmacie={p} />
      ) : (
        <section className="card"><p style={{ margin: 0 }}>Pour un médicament, appelez ou écrivez à la pharmacie sur WhatsApp.</p></section>
      )}

      <footer className="pp-pied small muted">
        Page tenue par la pharmacie avec NOVA PHARMA OS. Aucun paiement en ligne : vous payez au comptoir en récupérant votre commande.
        Un médicament délivré sur ordonnance exige l’ordonnance originale au retrait.
      </footer>
    </main>
  );
}
