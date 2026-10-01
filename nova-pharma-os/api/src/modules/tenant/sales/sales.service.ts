import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import {
  Taux, arrondi2, arrondirMonnaie, convertir, mouvementCaisse, tauxPour,
} from '../cash/devises';
import { StockService } from '../inventory/stock.service';
import { PayersService, PriseEnCharge } from '../payers/payers.service';
import { FideliteService } from '../fidelite/fidelite.service';
import { TraitementsService } from '../traitements/traitements.service';
import { InvoicesService } from './invoices.service';
import {
  CancelSaleDto,
  CreateSaleDto,
  ListSalesDto,
  SaleLineDto,
} from './dto';

interface ResolvedProduct {
  id: string;
  sku: string;
  name: string;
  dosage: string | null;
  sale_price: string;
  wholesale_price: string;
  requires_prescription: boolean;
  is_batch_tracked: boolean;
  tax_rate: string;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly payers: PayersService,
    private readonly traitements: TraitementsService,
    private readonly fidelite: FideliteService,
  ) {}

  /**
   * Enregistre une vente au comptoir.
   *
   * Le déroulé est atomique : allocation FEFO des lots, écriture des
   * lignes, mouvements de stock, encaissements et mouvement de caisse
   * sont validés ensemble ou pas du tout. Une vente ne peut donc pas
   * exister sans avoir décrémenté le stock, ni l'inverse.
   */
  async create(ctx: RequestContext, dto: CreateSaleDto) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) {
      throw new BadRequestException(
        "Aucune branche sélectionnée : précisez branchId ou l'en-tête X-Branch-Id.",
      );
    }

    // Vente encaissée hors connexion : elle garde son heure réelle, dans
    // une fenêtre raisonnable.
    let soldAt: Date | null = null;
    if (dto.soldAt) {
      if (!dto.clientOperationId) {
        throw new BadRequestException('Une vente datée après coup exige clientOperationId.');
      }
      soldAt = new Date(dto.soldAt);
      const ecart = Date.now() - soldAt.getTime();
      if (ecart < -5 * 60_000 || ecart > 7 * 86_400_000) {
        throw new BusinessRuleException(
          'Heure de vente hors limites : une vente hors connexion doit être envoyée dans les 7 jours.',
          { soldAt: dto.soldAt },
        );
      }
    }

    return this.db.transaction(ctx, async (tx) => {
      // Rejeu d'une vente encaissée hors ligne : on renvoie l'existante.
      if (dto.clientOperationId) {
        const existing = await tx.one<{ id: string }>(
          'SELECT id FROM sales WHERE client_operation_id = $1',
          [dto.clientOperationId],
        );
        if (existing) {
          return { ...(await this.loadSale(tx, existing.id)), invoice: null, duplicate: true };
        }
      }

      const organizationId = ctx.organizationId as string;
      const currency = await this.currency(tx, organizationId);

      const session = await tx.one<{ id: string }>(
        `SELECT id FROM cash_sessions
          WHERE branch_id = $1 AND status = 'open'
          ORDER BY opened_at DESC LIMIT 1`,
        [branchId],
      );

      const customer = dto.customerId
        ? await tx.oneOrFail<{
            id: string; kind: string; name: string; credit_limit: string;
            outstanding_balance: string; is_credit_blocked: boolean;
            price_list_id: string | null;
          }>(
            'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
            [dto.customerId],
            'Client introuvable.',
          )
        : null;

      // Remise permanente de la catégorie du client (personnel, fidèles…),
      // appliquée aux lignes sans remise saisie.
      const remiseCategorie = customer ? await this.fidelite.remiseClient(tx, customer.id) : 0;
      const programme = await this.fidelite.lireProgramme(tx);

      // ---- Préparation des lignes ----
      interface PreparedLine {
        product: ResolvedProduct;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        allocations: Awaited<ReturnType<StockService['allocateFefo']>>;
      }

      const prepared: PreparedLine[] = [];
      for (const line of dto.lines) {
        const product = await this.resolveProduct(tx, line);
        // L'ordonnance concerne la délivrance à un patient. Une vente à un
        // professionnel de santé (clinique, autre pharmacie) n'en porte pas.
        if (product.requires_prescription && !dto.prescription && dto.channel !== 'b2b') {
          throw new BusinessRuleException(
            `« ${product.name} » est délivré sur ordonnance : renseignez la prescription.`,
            { productId: product.id, sku: product.sku },
          );
        }
        const allocations = await this.stock.allocateFefo(
          tx,
          branchId,
          product.id,
          line.quantity,
        );
        const unitPrice =
          line.unitPrice ??
          (await this.priceFor(tx, product, customer?.price_list_id ?? null, dto.channel));
        prepared.push({
          product,
          quantity: line.quantity,
          unitPrice,
          discountPercent: line.discountPercent ?? remiseCategorie,
          allocations,
        });
      }

      const totals = this.computeTotals(prepared);

      // ---- Encaissements, ramenés à la devise de la vente ----
      // Un client peut payer en francs une vente en dollars (ou mélanger
      // les deux) : chaque montant remis est converti au taux du jour, et
      // seul l'équivalent dans la devise de la vente entre dans les totaux.
      const encaissements: {
        method: string; provider?: string; reference?: string;
        montant: number; devise: string; remis: number; taux: Taux | null;
      }[] = [];
      let tauxVente: Taux | null = null;
      let tolerance = 0.001;

      // Tiers payant : la part du payeur, calculée ici (taux, plafonds),
      // est un règlement de la vente ; le patient paie le reste.
      let priseEnCharge: PriseEnCharge | null = null;
      if (dto.coverage) {
        priseEnCharge = await this.payers.priseEnCharge(tx, dto.coverage.payerMemberId, totals.total);
        if (priseEnCharge.payerShare <= 0) {
          throw new BusinessRuleException(
            priseEnCharge.reason ?? `Rien n'est pris en charge pour ${priseEnCharge.memberName}.`,
            { priseEnCharge },
          );
        }
        encaissements.push({
          method: 'insurance', provider: priseEnCharge.payerName,
          reference: dto.coverage.authorizationNumber, montant: priseEnCharge.payerShare,
          devise: currency, remis: priseEnCharge.payerShare, taux: null,
        });
      }

      // Points de fidélité : leur valeur est un règlement de la vente, pris
      // sur la part du client (après celle du tiers payant).
      let pointsUtilises = 0;
      let valeurPoints = 0;
      if (dto.loyaltyPoints) {
        if (!customer) throw new BusinessRuleException('Choisissez le client pour utiliser ses points de fidélité.');
        const u = await this.fidelite.utiliser(
          tx, customer.id, dto.loyaltyPoints, totals.total - (priseEnCharge?.payerShare ?? 0),
        );
        pointsUtilises = dto.loyaltyPoints;
        valeurPoints = u.montant;
        encaissements.push({
          method: 'loyalty', reference: `${pointsUtilises} points`, montant: valeurPoints,
          devise: currency, remis: valeurPoints, taux: null,
        });
      }

      for (const p of dto.payments ?? []) {
        const devise = p.currency ?? currency;
        if (devise === currency) {
          encaissements.push({ ...p, montant: p.amount, devise, remis: p.amount, taux: null });
          continue;
        }
        if (p.method === 'credit') {
          throw new BusinessRuleException(
            `Le crédit client se compte dans la devise de la pharmacie (${currency}).`,
          );
        }
        const taux = await tauxPour(tx, currency, devise, p.exchangeRate);
        tauxVente ??= taux;
        encaissements.push({
          ...p, montant: arrondi2(convertir(p.amount, devise, currency, taux)),
          devise, remis: p.amount, taux,
        });
        // Un montant remis en francs est arrondi à la coupure : l'écart
        // d'arrondi, au plus un demi-pas, n'est pas un règlement incomplet.
        const pas = devise === taux.quote_currency ? Number(taux.change_rounding) : 0;
        tolerance = Math.max(tolerance, 0.0051, convertir(pas / 2, devise, currency, taux));
      }

      // ---- Contrôle du crédit client ----
      const creditAmount = encaissements
        .filter((p) => p.method === 'credit')
        .reduce((sum, p) => sum + p.montant, 0);
      const paidAmount = encaissements
        .filter((p) => p.method !== 'credit')
        .reduce((sum, p) => sum + p.montant, 0);
      const declared = creditAmount + paidAmount;

      if (creditAmount > 0) {
        if (!customer) {
          throw new BusinessRuleException(
            'Une vente à crédit exige un client identifié.',
          );
        }
        if (customer.is_credit_blocked) {
          throw new BusinessRuleException(
            `Le crédit de « ${customer.name} » est bloqué.`,
          );
        }
        const newBalance = Number(customer.outstanding_balance) + creditAmount;
        if (Number(customer.credit_limit) > 0 && newBalance > Number(customer.credit_limit)) {
          throw new BusinessRuleException(
            `Encours dépassé pour « ${customer.name} » : ` +
              `${newBalance.toFixed(2)} ${currency} pour une limite de ` +
              `${Number(customer.credit_limit).toFixed(2)} ${currency}.`,
            {
              customerId: customer.id,
              outstanding: Number(customer.outstanding_balance),
              creditLimit: Number(customer.credit_limit),
              requested: creditAmount,
            },
          );
        }
      }

      if (declared > 0 && declared + tolerance < totals.total) {
        throw new BusinessRuleException(
          `Règlement incomplet : ${declared.toFixed(2)} encaissé pour ` +
            `${totals.total.toFixed(2)} ${currency} dû.`,
          { total: totals.total, received: declared },
        );
      }

      // ---- Prescription ----
      let prescriptionId: string | null = null;
      if (dto.prescription) {
        const prescription = await tx.oneOrFail<{ id: string }>(
          `INSERT INTO prescriptions
             (organization_id, customer_id, patient_name, prescriber_name,
              prescriber_number, issued_date, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            organizationId, customer?.id ?? null,
            dto.prescription.patientName ?? null,
            dto.prescription.prescriberName ?? null,
            dto.prescription.prescriberNumber ?? null,
            dto.prescription.issuedDate ?? null,
            dto.prescription.notes ?? null,
          ],
        );
        prescriptionId = prescription.id;
      }

      // ---- En-tête de vente ----
      const number = await this.numbering.next(tx, 'sale', { branchId });
      const changeGiven = Math.max(0, this.round(paidAmount + creditAmount - totals.total));
      // Monnaie rendue dans la devise demandée (souvent en francs), arrondie
      // à la coupure qui circule.
      const changeCurrency = dto.changeCurrency ?? currency;
      let changeAmount = changeGiven;
      if (changeGiven > 0) {
        const tauxMonnaie =
          changeCurrency === currency
            ? tauxVente
            : tauxVente && [tauxVente.base_currency, tauxVente.quote_currency].includes(changeCurrency)
              ? tauxVente
              : await tauxPour(tx, currency, changeCurrency);
        changeAmount = arrondirMonnaie(
          tauxMonnaie ? convertir(changeGiven, currency, changeCurrency, tauxMonnaie) : changeGiven,
          changeCurrency,
          tauxMonnaie,
        );
      }
      // Un reste dû inférieur au demi-pas d'arrondi est soldé.
      const amountPaid =
        declared > 0 && declared < totals.total && declared + tolerance >= totals.total
          ? totals.total
          : this.round(paidAmount + creditAmount - changeGiven);

      const sale = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO sales
           (organization_id, branch_id, session_id, number, status, channel,
            customer_id, prescription_id, currency, subtotal, discount_total,
            tax_total, total, amount_paid, change_given, cost_total,
            client_operation_id, device_id, sold_by, notes,
            change_currency, change_amount,
            payer_id, payer_member_id, coverage_percent, payer_share, patient_share, authorization_number,
            sold_at)
         VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
                 $22,$23,$24,$25,$26,$27, COALESCE($28::timestamptz, now()))
         RETURNING id, number`,
        [
          organizationId, branchId, session?.id ?? null, number,
          dto.channel ?? 'pos', customer?.id ?? null, prescriptionId, currency,
          totals.subtotal, totals.discount, totals.tax, totals.total,
          amountPaid, changeGiven,
          totals.cost, dto.clientOperationId ?? null, dto.deviceId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null, dto.notes ?? null,
          changeGiven > 0 ? changeCurrency : null, changeGiven > 0 ? changeAmount : null,
          priseEnCharge?.payerId ?? null, priseEnCharge?.memberId ?? null,
          priseEnCharge?.percent ?? null, priseEnCharge?.payerShare ?? 0,
          priseEnCharge ? priseEnCharge.patientShare : null,
          dto.coverage?.authorizationNumber?.trim() || null,
          soldAt ? soldAt.toISOString() : null,
        ],
      );
      if (remiseCategorie > 0 && prepared.some((l) => l.discountPercent === remiseCategorie)) {
        await tx.query('UPDATE sales SET group_discount_percent = $2 WHERE id = $1', [sale.id, remiseCategorie]);
      }

      // ---- Lignes, une par lot consommé ----
      let sortOrder = 0;
      for (const line of prepared) {
        for (const allocation of line.allocations) {
          const gross = allocation.quantity * line.unitPrice;
          const net = gross * (1 - line.discountPercent / 100);
          const taxRate = Number(line.product.tax_rate);
          const taxAmount = net - net / (1 + taxRate / 100);

          await tx.query(
            `INSERT INTO sale_lines
               (organization_id, sale_id, product_id, lot_id, description, quantity,
                unit_price, unit_cost, discount_percent, tax_rate, tax_amount,
                line_total, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              organizationId, sale.id, line.product.id, allocation.lotId,
              this.designation(line.product),
              allocation.quantity, line.unitPrice, allocation.unitCost,
              line.discountPercent, taxRate, this.round(taxAmount),
              this.round(net), sortOrder++,
            ],
          );

          await this.stock.applyMovement(tx, {
            branchId,
            productId: line.product.id,
            lotId: allocation.lotId,
            kind: 'sale',
            quantity: -allocation.quantity,
            unitCost: allocation.unitCost,
            referenceKind: 'sale',
            referenceId: sale.id,
            reason: `Vente ${sale.number}`,
          });
        }
      }

      // ---- Encaissements ----
      for (const payment of encaissements) {
        const etranger = payment.devise !== currency;
        await tx.query(
          `INSERT INTO sale_payments
             (organization_id, sale_id, method, provider, amount, currency, reference,
              tendered_currency, tendered_amount, exchange_rate)
           VALUES ($1,$2,$3::nova.payment_method,$4,$5,$6,$7,$8,$9,$10)`,
          [
            organizationId, sale.id, payment.method, payment.provider ?? null,
            payment.montant, currency, payment.reference ?? null,
            etranger ? payment.devise : null, etranger ? payment.remis : null,
            etranger ? payment.taux?.rate : null,
          ],
        );
      }

      // La caisse ne voit que les espèces effectivement reçues, devise par
      // devise, nettes de la monnaie rendue (dans sa propre devise).
      if (session) {
        const net = new Map<string, number>();
        for (const p of encaissements) {
          if (p.method === 'cash') net.set(p.devise, (net.get(p.devise) ?? 0) + p.remis);
        }
        if (changeGiven > 0 && (net.size > 0 || changeCurrency !== currency)) {
          net.set(changeCurrency, (net.get(changeCurrency) ?? 0) - changeAmount);
        }
        for (const [devise, montant] of net) {
          await mouvementCaisse(tx, {
            organizationId, sessionId: session.id, deviseSession: currency, devise,
            kind: 'sale', amount: montant, referenceKind: 'sale', referenceId: sale.id,
            reason: `Vente ${sale.number}`,
            userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
          });
        }
      }

      // ---- Traitements suivis : la délivrance recalcule la date de fin ----
      if (customer) {
        await this.traitements.apresVente(
          tx, customer.id, prepared.map((l) => ({ productId: l.product.id, quantity: l.quantity })), soldAt ?? new Date(),
        );
      }

      // ---- Fidélité : points utilisés, puis points gagnés sur ce que le
      // client a payé lui-même (ni tiers payant, ni points, ni crédit) ----
      if (customer) {
        const auteur = ctx.actorKind === 'user' ? ctx.actorId ?? null : null;
        if (pointsUtilises > 0) {
          await this.fidelite.mouvement(tx, {
            organizationId, customerId: customer.id, saleId: sale.id, kind: 'redeem',
            points: -pointsUtilises, amount: valeurPoints, reason: `Vente ${sale.number}`, userId: auteur,
          });
        }
        const gagnes = dto.channel === 'b2b' ? 0 : this.fidelite.pointsGagnes(
          programme, totals.total - (priseEnCharge?.payerShare ?? 0) - valeurPoints - creditAmount,
        );
        if (gagnes > 0) {
          await this.fidelite.mouvement(tx, {
            organizationId, customerId: customer.id, saleId: sale.id, kind: 'earn',
            points: gagnes, reason: `Vente ${sale.number}`, userId: auteur,
          });
        }
        if (pointsUtilises > 0 || gagnes > 0) {
          await tx.query(
            'UPDATE sales SET loyalty_points_earned = $2, loyalty_points_redeemed = $3 WHERE id = $1',
            [sale.id, gagnes, pointsUtilises],
          );
        }
      }

      // ---- Crédit client ----
      if (creditAmount > 0 && customer) {
        await tx.query(
          'UPDATE customers SET outstanding_balance = outstanding_balance + $2 WHERE id = $1',
          [customer.id, creditAmount],
        );
      }

      // ---- Facture ----
      let invoice = null;
      if (dto.issueInvoice || dto.channel === 'b2b' || creditAmount > 0) {
        invoice = await this.invoices.ecrire(tx, ctx, sale.id);
      }

      await this.stock.refreshAlerts(tx, branchId);
      await this.audit.record(tx, {
        action: 'sales.completed',
        entity: 'sale',
        entityId: sale.id,
        after: {
          number: sale.number,
          total: totals.total,
          lines: prepared.length,
          customer: customer?.name ?? null,
        },
      });

      const loaded = await this.loadSale(tx, sale.id);
      return { ...loaded, invoice, duplicate: false };
    });
  }

  // -------------------------------------------------------------------
  // Catalogue hors connexion
  // -------------------------------------------------------------------
  /**
   * Ce qu'il faut au poste pour encaisser pendant une coupure : prix,
   * codes-barres et, pour chaque produit, ses lots vendables avec leur date
   * de péremption — le poste ne vend jamais un lot qui expire pendant la
   * coupure, et décompte lui-même ce qu'il a vendu.
   */
  async offlineCatalog(ctx: RequestContext, branchId?: string) {
    const branche = branchId ?? ctx.branchId;
    if (!branche) {
      throw new BadRequestException("Aucune branche sélectionnée : précisez branchId ou l'en-tête X-Branch-Id.");
    }
    return this.db.readTransaction(ctx, async (tx) => {
      const devise = await this.currency(tx, ctx.organizationId as string);
      const produits = await tx.many(
        `SELECT p.id, p.sku, p.name, p.dosage, p.sale_price, p.requires_prescription,
                COALESCE((SELECT array_agg(b.barcode) FROM product_barcodes b WHERE b.product_id = p.id), '{}') AS barcodes,
                COALESCE((
                  SELECT json_agg(json_build_object('e', pl.expiry_date, 'q', si.quantity - si.reserved_quantity)
                                  ORDER BY pl.expiry_date NULLS LAST)
                    FROM stock_items si
                    LEFT JOIN product_lots pl ON pl.id = si.lot_id
                   WHERE si.branch_id = $1 AND si.product_id = p.id
                     AND si.quantity - si.reserved_quantity > 0
                     AND COALESCE(pl.is_quarantined, false) = false
                     AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)
                ), '[]'::json) AS lots
           FROM products p
          WHERE p.deleted_at IS NULL AND p.is_active
          ORDER BY p.name`,
        [branche],
      );
      const taux = await tx.one(
        `SELECT id, base_currency, quote_currency, rate, change_rounding, created_at
           FROM exchange_rates WHERE base_currency = $1 OR quote_currency = $1
          ORDER BY created_at DESC LIMIT 1`,
        [devise],
      );
      return { generatedAt: new Date().toISOString(), branchId: branche, currency: devise, rate: taux, products: produits };
    });
  }

  // -------------------------------------------------------------------
  // Annulation
  // -------------------------------------------------------------------
  /** Annule une vente et remet, par défaut, les articles sur leurs lots d'origine. */
  async cancel(ctx: RequestContext, saleId: string, dto: CancelSaleDto) {
    return this.db.transaction(ctx, async (tx) => {
      const sale = await tx.oneOrFail<{
        id: string; number: string; status: string; branch_id: string;
        customer_id: string | null; session_id: string | null;
        currency: string; total: string;
      }>('SELECT * FROM sales WHERE id = $1', [saleId], 'Vente introuvable.');

      if (sale.status === 'cancelled') {
        throw new BusinessRuleException('Cette vente est déjà annulée.');
      }
      // Une vente prise en charge sort du relevé en brouillon qui la porte.
      await this.payers.retirerVente(tx, saleId);
      // Points gagnés retirés, points utilisés rendus.
      await this.fidelite.annulerVente(tx, ctx, saleId, sale.number);

      const lines = await tx.many<{
        product_id: string; lot_id: string | null; quantity: string; unit_cost: string;
      }>('SELECT * FROM sale_lines WHERE sale_id = $1', [saleId]);

      if (dto.restock !== false) {
        for (const line of lines) {
          await this.stock.applyMovement(tx, {
            branchId: sale.branch_id,
            productId: line.product_id,
            lotId: line.lot_id,
            kind: 'sale_return',
            quantity: Number(line.quantity),
            unitCost: Number(line.unit_cost),
            referenceKind: 'sale',
            referenceId: saleId,
            reason: `Annulation de la vente ${sale.number} — ${dto.reason}`,
          });
        }
      }

      const creditPaid = await tx.one<{ amount: string }>(
        `SELECT COALESCE(sum(amount), 0) AS amount FROM sale_payments
          WHERE sale_id = $1 AND method = 'credit'`,
        [saleId],
      );
      if (sale.customer_id && Number(creditPaid?.amount ?? 0) > 0) {
        await tx.query(
          'UPDATE customers SET outstanding_balance = outstanding_balance - $2 WHERE id = $1',
          [sale.customer_id, Number(creditPaid?.amount ?? 0)],
        );
      }

      // Les espèces de la vente ressortent de la caisse, devise par devise,
      // telles qu'elles y sont entrées (monnaie rendue déduite).
      if (sale.session_id) {
        const caisse = await tx.oneOrFail<{ currency: string }>(
          'SELECT currency FROM cash_sessions WHERE id = $1',
          [sale.session_id],
        );
        const entrees = await tx.many<{ currency: string; amount: string }>(
          `SELECT currency, sum(amount) AS amount FROM cash_movements
            WHERE reference_kind = 'sale' AND reference_id = $1
            GROUP BY currency`,
          [saleId],
        );
        for (const e of entrees) {
          await mouvementCaisse(tx, {
            organizationId: ctx.organizationId as string, sessionId: sale.session_id,
            deviseSession: caisse.currency, devise: e.currency, kind: 'refund',
            amount: -Number(e.amount), referenceKind: 'sale', referenceId: saleId,
            reason: `Remboursement vente ${sale.number}`,
            userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
          });
        }
      }

      const cancelled = await tx.oneOrFail(
        `UPDATE sales SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2
          WHERE id = $1 RETURNING *`,
        [saleId, dto.reason],
      );
      await tx.query(
        `UPDATE invoices SET status = 'cancelled' WHERE sale_id = $1`,
        [saleId],
      );

      await this.stock.refreshAlerts(tx, sale.branch_id);
      await this.audit.record(tx, {
        action: 'sales.cancelled',
        entity: 'sale',
        entityId: saleId,
        before: sale,
        after: cancelled,
        reason: dto.reason,
      });

      return {
        sale: cancelled,
        restocked: dto.restock !== false,
        message: `Vente ${sale.number} annulée.`,
      };
    });
  }

  // -------------------------------------------------------------------
  // Consultation
  // -------------------------------------------------------------------
  async list(ctx: RequestContext, query: ListSalesDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Math.min(Number(query.pageSize ?? 50), 200);

    return this.db.readTransaction(ctx, async (tx) => {
      const rows = await tx.many(
        `SELECT s.id, s.number, s.status::text AS status, s.channel, s.currency,
                s.subtotal, s.discount_total, s.tax_total, s.total, s.amount_paid,
                s.margin_total, s.sold_at,
                b.code AS branch_code, c.name AS customer_name,
                u.full_name AS sold_by_name,
                (SELECT count(*) FROM sale_lines l WHERE l.sale_id = s.id) AS lines,
                fa.id AS invoice_id, fa.number AS invoice_number,
                count(*) OVER () AS total_count
           FROM sales s
           JOIN branches b ON b.id = s.branch_id
           LEFT JOIN customers c ON c.id = s.customer_id
           LEFT JOIN users u ON u.id = s.sold_by
           LEFT JOIN LATERAL (
             SELECT i.id, i.number FROM invoices i
              WHERE i.sale_id = s.id AND i.kind = 'invoice' AND i.status <> 'cancelled'
              ORDER BY i.created_at DESC LIMIT 1
           ) fa ON true
          WHERE ($1::uuid IS NULL OR s.branch_id = $1)
            AND ($2::uuid IS NULL OR s.customer_id = $2)
            AND ($3::timestamptz IS NULL OR s.sold_at >= $3)
            AND ($4::timestamptz IS NULL OR s.sold_at <= $4)
            AND ($5::text IS NULL OR s.status::text = $5)
          ORDER BY s.sold_at DESC
          LIMIT $6 OFFSET $7`,
        [
          query.branchId ?? ctx.branchId ?? null,
          query.customerId ?? null,
          query.from ?? null,
          query.to ?? null,
          query.status ?? null,
          pageSize,
          (page - 1) * pageSize,
        ],
      );
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return {
        data: rows.map(({ total_count, ...rest }) => rest),
        pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      };
    });
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.loadSale(tx, id));
  }

  /** Reçu prêt à imprimer. */
  async receipt(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const data = await this.loadSale(tx, id);
      const organization = await tx.oneOrFail(
        `SELECT legal_name, trade_name, address, city, phone, email, tax_id, license_number
           FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      );
      const branch = await tx.oneOrFail(
        'SELECT name, address, city, phone FROM branches WHERE id = $1',
        [data.sale.branch_id],
      );
      // Tiers payant : l'organisme et le bénéficiaire figurent sur le ticket.
      const coverage = data.sale.payer_id
        ? await tx.one(
            `SELECT p.name AS payer_name, m.full_name AS member_name, m.member_number
               FROM payers p LEFT JOIN payer_members m ON m.id = $2
              WHERE p.id = $1`,
            [data.sale.payer_id, data.sale.payer_member_id],
          )
        : null;
      // Fidélité : points gagnés, utilisés, et solde du client.
      const loyalty = data.sale.customer_id && (Number(data.sale.loyalty_points_earned) > 0 || Number(data.sale.loyalty_points_redeemed) > 0)
        ? await tx.one<{ balance: number }>('SELECT loyalty_points AS balance FROM customers WHERE id = $1', [data.sale.customer_id])
            .then((c) => ({
              earned: Number(data.sale.loyalty_points_earned), redeemed: Number(data.sale.loyalty_points_redeemed),
              balance: c ? Number(c.balance) : null,
            }))
        : null;
      return { organization, branch, coverage, loyalty, ...data };
    });
  }

  // -------------------------------------------------------------------
  // Interne
  // -------------------------------------------------------------------
  private async loadSale(tx: Tx, id: string) {
    const sale = await tx.oneOrFail<Record<string, string | null> & { branch_id: string }>(
      `SELECT s.*, c.name AS customer_name, c.code AS customer_code,
              c.phone AS customer_phone, c.email AS customer_email,
              u.full_name AS sold_by_name, b.name AS branch_name,
              (SELECT i.id FROM invoices i
                WHERE i.sale_id = s.id AND i.kind = 'invoice' AND i.status <> 'cancelled'
                ORDER BY i.created_at DESC LIMIT 1) AS invoice_id
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN users u ON u.id = s.sold_by
         JOIN branches b ON b.id = s.branch_id
        WHERE s.id = $1`,
      [id],
      'Vente introuvable.',
    );
    const lines = await tx.many(
      `SELECT l.description, l.quantity, l.unit_price, l.discount_percent,
              l.tax_rate, l.tax_amount, l.line_total,
              p.sku, pl.lot_number, pl.expiry_date
         FROM sale_lines l
         JOIN products p ON p.id = l.product_id
         LEFT JOIN product_lots pl ON pl.id = l.lot_id
        WHERE l.sale_id = $1 ORDER BY l.sort_order`,
      [id],
    );
    const payments = await tx.many(
      `SELECT method::text AS method, provider, amount, currency, reference, received_at,
              tendered_currency, tendered_amount, exchange_rate
         FROM sale_payments WHERE sale_id = $1`,
      [id],
    );
    return { sale, lines, payments };
  }

  private async resolveProduct(tx: Tx, line: SaleLineDto): Promise<ResolvedProduct> {
    if (!line.productId && !line.sku && !line.barcode) {
      throw new BadRequestException(
        'Chaque ligne doit désigner un produit (productId, sku ou barcode).',
      );
    }
    return tx.oneOrFail<ResolvedProduct>(
      `SELECT p.id, p.sku, p.name, p.dosage, p.sale_price, p.wholesale_price,
              p.requires_prescription, p.is_batch_tracked,
              COALESCE(t.rate, 0) AS tax_rate
         FROM products p
         LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
        WHERE p.deleted_at IS NULL AND p.is_active
          AND ($1::uuid IS NULL OR p.id = $1)
          AND ($2::text IS NULL OR p.sku = $2)
          AND ($3::text IS NULL OR EXISTS (
                SELECT 1 FROM product_barcodes b
                 WHERE b.product_id = p.id AND b.barcode = $3))
        LIMIT 1`,
      [line.productId ?? null, line.sku ?? null, line.barcode ?? null],
      `Produit introuvable (${line.productId ?? line.sku ?? line.barcode}).`,
    );
  }

  private async priceFor(
    tx: Tx,
    product: ResolvedProduct,
    priceListId: string | null,
    channel?: string,
  ): Promise<number> {
    if (priceListId) {
      const item = await tx.one<{ unit_price: string }>(
        `SELECT unit_price FROM price_list_items
          WHERE price_list_id = $1 AND product_id = $2
          ORDER BY min_quantity DESC LIMIT 1`,
        [priceListId, product.id],
      );
      if (item) return Number(item.unit_price);
    }
    if (channel === 'b2b' && Number(product.wholesale_price) > 0) {
      return Number(product.wholesale_price);
    }
    return Number(product.sale_price);
  }

  private computeTotals(
    lines: {
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      allocations: { quantity: number; unitCost: number }[];
      product: { tax_rate: string };
    }[],
  ) {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let cost = 0;

    for (const line of lines) {
      const gross = line.quantity * line.unitPrice;
      const lineDiscount = (gross * line.discountPercent) / 100;
      const net = gross - lineDiscount;
      const taxRate = Number(line.product.tax_rate);
      // Les prix sont affichés toutes taxes comprises : la taxe est
      // extraite du montant net, jamais ajoutée par-dessus.
      subtotal += gross;
      discount += lineDiscount;
      tax += net - net / (1 + taxRate / 100);
      cost += line.allocations.reduce((s, a) => s + a.quantity * a.unitCost, 0);
    }

    return {
      subtotal: this.round(subtotal),
      discount: this.round(discount),
      tax: this.round(tax),
      total: this.round(subtotal - discount),
      cost: this.round(cost),
    };
  }

  private async currency(tx: Tx, organizationId: string): Promise<string> {
    const row = await tx.oneOrFail<{ currency: string }>(
      'SELECT currency FROM organizations WHERE id = $1',
      [organizationId],
    );
    return row.currency;
  }

  /** « Paracétamol 500 mg » : le dosage n'est ajouté que s'il ne figure pas déjà dans le nom. */
  private designation(product: ResolvedProduct): string {
    const { name, dosage } = product;
    return dosage && !name.toLowerCase().includes(dosage.toLowerCase()) ? `${name} ${dosage}` : name;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
