-- =====================================================================
-- NOVA PHARMA OS — 033 : alertes d'interactions médicamenteuses
--
-- Les bases d'interactions complètes sont payantes. NOVA fournit le
-- mécanisme, gratuit : une liste de référence tenue par le back-office
-- (importable en CSV), des classes thérapeutiques (AINS, antivitamines K,
-- statines…), et l'alerte à la caisse quand deux médicaments du ticket —
-- ou un médicament et un traitement suivi du patient — interagissent.
--
-- La liste de départ ci-dessous est volontairement courte : quelques
-- associations très documentées, classées selon les niveaux du Thésaurus
-- des interactions médicamenteuses de l'ANSM. Elle n'est pas exhaustive ;
-- un pharmacien doit la valider et la compléter. L'alerte ne bloque
-- jamais la vente : elle informe le pharmacien, qui décide.
--
-- Les substances sont écrites en minuscules, sans accents (DCI française).
-- =====================================================================

CREATE TABLE drug_classes (
  code                text PRIMARY KEY CHECK (code ~ '^[a-z0-9_]+$'),
  label               text NOT NULL,
  members             text[] NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drug_interactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Substance (« warfarine ») ou classe (« classe:ains »).
  term_a              text NOT NULL,
  term_b              text NOT NULL,
  severity            text NOT NULL CHECK (severity IN ('contre_indication', 'deconseillee', 'precaution', 'a_prendre_en_compte')),
  effect              text NOT NULL,
  advice              text,
  source              text,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (term_a <> term_b)
);
CREATE UNIQUE INDEX drug_interactions_paire_idx ON drug_interactions (LEAST(term_a, term_b), GREATEST(term_a, term_b));

SELECT nova.apply_reference_rls('drug_classes');
SELECT nova.apply_reference_rls('drug_interactions');
SELECT nova.attach_touch('drug_classes'::regclass);
SELECT nova.attach_touch('drug_interactions'::regclass);

INSERT INTO drug_classes (code, label, members) VALUES
  ('avk', 'Antivitamines K', ARRAY['warfarine', 'acenocoumarol', 'fluindione']),
  ('ains', 'Anti-inflammatoires non stéroïdiens', ARRAY['ibuprofene', 'diclofenac', 'naproxene', 'ketoprofene', 'piroxicam', 'indometacine', 'meloxicam', 'celecoxib']),
  ('derives_nitres', 'Dérivés nitrés', ARRAY['trinitrine', 'isosorbide', 'nicorandil']),
  ('ipde5', 'Inhibiteurs de la phosphodiestérase de type 5', ARRAY['sildenafil', 'tadalafil', 'vardenafil']),
  ('macrolides_inhibiteurs', 'Macrolides inhibiteurs enzymatiques', ARRAY['clarithromycine', 'erythromycine']),
  ('azoles_inhibiteurs', 'Antifongiques azolés inhibiteurs enzymatiques', ARRAY['itraconazole', 'ketoconazole', 'posaconazole', 'voriconazole']),
  ('iec_ara2', 'IEC et antagonistes de l''angiotensine II', ARRAY['captopril', 'enalapril', 'lisinopril', 'ramipril', 'perindopril', 'losartan', 'valsartan', 'irbesartan', 'candesartan']),
  ('epargneurs_potassium', 'Diurétiques épargneurs de potassium', ARRAY['spironolactone', 'amiloride', 'triamterene', 'eplerenone']),
  ('thiazidiques', 'Diurétiques thiazidiques', ARRAY['hydrochlorothiazide', 'indapamide', 'chlortalidone']),
  ('fluoroquinolones', 'Fluoroquinolones', ARRAY['ciprofloxacine', 'levofloxacine', 'norfloxacine', 'ofloxacine', 'moxifloxacine']),
  ('cyclines', 'Cyclines', ARRAY['doxycycline', 'tetracycline', 'minocycline']),
  ('cations_digestifs', 'Fer, calcium, magnésium, aluminium, zinc (voie orale)', ARRAY['fer', 'sulfate ferreux', 'fumarate ferreux', 'calcium', 'carbonate de calcium', 'magnesium', 'hydroxyde d''aluminium', 'zinc']),
  ('contraceptifs_oraux', 'Contraceptifs oraux hormonaux', ARRAY['ethinylestradiol', 'levonorgestrel', 'desogestrel', 'norethisterone']),
  ('inhibiteurs_protease', 'Inhibiteurs de protéase du VIH', ARRAY['lopinavir', 'atazanavir', 'darunavir', 'ritonavir']),
  ('ipp_cyp2c19', 'Inhibiteurs de la pompe à protons (oméprazole, ésoméprazole)', ARRAY['omeprazole', 'esomeprazole']);

