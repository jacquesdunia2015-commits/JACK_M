import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { SalesService } from '../sales/sales.service';

interface B2bLineInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
}

/**
 * Commerce entre professionnels : devis, commandes, préparation,
 * livraison et facturation à destination des clients professionnels
 * (B2B) — pharmacies, cliniques, dispensaires, ONG.
 */
@Injectable()
export class B2bService {
  constructor(
    private readonly db: DatabaseService,
    private readonly numbering: NumberingService,
    private readonly sales: SalesService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Devis
  // -------------------------------------------------------------------
  async createQuote(
    ctx: RequestContext,
    dto: {
      customerId: string;
      branchId?: string;
      validUntil?: string;
      notes?: string;
      lines: B2bLineInput[];
    },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      const customer = await this.professionalCustomer(tx, dto.customerId);
      const currency = await this.currency(tx, ctx);
      const number = await this.numbering.next(tx, 'quote', { branchId });
      const priced = await this.priceLines(tx, dto.lines, customer.price_list_id);
      const totals = this.totals(priced);

      const quote = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO b2b_quotes
           (organization_id, branch_id, customer_id, number, status, currency,
            valid_until, subtotal, discount_total, tax_total, total, notes, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5,
                 COALESCE($6::date, CURRENT_DATE + 30),$7,$8,$9,$10,$11,$12)
         RETURNING id, number`,
        [
          ctx.organizationId, branchId, customer.id, number, currency,
          dto.validUntil ?? null, totals.subtotal, totals.discount,
          totals.tax, totals.total, dto.notes ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      for (const [index, line] of priced.entries()) {
        await tx.query(
          `INSERT INTO b2b_quote_lines
             (organization_id, quote_id, product_id, description, quantity,
              unit_price, discount_percent, tax_rate, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            ctx.organizationId, quote.id, line.productId, line.description,
            line.quantity, line.unitPrice, line.discountPercent, line.taxRate,
            line.lineTotal, index,
          ],
        );
      }

