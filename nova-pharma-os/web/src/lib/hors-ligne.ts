/**
 * Caisse hors connexion.
 *
 * Le poste garde le catalogue de la caisse (prix, codes-barres, lots
 * vendables avec leur péremption) et, pendant une coupure, les ventes
 * encaissées. Elles partent au retour du réseau, dans l'ordre, avec leur
 * heure réelle ; l'API les reconnaît par leur identifiant d'opération et
 * n'en crée jamais deux. Une vente que l'API refuse (stock vendu ailleurs
 * entre-temps, par exemple) reste sur le poste, « à régulariser ».
 *
 * Tout tient dans le stockage du navigateur : un poste ne voit que ses
 * propres ventes en attente.
 */

import type { TauxDuJour } from '@/lib/devises';

export interface ProduitHorsLigne {
  id: string;
  sku: string;
  name: string;
  dosage: string | null;
  sale_price: string;
  requires_prescription: boolean;
  barcodes: string[];
  /** Lots vendables : e = péremption (AAAA-MM-JJ ou null), q = quantité. */
  lots: { e: string | null; q: number }[];
}

export interface CatalogueHorsLigne {
  generatedAt: string;
  branchId: string;
  currency: string;
  rate: TauxDuJour | null;
  products: ProduitHorsLigne[];
}

export interface VenteEnAttente {
  id: string;
  /** Corps de POST /sales, déjà complet (clientOperationId, soldAt, deviceId…). */
  corps: {
    lines: { productId: string; quantity: number; unitPrice?: number }[];
    [cle: string]: unknown;
  };
  creeLe: string;
  total: number;
  devise: string;
  libelle: string;
  etat: 'en_attente' | 'a_regulariser';
  erreur?: string;
}

const CLE_CATALOGUE = 'nova-caisse-catalogue';
const CLE_FILE = 'nova-caisse-file';
const CLE_POSTE = 'nova-poste';
/** Au-delà, le stock gardé est trop ancien pour vendre sans réseau. */
export const AGE_MAX_CATALOGUE_H = 24;
export const EVENEMENT_FILE = 'nova-file-caisse';

const lire = <T>(cle: string, repli: T): T => {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : repli;
  } catch {
    return repli;
  }
};
const ecrire = (cle: string, valeur: unknown) => {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
};

/** Identifiant stable de ce poste, pour retrouver d'où vient une vente. */
export function identifiantPoste(): string {
  let id = lire<string | null>(CLE_POSTE, null);
  if (!id) {
    id = `poste-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
    ecrire(CLE_POSTE, id);
  }
  return id;
}

export const lireCatalogue = () => lire<CatalogueHorsLigne | null>(CLE_CATALOGUE, null);

/** Recharge le catalogue depuis l'API ; renvoie null si le réseau ne répond pas. */
export async function rafraichirCatalogue(): Promise<CatalogueHorsLigne | null> {
  try {
    const r = await fetch('/api/proxy/sales/offline-catalog', { cache: 'no-store' });
    if (!r.ok) return null;
    const c = (await r.json()) as CatalogueHorsLigne;
    ecrire(CLE_CATALOGUE, c);
    return c;
  } catch {
    return null;
  }
}

export function ageCatalogueHeures(c: CatalogueHorsLigne | null): number {
  if (!c) return Infinity;
  return (Date.now() - new Date(c.generatedAt).getTime()) / 3_600_000;
}

export const lireFile = () => lire<VenteEnAttente[]>(CLE_FILE, []);

function ecrireFile(file: VenteEnAttente[]) {
  const ok = ecrire(CLE_FILE, file);
  window.dispatchEvent(new CustomEvent(EVENEMENT_FILE, { detail: file.length }));
  return ok;
}

export function mettreEnFile(vente: VenteEnAttente): boolean {
  return ecrireFile([...lireFile(), vente]);
}

export function retirerDeFile(id: string) {
  ecrireFile(lireFile().filter((v) => v.id !== id));
}

export function remettreEnAttente(id: string) {
  ecrireFile(lireFile().map((v) => (v.id === id ? { ...v, etat: 'en_attente', erreur: undefined } : v)));
}

/**
 * Quantité vendable hors connexion : les lots qui ne seront pas périmés
 * aujourd'hui, moins ce que ce poste a vendu sans que l'API le sache encore
 * (une vente envoyée sort de la file et du stock de l'API en même temps).
 */
export function disponibleHorsLigne(p: ProduitHorsLigne, file: VenteEnAttente[]): number {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const enStock = p.lots.filter((l) => !l.e || l.e >= aujourdhui).reduce((s, l) => s + Number(l.q), 0);
  const vendu = file
    .flatMap((v) => v.corps.lines)
    .filter((l) => l.productId === p.id)
    .reduce((s, l) => s + l.quantity, 0);
  return Math.max(0, enStock - vendu);
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recherche dans le catalogue gardé : nom, référence ou code-barres. */
export function rechercherHorsLigne(terme: string, c: CatalogueHorsLigne): ProduitHorsLigne[] {
  const t = sansAccent(terme.trim());
  if (t.length < 2) return [];
  return c.products
    .filter((p) =>
      sansAccent(p.name).includes(t) || sansAccent(p.sku).includes(t) || p.barcodes.some((b) => b === terme.trim()),
    )
    .slice(0, 25);
}

let envoiEnCours = false;

/**
 * Envoie les ventes en attente, dans l'ordre. S'arrête au premier échec de
 * réseau ou de session (elles repartiront plus tard) ; une vente refusée
 * par l'API passe « à régulariser » sans bloquer les suivantes.
 */
export async function synchroniser(): Promise<{ envoyees: number; refusees: number; restantes: number; session?: boolean }> {
  if (envoiEnCours) return { envoyees: 0, refusees: 0, restantes: lireFile().length };
  envoiEnCours = true;
  let envoyees = 0;
  let refusees = 0;
  let session = false;
  try {
    for (const vente of lireFile().filter((v) => v.etat === 'en_attente')) {
      let r: Response;
      try {
        r = await fetch('/api/proxy/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vente.corps),
        });
      } catch {
        break;
      }
      if (r.ok) {
        retirerDeFile(vente.id);
        envoyees++;
        continue;
      }
      if (r.status === 401 || r.status === 403 || r.status >= 500) {
        session = r.status === 401;
        break;
      }
      const body = await r.json().catch(() => ({}));
      const m = (body as { message?: unknown }).message;
      ecrireFile(lireFile().map((v) => (v.id === vente.id
        ? { ...v, etat: 'a_regulariser', erreur: (Array.isArray(m) ? m.join(' ') : (m as string)) ?? `Refusée (${r.status}).` }
        : v)));
      refusees++;
    }
  } finally {
    envoiEnCours = false;
  }
  return { envoyees, refusees, restantes: lireFile().length, session };
}
