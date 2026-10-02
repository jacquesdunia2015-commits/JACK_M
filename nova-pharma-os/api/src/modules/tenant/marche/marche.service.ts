import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { B2bService } from '../b2b/b2b.service';
import { CustomersService } from '../customers/customers.service';
import { PurchasingService } from '../purchasing/purchasing.service';

export interface OffreInput {
  productId?: string; name?: string; dosage?: string; form?: string; presentation?: string; manufacturer?: string;
  unitPrice: number; minQuantity?: number; availability?: string; expiryDate?: string | null; isActive?: boolean;
}

interface Offre {
  id: string; organization_id: string; product_id: string | null; name: string; dosage: string | null; presentation: string | null;
  unit_price: string; currency: string; min_quantity: string; availability: string; is_active: boolean;
}

interface Commande {
  id: string; organization_id: string; seller_organization_id: string; number: string; status: string;
  lines: { offerId: string; productId: string | null; name: string; presentation: string | null; quantity: number; unitPrice: number }[];
  total: string; currency: string; buyer_name: string; buyer_city: string | null; buyer_phone: string | null; seller_name: string;
  seller_b2b_order_id: string | null; buyer_receipt_id: string | null;
}

const designation = (nom: string, dosage: string | null) =>
  dosage && !nom.toLowerCase().includes(dosage.toLowerCase()) ? `${nom} ${dosage}` : nom;

/**
 * Place de marché entre pharmacies et dépôts : offres publiées, commandes
 * entre organisations, acceptation qui crée la commande professionnelle
 * chez le vendeur, réception en stock chez l'acheteur.
 */
