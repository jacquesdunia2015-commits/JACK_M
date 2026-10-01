import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { StockService } from '../inventory/stock.service';
import { MessagingService } from '../messaging/messaging.service';

export const TYPES_ALERTE = ['recall', 'falsified', 'quality'] as const;
export const SOURCES_ALERTE = ['acorep', 'oms', 'fabricant', 'grossiste', 'autre'] as const;
export const ACTIONS_ALERTE = ['quarantine', 'return', 'destroy', 'inform'] as const;

export interface RappelInput {
  kind: string;
  title: string;
  productId?: string;
  productName?: string;
  matchTerms?: string;
  lotNumbers: string[];
  source?: string;
  reference?: string;
  description?: string;
  actionRequired?: string;
  quarantineNow?: boolean;
}

interface Rappel {
  id: string; kind: string; title: string; product_id: string | null; product_name: string;
  match_terms: string | null; lot_numbers: string[]; status: string; action_required: string;
}

/** « AB-12 34 » → « AB1234 », comme nova.lot_normalise. */
export const lotNormalise = (t: string) => t.toUpperCase().replace(/[\s\-_./]/g, '');

/** Mots significatifs d'un nom de produit (« Paracétamol 500 mg » → paracétamol, 500). */
function termes(texte: string | null | undefined): string[] {
  return (texte ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[\s,;/()]+/)
    .filter((m) => m.length >= 3 && !['mg', 'ml', 'comprime', 'comprimes', 'sirop', 'boite', 'gelule', 'gelules', 'injectable'].includes(m));
}

/**
 * Rappels de lots et alertes produits falsifiés : lots concernés en stock,
 * clients qui les ont achetés, quarantaine, destruction ou retour, et
 * blocage des réceptions d'un lot rappelé.
 */