      await this.audit.record(tx, {
        action: 'b2b.quote_created',
        entity: 'b2b_quote',
        entityId: quote.id,
        after: { number: quote.number, customer: customer.name, total: totals.total },
      });
      return this.loadQuote(tx, quote.id);
    });
  }

  /** Transforme un devis accepté en commande, sans ressaisie. */
  async convertQuote(ctx: RequestContext, quoteId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const quote = await tx.oneOrFail<{
        id: string; number: string; status: string; customer_id: string;
        branch_id: string; currency: string; subtotal: string;
        discount_total: string; tax_total: string; total: string;
      }>('SELECT * FROM b2b_quotes WHERE id = $1', [quoteId], 'Devis introuvable.');

      if (quote.status === 'converted') {
        throw new BusinessRuleException('Ce devis a déjà été transformé en commande.');
      }

      const number = await this.numbering.next(tx, 'b2b_order', {
        branchId: quote.branch_id,
      });
      const order = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO b2b_orders
           (organization_id, branch_id, customer_id, quote_id, number, status,
            currency, subtotal, discount_total, tax_total, total, created_by)
         VALUES ($1,$2,$3,$4,$5,'confirmed',$6,$7,$8,$9,$10,$11)
         RETURNING id, number`,
        [
          ctx.organizationId, quote.branch_id, quote.customer_id, quote.id, number,
          quote.currency, quote.subtotal, quote.discount_total, quote.tax_total,
          quote.total, ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      await tx.query(
        `INSERT INTO b2b_order_lines
           (organization_id, order_id, product_id, description, quantity,
            unit_price, discount_percent, tax_rate, line_total, sort_order)
         SELECT organization_id, $2, product_id, description, quantity,
                unit_price, discount_percent, tax_rate, line_total, sort_order
           FROM b2b_quote_lines WHERE quote_id = $1`,
        [quoteId, order.id],
      );

      await tx.query(
        `UPDATE b2b_quotes SET status = 'converted', converted_order_id = $2 WHERE id = $1`,
        [quoteId, order.id],
      );

      await this.audit.record(tx, {
        action: 'b2b.quote_converted',
        entity: 'b2b_order',
        entityId: order.id,
        after: { quote: quote.number, order: order.number },
      });
      return this.loadOrder(tx, order.id);
    });
  }

  // -------------------------------------------------------------------
  // Commandes
  // -------------------------------------------------------------------
  async createOrder(
    ctx: RequestContext,
    dto: {
      customerId: string;
      branchId?: string;
      paymentTerms?: 'cash' | 'credit';
      requestedDate?: string;
      notes?: string;
      clientOperationId?: string;
      lines: B2bLineInput[];
    },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      if (dto.clientOperationId) {
        const existing = await tx.one<{ id: string }>(
          'SELECT id FROM b2b_orders WHERE client_operation_id = $1',
          [dto.clientOperationId],
        );
        if (existing) {
          return { ...(await this.loadOrder(tx, existing.id)), duplicate: true };
        }
      }

      const customer = await this.professionalCustomer(tx, dto.customerId);
      const currency = await this.currency(tx, ctx);
      const priced = await this.priceLines(tx, dto.lines, customer.price_list_id);
      const totals = this.totals(priced);

      if (dto.paymentTerms === 'credit') {
        this.assertCreditRoom(customer, totals.total, currency);
      }

      const number = await this.numbering.next(tx, 'b2b_order', { branchId });
      const order = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO b2b_orders
           (organization_id, branch_id, customer_id, number, status, currency,
            payment_terms, requested_date, subtotal, discount_total, tax_total,
            total, notes, client_operation_id, submitted_at, created_by)
         VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7,$8,$9,$10,$11,$12,$13, now(),$14)
         RETURNING id, number`,
        [
          ctx.organizationId, branchId, customer.id, number, currency,
          dto.paymentTerms ?? 'cash', dto.requestedDate ?? null,
          totals.subtotal, totals.discount, totals.tax, totals.total,
          dto.notes ?? null, dto.clientOperationId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      for (const [index, line] of priced.entries()) {
        await tx.query(
          `INSERT INTO b2b_order_lines
             (organization_id, order_id, product_id, description, quantity,
              unit_price, discount_percent, tax_rate, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            ctx.organizationId, order.id, line.productId, line.description,
            line.quantity, line.unitPrice, line.discountPercent, line.taxRate,
            line.lineTotal, index,
          ],
        );
      }

      await this.audit.record(tx, {
        action: 'b2b.order_created',
        entity: 'b2b_order',
        entityId: order.id,
        after: { number: order.number, customer: customer.name, total: totals.total },
      });
      return { ...(await this.loadOrder(tx, order.id)), duplicate: false };
    });
  }

  async setStatus(ctx: RequestContext, orderId: string, status: string) {
    const allowed = ['confirmed', 'preparing', 'ready', 'delivering', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Statut invalide. Valeurs acceptées : ${allowed.join(', ')}.`,
      );
    }
    return this.db.transaction(ctx, async (tx) => {
      const order = await tx.oneOrFail(
        `UPDATE b2b_orders
            SET status = $2::nova.b2b_order_status,
                confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
                cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END
          WHERE id = $1 AND status NOT IN ('invoiced','delivered','cancelled')
          RETURNING *`,
        [orderId, status],
        'Commande introuvable ou déjà close.',
      );
      await this.audit.record(tx, {
        action: 'b2b.order_status_changed',
        entity: 'b2b_order',
        entityId: orderId,
        after: { status },
      });
      return order;
    });
  }

  /**
   * Livre la commande : la sortie de stock, la facture et, le cas
   * échéant, l'imputation sur l'encours client sont produites par le
   * moteur de vente — mêmes règles FEFO et mêmes contrôles de crédit
   * qu'une vente au comptoir.
   */
  async fulfil(
    ctx: RequestContext,
    orderId: string,
    payments?: { method: string; amount: number; provider?: string; reference?: string }[],
  ) {
    const order = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{
        id: string; number: string; status: string; customer_id: string;
        branch_id: string; payment_terms: string; total: string;
      }>('SELECT * FROM b2b_orders WHERE id = $1', [orderId], 'Commande introuvable.'),
    );

    if (['delivered', 'invoiced', 'cancelled'].includes(order.status)) {
      throw new BusinessRuleException(
        `Cette commande est déjà ${order.status === 'cancelled' ? 'annulée' : 'livrée'}.`,
      );
    }

    const lines = await this.db.readTransaction(ctx, (tx) =>
      tx.many<{ product_id: string; quantity: string; unit_price: string; discount_percent: string }>(
        'SELECT * FROM b2b_order_lines WHERE order_id = $1 ORDER BY sort_order',
        [orderId],
      ),
    );

    const effectivePayments =
      payments ??
      (order.payment_terms === 'credit'
        ? [{ method: 'credit', amount: Number(order.total) }]
        : [{ method: 'cash', amount: Number(order.total) }]);

    const sale = await this.sales.create(ctx, {
      branchId: order.branch_id,
      customerId: order.customer_id,
      channel: 'b2b',
      issueInvoice: true,
      notes: `Commande professionnelle ${order.number}`,
      lines: lines.map((line) => ({
        productId: line.product_id,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unit_price),
        discountPercent: Number(line.discount_percent),
      })),
      payments: effectivePayments,
    });

    return this.db.transaction(ctx, async (tx) => {
      const updated = await tx.oneOrFail(
        `UPDATE b2b_orders
            SET status = 'invoiced', delivered_at = now(),
                sale_id = $2, invoice_id = $3,
                amount_paid = $4
          WHERE id = $1 RETURNING *`,
        [
          orderId,
          sale.sale.id,
          sale.invoice?.id ?? null,
          order.payment_terms === 'credit' ? 0 : Number(order.total),
        ],
      );
      await tx.query(
        `UPDATE b2b_order_lines SET prepared_quantity = quantity WHERE order_id = $1`,
        [orderId],
      );
      await this.audit.record(tx, {
        action: 'b2b.order_fulfilled',
        entity: 'b2b_order',
        entityId: orderId,
        after: { sale: sale.sale.number, invoice: sale.invoice?.number ?? null },
      });
      return {
        order: updated,
        sale: sale.sale,
        invoice: sale.invoice,
        message: `Commande ${order.number} livrée et facturée.`,
      };
    });
  }

  async listOrders(ctx: RequestContext, status?: string, customerId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT o.id, o.number, o.status::text AS status, o.currency, o.payment_terms,
                o.requested_date, o.total, o.amount_paid, o.balance_due,
                o.created_at, o.delivered_at,
                c.name AS customer_name, c.code AS customer_code,
                b.code AS branch_code,
                (SELECT count(*) FROM b2b_order_lines l WHERE l.order_id = o.id) AS lines
           FROM b2b_orders o
           JOIN customers c ON c.id = o.customer_id
           JOIN branches b ON b.id = o.branch_id
          WHERE ($1::text IS NULL OR o.status::text = $1)
            AND ($2::uuid IS NULL OR o.customer_id = $2)
          ORDER BY o.created_at DESC LIMIT 200`,
        [status ?? null, customerId ?? null],
      ),
    );
  }

  async getOrder(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.loadOrder(tx, id));
  }

  async listQuotes(ctx: RequestContext, status?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT q.id, q.number, q.status, q.currency, q.valid_until, q.total,
                q.created_at, c.name AS customer_name,
                (SELECT count(*) FROM b2b_quote_lines l WHERE l.quote_id = q.id) AS lines
           FROM b2b_quotes q
           JOIN customers c ON c.id = q.customer_id
          WHERE ($1::text IS NULL OR q.status = $1)
          ORDER BY q.created_at DESC LIMIT 200`,
        [status ?? null],
      ),
    );
  }

  async getQuote(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.loadQuote(tx, id));
  }

  // -------------------------------------------------------------------
  // Interne
  // -------------------------------------------------------------------
  private async loadOrder(tx: Tx, id: string) {
    const order = await tx.oneOrFail(
      `SELECT o.*, c.name AS customer_name, c.code AS customer_code,
              c.phone AS customer_phone, c.address AS customer_address,
              b.name AS branch_name
         FROM b2b_orders o
         JOIN customers c ON c.id = o.customer_id
         JOIN branches b ON b.id = o.branch_id
        WHERE o.id = $1`,
      [id],
      'Commande introuvable.',
    );
    const lines = await tx.many(
      `SELECT l.description, l.quantity, l.prepared_quantity, l.unit_price,
              l.discount_percent, l.tax_rate, l.line_total, p.sku, p.unit
         FROM b2b_order_lines l
         JOIN products p ON p.id = l.product_id
        WHERE l.order_id = $1 ORDER BY l.sort_order`,
      [id],
    );
    return { order, lines };
  }

  private async loadQuote(tx: Tx, id: string) {
    const quote = await tx.oneOrFail(
      `SELECT q.*, c.name AS customer_name, c.code AS customer_code
         FROM b2b_quotes q JOIN customers c ON c.id = q.customer_id
        WHERE q.id = $1`,
      [id],
      'Devis introuvable.',
    );
    const lines = await tx.many(
      `SELECT l.description, l.quantity, l.unit_price, l.discount_percent,
              l.tax_rate, l.line_total, p.sku, p.unit
         FROM b2b_quote_lines l
         JOIN products p ON p.id = l.product_id
        WHERE l.quote_id = $1 ORDER BY l.sort_order`,
      [id],
    );
    return { quote, lines };
  }

  private async professionalCustomer(tx: Tx, customerId: string) {
    return tx.oneOrFail<{
      id: string; name: string; kind: string; credit_limit: string;
      outstanding_balance: string; is_credit_blocked: boolean;
      price_list_id: string | null;
    }>(
      'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
      [customerId],
      'Client introuvable.',
    );
  }

  private assertCreditRoom(
    customer: { name: string; credit_limit: string; outstanding_balance: string; is_credit_blocked: boolean },
    amount: number,
    currency: string,
  ): void {
    if (customer.is_credit_blocked) {
      throw new BusinessRuleException(`Le crédit de « ${customer.name} » est bloqué.`);
    }
    const projected = Number(customer.outstanding_balance) + amount;
    if (Number(customer.credit_limit) > 0 && projected > Number(customer.credit_limit)) {
      throw new BusinessRuleException(
        `Encours dépassé pour « ${customer.name} » : ${projected.toFixed(2)} ${currency} ` +
          `pour une limite de ${Number(customer.credit_limit).toFixed(2)} ${currency}.`,
        {
          outstanding: Number(customer.outstanding_balance),
          creditLimit: Number(customer.credit_limit),
          requested: amount,
        },
      );
    }
  }

  private async priceLines(
    tx: Tx,
    lines: B2bLineInput[],
    priceListId: string | null,
  ) {
    const priced = [];
    for (const line of lines) {
      const product = await tx.oneOrFail<{
        id: string; name: string; dosage: string | null;
        wholesale_price: string; sale_price: string; tax_rate: string;
      }>(
        `SELECT p.id, p.name, p.dosage, p.wholesale_price, p.sale_price,
                COALESCE(t.rate, 0) AS tax_rate
           FROM products p
           LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
          WHERE p.id = $1 AND p.deleted_at IS NULL AND p.is_active`,
        [line.productId],
        `Produit ${line.productId} introuvable.`,
      );

      let unitPrice = line.unitPrice;
      if (unitPrice === undefined && priceListId) {
        const item = await tx.one<{ unit_price: string }>(
          `SELECT unit_price FROM price_list_items
            WHERE price_list_id = $1 AND product_id = $2 AND min_quantity <= $3
            ORDER BY min_quantity DESC LIMIT 1`,
          [priceListId, product.id, line.quantity],
        );
        if (item) unitPrice = Number(item.unit_price);
      }
      if (unitPrice === undefined) {
        unitPrice =
          Number(product.wholesale_price) > 0
            ? Number(product.wholesale_price)
            : Number(product.sale_price);
      }

      const discountPercent = line.discountPercent ?? 0;
      const gross = line.quantity * unitPrice;
      const net = gross * (1 - discountPercent / 100);

      priced.push({
        productId: product.id,
        description: `${product.name}${product.dosage ? ` ${product.dosage}` : ''}`,
        quantity: line.quantity,
        unitPrice,
        discountPercent,
        taxRate: Number(product.tax_rate),
        gross,
        lineTotal: this.round(net),
      });
    }
    return priced;
  }

  private totals(lines: { gross: number; lineTotal: number; taxRate: number }[]) {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    for (const line of lines) {
      subtotal += line.gross;
      discount += line.gross - line.lineTotal;
      tax += line.lineTotal - line.lineTotal / (1 + line.taxRate / 100);
    }
    return {
      subtotal: this.round(subtotal),
      discount: this.round(discount),
      tax: this.round(tax),
      total: this.round(subtotal - discount),
    };
  }

  private async currency(tx: Tx, ctx: RequestContext): Promise<string> {
    const row = await tx.oneOrFail<{ currency: string }>(
      'SELECT currency FROM organizations WHERE id = $1',
      [ctx.organizationId],
    );
    return row.currency;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
