import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

/**
 * Tenue de caisse : une session par poste, ouverte avec un fonds de
 * caisse, mouvementée par les ventes et les opérations manuelles, puis
 * clôturée par un comptage. L'écart entre l'attendu et le compté est
 * conservé — il est la matière première du contrôle interne.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async open(
    ctx: RequestContext,
    dto: { branchId?: string; registerCode?: string; openingFloat?: number },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) {
      throw new BusinessRuleException('Branche non précisée pour l’ouverture de caisse.');
    }
    const registerCode = dto.registerCode ?? 'CAISSE-1';

    return this.db.transaction(ctx, async (tx) => {
      const open = await tx.one(
        `SELECT id FROM cash_sessions
          WHERE branch_id = $1 AND register_code = $2 AND status = 'open'`,
        [branchId, registerCode],
      );
      if (open) {
        throw new BusinessRuleException(
          `La caisse « ${registerCode} » est déjà ouverte. Clôturez-la avant d'en ouvrir une nouvelle.`,
        );
      }

      const currency = await tx.oneOrFail<{ currency: string }>(
        'SELECT currency FROM organizations WHERE id = $1',
        [ctx.organizationId],
      );

      const session = await tx.oneOrFail(
        `INSERT INTO cash_sessions
           (organization_id, branch_id, register_code, opened_by, currency,
            opening_float, expected_cash)
         VALUES ($1,$2,$3,$4,$5,$6,$6)
         RETURNING *`,
        [
          ctx.organizationId, branchId, registerCode,
          ctx.actorKind === 'user' ? ctx.actorId : null,
          currency.currency, dto.openingFloat ?? 0,
        ],
      );

      if ((dto.openingFloat ?? 0) > 0) {
        await tx.query(
          `INSERT INTO cash_movements
             (organization_id, session_id, kind, amount, currency, reason, user_id)
           VALUES ($1,$2,'cash_in',$3,$4,'Fonds de caisse',$5)`,
          [
            ctx.organizationId, session.id, dto.openingFloat, currency.currency,
            ctx.actorKind === 'user' ? ctx.actorId : null,
          ],
        );
      }

      await this.audit.record(tx, {
        action: 'cash.session_opened',
        entity: 'cash_session',
        entityId: session.id as string,
        after: { registerCode, openingFloat: dto.openingFloat ?? 0 },
      });
      return session;
    });
  }

  async close(
    ctx: RequestContext,
    sessionId: string,
    dto: { countedCash: number; notes?: string },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const session = await tx.oneOrFail<{
        id: string; status: string; expected_cash: string; currency: string;
      }>(
        'SELECT * FROM cash_sessions WHERE id = $1',
        [sessionId],
        'Session de caisse introuvable.',
      );
      if (session.status !== 'open') {
        throw new BusinessRuleException('Cette session est déjà clôturée.');
      }

      const closed = await tx.oneOrFail(
        `UPDATE cash_sessions
            SET status = 'closed', closed_at = now(), closed_by = $2,
                counted_cash = $3, notes = $4
          WHERE id = $1 RETURNING *`,
        [
          sessionId, ctx.actorKind === 'user' ? ctx.actorId : null,
          dto.countedCash, dto.notes ?? null,
        ],
      );

      const variance = Number(closed.variance);
      await this.audit.record(tx, {
        action: 'cash.session_closed',
        entity: 'cash_session',
        entityId: sessionId,
        after: {
          expected: Number(session.expected_cash),
          counted: dto.countedCash,
          variance,
        },
      });

      return {
        session: closed,
        variance,
        message:
          Math.abs(variance) < 0.01
            ? 'Caisse clôturée sans écart.'
            : variance > 0
              ? `Caisse clôturée avec un excédent de ${variance.toFixed(2)} ${session.currency}.`
              : `Caisse clôturée avec un manquant de ${Math.abs(variance).toFixed(2)} ${session.currency}.`,
      };
    });
  }

  async movement(
    ctx: RequestContext,
    sessionId: string,
    dto: { kind: string; amount: number; reason: string },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const session = await tx.oneOrFail<{ id: string; status: string; currency: string }>(
        'SELECT * FROM cash_sessions WHERE id = $1',
        [sessionId],
        'Session de caisse introuvable.',
      );
      if (session.status !== 'open') {
        throw new BusinessRuleException('Session close : aucun mouvement possible.');
      }

      // Les sorties sont enregistrées en négatif, quel que soit le signe saisi.
      const signed = ['cash_out', 'expense', 'deposit'].includes(dto.kind)
        ? -Math.abs(dto.amount)
        : Math.abs(dto.amount);

      const movement = await tx.oneOrFail(
        `INSERT INTO cash_movements
           (organization_id, session_id, kind, amount, currency, reason, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          ctx.organizationId, sessionId, dto.kind, signed, session.currency,
          dto.reason, ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await tx.query(
        'UPDATE cash_sessions SET expected_cash = expected_cash + $2 WHERE id = $1',
        [sessionId, signed],
      );
      await this.audit.record(tx, {
        action: 'cash.movement',
        entity: 'cash_movement',
        entityId: movement.id as string,
        after: { kind: dto.kind, amount: signed, reason: dto.reason },
      });
      return movement;
    });
  }

  async current(ctx: RequestContext, branchId?: string) {
    const target = branchId ?? ctx.branchId;
    return this.db.readTransaction(ctx, async (tx) => {
      const session = await tx.one(
        `SELECT cs.*, u.full_name AS opened_by_name
           FROM cash_sessions cs
           LEFT JOIN users u ON u.id = cs.opened_by
          WHERE cs.branch_id = $1 AND cs.status = 'open'
          ORDER BY cs.opened_at DESC LIMIT 1`,
        [target],
      );
      if (!session) return { session: null, movements: [], summary: null };

      const movements = await tx.many(
        `SELECT kind, amount, currency, reason, occurred_at
           FROM cash_movements WHERE session_id = $1 ORDER BY occurred_at DESC LIMIT 100`,
        [session.id],
      );
      const summary = await tx.one(
        `SELECT
           COALESCE(sum(amount) FILTER (WHERE kind = 'sale'), 0)    AS sales,
           COALESCE(sum(amount) FILTER (WHERE kind = 'refund'), 0)  AS refunds,
           COALESCE(sum(amount) FILTER (WHERE kind = 'cash_in'), 0) AS cash_in,
           COALESCE(sum(amount) FILTER (WHERE kind IN ('cash_out','expense','deposit')), 0) AS cash_out,
           count(*) AS movements
         FROM cash_movements WHERE session_id = $1`,
        [session.id],
      );
      return { session, movements, summary };
    });
  }

  async history(ctx: RequestContext, branchId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT cs.id, cs.register_code, cs.status, cs.currency, cs.opening_float,
                cs.expected_cash, cs.counted_cash, cs.variance,
                cs.opened_at, cs.closed_at,
                uo.full_name AS opened_by_name, uc.full_name AS closed_by_name,
                b.code AS branch_code
           FROM cash_sessions cs
           JOIN branches b ON b.id = cs.branch_id
           LEFT JOIN users uo ON uo.id = cs.opened_by
           LEFT JOIN users uc ON uc.id = cs.closed_by
          WHERE ($1::uuid IS NULL OR cs.branch_id = $1)
          ORDER BY cs.opened_at DESC LIMIT 100`,
        [branchId ?? ctx.branchId ?? null],
      ),
    );
  }
}
