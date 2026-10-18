import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';

const FLOW: Record<string, string[]> = {
  pending: ['assigned', 'failed'],
  assigned: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed', 'returned'],
  delivered: [],
  failed: ['assigned', 'returned'],
  returned: [],
};

/**
 * Livraisons : affectation d'un livreur, suivi d'étape en étape et
 * preuve de livraison. Chaque changement d'état est daté et
 * géolocalisable, ce qui rend le parcours d'un colis reconstituable.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async create(
    ctx: RequestContext,
    dto: {
      branchId?: string;
      orderId?: string;
      saleId?: string;
      customerId?: string;
      address?: string;
      city?: string;
      contactName?: string;
      contactPhone?: string;
      scheduledAt?: string;
      driverUserId?: string;
    },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      const number = await this.numbering.next(tx, 'delivery', { branchId });

      // À défaut d'adresse saisie, celle du client est reprise.
      const customer = dto.customerId
        ? await tx.one<{ name: string; address: string | null; city: string | null; phone: string | null }>(
            'SELECT name, address, city, phone FROM customers WHERE id = $1',
            [dto.customerId],
          )
        : null;

      const delivery = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO deliveries
           (organization_id, branch_id, order_id, sale_id, customer_id, number,
            status, driver_user_id, address, city, contact_name, contact_phone,
            scheduled_at, assigned_at)
         VALUES ($1,$2,$3,$4,$5,$6,
                 CASE WHEN $7::uuid IS NULL THEN 'pending' ELSE 'assigned' END,
                 $7,$8,$9,$10,$11,$12,
                 CASE WHEN $7::uuid IS NULL THEN NULL ELSE now() END)
         RETURNING id, number`,
        [
          ctx.organizationId, branchId, dto.orderId ?? null, dto.saleId ?? null,
          dto.customerId ?? null, number, dto.driverUserId ?? null,
          dto.address ?? customer?.address ?? null,
          dto.city ?? customer?.city ?? null,
          dto.contactName ?? customer?.name ?? null,
          dto.contactPhone ?? customer?.phone ?? null,
          dto.scheduledAt ?? null,
        ],
      );

      // Le bon de livraison reprend les lignes de la commande d'origine.
      if (dto.orderId) {
        await tx.query(
          `INSERT INTO delivery_lines
             (organization_id, delivery_id, product_id, quantity)
           SELECT organization_id, $2, product_id, quantity
             FROM b2b_order_lines WHERE order_id = $1`,
          [dto.orderId, delivery.id],
        );
      } else if (dto.saleId) {
        await tx.query(
          `INSERT INTO delivery_lines
             (organization_id, delivery_id, product_id, lot_id, quantity)
           SELECT organization_id, $2, product_id, lot_id, quantity
             FROM sale_lines WHERE sale_id = $1`,
          [dto.saleId, delivery.id],
        );
      }

      await tx.query(
        `INSERT INTO delivery_events (organization_id, delivery_id, status, user_id)
         VALUES ($1,$2,$3,$4)`,
        [
          ctx.organizationId, delivery.id,
          dto.driverUserId ? 'assigned' : 'pending',
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      await this.audit.record(tx, {
        action: 'delivery.created',
        entity: 'delivery',
        entityId: delivery.id,
        after: { number: delivery.number },
      });
      return delivery;
    });
  }

  /** Fait avancer la livraison, en refusant les transitions impossibles. */
  async advance(
    ctx: RequestContext,
    deliveryId: string,
    dto: {
      status: string;
      latitude?: number;
      longitude?: number;
      note?: string;
      recipientName?: string;
      proofCode?: string;
      amountCollected?: number;
      failedReason?: string;
    },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const delivery = await tx.oneOrFail<{
        id: string; number: string; status: string; driver_user_id: string | null;
      }>(
        'SELECT * FROM deliveries WHERE id = $1',
        [deliveryId],
        'Livraison introuvable.',
      );

      const allowed = FLOW[delivery.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BusinessRuleException(
          `Transition impossible : « ${delivery.status} » → « ${dto.status} ». ` +
            (allowed.length > 0
              ? `Étapes possibles : ${allowed.join(', ')}.`
              : 'Cette livraison est close.'),
          { from: delivery.status, to: dto.status, allowed },
        );
      }

      if (dto.status === 'delivered' && !dto.recipientName && !dto.proofCode) {
        throw new BusinessRuleException(
          'Une livraison ne peut être confirmée sans preuve : nom du destinataire ou code de confirmation.',
        );
      }

      const updated = await tx.oneOrFail(
        `UPDATE deliveries
            SET status = $2,
                latitude = COALESCE($3, latitude),
                longitude = COALESCE($4, longitude),
                recipient_name = COALESCE($5, recipient_name),
                proof_code = COALESCE($6, proof_code),
                amount_collected = COALESCE($7, amount_collected),
                failed_reason = CASE WHEN $2 = 'failed' THEN $8 ELSE failed_reason END,
                picked_up_at = CASE WHEN $2 = 'picked_up' THEN now() ELSE picked_up_at END,
                delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END
          WHERE id = $1 RETURNING *`,
        [
          deliveryId, dto.status, dto.latitude ?? null, dto.longitude ?? null,
          dto.recipientName ?? null, dto.proofCode ?? null,
          dto.amountCollected ?? null, dto.failedReason ?? null,
        ],
      );

      await tx.query(
        `INSERT INTO delivery_events
           (organization_id, delivery_id, status, latitude, longitude, note, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          ctx.organizationId, deliveryId, dto.status,
          dto.latitude ?? null, dto.longitude ?? null, dto.note ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      if (dto.status === 'delivered' && updated.order_id) {
        await tx.query(
          `UPDATE b2b_orders SET status = 'delivered', delivered_at = now()
            WHERE id = $1 AND status NOT IN ('invoiced','cancelled')`,
          [updated.order_id],
        );
      }

      await this.audit.record(tx, {
        action: `delivery.${dto.status}`,
        entity: 'delivery',
        entityId: deliveryId,
        before: { status: delivery.status },
        after: { status: dto.status },
      });

      return updated;
    });
  }

  async assign(ctx: RequestContext, deliveryId: string, driverUserId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const delivery = await tx.oneOrFail(
        `UPDATE deliveries
            SET driver_user_id = $2, status = 'assigned', assigned_at = now()
          WHERE id = $1 AND status IN ('pending','failed') RETURNING *`,
        [deliveryId, driverUserId],
        'Livraison introuvable ou déjà prise en charge.',
      );
      await tx.query(
        `INSERT INTO delivery_events (organization_id, delivery_id, status, user_id)
         VALUES ($1,$2,'assigned',$3)`,
        [ctx.organizationId, deliveryId, ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, {
        action: 'delivery.assigned',
        entity: 'delivery',
        entityId: deliveryId,
        after: { driverUserId },
      });
      return delivery;
    });
  }

  async list(ctx: RequestContext, status?: string, driverUserId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT d.id, d.number, d.status, d.address, d.city, d.contact_name,
                d.contact_phone, d.scheduled_at, d.delivered_at, d.amount_collected,
                c.name AS customer_name, u.full_name AS driver_name,
                o.number AS order_number, b.code AS branch_code,
                (SELECT count(*) FROM delivery_lines l WHERE l.delivery_id = d.id) AS lines
           FROM deliveries d
           JOIN branches b ON b.id = d.branch_id
           LEFT JOIN customers c ON c.id = d.customer_id
           LEFT JOIN users u ON u.id = d.driver_user_id
           LEFT JOIN b2b_orders o ON o.id = d.order_id
          WHERE ($1::text IS NULL OR d.status = $1)
            AND ($2::uuid IS NULL OR d.driver_user_id = $2)
          ORDER BY d.scheduled_at NULLS LAST, d.created_at DESC LIMIT 200`,
        [status ?? null, driverUserId ?? null],
      ),
    );
  }

  /** Tournée du jour d'un livreur : ce que l'application mobile affiche. */
  async myRoute(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT d.id, d.number, d.status, d.address, d.city, d.contact_name,
                d.contact_phone, d.scheduled_at, d.latitude, d.longitude,
                c.name AS customer_name,
                COALESCE(o.total, s.total, 0) AS amount_due,
                (SELECT json_agg(json_build_object(
                          'sku', p.sku, 'name', p.name, 'quantity', l.quantity))
                   FROM delivery_lines l JOIN products p ON p.id = l.product_id
                  WHERE l.delivery_id = d.id) AS items
           FROM deliveries d
           LEFT JOIN customers c ON c.id = d.customer_id
           LEFT JOIN b2b_orders o ON o.id = d.order_id
           LEFT JOIN sales s ON s.id = d.sale_id
          WHERE d.driver_user_id = $1
            AND d.status IN ('assigned','picked_up','in_transit')
          ORDER BY d.scheduled_at NULLS LAST`,
        [ctx.actorId],
      ),
    );
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const delivery = await tx.oneOrFail(
        `SELECT d.*, c.name AS customer_name, u.full_name AS driver_name
           FROM deliveries d
           LEFT JOIN customers c ON c.id = d.customer_id
           LEFT JOIN users u ON u.id = d.driver_user_id
          WHERE d.id = $1`,
        [id],
        'Livraison introuvable.',
      );
      const lines = await tx.many(
        `SELECT l.quantity, l.delivered_quantity, p.sku, p.name, p.unit,
                pl.lot_number, pl.expiry_date
           FROM delivery_lines l
           JOIN products p ON p.id = l.product_id
           LEFT JOIN product_lots pl ON pl.id = l.lot_id
          WHERE l.delivery_id = $1`,
        [id],
      );
      const events = await tx.many(
        `SELECT e.status, e.latitude, e.longitude, e.note, e.occurred_at,
                u.full_name AS user_name
           FROM delivery_events e
           LEFT JOIN users u ON u.id = e.user_id
          WHERE e.delivery_id = $1 ORDER BY e.occurred_at`,
        [id],
      );
      return { delivery, lines, events };
    });
  }
}