@Injectable()
export class MarcheService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly b2b: B2bService,
    private readonly customers: CustomersService,
    private readonly purchasing: PurchasingService,
  ) {}

  // ------------------------------------------------------------------
  // Vendeur : fiche et offres
  // ------------------------------------------------------------------

  async fiche(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const f = await tx.one('SELECT * FROM market_sellers WHERE organization_id = $1', [ctx.organizationId]);
      if (f) return f;
      const o = await tx.oneOrFail<{ name: string; city: string | null; phone: string | null }>(
        'SELECT COALESCE(trade_name, legal_name) AS name, city, phone FROM organizations WHERE id = $1', [ctx.organizationId],
      );
      return { organization_id: ctx.organizationId, is_listed: false, display_name: o.name, city: o.city, phone: o.phone, min_order_amount: '0' };
    });
  }

  async reglerFiche(ctx: RequestContext, dto: Record<string, unknown>) {
    return this.db.transaction(ctx, async (tx) => {
      const o = await tx.oneOrFail<{ name: string; city: string | null; phone: string | null }>(
        'SELECT COALESCE(trade_name, legal_name) AS name, city, phone FROM organizations WHERE id = $1', [ctx.organizationId],
      );
      const v = (k: string) => (dto[k] === undefined ? undefined : typeof dto[k] === 'string' ? (dto[k] as string).trim() || null : dto[k]);
      const f = await tx.oneOrFail(
        `INSERT INTO market_sellers (organization_id, is_listed, display_name, city, province, phone, whatsapp,
                                     delivery_zones, min_order_amount, payment_terms, description)
         VALUES ($1, COALESCE($2, false), COALESCE($3, $12), COALESCE($4, $13), $5, COALESCE($6, $14), $7, $8, COALESCE($9, 0), $10, $11)
         ON CONFLICT (organization_id) DO UPDATE SET
           is_listed = COALESCE($2, market_sellers.is_listed), display_name = COALESCE($3, market_sellers.display_name),
           city = COALESCE($4, market_sellers.city), province = COALESCE($5, market_sellers.province),
           phone = COALESCE($6, market_sellers.phone), whatsapp = COALESCE($7, market_sellers.whatsapp),
           delivery_zones = COALESCE($8, market_sellers.delivery_zones), min_order_amount = COALESCE($9, market_sellers.min_order_amount),
           payment_terms = COALESCE($10, market_sellers.payment_terms), description = COALESCE($11, market_sellers.description)
         RETURNING *`,
        [
          ctx.organizationId, v('isListed'), v('displayName'), v('city'), v('province'), v('phone'), v('whatsapp'),
          v('deliveryZones'), v('minOrderAmount'), v('paymentTerms'), v('description'), o.name, o.city, o.phone,
        ],
      );
      await this.audit.record(tx, { action: 'market.seller.updated', entity: 'market_seller', entityId: ctx.organizationId as string, after: f });
      return f;
    });
  }

  async mesOffres(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many('SELECT * FROM market_offers WHERE organization_id = $1 ORDER BY is_active DESC, lower(name)', [ctx.organizationId]),
    );
  }

  async creerOffre(ctx: RequestContext, dto: OffreInput) {
    return this.db.transaction(ctx, async (tx) => {
      let nom = dto.name?.trim();
      let dosage = dto.dosage?.trim() || null;
      let forme = dto.form?.trim() || null;
      if (dto.productId) {
        const p = await tx.oneOrFail<{ name: string; dosage: string | null; dosage_form: string | null }>(
          'SELECT name, dosage, dosage_form FROM products WHERE id = $1 AND deleted_at IS NULL', [dto.productId], 'Produit introuvable.',
        );
        nom ||= p.name; dosage ??= p.dosage; forme ??= p.dosage_form;
      }
      if (!nom) throw new BusinessRuleException('Indiquez le nom du produit proposé.');
      const devise = await tx.oneOrFail<{ currency: string }>('SELECT currency FROM organizations WHERE id = $1', [ctx.organizationId]);
      const o = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO market_offers (organization_id, product_id, name, dosage, form, presentation, manufacturer, unit_price,
                                    currency, min_quantity, availability, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          ctx.organizationId, dto.productId ?? null, nom, dosage, forme, dto.presentation?.trim() || null,
          dto.manufacturer?.trim() || null, dto.unitPrice, devise.currency, dto.minQuantity ?? 1,
          dto.availability ?? 'in_stock', dto.expiryDate ?? null,
        ],
      );
      await this.audit.record(tx, { action: 'market.offer.created', entity: 'market_offer', entityId: o.id, after: o });
      return o;
    });
  }

  async modifierOffre(ctx: RequestContext, id: string, dto: Partial<OffreInput>) {
    return this.db.transaction(ctx, async (tx) => {
      const colonnes: [string, unknown][] = [];
      if (dto.unitPrice !== undefined) colonnes.push(['unit_price', dto.unitPrice]);
      if (dto.minQuantity !== undefined) colonnes.push(['min_quantity', dto.minQuantity]);
      if (dto.availability !== undefined) colonnes.push(['availability', dto.availability]);
      if (dto.expiryDate !== undefined) colonnes.push(['expiry_date', dto.expiryDate]);
      if (dto.isActive !== undefined) colonnes.push(['is_active', dto.isActive]);
      if (dto.presentation !== undefined) colonnes.push(['presentation', dto.presentation?.trim() || null]);
      if (!colonnes.length) throw new BusinessRuleException('Rien à modifier.');
      const o = await tx.oneOrFail(
        `UPDATE market_offers SET ${colonnes.map(([c], i) => `${c} = $${i + 2}`).join(', ')}
          WHERE id = $1 AND organization_id = current_setting('nova.organization_id')::uuid RETURNING *`,
        [id, ...colonnes.map(([, v]) => v)], 'Offre introuvable.',
      );
      await this.audit.record(tx, { action: 'market.offer.updated', entity: 'market_offer', entityId: id, after: o });
      return o;
    });
  }

  /** Disponibilité et péremption des offres reliées à un produit, lues dans le stock du vendeur. */
  async actualiser(ctx: RequestContext) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.many<{ id: string }>(
        `UPDATE market_offers o SET
            availability = CASE WHEN s.dispo <= 0 THEN 'out' WHEN s.dispo < o.min_quantity * 5 THEN 'limited' ELSE 'in_stock' END,
            expiry_date = s.peremption
           FROM (SELECT o2.id,
                        COALESCE((SELECT sum(si.quantity - si.reserved_quantity) FROM stock_items si LEFT JOIN product_lots pl ON pl.id = si.lot_id
                                   WHERE si.product_id = o2.product_id AND COALESCE(pl.is_quarantined, false) = false
                                     AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)), 0) AS dispo,
                        (SELECT min(pl.expiry_date) FROM stock_items si JOIN product_lots pl ON pl.id = si.lot_id
                          WHERE si.product_id = o2.product_id AND si.quantity > 0 AND NOT pl.is_quarantined AND pl.expiry_date >= CURRENT_DATE) AS peremption
                   FROM market_offers o2 WHERE o2.product_id IS NOT NULL AND o2.organization_id = $1) s
          WHERE o.id = s.id
          RETURNING o.id`,
        [ctx.organizationId],
      );
      return { updated: r.length };
    });
  }

  // ------------------------------------------------------------------
  // Acheteur : recherche et commandes
  // ------------------------------------------------------------------

  /** Offres des autres organisations, du moins cher au plus cher pour chaque produit. */
  async rechercher(ctx: RequestContext, q: string, ville?: string) {
    const terme = (q ?? '').trim();
    if (terme.length < 2) return [];
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT o.id, o.organization_id AS seller_id, o.name, o.dosage, o.form, o.presentation, o.manufacturer,
                o.unit_price, o.currency, o.min_quantity, o.availability, o.expiry_date,
                s.display_name AS seller_name, s.city AS seller_city, s.province, s.min_order_amount, s.delivery_zones, s.payment_terms
           FROM market_offers o JOIN market_sellers s ON s.organization_id = o.organization_id
          WHERE o.is_active AND s.is_listed AND o.availability <> 'out'
            AND o.organization_id <> $1
            AND (o.name ILIKE '%' || $2 || '%' OR o.manufacturer ILIKE '%' || $2 || '%')
            AND ($3::text IS NULL OR s.city ILIKE $3 OR s.delivery_zones ILIKE '%' || $3 || '%')
          ORDER BY lower(o.name), o.dosage NULLS FIRST, o.unit_price
          LIMIT 100`,
        [ctx.organizationId, terme, ville?.trim() || null],
      ),
    );
  }

  async commander(ctx: RequestContext, dto: { sellerOrganizationId: string; lines: { offerId: string; quantity: number }[]; note?: string; delivery?: string }) {
    if (dto.sellerOrganizationId === ctx.organizationId) throw new BusinessRuleException('Vous ne pouvez pas commander à vous-même.');
    return this.db.transaction(ctx, async (tx) => {
      const vendeur = await tx.oneOrFail<{ display_name: string; min_order_amount: string; whatsapp: string | null; phone: string | null }>(
        'SELECT display_name, min_order_amount, whatsapp, phone FROM market_sellers WHERE organization_id = $1 AND is_listed',
        [dto.sellerOrganizationId], 'Vendeur introuvable ou retiré de la place de marché.',
      );
      const offres = await tx.many<Offre>(
        'SELECT * FROM market_offers WHERE id = ANY($1::uuid[]) AND organization_id = $2 AND is_active',
        [dto.lines.map((l) => l.offerId), dto.sellerOrganizationId],
      );
      const parId = new Map(offres.map((o) => [o.id, o]));
      const devises = new Set(offres.map((o) => o.currency));
      if (devises.size > 1) throw new BusinessRuleException('Une commande se fait dans une seule devise.');
      const lignes = dto.lines.map((l) => {
        const o = parId.get(l.offerId);
        if (!o) throw new BusinessRuleException('Une offre n’est plus disponible chez ce vendeur : actualisez la recherche.');
        if (l.quantity < Number(o.min_quantity)) throw new BusinessRuleException(`« ${o.name} » : au moins ${Number(o.min_quantity)} par commande.`);
        return { offerId: o.id, productId: o.product_id, name: designation(o.name, o.dosage), presentation: o.presentation, quantity: l.quantity, unitPrice: Number(o.unit_price) };
      });
      const total = Math.round(lignes.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
      if (total < Number(vendeur.min_order_amount)) {
        throw new BusinessRuleException(`Commande minimum chez ${vendeur.display_name} : ${Number(vendeur.min_order_amount).toLocaleString('fr-FR')} ${[...devises][0]}.`);
      }
      const acheteur = await tx.oneOrFail<{ name: string; city: string | null; phone: string | null }>(
        'SELECT COALESCE(trade_name, legal_name) AS name, city, phone FROM organizations WHERE id = $1', [ctx.organizationId],
      );
      const numero = await this.numbering.next(tx, 'market_order');
      const c = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO market_orders (organization_id, seller_organization_id, number, lines, total, currency, buyer_name, buyer_city,
                                    buyer_phone, seller_name, buyer_note, delivery_preference, created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number`,
        [
          ctx.organizationId, dto.sellerOrganizationId, numero, JSON.stringify(lignes), total, [...devises][0],
          acheteur.name, acheteur.city, acheteur.phone, vendeur.display_name, dto.note?.trim() || null, dto.delivery?.trim() || null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, { action: 'market.order.sent', entity: 'market_order', entityId: c.id, after: { number: c.number, total } });
      // Lien WhatsApp gratuit pour prévenir le vendeur.
      const tel = (vendeur.whatsapp ?? vendeur.phone ?? '').replace(/\D/g, '').replace(/^0/, '243');
      const resume = `Bonjour ${vendeur.display_name}, ${acheteur.name} vous a envoyé la commande ${c.number} (${lignes.length} produit(s), ${total.toLocaleString('fr-FR')} ${[...devises][0]}) sur NOVA PHARMA OS.`;
      return { id: c.id, number: c.number, total, whatsappLink: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(resume)}` : null };
    });
  }

  async commandes(ctx: RequestContext, sens: 'achats' | 'ventes') {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT * FROM market_orders WHERE ${sens === 'ventes' ? 'seller_organization_id' : 'organization_id'} = $1
          ORDER BY CASE status WHEN 'sent' THEN 0 WHEN 'accepted' THEN 1 WHEN 'shipped' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`,
        [ctx.organizationId],
      ),
    );
  }

  private async charger(tx: Tx, id: string) {
    return tx.oneOrFail<Commande>('SELECT * FROM market_orders WHERE id = $1 FOR UPDATE', [id], 'Commande introuvable.');
  }

  private async passer(tx: Tx, ctx: RequestContext, c: Commande, statut: string, champs: Record<string, unknown> = {}) {
    const cols = Object.keys(champs);
    const apres = await tx.oneOrFail(
      `UPDATE market_orders SET status = $2, status_changed_at = now()${cols.map((k, i) => `, ${k} = $${i + 3}`).join('')}
        WHERE id = $1 RETURNING *`,
      [c.id, statut, ...cols.map((k) => champs[k])],
    );
    await this.audit.record(tx, { action: `market.order.${statut}`, entity: 'market_order', entityId: c.id, before: { status: c.status }, after: { status: statut } });
    return apres;
  }

  /**
   * Le vendeur accepte : si chaque ligne est reliée à un produit de son
   * catalogue, la commande devient une commande professionnelle dans son
   * NOVA (préparation, sortie de stock, facture comme d'habitude).
   */
  async accepter(ctx: RequestContext, id: string, note?: string) {
    const c = await this.db.transaction(ctx, async (tx) => {
      const c = await this.charger(tx, id);
      if (c.seller_organization_id !== ctx.organizationId) throw new BusinessRuleException("Seul le vendeur accepte une commande.");
      if (c.status !== 'sent') throw new BusinessRuleException(`Commande déjà ${c.status}.`);
      return c;
    });
    let b2b: string | null = null;
    if (c.lines.every((l) => l.productId) && ctx.branchId) {
      const client = await this.clientPourAcheteur(ctx, c);
      const commande = await this.b2b.createOrder(ctx, {
        customerId: client, notes: `Place de marché ${c.number}`, clientOperationId: `market-${c.id}`,
        lines: c.lines.map((l) => ({ productId: l.productId as string, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      b2b = String(commande.order.id);
    }
    return this.db.transaction(ctx, async (tx) => this.passer(tx, ctx, await this.charger(tx, id), 'accepted', { seller_note: note?.trim() || null, seller_b2b_order_id: b2b }));
  }

  /** Fiche client professionnelle de l'acheteur chez le vendeur (créée au premier achat). */
  private async clientPourAcheteur(ctx: RequestContext, c: Commande): Promise<string> {
    const code = `MKT-${c.organization_id.slice(0, 8).toUpperCase()}`;
    const existant = await this.db.readTransaction(ctx, (tx) =>
      tx.one<{ id: string }>('SELECT id FROM customers WHERE code = $1 AND deleted_at IS NULL', [code]),
    );
    if (existant) return existant.id;
    const cree = await this.customers.create(ctx, {
      code, kind: 'professional', name: c.buyer_name, phone: c.buyer_phone ?? undefined, city: c.buyer_city ?? undefined,
      notes: 'Client de la place de marché NOVA PHARMA OS.',
    });
    return (cree as { id: string }).id;
  }

  async refuser(ctx: RequestContext, id: string, note: string) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await this.charger(tx, id);
      if (c.seller_organization_id !== ctx.organizationId) throw new BusinessRuleException('Seul le vendeur refuse une commande.');
      if (c.status !== 'sent') throw new BusinessRuleException(`Commande déjà ${c.status}.`);
      return this.passer(tx, ctx, c, 'rejected', { seller_note: note.trim() });
    });
  }

  async expedier(ctx: RequestContext, id: string, note?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await this.charger(tx, id);
      if (c.seller_organization_id !== ctx.organizationId) throw new BusinessRuleException('Seul le vendeur expédie une commande.');
      if (c.status !== 'accepted') throw new BusinessRuleException('Acceptez d’abord la commande.');
      return this.passer(tx, ctx, c, 'shipped', note ? { seller_note: note.trim() } : {});
    });
  }

  async annuler(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await this.charger(tx, id);
      if (c.organization_id !== ctx.organizationId) throw new BusinessRuleException("Seul l'acheteur annule sa commande.");
      if (!['sent', 'accepted'].includes(c.status)) throw new BusinessRuleException(`Une commande ${c.status} ne s'annule plus.`);
      return this.passer(tx, ctx, c, 'cancelled');
    });
  }

  /**
   * L'acheteur réceptionne : chaque ligne est rattachée à un produit de son
   * catalogue, avec lot et péremption ; l'entrée en stock se fait au prix
   * de la commande, chez un fournisseur au nom du vendeur.
   */
  async recevoir(ctx: RequestContext, id: string, lignes: { index: number; productId: string; quantity?: number; lotNumber?: string; expiryDate?: string }[]) {
    const c = await this.db.transaction(ctx, async (tx) => {
      const c = await this.charger(tx, id);
      if (c.organization_id !== ctx.organizationId) throw new BusinessRuleException("Seul l'acheteur réceptionne sa commande.");
      if (!['accepted', 'shipped'].includes(c.status)) throw new BusinessRuleException('Cette commande n’est pas en cours de livraison.');
      return c;
    });
    if (!lignes.length) throw new BusinessRuleException('Rattachez au moins une ligne à un produit de votre catalogue.');
    const fournisseur = await this.db.transaction(ctx, async (tx) => {
      const code = `MKT-${c.seller_organization_id.slice(0, 8).toUpperCase()}`;
      await tx.query(
        `INSERT INTO suppliers (organization_id, code, name, kind, currency, notes)
         VALUES ($1,$2,$3,'wholesaler',$4,'Vendeur de la place de marché NOVA PHARMA OS.')
         ON CONFLICT (organization_id, code) DO NOTHING`,
        [ctx.organizationId, code, c.seller_name, c.currency],
      );
      return (await tx.oneOrFail<{ id: string }>('SELECT id FROM suppliers WHERE code = $1', [code])).id;
    });
    const reception = await this.purchasing.receiveStock(ctx, {
      supplierId: fournisseur, supplierInvoiceNumber: c.number,
      lines: lignes.map((l) => {
        const ligne = c.lines[l.index];
        if (!ligne) throw new BusinessRuleException('Ligne de commande inconnue.');
        return { productId: l.productId, quantity: l.quantity ?? ligne.quantity, unitCost: ligne.unitPrice, lotNumber: l.lotNumber, expiryDate: l.expiryDate };
      }),
    } as Parameters<PurchasingService['receiveStock']>[1]);
    const recuId = reception.receipt?.id ? String(reception.receipt.id) : null;
    return this.db.transaction(ctx, async (tx) => this.passer(tx, ctx, await this.charger(tx, id), 'received', { buyer_receipt_id: recuId }));
  }
}
