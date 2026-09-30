/**
 * Catalogue de référence Goma–Bukavu : 100 médicaments et produits que
 * l'on retrouve dans presque toutes les officines du Nord et du Sud-Kivu.
 *
 * La sélection suit la Liste nationale des médicaments essentiels de la
 * RD Congo et les demandes les plus fréquentes au comptoir : paludisme,
 * infections, diarrhées de l'enfant, douleurs et fièvre, vers intestinaux,
 * hypertension et diabète, soins de la peau, planning familial, solutés et
 * consommables de soins.
 *
 * Les prix sont indicatifs, en dollars, au détail : un ordre de grandeur de
 * ce qui se pratique dans la région, que chaque pharmacie ajuste à ses
 * propres prix d'achat avant ou après l'import.
 */

export interface ProduitReference {
  code: string;
  name: string;
  inn: string | null;
  dosage: string | null;
  dosageForm: string;
  packaging: string;
  unit: string;
  categoryCode: string;
  salePrice: number;
  costPrice: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  isColdChain: boolean;
  /** Faux pour le matériel sans date de péremption (coton, bandes, thermomètre…). */
  hasExpiry: boolean;
}

export const DEVISE_REFERENCE = 'USD';

export const CATEGORIES_REFERENCE: Record<string, string> = {
  ANTIPALUDIQUES: 'Antipaludiques',
  ANTIBIOTIQUES: 'Antibiotiques',
  ANTALGIQUES: 'Douleur, fièvre et inflammation',
  ANTIPARASITAIRES: 'Vermifuges et antiparasitaires',
  REHYDRATATION: 'Réhydratation et diarrhée',
  DIGESTIF: 'Estomac et digestion',
  RESPIRATOIRE: 'Toux, allergie et asthme',
  VITAMINES: 'Vitamines, fer et compléments',
  CARDIOLOGIE: 'Hypertension et cœur',
  ANTIDIABETIQUES: 'Diabète',
  DERMATOLOGIE: 'Peau',
  OPHTALMOLOGIE: 'Yeux et oreilles',
  SANTE_FEMME: 'Santé de la femme et planning familial',
  INJECTABLES: 'Solutés et injectables',
  CONSOMMABLES: 'Consommables de soins',
  DIAGNOSTIC: 'Tests et diagnostic',
};

/**
 * Colonnes : code, nom, DCI, dosage, forme, conditionnement, unité de
 * vente, catégorie, prix de vente, prix d'achat, repères.
 * Repères : O = sur ordonnance, S = stupéfiant ou psychotrope,
 * F = chaîne du froid, N = sans date de péremption.
 */
type Ligne = [string, string, string | null, string | null, string, string, string, string, number, number, string?];

