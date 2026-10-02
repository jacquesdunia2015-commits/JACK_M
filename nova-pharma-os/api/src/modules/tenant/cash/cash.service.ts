import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { dernierTaux, mouvementCaisse } from './devises';

export interface MontantDevise {
  currency: string;
  amount: number;
}

/**
 * Tenue de caisse : une session par poste, ouverte avec un fonds de
 * caisse, mouvementée par les ventes et les opérations manuelles, puis
 * clôturée par un comptage. L'écart entre l'attendu et le compté est
 * conservé — il est la matière première du contrôle interne.
 *
 * Une pharmacie qui encaisse aussi dans une seconde devise (francs
 * congolais à côté du dollar) a un fonds, un attendu et un comptage pour
 * chacune : on ne compte jamais des francs comme des dollars.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Taux du jour
  // -------------------------------------------------------------------
  async taux(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const devise = await this.devisePharmacie(tx, ctx);
      const historique = await tx.many(
        `SELECT r.id, r.base_currency, r.quote_currency, r.rate, r.change_rounding,
                r.created_at, u.full_name AS set_by_name
           FROM exchange_rates r
           LEFT JOIN users u ON u.id = r.set_by
          WHERE r.base_currency = $1 OR r.quote_currency = $1
          ORDER BY r.created_at DESC LIMIT 30`,
        [devise],
      );
      return { devise, courant: historique[0] ?? null, historique };
    });
  }

  async fixerTaux(
    ctx: RequestContext,
    dto: { baseCurrency: string; quoteCurrency: string; rate: number; changeRounding?: number },
  ) {
    const base = (dto.baseCurrency ?? '').toUpperCase();
    const quote = (dto.quoteCurrency ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote) || base === quote) {
      throw new BusinessRuleException('Indiquez deux devises différentes (USD, CDF…).');
    }
    if (!(Number(dto.rate) > 0)) {
      throw new BusinessRuleException('Le taux doit être un nombre positif.');
    }
    if (dto.changeRounding !== undefined && !(Number(dto.changeRounding) >= 0)) {
      throw new BusinessRuleException("Le pas d'arrondi doit être positif ou nul.");
    }
    return this.db.transaction(ctx, async (tx) => {
      const devise = await this.devisePharmacie(tx, ctx);
      if (base !== devise && quote !== devise) {
        throw new BusinessRuleException(
          `Le taux doit faire intervenir la devise de la pharmacie (${devise}).`,
        );
      }
      const precedent = await dernierTaux(tx, base, quote);
      const taux = await tx.oneOrFail(
        `INSERT INTO exchange_rates
           (organization_id, base_currency, quote_currency, rate, change_rounding, set_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          ctx.organizationId, base, quote, dto.rate,
          dto.changeRounding ?? (precedent ? Number(precedent.change_rounding) : 0),
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, {
        action: 'cash.exchange_rate_set',
        entity: 'exchange_rate',
        entityId: taux.id as string,
        before: precedent ? { rate: Number(precedent.rate) } : undefined,
        after: { base, quote, rate: Number(dto.rate) },
      });
      return taux;
    });
  }

  // -------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------
  async open(
    ctx: RequestContext,
    dto: {
      branchId?: string; registerCode?: string; openingFloat?: number;
      openingFloats?: MontantDevise[];
    },
  ) {
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) {
      throw new BusinessRuleException('Branche non précisée pour l’ouverture de caisse.');
    }
    const registerCode = dto.registerCode ?? 'CAISSE-1';
    const userId = ctx.actorKind === 'user' ? ctx.actorId ?? null : null;

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

      const currency = await this.devisePharmacie(tx, ctx);
      const session = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO cash_sessions
           (organization_id, branch_id, register_code, opened_by, currency,
            opening_float, expected_cash)
         VALUES ($1,$2,$3,$4,$5,$6,0)
         RETURNING id`,
        [ctx.organizationId, branchId, registerCode, userId, currency, dto.openingFloat ?? 0],
      );
      await mouvementCaisse(tx, {
        organizationId: ctx.organizationId as string, sessionId: session.id,
        deviseSession: currency, devise: currency, kind: 'cash_in',
        amount: dto.openingFloat ?? 0, reason: 'Fonds de caisse', userId,
      });

      // Seconde devise : celle du dernier taux fixé, comptée à part dès
      // l'ouverture, même sans fonds de départ.
      const autres = new Map<string, number>();
      const dernier = await tx.one<{ base_currency: string; quote_currency: string }>(
        `SELECT base_currency, quote_currency FROM exchange_rates
          WHERE base_currency = $1 OR quote_currency = $1
          ORDER BY created_at DESC LIMIT 1`,
        [currency],
      );
      if (dernier) {
        autres.set(dernier.base_currency === currency ? dernier.quote_currency : dernier.base_currency, 0);
      }
      for (const f of dto.openingFloats ?? []) {
        const c = (f.currency ?? '').toUpperCase();
        if (/^[A-Z]{3}$/.test(c) && c !== currency) autres.set(c, Math.max(0, Number(f.amount) || 0));
      }
      for (const [c, fonds] of autres) {
        await tx.query(
          `INSERT INTO cash_session_currencies (organization_id, session_id, currency, opening_float)
           VALUES ($1,$2,$3,$4)`,
          [ctx.organizationId, session.id, c, fonds],
        );
        await mouvementCaisse(tx, {
          organizationId: ctx.organizationId as string, sessionId: session.id,
          deviseSession: currency, devise: c, kind: 'cash_in', amount: fonds,
          reason: 'Fonds de caisse', userId,
        });
      }

      await this.audit.record(tx, {
        action: 'cash.session_opened',
        entity: 'cash_session',
        entityId: session.id,
        after: {
          registerCode, openingFloat: dto.openingFloat ?? 0,
          autresDevises: Object.fromEntries(autres),
        },
      });
      return tx.oneOrFail('SELECT * FROM cash_sessions WHERE id = $1', [session.id]);
    });
  }

  async close(
    ctx: RequestContext,
    sessionId: string,
    dto: { countedCash: number; countedOther?: MontantDevise[]; notes?: string },
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

      const autres = await tx.many<{ currency: string }>(
        'SELECT currency FROM cash_session_currencies WHERE session_id = $1 ORDER BY currency',
        [sessionId],
      );
      const comptes = new Map(
        (dto.countedOther ?? []).map((c) => [(c.currency ?? '').toUpperCase(), Number(c.amount)]),
      );
      const manquants = autres.filter((a) => !Number.isFinite(comptes.get(a.currency)));
      if (manquants.length) {
        throw new BusinessRuleException(
          `Comptez aussi les espèces en ${manquants.map((m) => m.currency).join(', ')} avant de clôturer.`,
          { devises: manquants.map((m) => m.currency) },
        );
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
      const ecarts = [
        {
          currency: session.currency, expected: Number(session.expected_cash),
          counted: dto.countedCash, variance: Number(closed.variance),
        },
      ];
      for (const a of autres) {
        const ligne = await tx.oneOrFail<{ expected_cash: string; variance: string }>(
          `UPDATE cash_session_currencies SET counted_cash = $3
            WHERE session_id = $1 AND currency = $2 RETURNING expected_cash, variance`,
          [sessionId, a.currency, comptes.get(a.currency)],
        );
        ecarts.push({
          currency: a.currency, expected: Number(ligne.expected_cash),
          counted: comptes.get(a.currency) as number, variance: Number(ligne.variance),
        });
      }

      await this.audit.record(tx, {
        action: 'cash.session_closed',
        entity: 'cash_session',
        entityId: sessionId,
        after: { ecarts },
      });

      const phrase = (e: (typeof ecarts)[number]) =>
        Math.abs(e.variance) < 0.01
          ? `sans écart en ${e.currency}`
          : e.variance > 0
            ? `avec un excédent de ${e.variance.toFixed(2)} ${e.currency}`
            : `avec un manquant de ${Math.abs(e.variance).toFixed(2)} ${e.currency}`;
      return {
        session: closed,
        variance: ecarts[0].variance,
        ecarts,
        message:
          ecarts.length === 1 && Math.abs(ecarts[0].variance) < 0.01
            ? 'Caisse clôturée sans écart.'
            : `Caisse clôturée ${ecarts.map(phrase).join(', ')}.`,
      };
    });
  }

  async movement(
    ctx: RequestContext,
    sessionId: string,
    dto: { kind: string; amount: number; reason: string; currency?: string },
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
      const devise = (dto.currency ?? session.currency).toUpperCase();

      const movement = await mouvementCaisse(tx, {
        organizationId: ctx.organizationId as string, sessionId,
        deviseSession: session.currency, devise, kind: dto.kind, amount: signed,
        reason: dto.reason, userId: ctx.actorKind === 'user' ? ctx.actorId ?? null : null,
      });
      if (!movement) throw new BusinessRuleException('Indiquez un montant.');
      await this.audit.record(tx, {
        action: 'cash.movement',
        entity: 'cash_movement',
        entityId: movement.id as string,
        after: { kind: dto.kind, amount: signed, currency: devise, reason: dto.reason },
      });
      return movement;
    });
  }

  async current(ctx: RequestContext, branchId?: string) {
    const target = branchId ?? ctx.branchId;
    return this.db.readTransaction(ctx, async (tx) => {
      const session = await tx.one<{ id: string; currency: string }>(
        `SELECT cs.*, u.full_name AS opened_by_name
           FROM cash_sessions cs
           LEFT JOIN users u ON u.id = cs.opened_by
          WHERE cs.branch_id = $1 AND cs.status = 'open'
          ORDER BY cs.opened_at DESC LIMIT 1`,
        [target],
      );
      if (!session) return { session: null, movements: [], summary: null, currencies: [] };

      const movements = await tx.many(
        `SELECT kind, amount, currency, reason, occurred_at
           FROM cash_movements WHERE session_id = $1 ORDER BY occurred_at DESC LIMIT 100`,
        [session.id],
      );
      const resume = (devise: string) =>
        tx.one(
          `SELECT
             COALESCE(sum(amount) FILTER (WHERE kind = 'sale'), 0)    AS sales,
             COALESCE(sum(amount) FILTER (WHERE kind = 'refund'), 0)  AS refunds,
             COALESCE(sum(amount) FILTER (WHERE kind = 'cash_in'), 0) AS cash_in,
             COALESCE(sum(amount) FILTER (WHERE kind IN ('cash_out','expense','deposit')), 0) AS cash_out,
             count(*) AS movements
           FROM cash_movements WHERE session_id = $1 AND currency = $2`,
          [session.id, devise],
        );
      const summary = await resume(session.currency);
      const autres = await tx.many<{ currency: string }>(
        `SELECT currency, opening_float, expected_cash
           FROM cash_session_currencies WHERE session_id = $1 ORDER BY currency`,
        [session.id],
      );
      const currencies = [];
      for (const a of autres) currencies.push({ ...a, summary: await resume(a.currency) });
      return { session, movements, summary, currencies };
    });
  }

  async history(ctx: RequestContext, branchId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT cs.id, cs.register_code, cs.status, cs.currency, cs.opening_float,
                cs.expected_cash, cs.counted_cash, cs.variance,
                cs.opened_at, cs.closed_at,
                uo.full_name AS opened_by_name, uc.full_name AS closed_by_name,
                b.code AS branch_code,
                COALESCE((
                  SELECT json_agg(json_build_object(
                           'currency', c.currency, 'opening_float', c.opening_float,
                           'expected_cash', c.expected_cash, 'counted_cash', c.counted_cash,
                           'variance', c.variance) ORDER BY c.currency)
                    FROM cash_session_currencies c WHERE c.session_id = cs.id
                ), '[]'::json) AS currencies
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

  private async devisePharmacie(tx: Tx, ctx: RequestContext): Promise<string> {
    const row = await tx.oneOrFail<{ currency: string }>(
      'SELECT currency FROM organizations WHERE id = $1',
      [ctx.organizationId],
    );
    return row.currency;
  }
}
