import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { documentRequisition, EnteteOfficine, GroupeFournisseur } from './requisition-pdf';
import { CreateRequisitionDto, RequisitionLineDto, UpdateRequisitionDto } from './requisitions.dto';

/** Transitions permises : on n'envoie qu'un brouillon, on ne reçoit qu'un envoi. */
const TRANSITIONS: Record<string, string[]> = {
  brouillon: ['envoyee', 'annulee'],
  envoyee: ['recue', 'annulee', 'brouillon'],
  recue: [],
  annulee: ['brouillon'],
};

interface LigneRequisition {
  id: string;
  position: number;
  product_id: string | null;
  sku: string | null;
  product_name: string;
  presentation: string | null;
  quantity: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  supplier_email: string | null;
  supplier_city: string | null;
  supplier_country: string | null;
  unit_price: string | null;
  currency: string | null;
  notes: string | null;
  [colonne: string]: unknown;
}

/**
 * Réquisitions : ce qu'il faut acheter, et chez qui.
 *
 * Chaque ligne garde le prix du catalogue du fournisseur au moment de la
 * demande, pour que le document imprimé dise ce sur quoi on s'est fondé.
 */
@Injectable()
export class RequisitionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT r.id, r.number, r.status, r.needed_by, r.notes, r.created_at, r.sent_at,
                u.full_name AS created_by_name,
                count(l.id) AS lines,
                count(DISTINCT l.supplier_id) AS suppliers,
                string_agg(DISTINCT s.name, ', ') AS supplier_names,
                COALESCE(sum(l.quantity * l.unit_price), 0) AS estimated_total,
                min(l.currency) AS currency
           FROM requisitions r
           LEFT JOIN requisition_lines l ON l.requisition_id = r.id
           LEFT JOIN suppliers s ON s.id = l.supplier_id
           LEFT JOIN users u ON u.id = r.created_by
          GROUP BY r.id, u.full_name
          ORDER BY r.created_at DESC
          LIMIT 200`,
      ),
    );
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.charger(tx, id));
  }

  async create(ctx: RequestContext, dto: CreateRequisitionDto) {
    return this.db.transaction(ctx, async (tx) => {
      const number = await this.numbering.next(tx, 'requisition');
      const requisition = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO requisitions (organization_id, branch_id, number, needed_by, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          ctx.organizationId, ctx.branchId ?? null, number, dto.neededBy ?? null,
          dto.notes?.trim() || null, ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.ecrireLignes(tx, ctx, requisition.id, dto.lines);
      await this.audit.record(tx, {
        action: 'purchasing.requisition_created',
        entity: 'requisition',
        entityId: requisition.id,
        after: { number, lines: dto.lines.length },
      });
      return this.charger(tx, requisition.id);
    });
  }

  async update(ctx: RequestContext, id: string, dto: UpdateRequisitionDto) {
    return this.db.transaction(ctx, async (tx) => {
      const actuelle = await tx.oneOrFail<{ status: string; number: string }>(
        'SELECT status, number FROM requisitions WHERE id = $1 FOR UPDATE',
        [id],
        'Réquisition introuvable.',
      );

      if ((dto.lines || dto.neededBy !== undefined || dto.notes !== undefined)
          && actuelle.status !== 'brouillon' && !dto.status) {
        throw new BusinessRuleException(
          'Seule une réquisition en brouillon se modifie : repassez-la en brouillon d’abord.',
        );
      }
      if (dto.status && dto.status !== actuelle.status) {
        if (!TRANSITIONS[actuelle.status]?.includes(dto.status)) {
          throw new BusinessRuleException(
            `Une réquisition « ${actuelle.status} » ne peut pas passer à « ${dto.status} ».`,
          );
        }
        await tx.query(
          `UPDATE requisitions
              SET status = $2,
                  sent_at = CASE WHEN $2 = 'envoyee' THEN now() ELSE sent_at END
            WHERE id = $1`,
          [id, dto.status],
        );
      }
      if (dto.neededBy !== undefined || dto.notes !== undefined) {
        await tx.query(
          `UPDATE requisitions
              SET needed_by = CASE WHEN $2::boolean THEN $3::date ELSE needed_by END,
                  notes = CASE WHEN $4::boolean THEN $5 ELSE notes END
            WHERE id = $1`,
          [id, dto.neededBy !== undefined, dto.neededBy ?? null, dto.notes !== undefined, dto.notes?.trim() || null],
        );
      }
      if (dto.lines) {
        await tx.query('DELETE FROM requisition_lines WHERE requisition_id = $1', [id]);
        await this.ecrireLignes(tx, ctx, id, dto.lines);
      }
      await this.audit.record(tx, {
        action: 'purchasing.requisition_updated',
        entity: 'requisition',
        entityId: id,
        before: { status: actuelle.status },
        after: { status: dto.status ?? actuelle.status, lines: dto.lines?.length },
      });
      return this.charger(tx, id);
    });
  }

  /**
   * Le document PDF : un fournisseur par page, ou un seul si on le précise.
   * C'est lui qu'on imprime, qu'on envoie par WhatsApp ou par e-mail.
   */
  async pdf(ctx: RequestContext, id: string, supplierId?: string) {
    const donnees = await this.db.readTransaction(ctx, async (tx) => {
      const requisition = await this.charger(tx, id);
      const officine = await tx.oneOrFail<EnteteOfficine>(
        `SELECT legal_name, trade_name, address, city, phone, email, logo_data
           FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      );
      return { requisition, officine };
    });

    const { requisition, officine } = donnees;
    const lignes = (requisition.lines as LigneRequisition[]).filter(
      (l) => !supplierId || l.supplier_id === supplierId,
    );
    if (lignes.length === 0) {
      throw new BadRequestException('Aucune ligne pour ce fournisseur dans cette réquisition.');
    }

    const groupes = new Map<string, GroupeFournisseur>();
    for (const l of lignes) {
      const cle = l.supplier_id ?? 'aucun';
      if (!groupes.has(cle)) {
        groupes.set(cle, {
          fournisseur: l.supplier_id
            ? {
                nom: l.supplier_name as string, telephone: l.supplier_phone,
                email: l.supplier_email, ville: l.supplier_city, pays: l.supplier_country,
              }
            : null,
          lignes: [],
        });
      }
      groupes.get(cle)?.lignes.push({
        designation: l.product_name,
        presentation: l.presentation,
        reference: l.sku,
        quantite: Number(l.quantity),
        prixUnitaire: l.unit_price === null ? null : Number(l.unit_price),
        devise: l.currency,
        notes: l.notes,
      });
    }

    const fichier = await documentRequisition({
      officine,
      numero: requisition.number as string,
      date: new Date(requisition.created_at as string),
      souhaiteeLe: (requisition.needed_by as string | null) ?? null,
      notes: (requisition.notes as string | null) ?? null,
      demandeur: (requisition.created_by_name as string | null) ?? null,
      groupes: [...groupes.values()],
    });
    const suffixe = supplierId && lignes[0].supplier_name
      ? `-${String(lignes[0].supplier_name).normalize('NFD').replace(/[^\w]+/g, '-').replace(/-+$/, '')}`
      : '';
    return { fichier, nom: `${requisition.number}${suffixe}.pdf` };
  }

  // -------------------------------------------------------------------
  private async ecrireLignes(tx: Tx, ctx: RequestContext, requisitionId: string, lignes: RequisitionLineDto[]) {
    let position = 0;
    for (const ligne of lignes) {
      position += 1;
      let nom = ligne.productName?.trim() ?? '';
      let presentation = ligne.presentation?.trim() || null;
      if (ligne.productId) {
        const produit = await tx.oneOrFail<{ name: string; packaging: string | null }>(
          'SELECT name, packaging FROM products WHERE id = $1 AND deleted_at IS NULL',
          [ligne.productId],
          'Produit introuvable dans votre catalogue.',
        );
        nom = nom || produit.name;
        presentation = presentation ?? produit.packaging;
      }

      let prix = ligne.unitPrice ?? null;
      let devise = ligne.currency?.toUpperCase() ?? null;
      let offreId: string | null = null;
      if (ligne.supplierId) {
        const fournisseur = await tx.oneOrFail<{ currency: string | null }>(
          'SELECT currency FROM suppliers WHERE id = $1',
          [ligne.supplierId],
          'Fournisseur introuvable.',
        );
        // Le prix vient du catalogue du fournisseur quand il y figure : la
        // réquisition dit alors sur quel prix la commande a été décidée.
        const offre = await tx.one<{ id: string; last_cost: string; currency: string | null }>(
          `SELECT id, last_cost, currency FROM supplier_products
            WHERE supplier_id = $1
              AND ((product_id IS NOT NULL AND product_id = $2)
                   OR (product_id IS NULL AND lower(product_name) = lower($3)))
            ORDER BY product_id NULLS LAST LIMIT 1`,
          [ligne.supplierId, ligne.productId ?? null, nom],
        );
        if (offre) {
          offreId = offre.id;
          if (prix === null) prix = Number(offre.last_cost);
          devise = devise ?? offre.currency;
        }
        devise = devise ?? fournisseur.currency;
      }

      await tx.query(
        `INSERT INTO requisition_lines
           (organization_id, requisition_id, position, product_id, product_name, presentation,
            quantity, supplier_id, supplier_product_id, unit_price, currency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 COALESCE($11, (SELECT currency FROM organizations WHERE id = $1)),$12)`,
        [
          ctx.organizationId, requisitionId, position, ligne.productId ?? null, nom, presentation,
          ligne.quantity, ligne.supplierId ?? null, offreId, prix, devise, ligne.notes?.trim() || null,
        ],
      );
    }
  }

  private async charger(
    tx: Tx,
    id: string,
  ): Promise<Record<string, unknown> & { lines: LigneRequisition[] }> {
    const requisition = await tx.oneOrFail<Record<string, unknown>>(
      `SELECT r.*, to_char(r.needed_by, 'YYYY-MM-DD') AS needed_by, u.full_name AS created_by_name
         FROM requisitions r
         LEFT JOIN users u ON u.id = r.created_by
        WHERE r.id = $1`,
      [id],
      'Réquisition introuvable.',
    );
    const lines = await tx.many<LigneRequisition>(
      `SELECT l.id, l.position, l.product_id, p.sku, l.product_name, l.presentation, l.quantity,
              l.supplier_id, s.name AS supplier_name, s.phone AS supplier_phone,
              s.email AS supplier_email, s.city AS supplier_city, s.country_code AS supplier_country,
              l.unit_price, l.currency, l.notes
         FROM requisition_lines l
         LEFT JOIN products p ON p.id = l.product_id
         LEFT JOIN suppliers s ON s.id = l.supplier_id
        WHERE l.requisition_id = $1
        ORDER BY s.name NULLS LAST, l.position`,
      [id],
    );
    return { ...requisition, lines };
  }
}