@Injectable()
export class RappelsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Reprend dans le suivi de la pharmacie les alertes publiées par NOVA
   * PHARMA OS pour son pays, qu'elle n'a pas encore vues.
   */
  private async importerAlertes(tx: Tx, ctx: RequestContext) {
    if (tx.context.readonly) return;
    await tx.query(
      `INSERT INTO lot_recalls
         (organization_id, alert_id, kind, title, product_name, match_terms, lot_numbers, source,
          reference, description, action_required, created_at)
       SELECT $1, a.id, a.kind, a.title, a.product_name, a.match_terms, a.lot_numbers, a.source,
              a.reference, a.description, a.action_required, a.published_at
         FROM product_alerts a
        WHERE a.is_active
          AND (a.country_code IS NULL OR a.country_code = (SELECT country_code FROM organizations WHERE id = $1))
       ON CONFLICT (organization_id, alert_id) DO NOTHING`,
      [ctx.organizationId],
    );
  }

  /** Lots de la pharmacie concernés par un rappel, avec leur stock. */
  private async lotsConcernes(tx: Tx, r: Rappel) {
    const lots = r.lot_numbers.map(lotNormalise).filter(Boolean);
    const mots = r.product_id ? [] : termes(r.match_terms || r.product_name);
    return tx.many<{
      lot_id: string; product_id: string; product_name: string; dosage: string | null; lot_number: string;
      expiry_date: string | null; is_quarantined: boolean; stock: string; stock_value: string;
    }>(
      `SELECT pl.id AS lot_id, p.id AS product_id, p.name AS product_name, p.dosage, pl.lot_number,
              to_char(pl.expiry_date, 'YYYY-MM-DD') AS expiry_date, pl.is_quarantined,
              COALESCE((SELECT sum(si.quantity) FROM stock_items si WHERE si.lot_id = pl.id), 0) AS stock,
              COALESCE((SELECT sum(si.quantity * si.average_cost) FROM stock_items si WHERE si.lot_id = pl.id), 0) AS stock_value
         FROM product_lots pl
         JOIN products p ON p.id = pl.product_id
         LEFT JOIN molecules m ON m.id = p.molecule_id
        WHERE (cardinality($1::text[]) = 0 OR nova.lot_normalise(pl.lot_number) = ANY($1::text[]))
          AND ($2::uuid IS NULL OR p.id = $2)
          AND (cardinality($3::text[]) = 0 OR NOT EXISTS (
                SELECT 1 FROM unnest($3::text[]) AS mot
                 WHERE nova.sans_accent(p.name || ' ' || COALESCE(p.commercial_name, '') || ' ' || COALESCE(m.inn, '') || ' ' || COALESCE(p.dosage, ''))
                       NOT LIKE '%' || mot || '%'))
          AND (cardinality($1::text[]) > 0 OR $2::uuid IS NOT NULL)
        ORDER BY p.name, pl.lot_number`,
      [lots, r.product_id, mots],
    );
  }

  /** Clients qui ont acheté ces lots (ventes non annulées). */
  private async clientsConcernes(tx: Tx, lotIds: string[]) {
    if (!lotIds.length) return [];
    return tx.many<{ customer_id: string; name: string; phone: string | null; quantity: string; last_sale_at: string; sales: string }>(
      `SELECT c.id AS customer_id, c.name, c.phone, sum(l.quantity) AS quantity,
              max(s.sold_at) AS last_sale_at, count(DISTINCT s.id) AS sales
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id JOIN customers c ON c.id = s.customer_id
        WHERE l.lot_id = ANY($1::uuid[]) AND s.status = 'completed'
        GROUP BY c.id, c.name, c.phone ORDER BY max(s.sold_at) DESC`,
      [lotIds],
    );
  }

  private async venduSansClient(tx: Tx, lotIds: string[]) {
    if (!lotIds.length) return { quantity: 0, sales: 0 };
    const r = await tx.oneOrFail<{ q: string; n: string }>(
      `SELECT COALESCE(sum(l.quantity), 0) AS q, count(DISTINCT s.id) AS n
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id
        WHERE l.lot_id = ANY($1::uuid[]) AND s.status = 'completed' AND s.customer_id IS NULL`,
      [lotIds],
    );
    return { quantity: Number(r.q), sales: Number(r.n) };
  }

  /** Rappels de la pharmacie, avec le stock concerné de chacun. */
  async liste(ctx: RequestContext, statut?: string) {
    return this.db.transaction(ctx, async (tx) => {
      await this.importerAlertes(tx, ctx);
      const rappels = await tx.many<Rappel & Record<string, unknown>>(
        `SELECT * FROM lot_recalls WHERE ($1::text IS NULL OR status = $1)
          ORDER BY status, created_at DESC LIMIT 200`,
        [statut || null],
      );
      const sortie = [];
      for (const r of rappels) {
        const lots = r.status === 'open' ? await this.lotsConcernes(tx, r) : [];
        sortie.push({
          ...r,
          matchedLots: lots.length,
          stockUnits: lots.reduce((s, l) => s + Number(l.stock), 0),
          quarantinedLots: lots.filter((l) => l.is_quarantined).length,
        });
      }
      return sortie;
    });
  }

  /** Un rappel : les lots concernés, leur stock, et les clients qui les ont achetés. */
  async detail(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<Rappel & Record<string, unknown>>('SELECT * FROM lot_recalls WHERE id = $1', [id], 'Rappel introuvable.');
      const lots = await this.lotsConcernes(tx, r);
      const ids = lots.map((l) => l.lot_id);
      return {
        recall: r,
        lots,
        customers: await this.clientsConcernes(tx, ids),
        anonymousSales: await this.venduSansClient(tx, ids),
      };
    });
  }

  async creer(ctx: RequestContext, dto: RappelInput) {
    const lots = [...new Set(dto.lotNumbers.map((l) => l.trim()).filter(Boolean))];
    if (!lots.length && !dto.productId) throw new BusinessRuleException('Indiquez au moins un numéro de lot, ou le produit concerné.');
    const id = await this.db.transaction(ctx, async (tx) => {
      let nom = dto.productName?.trim() ?? '';
      if (dto.productId) {
        const p = await tx.oneOrFail<{ name: string; dosage: string | null }>(
          'SELECT name, dosage FROM products WHERE id = $1', [dto.productId], 'Produit introuvable.',
        );
        nom ||= [p.name, p.dosage].filter(Boolean).join(' ');
      }
      if (!nom) throw new BusinessRuleException('Indiquez le nom du produit concerné.');
      const r = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO lot_recalls
           (organization_id, kind, title, product_id, product_name, match_terms, lot_numbers, source,
            reference, description, action_required, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          ctx.organizationId, dto.kind, dto.title.trim(), dto.productId ?? null, nom, dto.matchTerms?.trim() || null,
          lots, dto.source ?? 'autre', dto.reference?.trim() || null, dto.description?.trim() || null,
          dto.actionRequired ?? 'quarantine', ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, { action: 'recalls.created', entity: 'lot_recall', entityId: r.id, after: r });
      return r.id;
    });
    if (dto.quarantineNow !== false) await this.quarantaine(ctx, id);
    return this.detail(ctx, id);
  }

  /** Bloque à la vente tous les lots concernés (ils sortent du FEFO et de la caisse hors connexion). */
  async quarantaine(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<Rappel>('SELECT * FROM lot_recalls WHERE id = $1', [id], 'Rappel introuvable.');
      if (r.status !== 'open') throw new BusinessRuleException('Ce rappel est clos.');
      const lots = (await this.lotsConcernes(tx, r)).filter((l) => !l.is_quarantined);
      const motif = `${r.kind === 'falsified' ? 'Alerte produit falsifié' : 'Rappel de lot'} : ${r.title}`;
      for (const l of lots) {
        await tx.query('UPDATE product_lots SET is_quarantined = true, quarantine_reason = $2 WHERE id = $1', [l.lot_id, motif.slice(0, 300)]);
      }
      if (lots.length) {
        await this.audit.record(tx, { action: 'recalls.quarantined', entity: 'lot_recall', entityId: id, after: { lots: lots.map((l) => l.lot_number) } });
      }
      return { quarantined: lots.length };
    });
  }

  /**
   * Sort du stock les quantités des lots concernés — détruites ou rendues au
   * fournisseur — puis clôt le rappel.
   */
  async retirer(ctx: RequestContext, id: string, resolution: 'destroyed' | 'returned', note?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<Rappel>('SELECT * FROM lot_recalls WHERE id = $1 FOR UPDATE', [id], 'Rappel introuvable.');
      if (r.status !== 'open') throw new BusinessRuleException('Ce rappel est clos.');
      const lots = await this.lotsConcernes(tx, r);
      let unites = 0;
      for (const l of lots) {
        const lignes = await tx.many<{ branch_id: string; quantity: string; average_cost: string }>(
          'SELECT branch_id, quantity, average_cost FROM stock_items WHERE lot_id = $1 AND quantity > 0', [l.lot_id],
        );
        for (const s of lignes) {
          await this.stock.applyMovement(tx, {
            branchId: s.branch_id, productId: l.product_id, lotId: l.lot_id,
            kind: resolution === 'returned' ? 'purchase_return' : 'damage',
            quantity: -Number(s.quantity), unitCost: Number(s.average_cost),
            referenceKind: 'lot_recall', referenceId: id,
            reason: `${resolution === 'returned' ? 'Retour fournisseur' : 'Destruction'} — ${r.title}`,
          });
          unites += Number(s.quantity);
        }
        await tx.query('UPDATE product_lots SET is_quarantined = true WHERE id = $1', [l.lot_id]);
      }
      const clos = await tx.oneOrFail(
        `UPDATE lot_recalls SET status = 'closed', resolution = $2, resolution_note = $3, closed_at = now(), closed_by = $4
          WHERE id = $1 RETURNING *`,
        [id, unites > 0 ? resolution : 'no_stock', note?.trim() || null, ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, { action: 'recalls.closed', entity: 'lot_recall', entityId: id, after: { resolution, units: unites } });
      return { recall: clos, units: unites };
    });
  }

  /** Fausse alerte, ou lot hors de cause : la quarantaine est levée. */
  async lever(ctx: RequestContext, id: string, note: string) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<Rappel>('SELECT * FROM lot_recalls WHERE id = $1 FOR UPDATE', [id], 'Rappel introuvable.');
      if (r.status !== 'open') throw new BusinessRuleException('Ce rappel est clos.');
      const lots = await this.lotsConcernes(tx, r);
      for (const l of lots.filter((x) => x.is_quarantined)) {
        // Un lot bloqué aussi par un autre rappel ouvert le reste.
        const autre = await tx.one(
          `SELECT 1 FROM lot_recalls o WHERE o.id <> $1 AND o.status = 'open'
              AND nova.lot_normalise($2) = ANY(SELECT nova.lot_normalise(x) FROM unnest(o.lot_numbers) x)`,
          [id, l.lot_number],
        );
        if (!autre) await tx.query('UPDATE product_lots SET is_quarantined = false, quarantine_reason = NULL WHERE id = $1', [l.lot_id]);
      }
      const clos = await tx.oneOrFail(
        `UPDATE lot_recalls SET status = 'closed', resolution = 'released', resolution_note = $2, closed_at = now(), closed_by = $3
          WHERE id = $1 RETURNING *`,
        [id, note.trim(), ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, { action: 'recalls.released', entity: 'lot_recall', entityId: id, after: clos, reason: note });
      return clos;
    });
  }

  /** Message WhatsApp prêt à partir pour un client qui a acheté un lot rappelé. */
  async prevenir(ctx: RequestContext, id: string, customerId: string) {
    const d = await this.detail(ctx, id);
    const client = d.customers.find((c) => c.customer_id === customerId);
    if (!client) throw new BusinessRuleException("Ce client n'a pas acheté de lot concerné.");
    if (!client.phone) throw new BusinessRuleException(`${client.name} n'a pas de numéro de téléphone.`);
    const pharmacie = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ name: string; phone: string | null }>('SELECT COALESCE(trade_name, legal_name) AS name, phone FROM organizations WHERE id = $1', [ctx.organizationId]),
    );
    const r = d.recall;
    const lots = d.lots.map((l) => l.lot_number).join(', ');
    const corps =
      `Bonjour ${client.name}, ${pharmacie.name} vous informe : ` +
      (r.kind === 'falsified'
        ? `une alerte signale des boîtes falsifiées de ${r.product_name}`
        : `le ${r.product_name} (lot ${lots}) fait l'objet d'un rappel`) +
      ` et vous en avez acheté chez nous. Par précaution, ne l'utilisez plus et rapportez-le à la pharmacie : nous vous conseillerons.` +
      (pharmacie.phone ? ` Tél. ${pharmacie.phone}.` : '');
    const message = await this.messaging.envoyer(ctx, {
      channel: 'whatsapp', customerId, body: corps, category: 'lot_recall', entity: 'lot_recall', entityId: id,
    });
    await this.db.transaction(ctx, (tx) => tx.query('UPDATE lot_recalls SET customers_notified = customers_notified + 1 WHERE id = $1', [id]));
    return message;
  }

  /**
   * À la réception : un lot visé par un rappel ouvert ne rentre pas en stock.
   */
  async verifierReception(tx: Tx, produit: { id: string; name: string }, numeroLot: string | null | undefined) {
    if (!numeroLot) return;
    const ouverts = await tx.many<Rappel>(
      `SELECT * FROM lot_recalls WHERE status = 'open'
          AND nova.lot_normalise($1) = ANY(SELECT nova.lot_normalise(x) FROM unnest(lot_numbers) x)`,
      [numeroLot],
    );
    for (const r of ouverts) {
      const lots = await this.lotsConcernesPourProduit(tx, r, produit.id);
      if (lots) {
        throw new BusinessRuleException(
          `Le lot ${numeroLot} de « ${produit.name} » est visé par ${r.kind === 'falsified' ? 'une alerte produit falsifié' : 'un rappel'} ` +
            `(« ${r.title} ») : ne le mettez pas en stock, retournez-le au fournisseur.`,
          { recallId: r.id },
        );
      }
    }
  }

  private async lotsConcernesPourProduit(tx: Tx, r: Rappel, productId: string): Promise<boolean> {
    if (r.product_id) return r.product_id === productId;
    const mots = termes(r.match_terms || r.product_name);
    if (!mots.length) return true;
    const p = await tx.oneOrFail<{ texte: string }>(
      `SELECT nova.sans_accent(p.name || ' ' || COALESCE(p.commercial_name, '') || ' ' || COALESCE(m.inn, '') || ' ' || COALESCE(p.dosage, '')) AS texte
         FROM products p LEFT JOIN molecules m ON m.id = p.molecule_id WHERE p.id = $1`,
      [productId],
    );
    return mots.every((m) => p.texte.includes(m));
  }

  /** Nombre de rappels ouverts avec du stock concerné, pour le tableau de bord. */
  async resume(ctx: RequestContext) {
    const liste = await this.liste(ctx, 'open');
    return {
      open: liste.length,
      withStock: liste.filter((r) => r.stockUnits > 0).length,
      notQuarantined: liste.filter((r) => r.matchedLots > r.quarantinedLots).length,
    };
  }
}
