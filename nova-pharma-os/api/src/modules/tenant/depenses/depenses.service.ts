import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { Taux, arrondi2, convertir, dernierTaux, mouvementCaisse } from '../cash/devises';

export const CATEGORIES_DEPENSE: Record<string, string> = {
  loyer: 'Loyer',
  salaires: 'Salaires et primes',
  electricite: 'Électricité (SNEL)',
  eau: 'Eau (REGIDESO)',
  carburant: 'Carburant du groupe électrogène',
  transport: 'Transport et livraisons',
  telephone_internet: 'Téléphone et Internet',
  impots_taxes: 'Impôts et taxes',
  entretien: 'Entretien et réparations',
  fournitures: 'Fournitures et emballages',
  publicite: 'Publicité',
  frais_bancaires: 'Frais bancaires',
  frais_mobile_money: 'Frais Mobile Money',
  honoraires: 'Honoraires (comptable, avocat…)',
  assurance: 'Assurances',
  autre: 'Autres dépenses',
};

export interface DepenseInput {
  expenseDate?: string;
  category: string;
  label: string;
  supplierName?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  vatAmount?: number;
  normalizedInvoice?: boolean;
  normalizedReference?: string;
  paymentMethod?: string;
  fromCash?: boolean;
  notes?: string;
}

