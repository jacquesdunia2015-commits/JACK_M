import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { EntitlementsService } from '../../../common/entitlements/entitlements.service';
import {
  CreateProductDto,
  ImporterReferenceDto,
  ImportProductsDto,
  SearchProductsDto,
  UpdateProductDto,
} from './dto';
import {
  CATALOGUE_REFERENCE, CATEGORIES_REFERENCE, DEVISE_REFERENCE, ProduitReference,
} from './reference-kivu';

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
                p.is_batch_tracked, p.has_expiry, p.reorder_point, p.expiry_alert_days, p.is_active,
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
      // Au comptoir, on connaît le nom du médicament, rarement une référence :
      // on la tire du nom plutôt que de bloquer la saisie.
      if (!dto.sku?.trim()) dto.sku = await this.referenceLibre(tx, dto.name);
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
        if (!item.sku?.trim()) item.sku = await this.referenceLibre(tx, item.name);
        const exists = await tx.one('SELECT id FROM products WHERE sku = $1', [item.sku]);
        if (exists) {
          skipped.push({ sku: item.sku as string, reason: 'Référence déjà présente.' });
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

  /**
   * Catalogue de référence, chaque produit marqué s'il figure déjà au
   * catalogue de la pharmacie (même référence ou même nom).
   */
  async reference(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const { currency } = await tx.oneOrFail<{ currency: string }>(
        'SELECT currency FROM organizations WHERE id = $1',
        [ctx.organizationId],
      );
      const presents = await this.dejaPresents(tx, CATALOGUE_REFERENCE);
      return {
        referenceCurrency: DEVISE_REFERENCE,
        currency,
        categories: CATEGORIES_REFERENCE,
        items: CATALOGUE_REFERENCE.map((p) => ({ ...p, inCatalog: presents.has(p.code) })),
      };
    });
  }

  /**
   * Reprend des produits du catalogue de référence. Hors dollar, la
   * pharmacie donne ses propres prix : un prix indicatif en dollars ne
   * peut pas devenir un prix en francs.
   */
  async importerReference(ctx: RequestContext, dto: ImporterReferenceDto) {
    const parCode = new Map(CATALOGUE_REFERENCE.map((p) => [p.code, p]));
    const inconnus = dto.items.filter((i) => !parCode.has(i.code)).map((i) => i.code);
    if (inconnus.length > 0) {
      throw new BadRequestException(`Produits inconnus du catalogue de référence : ${inconnus.join(', ')}.`);
    }

    return this.db.transaction(ctx, async (tx) => {
      const organizationId = ctx.organizationId as string;
      const { currency } = await tx.oneOrFail<{ currency: string }>(
        'SELECT currency FROM organizations WHERE id = $1',
        [organizationId],
      );
      if (currency !== DEVISE_REFERENCE) {
        const sansPrix = dto.items.filter((i) => i.salePrice === undefined).map((i) => i.code);
        if (sansPrix.length > 0) {
          throw new BadRequestException(
            `Vos prix sont en ${currency} : indiquez le prix de vente de chaque produit ` +
              `(les prix indicatifs sont en ${DEVISE_REFERENCE}). Manquant : ${sansPrix.join(', ')}.`,
          );
        }
      }

      const choisis = [...new Map(dto.items.map((i) => [i.code, i])).values()];
      const presents = await this.dejaPresents(tx, choisis.map((i) => parCode.get(i.code) as ProduitReference));
      const aCreer = choisis.filter((i) => !presents.has(i.code));
      await this.entitlements.assertCanAdd(tx, organizationId, 'products', aCreer.length);

      // Les catégories reçoivent leur nom lisible ; une catégorie créée
      // plus tôt sous son seul code est renommée, une autre est laissée.
      for (const code of new Set(aCreer.map((i) => (parCode.get(i.code) as ProduitReference).categoryCode))) {
        await tx.query(
          `INSERT INTO product_categories (organization_id, code, name) VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
            WHERE product_categories.name = product_categories.code`,
          [organizationId, code, CATEGORIES_REFERENCE[code] ?? code],
        );
      }

      const crees: string[] = [];
      for (const choix of aCreer) {
        const p = parCode.get(choix.code) as ProduitReference;
        const enDollars = currency === DEVISE_REFERENCE;
        await this.insertProduct(tx, ctx, {
          sku: p.code,
          name: p.name,
          inn: p.inn ?? undefined,
          categoryCode: p.categoryCode,
          dosage: p.dosage ?? undefined,
          dosageForm: p.dosageForm,
          packaging: p.packaging,
          unit: p.unit,
          requiresPrescription: p.requiresPrescription,
          isControlled: p.isControlled,
          isColdChain: p.isColdChain,
          hasExpiry: p.hasExpiry,
          isBatchTracked: p.hasExpiry,
          salePrice: choix.salePrice ?? p.salePrice,
          costPrice: choix.costPrice ?? (enDollars ? p.costPrice : 0),
        });
        crees.push(p.code);
      }

      await this.audit.record(tx, {
        action: 'catalog.reference_imported',
        entity: 'product',
        after: { created: crees.length, skipped: choisis.length - crees.length },
      });
      return {
        created: crees.length,
        skipped: choisis.filter((i) => presents.has(i.code)).map((i) => i.code),
        importedSkus: crees,
      };
    });
  }

  /** Codes de référence déjà au catalogue, par référence ou par nom. */
  private async dejaPresents(tx: Tx, produits: ProduitReference[]): Promise<Set<string>> {
    const lignes = await tx.many<{ code: string }>(
      `SELECT r.code
         FROM unnest($1::text[], $2::text[]) AS r(code, nom)
        WHERE EXISTS (SELECT 1 FROM products p
                       WHERE p.deleted_at IS NULL
                         AND (p.sku = r.code OR lower(p.name) = lower(r.nom)))`,
      [produits.map((p) => p.code), produits.map((p) => p.name)],
    );
    return new Set(lignes.map((l) => l.code));
  }

  /** Référence tirée du nom : « Paracétamol 500 mg » → PARACETAMOL-500-MG. */
  private async referenceLibre(tx: Tx, nom: string): Promise<string> {
    const base =
      nom
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24)
        .replace(/-+$/g, '') || 'PRODUIT';
    for (let i = 1; i <= 50; i += 1) {
      const reference = i === 1 ? base : `${base}-${i}`;
      const prise = await tx.one('SELECT 1 FROM products WHERE sku = $1', [reference]);
      if (!prise) return reference;
    }
    return `${base}-${Date.now().toString(36).toUpperCase()}`;
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
