import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { EntitlementsService } from '../../../common/entitlements/entitlements.service';
import {
  CreateProductDto,
  ImportProductsDto,
  SearchProductsDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async search(ctx: RequestContext, query: SearchProductsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 200);

    return this.db.readTransaction(ctx, async (tx) => {
      const rows = await tx.many(
        `SELECT p.id, p.sku, p.name, p.commercial_name, p.dosage, p.dosage_form,
                p.packaging, p.unit, p.sale_price, p.wholesale_price, p.cost_price,
                p.requires_prescription, p.is_controlled, p.is_cold_chain,
                p.is_batch_tracked, p.reorder_point, p.expiry_alert_days, p.is_active,
                c.code AS category_code, c.name AS category_name,
                m.inn,
                COALESCE(stock.on_hand, 0) AS on_hand,
                COALESCE(stock.available, 0) AS available,
                stock.nearest_expiry,
                count(*) OVER () AS total_count
           FROM products p
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN molecules m ON m.id = p.molecule_id
           LEFT JOIN LATERAL (
             SELECT sum(si.quantity) AS on_hand,
                    sum(si.available_quantity) AS available,
                    min(pl.expiry_date) FILTER (WHERE si.quantity > 0) AS nearest_expiry
               FROM stock_items si
               LEFT JOIN product_lots pl ON pl.id = si.lot_id
              WHERE si.product_id = p.id
                AND ($1::uuid IS NULL OR si.branch_id = $1)
           ) stock ON true
          WHERE p.deleted_at IS NULL
            AND ($2::text IS NULL OR
                 p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%'
                 OR p.commercial_name ILIKE '%'||$2||'%' OR m.inn ILIKE '%'||$2||'%'
                 OR EXISTS (SELECT 1 FROM product_barcodes b
                             WHERE b.product_id = p.id AND b.barcode = $2))
            AND ($3::text IS NULL OR c.code = $3)
            AND ($4::boolean IS NOT TRUE OR COALESCE(stock.on_hand, 0) <= 0)
            AND ($5::boolean IS NULL OR p.requires_prescription = $5)
          ORDER BY p.name
          LIMIT $6 OFFSET $7`,
        [
          ctx.branchId ?? null,
          query.q ?? null,
          query.categoryCode ?? null,
          query.outOfStock ?? null,
          query.requiresPrescription ?? null,
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
    return this.db.readTransaction(ctx, async (tx) => {
      const product = await tx.oneOrFail(
        `SELECT p.*, c.code AS category_code, c.name AS category_name, m.inn
           FROM products p
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN molecules m ON m.id = p.molecule_id
          WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [id],
        'Produit introuvable.',
      );
      const barcodes = await tx.many(
        'SELECT barcode, kind, is_primary FROM product_barcodes WHERE product_id = $1',
        [id],
      );
      const lots = await tx.many(
        `SELECT pl.id, pl.lot_number, pl.expiry_date, pl.is_quarantined,
                b.code AS branch_code, b.name AS branch_name,
                si.quantity, si.available_quantity, si.average_cost
           FROM stock_items si
           JOIN branches b ON b.id = si.branch_id
           LEFT JOIN product_lots pl ON pl.id = si.lot_id
          WHERE si.product_id = $1 AND si.quantity > 0
          ORDER BY pl.expiry_date NULLS LAST`,
        [id],
      );
      const movements = await tx.many(
        `SELECT kind::text AS kind, quantity, unit_cost, balance_after,
                reference_kind, reason, occurred_at
           FROM stock_movements
          WHERE product_id = $1
          ORDER BY occurred_at DESC LIMIT 50`,
        [id],
      );
      return { product, barcodes, lots, movements };
    });
  }

  async create(ctx: RequestContext, dto: CreateProductDto) {
    return this.db.transaction(ctx, async (tx) => {
      // Le nombre de références est plafonné par le forfait.
      await this.entitlements.assertCanAdd(tx, ctx.organizationId as string, 'products');
      const product = await this.insertProduct(tx, ctx, dto);
      await this.audit.record(tx, {
        action: 'catalog.product_created',
        entity: 'product',
        entityId: product.id as string,
        after: { sku: dto.sku, name: dto.name, salePrice: dto.salePrice },
      });
      return product;
    });
  }

  /** Import du catalogue initial, étape de l'onboarding. */
  async import(ctx: RequestContext, dto: ImportProductsDto) {
    return this.db.transaction(ctx, async (tx) => {
      await this.entitlements.assertCanAdd(
        tx,
        ctx.organizationId as string,
        'products',
        dto.products.length,
      );

      const created: string[] = [];
      const skipped: { sku: string; reason: string }[] = [];

      for (const item of dto.products) {
        const exists = await tx.one('SELECT id FROM products WHERE sku = $1', [item.sku]);
        if (exists) {
          skipped.push({ sku: item.sku, reason: 'Référence déjà présente.' });
          continue;
        }
        const product = await this.insertProduct(tx, ctx, item);
        created.push(product.sku as string);
      }

      await tx.query(
        `UPDATE organizations SET onboarding_step = 'catalog_import' WHERE id = $1`,
        [ctx.organizationId],
      );
      await this.audit.record(tx, {
        action: 'catalog.imported',
        entity: 'product',
        after: { created: created.length, skipped: skipped.length },
      });

      return { created: created.length, skipped, importedSkus: created };
    });
  }

  private async insertProduct(tx: Tx, ctx: RequestContext, dto: CreateProductDto) {
    const organizationId = ctx.organizationId as string;

    const categoryId = dto.categoryCode
      ? (
          await tx.oneOrFail<{ id: string }>(
            `INSERT INTO product_categories (organization_id, code, name)
             VALUES ($1,$2,$2)
             ON CONFLICT (organization_id, code) DO UPDATE SET code = EXCLUDED.code
             RETURNING id`,
            [organizationId, dto.categoryCode],
          )
        ).id
      : null;

    const moleculeId = dto.inn
      ? (
          await tx.oneOrFail<{ id: string }>(
            `INSERT INTO molecules (organization_id, inn) VALUES ($1,$2)
             ON CONFLICT (organization_id, inn) DO UPDATE SET inn = EXCLUDED.inn
             RETURNING id`,
            [organizationId, dto.inn],
          )
        ).id
      : null;

    const product = await tx.oneOrFail(
      `INSERT INTO products
         (organization_id, sku, name, commercial_name, category_id, molecule_id,
          dosage, dosage_form, packaging, manufacturer, origin_country, unit,
          units_per_pack, requires_prescription, is_controlled, is_cold_chain,
          storage_conditions, is_batch_tracked, has_expiry, cost_price, sale_price,
          wholesale_price, min_margin_percent, reorder_point, reorder_quantity,
          expiry_alert_days, notes,
          currency, tax_rate_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
               $20,$21,$22,$23,$24,$25,$26,$27,
               (SELECT currency FROM organizations WHERE id = $1),
               (SELECT id FROM tax_rates WHERE organization_id = $1 AND is_default LIMIT 1))
       RETURNING *`,
      [
        organizationId, dto.sku, dto.name, dto.commercialName ?? null,
        categoryId, moleculeId, dto.dosage ?? null, dto.dosageForm ?? null,
        dto.packaging ?? null, dto.manufacturer ?? null, dto.originCountry ?? null,
        dto.unit ?? 'unit', dto.unitsPerPack ?? 1,
        dto.requiresPrescription ?? false, dto.isControlled ?? false,
        dto.isColdChain ?? false, dto.storageConditions ?? null,
        dto.isBatchTracked ?? true, dto.hasExpiry ?? true,
        dto.costPrice ?? 0, dto.salePrice, dto.wholesalePrice ?? 0,
        dto.minMarginPercent ?? null, dto.reorderPoint ?? 0,
        dto.reorderQuantity ?? 0, dto.expiryAlertDays ?? 90, dto.notes ?? null,
      ],
    );

    for (const [index, barcode] of (dto.barcodes ?? []).entries()) {
      await tx.query(
        `INSERT INTO product_barcodes (organization_id, product_id, barcode, is_primary)
         VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, barcode) DO NOTHING`,
        [organizationId, product.id, barcode, index === 0],
      );
    }
    return product;
  }

  async update(ctx: RequestContext, id: string, dto: UpdateProductDto) {
    const columns: Record<string, unknown> = {
      sku: dto.sku, name: dto.name, commercial_name: dto.commercialName,
      dosage: dto.dosage, dosage_form: dto.dosageForm, packaging: dto.packaging,
      manufacturer: dto.manufacturer, unit: dto.unit, units_per_pack: dto.unitsPerPack,
      requires_prescription: dto.requiresPrescription, is_controlled: dto.isControlled,
      is_cold_chain: dto.isColdChain, storage_conditions: dto.storageConditions,
      is_batch_tracked: dto.isBatchTracked, has_expiry: dto.hasExpiry,
      cost_price: dto.costPrice, sale_price: dto.salePrice,
      wholesale_price: dto.wholesalePrice, min_margin_percent: dto.minMarginPercent,
      reorder_point: dto.reorderPoint, reorder_quantity: dto.reorderQuantity,
      expiry_alert_days: dto.expiryAlertDays, notes: dto.notes, is_active: dto.isActive,
    };
    const entries = Object.entries(columns).filter(([, value]) => value !== undefined);

    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Produit introuvable.',
      );
      if (entries.length === 0) return before;

      const assignments = entries
        .map(([column], index) => `${column} = $${index + 2}`)
        .join(', ');
      const after = await tx.oneOrFail(
        `UPDATE products SET ${assignments} WHERE id = $1 RETURNING *`,
        [id, ...entries.map(([, value]) => value)],
      );
      await this.audit.record(tx, {
        action: 'catalog.product_updated',
        entity: 'product',
        entityId: id,
        before,
        after,
      });
      return after;
    });
  }

  async archive(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const product = await tx.oneOrFail(
        `UPDATE products SET deleted_at = now(), is_active = false
          WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [id],
        'Produit introuvable.',
      );
      await this.audit.record(tx, {
        action: 'catalog.product_archived',
        entity: 'product',
        entityId: id,
        before: product,
      });
      return { message: 'Produit archivé.', product };
    });
  }

  async categories(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT c.id, c.code, c.name, c.parent_id,
                (SELECT count(*) FROM products p
                  WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS products
           FROM product_categories c ORDER BY c.sort_order, c.name`,
      ),
    );
  }
}