const LIGNES: Ligne[] = [
  // --- Paludisme
  ['KV-ALU-24', 'Artéméther-Luméfantrine 20/120 mg adulte', 'Artéméther + Luméfantrine', '20/120 mg', 'comprimé', 'plaquette de 24 comprimés', 'plaquette', 'ANTIPALUDIQUES', 2.0, 1.2],
  ['KV-ALU-6', 'Artéméther-Luméfantrine 20/120 mg enfant', 'Artéméther + Luméfantrine', '20/120 mg', 'comprimé dispersible', 'plaquette de 6 comprimés', 'plaquette', 'ANTIPALUDIQUES', 0.8, 0.45],
  ['KV-ASAQ', 'Artésunate-Amodiaquine 100/270 mg', 'Artésunate + Amodiaquine', '100/270 mg', 'comprimé', 'plaquette de 6 comprimés', 'plaquette', 'ANTIPALUDIQUES', 1.5, 0.9],
  ['KV-DHAP', 'Dihydroartémisinine-Pipéraquine 40/320 mg', 'Dihydroartémisinine + Pipéraquine', '40/320 mg', 'comprimé', 'plaquette de 9 comprimés', 'plaquette', 'ANTIPALUDIQUES', 3.5, 2.2],
  ['KV-ARTS-60', 'Artésunate 60 mg injectable', 'Artésunate', '60 mg', 'poudre injectable', 'flacon avec solvant', 'flacon', 'ANTIPALUDIQUES', 2.5, 1.6, 'O'],
  ['KV-QUIN-300', 'Quinine 300 mg', 'Quinine sulfate', '300 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIPALUDIQUES', 0.6, 0.35],
  ['KV-QUIN-INJ', 'Quinine 600 mg/2 ml injectable', 'Quinine dichlorhydrate', '600 mg/2 ml', 'solution injectable', 'ampoule de 2 ml', 'ampoule', 'ANTIPALUDIQUES', 0.5, 0.28, 'O'],
  ['KV-SP', 'Sulfadoxine-Pyriméthamine 500/25 mg', 'Sulfadoxine + Pyriméthamine', '500/25 mg', 'comprimé', 'plaquette de 3 comprimés', 'plaquette', 'ANTIPALUDIQUES', 0.4, 0.2],
  // --- Infections
  ['KV-AMOX-500', 'Amoxicilline 500 mg', 'Amoxicilline', '500 mg', 'gélule', 'plaquette de 10 gélules', 'plaquette', 'ANTIBIOTIQUES', 0.5, 0.28, 'O'],
  ['KV-AMOX-SUSP', 'Amoxicilline 250 mg/5 ml suspension', 'Amoxicilline', '250 mg/5 ml', 'poudre pour suspension buvable', 'flacon de 100 ml', 'flacon', 'ANTIBIOTIQUES', 1.2, 0.7, 'O'],
  ['KV-AMCL-625', 'Amoxicilline-Acide clavulanique 625 mg', 'Amoxicilline + Acide clavulanique', '625 mg', 'comprimé', 'boîte de 14 comprimés', 'boîte', 'ANTIBIOTIQUES', 4.5, 2.8, 'O'],
  ['KV-COTRI-480', 'Cotrimoxazole 480 mg', 'Sulfaméthoxazole + Triméthoprime', '480 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIBIOTIQUES', 0.3, 0.15, 'O'],
  ['KV-COTRI-SIR', 'Cotrimoxazole 240 mg/5 ml suspension', 'Sulfaméthoxazole + Triméthoprime', '240 mg/5 ml', 'suspension buvable', 'flacon de 100 ml', 'flacon', 'ANTIBIOTIQUES', 1.0, 0.55, 'O'],
  ['KV-METRO-250', 'Métronidazole 250 mg', 'Métronidazole', '250 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIBIOTIQUES', 0.3, 0.15, 'O'],
  ['KV-METRO-SUSP', 'Métronidazole 125 mg/5 ml suspension', 'Métronidazole', '125 mg/5 ml', 'suspension buvable', 'flacon de 100 ml', 'flacon', 'ANTIBIOTIQUES', 1.0, 0.55, 'O'],
  ['KV-CIPRO-500', 'Ciprofloxacine 500 mg', 'Ciprofloxacine', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIBIOTIQUES', 1.0, 0.55, 'O'],
  ['KV-DOXY-100', 'Doxycycline 100 mg', 'Doxycycline', '100 mg', 'gélule', 'plaquette de 10 gélules', 'plaquette', 'ANTIBIOTIQUES', 0.6, 0.3, 'O'],
  ['KV-AZI-500', 'Azithromycine 500 mg', 'Azithromycine', '500 mg', 'comprimé', 'boîte de 3 comprimés', 'boîte', 'ANTIBIOTIQUES', 2.0, 1.1, 'O'],
  ['KV-CEFIX-200', 'Céfixime 200 mg', 'Céfixime', '200 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIBIOTIQUES', 3.0, 1.8, 'O'],
  ['KV-CEFTRI-1G', 'Ceftriaxone 1 g injectable', 'Ceftriaxone', '1 g', 'poudre injectable', 'flacon', 'flacon', 'ANTIBIOTIQUES', 1.5, 0.85, 'O'],
  ['KV-GENTA-80', 'Gentamicine 80 mg/2 ml injectable', 'Gentamicine', '80 mg/2 ml', 'solution injectable', 'ampoule de 2 ml', 'ampoule', 'ANTIBIOTIQUES', 0.4, 0.2, 'O'],
  ['KV-BPEN-2.4', 'Benzathine benzylpénicilline 2,4 MUI', 'Benzathine benzylpénicilline', '2,4 MUI', 'poudre injectable', 'flacon', 'flacon', 'ANTIBIOTIQUES', 1.5, 0.9, 'O'],
  // --- Douleur et fièvre
  ['KV-PARA-500', 'Paracétamol 500 mg', 'Paracétamol', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTALGIQUES', 0.2, 0.08],
  ['KV-PARA-SIR', 'Paracétamol 120 mg/5 ml sirop', 'Paracétamol', '120 mg/5 ml', 'sirop', 'flacon de 100 ml', 'flacon', 'ANTALGIQUES', 0.8, 0.4],
  ['KV-IBU-400', 'Ibuprofène 400 mg', 'Ibuprofène', '400 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTALGIQUES', 0.4, 0.18],
  ['KV-IBU-SUSP', 'Ibuprofène 100 mg/5 ml suspension', 'Ibuprofène', '100 mg/5 ml', 'suspension buvable', 'flacon de 100 ml', 'flacon', 'ANTALGIQUES', 1.2, 0.65],
  ['KV-DICLO-50', 'Diclofénac 50 mg', 'Diclofénac', '50 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTALGIQUES', 0.3, 0.14],
  ['KV-DICLO-GEL', 'Diclofénac 1 % gel', 'Diclofénac', '1 %', 'gel', 'tube de 50 g', 'tube', 'ANTALGIQUES', 2.0, 1.1],
  ['KV-ASPI-500', 'Acide acétylsalicylique 500 mg', 'Acide acétylsalicylique', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTALGIQUES', 0.25, 0.1],
  ['KV-METAM-500', 'Métamizole 500 mg', 'Métamizole sodique', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTALGIQUES', 0.4, 0.2],
  ['KV-TRAMA-50', 'Tramadol 50 mg', 'Tramadol', '50 mg', 'gélule', 'plaquette de 10 gélules', 'plaquette', 'ANTALGIQUES', 1.0, 0.55, 'OS'],
  // --- Vers et parasites
  ['KV-ALBE-400', 'Albendazole 400 mg', 'Albendazole', '400 mg', 'comprimé', 'boîte de 1 comprimé', 'boîte', 'ANTIPARASITAIRES', 0.3, 0.12],
  ['KV-ALBE-SUSP', 'Albendazole 400 mg/10 ml suspension', 'Albendazole', '400 mg/10 ml', 'suspension buvable', 'flacon de 10 ml', 'flacon', 'ANTIPARASITAIRES', 0.6, 0.3],
  ['KV-MEBE-100', 'Mébendazole 100 mg', 'Mébendazole', '100 mg', 'comprimé', 'plaquette de 6 comprimés', 'plaquette', 'ANTIPARASITAIRES', 0.4, 0.18],
  ['KV-PRAZI-600', 'Praziquantel 600 mg', 'Praziquantel', '600 mg', 'comprimé', 'plaquette de 4 comprimés', 'plaquette', 'ANTIPARASITAIRES', 1.2, 0.7, 'O'],
  ['KV-TINI-500', 'Tinidazole 500 mg', 'Tinidazole', '500 mg', 'comprimé', 'plaquette de 4 comprimés', 'plaquette', 'ANTIPARASITAIRES', 0.6, 0.3, 'O'],
  // --- Diarrhée et digestion
  ['KV-SRO', 'Sels de réhydratation orale', 'Sels de réhydratation orale', null, 'poudre pour solution buvable', 'sachet pour 1 litre', 'sachet', 'REHYDRATATION', 0.15, 0.06],
  ['KV-ZINC-20', 'Zinc 20 mg', 'Sulfate de zinc', '20 mg', 'comprimé dispersible', 'plaquette de 10 comprimés', 'plaquette', 'REHYDRATATION', 0.5, 0.25],
  ['KV-LOPE-2', 'Lopéramide 2 mg', 'Lopéramide', '2 mg', 'gélule', 'plaquette de 10 gélules', 'plaquette', 'REHYDRATATION', 0.4, 0.2],
  ['KV-OMEP-20', 'Oméprazole 20 mg', 'Oméprazole', '20 mg', 'gélule', 'plaquette de 10 gélules', 'plaquette', 'DIGESTIF', 0.6, 0.3],
  ['KV-ANTIAC-CP', 'Aluminium-Magnésium hydroxyde, comprimés à croquer', 'Hydroxyde d’aluminium + Hydroxyde de magnésium', null, 'comprimé à croquer', 'plaquette de 10 comprimés', 'plaquette', 'DIGESTIF', 0.4, 0.18],
  ['KV-ANTIAC-SUSP', 'Aluminium-Magnésium hydroxyde, suspension', 'Hydroxyde d’aluminium + Hydroxyde de magnésium', null, 'suspension buvable', 'flacon de 200 ml', 'flacon', 'DIGESTIF', 2.0, 1.1],
  ['KV-HYOS-10', 'Butylbromure de hyoscine 10 mg', 'Butylscopolamine', '10 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'DIGESTIF', 1.0, 0.55],
  ['KV-METOC-10', 'Métoclopramide 10 mg', 'Métoclopramide', '10 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'DIGESTIF', 0.3, 0.15, 'O'],
  // --- Toux, allergie, asthme
  ['KV-SALB-AERO', 'Salbutamol 100 µg aérosol', 'Salbutamol', '100 µg', 'suspension pour inhalation', 'flacon de 200 doses', 'flacon', 'RESPIRATOIRE', 3.5, 2.0, 'O'],
  ['KV-SALB-4', 'Salbutamol 4 mg', 'Salbutamol', '4 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'RESPIRATOIRE', 0.4, 0.18, 'O'],
  ['KV-CARBO-SIR', 'Carbocistéine 250 mg/5 ml sirop', 'Carbocistéine', '250 mg/5 ml', 'sirop', 'flacon de 125 ml', 'flacon', 'RESPIRATOIRE', 2.0, 1.1],
  ['KV-DEXTRO-SIR', 'Dextrométhorphane 15 mg/5 ml sirop', 'Dextrométhorphane', '15 mg/5 ml', 'sirop', 'flacon de 100 ml', 'flacon', 'RESPIRATOIRE', 1.8, 0.95],
  ['KV-CHLOR-4', 'Chlorphénamine 4 mg', 'Chlorphénamine', '4 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'RESPIRATOIRE', 0.2, 0.08],
  ['KV-PROM-25', 'Prométhazine 25 mg', 'Prométhazine', '25 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'RESPIRATOIRE', 0.3, 0.14],
  ['KV-CETI-10', 'Cétirizine 10 mg', 'Cétirizine', '10 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'RESPIRATOIRE', 0.5, 0.22],
  ['KV-LORA-10', 'Loratadine 10 mg', 'Loratadine', '10 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'RESPIRATOIRE', 0.6, 0.28],
  // --- Vitamines et fer
  ['KV-FEFOL', 'Fer + Acide folique 200/0,4 mg', 'Sulfate ferreux + Acide folique', '200/0,4 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'VITAMINES', 0.2, 0.08],
  ['KV-FOL-5', 'Acide folique 5 mg', 'Acide folique', '5 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'VITAMINES', 0.2, 0.08],
  ['KV-FER-SIR', 'Sulfate ferreux sirop', 'Sulfate ferreux', null, 'sirop', 'flacon de 100 ml', 'flacon', 'VITAMINES', 1.2, 0.6],
  ['KV-VITC-500', 'Vitamine C 500 mg', 'Acide ascorbique', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'VITAMINES', 0.3, 0.12],
  ['KV-VITB-CO', 'Vitamine B complexe', 'Vitamines B1, B2, B6, PP', null, 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'VITAMINES', 0.3, 0.12],
  ['KV-MULTI-SIR', 'Multivitamines sirop', 'Multivitamines', null, 'sirop', 'flacon de 100 ml', 'flacon', 'VITAMINES', 1.5, 0.8],
  ['KV-CALD3', 'Calcium 500 mg + Vitamine D3 400 UI', 'Carbonate de calcium + Cholécalciférol', null, 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'VITAMINES', 1.0, 0.55],
  // --- Hypertension et diabète
  ['KV-AMLO-5', 'Amlodipine 5 mg', 'Amlodipine', '5 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.5, 0.22, 'O'],
  ['KV-NIFE-20', 'Nifédipine 20 mg LP', 'Nifédipine', '20 mg', 'comprimé à libération prolongée', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.6, 0.3, 'O'],
  ['KV-CAPTO-25', 'Captopril 25 mg', 'Captopril', '25 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.4, 0.18, 'O'],
  ['KV-ENAL-10', 'Énalapril 10 mg', 'Énalapril', '10 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.5, 0.24, 'O'],
  ['KV-HCTZ-25', 'Hydrochlorothiazide 25 mg', 'Hydrochlorothiazide', '25 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.3, 0.14, 'O'],
  ['KV-FURO-40', 'Furosémide 40 mg', 'Furosémide', '40 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'CARDIOLOGIE', 0.3, 0.14, 'O'],
  ['KV-METF-500', 'Metformine 500 mg', 'Metformine', '500 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIDIABETIQUES', 0.4, 0.18, 'O'],
  ['KV-GLIB-5', 'Glibenclamide 5 mg', 'Glibenclamide', '5 mg', 'comprimé', 'plaquette de 10 comprimés', 'plaquette', 'ANTIDIABETIQUES', 0.3, 0.12, 'O'],
  ['KV-INSU-MIX', 'Insuline humaine mixte 30/70 100 UI/ml', 'Insuline humaine biphasique', '100 UI/ml', 'suspension injectable', 'flacon de 10 ml', 'flacon', 'ANTIDIABETIQUES', 8.0, 5.5, 'OF'],
  // --- Peau
  ['KV-MICO-CR', 'Miconazole 2 % crème', 'Miconazole', '2 %', 'crème', 'tube de 30 g', 'tube', 'DERMATOLOGIE', 1.2, 0.6],
  ['KV-CLOT-CR', 'Clotrimazole 1 % crème', 'Clotrimazole', '1 %', 'crème', 'tube de 20 g', 'tube', 'DERMATOLOGIE', 1.0, 0.5],
  ['KV-HYDRO-CR', 'Hydrocortisone 1 % crème', 'Hydrocortisone', '1 %', 'crème', 'tube de 15 g', 'tube', 'DERMATOLOGIE', 1.2, 0.6],
  ['KV-BETA-CR', 'Bétaméthasone 0,1 % crème', 'Bétaméthasone', '0,1 %', 'crème', 'tube de 15 g', 'tube', 'DERMATOLOGIE', 1.2, 0.6, 'O'],
  ['KV-BENZ-LOT', 'Benzoate de benzyle 25 % lotion', 'Benzoate de benzyle', '25 %', 'lotion', 'flacon de 125 ml', 'flacon', 'DERMATOLOGIE', 1.5, 0.75],
  ['KV-VIOLET', 'Violet de gentiane 1 % solution', 'Violet de gentiane', '1 %', 'solution cutanée', 'flacon de 30 ml', 'flacon', 'DERMATOLOGIE', 0.5, 0.2],
  // --- Yeux et oreilles
  ['KV-TETRA-OPH', 'Tétracycline 1 % pommade ophtalmique', 'Tétracycline', '1 %', 'pommade ophtalmique', 'tube de 5 g', 'tube', 'OPHTALMOLOGIE', 0.5, 0.22],
  ['KV-CHLORAM-COL', 'Chloramphénicol 0,5 % collyre', 'Chloramphénicol', '0,5 %', 'collyre', 'flacon de 10 ml', 'flacon', 'OPHTALMOLOGIE', 0.8, 0.4, 'O'],
  ['KV-CIPRO-GTT', 'Ciprofloxacine 0,3 % gouttes', 'Ciprofloxacine', '0,3 %', 'collyre et gouttes auriculaires', 'flacon de 5 ml', 'flacon', 'OPHTALMOLOGIE', 1.2, 0.6, 'O'],
  // --- Santé de la femme
  ['KV-COC-28', 'Pilule contraceptive lévonorgestrel/éthinylestradiol 0,15/0,03 mg', 'Lévonorgestrel + Éthinylestradiol', '0,15/0,03 mg', 'comprimé', 'plaquette de 28 comprimés', 'plaquette', 'SANTE_FEMME', 0.5, 0.25],
  ['KV-LNG-1.5', 'Lévonorgestrel 1,5 mg (contraception d’urgence)', 'Lévonorgestrel', '1,5 mg', 'comprimé', 'boîte de 1 comprimé', 'boîte', 'SANTE_FEMME', 1.5, 0.8],
  ['KV-DMPA-150', 'Médroxyprogestérone 150 mg injectable', 'Médroxyprogestérone acétate', '150 mg', 'suspension injectable', 'flacon de 1 ml', 'flacon', 'SANTE_FEMME', 1.0, 0.6, 'O'],
  ['KV-CLOT-OV', 'Clotrimazole 500 mg comprimé vaginal', 'Clotrimazole', '500 mg', 'comprimé vaginal', 'boîte de 1 comprimé', 'boîte', 'SANTE_FEMME', 1.2, 0.6],
  ['KV-METRO-OV', 'Métronidazole 500 mg ovule', 'Métronidazole', '500 mg', 'ovule', 'plaquette de 10 ovules', 'plaquette', 'SANTE_FEMME', 1.5, 0.8, 'O'],
  ['KV-FLUCO-150', 'Fluconazole 150 mg', 'Fluconazole', '150 mg', 'gélule', 'boîte de 1 gélule', 'boîte', 'SANTE_FEMME', 0.8, 0.4],
  // --- Solutés et injectables
  ['KV-RINGER-500', 'Ringer lactate 500 ml', 'Ringer lactate', null, 'solution pour perfusion', 'poche de 500 ml', 'poche', 'INJECTABLES', 1.2, 0.7, 'O'],
  ['KV-NACL-500', 'Chlorure de sodium 0,9 % 500 ml', 'Chlorure de sodium', '0,9 %', 'solution pour perfusion', 'poche de 500 ml', 'poche', 'INJECTABLES', 1.0, 0.6, 'O'],
  ['KV-GLU5-500', 'Glucose 5 % 500 ml', 'Glucose', '5 %', 'solution pour perfusion', 'poche de 500 ml', 'poche', 'INJECTABLES', 1.0, 0.6, 'O'],
  ['KV-DEXA-4', 'Dexaméthasone 4 mg/ml injectable', 'Dexaméthasone', '4 mg/ml', 'solution injectable', 'ampoule de 1 ml', 'ampoule', 'INJECTABLES', 0.3, 0.14, 'O'],
  ['KV-DIAZ-10', 'Diazépam 10 mg/2 ml injectable', 'Diazépam', '10 mg/2 ml', 'solution injectable', 'ampoule de 2 ml', 'ampoule', 'INJECTABLES', 0.5, 0.25, 'OS'],
  // --- Consommables et diagnostic
  ['KV-SER-5', 'Seringue 5 ml avec aiguille', null, null, 'dispositif stérile', 'à l’unité', 'pièce', 'CONSOMMABLES', 0.1, 0.04],
  ['KV-PERF', 'Perfuseur (set de perfusion)', null, null, 'dispositif stérile', 'à l’unité', 'pièce', 'CONSOMMABLES', 0.4, 0.18],
  ['KV-GANTS', 'Gants d’examen en latex', null, null, 'dispositif', 'boîte de 100', 'boîte', 'CONSOMMABLES', 6.0, 4.0],
  ['KV-COMP', 'Compresses stériles 10 x 10 cm', null, null, 'dispositif stérile', 'sachet de 5', 'sachet', 'CONSOMMABLES', 0.3, 0.15],
  ['KV-COTON', 'Coton hydrophile 100 g', null, null, 'pansement', 'paquet de 100 g', 'paquet', 'CONSOMMABLES', 1.0, 0.5, 'N'],
  ['KV-BANDE', 'Bande de crêpe 10 cm', null, null, 'pansement', 'à l’unité', 'pièce', 'CONSOMMABLES', 0.6, 0.3, 'N'],
  ['KV-SPARA', 'Sparadrap 5 cm x 5 m', null, null, 'pansement', 'rouleau', 'rouleau', 'CONSOMMABLES', 1.0, 0.5, 'N'],
  ['KV-ALCOOL', 'Alcool éthylique 70 %', 'Éthanol', '70 %', 'solution cutanée', 'flacon de 250 ml', 'flacon', 'CONSOMMABLES', 1.5, 0.8],
  ['KV-POVI', 'Povidone iodée 10 % solution', 'Povidone iodée', '10 %', 'solution cutanée', 'flacon de 125 ml', 'flacon', 'CONSOMMABLES', 2.5, 1.4],
  ['KV-PRESERV', 'Préservatifs masculins', null, null, 'dispositif', 'boîte de 3', 'boîte', 'CONSOMMABLES', 0.5, 0.2],
  ['KV-THERMO', 'Thermomètre digital', null, null, 'dispositif', 'à l’unité', 'pièce', 'DIAGNOSTIC', 2.5, 1.3, 'N'],
  ['KV-TDR-PALU', 'Test de diagnostic rapide du paludisme', null, null, 'test rapide', 'à l’unité', 'test', 'DIAGNOSTIC', 1.0, 0.5],
];

export const CATALOGUE_REFERENCE: ProduitReference[] = LIGNES.map(
  ([code, name, inn, dosage, dosageForm, packaging, unit, categoryCode, salePrice, costPrice, reperes = '']) => ({
    code, name, inn, dosage, dosageForm, packaging, unit, categoryCode, salePrice, costPrice,
    requiresPrescription: reperes.includes('O'),
    isControlled: reperes.includes('S'),
    isColdChain: reperes.includes('F'),
    hasExpiry: !reperes.includes('N'),
  }),
);
