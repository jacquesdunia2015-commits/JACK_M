import { Injectable } from '@nestjs/common';
import { Tx } from '../../../common/database/database.service';
import { BusinessRuleException } from '../../../common/http/exceptions';

export type MovementKind =
  | 'reception' | 'sale' | 'sale_return' | 'purchase_return'
  | 'adjustment_in' | 'adjustment_out' | 'transfer_in' | 'transfer_out'
  | 'inventory' | 'expiry_write_off' | 'damage';

export interface MovementInput {
  branchId: string;
  productId: string;
  lotId?: string | null;
  kind: MovementKind;
  /** Positif pour une entrée, négatif pour une sortie. */
  quantity: number;
  unitCost?: number;
  referenceKind?: string | null;
  referenceId?: string | null;
  reason?: string | null;
}

export interface FefoAllocation {
  lotId: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  unitCost: number;
}

/**
 * Moteur de stock.
 *
 * Toutes les entrées et sorties passent par `applyMovement`, qui met à
 * jour la position de stock et écrit le mouvement correspondant dans la
 * même transaction : le stock et son journal ne peuvent pas diverger.
 */
@Injectable()
export class StockService {
  /**
   * Répartit une quantité à sortir sur les lots disponibles selon la
   * règle FEFO — le lot dont la péremption est la plus proche part en
   * premier. Les lots périmés ou en quarantaine sont écartés.
   *
   * Les lignes de stock retenues sont verrouillées : deux caisses qui
   * vendent le même produit au même instant ne peuvent pas consommer
   * deux fois la même unité.
   */
  async allocateFefo(
    tx: Tx,
    branchId: string,
    productId: string,
    quantity: number,
  ): Promise<FefoAllocation[]> {
    if (quantity <= 0) {
      throw new BusinessRuleException('La quantité doit être strictement positive.');
    }

    const rows = await tx.many<{
      id: string;
      lot_id: string | null;
      lot_number: string | null;
      expiry_date: string | null;
      available: string;
      average_cost: string;
    }>(
      `SELECT si.id, si.lot_id, pl.lot_number, pl.expiry_date,
              (si.quantity - si.reserved_quantity) AS available,
              si.average_cost
         FROM stock_items si
         LEFT JOIN product_lots pl ON pl.id = si.lot_id
        WHERE si.branch_id = $1
          AND si.product_id = $2
          AND si.quantity - si.reserved_quantity > 0
          AND COALESCE(pl.is_quarantined, false) = false
          AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)
        ORDER BY pl.expiry_date NULLS LAST, si.id
        FOR UPDATE OF si`,
      [branchId, productId],
    );

    const available = rows.reduce((sum, row) => sum + Number(row.available), 0);
    if (available < quantity) {
      const product = await tx.one<{ name: string; sku: string }>(
        'SELECT name, sku FROM products WHERE id = $1',
        [productId],
      );
      throw new BusinessRuleException(
        `Stock insuffisant pour « ${product?.name ?? productId} » : ` +
          `${available} disponible(s), ${quantity} demandé(s).`,
        {
          productId,
          sku: product?.sku,
          available,
          requested: quantity,
        },
      );
    }

    const allocations: FefoAllocation[] = [];
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(row.available));
      allocations.push({
        lotId: row.lot_id,
        lotNumber: row.lot_number,
        expiryDate: row.expiry_date,
        quantity: take,
        unitCost: Number(row.average_cost),
      });
      remaining -= take;
    }
    return allocations;
  }

  /**
   * Applique un mouvement et retourne la position de stock résultante.
   * Une sortie qui ferait passer le stock sous zéro est refusée.
   */
  async applyMovement(tx: Tx, input: MovementInput): Promise<{ balance: number }> {
    const organizationId = tx.context.organizationId;
    if (!organizationId) throw new Error('Contexte tenant requis.');

    const sentinel = '00000000-0000-0000-0000-000000000000';
    const existing = await tx.one<{ id: string; quantity: string; average_cost: string }>(
      `SELECT id, quantity, average_cost FROM stock_items
        WHERE branch_id = $1 AND product_id = $2
          AND COALESCE(lot_id, '${sentinel}'::uuid) = COALESCE($3::uuid, '${sentinel}'::uuid)
        FOR UPDATE`,
      [input.branchId, input.productId, input.lotId ?? null],
    );

    const currentQty = existing ? Number(existing.quantity) : 0;
    const balance = currentQty + input.quantity;

    if (balance < 0) {
      throw new BusinessRuleException(
        `Mouvement refusé : le stock passerait à ${balance}. ` +
          `Position actuelle : ${currentQty}.`,
        { productId: input.productId, current: currentQty, requested: input.quantity },
      );
    }

    // Coût moyen pondéré, recalculé sur les seules entrées valorisées.
    const unitCost = input.unitCost ?? (existing ? Number(existing.average_cost) : 0);
    const averageCost =
      input.quantity > 0 && unitCost > 0
        ? (currentQty * (existing ? Number(existing.average_cost) : 0) +
            input.quantity * unitCost) /
          Math.max(balance, 1)
        : existing
          ? Number(existing.average_cost)
          : unitCost;

    if (existing) {
      await tx.query(
        `UPDATE stock_items SET quantity = $2, average_cost = $3, updated_at = now()
          WHERE id = $1`,
        [existing.id, balance, averageCost],
      );
    } else {
      await tx.query(
        `INSERT INTO stock_items
           (organization_id, branch_id, product_id, lot_id, quantity, average_cost)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          organizationId,
          input.branchId,
          input.productId,
          input.lotId ?? null,
          balance,
          averageCost,
        ],
      );
    }

    await tx.query(
      `INSERT INTO stock_movements
         (organization_id, branch_id, product_id, lot_id, kind, quantity,
          unit_cost, balance_after, reference_kind, reference_id, reason, user_id)
       VALUES ($1,$2,$3,$4,$5::nova.stock_movement_kind,$6,$7,$8,$9,$10,$11,$12)`,
      [
        organizationId,
        input.branchId,
        input.productId,
        input.lotId ?? null,
        input.kind,
        input.quantity,
        unitCost,
        balance,
        input.referenceKind ?? null,
        input.referenceId ?? null,
        input.reason ?? null,
        tx.context.actorKind === 'user' ? tx.context.actorId : null,
      ],
    );

    return { balance };
  }

  /**
   * Recalcule les alertes de stock d'une branche : rupture, seuil de
   * réapprovisionnement, péremption proche et lots périmés.
   *
   * Les alertes résolues sont refermées, les nouvelles ouvertes : la
   * liste reflète toujours l'état réel du stock.
   */
  async refreshAlerts(tx: Tx, branchId: string): Promise<{ opened: number; resolved: number }> {
    const organizationId = tx.context.organizationId as string;

    const candidates = await tx.many<{
      product_id: string;
      lot_id: string | null;
      kind: string;
      severity: string;
      message: string;
      details: unknown;
    }>(
      `WITH positions AS (
         SELECT p.id AS product_id, p.name, p.sku, p.reorder_point, p.expiry_alert_days,
                COALESCE(sum(si.quantity), 0) AS on_hand
           FROM products p
           LEFT JOIN stock_items si ON si.product_id = p.id AND si.branch_id = $2
          WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND p.is_active
          GROUP BY p.id, p.name, p.sku, p.reorder_point, p.expiry_alert_days
       )
       SELECT product_id, NULL::uuid AS lot_id, 'out_of_stock' AS kind,
              'critical' AS severity,
              'Rupture de stock : ' || name || ' (' || sku || ')' AS message,
              jsonb_build_object('onHand', on_hand, 'reorderPoint', reorder_point) AS details
         FROM positions WHERE on_hand <= 0
       UNION ALL
       SELECT product_id, NULL::uuid, 'low_stock', 'warning',
              'Stock bas : ' || name || ' — ' || on_hand || ' restant(s), seuil ' || reorder_point,
              jsonb_build_object('onHand', on_hand, 'reorderPoint', reorder_point)
         FROM positions WHERE on_hand > 0 AND reorder_point > 0 AND on_hand <= reorder_point
       UNION ALL
       SELECT si.product_id, si.lot_id, 'expired', 'critical',
              'Lot périmé : ' || p.name || ' — lot ' || pl.lot_number ||
              ', périmé le ' || to_char(pl.expiry_date, 'DD/MM/YYYY'),
              jsonb_build_object('quantity', si.quantity, 'expiryDate', pl.expiry_date)
         FROM stock_items si
         JOIN product_lots pl ON pl.id = si.lot_id
         JOIN products p ON p.id = si.product_id
        WHERE si.branch_id = $2 AND si.quantity > 0
          AND pl.expiry_date IS NOT NULL AND pl.expiry_date < CURRENT_DATE
       UNION ALL
       SELECT si.product_id, si.lot_id, 'expiring', 'warning',
              'Péremption proche : ' || p.name || ' — lot ' || pl.lot_number ||
              ', expire le ' || to_char(pl.expiry_date, 'DD/MM/YYYY'),
              jsonb_build_object('quantity', si.quantity, 'expiryDate', pl.expiry_date,
                                 'daysLeft', pl.expiry_date - CURRENT_DATE)
         FROM stock_items si
         JOIN product_lots pl ON pl.id = si.lot_id
         JOIN products p ON p.id = si.product_id
        WHERE si.branch_id = $2 AND si.quantity > 0
          AND pl.expiry_date IS NOT NULL
          AND pl.expiry_date >= CURRENT_DATE
          AND pl.expiry_date <= CURRENT_DATE + p.expiry_alert_days`,
      [organizationId, branchId],
    );

    let opened = 0;
    for (const alert of candidates) {
      const { rowCount } = await tx.query(
        `INSERT INTO stock_alerts
           (organization_id, branch_id, product_id, lot_id, kind, severity, message, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (branch_id, product_id,
                      COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
         WHERE status = 'open'
         DO UPDATE SET message = EXCLUDED.message, details = EXCLUDED.details`,
        [
          organizationId,
          branchId,
          alert.product_id,
          alert.lot_id,
          alert.kind,
          alert.severity,
          alert.message,
          JSON.stringify(alert.details),
        ],
      );
      opened += rowCount;
    }

    // Referme les alertes dont la cause a disparu.
    const stillOpen = candidates.map(
      (a) => `${a.product_id}:${a.lot_id ?? ''}:${a.kind}`,
    );
    const { rowCount: resolved } = await tx.query(
      `UPDATE stock_alerts
          SET status = 'resolved', resolved_at = now()
        WHERE branch_id = $1 AND status = 'open'
          AND (product_id::text || ':' || COALESCE(lot_id::text, '') || ':' || kind)
              <> ALL($2::text[])`,
      [branchId, stillOpen],
    );

    return { opened, resolved };
  }

  /** Position de stock consolidée d'un produit sur une branche. */
  async position(tx: Tx, branchId: string, productId: string) {
    return tx.many(
      `SELECT si.lot_id, pl.lot_number, pl.expiry_date, si.quantity,
              si.reserved_quantity, si.available_quantity, si.average_cost,
              COALESCE(pl.is_quarantined, false) AS is_quarantined
         FROM stock_items si
         LEFT JOIN product_lots pl ON pl.id = si.lot_id
        WHERE si.branch_id = $1 AND si.product_id = $2
        ORDER BY pl.expiry_date NULLS LAST`,
      [branchId, productId],
    );
  }
}
