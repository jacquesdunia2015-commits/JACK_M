import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { INDICATIFS_PAYS, normaliserTelephone } from '../../../common/telephone';
import {
  CreateSupplierDto,
  SupplierProductDto,
  UpdateSupplierDto,
  UpdateSupplierProductDto,
} from './suppliers.dto';

/**
 * Répertoire des fournisseurs et catalogue de chacun.
 *
 * Il sert avant toute commande : noter qui vend quoi, à quel prix, et
 * comparer. C'est pourquoi il relève du module « suppliers », présent dans
 * tous les forfaits, et non du module d'achats.
 */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Fournisseurs
  // -------------------------------------------------------------------
  async list(ctx: RequestContext, search?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT s.*,
                (SELECT count(*) FROM supplier_products sp
                  WHERE sp.supplier_id = s.id) AS products,
                (SELECT count(*) FROM supplier_products sp
                  WHERE sp.supplier_id = s.id AND sp.is_available) AS available_products,
                (SELECT count(*) FROM purchase_orders po
                  WHERE po.supplier_id = s.id) AS orders,
                (SELECT COALESCE(sum(po.total - po.amount_paid), 0) FROM purchase_orders po
                  WHERE po.supplier_id = s.id AND po.status <> 'cancelled') AS balance
           FROM suppliers s
          WHERE ($1::text IS NULL
                 OR s.name ILIKE '%'||$1||'%' OR s.code ILIKE '%'||$1||'%'
                 OR s.city ILIKE '%'||$1||'%' OR s.phone LIKE '%'||$1||'%')
          ORDER BY s.is_active DESC, s.name`,
        [search?.trim() || null],
      ),
    );
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const supplier = await tx.oneOrFail(
        'SELECT * FROM suppliers WHERE id = $1',
        [id],
        'Fournisseur introuvable.',
      );
      const products = await tx.many(
        `SELECT sp.id, sp.product_id, sp.presentation, sp.last_cost AS price, sp.currency,
                sp.min_order_quantity, sp.is_available, sp.is_preferred,
                sp.supplier_reference, sp.notes, sp.price_updated_at,
                COALESCE(p.name, sp.product_name) AS name, p.sku
           FROM supplier_products sp
           LEFT JOIN products p ON p.id = sp.product_id
          WHERE sp.supplier_id = $1
          ORDER BY sp.is_available DESC, lower(COALESCE(p.name, sp.product_name))`,
        [id],
      );
      return { ...supplier, products };
    });
  }

  async create(ctx: RequestContext, dto: CreateSupplierDto) {
    return this.db.transaction(ctx, async (tx) => {
      const pays = await this.paysParDefaut(tx, ctx, dto.countryCode);
      const telephone = await this.telephone(tx, ctx, dto.phone, pays);
      await this.refuserDoublon(tx, telephone);
      const code = dto.code?.trim() || (await this.codeLibre(tx, dto.name));

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
          ctx.organizationId, code, dto.name.trim(), dto.kind ?? 'wholesaler',
          dto.contactName ?? null, dto.email?.toLowerCase() ?? null, telephone,
          dto.address ?? null, dto.city ?? null, pays,
          dto.taxId ?? null, dto.currency?.toUpperCase() ?? null, dto.paymentTermsDays ?? 0,
          dto.leadTimeDays ?? 7, dto.creditLimit ?? 0, dto.notes ?? null,
        ],
      );
      await this.audit.record(tx, {
        action: 'purchasing.supplier_created',
        entity: 'supplier',
        entityId: supplier.id as string,
        after: { code, name: dto.name, phone: telephone },
      });
      return supplier;
    });
  }

  async update(ctx: RequestContext, id: string, dto: UpdateSupplierDto) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail<Record<string, unknown>>(
        'SELECT * FROM suppliers WHERE id = $1',
        [id],
        'Fournisseur introuvable.',
      );

      const pays =
        dto.countryCode !== undefined
          ? await this.paysParDefaut(tx, ctx, dto.countryCode)
          : (avant.country_code as string | null);
      // Le numéro se renormalise si le pays change : « 0772… » n'a pas le
      // même indicatif à Kampala qu'à Bukavu.
      const telephone =
        dto.phone !== undefined
          ? await this.telephone(tx, ctx, dto.phone, pays)
          : undefined;
      if (telephone && telephone !== avant.phone) await this.refuserDoublon(tx, telephone, id);

      const champs: Record<string, unknown> = {
        name: dto.name?.trim(),
        phone: telephone,
        email: dto.email === undefined ? undefined : dto.email.toLowerCase() || null,
        country_code: dto.countryCode === undefined ? undefined : pays,
        city: dto.city,
        address: dto.address,
        contact_name: dto.contactName,
        code: dto.code?.trim(),
        kind: dto.kind,
        tax_id: dto.taxId,
        currency: dto.currency?.toUpperCase(),
        payment_terms_days: dto.paymentTermsDays,
        lead_time_days: dto.leadTimeDays,
        credit_limit: dto.creditLimit,
        notes: dto.notes,
        is_active: dto.isActive,
      };
      const apres = await this.miseAJour(tx, 'suppliers', id, champs);
      await this.audit.record(tx, {
        action: 'purchasing.supplier_updated',
        entity: 'supplier',
        entityId: id,
        before: avant,
        after: apres,
      });
      return apres;
    });
  }

  // -------------------------------------------------------------------
  // Catalogue d'un fournisseur
  // -------------------------------------------------------------------
  async addProduct(ctx: RequestContext, supplierId: string, dto: SupplierProductDto) {
    return this.db.transaction(ctx, async (tx) => {
      const supplier = await tx.oneOrFail<{ id: string; currency: string | null }>(
        'SELECT id, currency FROM suppliers WHERE id = $1',
        [supplierId],
        'Fournisseur introuvable.',
      );
      const devise = dto.currency?.toUpperCase() ?? supplier.currency;

      let ligne: Record<string, unknown>;
      if (dto.productId) {
        await tx.oneOrFail(
          'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
          [dto.productId],
          'Produit introuvable dans votre catalogue.',
        );
        // Un produit déjà listé chez ce fournisseur voit simplement son
        // prix mis à jour : on ne tient qu'un prix par produit et par dépôt.
        ligne = await tx.oneOrFail(
          `INSERT INTO supplier_products
             (organization_id, supplier_id, product_id, presentation, last_cost, currency,
              min_order_quantity, is_available, is_preferred, supplier_reference, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (supplier_id, product_id) DO UPDATE SET
             presentation = COALESCE(EXCLUDED.presentation, supplier_products.presentation),
             last_cost = EXCLUDED.last_cost, currency = EXCLUDED.currency,
             min_order_quantity = EXCLUDED.min_order_quantity,
             is_available = EXCLUDED.is_available, is_preferred = EXCLUDED.is_preferred,
             supplier_reference = COALESCE(EXCLUDED.supplier_reference, supplier_products.supplier_reference),
             notes = COALESCE(EXCLUDED.notes, supplier_products.notes),
             price_updated_at = now()
           RETURNING *`,
          [
            ctx.organizationId, supplierId, dto.productId, dto.presentation ?? null,
            dto.price, devise, dto.minOrderQuantity ?? 1, dto.isAvailable ?? true,
            dto.isPreferred ?? false, dto.supplierReference ?? null, dto.notes ?? null,
          ],
        );
      } else {
        const nom = (dto.productName as string).trim();
        const existe = await tx.one(
          `SELECT id FROM supplier_products
            WHERE supplier_id = $1 AND product_id IS NULL
              AND lower(product_name) = lower($2)
              AND lower(COALESCE(presentation, '')) = lower(COALESCE($3, ''))`,
          [supplierId, nom, dto.presentation ?? null],
        );
        if (existe) {
          throw new ConflictException(
            `« ${nom} » figure déjà au catalogue de ce fournisseur : modifiez son prix plutôt.`,
          );
        }
        ligne = await tx.oneOrFail(
          `INSERT INTO supplier_products
             (organization_id, supplier_id, product_name, presentation, last_cost, currency,
              min_order_quantity, is_available, supplier_reference, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            ctx.organizationId, supplierId, nom, dto.presentation ?? null, dto.price, devise,
            dto.minOrderQuantity ?? 1, dto.isAvailable ?? true,
            dto.supplierReference ?? null, dto.notes ?? null,
          ],
        );
      }

      if (dto.isPreferred && dto.productId) await this.seulPrefere(tx, ligne);
      await this.audit.record(tx, {
        action: 'purchasing.supplier_product_saved',
        entity: 'supplier',
        entityId: supplierId,
        after: { productId: dto.productId, productName: dto.productName, price: dto.price },
      });
      return ligne;
    });
  }

  async updateProduct(
    ctx: RequestContext,
    supplierId: string,
    lineId: string,
    dto: UpdateSupplierProductDto,
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail<Record<string, unknown>>(
        'SELECT * FROM supplier_products WHERE id = $1 AND supplier_id = $2',
        [lineId, supplierId],
        'Article introuvable chez ce fournisseur.',
      );
      const prixChange = dto.price !== undefined && Number(avant.last_cost) !== dto.price;
      const apres = await this.miseAJour(tx, 'supplier_products', lineId, {
        presentation: dto.presentation,
        last_cost: dto.price,
        currency: dto.currency?.toUpperCase(),
        min_order_quantity: dto.minOrderQuantity,
        is_available: dto.isAvailable,
        is_preferred: dto.isPreferred,
        supplier_reference: dto.supplierReference,
        notes: dto.notes,
        ...(prixChange ? { price_updated_at: new Date() } : {}),
      });
      if (dto.isPreferred) await this.seulPrefere(tx, apres);
      await this.audit.record(tx, {
        action: 'purchasing.supplier_product_updated',
        entity: 'supplier',
        entityId: supplierId,
        before: { price: avant.last_cost, available: avant.is_available },
        after: { price: apres.last_cost, available: apres.is_available },
      });
      return apres;
    });
  }

  async removeProduct(ctx: RequestContext, supplierId: string, lineId: string) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail(
        'DELETE FROM supplier_products WHERE id = $1 AND supplier_id = $2 RETURNING id',
        [lineId, supplierId],
        'Article introuvable chez ce fournisseur.',
      );
      await this.audit.record(tx, {
        action: 'purchasing.supplier_product_removed',
        entity: 'supplier',
        entityId: supplierId,
        before: { lineId },
      });
      return { deleted: true };
    });
  }

  /**
   * Où acheter un produit, et à quel prix : chaque offre des fournisseurs
   * actifs, la moins chère d'abord. La moins chère des offres disponibles
   * est signalée pour chaque article et chaque devise — on ne compare pas
   * des dollars et des francs congolais.
   */
  async comparePrices(ctx: RequestContext, search: string) {
    const terme = search?.trim();
    if (!terme || terme.length < 2) {
      throw new BadRequestException('Saisissez au moins deux lettres du produit recherché.');
    }
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `WITH offres AS (
           SELECT sp.id, sp.product_id, p.sku,
                  COALESCE(p.name, sp.product_name) AS name, sp.presentation,
                  sp.last_cost AS price, sp.currency, sp.min_order_quantity,
                  sp.is_available, sp.price_updated_at,
                  s.id AS supplier_id, s.name AS supplier_name, s.city AS supplier_city,
                  s.country_code AS supplier_country, s.phone AS supplier_phone,
                  COALESCE(sp.product_id::text,
                           lower(sp.product_name) || '|' || lower(COALESCE(sp.presentation, '')))
                    AS article
             FROM supplier_products sp
             JOIN suppliers s ON s.id = sp.supplier_id AND s.is_active
             LEFT JOIN products p ON p.id = sp.product_id
            WHERE COALESCE(p.name, sp.product_name) ILIKE '%'||$1||'%'
               OR p.sku ILIKE '%'||$1||'%'
         )
         SELECT o.*,
                (o.is_available AND o.price = min(o.price) FILTER (WHERE o.is_available)
                   OVER (PARTITION BY o.article, o.currency)) AS is_cheapest
           FROM offres o
          ORDER BY lower(o.name), o.article, o.is_available DESC, o.price
          LIMIT 300`,
        [terme],
      ),
    );
  }

  // -------------------------------------------------------------------
  // Outils
  // -------------------------------------------------------------------
  private async paysParDefaut(tx: Tx, ctx: RequestContext, code?: string | null) {
    if (code) return code.toUpperCase();
    const org = await tx.one<{ country_code: string | null }>(
      'SELECT country_code FROM organizations WHERE id = $1',
      [ctx.organizationId],
    );
    return org?.country_code ?? null;
  }

  /** Numéro international, avec l'indicatif du pays du fournisseur. */
  private async telephone(tx: Tx, ctx: RequestContext, brut: string, pays: string | null) {
    let indicatif = pays ? INDICATIFS_PAYS[pays] : undefined;
    if (!indicatif) {
      const org = await tx.one<{ phone_prefix: string | null }>(
        `SELECT cs.phone_prefix FROM organizations o
           JOIN country_settings cs ON cs.code = o.country_code
          WHERE o.id = $1`,
        [ctx.organizationId],
      );
      indicatif = org?.phone_prefix ?? '+243';
    }
    const telephone = normaliserTelephone(brut, indicatif);
    if (!telephone) {
      throw new BadRequestException(
        'Numéro de téléphone invalide : indiquez-le avec l’indicatif du pays ou en commençant par 0.',
      );
    }
    return telephone;
  }

  /** Un même numéro désigne presque toujours le même dépôt, saisi deux fois. */
  private async refuserDoublon(tx: Tx, telephone: string, saufId?: string) {
    const doublon = await tx.one<{ name: string }>(
      'SELECT name FROM suppliers WHERE phone = $1 AND ($2::uuid IS NULL OR id <> $2)',
      [telephone, saufId ?? null],
    );
    if (doublon) {
      throw new ConflictException(
        `Ce numéro est déjà celui du fournisseur « ${doublon.name} ».`,
      );
    }
  }

  /** Référence courte tirée du nom : « Dépôt Shalom » → DEPOT-SHALOM. */
  private async codeLibre(tx: Tx, nom: string) {
    const base =
      nom
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24)
        .replace(/-+$/g, '') || 'FOURNISSEUR';
    for (let i = 1; i <= 50; i += 1) {
      const code = i === 1 ? base : `${base}-${i}`;
      const pris = await tx.one('SELECT 1 FROM suppliers WHERE code = $1', [code]);
      if (!pris) return code;
    }
    return `${base}-${Date.now().toString(36).toUpperCase()}`;
  }

  /** Un seul fournisseur préféré par produit : celui des propositions de commande. */
  private async seulPrefere(tx: Tx, ligne: Record<string, unknown>) {
    if (!ligne.product_id) return;
    await tx.query(
      `UPDATE supplier_products SET is_preferred = false
        WHERE product_id = $1 AND id <> $2 AND is_preferred`,
      [ligne.product_id, ligne.id],
    );
  }

  /** UPDATE des seuls champs fournis (undefined = inchangé). */
  private async miseAJour(
    tx: Tx,
    table: 'suppliers' | 'supplier_products',
    id: string,
    champs: Record<string, unknown>,
  ) {
    const fournis = Object.entries(champs).filter(([, v]) => v !== undefined);
    if (fournis.length === 0) {
      return tx.oneOrFail<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    }
    const affectations = fournis.map(([colonne], i) => `${colonne} = $${i + 2}`).join(', ');
    return tx.oneOrFail<Record<string, unknown>>(
      `UPDATE ${table} SET ${affectations} WHERE id = $1 RETURNING *`,
      [id, ...fournis.map(([, v]) => v)],
    );
  }
}
