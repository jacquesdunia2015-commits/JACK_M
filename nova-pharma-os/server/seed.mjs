// NOVA PHARMA OS — Jeu de données pilote : NOVA SANTÉ PHARMA, Bukavu.

import { getDb, uid, now, saveDb } from './db.mjs';
import { hashPassword } from './auth.mjs';

const CATEGORIES = ['Antalgiques', 'Antibiotiques', 'Antipaludéens', 'Antiseptiques', 'Consommables médicaux', 'Hygiène'];

const CATALOGUE = [
  { code: 'PARA500', nom: 'Paracétamol 500 mg', dci: 'Paracétamol', dosage: '500 mg', forme: 'Comprimé', unite: 'boîte de 100', categorie: 'Antalgiques', prixAchat: 1.2, prixDetail: 2.5, prixPro: 2.3, prixSemiGros: 2.05, prixMin: 1.9, stockMin: 20, stockMax: 200, seuilAlerte: 25 },
  { code: 'AMOX500', nom: 'Amoxicilline 500 mg', dci: 'Amoxicilline', dosage: '500 mg', forme: 'Gélule', unite: 'boîte de 100', categorie: 'Antibiotiques', prixAchat: 3.4, prixDetail: 6.5, prixPro: 6.0, prixSemiGros: 5.5, prixMin: 4.8, stockMin: 15, stockMax: 150, seuilAlerte: 20 },
  { code: 'COART', nom: 'Coartem (Artéméther/Luméfantrine)', dci: 'Artéméther/Luméfantrine', dosage: '20/120 mg', forme: 'Comprimé', unite: 'boîte de 24', categorie: 'Antipaludéens', prixAchat: 2.8, prixDetail: 5.5, prixPro: 5.0, prixSemiGros: 4.6, prixMin: 4.0, stockMin: 25, stockMax: 200, seuilAlerte: 30 },
  { code: 'BETAD', nom: 'Bétadine solution 125 mL', dci: 'Povidone iodée', dosage: '10%', forme: 'Solution', unite: 'flacon', categorie: 'Antiseptiques', prixAchat: 1.5, prixDetail: 3.2, prixPro: 2.9, prixSemiGros: 2.6, prixMin: 2.2, stockMin: 10, stockMax: 100, seuilAlerte: 15 },
  { code: 'GANT-M', nom: 'Gants d’examen non stériles (M)', dci: '', dosage: '', forme: 'Boîte de 100', unite: 'boîte', categorie: 'Consommables médicaux', prixAchat: 4.0, prixDetail: 7.0, prixPro: 6.3, prixSemiGros: 5.8, prixMin: 5.0, stockMin: 10, stockMax: 100, seuilAlerte: 15 },
  { code: 'SER-5ML', nom: 'Seringues 5 mL', dci: '', dosage: '', forme: 'Boîte de 100', unite: 'boîte', categorie: 'Consommables médicaux', prixAchat: 3.0, prixDetail: 5.5, prixPro: 5.0, prixSemiGros: 4.6, prixMin: 4.0, stockMin: 10, stockMax: 100, seuilAlerte: 15 },
  { code: 'COMPR', nom: 'Compresses de gaze stériles', dci: '', dosage: '', forme: 'Paquet de 100', unite: 'paquet', categorie: 'Consommables médicaux', prixAchat: 2.2, prixDetail: 4.0, prixPro: 3.6, prixSemiGros: 3.3, prixMin: 2.9, stockMin: 10, stockMax: 100, seuilAlerte: 12 },
  { code: 'SAV-MAIN', nom: 'Savon antiseptique pour les mains', dci: '', dosage: '', forme: 'Flacon 500 mL', unite: 'flacon', categorie: 'Hygiène', prixAchat: 1.8, prixDetail: 3.5, prixPro: 3.1, prixSemiGros: 2.8, prixMin: 2.4, stockMin: 8, stockMax: 80, seuilAlerte: 10 },
];

