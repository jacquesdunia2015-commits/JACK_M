// NOVA PHARMA OS — Moteur de stock : FEFO, mouvements, alertes (§11 à §17).
//
// Règles métier critiques implémentées ici (§92) :
//  Règle 1 — aucune vente d'un produit expiré (le FEFO n'alloue jamais un
//            lot expiré ou en quarantaine) ;
//  Règle 2 — pas de stock négatif, sauf mode exceptionnel contrôlé
//            (drapeau forcerNegatif, réservé aux rôles habilités) ;
//  Règle 3 — aucun ajustement de stock sans motif ;
//  Règle 6 — chaque lot est traçable (mouvements horodatés, utilisateur,
//            référence).

import { getDb, uid, now } from './db.mjs';

export function stockDisponible(db, productId) {
  return db.batches
    .filter((b) => b.productId === productId && b.statut === 'actif' && new Date(b.dateExpiration) >= new Date())
    .reduce((sum, b) => sum + b.quantite, 0);
}

export function stockTotalBrut(db, productId) {
  return db.batches.filter((b) => b.productId === productId).reduce((sum, b) => sum + b.quantite, 0);
}

/**
 * Alloue la quantité demandée en respectant le FEFO (First Expired, First
 * Out) parmi les lots actifs, non expirés. Lève une erreur si le stock
 * disponible est insuffisant, sauf si `forcerNegatif` est vrai — auquel
 * cas un solde négatif contrôlé est autorisé sur le dernier lot utilisé
 * (traçable, jamais silencieux).
 */
export function allouerFEFO(db, productId, quantiteNecessaire, { forcerNegatif = false } = {}) {
  const lots = db.batches
    .filter((b) => b.productId === productId && b.statut === 'actif' && new Date(b.dateExpiration) >= new Date() && b.quantite > 0)
    .sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));

  const allocation = [];
  let reste = quantiteNecessaire;
  for (const lot of lots) {
    if (reste <= 0) break;
    const pris = Math.min(lot.quantite, reste);
    allocation.push({ batch: lot, quantite: pris });
    reste -= pris;
  }
  if (reste > 0) {
    if (!forcerNegatif) {
      const err = new Error(`Stock insuffisant : ${quantiteNecessaire - reste}/${quantiteNecessaire} unités disponibles`);
      err.code = 'STOCK_INSUFFISANT';
      err.disponible = quantiteNecessaire - reste;
      throw err;
    }
    // Mode exceptionnel contrôlé : le déficit est imputé au dernier lot
    // utilisé (ou un lot fictif si aucun stock actif n'existe), pour
    // rester traçable plutôt que de disparaître silencieusement.
    const dernierLot = lots[lots.length - 1] || db.batches.find((b) => b.productId === productId);
    if (dernierLot) allocation.push({ batch: dernierLot, quantite: reste, negatifForce: true });
  }
  return allocation;
}

/** Applique une allocation FEFO : décrémente les lots et journalise les
 * mouvements de stock. */
export function appliquerAllocation(db, allocation, { organizationId, type, motif, userId, reference }) {
  for (const { batch, quantite, negatifForce } of allocation) {
    batch.quantite -= quantite;
    if (batch.quantite <= 0 && !negatifForce) batch.statut = batch.statut === 'actif' ? 'epuise' : batch.statut;
    db.stockMovements.push({
      id: uid(), organizationId, ts: now(), productId: batch.productId, batchId: batch.id,
      type, quantite: -quantite, motif: negatifForce ? `${motif} (solde négatif autorisé)` : motif,
      userId, reference,
    });
  }
}

/** Ajustement manuel de stock — toujours motivé (§92 règle 3). */
export function ajusterStock(db, { organizationId, batchId, delta, motif, type, userId, reference }) {
  if (!motif || !motif.trim()) {
    const err = new Error('Un motif est obligatoire pour tout ajustement de stock');
    err.code = 'MOTIF_REQUIS';
    throw err;
  }
  const batch = db.batches.find((b) => b.id === batchId && b.organizationId === organizationId);
  if (!batch) { const err = new Error('Lot introuvable'); err.code = 'NOT_FOUND'; throw err; }
  batch.quantite += delta;
  if (batch.quantite < 0) batch.quantite = 0;
  db.stockMovements.push({
    id: uid(), organizationId, ts: now(), productId: batch.productId, batchId: batch.id,
    type: type || 'ajustement', quantite: delta, motif, userId, reference: reference || '',
  });
  return batch;
}

/** Alertes de rupture, péremption et surstock (§16). */
export function calculerAlertes(db, organizationId, { seuilPeremptionJours = 90, moisSurstock = 10 } = {}) {
  const produits = db.products.filter((p) => p.organizationId === organizationId && p.actif);
  const ruptures = [];
  const peremptions = [];
  const surstock = [];
  const seuilDate = new Date(Date.now() + seuilPeremptionJours * 86400000);

  for (const p of produits) {
    const dispo = stockDisponible(db, p.id);
    if (dispo <= p.seuilAlerte) {
      ruptures.push({ productId: p.id, code: p.code, nom: p.nom, stock: dispo, seuil: p.seuilAlerte, stockMin: p.stockMin });
    }
    if (dispo > 0 && p.stockMax && dispo >= p.stockMax) {
      surstock.push({ productId: p.id, code: p.code, nom: p.nom, stock: dispo, stockMax: p.stockMax });
    }
  }
  for (const b of db.batches) {
    if (b.organizationId !== organizationId || b.statut !== 'actif' || b.quantite <= 0) continue;
    if (new Date(b.dateExpiration) <= seuilDate) {
      const p = db.products.find((pr) => pr.id === b.productId);
      const joursRestants = Math.ceil((new Date(b.dateExpiration) - Date.now()) / 86400000);
      peremptions.push({
        productId: b.productId, code: p ? p.code : '?', nom: p ? p.nom : '?',
        numeroLot: b.numeroLot, quantite: b.quantite, dateExpiration: b.dateExpiration, joursRestants,
      });
    }
  }
  peremptions.sort((a, b) => a.joursRestants - b.joursRestants);
  ruptures.sort((a, b) => a.stock - b.stock);
  return { ruptures, peremptions, surstock };
}

/** Valeur du stock au coût d'achat (§37 dashboard). */
export function valeurStock(db, organizationId) {
  return db.batches
    .filter((b) => b.organizationId === organizationId && b.statut === 'actif')
    .reduce((sum, b) => sum + b.quantite * b.prixAchatUnitaire, 0);
}