/** Premier et dernier jour d'un mois « AAAA-MM ». */
function bornesMois(mois: string): { debut: string; fin: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) throw new BusinessRuleException(`Mois invalide : « ${mois} » (attendu AAAA-MM).`);
  const [a, m] = mois.split('-').map(Number);
  const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(fin).padStart(2, '0')}` };
}

function moisPrecedent(mois: string, n = 1): string {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Jour d'un instant au fuseau de la pharmacie. */
const JOUR = (colonne: string, alias: string) =>
  `(${alias}.${colonne} AT TIME ZONE (SELECT o.timezone FROM organizations o WHERE o.id = ${alias}.organization_id))::date`;

/**
 * Dépenses de la pharmacie et bénéfice réel : la marge des ventes, moins
 * les pertes de stock, les points de fidélité utilisés et les dépenses.
 */
@Injectable()
export class DepensesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  private async lireReglages(tx: Tx) {
    const r = await tx.one<{ vat_registered: boolean; def_number: string | null }>('SELECT vat_registered, def_number FROM finance_settings LIMIT 1');
    return { vatRegistered: r?.vat_registered ?? false, defNumber: r?.def_number ?? null };
  }

  async reglages(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) => this.lireReglages(tx));
  }

  async reglerReglages(ctx: RequestContext, dto: { vatRegistered?: boolean; defNumber?: string | null }) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await this.lireReglages(tx);
      const apres = {
        vatRegistered: dto.vatRegistered ?? avant.vatRegistered,
        defNumber: dto.defNumber === undefined ? avant.defNumber : (dto.defNumber?.trim() || null),
      };
      await tx.query(
        `INSERT INTO finance_settings (organization_id, vat_registered, def_number) VALUES ($1,$2,$3)
         ON CONFLICT (organization_id) DO UPDATE SET vat_registered = EXCLUDED.vat_registered, def_number = EXCLUDED.def_number`,
        [ctx.organizationId, apres.vatRegistered, apres.defNumber],
      );
      await this.audit.record(tx, { action: 'finance.settings.updated', entity: 'finance_settings', entityId: ctx.organizationId as string, before: avant, after: apres });
      return apres;
    });
  }

  async liste(ctx: RequestContext, q: { from?: string; to?: string; category?: string; includeCancelled?: boolean }) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT e.*, u.full_name AS created_by_name
           FROM expenses e LEFT JOIN users u ON u.id = e.created_by
          WHERE ($1::date IS NULL OR e.expense_date >= $1)
            AND ($2::date IS NULL OR e.expense_date <= $2)
            AND ($3::text IS NULL OR e.category = $3)
            AND ($4 OR e.cancelled_at IS NULL)
          ORDER BY e.expense_date DESC, e.created_at DESC
          LIMIT 500`,
        [q.from ?? null, q.to ?? null, q.category ?? null, q.includeCancelled ?? false],
      ),
    );
  }

  async creer(ctx: RequestContext, dto: DepenseInput) {
    if (!CATEGORIES_DEPENSE[dto.category]) throw new BusinessRuleException('Catégorie de dépense inconnue.');
    return this.db.transaction(ctx, async (tx) => {
      const org = await tx.oneOrFail<{ currency: string; aujourdhui: string }>(
        `SELECT currency, to_char((now() AT TIME ZONE timezone)::date, 'YYYY-MM-DD') AS aujourdhui
           FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      );
      const date = dto.expenseDate ?? org.aujourdhui;
      if (date > org.aujourdhui) throw new BusinessRuleException('Une dépense ne peut pas être datée dans le futur.');
      const devise = dto.currency ?? org.currency;

      // Contre-valeur dans la devise de la pharmacie : au taux saisi, ou au
      // dernier taux du jour fixé dans Caisse.
      let montantBase = dto.amount;
      let tauxUtilise: number | null = null;
      if (devise !== org.currency) {
        const connu = await dernierTaux(tx, org.currency, devise);
        if (!connu && !dto.exchangeRate) {
          throw new BusinessRuleException(`Aucun taux entre ${org.currency} et ${devise} : saisissez le taux ou fixez le taux du jour dans Caisse.`);
        }
        const taux: Taux = connu
          ? { ...connu, rate: String(dto.exchangeRate ?? connu.rate) }
          : { id: '', base_currency: org.currency, quote_currency: devise, rate: String(dto.exchangeRate), change_rounding: '0', created_at: '' };
        montantBase = arrondi2(convertir(dto.amount, devise, org.currency, taux));
        tauxUtilise = Number(taux.rate);
      }
      const tva = arrondi2(dto.vatAmount ?? 0);
      if (tva >= montantBase) throw new BusinessRuleException('La TVA doit être inférieure au montant payé.');
      if (dto.normalizedInvoice && !dto.normalizedReference?.trim()) {
        throw new BusinessRuleException('Indiquez la référence de la facture normalisée (numéro ou code du dispositif fiscal).');
      }

      // Payée en espèces depuis la caisse ouverte : la sortie apparaît dans la caisse.
      let session: { id: string; currency: string } | null = null;
      const methode = dto.paymentMethod ?? 'cash';
      if (dto.fromCash) {
        if (methode !== 'cash') throw new BusinessRuleException('Seule une dépense payée en espèces sort de la caisse.');
        if (!ctx.branchId) throw new BusinessRuleException('Aucune branche sélectionnée.');
        session = await tx.one<{ id: string; currency: string }>(
          `SELECT id, currency FROM cash_sessions WHERE branch_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
          [ctx.branchId],
        );
        if (!session) throw new BusinessRuleException("Aucune caisse ouverte : la dépense ne peut pas sortir de la caisse.");
        if (date !== org.aujourdhui) throw new BusinessRuleException("Une sortie de caisse se date d'aujourd'hui.");
      }

      const numero = await this.numbering.next(tx, 'expense');
      const d = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO expenses
           (organization_id, branch_id, number, expense_date, category, label, supplier_name,
            amount, currency, exchange_rate, amount_base, vat_amount, normalized_invoice, normalized_reference,
            payment_method, cash_session_id, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          ctx.organizationId, ctx.branchId ?? null, numero, date, dto.category, dto.label.trim(),
          dto.supplierName?.trim() || null, dto.amount, devise, tauxUtilise, montantBase, tva,
          dto.normalizedInvoice ?? false, dto.normalizedReference?.trim() || null, methode,
          session?.id ?? null, dto.notes?.trim() || null, ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      if (session) {
        await mouvementCaisse(tx, {
          organizationId: ctx.organizationId as string, sessionId: session.id, deviseSession: session.currency,
          devise, kind: 'expense', amount: -dto.amount, referenceKind: 'expense', referenceId: d.id,
          reason: `Dépense ${d.number} — ${dto.label.trim()}`, userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
        });
      }
      await this.audit.record(tx, { action: 'expenses.created', entity: 'expense', entityId: d.id, after: d });
      return d;
    });
  }

  /**
   * Annule une dépense saisie par erreur. Sortie d'une caisse encore
   * ouverte, l'argent y rentre ; si la caisse est clôturée, la clôture
   * reste telle qu'elle a été comptée.
   */
  async annuler(ctx: RequestContext, id: string, raison: string) {
    return this.db.transaction(ctx, async (tx) => {
      const d = await tx.oneOrFail<{ number: string; cancelled_at: string | null; cash_session_id: string | null; amount: string; currency: string }>(
        'SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [id], 'Dépense introuvable.',
      );
      if (d.cancelled_at) throw new BusinessRuleException('Cette dépense est déjà annulée.');
      let caisse = false;
      if (d.cash_session_id) {
        const s = await tx.one<{ id: string; currency: string; status: string }>('SELECT id, currency, status FROM cash_sessions WHERE id = $1', [d.cash_session_id]);
        if (s?.status === 'open') {
          await mouvementCaisse(tx, {
            organizationId: ctx.organizationId as string, sessionId: s.id, deviseSession: s.currency,
            devise: d.currency, kind: 'expense', amount: Number(d.amount), referenceKind: 'expense', referenceId: id,
            reason: `Annulation de la dépense ${d.number}`, userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
          });
          caisse = true;
        }
      }
      const apres = await tx.oneOrFail(
        'UPDATE expenses SET cancelled_at = now(), cancel_reason = $2 WHERE id = $1 RETURNING *', [id, raison.trim()],
      );
      await this.audit.record(tx, { action: 'expenses.cancelled', entity: 'expense', entityId: id, before: d, after: apres, reason: raison });
      return { expense: apres, cashReturned: caisse };
    });
  }

  /** Référence de la facture normalisée d'une vente (émise par le dispositif fiscal). */
  async referenceNormalisee(ctx: RequestContext, saleId: string, reference: string | null) {
    return this.db.transaction(ctx, async (tx) => {
      const s = await tx.oneOrFail<{ number: string; normalized_reference: string | null }>(
        'SELECT number, normalized_reference FROM sales WHERE id = $1', [saleId], 'Vente introuvable.',
      );
      const apres = await tx.oneOrFail(
        'UPDATE sales SET normalized_reference = $2 WHERE id = $1 RETURNING id, number, normalized_reference',
        [saleId, reference?.trim() || null],
      );
      await this.audit.record(tx, { action: 'sales.normalized_reference', entity: 'sale', entityId: saleId, before: s, after: apres });
      return apres;
    });
  }

  // ------------------------------------------------------------------
  // Bénéfice réel
  // ------------------------------------------------------------------

  private async resultat(tx: Tx, debut: string, fin: string, assujetti: boolean) {
    const ventes = await tx.oneOrFail<Record<string, string>>(
      `SELECT count(*) AS n, COALESCE(sum(s.total), 0) AS ttc, COALESCE(sum(s.tax_total), 0) AS tva,
              COALESCE(sum(s.cost_total), 0) AS cout, COALESCE(sum(s.margin_total), 0) AS marge,
              count(*) FILTER (WHERE s.normalized_reference IS NULL) AS sans_reference
         FROM sales s
        WHERE s.status = 'completed' AND ${JOUR('sold_at', 's')} BETWEEN $1::date AND $2::date`,
      [debut, fin],
    );
    const points = await tx.oneOrFail<{ v: string }>(
      `SELECT COALESCE(sum(p.amount), 0) AS v FROM sale_payments p JOIN sales s ON s.id = p.sale_id
        WHERE p.method = 'loyalty' AND s.status = 'completed' AND ${JOUR('sold_at', 's')} BETWEEN $1::date AND $2::date`,
      [debut, fin],
    );
    // Pertes de stock au coût d'achat : péremptions, casse, régularisations et écarts d'inventaire.
    const pertes = await tx.many<{ kind: string; v: string }>(
      `SELECT sm.kind::text AS kind, COALESCE(-sum(sm.quantity * sm.unit_cost), 0) AS v
         FROM stock_movements sm
        WHERE sm.kind IN ('expiry_write_off', 'damage', 'adjustment_out', 'adjustment_in', 'inventory')
          AND ${JOUR('occurred_at', 'sm')} BETWEEN $1::date AND $2::date
        GROUP BY sm.kind`,
      [debut, fin],
    );
    const depenses = await tx.many<{ category: string; n: string; ttc: string; tva_deductible: string }>(
      `SELECT category, count(*) AS n, sum(amount_base) AS ttc,
              COALESCE(sum(vat_amount) FILTER (WHERE normalized_invoice), 0) AS tva_deductible
         FROM expenses
        WHERE cancelled_at IS NULL AND expense_date BETWEEN $1::date AND $2::date
        GROUP BY category ORDER BY sum(amount_base) DESC`,
      [debut, fin],
    );
    const sansFacture = await tx.oneOrFail<{ n: string; v: string }>(
      `SELECT count(*) AS n, COALESCE(sum(vat_amount), 0) AS v FROM expenses
        WHERE cancelled_at IS NULL AND NOT normalized_invoice AND vat_amount > 0
          AND expense_date BETWEEN $1::date AND $2::date`,
      [debut, fin],
    );

    const pertesParType = Object.fromEntries(pertes.map((p) => [p.kind, arrondi2(Number(p.v))]));
    const totalPertes = arrondi2(pertes.reduce((s, p) => s + Number(p.v), 0));
    // Pour un assujetti, la TVA d'une facture normalisée se récupère : la
    // dépense compte hors taxe. Sans facture normalisée, la TVA est une charge.
    const lignesDepenses = depenses.map((d) => {
      const ttc = Number(d.ttc);
      const deductible = assujetti ? Number(d.tva_deductible) : 0;
      return {
        category: d.category, label: CATEGORIES_DEPENSE[d.category] ?? d.category, count: Number(d.n),
        amount: arrondi2(ttc), vatDeductible: arrondi2(deductible), cost: arrondi2(ttc - deductible),
      };
    });
    const totalDepenses = arrondi2(lignesDepenses.reduce((s, d) => s + d.cost, 0));
    const ttc = Number(ventes.ttc);
    const tva = Number(ventes.tva);
    const marge = Number(ventes.marge);
    const remisesPoints = arrondi2(Number(points.v));
    const benefice = arrondi2(marge - remisesPoints - totalPertes - totalDepenses);
    const tvaDeductible = arrondi2(lignesDepenses.reduce((s, d) => s + d.vatDeductible, 0));
    return {
      from: debut, to: fin,
      sales: { count: Number(ventes.n), revenue: arrondi2(ttc), vat: arrondi2(tva), revenueExclVat: arrondi2(ttc - tva), cost: arrondi2(Number(ventes.cout)), grossMargin: arrondi2(marge) },
      loyaltyRedeemed: remisesPoints,
      stockLosses: { total: totalPertes, byKind: pertesParType },
      expenses: { total: totalDepenses, byCategory: lignesDepenses },
      netProfit: benefice,
      netMarginPercent: ttc - tva > 0 ? arrondi2((100 * benefice) / (ttc - tva)) : 0,
      vat: assujetti
        ? {
            collected: arrondi2(tva), deductibleOnExpenses: tvaDeductible, balance: arrondi2(tva - tvaDeductible),
            expensesWithoutNormalizedInvoice: { count: Number(sansFacture.n), vat: arrondi2(Number(sansFacture.v)) },
            salesWithoutNormalizedReference: Number(ventes.sans_reference),
          }
        : null,
    };
  }

  /** Bénéfice réel d'un mois, comparé au précédent, avec les six derniers mois. */
  async benefice(ctx: RequestContext, mois?: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const org = await tx.oneOrFail<{ currency: string; mois: string }>(
        `SELECT currency, to_char(now() AT TIME ZONE timezone, 'YYYY-MM') AS mois FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      );
      const m = mois ?? org.mois;
      const { vatRegistered } = await this.lireReglages(tx);
      const { debut, fin } = bornesMois(m);
      const courant = await this.resultat(tx, debut, fin, vatRegistered);
      const prec = bornesMois(moisPrecedent(m));
      const precedent = await this.resultat(tx, prec.debut, prec.fin, vatRegistered);
      const serie = [];
      for (let i = 5; i >= 0; i--) {
        const mm = moisPrecedent(m, i);
        const b = bornesMois(mm);
        const r = i === 0 ? courant : i === 1 ? precedent : await this.resultat(tx, b.debut, b.fin, vatRegistered);
        serie.push({ month: mm, revenue: r.sales.revenue, grossMargin: r.sales.grossMargin, expenses: r.expenses.total, netProfit: r.netProfit });
      }
      return {
        month: m, currency: org.currency, vatRegistered, inProgress: m === org.mois,
        ...courant,
        previous: { month: moisPrecedent(m), netProfit: precedent.netProfit, grossMargin: precedent.sales.grossMargin, expenses: precedent.expenses.total },
        series: serie,
      };
    });
  }
}