export function seed() {
  const db = getDb();

  const org = { id: uid(), nom: 'NOVA SANTÉ PHARMA', ville: 'Bukavu', devise: 'USD', actif: true, cree: now() };
  db.organizations.push(org);
  db.branches.push({ id: uid(), organizationId: org.id, nom: 'Officine principale — Bukavu', ville: 'Bukavu', actif: true });

  const mkUser = (login, password, nom, role) => {
    const { salt, hash } = hashPassword(password);
    const u = { id: uid(), login, nom, role, organizationId: org.id, salt, hash, actif: true, cree: now() };
    db.users.push(u);
    return u;
  };

  mkUser('admin', 'admin123', 'Administrateur Plateforme', 'admin_systeme').organizationId = null;
  mkUser('proprietaire', 'demo1234', 'Jacques Dunia', 'admin_pharmacie');
  mkUser('pharmacien', 'demo1234', 'Dr Espérance Mwamini', 'pharmacien');
  mkUser('gestionnaire', 'demo1234', 'Patrick Bahati', 'gestionnaire');
  mkUser('magasinier', 'demo1234', 'Alain Chirimwami', 'magasinier');
  mkUser('vendeur', 'demo1234', 'Grâce Furaha', 'vendeur');
  mkUser('comptable', 'demo1234', 'Solange Nabintu', 'comptable');
  mkUser('livreur', 'demo1234', 'Espoir Kalume', 'livreur');

  const suppliers = [
    { id: uid(), organizationId: org.id, nom: 'ASRAMES', ville: 'Goma', telephone: '+243 990 000 001', delaiJours: 7, actif: true },
    { id: uid(), organizationId: org.id, nom: 'Pharmakina', ville: 'Bukavu', telephone: '+243 990 000 002', delaiJours: 3, actif: true },
    { id: uid(), organizationId: org.id, nom: 'Grossiste Kampala Ltd', ville: 'Kampala (Ouganda)', telephone: '+256 700 000 003', delaiJours: 12, actif: true },
  ];
  db.suppliers.push(...suppliers);

  for (const c of CATEGORIES) db.categories.push({ id: uid(), organizationId: org.id, nom: c });

  const products = CATALOGUE.map((p, i) => ({
    id: uid(), organizationId: org.id, code: p.code, nom: p.nom, dci: p.dci, dosage: p.dosage,
    forme: p.forme, unite: p.unite, categorie: p.categorie,
    fournisseurPrincipalId: suppliers[i % suppliers.length].id,
    prixAchat: p.prixAchat, prixDetail: p.prixDetail, prixPro: p.prixPro, prixSemiGros: p.prixSemiGros, prixMin: p.prixMin,
    stockMin: p.stockMin, stockMax: p.stockMax, seuilAlerte: p.seuilAlerte, actif: true,
  }));
  db.products.push(...products);

  // Lots initiaux : de quoi vendre et démontrer une alerte de péremption proche.
  const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  let batchSeq = 1;
  for (const p of products) {
    const lot1 = {
      id: uid(), organizationId: org.id, productId: p.id, numeroLot: `L${String(batchSeq++).padStart(4, '0')}`,
      quantiteInitiale: 60, quantite: 60, dateReception: now(), dateExpiration: dansNJours(420),
      fournisseurId: p.fournisseurPrincipalId, prixAchatUnitaire: p.prixAchat, statut: 'actif',
    };
    db.batches.push(lot1);
    db.stockMovements.push({
      id: uid(), organizationId: org.id, ts: now(), productId: p.id, batchId: lot1.id,
      type: 'achat', quantite: 60, motif: 'Stock initial', userId: null, reference: 'INIT',
    });
  }
  // Un lot proche de la péremption (< 90 jours) pour démontrer les alertes (§16).
  const paracetamol = products.find((p) => p.code === 'PARA500');
  const lotRisque = {
    id: uid(), organizationId: org.id, productId: paracetamol.id, numeroLot: 'L0099',
    quantiteInitiale: 15, quantite: 15, dateReception: now(), dateExpiration: dansNJours(45),
    fournisseurId: paracetamol.fournisseurPrincipalId, prixAchatUnitaire: paracetamol.prixAchat, statut: 'actif',
  };
  db.batches.push(lotRisque);
  db.stockMovements.push({
    id: uid(), organizationId: org.id, ts: now(), productId: paracetamol.id, batchId: lotRisque.id,
    type: 'achat', quantite: 15, motif: 'Stock initial (lot à rotation prioritaire)', userId: null, reference: 'INIT',
  });
  // Un produit volontairement sous le seuil pour démontrer l'alerte de rupture.
  const compresses = products.find((p) => p.code === 'COMPR');
  const lotBas = db.batches.find((b) => b.productId === compresses.id);
  lotBas.quantite = 4;

  const customers = [
    { id: uid(), organizationId: org.id, type: 'particulier', nom: 'Mireille Chishibanji', telephone: '+243 998 000 010', whatsapp: '+243 998 000 010', ville: 'Bukavu', categorieTarifaire: 'detail', plafondCredit: 0, encours: 0, actif: true, cree: now() },
    { id: uid(), organizationId: org.id, type: 'professionnel', nom: 'Clinique Espoir de Bukavu', telephone: '+243 998 000 020', whatsapp: '+243 998 000 020', ville: 'Bukavu', categorieTarifaire: 'pro', plafondCredit: 500, encours: 0, actif: true, cree: now(), responsable: 'Dr Alain Muhindo' },
    { id: uid(), organizationId: org.id, type: 'professionnel', nom: 'Laboratoire BioKivu', telephone: '+243 998 000 030', whatsapp: '+243 998 000 030', ville: 'Bukavu', categorieTarifaire: 'semi_gros', plafondCredit: 300, encours: 0, actif: true, cree: now(), responsable: 'Christine Bora' },
  ];
  db.customers.push(...customers);

  saveDb();
  return org;
}