INSERT INTO drug_interactions (term_a, term_b, severity, effect, advice, source) VALUES
  ('classe:avk', 'classe:ains', 'deconseillee', 'Augmentation du risque hémorragique.', 'Éviter l''association ; préférer le paracétamol comme antalgique. Si indispensable : surveillance clinique et INR.', 'Thésaurus ANSM'),
  ('classe:avk', 'acide acetylsalicylique', 'deconseillee', 'Augmentation du risque hémorragique (doses antalgiques, antipyrétiques ou anti-inflammatoires).', 'Préférer le paracétamol. À doses antiagrégantes : avis médical et surveillance.', 'Thésaurus ANSM'),
  ('classe:avk', 'miconazole', 'contre_indication', 'Hémorragies imprévisibles, parfois graves (miconazole par voie générale et gel buccal).', 'Ne pas associer ; orienter vers le prescripteur.', 'Thésaurus ANSM'),
  ('classe:avk', 'fluconazole', 'precaution', 'Augmentation de l''effet de l''antivitamine K et du risque hémorragique.', 'Contrôle de l''INR ; adaptation de la dose de l''antivitamine K par le médecin.', 'Thésaurus ANSM'),
  ('classe:avk', 'metronidazole', 'precaution', 'Augmentation de l''effet de l''antivitamine K et du risque hémorragique.', 'Contrôle plus fréquent de l''INR pendant le traitement et après son arrêt.', 'Thésaurus ANSM'),
  ('classe:avk', 'sulfamethoxazole', 'precaution', 'Augmentation de l''effet de l''antivitamine K et du risque hémorragique (cotrimoxazole).', 'Contrôle de l''INR pendant le traitement et après son arrêt.', 'Thésaurus ANSM'),
  ('methotrexate', 'trimethoprime', 'deconseillee', 'Augmentation de la toxicité hématologique du méthotrexate (cotrimoxazole compris).', 'Éviter l''association ; avis du prescripteur.', 'Thésaurus ANSM'),
  ('methotrexate', 'classe:ains', 'precaution', 'Augmentation de la toxicité hématologique du méthotrexate (diminution de son élimination rénale).', 'Selon la dose de méthotrexate : association déconseillée à forte dose ; surveillance de l''hémogramme et de la fonction rénale.', 'Thésaurus ANSM'),
  ('classe:ipde5', 'classe:derives_nitres', 'contre_indication', 'Risque d''hypotension importante, pouvant aggraver une ischémie myocardique.', 'Ne jamais associer.', 'Thésaurus ANSM'),
  ('simvastatine', 'classe:macrolides_inhibiteurs', 'contre_indication', 'Risque majoré d''effets indésirables musculaires, notamment de rhabdomyolyse.', 'Ne pas associer ; suspendre la statine pendant l''antibiotique sur avis médical, ou choisir un autre antibiotique.', 'Thésaurus ANSM'),
  ('simvastatine', 'classe:azoles_inhibiteurs', 'contre_indication', 'Risque majoré d''effets indésirables musculaires, notamment de rhabdomyolyse.', 'Ne pas associer.', 'Thésaurus ANSM'),
  ('rifampicine', 'classe:contraceptifs_oraux', 'deconseillee', 'Diminution de l''efficacité contraceptive (induction enzymatique).', 'Utiliser une autre méthode de contraception pendant le traitement et un cycle après.', 'Thésaurus ANSM'),
  ('rifampicine', 'nevirapine', 'deconseillee', 'Diminution des concentrations de névirapine (induction enzymatique).', 'Avis du médecin prescripteur des antirétroviraux.', 'Thésaurus ANSM'),
  ('rifampicine', 'classe:inhibiteurs_protease', 'contre_indication', 'Forte diminution des concentrations de l''inhibiteur de protéase, risque d''échec du traitement antirétroviral.', 'Ne pas associer ; orienter vers le prescripteur.', 'Thésaurus ANSM'),
  ('carbamazepine', 'classe:contraceptifs_oraux', 'deconseillee', 'Diminution de l''efficacité contraceptive (induction enzymatique).', 'Utiliser une autre méthode de contraception.', 'Thésaurus ANSM'),
  ('classe:iec_ara2', 'classe:epargneurs_potassium', 'deconseillee', 'Risque d''hyperkaliémie, potentiellement létale (en dehors de situations encadrées, comme certaines insuffisances cardiaques).', 'Avis du prescripteur ; contrôle de la kaliémie.', 'Thésaurus ANSM'),
  ('classe:iec_ara2', 'chlorure de potassium', 'deconseillee', 'Risque d''hyperkaliémie (sels de potassium).', 'Éviter, sauf hypokaliémie documentée ; contrôle de la kaliémie.', 'Thésaurus ANSM'),
  ('lithium', 'classe:ains', 'deconseillee', 'Augmentation de la lithémie, pouvant atteindre des valeurs toxiques.', 'Si indispensable : surveillance de la lithémie et adaptation de la dose.', 'Thésaurus ANSM'),
  ('lithium', 'classe:thiazidiques', 'deconseillee', 'Augmentation de la lithémie avec signes de surdosage.', 'Si indispensable : surveillance de la lithémie.', 'Thésaurus ANSM'),
  ('classe:fluoroquinolones', 'classe:cations_digestifs', 'precaution', 'Diminution de l''absorption digestive de la fluoroquinolone.', 'Prendre les sels de fer, calcium, magnésium ou aluminium à distance (plus de 2 heures si possible).', 'Thésaurus ANSM'),
  ('classe:cyclines', 'classe:cations_digestifs', 'precaution', 'Diminution de l''absorption digestive de la cycline.', 'Prendre à distance (plus de 2 heures si possible).', 'Thésaurus ANSM'),
  ('clopidogrel', 'classe:ipp_cyp2c19', 'deconseillee', 'Diminution de l''effet antiagrégant du clopidogrel.', 'Préférer un autre inhibiteur de la pompe à protons (pantoprazole par exemple) ; avis médical.', 'Thésaurus ANSM'),
  ('allopurinol', 'azathioprine', 'deconseillee', 'Insuffisance médullaire éventuellement grave (accumulation de l''azathioprine).', 'Avis du prescripteur ; si associé, réduction de dose et surveillance de l''hémogramme.', 'Thésaurus ANSM');
