import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { Feuille, classeur } from '../../../common/excel/classeur';
import { RequestContext } from '../../../common/database/request-context';

/** Rubriques du rapport mensuel de gestion des stocks (noms des colonnes OpenLMIS en regard). */
export const RUBRIQUES: Record<string, { libelle: string; openlmis: string }> = {
  opening: { libelle: 'Stock initial', openlmis: 'beginningBalance' },
  received: { libelle: 'Quantités reçues', openlmis: 'totalReceivedQuantity' },
  consumed: { libelle: 'Quantités consommées', openlmis: 'totalConsumedQuantity' },
  losses: { libelle: 'Pertes (péremption, casse)', openlmis: 'totalLossesAndAdjustments (pertes)' },
  adjustments: { libelle: 'Ajustements (inventaire, transferts, retours)', openlmis: 'totalLossesAndAdjustments (ajustements)' },
  closing: { libelle: 'Stock final', openlmis: 'stockOnHand' },
  stockoutDays: { libelle: 'Jours de rupture', openlmis: 'totalStockoutDays' },
  amc: { libelle: 'Consommation moyenne mensuelle', openlmis: 'averageConsumption' },
  requested: { libelle: 'Quantité à commander', openlmis: 'requestedQuantity' },
};
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/;

type Correspondance = Record<string, { de: string; coc?: string }>;

export interface LigneRapport {
  productId: string;
  sku: string;
  nationalCode: string | null;
  product: string;
  unit: string;
  opening: number; received: number; consumed: number; losses: number; adjustments: number;
  closing: number; stockoutDays: number; amc: number; requested: number;
  mapped: boolean;
  dhis2: Correspondance;
}

interface Reglages {
  facilityCode: string | null;
  dhis2OrgUnit: string | null;
  dhis2DataSet: string | null;
  maxMonths: number;
}

const arrondi = (v: number) => Math.round(v * 1000) / 1000;

