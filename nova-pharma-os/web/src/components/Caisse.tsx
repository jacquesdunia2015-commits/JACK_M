'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChoixBeneficiaire, { Beneficiaire } from '@/components/ChoixBeneficiaire';
import ChoixClient, { ClientChoisi } from '@/components/ChoixClient';
import { DocumentFacture, EmettreFacture, FactureEmise } from '@/components/Facture';
import ScanCodeBarres from '@/components/ScanCodeBarres';
import { BoutonTicket } from '@/components/ImpressionTicket';
import { designation, money, quantity as fmtQty } from '@/lib/format';
import { TauxDuJour, aPayer, arrondirMonnaie, autreDevise, convertir } from '@/lib/devises';
import {
  AGE_MAX_CATALOGUE_H, CatalogueHorsLigne, EVENEMENT_FILE, VenteEnAttente, ageCatalogueHeures,
  disponibleHorsLigne, identifiantPoste, lireCatalogue, lireFile, mettreEnFile, rafraichirCatalogue,
  rechercherHorsLigne, remettreEnAttente, retirerDeFile, synchroniser,
} from '@/lib/hors-ligne';

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
  devise = 'USD',
  taux: tauxServeur = null,
  sessionCaisse,
  lectureSeule,
}: {
  /** Devise de la pharmacie, pour les montants affichés. */
  devise?: string;
  /** Taux du jour : sans lui, la caisse n'encaisse que dans la devise de la pharmacie. */
  taux?: TauxDuJour | null;
  sessionCaisse: SessionCaisse | null;
  lectureSeule: boolean;
}) {
  // Caisse hors connexion : catalogue gardé sur le poste, ventes en attente
  // d'envoi, état du réseau tel que la caisse le constate.
  const router = useRouter();
  const [horsLigne, setHorsLigne] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogueHorsLigne | null>(null);
  const [file, setFile] = useState<VenteEnAttente[]>([]);
  const taux = tauxServeur ?? catalogue?.rate ?? null;
  const autre = autreDevise(taux, devise);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Produit[]>([]);
  const [ticket, setTicket] = useState<LigneTicket[]>([]);
  const [moyen, setMoyen] = useState('cash');
  // Client de la vente : obligatoire à crédit, pour savoir qui doit la somme.
  const [client, setClient] = useState<ClientChoisi | null>(null);
  const [encaisse, setEncaisse] = useState('');
  // Espèces remises dans l'autre devise (francs), et devise de la monnaie rendue.
  const [encaisseAutre, setEncaisseAutre] = useState('');
  const [deviseMonnaie, setDeviseMonnaie] = useState(autre === 'CDF' ? 'CDF' : devise);
  // Devise d'un paiement Mobile Money, carte ou virement.
  const [devisePaiement, setDevisePaiement] = useState(devise);
  const [patient, setPatient] = useState('');
  const [prescripteur, setPrescripteur] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Dernière vente encaissée, pour en établir la facture si le client la demande.
  const [derniereVente, setDerniereVente] = useState<{ id: string; number: string; currency: string } | null>(null);
  const [facture, setFacture] = useState<FactureEmise | null>(null);
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

  // Tiers payant : la part de l'organisme est calculée par le serveur
  // (taux, plafonds) ; le patient ne paie que le reste.
  const [tiersPayant, setTiersPayant] = useState(false);
  const [beneficiaire, setBeneficiaire] = useState<Beneficiaire | null>(null);
  const [bon, setBon] = useState('');
  const [partage, setPartage] = useState<{
    payerShare: number; patientShare: number; percent: number; payerName: string; capped: boolean; reason: string | null;
  } | null>(null);
  const [erreurPartage, setErreurPartage] = useState<string | null>(null);
  useEffect(() => {
    setPartage(null);
    setErreurPartage(null);
    if (!tiersPayant || !beneficiaire || total <= 0) return;
    const minuteur = setTimeout(async () => {
      const r = await fetch(`/api/proxy/payers/members/${beneficiaire.id}/coverage?amount=${total.toFixed(2)}`);
      const body = await r.json().catch(() => ({}));
      if (r.ok) setPartage(body);
      else setErreurPartage(body.message ?? 'Prise en charge impossible.');
    }, 200);
    return () => clearTimeout(minuteur);
  }, [tiersPayant, beneficiaire, total]);
  const couvert = tiersPayant && beneficiaire && partage && partage.payerShare > 0;
  /** Ce que le patient doit payer lui-même. */
  const du = couvert ? partage.patientShare : total;

  // Espèces : ce qui est remis dans chaque devise, ramené à la devise de la
  // pharmacie ; la monnaie se rend dans la devise choisie, à la coupure près.
  const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.')) || 0;
  const recuPrincipal = nombre(encaisse);
  const recuAutre = autre ? nombre(encaisseAutre) : 0;
  const recuEquivalent =
    Math.round((recuPrincipal + (autre ? convertir(recuAutre, autre, devise, taux) : 0)) * 100) / 100;
  const pasAutre = autre && taux && autre === taux.quote_currency ? Number(taux.change_rounding) : 0;
  const tolerance = recuAutre > 0 ? Math.max(0.0051, convertir(pasAutre / 2, autre as string, devise, taux)) : 0.001;
  const especesSaisies = recuPrincipal > 0 || recuAutre > 0;
  // Mobile Money ou virement : le montant exact, à l'unité supérieure (pas de coupure à rendre).
  const auFrancPres = (m: number, d: string) =>
    d === 'CDF' ? Math.ceil(m - 1e-9) : Math.ceil(m * 100 - 1e-9) / 100;
  const manque = especesSaisies && recuEquivalent + tolerance < du ? du - recuEquivalent : 0;
  const surplus = especesSaisies ? Math.max(0, recuEquivalent - du) : 0;
  const monnaie = surplus > 0
    ? arrondirMonnaie(convertir(surplus, devise, deviseMonnaie, taux), deviseMonnaie, taux)
    : 0;

  // Produits trouvés dans le catalogue gardé, avec la quantité encore
  // vendable sur ce poste (lots non périmés, ventes en attente déduites).
  const chercherSurLePoste = useCallback((terme: string) => {
    const c = lireCatalogue();
    if (!c) { setResultats([]); return; }
    const enAttente = lireFile();
    setResultats(rechercherHorsLigne(terme, c).map((p) => ({
      id: p.id, sku: p.sku, name: p.name, dosage: p.dosage, sale_price: p.sale_price,
      requires_prescription: p.requires_prescription, nearest_expiry: p.lots[0]?.e ?? null,
      available: String(disponibleHorsLigne(p, enAttente)),
    })));
  }, []);

  const chercher = useCallback(async (terme: string) => {
    if (terme.trim().length < 2) {
      setResultats([]);
      return;
    }
    if (horsLigne) { chercherSurLePoste(terme); return; }
    try {
      const response = await fetch(
        `/api/proxy/catalog/products?q=${encodeURIComponent(terme)}&pageSize=25`,
      );
      if (!response.ok) return;
      const body = await response.json();
      setResultats(body.data ?? []);
    } catch {
      setHorsLigne(true);
      chercherSurLePoste(terme);
    }
  }, [horsLigne, chercherSurLePoste]);

  // Au retour du réseau, les ventes gardées partent d'elles-mêmes.
  const envoyerFile = useCallback(async () => {
    if (lireFile().every((v) => v.etat !== 'en_attente')) return;
    const r = await synchroniser();
    setFile(lireFile());
    if (r.envoyees > 0) {
      setHorsLigne(false);
      setMessage({
        ton: r.refusees ? 'warn' : 'info',
        texte: `${r.envoyees} vente(s) faite(s) hors connexion envoyée(s)` +
          (r.refusees ? ` ; ${r.refusees} à régulariser (voir ci-dessous).` : '.'),
      });
      void rafraichirCatalogue().then((c) => c && setCatalogue(c));
      router.refresh();
    } else if (r.session) {
      setMessage({ ton: 'warn', texte: 'Votre session a expiré : reconnectez-vous pour envoyer les ventes gardées sur ce poste.' });
    }
  }, [router]);

  useEffect(() => {
    setCatalogue(lireCatalogue());
    setFile(lireFile());
    setHorsLigne(!navigator.onLine);
    const rafraichir = async () => {
      const c = await rafraichirCatalogue();
      if (c) { setCatalogue(c); setHorsLigne(false); void envoyerFile(); }
      else if (!navigator.onLine) setHorsLigne(true);
    };
    void rafraichir();
    const surFile = () => setFile(lireFile());
    const enLigne = () => { void rafraichir(); };
    const coupe = () => setHorsLigne(true);
    window.addEventListener(EVENEMENT_FILE, surFile);
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', coupe);
    const catalogueMinuteur = setInterval(rafraichir, 5 * 60_000);
    const envoiMinuteur = setInterval(() => { void envoyerFile(); }, 20_000);
    return () => {
      window.removeEventListener(EVENEMENT_FILE, surFile);
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', coupe);
      clearInterval(catalogueMinuteur);
      clearInterval(envoiMinuteur);
    };
  }, [envoyerFile]);

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

  /**
   * Code scanné (caméra ou douchette, qui tape le code puis Entrée) : le
   * produit qui porte ce code part directement au ticket.
   */
  async function ajouterParCode(brut: string) {
    const code = brut.trim();
    if (code.length < 3) return;
    let trouve: Produit | null = null;
    if (horsLigne) {
      const c = lireCatalogue();
      const p = c?.products.find((x) => x.barcodes.includes(code) || x.sku.toLowerCase() === code.toLowerCase());
      if (p) {
        trouve = {
          id: p.id, sku: p.sku, name: p.name, dosage: p.dosage, sale_price: p.sale_price,
          requires_prescription: p.requires_prescription, nearest_expiry: p.lots[0]?.e ?? null,
          available: String(disponibleHorsLigne(p, lireFile())),
        };
      }
    } else {
      try {
        const r = await fetch(`/api/proxy/catalog/products?q=${encodeURIComponent(code)}&pageSize=5`);
        const body = r.ok ? await r.json() : { data: [] };
        const liste: Produit[] = body.data ?? [];
        trouve = liste.length === 1 ? liste[0] : liste.find((x) => x.sku.toLowerCase() === code.toLowerCase()) ?? null;
      } catch {
        setHorsLigne(true);
        return ajouterParCode(code);
      }
    }
    if (!trouve) {
      setRecherche(code);
      setMessage({ ton: 'warn', texte: `Aucun produit ne porte le code ${code}. Ajoutez-le à sa fiche dans Catalogue.` });
      return;
    }
    if (Number(trouve.available) <= 0) {
      setMessage({ ton: 'danger', texte: `« ${trouve.name} » est en rupture${horsLigne ? ' sur ce poste' : ''}.` });
      setRecherche('');
      return;
    }
    setMessage(null);
    ajouter(trouve);
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
    setDerniereVente(null);
    setFacture(null);

    if (moyen === 'cash' && manque > 0) {
      setMessage({
        ton: 'danger',
        texte: `Montant reçu insuffisant : il manque ${money(manque, devise)}` +
          (autre ? ` (${money(aPayer(convertir(manque, devise, autre, taux), autre, taux), autre)}).` : '.'),
      });
      setEnvoi(false);
      return;
    }
    // Le taux affiché au client accompagne chaque montant en autre devise.
    const enAutre = (montant: number, d: string) => ({
      amount: montant, currency: d, exchangeRate: Number(taux?.rate),
    });
    let paiements: Record<string, unknown>[];
    if (moyen === 'cash') {
      paiements = especesSaisies
        ? [
            ...(recuPrincipal > 0 ? [{ method: 'cash', amount: recuPrincipal }] : []),
            ...(recuAutre > 0 && autre ? [{ method: 'cash', ...enAutre(recuAutre, autre) }] : []),
          ]
        : du > 0 ? [{ method: 'cash', amount: du }] : [];
    } else if (moyen !== 'credit' && autre && devisePaiement === autre) {
      paiements = du > 0 ? [{ method: moyen, ...enAutre(auFrancPres(convertir(du, devise, autre, taux), autre), autre) }] : [];
    } else {
      paiements = du > 0 ? [{ method: moyen, amount: du }] : [];
    }
    if (tiersPayant && !couvert) {
      setMessage({ ton: 'danger', texte: erreurPartage ?? 'Choisissez le bénéficiaire du tiers payant, ou décochez « Tiers payant ».' });
      setEnvoi(false);
      return;
    }
    if (moyen === 'credit' && !client) {
      setMessage({ ton: 'danger', texte: 'Choisissez le client à qui la vente est faite à crédit.' });
      setEnvoi(false);
      return;
    }

    const corps = {
          lines: ticket.map((l) => ({
            productId: l.produit.id,
            quantity: l.quantite,
          })),
          payments: paiements,
          ...(moyen === 'cash' && surplus > 0 ? { changeCurrency: deviseMonnaie } : {}),
          ...(client ? { customerId: client.id } : {}),
          ...(couvert && beneficiaire
            ? { coverage: { payerMemberId: beneficiaire.id, ...(bon.trim() ? { authorizationNumber: bon.trim() } : {}) } }
            : {}),
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
    };

    if (horsLigne) {
      garderSurLePoste(corps);
      setEnvoi(false);
      return;
    }

    try {
      let response: Response;
      try {
        response = await fetch('/api/proxy/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        });
      } catch {
        // Réseau coupé pendant l'envoi : la vente est gardée avec la même
        // clé d'opération — si l'API l'avait reçue, elle ne sera pas doublée.
        setHorsLigne(true);
        garderSurLePoste(corps);
        return;
      }
      const body = await response.json();

      if (!response.ok) {
        setMessage({ ton: 'danger', texte: body.message ?? 'Vente refusée.' });
        return;
      }

      const rendu = Number(body.sale.change_amount ?? body.sale.change_given);
      setMessage({
        ton: 'info',
        texte:
          `Vente ${body.sale.number} enregistrée — ${money(body.sale.total, devise)}` +
          (rendu > 0 ? ` · à rendre : ${money(rendu, body.sale.change_currency ?? devise)}` : ''),
      });
      setDerniereVente({ id: body.sale.id, number: body.sale.number, currency: body.sale.currency });
      // Attendu en caisse et ventes encaissées à jour.
      router.refresh();
      viderTicket();
    } catch {
      setMessage({ ton: 'danger', texte: 'Le service est injoignable.' });
    } finally {
      setEnvoi(false);
    }
  }

  function viderTicket() {
    setTicket([]);
    setEncaisse('');
    setEncaisseAutre('');
    setTiersPayant(false);
    setBeneficiaire(null);
    setBon('');
    setPatient('');
    setPrescripteur('');
    setClient(null);
  }

  /**
   * Garde la vente sur le poste pendant une coupure. Seulement au comptant
   * (espèces, Mobile Money, carte) : le crédit et le tiers payant ont besoin
   * de l'API pour vérifier encours et plafonds. Le prix et le taux affichés
   * au client voyagent avec la vente.
   */
  function garderSurLePoste(corps: { lines: { productId: string; quantity: number }[]; [cle: string]: unknown }) {
    const c = lireCatalogue();
    if (!c || ageCatalogueHeures(c) > AGE_MAX_CATALOGUE_H) {
      setMessage({ ton: 'danger', texte: 'Pas de réseau, et le catalogue gardé sur ce poste est absent ou trop ancien : impossible de vendre hors connexion.' });
      return;
    }
    if (couvert || moyen === 'credit') {
      setMessage({ ton: 'danger', texte: 'Hors connexion, la vente se règle au comptant : le crédit et le tiers payant reviendront avec le réseau.' });
      return;
    }
    const enAttente = lireFile();
    for (const l of ticket) {
      const p = c.products.find((x) => x.id === l.produit.id);
      const dispo = p ? disponibleHorsLigne(p, enAttente) : 0;
      if (l.quantite > dispo) {
        setMessage({ ton: 'danger', texte: `Hors connexion, il reste ${dispo} « ${l.produit.name} » vendable(s) sur ce poste.` });
        return;
      }
    }
    const heure = new Date();
    const vente: VenteEnAttente = {
      id: corps.clientOperationId as string,
      corps: {
        ...corps,
        lines: ticket.map((l) => ({ productId: l.produit.id, quantity: l.quantite, unitPrice: Number(l.produit.sale_price) })),
        soldAt: heure.toISOString(),
        deviceId: identifiantPoste(),
        notes: `Vente encaissée hors connexion le ${heure.toLocaleString('fr-FR')}`,
      },
      creeLe: heure.toISOString(),
      total,
      devise,
      libelle: `HL-${heure.toTimeString().slice(0, 8).replace(/:/g, '')}`,
      etat: 'en_attente',
    };
    if (!mettreEnFile(vente)) {
      setMessage({ ton: 'danger', texte: 'Le stockage de ce poste est plein : vente non gardée.' });
      return;
    }
    setFile(lireFile());
    setMessage({
      ton: 'warn',
      texte: `Hors connexion : vente ${vente.libelle} gardée sur ce poste — ${money(total, devise)}` +
        (monnaie > 0 ? ` · à rendre : ${money(monnaie, deviseMonnaie)}` : '') +
        '. Elle sera envoyée dès le retour du réseau.',
    });
    viderTicket();
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

        <div className="recherche-scan">
          <input
            ref={champRecherche}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              // Entrée : la douchette a fini de taper un code, ou un seul produit correspond.
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (resultats.length === 1 && Number(resultats[0].available) > 0) ajouter(resultats[0]);
              else void ajouterParCode(recherche);
            }}
            placeholder="Paracétamol, PARA500, 3400930000014…"
            autoFocus
          />
          <ScanCodeBarres onCode={(code) => void ajouterParCode(code)} />
        </div>

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
                    {designation(produit.name, produit.dosage)}
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
                <strong>{money(produit.sale_price, devise)}</strong>
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

        {horsLigne && (
          <div className="banner warn hors-ligne">
            <strong>Hors connexion</strong>
            Les ventes au comptant sont gardées sur ce poste et partiront au retour du réseau.
            {catalogue ? ` Stock gardé à ${new Date(catalogue.generatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ' Aucun catalogue gardé sur ce poste.'}
          </div>
        )}
        {file.some((v) => v.etat === 'en_attente') && (
          <div className="banner info">
            {file.filter((v) => v.etat === 'en_attente').length} vente(s) hors connexion en attente d’envoi
            {!horsLigne && (
              <> · <button type="button" className="lien" onClick={() => void envoyerFile()}>envoyer maintenant</button></>
            )}
          </div>
        )}
        {file.filter((v) => v.etat === 'a_regulariser').map((v) => (
          <div key={v.id} className="banner danger">
            <strong>Vente {v.libelle} à régulariser</strong>
            {v.erreur} ({money(v.total, v.devise)}, {new Date(v.creeLe).toLocaleString('fr-FR')})
            <div className="row" style={{ marginTop: '0.4rem' }}>
              <button type="button" className="secondaire petit" onClick={() => { remettreEnAttente(v.id); setFile(lireFile()); void envoyerFile(); }}>
                Réessayer
              </button>
              <button type="button" className="secondaire petit" onClick={() => {
                if (window.confirm(`Abandonner la vente ${v.libelle} ? Elle ne sera jamais enregistrée : notez-la à la main.`)) {
                  retirerDeFile(v.id);
                  setFile(lireFile());
                }
              }}>
                Abandonner
              </button>
            </div>
          </div>
        ))}
        {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

        {derniereVente && (
          <div className="facture-vente">
            <div className="row" style={{ marginBottom: '0.5rem' }}>
              <BoutonTicket venteId={derniereVente.id} className="" />
            </div>
            {facture ? (
              <>
                <p style={{ marginTop: 0 }}>
                  Facture <Link href={`/pharmacie/factures/${facture.invoice.id}`}><strong>{facture.invoice.number}</strong></Link>
                  {facture.customer ? ` au nom de ${facture.customer.name}` : ' (client comptant)'} :
                </p>
                <DocumentFacture
                  factureId={facture.invoice.id}
                  numero={facture.invoice.number}
                  total={facture.invoice.total}
                  devise={facture.invoice.currency}
                  client={facture.customer}
                />
              </>
            ) : (
              <details className="depliable">
                <summary>Établir la facture de la vente {derniereVente.number}</summary>
                <EmettreFacture venteId={derniereVente.id} onEmise={setFacture} />
              </details>
            )}
          </div>
        )}

        {ticket.length === 0 ? (
          <div className="empty">Le ticket est vide.</div>
        ) : (
          <>
            {ticket.map((ligne) => (
              <div className="ticket-line" key={ligne.produit.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ligne.produit.name}</div>
                  <div className="small muted">{money(ligne.produit.sale_price, devise)} l&apos;unité</div>
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
                  {money(ligne.quantite * Number(ligne.produit.sale_price), devise)}
                </strong>
              </div>
            ))}

            <div className="ticket-total">
              <span>Total</span>
              <span className="mono">{money(total, devise)}</span>
            </div>
            {autre && (
              <div className="small muted" style={{ textAlign: 'right' }}>
                soit <strong className="mono">{money(aPayer(convertir(total, devise, autre, taux), autre, taux), autre)}</strong>
                {' '}au taux de {Number(taux?.rate).toLocaleString('fr-FR')}
              </div>
            )}

            <div className="tiers-payant-caisse">
              <label className="case">
                <input type="checkbox" checked={tiersPayant} disabled={horsLigne} onChange={(e) => setTiersPayant(e.target.checked)} />
                Tiers payant (assurance, mutuelle, convention)
              </label>
              {tiersPayant && (
                <>
                  <ChoixBeneficiaire beneficiaire={beneficiaire} onChange={setBeneficiaire} />
                  {erreurPartage && <div className="banner danger" style={{ marginTop: '0.5rem' }}>{erreurPartage}</div>}
                  {couvert && (
                    <div className="partage">
                      <div><span>Part {partage.payerName}</span><strong className="mono">{money(partage.payerShare, devise)}</strong></div>
                      <div><span>Part patient</span><strong className="mono">{money(partage.patientShare, devise)}</strong></div>
                      {partage.capped && partage.reason && <p className="small" style={{ margin: 0, color: 'var(--attention)' }}>{partage.reason}</p>}
                    </div>
                  )}
                  {beneficiaire && (
                    <div className="field" style={{ marginTop: '0.5rem' }}>
                      <label htmlFor="bon">N° du bon de prise en charge (facultatif)</label>
                      <input id="bon" value={bon} onChange={(e) => setBon(e.target.value)} />
                    </div>
                  )}
                </>
              )}
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
                {MOYENS.filter((m) => !(horsLigne && m.code === 'credit')).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {moyen === 'credit' && (
              <div className="field">
                <label htmlFor="choix-client">Client</label>
                <ChoixClient client={client} onChange={setClient} devise={devise} />
              </div>
            )}

            {moyen === 'cash' && (
              <>
                <div className={autre ? 'especes-deux' : ''}>
                  <div className="field">
                    <label htmlFor="encaisse">{autre ? `Reçu en ${devise === 'CDF' ? 'FC' : devise}` : 'Montant reçu'}</label>
                    <input
                      id="encaisse"
                      inputMode="decimal"
                      value={encaisse}
                      onChange={(e) => setEncaisse(e.target.value)}
                      placeholder={autre ? '0' : du.toFixed(2)}
                    />
                  </div>
                  {autre && (
                    <div className="field">
                      <label htmlFor="encaisse-autre">Reçu en {autre === 'CDF' ? 'FC' : autre}</label>
                      <input
                        id="encaisse-autre"
                        inputMode="decimal"
                        value={encaisseAutre}
                        onChange={(e) => setEncaisseAutre(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
                {autre && surplus > 0 && (
                  <div className="field">
                    <label htmlFor="devise-monnaie">Rendre la monnaie en</label>
                    <select id="devise-monnaie" value={deviseMonnaie} onChange={(e) => setDeviseMonnaie(e.target.value)}>
                      <option value={autre}>{autre === 'CDF' ? 'Francs (FC)' : autre}</option>
                      <option value={devise}>{devise === 'CDF' ? 'Francs (FC)' : devise}</option>
                    </select>
                  </div>
                )}
                {manque > 0 && (
                  <p className="small" style={{ marginTop: 0, color: 'var(--alerte)' }}>
                    Il manque <strong>{money(manque, devise)}</strong>
                    {autre ? ` (${money(aPayer(convertir(manque, devise, autre, taux), autre, taux), autre)})` : ''}
                  </p>
                )}
                {monnaie > 0 && (
                  <p className="monnaie-a-rendre" style={{ marginTop: 0 }}>
                    À rendre : <strong className="mono">{money(monnaie, deviseMonnaie)}</strong>
                  </p>
                )}
              </>
            )}

            {autre && !['cash', 'credit'].includes(moyen) && (
              <div className="field">
                <label htmlFor="devise-paiement">Payé en</label>
                <select id="devise-paiement" value={devisePaiement} onChange={(e) => setDevisePaiement(e.target.value)}>
                  <option value={devise}>{devise === 'CDF' ? 'Francs (FC)' : devise} — {money(du, devise)}</option>
                  <option value={autre}>
                    {autre === 'CDF' ? 'Francs (FC)' : autre} — {money(auFrancPres(convertir(du, devise, autre, taux), autre), autre)}
                  </option>
                </select>
              </div>
            )}

            <button
              onClick={encaisser}
              disabled={envoi}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {envoi ? 'Enregistrement…' : couvert ? `Encaisser la part patient : ${money(du, devise)}` : `Encaisser ${money(total, devise)}`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
