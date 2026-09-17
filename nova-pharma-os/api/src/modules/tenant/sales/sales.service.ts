import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { StockService } from '../inventory/stock.service';
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
        if (product.requires_prescription && !dto.prescription) {
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
          discountPercent: line.discountPercent ?? 0,
          allocations,
        });
      }

      const totals = this.computeTotals(prepared);

      // ---- Contrôle du crédit client ----
      const creditAmount = (dto.payments ?? [])
        .filter((p) => p.method === 'credit')
        .reduce((sum, p) => sum + p.amount, 0);
      const paidAmount = (dto.payments ?? [])
        .filter((p) => p.method !== 'credit')
        .reduce((sum, p) => sum + p.amount, 0);
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

      if (declared > 0 && declared + 0.001 < totals.total) {
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

      const sale = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO sales
           (organization_id, branch_id, session_id, number, status, channel,
            customer_id, prescription_id, currency, subtotal, discount_total,
            tax_total, total, amount_paid, change_given, cost_total,
            client_operation_id, device_id, sold_by, notes)
         VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id, number`,
        [
          organizationId, branchId, session?.id ?? null, number,
          dto.channel ?? 'pos', customer?.id ?? null, prescriptionId, currency,
          totals.subtotal, totals.discount, totals.tax, totals.total,
          this.round(paidAmount + creditAmount - changeGiven), changeGiven,
          totals.cost, dto.clientOperationId ?? null, dto.deviceId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null, dto.notes ?? null,
        ],
      );

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
              `${line.product.name}${line.product.dosage ? ` ${line.product.dosage}` : ''}`,
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
      for (const payment of dto.payments ?? []) {
        await tx.query(
          `INSERT INTO sale_payments
             (organization_id, sale_id, method, provider, amount, currency, reference)
           VALUES ($1,$2,$3::nova.payment_method,$4,$5,$6,$7)`,
          [
            organizationId, sale.id, payment.method, payment.provider ?? null,
            payment.amount, currency, payment.reference ?? null,
          ],
        );
      }

      // Le mouvement de caisse ne porte que sur les espèces effectivement
      // reçues, nettes de la monnaie rendue.
      const cashReceived = (dto.payments ?? [])
        .filter((p) => p.method === 'cash')
        .reduce((sum, p) => sum + p.amount, 0);
      if (session && cashReceived > 0) {
        await tx.query(
          `INSERT INTO cash_movements
             (organization_id, session_id, kind, amount, currency,
              reference_kind, reference_id, reason, user_id)
           VALUES ($1,$2,'sale',$3,$4,'sale',$5,$6,$7)`,
          [
            organizationId, session.id, this.round(cashReceived - changeGiven),
            currency, sale.id, `Vente ${sale.number}`,
            ctx.actorKind === 'user' ? ctx.actorId : null,
          ],
        );
        await tx.query(
          'UPDATE cash_sessions SET expected_cash = expected_cash + $2 WHERE id = $1',
          [session.id, this.round(cashReceived - changeGiven)],
        );
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
        invoice = await this.issueInvoice(tx, ctx, sale.id, branchId, currency);
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

      const cashPaid = await tx.one<{ amount: string }>(
        `SELECT COALESCE(sum(amount), 0) AS amount FROM sale_payments
          WHERE sale_id = $1 AND method = 'cash'`,
        [saleId],
      );
      if (sale.session_id && Number(cashPaid?.amount ?? 0) > 0) {
        await tx.query(
          `INSERT INTO cash_movements
             (organization_id, session_id, kind, amount, currency,
              reference_kind, reference_id, reason, user_id)
           VALUES ($1,$2,'refund',$3,$4,'sale',$5,$6,$7)`,
          [
            ctx.organizationId, sale.session_id, -Number(cashPaid?.amount ?? 0),
            sale.currency, saleId, `Remboursement vente ${sale.number}`,
            ctx.actorKind === 'user' ? ctx.actorId : null,
          ],
        );
        await tx.query(
          'UPDATE cash_sessions SET expected_cash = expected_cash - $2 WHERE id = $1',
          [sale.session_id, Number(cashPaid?.amount ?? 0)],
        );
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
                count(*) OVER () AS total_count
           FROM sales s
           JOIN branches b ON b.id = s.branch_id
           LEFT JOIN customers c ON c.id = s.customer_id
           LEFT JOIN users u ON u.id = s.sold_by
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
      return { organization, branch, ...data };
    });
  }

  // -------------------------------------------------------------------
  // Interne
  // -------------------------------------------------------------------
  private async loadSale(tx: Tx, id: string) {
    const sale = await tx.oneOrFail(
      `SELECT s.*, c.name AS customer_name, c.code AS customer_code,
              u.full_name AS sold_by_name, b.name AS branch_name
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
      `SELECT method::text AS method, provider, amount, currency, reference, received_at
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

  private async issueInvoice(
    tx: Tx,
    ctx: RequestContext,
    saleId: string,
    branchId: string,
    currency: string,
  ) {
    const sale = await tx.oneOrFail<{
      customer_id: string | null; subtotal: string; discount_total: string;
      tax_total: string; total: string; amount_paid: string;
    }>('SELECT * FROM sales WHERE id = $1', [saleId]);

    const number = await this.numbering.next(tx, 'invoice', { branchId });
    // Les montants sont castés explicitement : sans cela, PostgreSQL
    // déduit le type « text » d'un paramètre comparé à un autre
    // paramètre, et l'insertion échoue.
    const invoice = await tx.oneOrFail<{ id: string; number: string }>(
      `INSERT INTO invoices
         (organization_id, branch_id, number, kind, status, customer_id, sale_id,
          currency, issue_date, subtotal, discount_total, tax_total, total,
          amount_paid, created_by)
       VALUES ($1, $2, $3, 'invoice',
               CASE WHEN $11::numeric >= $10::numeric THEN 'paid'::nova.invoice_status
                    ELSE 'issued'::nova.invoice_status END,
               $4, $5, $6, CURRENT_DATE,
               $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric, $12)
       RETURNING id, number`,
      [
        ctx.organizationId,
        branchId,
        number,
        sale.customer_id,
        saleId,
        currency,
        sale.subtotal,
        sale.discount_total,
        sale.tax_total,
        sale.total,
        sale.amount_paid,
        ctx.actorKind === 'user' ? ctx.actorId : null,
      ],
    );

    await tx.query(
      `INSERT INTO invoice_lines
         (organization_id, invoice_id, product_id, description, quantity,
          unit_price, discount_percent, tax_rate, line_total, sort_order)
       SELECT organization_id, $2, product_id, description, quantity,
              unit_price, discount_percent, tax_rate, line_total, sort_order
         FROM sale_lines WHERE sale_id = $1`,
      [saleId, invoice.id],
    );

    return invoice;
  }

  private async currency(tx: Tx, organizationId: string): Promise<string> {
    const row = await tx.oneOrFail<{ currency: string }>(
      'SELECT currency FROM organizations WHERE id = $1',
      [organizationId],
    );
    return row.currency;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
