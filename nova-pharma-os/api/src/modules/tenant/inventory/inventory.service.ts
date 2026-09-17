import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { StockService } from './stock.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Consultation
  // -------------------------------------------------------------------
  async stockLevels(
    ctx: RequestContext,
    filters: { branchId?: string; search?: string; onlyIssues?: boolean } = {},
  ) {
    const branchId = filters.branchId ?? ctx.branchId;
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT p.id AS product_id, p.sku, p.name, p.unit, p.reorder_point,
                p.sale_price, p.cost_price, p.expiry_alert_days,
                COALESCE(sum(si.quantity), 0)           AS on_hand,
                COALESCE(sum(si.available_quantity), 0) AS available,
                COALESCE(sum(si.quantity * si.average_cost), 0) AS stock_value,
                count(DISTINCT si.lot_id) FILTER (WHERE si.quantity > 0) AS lots,
                min(pl.expiry_date) FILTER (WHERE si.quantity > 0) AS nearest_expiry,
                COALESCE(sum(si.quantity) FILTER (
                  WHERE pl.expiry_date IS NOT NULL AND pl.expiry_date < CURRENT_DATE), 0)
                  AS expired_quantity
           FROM products p
           LEFT JOIN stock_items si ON si.product_id = p.id
                AND ($1::uuid IS NULL OR si.branch_id = $1)
           LEFT JOIN product_lots pl ON pl.id = si.lot_id
          WHERE p.deleted_at IS NULL AND p.is_active
            AND ($2::text IS NULL OR p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%')
          GROUP BY p.id
         HAVING $3::boolean IS NOT TRUE
             OR COALESCE(sum(si.quantity), 0) <= GREATEST(p.reorder_point, 0)
             OR COALESCE(sum(si.quantity) FILTER (
                  WHERE pl.expiry_date IS NOT NULL
                    AND pl.expiry_date <= CURRENT_DATE + p.expiry_alert_days), 0) > 0
          ORDER BY p.name LIMIT 500`,
        [branchId ?? null, filters.search ?? null, filters.onlyIssues ?? null],
      ),
    );
  }

  /** File FEFO d'un produit : ordre exact de consommation des lots. */
  async fefoQueue(ctx: RequestContext, productId: string, branchId?: string) {
    const target = branchId ?? ctx.branchId;
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT lot_id, lot_number, expiry_date, quantity, reserved_quantity,
                available_quantity, average_cost, fefo_rank
           FROM stock_fefo_queue
          WHERE product_id = $1 AND ($2::uuid IS NULL OR branch_id = $2)
          ORDER BY fefo_rank`,
        [productId, target ?? null],
      ),
    );
  }

  async alerts(ctx: RequestContext, branchId?: string, kind?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT a.id, a.kind, a.severity, a.message, a.details, a.status, a.created_at,
                p.sku, p.name AS product_name, pl.lot_number, pl.expiry_date,
                b.code AS branch_code
           FROM stock_alerts a
           JOIN products p ON p.id = a.product_id
           JOIN branches b ON b.id = a.branch_id
           LEFT JOIN product_lots pl ON pl.id = a.lot_id
          WHERE a.status = 'open'
            AND ($1::uuid IS NULL OR a.branch_id = $1)
            AND ($2::text IS NULL OR a.kind = $2)
          ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                   a.created_at DESC
          LIMIT 300`,
        [branchId ?? ctx.branchId ?? null, kind ?? null],
      ),
    );
  }

  async refreshAlerts(ctx: RequestContext, branchId?: string) {
    const target = branchId ?? ctx.branchId;
    if (!target) throw new BadRequestException('Branche non précisée.');
    return this.db.transaction(ctx, (tx) => this.stock.refreshAlerts(tx, target));
  }

  async acknowledgeAlert(ctx: RequestContext, alertId: string) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `UPDATE stock_alerts
            SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = now()
          WHERE id = $1 AND status = 'open' RETURNING *`,
        [alertId, ctx.actorKind === 'user' ? ctx.actorId : null],
        'Alerte introuvable ou déjà traitée.',
      ),
    );
  }

  async movements(
    ctx: RequestContext,
    filters: { productId?: string; branchId?: string; kind?: string; limit?: number } = {},
  ) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT m.id, m.kind::text AS kind, m.quantity, m.unit_cost, m.balance_after,
                m.reference_kind, m.reference_id, m.reason, m.occurred_at,
                p.sku, p.name AS product_name, pl.lot_number, pl.expiry_date,
                b.code AS branch_code, u.full_name AS user_name
           FROM stock_movements m
           JOIN products p ON p.id = m.product_id
           JOIN branches b ON b.id = m.branch_id
           LEFT JOIN product_lots pl ON pl.id = m.lot_id
           LEFT JOIN users u ON u.id = m.user_id
          WHERE ($1::uuid IS NULL OR m.product_id = $1)
            AND ($2::uuid IS NULL OR m.branch_id = $2)
            AND ($3::text IS NULL OR m.kind::text = $3)
          ORDER BY m.occurred_at DESC
          LIMIT $4`,
        [
          filters.productId ?? null,
          filters.branchId ?? ctx.branchId ?? null,
          filters.kind ?? null,
          Math.min(filters.limit ?? 200, 1000),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------
  // Régularisations
  // -------------------------------------------------------------------
  /** Régularisation manuelle : casse, don, perte, correction ponctuelle. */
  async adjust(
    ctx: RequestContext,
    dto: {
      branchId?: string;
      productId: string;
      lotId?: string;
      quantity: number;
      reason: string;
      kind?: 'adjustment_in' | 'adjustment_out' | 'damage' | 'expiry_write_off';
    },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');
    if (dto.quantity === 0) {
      throw new BadRequestException('La quantité de régularisation ne peut être nulle.');
    }

    const kind =
      dto.kind ?? (dto.quantity > 0 ? 'adjustment_in' : 'adjustment_out');

    return this.db.transaction(ctx, async (tx) => {
      const result = await this.stock.applyMovement(tx, {
        branchId,
        productId: dto.productId,
        lotId: dto.lotId ?? null,
        kind,
        quantity: dto.quantity,
        referenceKind: 'adjustment',
        reason: dto.reason,
      });
      await this.stock.refreshAlerts(tx, branchId);
      await this.audit.record(tx, {
        action: 'inventory.adjusted',
        entity: 'product',
        entityId: dto.productId,
        after: { quantity: dto.quantity, kind, balance: result.balance },
        reason: dto.reason,
      });
      return { ...result, kind, message: 'Régularisation enregistrée.' };
    });
  }

  /** Sortie des lots périmés, avec traçabilité de la destruction. */
  async writeOffExpired(ctx: RequestContext, branchId?: string, reason = 'Lots périmés.') {
    const target = branchId ?? ctx.branchId;
    if (!target) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      const expired = await tx.many<{
        product_id: string; lot_id: string; quantity: string;
        lot_number: string; product_name: string;
      }>(
        `SELECT si.product_id, si.lot_id, si.quantity, pl.lot_number, p.name AS product_name
           FROM stock_items si
           JOIN product_lots pl ON pl.id = si.lot_id
           JOIN products p ON p.id = si.product_id
          WHERE si.branch_id = $1 AND si.quantity > 0
            AND pl.expiry_date IS NOT NULL AND pl.expiry_date < CURRENT_DATE`,
        [target],
      );

      for (const item of expired) {
        await this.stock.applyMovement(tx, {
          branchId: target,
          productId: item.product_id,
          lotId: item.lot_id,
          kind: 'expiry_write_off',
          quantity: -Number(item.quantity),
          referenceKind: 'expiry',
          reason: `${reason} — lot ${item.lot_number}`,
        });
      }

      await this.stock.refreshAlerts(tx, target);
      await this.audit.record(tx, {
        action: 'inventory.expired_written_off',
        entity: 'branch',
        entityId: target,
        after: { lots: expired.length },
        reason,
      });

      return {
        writtenOff: expired.length,
        details: expired.map((e) => ({
          product: e.product_name,
          lot: e.lot_number,
          quantity: Number(e.quantity),
        })),
      };
    });
  }

  // -------------------------------------------------------------------
  // Inventaire
  // -------------------------------------------------------------------
  /** Ouvre un inventaire en figeant les quantités attendues. */
  async startCount(
    ctx: RequestContext,
    dto: { branchId?: string; kind?: string; productIds?: string[] },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      const reference = await this.numbering.next(tx, 'inventory', { branchId });
      const count = await tx.oneOrFail<{ id: string; reference: string }>(
        `INSERT INTO inventory_counts
           (organization_id, branch_id, reference, kind, status)
         VALUES ($1,$2,$3,$4,'counting') RETURNING id, reference`,
        [ctx.organizationId, branchId, reference, dto.kind ?? 'full'],
      );

      await tx.query(
        `INSERT INTO inventory_count_lines
           (organization_id, count_id, product_id, lot_id, expected_quantity)
         SELECT si.organization_id, $2, si.product_id, si.lot_id, si.quantity
           FROM stock_items si
          WHERE si.branch_id = $1
            AND ($3::uuid[] IS NULL OR si.product_id = ANY($3))`,
        [branchId, count.id, dto.productIds?.length ? dto.productIds : null],
      );

      await this.audit.record(tx, {
        action: 'inventory.count_started',
        entity: 'inventory_count',
        entityId: count.id,
        after: { reference: count.reference, kind: dto.kind ?? 'full' },
      });
      return count;
    });
  }

  async recordCount(
    ctx: RequestContext,
    countId: string,
    lines: { productId: string; lotId?: string; countedQuantity: number; reason?: string }[],
  ) {
    return this.db.transaction(ctx, async (tx) => {
      for (const line of lines) {
        const sentinel = '00000000-0000-0000-0000-000000000000';
        const { rowCount } = await tx.query(
          `UPDATE inventory_count_lines
              SET counted_quantity = $3, reason = $4
            WHERE count_id = $1 AND product_id = $2
              AND COALESCE(lot_id, '${sentinel}'::uuid) = COALESCE($5::uuid, '${sentinel}'::uuid)`,
          [countId, line.productId, line.countedQuantity, line.reason ?? null, line.lotId ?? null],
        );
        // Un article trouvé en rayon mais absent du stock théorique est
        // ajouté à l'inventaire avec un attendu de zéro.
        if (rowCount === 0) {
          await tx.query(
            `INSERT INTO inventory_count_lines
               (organization_id, count_id, product_id, lot_id, expected_quantity,
                counted_quantity, reason)
             VALUES ($1,$2,$3,$4,0,$5,$6)`,
            [
              ctx.organizationId, countId, line.productId, line.lotId ?? null,
              line.countedQuantity, line.reason ?? 'Article non répertorié au stock théorique.',
            ],
          );
        }
      }
      return { recorded: lines.length };
    });
  }

  /**
   * Valide l'inventaire : chaque écart devient un mouvement de stock, ce
   * qui rend la correction traçable au lieu d'écraser silencieusement
   * les quantités.
   */
  async validateCount(ctx: RequestContext, countId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const count = await tx.oneOrFail<{
        id: string; branch_id: string; status: string; reference: string;
      }>(
        'SELECT * FROM inventory_counts WHERE id = $1',
        [countId],
        'Inventaire introuvable.',
      );
      if (count.status === 'validated') {
        throw new BusinessRuleException('Cet inventaire est déjà validé.');
      }

      const lines = await tx.many<{
        product_id: string; lot_id: string | null; variance: string; reason: string | null;
      }>(
        `SELECT product_id, lot_id, variance, reason
           FROM inventory_count_lines
          WHERE count_id = $1 AND counted_quantity IS NOT NULL AND variance <> 0`,
        [countId],
      );

      for (const line of lines) {
        await this.stock.applyMovement(tx, {
          branchId: count.branch_id,
          productId: line.product_id,
          lotId: line.lot_id,
          kind: 'inventory',
          quantity: Number(line.variance),
          referenceKind: 'inventory',
          referenceId: countId,
          reason: line.reason ?? `Écart d'inventaire ${count.reference}`,
        });
      }

      const validated = await tx.oneOrFail(
        `UPDATE inventory_counts
            SET status = 'validated', validated_at = now(), validated_by = $2
          WHERE id = $1 RETURNING *`,
        [countId, ctx.actorKind === 'user' ? ctx.actorId : null],
      );

      await this.stock.refreshAlerts(tx, count.branch_id);
      await this.audit.record(tx, {
        action: 'inventory.count_validated',
        entity: 'inventory_count',
        entityId: countId,
        after: { reference: count.reference, adjustments: lines.length },
      });

      return {
        count: validated,
        adjustments: lines.length,
        message: `Inventaire ${count.reference} validé : ${lines.length} écart(s) régularisé(s).`,
      };
    });
  }

  async getCount(ctx: RequestContext, countId: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const count = await tx.oneOrFail(
        `SELECT ic.*, b.name AS branch_name, u.full_name AS validated_by_name
           FROM inventory_counts ic
           JOIN branches b ON b.id = ic.branch_id
           LEFT JOIN users u ON u.id = ic.validated_by
          WHERE ic.id = $1`,
        [countId],
        'Inventaire introuvable.',
      );
      const lines = await tx.many(
        `SELECT l.expected_quantity, l.counted_quantity, l.variance, l.reason,
                p.sku, p.name AS product_name, p.unit, pl.lot_number, pl.expiry_date
           FROM inventory_count_lines l
           JOIN products p ON p.id = l.product_id
           LEFT JOIN product_lots pl ON pl.id = l.lot_id
          WHERE l.count_id = $1
          ORDER BY (l.variance <> 0) DESC, p.name`,
        [countId],
      );
      return { count, lines };
    });
  }

  // -------------------------------------------------------------------
  // Transferts entre branches
  // -------------------------------------------------------------------
  async transfer(
    ctx: RequestContext,
    dto: {
      fromBranchId: string;
      toBranchId: string;
      lines: { productId: string; quantity: number }[];
      notes?: string;
    },
  ) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Les branches de départ et d’arrivée sont identiques.');
    }

    return this.db.transaction(ctx, async (tx) => {
      const reference = await this.numbering.next(tx, 'transfer', {
        branchId: dto.fromBranchId,
      });
      const transfer = await tx.oneOrFail<{ id: string; reference: string }>(
        `INSERT INTO stock_transfers
           (organization_id, reference, from_branch_id, to_branch_id, status,
            sent_at, received_at, created_by)
         VALUES ($1,$2,$3,$4,'received', now(), now(), $5)
         RETURNING id, reference`,
        [
          ctx.organizationId, reference, dto.fromBranchId, dto.toBranchId,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      for (const line of dto.lines) {
        // La sortie suit la règle FEFO ; l'entrée reprend les mêmes lots,
        // ce qui préserve la traçabilité des péremptions d'un site à l'autre.
        const allocations = await this.stock.allocateFefo(
          tx,
          dto.fromBranchId,
          line.productId,
          line.quantity,
        );
        for (const allocation of allocations) {
          await tx.query(
            `INSERT INTO stock_transfer_lines
               (organization_id, transfer_id, product_id, lot_id, quantity, received_quantity)
             VALUES ($1,$2,$3,$4,$5,$5)`,
            [
              ctx.organizationId, transfer.id, line.productId,
              allocation.lotId, allocation.quantity,
            ],
          );
          await this.stock.applyMovement(tx, {
            branchId: dto.fromBranchId,
            productId: line.productId,
            lotId: allocation.lotId,
            kind: 'transfer_out',
            quantity: -allocation.quantity,
            unitCost: allocation.unitCost,
            referenceKind: 'transfer',
            referenceId: transfer.id,
            reason: `Transfert ${transfer.reference}`,
          });
          await this.stock.applyMovement(tx, {
            branchId: dto.toBranchId,
            productId: line.productId,
            lotId: allocation.lotId,
            kind: 'transfer_in',
            quantity: allocation.quantity,
            unitCost: allocation.unitCost,
            referenceKind: 'transfer',
            referenceId: transfer.id,
            reason: `Transfert ${transfer.reference}`,
          });
        }
      }

      await this.stock.refreshAlerts(tx, dto.fromBranchId);
      await this.stock.refreshAlerts(tx, dto.toBranchId);
      await this.audit.record(tx, {
        action: 'inventory.transferred',
        entity: 'stock_transfer',
        entityId: transfer.id,
        after: { reference: transfer.reference, lines: dto.lines.length },
      });

      return transfer;
    });
  }

  /** Met un lot en quarantaine (rappel de lot, doute qualité). */
  async quarantineLot(ctx: RequestContext, lotId: string, quarantined: boolean, reason: string) {
    return this.db.transaction(ctx, async (tx) => {
      const lot = await tx.oneOrFail(
        `UPDATE product_lots
            SET is_quarantined = $2, quarantine_reason = $3
          WHERE id = $1 RETURNING *`,
        [lotId, quarantined, quarantined ? reason : null],
        'Lot introuvable.',
      );
      await this.audit.record(tx, {
        action: quarantined ? 'inventory.lot_quarantined' : 'inventory.lot_released',
        entity: 'product_lot',
        entityId: lotId,
        after: { quarantined },
        reason,
      });
      return {
        lot,
        message: quarantined
          ? 'Lot bloqué : il ne sera plus proposé à la vente.'
          : 'Lot débloqué : il redevient vendable.',
      };
    });
  }
}
