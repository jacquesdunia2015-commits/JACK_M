import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

export interface Programme {
  is_enabled: boolean;
  points_per_unit: number;
  point_value: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  welcome_points: number;
}

const PAR_DEFAUT: Programme = {
  is_enabled: false, points_per_unit: 1, point_value: 0.05, min_redeem_points: 100,
  max_redeem_percent: 50, welcome_points: 0,
};

const arrondi2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fidélité : points gagnés à chaque achat et utilisés pour payer une partie
 * d'un achat suivant, remise permanente par catégorie de clients.
 */
@Injectable()
export class FideliteService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async lireProgramme(tx: Tx): Promise<Programme> {
    const p = await tx.one<Record<string, string | boolean | number>>('SELECT * FROM loyalty_programs LIMIT 1');
    if (!p) return { ...PAR_DEFAUT };
    return {
      is_enabled: Boolean(p.is_enabled),
      points_per_unit: Number(p.points_per_unit),
      point_value: Number(p.point_value),
      min_redeem_points: Number(p.min_redeem_points),
      max_redeem_percent: Number(p.max_redeem_percent),
      welcome_points: Number(p.welcome_points),
    };
  }

  /** Réglages du programme, et ce que représentent les points en circulation. */
  async programme(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const programme = await this.lireProgramme(tx);
      const encours = await tx.oneOrFail<{ points: string; clients: string }>(
        `SELECT COALESCE(sum(loyalty_points), 0) AS points, count(*) FILTER (WHERE loyalty_points > 0) AS clients
           FROM customers WHERE deleted_at IS NULL`,
      );
      const mois = await tx.oneOrFail<{ gagnes: string; utilises: string; valeur: string }>(
        `SELECT COALESCE(sum(points) FILTER (WHERE kind = 'earn'), 0) AS gagnes,
                COALESCE(-sum(points) FILTER (WHERE kind = 'redeem'), 0) AS utilises,
                COALESCE(sum(amount) FILTER (WHERE kind = 'redeem'), 0) AS valeur
           FROM loyalty_entries
          WHERE created_at >= date_trunc('month', now())`,
      );
      return {
        ...programme,
        outstandingPoints: Number(encours.points),
        outstandingValue: arrondi2(Number(encours.points) * programme.point_value),
        customersWithPoints: Number(encours.clients),
        month: { earned: Number(mois.gagnes), redeemed: Number(mois.utilises), redeemedValue: Number(mois.valeur) },
      };
    });
  }

  async reglerProgramme(ctx: RequestContext, dto: Partial<Programme>) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await this.lireProgramme(tx);
      const apres = { ...avant, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) } as Programme;
      await tx.query(
        `INSERT INTO loyalty_programs
           (organization_id, is_enabled, points_per_unit, point_value, min_redeem_points, max_redeem_percent, welcome_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (organization_id) DO UPDATE
           SET is_enabled = EXCLUDED.is_enabled, points_per_unit = EXCLUDED.points_per_unit,
               point_value = EXCLUDED.point_value, min_redeem_points = EXCLUDED.min_redeem_points,
               max_redeem_percent = EXCLUDED.max_redeem_percent, welcome_points = EXCLUDED.welcome_points`,
        [
          ctx.organizationId, apres.is_enabled, apres.points_per_unit, apres.point_value,
          apres.min_redeem_points, apres.max_redeem_percent, apres.welcome_points,
        ],
      );
      await this.audit.record(tx, { action: 'loyalty.program.updated', entity: 'loyalty_program', entityId: ctx.organizationId as string, before: avant, after: apres });
      return apres;
    });
  }

  /**
   * Ce qu'un client peut utiliser sur un montant : son solde, et au plus
   * combien de points (seuil minimum, part maximale de la vente).
   */
  async apercu(ctx: RequestContext, customerId: string, montant: number) {
    return this.db.readTransaction(ctx, async (tx) => {
      const programme = await this.lireProgramme(tx);
      const client = await tx.oneOrFail<{ loyalty_points: number; name: string }>(
        'SELECT name, loyalty_points FROM customers WHERE id = $1 AND deleted_at IS NULL', [customerId], 'Client introuvable.',
      );
      return { ...this.plafond(programme, client.loyalty_points, montant), enabled: programme.is_enabled, pointValue: programme.point_value };
    });
  }

  private plafond(programme: Programme, solde: number, montant: number) {
    const balance = Number(solde);
    const value = arrondi2(balance * programme.point_value);
    if (balance < programme.min_redeem_points) {
      return {
        balance, value, maxPoints: 0, maxValue: 0,
        reason: `Il faut au moins ${programme.min_redeem_points} points pour les utiliser.`,
      };
    }
    const maxMontant = Math.max(0, montant) * programme.max_redeem_percent / 100;
    const maxPoints = Math.min(balance, Math.floor(maxMontant / programme.point_value + 1e-9));
    return { balance, value, maxPoints, maxValue: arrondi2(maxPoints * programme.point_value), reason: null as string | null };
  }

  /**
   * À la caisse : vérifie que le client peut utiliser ces points sur ce
   * montant et rend leur valeur. La fiche du client est verrouillée jusqu'à
   * la fin de la vente : deux caisses ne dépensent pas les mêmes points.
   */
  async utiliser(tx: Tx, customerId: string, points: number, montant: number) {
    const programme = await this.lireProgramme(tx);
    if (!programme.is_enabled) throw new BusinessRuleException("Le programme de fidélité n'est pas activé.");
    const client = await tx.oneOrFail<{ loyalty_points: number; name: string }>(
      'SELECT name, loyalty_points FROM customers WHERE id = $1 FOR UPDATE', [customerId], 'Client introuvable.',
    );
    const p = this.plafond(programme, client.loyalty_points, montant);
    if (points > client.loyalty_points) {
      throw new BusinessRuleException(`${client.name} n'a que ${client.loyalty_points} points.`, { balance: p.balance });
    }
    if (p.reason) throw new BusinessRuleException(p.reason, { balance: p.balance });
    if (points > p.maxPoints) {
      throw new BusinessRuleException(
        `Au plus ${p.maxPoints} points sur cette vente (${programme.max_redeem_percent} % du montant).`,
        { maxPoints: p.maxPoints },
      );
    }
    return { montant: arrondi2(points * programme.point_value), programme };
  }

  /** Points gagnés sur la part payée par le client lui-même. */
  pointsGagnes(programme: Programme, base: number) {
    if (!programme.is_enabled || base <= 0) return 0;
    return Math.floor(base * programme.points_per_unit + 1e-9);
  }

  /** Inscrit au journal une variation de points et met à jour le solde. */
  async mouvement(
    tx: Tx,
    m: { organizationId: string; customerId: string; saleId?: string | null; kind: string; points: number; amount?: number | null; reason?: string | null; userId?: string | null },
  ) {
    if (!m.points) return null;
    const client = await tx.oneOrFail<{ loyalty_points: number; name: string }>(
      `UPDATE customers SET loyalty_points = loyalty_points + $2 WHERE id = $1
        RETURNING loyalty_points, name`,
      [m.customerId, m.points],
    );
    if (client.loyalty_points < 0) {
      throw new BusinessRuleException(`Le solde de points de ${client.name} ne peut pas devenir négatif.`);
    }
    return tx.oneOrFail(
      `INSERT INTO loyalty_entries
         (organization_id, customer_id, sale_id, kind, points, balance_after, amount, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [m.organizationId, m.customerId, m.saleId ?? null, m.kind, m.points, client.loyalty_points, m.amount ?? null, m.reason ?? null, m.userId ?? null],
    );
  }

  /**
   * Annulation d'une vente : les points gagnés repartent, les points
   * utilisés reviennent au client. Si le client a déjà dépensé les points
   * gagnés, son solde est ramené à zéro plutôt que de devenir négatif.
   */
  async annulerVente(tx: Tx, ctx: RequestContext, saleId: string, numero: string) {
    const lignes = await tx.many<{ customer_id: string; points: number }>(
      `SELECT customer_id, sum(points)::integer AS points FROM loyalty_entries
        WHERE sale_id = $1 GROUP BY customer_id HAVING sum(points) <> 0`,
      [saleId],
    );
    for (const l of lignes) {
      const client = await tx.oneOrFail<{ loyalty_points: number }>('SELECT loyalty_points FROM customers WHERE id = $1 FOR UPDATE', [l.customer_id]);
      const retour = Math.max(-Number(l.points), -client.loyalty_points);
      await this.mouvement(tx, {
        organizationId: ctx.organizationId as string, customerId: l.customer_id, saleId, kind: 'reverse',
        points: retour, reason: `Annulation de la vente ${numero}`,
        userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
      });
    }
  }

  /** Solde et derniers mouvements d'un client. */
  async client(ctx: RequestContext, customerId: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const programme = await this.lireProgramme(tx);
      const c = await tx.oneOrFail<{ id: string; name: string; loyalty_points: number }>(
        'SELECT id, name, loyalty_points FROM customers WHERE id = $1 AND deleted_at IS NULL', [customerId], 'Client introuvable.',
      );
      const mouvements = await tx.many(
        `SELECT e.id, e.kind, e.points, e.balance_after, e.amount, e.reason, e.created_at, s.number AS sale_number
           FROM loyalty_entries e LEFT JOIN sales s ON s.id = e.sale_id
          WHERE e.customer_id = $1 ORDER BY e.created_at DESC, e.id LIMIT 50`,
        [customerId],
      );
      return { customer: c, balance: c.loyalty_points, value: arrondi2(c.loyalty_points * programme.point_value), entries: mouvements };
    });
  }

  /** Meilleurs clients par points, et derniers mouvements de la pharmacie. */
  async tableau(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const clients = await tx.many(
        `SELECT c.id, c.code, c.name, c.phone, c.loyalty_points, g.name AS group_name,
                (SELECT max(e.created_at) FROM loyalty_entries e WHERE e.customer_id = c.id) AS last_entry_at
           FROM customers c LEFT JOIN customer_groups g ON g.id = c.group_id
          WHERE c.deleted_at IS NULL AND c.loyalty_points > 0
          ORDER BY c.loyalty_points DESC, c.name LIMIT 50`,
      );
      const mouvements = await tx.many(
        `SELECT e.id, e.kind, e.points, e.balance_after, e.amount, e.reason, e.created_at,
                c.name AS customer_name, s.number AS sale_number
           FROM loyalty_entries e JOIN customers c ON c.id = e.customer_id LEFT JOIN sales s ON s.id = e.sale_id
          ORDER BY e.created_at DESC, e.id LIMIT 30`,
      );
      return { customers: clients, entries: mouvements };
    });
  }

  /** Ajustement à la main (geste commercial, correction), toujours motivé. */
  async ajuster(ctx: RequestContext, customerId: string, points: number, raison: string) {
    if (!Number.isInteger(points) || points === 0) throw new BusinessRuleException('Indiquez un nombre entier de points, positif ou négatif.');
    return this.db.transaction(ctx, async (tx) => {
      const c = await tx.oneOrFail<{ loyalty_points: number; name: string }>(
        'SELECT name, loyalty_points FROM customers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [customerId], 'Client introuvable.',
      );
      if (c.loyalty_points + points < 0) {
        throw new BusinessRuleException(`${c.name} n'a que ${c.loyalty_points} points.`);
      }
      const e = await this.mouvement(tx, {
        organizationId: ctx.organizationId as string, customerId, kind: 'adjust', points, reason: raison.trim(),
        userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
      });
      await this.audit.record(tx, { action: 'loyalty.adjusted', entity: 'customer', entityId: customerId, after: e, reason: raison });
      return e;
    });
  }

  /** Points de bienvenue à l'inscription d'un client, si le programme en offre. */
  async bienvenue(tx: Tx, ctx: RequestContext, customerId: string) {
    const programme = await this.lireProgramme(tx);
    if (!programme.is_enabled || programme.welcome_points <= 0) return 0;
    await this.mouvement(tx, {
      organizationId: ctx.organizationId as string, customerId, kind: 'welcome', points: programme.welcome_points,
      reason: 'Bienvenue au programme de fidélité', userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
    });
    return programme.welcome_points;
  }

  // ------------------------------------------------------------------
  // Catégories de clients et remise permanente
  // ------------------------------------------------------------------

  async categories(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT g.id, g.code, g.name, g.discount_percent, g.is_active, g.notes,
                (SELECT count(*) FROM customers c WHERE c.group_id = g.id AND c.deleted_at IS NULL)::integer AS customers
           FROM customer_groups g ORDER BY g.is_active DESC, g.name`,
      ),
    );
  }

  async creerCategorie(ctx: RequestContext, dto: { name: string; discountPercent: number; notes?: string }) {
    return this.db.transaction(ctx, async (tx) => {
      const base = dto.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'CAT';
      let code = base;
      for (let i = 2; await tx.one('SELECT 1 FROM customer_groups WHERE code = $1', [code]); i++) code = `${base}-${i}`;
      const g = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO customer_groups (organization_id, code, name, discount_percent, notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [ctx.organizationId, code, dto.name.trim(), dto.discountPercent, dto.notes ?? null],
      );
      await this.audit.record(tx, { action: 'customers.group.created', entity: 'customer_group', entityId: g.id, after: g });
      return g;
    });
  }

  async modifierCategorie(ctx: RequestContext, id: string, dto: { name?: string; discountPercent?: number; isActive?: boolean; notes?: string }) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail('SELECT * FROM customer_groups WHERE id = $1', [id], 'Catégorie introuvable.');
      const apres = await tx.oneOrFail(
        `UPDATE customer_groups
            SET name = COALESCE($2, name), discount_percent = COALESCE($3, discount_percent),
                is_active = COALESCE($4, is_active), notes = COALESCE($5, notes)
          WHERE id = $1 RETURNING *`,
        [id, dto.name?.trim() ?? null, dto.discountPercent ?? null, dto.isActive ?? null, dto.notes ?? null],
      );
      await this.audit.record(tx, { action: 'customers.group.updated', entity: 'customer_group', entityId: id, before: avant, after: apres });
      return apres;
    });
  }

  /** Range un client dans une catégorie (ou l'en sort avec null). */
  async classer(ctx: RequestContext, customerId: string, groupId: string | null) {
    return this.db.transaction(ctx, async (tx) => {
      if (groupId) await tx.oneOrFail('SELECT id FROM customer_groups WHERE id = $1 AND is_active', [groupId], 'Catégorie introuvable ou désactivée.');
      const c = await tx.oneOrFail(
        'UPDATE customers SET group_id = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, group_id',
        [customerId, groupId], 'Client introuvable.',
      );
      await this.audit.record(tx, { action: 'customers.group.assigned', entity: 'customer', entityId: customerId, after: c });
      return c;
    });
  }

  /** Remise de la catégorie du client, si elle est active. */
  async remiseClient(tx: Tx, customerId: string): Promise<number> {
    const r = await tx.one<{ discount_percent: string }>(
      `SELECT g.discount_percent FROM customers c JOIN customer_groups g ON g.id = c.group_id
        WHERE c.id = $1 AND g.is_active`,
      [customerId],
    );
    return r ? Number(r.discount_percent) : 0;
  }
}
