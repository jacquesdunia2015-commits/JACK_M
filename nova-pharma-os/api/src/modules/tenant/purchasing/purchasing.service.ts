import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { StockService } from '../inventory/stock.service';
import {
  CreatePurchaseOrderDto,
  CreateReceiptDto,
  CreateSupplierDto,
} from './dto';

@Injectable()
export class PurchasingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Fournisseurs
  // -------------------------------------------------------------------
  async listSuppliers(ctx: RequestContext, search?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT s.*,
                (SELECT count(*) FROM purchase_orders po
                  WHERE po.supplier_id = s.id) AS orders,
                (SELECT COALESCE(sum(po.total - po.amount_paid), 0) FROM purchase_orders po
                  WHERE po.supplier_id = s.id AND po.status <> 'cancelled') AS balance
           FROM suppliers s
          WHERE ($1::text IS NULL OR s.name ILIKE '%'||$1||'%' OR s.code ILIKE '%'||$1||'%')
          ORDER BY s.name`,
        [search ?? null],
      ),
    );
  }

  async createSupplier(ctx: RequestContext, dto: CreateSupplierDto) {
    return this.db.transaction(ctx, async (tx) => {
      const supplier = await tx.oneOrFail(
        `INSERT INTO suppliers
           (organization_id, code, name, kind, contact_name, email, phone, address,
            city, country_code, tax_id, currency, payment_terms_days, lead_time_days,
            credit_limit, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 COALESCE($12, (SELECT currency FROM organizations WHERE id = $1)),
                 $13,$14,$15,$16)
         RETURNING *`,
        [
          ctx.organizationId, dto.code, dto.name, dto.kind ?? 'wholesaler',
          dto.contactName ?? null, dto.email ?? null, dto.phone ?? null,
          dto.address ?? null, dto.city ?? null, dto.countryCode ?? null,
          dto.taxId ?? null, dto.currency ?? null, dto.paymentTermsDays ?? 0,
          dto.leadTimeDays ?? 7, dto.creditLimit ?? 0, dto.notes ?? null,
        ],
      );
      await this.audit.record(tx, {
        action: 'purchasing.supplier_created',
        entity: 'supplier',
        entityId: supplier.id as string,
        after: { code: dto.code, name: dto.name },
      });
      return supplier;
    });
  }

  // -------------------------------------------------------------------
  // Commandes fournisseur
  // -------------------------------------------------------------------
  async createOrder(ctx: RequestContext, dto: CreatePurchaseOrderDto) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      const supplier = await tx.oneOrFail<{ id: string; name: string; currency: string }>(
        'SELECT * FROM suppliers WHERE id = $1 AND is_active',
        [dto.supplierId],
        'Fournisseur introuvable.',
      );

      const number = await this.numbering.next(tx, 'purchase_order', { branchId });
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;

      for (const line of dto.lines) {
        const gross = line.quantity * line.unitCost;
        const discount = (gross * (line.discountPercent ?? 0)) / 100;
        subtotal += gross;
        discountTotal += discount;
        taxTotal += ((gross - discount) * (line.taxRate ?? 0)) / 100;
      }
      const total = this.round(
        subtotal - discountTotal + taxTotal + (dto.shippingCost ?? 0),
      );

      const order = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO purchase_orders
           (organization_id, branch_id, supplier_id, number, status, currency,
            order_date, expected_date, subtotal, discount_total, tax_total,
            shipping_cost, total, notes, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5, CURRENT_DATE,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, number`,
        [
          ctx.organizationId, branchId, supplier.id, number, supplier.currency,
          dto.expectedDate ?? null, this.round(subtotal), this.round(discountTotal),
          this.round(taxTotal), dto.shippingCost ?? 0, total, dto.notes ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      for (const [index, line] of dto.lines.entries()) {
        const gross = line.quantity * line.unitCost;
        const net = gross - (gross * (line.discountPercent ?? 0)) / 100;
        await tx.query(
          `INSERT INTO purchase_order_lines
             (organization_id, purchase_order_id, product_id, quantity, unit_cost,
              discount_percent, tax_rate, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            ctx.organizationId, order.id, line.productId, line.quantity,
            line.unitCost, line.discountPercent ?? 0, line.taxRate ?? 0,
            this.round(net), index,
          ],
        );
      }

      await this.audit.record(tx, {
        action: 'purchasing.order_created',
        entity: 'purchase_order',
        entityId: order.id,
        after: { number: order.number, supplier: supplier.name, total },
      });

      return this.loadOrder(tx, order.id);
    });
  }

  async submitOrder(ctx: RequestContext, orderId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const order = await tx.oneOrFail(
        `UPDATE purchase_orders
            SET status = 'submitted', submitted_at = now()
          WHERE id = $1 AND status = 'draft' RETURNING *`,
        [orderId],
        'Commande introuvable ou déjà transmise.',
      );
      await this.audit.record(tx, {
        action: 'purchasing.order_submitted',
        entity: 'purchase_order',
        entityId: orderId,
      });
      return order;
    });
  }

  async listOrders(ctx: RequestContext, status?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT po.id, po.number, po.status, po.currency, po.order_date,
                po.expected_date, po.total, po.amount_paid,
                s.name AS supplier_name, b.code AS branch_code,
                (SELECT count(*) FROM purchase_order_lines l
                  WHERE l.purchase_order_id = po.id) AS lines,
                (SELECT COALESCE(sum(l.received_quantity), 0) / NULLIF(sum(l.quantity), 0) * 100
                   FROM purchase_order_lines l WHERE l.purchase_order_id = po.id) AS received_percent
           FROM purchase_orders po
           JOIN suppliers s ON s.id = po.supplier_id
           JOIN branches b ON b.id = po.branch_id
          WHERE ($1::text IS NULL OR po.status = $1)
            AND ($2::uuid IS NULL OR po.branch_id = $2)
          ORDER BY po.order_date DESC, po.created_at DESC LIMIT 200`,
        [status ?? null, ctx.branchId ?? null],
      ),
    );
  }

  async getOrder(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.loadOrder(tx, id));
  }

  private async loadOrder(tx: Tx, id: string) {
    const order = await tx.oneOrFail(
      `SELECT po.*, s.name AS supplier_name, s.contact_name, s.phone AS supplier_phone,
              b.name AS branch_name
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         JOIN branches b ON b.id = po.branch_id
        WHERE po.id = $1`,
      [id],
      'Commande introuvable.',
    );
    const lines = await tx.many(
      `SELECT l.id, l.quantity, l.received_quantity, l.unit_cost, l.discount_percent,
              l.tax_rate, l.line_total, p.sku, p.name, p.unit
         FROM purchase_order_lines l
         JOIN products p ON p.id = l.product_id
        WHERE l.purchase_order_id = $1 ORDER BY l.sort_order`,
      [id],
    );
    const receipts = await tx.many(
      `SELECT id, number, status, received_date, supplier_invoice_number
         FROM goods_receipts WHERE purchase_order_id = $1 ORDER BY received_date`,
      [id],
    );
    return { order, lines, receipts };
  }

  // -------------------------------------------------------------------
  // Réception
  // -------------------------------------------------------------------
  /**
   * Réceptionne une livraison fournisseur : chaque ligne crée ou complète
   * un lot (numéro et péremption), puis entre en stock. Un produit à
   * péremption ne peut pas être réceptionné sans date : c'est la
   * condition pour que la règle FEFO ait un sens.
   */
  async receive(ctx: RequestContext, dto: CreateReceiptDto) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.one<{ id: string }>(
          'SELECT id FROM goods_receipts WHERE idempotency_key = $1',
          [dto.idempotencyKey],
        );
        if (existing) {
          return { ...(await this.loadReceipt(tx, existing.id)), duplicate: true };
        }
      }

      const organizationId = ctx.organizationId as string;
      const number = await this.numbering.next(tx, 'goods_receipt', { branchId });

      const receipt = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO goods_receipts
           (organization_id, branch_id, purchase_order_id, supplier_id, number,
            status, received_date, supplier_invoice_number, idempotency_key, notes)
         VALUES ($1,$2,$3,$4,$5,'draft', COALESCE($6::date, CURRENT_DATE),$7,$8,$9)
         RETURNING id, number`,
        [
          organizationId, branchId, dto.purchaseOrderId ?? null, dto.supplierId,
          number, dto.receivedDate ?? null, dto.supplierInvoiceNumber ?? null,
          dto.idempotencyKey ?? null, dto.notes ?? null,
        ],
      );

      for (const line of dto.lines) {
        const product = await tx.oneOrFail<{
          id: string; name: string; has_expiry: boolean; is_batch_tracked: boolean;
        }>(
          'SELECT id, name, has_expiry, is_batch_tracked FROM products WHERE id = $1',
          [line.productId],
          `Produit ${line.productId} introuvable.`,
        );

        if (product.has_expiry && !line.expiryDate) {
          throw new BusinessRuleException(
            `« ${product.name} » exige une date de péremption à la réception ` +
              '(règle FEFO).',
            { productId: product.id },
          );
        }

        let lotId: string | null = null;
        if (product.is_batch_tracked) {
          const lotNumber = line.lotNumber ?? `SANS-LOT-${receipt.number}`;
          const lot = await tx.oneOrFail<{ id: string }>(
            `INSERT INTO product_lots
               (organization_id, product_id, lot_number, expiry_date, supplier_id, cost_price)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (organization_id, product_id, lot_number)
             DO UPDATE SET expiry_date = COALESCE(EXCLUDED.expiry_date, product_lots.expiry_date),
                           cost_price = EXCLUDED.cost_price
             RETURNING id`,
            [
              organizationId, product.id, lotNumber,
              line.expiryDate ?? null, dto.supplierId, line.unitCost,
            ],
          );
          lotId = lot.id;
        }

        await tx.query(
          `INSERT INTO goods_receipt_lines
             (organization_id, receipt_id, purchase_order_line_id, product_id,
              lot_number, expiry_date, quantity, unit_cost, lot_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            organizationId, receipt.id, line.purchaseOrderLineId ?? null,
            product.id, line.lotNumber ?? null, line.expiryDate ?? null,
            line.quantity, line.unitCost, lotId,
          ],
        );

        if (dto.validate !== false) {
          await this.stock.applyMovement(tx, {
            branchId,
            productId: product.id,
            lotId,
            kind: 'reception',
            quantity: line.quantity,
            unitCost: line.unitCost,
            referenceKind: 'goods_receipt',
            referenceId: receipt.id,
            reason: `Réception ${receipt.number}`,
          });

          // Le prix de revient du produit suit le dernier coût d'achat.
          await tx.query(
            'UPDATE products SET cost_price = $2 WHERE id = $1',
            [product.id, line.unitCost],
          );

          if (line.purchaseOrderLineId) {
            await tx.query(
              `UPDATE purchase_order_lines
                  SET received_quantity = received_quantity + $2
                WHERE id = $1`,
              [line.purchaseOrderLineId, line.quantity],
            );
          }
        }
      }

      if (dto.validate !== false) {
        await tx.query(
          `UPDATE goods_receipts
              SET status = 'validated', validated_at = now(), validated_by = $2
            WHERE id = $1`,
          [receipt.id, ctx.actorKind === 'user' ? ctx.actorId : null],
        );

        if (dto.purchaseOrderId) {
          // La commande passe à « reçue » dès que toutes ses lignes le sont.
          await tx.query(
            `UPDATE purchase_orders po
                SET status = CASE
                      WHEN NOT EXISTS (
                        SELECT 1 FROM purchase_order_lines l
                         WHERE l.purchase_order_id = po.id
                           AND l.received_quantity < l.quantity)
                      THEN 'received' ELSE 'partially_received' END,
                    received_at = CASE
                      WHEN NOT EXISTS (
                        SELECT 1 FROM purchase_order_lines l
                         WHERE l.purchase_order_id = po.id
                           AND l.received_quantity < l.quantity)
                      THEN now() ELSE received_at END
              WHERE po.id = $1`,
            [dto.purchaseOrderId],
          );
        }

        await this.stock.refreshAlerts(tx, branchId);
      }

      await this.audit.record(tx, {
        action: 'purchasing.goods_received',
        entity: 'goods_receipt',
        entityId: receipt.id,
        after: { number: receipt.number, lines: dto.lines.length },
      });

      return { ...(await this.loadReceipt(tx, receipt.id)), duplicate: false };
    });
  }

  private async loadReceipt(tx: Tx, id: string) {
    const receipt = await tx.oneOrFail(
      `SELECT gr.*, s.name AS supplier_name, b.name AS branch_name
         FROM goods_receipts gr
         JOIN suppliers s ON s.id = gr.supplier_id
         JOIN branches b ON b.id = gr.branch_id
        WHERE gr.id = $1`,
      [id],
      'Réception introuvable.',
    );
    const lines = await tx.many(
      `SELECT l.quantity, l.unit_cost, l.lot_number, l.expiry_date,
              p.sku, p.name, p.unit
         FROM goods_receipt_lines l
         JOIN products p ON p.id = l.product_id
        WHERE l.receipt_id = $1`,
      [id],
    );
    return { receipt, lines };
  }

  /** Proposition de réapprovisionnement fondée sur les seuils et les ventes. */
  async replenishmentSuggestions(ctx: RequestContext) {
    const branchId = ctx.branchId;
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `WITH consumption AS (
           SELECT sl.product_id, COALESCE(sum(sl.quantity), 0) / 30.0 AS daily_average
             FROM sale_lines sl
             JOIN sales s ON s.id = sl.sale_id
            WHERE s.sold_at >= now() - interval '30 days'
              AND s.status = 'completed'
              AND ($1::uuid IS NULL OR s.branch_id = $1)
            GROUP BY sl.product_id
         )
         SELECT p.id, p.sku, p.name, p.unit, p.reorder_point, p.reorder_quantity,
                COALESCE(sum(si.quantity), 0) AS on_hand,
                COALESCE(c.daily_average, 0) AS daily_average,
                CASE WHEN COALESCE(c.daily_average, 0) > 0
                     THEN round(COALESCE(sum(si.quantity), 0) / c.daily_average)
                     ELSE NULL END AS days_of_cover,
                GREATEST(
                  p.reorder_quantity,
                  CEIL(COALESCE(c.daily_average, 0) * (sup.lead_time_days + 14))
                    - COALESCE(sum(si.quantity), 0)
                ) AS suggested_quantity,
                sup.id AS supplier_id, sup.name AS supplier_name, sup.lead_time_days
           FROM products p
           LEFT JOIN stock_items si ON si.product_id = p.id
                 AND ($1::uuid IS NULL OR si.branch_id = $1)
           LEFT JOIN consumption c ON c.product_id = p.id
           LEFT JOIN LATERAL (
             SELECT s.id, s.name, s.lead_time_days
               FROM supplier_products sp
               JOIN suppliers s ON s.id = sp.supplier_id
              WHERE sp.product_id = p.id
              ORDER BY sp.is_preferred DESC LIMIT 1
           ) sup ON true
          WHERE p.deleted_at IS NULL AND p.is_active
          GROUP BY p.id, p.sku, p.name, p.unit, p.reorder_point, p.reorder_quantity,
                   c.daily_average, sup.id, sup.name, sup.lead_time_days
         HAVING COALESCE(sum(si.quantity), 0) <= GREATEST(p.reorder_point, 0)
             OR (COALESCE(c.daily_average, 0) > 0
                 AND COALESCE(sum(si.quantity), 0) / c.daily_average
                     < COALESCE(sup.lead_time_days, 7) + 7)
          ORDER BY days_of_cover NULLS FIRST, p.name
          LIMIT 200`,
        [branchId ?? null],
      ),
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