@Injectable()
export class RapportsPublicsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // --- Réglages et correspondances --------------------------------------

  private async lireReglages(tx: Tx): Promise<Reglages> {
    const r = await tx.one<{ facility_code: string | null; dhis2_org_unit: string | null; dhis2_data_set: string | null; max_months: string }>(
      'SELECT facility_code, dhis2_org_unit, dhis2_data_set, max_months FROM public_report_settings LIMIT 1',
    );
    return {
      facilityCode: r?.facility_code ?? null,
      dhis2OrgUnit: r?.dhis2_org_unit ?? null,
      dhis2DataSet: r?.dhis2_data_set ?? null,
      maxMonths: r ? Number(r.max_months) : 3,
    };
  }

  async reglages(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) => this.lireReglages(tx));
  }

  async reglerReglages(ctx: RequestContext, dto: Partial<Reglages>) {
    for (const cle of ['dhis2OrgUnit', 'dhis2DataSet'] as const) {
      const v = dto[cle]?.trim();
      if (v && !UID.test(v)) throw new BadRequestException('Un identifiant DHIS2 compte 11 caractères (lettres et chiffres, commençant par une lettre).');
    }
    return this.db.transaction(ctx, async (tx) => {
      const avant = await this.lireReglages(tx);
      const texte = (v: string | null | undefined, defaut: string | null) => (v === undefined ? defaut : (v?.trim() || null));
      const apres: Reglages = {
        facilityCode: texte(dto.facilityCode, avant.facilityCode),
        dhis2OrgUnit: texte(dto.dhis2OrgUnit, avant.dhis2OrgUnit),
        dhis2DataSet: texte(dto.dhis2DataSet, avant.dhis2DataSet),
        maxMonths: dto.maxMonths ?? avant.maxMonths,
      };
      await tx.query(
        `INSERT INTO public_report_settings (organization_id, facility_code, dhis2_org_unit, dhis2_data_set, max_months)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (organization_id) DO UPDATE SET facility_code = EXCLUDED.facility_code, dhis2_org_unit = EXCLUDED.dhis2_org_unit,
           dhis2_data_set = EXCLUDED.dhis2_data_set, max_months = EXCLUDED.max_months`,
        [ctx.organizationId, apres.facilityCode, apres.dhis2OrgUnit, apres.dhis2DataSet, apres.maxMonths],
      );
      await this.audit.record(tx, { action: 'public_reports.settings.updated', entity: 'public_report_settings', entityId: ctx.organizationId as string, before: avant, after: apres });
      return apres;
    });
  }

  private verifierCorrespondance(dhis2: Correspondance) {
    for (const [rubrique, v] of Object.entries(dhis2)) {
      if (!RUBRIQUES[rubrique]) throw new BadRequestException(`Rubrique inconnue : « ${rubrique} ».`);
      if (!v || !UID.test(v.de ?? '') || (v.coc && !UID.test(v.coc))) {
        throw new BadRequestException(`Identifiant DHIS2 invalide pour « ${RUBRIQUES[rubrique].libelle} » (11 caractères, commençant par une lettre).`);
      }
    }
  }

  async correspondances(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT m.product_id, p.sku, p.name, p.dosage, m.national_code, m.dhis2
           FROM public_report_mappings m JOIN products p ON p.id = m.product_id
          ORDER BY p.name`,
      ),
    );
  }

  private async ecrireCorrespondance(tx: Tx, ctx: RequestContext, productId: string, nationalCode: string | null, dhis2: Correspondance) {
    const avant = await tx.one<{ national_code: string | null; dhis2: Correspondance }>(
      'SELECT national_code, dhis2 FROM public_report_mappings WHERE product_id = $1', [productId],
    );
    if (!nationalCode && !Object.keys(dhis2).length) {
      await tx.query('DELETE FROM public_report_mappings WHERE product_id = $1', [productId]);
    } else {
      await tx.query(
        `INSERT INTO public_report_mappings (organization_id, product_id, national_code, dhis2) VALUES ($1,$2,$3,$4)
         ON CONFLICT (organization_id, product_id) DO UPDATE SET national_code = EXCLUDED.national_code, dhis2 = EXCLUDED.dhis2`,
        [ctx.organizationId, productId, nationalCode, JSON.stringify(dhis2)],
      );
    }
    await this.audit.record(tx, { action: 'public_reports.mapping.updated', entity: 'product', entityId: productId, before: avant ?? null, after: { national_code: nationalCode, dhis2 } });
    return !avant;
  }

  async reglerCorrespondance(ctx: RequestContext, productId: string, dto: { nationalCode?: string | null; dhis2?: Correspondance }) {
    const dhis2 = dto.dhis2 ?? {};
    this.verifierCorrespondance(dhis2);
    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail('SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL', [productId]);
      await this.ecrireCorrespondance(tx, ctx, productId, dto.nationalCode?.trim() || null, dhis2);
      return tx.one('SELECT product_id, national_code, dhis2 FROM public_report_mappings WHERE product_id = $1', [productId])
        .then((r) => r ?? { product_id: productId, national_code: null, dhis2: {} });
    });
  }

  /**
   * Import des correspondances, une ligne par produit et par rubrique :
   * `reference_nova;code_national;rubrique;data_element;category_option_combo`.
   * La rubrique et les identifiants DHIS2 peuvent rester vides (code national seul).
   */
  async importer(ctx: RequestContext, csv: string) {
    const lignes = csv.split(/\r?\n/).map((l) => l.trim());
    const erreurs: { line: number; message: string }[] = [];
    const parProduit = new Map<string, { nationalCode: string | null; dhis2: Correspondance }>();
    return this.db.transaction(ctx, async (tx) => {
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        if (!l || (i === 0 && /^reference/i.test(l))) continue;
        const [sku = '', code = '', rubrique = '', de = '', coc = ''] = l.split(';').map((c) => c.trim());
        const produit = await tx.one<{ id: string }>('SELECT id FROM products WHERE lower(sku) = lower($1) AND deleted_at IS NULL LIMIT 1', [sku]);
        if (!produit) { erreurs.push({ line: i + 1, message: `Référence NOVA inconnue : « ${sku} ».` }); continue; }
        const cle = rubrique ? Object.keys(RUBRIQUES).find((k) => k.toLowerCase() === rubrique.toLowerCase()) : undefined;
        if (rubrique && !cle) { erreurs.push({ line: i + 1, message: `Rubrique inconnue : « ${rubrique} ».` }); continue; }
        if (cle && (!UID.test(de) || (coc && !UID.test(coc)))) { erreurs.push({ line: i + 1, message: 'Identifiant DHIS2 invalide (11 caractères, commençant par une lettre).' }); continue; }
        if (!parProduit.has(produit.id)) {
          const existant = await tx.one<{ national_code: string | null; dhis2: Correspondance }>(
            'SELECT national_code, dhis2 FROM public_report_mappings WHERE product_id = $1', [produit.id],
          );
          parProduit.set(produit.id, { nationalCode: existant?.national_code ?? null, dhis2: { ...(existant?.dhis2 ?? {}) } });
        }
        const c = parProduit.get(produit.id)!;
        if (code) c.nationalCode = code;
        if (cle) c.dhis2[cle] = coc ? { de, coc } : { de };
      }
      let ajoutes = 0;
      for (const [id, c] of parProduit) if (await this.ecrireCorrespondance(tx, ctx, id, c.nationalCode, c.dhis2)) ajoutes++;
      return { products: parProduit.size, added: ajoutes, updated: parProduit.size - ajoutes, errors: erreurs };
    });
  }

  // --- Rapport mensuel ---------------------------------------------------

  private verifierMois(mois?: string) {
    if (!mois) {
      const d = new Date();
      d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 7);
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) throw new BadRequestException('Mois attendu au format AAAA-MM.');
    return mois;
  }

  /**
   * Rapport mensuel calculé depuis le registre des mouvements de stock, dans le
   * fuseau horaire de la pharmacie. Stock final = stock initial + reçu −
   * consommé − pertes + ajustements : la ligne est toujours équilibrée, car
   * chaque mouvement entre dans exactement une rubrique.
   */
  async rapport(ctx: RequestContext, p: { month?: string; branchId?: string; mappedOnly?: boolean } = {}) {
    const mois = this.verifierMois(p.month);
    return this.db.readTransaction(ctx, async (tx) => {
      const reglages = await this.lireReglages(tx);
      const entete = await tx.oneOrFail<{ name: string; tz: string; city: string | null; branch: string | null; debut: string; fin: string; partiel: boolean }>(
        `SELECT COALESCE(o.trade_name, o.legal_name) AS name, o.timezone AS tz, o.city,
                (SELECT b.name FROM branches b WHERE b.id = $3::uuid) AS branch,
                to_char($2::date, 'YYYY-MM-DD') AS debut,
                to_char(($2::date + interval '1 month' - interval '1 day')::date, 'YYYY-MM-DD') AS fin,
                ($2::date + interval '1 month')::date > (now() AT TIME ZONE o.timezone)::date AS partiel
           FROM organizations o WHERE o.id = $1`,
        [ctx.organizationId, `${mois}-01`, p.branchId ?? null],
      );
      if (p.branchId && !entete.branch) throw new BadRequestException('Agence inconnue.');
      const lignes = await tx.many<{
        product_id: string; sku: string; name: string; dosage: string | null; unit: string; national_code: string | null; dhis2: Correspondance | null;
        opening: string; received: string; consumed: string; losses: string; adjustments: string; closing: string; consumed_3m: string; stockout_days: string;
      }>(
        `WITH b AS (
           SELECT o.timezone AS tz,
                  ($2::date)::timestamp AT TIME ZONE o.timezone AS debut,
                  ($2::date + interval '1 month')::timestamp AT TIME ZONE o.timezone AS fin,
                  ($2::date - interval '2 month')::timestamp AT TIME ZONE o.timezone AS debut_cmm,
                  LEAST(($2::date + interval '1 month' - interval '1 day')::date, (now() AT TIME ZONE o.timezone)::date) AS dernier_jour
             FROM organizations o WHERE o.id = $1
         ),
         mv AS (
           SELECT m.product_id, m.kind::text AS kind, m.quantity, m.occurred_at
             FROM stock_movements m, b
            WHERE m.occurred_at < b.fin AND ($3::uuid IS NULL OR m.branch_id = $3)
         ),
         agg AS (
           SELECT mv.product_id,
                  COALESCE(sum(quantity) FILTER (WHERE occurred_at < b.debut), 0) AS opening,
                  COALESCE(sum(quantity) FILTER (WHERE occurred_at >= b.debut AND kind = 'reception'), 0) AS received,
                  -COALESCE(sum(quantity) FILTER (WHERE occurred_at >= b.debut AND kind IN ('sale', 'sale_return')), 0) AS consumed,
                  -COALESCE(sum(quantity) FILTER (WHERE occurred_at >= b.debut AND kind IN ('expiry_write_off', 'damage')), 0) AS losses,
                  COALESCE(sum(quantity) FILTER (WHERE occurred_at >= b.debut
                    AND kind NOT IN ('reception', 'sale', 'sale_return', 'expiry_write_off', 'damage')), 0) AS adjustments,
                  sum(quantity) AS closing,
                  -COALESCE(sum(quantity) FILTER (WHERE occurred_at >= b.debut_cmm AND kind IN ('sale', 'sale_return')), 0) AS consumed_3m
             FROM mv, b GROUP BY mv.product_id
         ),
         jours AS (
           SELECT generate_series(($2::date), b.dernier_jour, interval '1 day')::date AS jour FROM b
         ),
         quotidien AS (
           SELECT mv.product_id, (mv.occurred_at AT TIME ZONE b.tz)::date AS jour, sum(mv.quantity) AS q
             FROM mv, b WHERE mv.occurred_at >= b.debut GROUP BY 1, 2
         ),
         soldes AS (
           SELECT a.product_id,
                  a.opening + COALESCE(sum(q.q) OVER (PARTITION BY a.product_id ORDER BY j.jour), 0) AS solde
             FROM agg a CROSS JOIN jours j
             LEFT JOIN quotidien q ON q.product_id = a.product_id AND q.jour = j.jour
         ),
         ruptures AS (
           SELECT product_id, count(*) FILTER (WHERE solde <= 0) AS jours FROM soldes GROUP BY product_id
         )
         SELECT p.id AS product_id, p.sku, p.name, p.dosage, p.unit, m.national_code, m.dhis2,
                a.opening, a.received, a.consumed, a.losses, a.adjustments, a.closing, a.consumed_3m,
                COALESCE(r.jours, 0) AS stockout_days
           FROM agg a
           JOIN products p ON p.id = a.product_id
           LEFT JOIN public_report_mappings m ON m.product_id = p.id
           LEFT JOIN ruptures r ON r.product_id = p.id
          WHERE p.deleted_at IS NULL
            AND (p.is_active OR a.closing <> 0 OR a.consumed <> 0 OR a.received <> 0)
            AND (NOT $4::boolean OR m.product_id IS NOT NULL)
          ORDER BY p.name`,
        [ctx.organizationId, `${mois}-01`, p.branchId ?? null, p.mappedOnly ?? false],
      );
      const rows: LigneRapport[] = lignes.map((l) => {
        const amc = arrondi(Math.max(0, Number(l.consumed_3m)) / 3);
        const closing = arrondi(Number(l.closing));
        return {
          productId: l.product_id,
          sku: l.sku,
          nationalCode: l.national_code,
          product: l.dosage && !l.name.toLowerCase().includes(l.dosage.toLowerCase()) ? `${l.name} ${l.dosage}` : l.name,
          unit: l.unit,
          opening: arrondi(Number(l.opening)),
          received: arrondi(Number(l.received)),
          consumed: arrondi(Number(l.consumed)),
          losses: arrondi(Number(l.losses)),
          adjustments: arrondi(Number(l.adjustments)),
          closing,
          stockoutDays: Number(l.stockout_days),
          amc,
          requested: Math.max(0, Math.ceil(amc * reglages.maxMonths - closing)),
          mapped: !!l.national_code || Object.keys(l.dhis2 ?? {}).length > 0,
          dhis2: l.dhis2 ?? {},
        };
      });
      return {
        month: mois,
        period: { start: entete.debut, end: entete.fin, partial: entete.partiel },
        facility: { name: entete.name, city: entete.city, branch: entete.branch, code: reglages.facilityCode },
        settings: reglages,
        rows,
      };
    });
  }

  /** Classeur Excel : en-tête du rapport, puis une ligne par produit (colonnes OpenLMIS en regard). */
  async classeur(ctx: RequestContext, p: { month?: string; branchId?: string; mappedOnly?: boolean } = {}) {
    const r = await this.rapport(ctx, p);
    const entete = [
      `${r.facility.name}${r.facility.branch ? ` — ${r.facility.branch}` : ''} — Rapport mensuel de gestion des stocks`,
      `Période : ${r.period.start} au ${r.period.end}${r.period.partial ? ' (mois en cours, partiel)' : ''}` +
        `${r.facility.code ? ` · Code de la structure : ${r.facility.code}` : ''} · Stock maximum : ${r.settings.maxMonths} mois de consommation`,
    ];
    const champs = Object.keys(RUBRIQUES);
    const feuilles: Feuille[] = [{
      nom: 'Rapport mensuel', entete,
      colonnes: [
        { titre: 'Code national', largeur: 16 }, { titre: 'Référence NOVA', largeur: 14 }, { titre: 'Produit', largeur: 36 }, { titre: 'Unité', largeur: 10 },
        ...champs.map((c) => ({ titre: RUBRIQUES[c].libelle, type: 'nombre' as const })),
      ],
      lignes: r.rows.map((l) => [l.nationalCode ?? '', l.sku, l.product, l.unit, ...champs.map((c) => (l as unknown as Record<string, number>)[c])]),
    }, {
      nom: 'Rubriques',
      entete: ['Correspondance des rubriques avec les champs de la réquisition OpenLMIS (base de LOGIMEV)'],
      colonnes: [{ titre: 'Rubrique NOVA', largeur: 26 }, { titre: 'Libellé', largeur: 44 }, { titre: 'Champ OpenLMIS', largeur: 40 }],
      lignes: champs.map((c) => [c, RUBRIQUES[c].libelle, RUBRIQUES[c].openlmis]),
    }];
    return { fichier: classeur(feuilles), mois: r.month };
  }

  /**
   * Fichier DHIS2 « dataValueSets » (JSON), à importer dans l'application
   * Import/Export de DHIS2. Seules les rubriques reliées à un élément de
   * données sont exportées ; ce qui manque est signalé.
   */
  async dhis2(ctx: RequestContext, p: { month?: string; branchId?: string } = {}) {
    const r = await this.rapport(ctx, { ...p, mappedOnly: true });
    if (!r.settings.dhis2OrgUnit) throw new BadRequestException('Renseignez d’abord l’identifiant DHIS2 de votre structure (unité d’organisation).');
    const dataValues: { dataElement: string; period: string; orgUnit: string; categoryOptionCombo?: string; value: string }[] = [];
    const sansCorrespondance: string[] = [];
    for (const l of r.rows) {
      const rubriques = Object.entries(l.dhis2);
      if (!rubriques.length) { sansCorrespondance.push(l.product); continue; }
      for (const [rubrique, cible] of rubriques) {
        const valeur = (l as unknown as Record<string, number>)[rubrique];
        dataValues.push({
          dataElement: cible.de,
          period: r.month.replace('-', ''),
          orgUnit: r.settings.dhis2OrgUnit,
          ...(cible.coc ? { categoryOptionCombo: cible.coc } : {}),
          value: String(valeur),
        });
      }
    }
    return {
      fichier: {
        ...(r.settings.dhis2DataSet ? { dataSet: r.settings.dhis2DataSet } : {}),
        completeDate: r.period.partial ? undefined : r.period.end,
        period: r.month.replace('-', ''),
        orgUnit: r.settings.dhis2OrgUnit,
        dataValues,
      },
      mois: r.month,
      partiel: r.period.partial,
      sansCorrespondance,
    };
  }
}
