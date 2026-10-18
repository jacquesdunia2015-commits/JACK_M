import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { niveauPeremption } from '../../../common/niveau-peremption';
import { INDICATIFS_PAYS, normaliserTelephone } from '../../../common/telephone';
import {
  CreateSupplierDto,
  SupplierProductDto,
  UpdateSupplierDto,
  UpdateSupplierProductDto,
} from './suppliers.dto';

/**
 * Expression SQL qui compare sans casse ni accents : « metro » trouve
 * « Métronidazole ». L'extension unaccent n'est pas toujours installable
 * chez un hébergeur ; translate() couvre les lettres du français. Les
 * majuscules accentuées sont traduites explicitement : sous un classement
 * « C », lower() ne transforme que les lettres sans accent.
 */
const ACCENTS = 'àâäáãåéèêëíìîïóòôöõúùûüçñÿÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑŸ';
const SANS = 'aaaaaaeeeeiiiiooooouuuucnyaaaaaaeeeeiiiiooooouuuucny';
const SANS_ACCENTS = (expression: string) =>
  `translate(lower(${expression}), '${ACCENTS}', '${SANS}')`;

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
                 OR ${SANS_ACCENTS('s.name')} LIKE '%'||${SANS_ACCENTS('$1')}||'%'
                 OR ${SANS_ACCENTS('s.city')} LIKE '%'||${SANS_ACCENTS('$1')}||'%'
                 OR s.code ILIKE '%'||$1||'%' OR s.phone LIKE '%'||$1||'%')
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
                to_char(sp.manufacture_date, 'YYYY-MM-DD') AS manufacture_date,
                to_char(sp.expiry_date, 'YYYY-MM-DD') AS expiry_date,
                (sp.expiry_date IS NOT NULL AND sp.expiry_date < CURRENT_DATE) AS is_expired,
                sp.expiry_date - CURRENT_DATE AS days_to_expiry, p.expiry_alert_days,
                COALESCE(p.name, sp.product_name) AS name, p.sku
           FROM supplier_products sp
           LEFT JOIN products p ON p.id = sp.product_id
          WHERE sp.supplier_id = $1
          ORDER BY sp.is_available DESC, lower(COALESCE(p.name, sp.product_name))`,
        [id],
      );
      return { ...supplier, products: products.map(avecNiveauPeremption) };
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
      verifierDates(dto.manufactureDate, dto.expiryDate);

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
              min_order_quantity, is_available, is_preferred, supplier_reference, notes,
              manufacture_date, expiry_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           -- Des dates saisies décrivent un nouveau lot : elles remplacent
           -- ensemble les anciennes, pour ne jamais marier la fabrication
           -- d'un lot à l'expiration d'un autre.
           ON CONFLICT (supplier_id, product_id) DO UPDATE SET
             manufacture_date = CASE WHEN $12::date IS NULL AND $13::date IS NULL
                                     THEN supplier_products.manufacture_date
                                     ELSE EXCLUDED.manufacture_date END,
             expiry_date = CASE WHEN $12::date IS NULL AND $13::date IS NULL
                                THEN supplier_products.expiry_date
                                ELSE EXCLUDED.expiry_date END,
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
            dto.manufactureDate ?? null, dto.expiryDate ?? null,
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
              min_order_quantity, is_available, supplier_reference, notes,
              manufacture_date, expiry_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING *`,
          [
            ctx.organizationId, supplierId, nom, dto.presentation ?? null, dto.price, devise,
            dto.minOrderQuantity ?? 1, dto.isAvailable ?? true,
            dto.supplierReference ?? null, dto.notes ?? null,
            dto.manufactureDate ?? null, dto.expiryDate ?? null,
          ],
        );
      }

      if (dto.isPreferred && dto.productId) await this.seulPrefere(tx, ligne);
      await this.audit.record(tx, {
        action: 'purchasing.supplier_product_saved',
        entity: 'supplier',
        entityId: supplierId,
        after: {
          productId: dto.productId, productName: dto.productName, price: dto.price,
          manufactureDate: dto.manufactureDate, expiryDate: dto.expiryDate,
        },
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
      const fabrication = dto.clearManufactureDate ? null : dto.manufactureDate;
      const expiration = dto.clearExpiryDate ? null : dto.expiryDate;
      // L'ordre se vérifie avec les dates qui resteront après la modification.
      verifierDates(
        fabrication === undefined ? iso(avant.manufacture_date) : fabrication,
        expiration === undefined ? iso(avant.expiry_date) : expiration,
      );
      const apres = await this.miseAJour(tx, 'supplier_products', lineId, {
        presentation: dto.presentation,
        last_cost: dto.price,
        currency: dto.currency?.toUpperCase(),
        min_order_quantity: dto.minOrderQuantity,
        is_available: dto.isAvailable,
        is_preferred: dto.isPreferred,
        supplier_reference: dto.supplierReference,
        notes: dto.notes,
        manufacture_date: fabrication,
        expiry_date: expiration,
        ...(prixChange ? { price_updated_at: new Date() } : {}),
      });
      if (dto.isPreferred) await this.seulPrefere(tx, apres);
      await this.audit.record(tx, {
        action: 'purchasing.supplier_product_updated',
        entity: 'supplier',
        entityId: supplierId,
        before: {
          price: avant.last_cost, available: avant.is_available,
          manufactureDate: iso(avant.manufacture_date), expiryDate: iso(avant.expiry_date),
        },
        after: {
          price: apres.last_cost, available: apres.is_available,
          manufactureDate: iso(apres.manufacture_date), expiryDate: iso(apres.expiry_date),
        },
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
   * des dollars et des francs congolais. Une offre dont la date
   * d'expiration est passée ne compte pas comme disponible.
   */
  async comparePrices(ctx: RequestContext, search?: string, productId?: string) {
    const terme = search?.trim() ?? '';
    // Par produit du catalogue : toutes ses offres, même libellées autrement
    // chez chaque fournisseur. Sinon, par nom : au moins deux lettres.
    const parProduit = productId && /^[0-9a-f-]{36}$/i.test(productId) ? productId : null;
    if (!parProduit && terme.length < 2) {
      throw new BadRequestException('Saisissez au moins deux lettres du produit recherché.');
    }
    const offres = await this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `WITH offres AS (
           SELECT sp.id, sp.product_id, p.sku,
                  COALESCE(p.name, sp.product_name) AS name, sp.presentation,
                  sp.last_cost AS price, sp.currency, sp.min_order_quantity,
                  sp.is_available, sp.price_updated_at,
                  to_char(sp.manufacture_date, 'YYYY-MM-DD') AS manufacture_date,
                  to_char(sp.expiry_date, 'YYYY-MM-DD') AS expiry_date,
                  (sp.expiry_date IS NOT NULL AND sp.expiry_date < CURRENT_DATE) AS is_expired,
                  sp.expiry_date - CURRENT_DATE AS days_to_expiry, p.expiry_alert_days,
                  s.id AS supplier_id, s.name AS supplier_name, s.city AS supplier_city,
                  s.country_code AS supplier_country, s.phone AS supplier_phone,
                  COALESCE(sp.product_id::text,
                           lower(sp.product_name) || '|' || lower(COALESCE(sp.presentation, '')))
                    AS article
             FROM supplier_products sp
             JOIN suppliers s ON s.id = sp.supplier_id AND s.is_active
             LEFT JOIN products p ON p.id = sp.product_id
            WHERE CASE WHEN $2::uuid IS NOT NULL
                       THEN sp.product_id = $2::uuid
                            OR (sp.product_id IS NULL AND ${SANS_ACCENTS('sp.product_name')}
                                = ${SANS_ACCENTS('(SELECT name FROM products WHERE id = $2::uuid)')})
                       ELSE ${SANS_ACCENTS('COALESCE(p.name, sp.product_name)')}
                              LIKE '%'||${SANS_ACCENTS('$1')}||'%'
                            OR p.sku ILIKE '%'||$1||'%'
                  END
         )
         SELECT o.*,
                (o.is_available AND NOT o.is_expired
                 AND o.price = min(o.price) FILTER (WHERE o.is_available AND NOT o.is_expired)
                   OVER (PARTITION BY o.article, o.currency)) AS is_cheapest
           FROM offres o
          ORDER BY lower(o.name), o.article, (o.is_available AND NOT o.is_expired) DESC, o.price
          LIMIT 300`,
        [terme, parProduit],
      ),
    );
    return offres.map(avecNiveauPeremption);
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

/** Date SQL (Date JS ou texte) au format AAAA-MM-JJ, ou null. */
function iso(valeur: unknown): string | null {
  if (!valeur) return null;
  if (valeur instanceof Date) {
    // Une colonne « date » arrive à minuit heure locale : on lit donc la
    // date locale, pas l'UTC, pour ne pas reculer d'un jour.
    const mois = String(valeur.getMonth() + 1).padStart(2, '0');
    const jour = String(valeur.getDate()).padStart(2, '0');
    return `${valeur.getFullYear()}-${mois}-${jour}`;
  }
  return String(valeur).slice(0, 10);
}

/**
 * Fabrication dans le passé, expiration après la fabrication. Vérifié ici
 * pour un message clair ; la base porte la même règle (migration 020).
 */
function verifierDates(fabrication?: string | null, expiration?: string | null) {
  const aujourdhui = iso(new Date()) as string;
  if (fabrication && fabrication > aujourdhui) {
    throw new BadRequestException('La date de fabrication ne peut pas être dans le futur.');
  }
  if (fabrication && expiration && expiration <= fabrication) {
    throw new BadRequestException("La date d'expiration doit suivre la date de fabrication.");
  }
}

/**
 * Couleur de la date d'expiration d'une offre. Un article rattaché à un
 * produit de la pharmacie suit le délai d'alerte de ce produit ; un article
 * libre, le délai par défaut.
 */
function avecNiveauPeremption<T extends Record<string, unknown>>(ligne: T) {
  return {
    ...ligne,
    expiry_level: niveauPeremption(
      ligne.days_to_expiry as number | null,
      ligne.expiry_alert_days as number | null,
    ),
  };
}
