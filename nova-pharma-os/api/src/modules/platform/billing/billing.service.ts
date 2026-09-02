import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AccessContextService } from '../../../common/auth/access-context.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import {
  RequestContext,
  SYSTEM_CONTEXT,
} from '../../../common/database/request-context';
import {
  CreditNoteDto,
  GenerateInvoiceDto,
  ListInvoicesDto,
  RecordPaymentDto,
} from './dto';

interface InvoiceLineDraft {
  label: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  planId?: string | null;
  addonId?: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly access: AccessContextService,
  ) {}

  // -------------------------------------------------------------------
  // Émission d'une facture d'abonnement
  // -------------------------------------------------------------------
  /**
   * Établit la facture de la période courante : ligne de forfait, puis
   * une ligne par option souscrite, remise éventuelle appliquée.
   *
   * La clé d'idempotence empêche la double facturation lorsqu'un appel
   * est rejoué (reprise de tâche planifiée, requête réémise).
   */
  async generateInvoice(
    tx: Tx,
    organizationId: string,
    options: GenerateInvoiceDto = {},
  ) {
    const subscription = await tx.oneOrFail<{
      id: string; plan_id: string; currency: string; unit_price: string;
      discount_percent: string; billing_cycle: string;
      current_period_start: Date; current_period_end: Date;
      plan_code: string; plan_name: string;
    }>(
      `SELECT s.*, p.code AS plan_code, p.name AS plan_name
         FROM organization_subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.organization_id = $1
          AND s.status NOT IN ('cancelled','expired','archived')
        ORDER BY s.created_at DESC LIMIT 1`,
      [organizationId],
      "Aucun abonnement facturable pour cette pharmacie.",
    );

    const periodStart = options.periodStart ?? subscription.current_period_start;
    const periodEnd = options.periodEnd ?? subscription.current_period_end;
    // Une période d'abonnement est identifiée par ses deux bornes : la
    // même période n'est jamais facturée deux fois, mais une période
    // rouverte — après réactivation, par exemple — l'est bien une fois.
    const idempotencyKey =
      options.idempotencyKey ??
      `sub:${subscription.id}:${new Date(periodStart).toISOString()}` +
        `:${new Date(periodEnd).toISOString()}`;

    const existing = await tx.one(
      'SELECT * FROM subscription_invoices WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (existing) {
      return { invoice: existing, created: false };
    }

    const cycleLabel = {
      monthly: 'mensuel',
      quarterly: 'trimestriel',
      annual: 'annuel',
    }[subscription.billing_cycle] ?? subscription.billing_cycle;

    const discount = Number(subscription.discount_percent);
    const lines: InvoiceLineDraft[] = [
      {
        label: `Abonnement ${subscription.plan_name} — ${cycleLabel}`,
        quantity: 1,
        unitPrice: Number(subscription.unit_price),
        discountPercent: discount,
        planId: subscription.plan_id,
      },
    ];

    const addons = await tx.many<{
      id: string; code: string; name: string; quantity: number; unit_price: string;
    }>(
      `SELECT a.id, a.code, a.name, oa.quantity, oa.unit_price
         FROM organization_addons oa
         JOIN plan_addons a ON a.id = oa.addon_id
        WHERE oa.organization_id = $1
          AND (oa.active_until IS NULL OR oa.active_until > now())`,
      [organizationId],
    );
    addons.forEach((addon) =>
      lines.push({
        label: `Option — ${addon.name}`,
        quantity: addon.quantity,
        unitPrice: Number(addon.unit_price),
        discountPercent: discount,
        addonId: addon.id,
      }),
    );

    const totals = this.computeTotals(lines);
    const number = await this.nextNumber(tx, 'invoice');

    const invoice = await tx.oneOrFail(
      `INSERT INTO subscription_invoices
         (organization_id, subscription_id, number, kind, status, currency,
          issue_date, due_date, period_start, period_end,
          subtotal, discount_total, tax_total, total, idempotency_key)
       VALUES ($1,$2,$3,'invoice','issued',$4,
               CURRENT_DATE, CURRENT_DATE + 14, $5, $6, $7, $8, 0, $9, $10)
       RETURNING *`,
      [
        organizationId,
        subscription.id,
        number,
        subscription.currency,
        periodStart,
        periodEnd,
        totals.subtotal,
        totals.discount,
        totals.total,
        idempotencyKey,
      ],
    );

    await this.insertLines(tx, invoice.id as string, lines);

    await this.audit.recordPlatform(tx, {
      organizationId,
      action: 'billing.invoice_issued',
      entity: 'subscription_invoice',
      entityId: invoice.id as string,
      after: { number, total: totals.total, currency: subscription.currency },
    });

    return { invoice, created: true };
  }

  async generateInvoiceForOrganization(
    ctx: RequestContext,
    organizationId: string,
    dto: GenerateInvoiceDto,
  ) {
    return this.db.transaction(ctx, (tx) =>
      this.generateInvoice(tx, organizationId, dto),
    );
  }

  /** Devis SaaS : même structure qu'une facture, sans effet comptable. */
  async createQuote(ctx: RequestContext, organizationId: string, planCode: string) {
    return this.db.transaction(ctx, async (tx) => {
      const plan = await tx.oneOrFail<{
        id: string; name: string; price_monthly: string; price_annual: string;
        price_quarterly: string; currency: string;
      }>(
        'SELECT * FROM subscription_plans WHERE code = $1',
        [planCode],
        `Forfait « ${planCode} » introuvable.`,
      );
      const lines: InvoiceLineDraft[] = [
        {
          label: `Abonnement ${plan.name} — annuel`,
          quantity: 1,
          unitPrice: Number(plan.price_annual),
          discountPercent: 0,
          planId: plan.id,
        },
      ];
      const totals = this.computeTotals(lines);
      const number = await this.nextNumber(tx, 'quote');
      const quote = await tx.oneOrFail(
        `INSERT INTO subscription_invoices
           (organization_id, number, kind, status, currency, issue_date, due_date,
            subtotal, discount_total, tax_total, total)
         VALUES ($1,$2,'quote','draft',$3, CURRENT_DATE, CURRENT_DATE + 30, $4, $5, 0, $6)
         RETURNING *`,
        [organizationId, number, plan.currency, totals.subtotal, totals.discount, totals.total],
      );
      await this.insertLines(tx, quote.id as string, lines);
      return quote;
    });
  }

  // -------------------------------------------------------------------
  // Paiements
  // -------------------------------------------------------------------
  /**
   * Enregistre un règlement d'abonnement et le rapproche de la facture.
   *
   * Le rapprochement est protégé contre les doublons par deux barrières :
   * la clé d'idempotence fournie par l'appelant, et l'unicité de la
   * référence externe chez l'opérateur de paiement.
   */
  async recordPayment(
    ctx: RequestContext,
    organizationId: string,
    dto: RecordPaymentDto,
  ) {
    return this.db.transaction(ctx, async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.one(
          'SELECT * FROM subscription_payments WHERE idempotency_key = $1',
          [dto.idempotencyKey],
        );
        if (existing) {
          return { payment: existing, duplicate: true, invoice: null, reactivated: false };
        }
      }

      let invoice = null;
      if (dto.invoiceId) {
        invoice = await tx.oneOrFail(
          `SELECT * FROM subscription_invoices
            WHERE id = $1 AND organization_id = $2`,
          [dto.invoiceId, organizationId],
          'Facture introuvable pour cette pharmacie.',
        );
        if (invoice.status === 'cancelled') {
          throw new BadRequestException('Cette facture est annulée.');
        }
        if (Number(dto.amount) > Number(invoice.balance) + 0.001) {
          throw new BadRequestException(
            `Le montant réglé (${dto.amount}) dépasse le solde de la facture (${invoice.balance}).`,
          );
        }
      }

      const confirmed = dto.confirm !== false;
      const payment = await tx.oneOrFail(
        `INSERT INTO subscription_payments
           (organization_id, invoice_id, method, provider, amount, currency,
            status, reference, external_reference, idempotency_key,
            paid_at, confirmed_at, confirmed_by)
         VALUES ($1,$2,$3::nova.payment_method,$4,$5,$6,
                 $7::nova.payment_status,$8,$9,$10,
                 now(), CASE WHEN $7 = 'confirmed' THEN now() END,
                 CASE WHEN $7 = 'confirmed' THEN $11::uuid END)
         RETURNING *`,
        [
          organizationId,
          dto.invoiceId ?? null,
          dto.method,
          dto.provider ?? null,
          dto.amount,
          dto.currency ?? invoice?.currency ?? 'USD',
          confirmed ? 'confirmed' : 'pending',
          dto.reference ?? null,
          dto.externalReference ?? null,
          dto.idempotencyKey ?? null,
          ctx.actorId ?? null,
        ],
      );

      let reactivated = false;
      if (confirmed && invoice) {
        invoice = await tx.oneOrFail(
          `UPDATE subscription_invoices
              SET amount_paid = amount_paid + $2,
                  status = CASE
                    WHEN amount_paid + $2 >= total THEN 'paid'::nova.invoice_status
                    ELSE 'partially_paid'::nova.invoice_status END
            WHERE id = $1 RETURNING *`,
          [invoice.id, dto.amount],
        );

        if (invoice.status === 'paid') {
          reactivated = await this.settleOrganization(tx, organizationId);
        }
      }

      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'billing.payment_recorded',
        entity: 'subscription_payment',
        entityId: payment.id as string,
        after: {
          amount: dto.amount,
          method: dto.method,
          invoice: invoice?.number ?? null,
          reactivated,
        },
      });

      return { payment, invoice, duplicate: false, reactivated };
    });
  }

  /**
   * Après règlement intégral, la pharmacie retrouve automatiquement ses
   * accès si elle était suspendue ou en retard de paiement, à condition
   * qu'aucune autre facture ne reste impayée.
   */
  private async settleOrganization(tx: Tx, organizationId: string): Promise<boolean> {
    const outstanding = await tx.one<{ n: string }>(
      `SELECT count(*) AS n FROM subscription_invoices
        WHERE organization_id = $1
          AND kind = 'invoice'
          AND status IN ('issued','partially_paid','overdue')`,
      [organizationId],
    );
    if (Number(outstanding?.n ?? 0) > 0) return false;

    const organization = await tx.one<{ status: string }>(
      'SELECT status::text AS status FROM organizations WHERE id = $1',
      [organizationId],
    );
    if (!organization) return false;
    if (!['suspended', 'trial', 'prospect'].includes(organization.status)) {
      // Déjà active : on remet simplement l'abonnement au vert.
      await tx.query(
        `UPDATE organization_subscriptions
            SET status = 'active'
          WHERE organization_id = $1
            AND status IN ('pending_payment','past_due','trialing')`,
        [organizationId],
      );
      this.access.invalidate(organizationId);
      return false;
    }

    await tx.query(
      `UPDATE organizations
          SET status = 'active', suspended_at = NULL,
              activated_at = COALESCE(activated_at, now())
        WHERE id = $1`,
      [organizationId],
    );
    await tx.query(
      `UPDATE organization_subscriptions
          SET status = 'active', suspended_at = NULL,
              current_period_start = now(),
              current_period_end = now() + (CASE billing_cycle
                                              WHEN 'monthly' THEN interval '1 month'
                                              WHEN 'quarterly' THEN interval '3 months'
                                              ELSE interval '1 year' END),
              renewal_at = now() + (CASE billing_cycle
                                      WHEN 'monthly' THEN interval '1 month'
                                      WHEN 'quarterly' THEN interval '3 months'
                                      ELSE interval '1 year' END)
        WHERE organization_id = $1
          AND status NOT IN ('cancelled','expired','archived')`,
      [organizationId],
    );
    await tx.query(
      `INSERT INTO subscription_plan_changes
         (organization_id, subscription_id, from_plan_id, to_plan_id,
          to_status, reason, changed_by)
       SELECT organization_id, id, plan_id, plan_id, 'active',
              'Réactivation automatique après confirmation du paiement.', $2
         FROM organization_subscriptions
        WHERE organization_id = $1
          AND status NOT IN ('cancelled','expired','archived')`,
      [organizationId, tx.context.actorId ?? null],
    );

    this.access.invalidate(organizationId);
    return true;
  }

  // -------------------------------------------------------------------
  // Avoirs
  // -------------------------------------------------------------------
  async createCreditNote(ctx: RequestContext, dto: CreditNoteDto) {
    return this.db.transaction(ctx, async (tx) => {
      const invoice = await tx.oneOrFail<{
        id: string; organization_id: string; number: string;
        currency: string; total: string; balance: string;
      }>(
        'SELECT * FROM subscription_invoices WHERE id = $1',
        [dto.invoiceId],
        'Facture introuvable.',
      );

      const amount = dto.amount ?? Number(invoice.total);
      if (amount > Number(invoice.total) + 0.001) {
        throw new BadRequestException(
          "Le montant de l'avoir ne peut dépasser celui de la facture.",
        );
      }

      const number = await this.nextNumber(tx, 'credit_note');
      const creditNote = await tx.oneOrFail(
        `INSERT INTO subscription_invoices
           (organization_id, number, kind, status, currency, issue_date, due_date,
            subtotal, total, credited_invoice_id, notes)
         VALUES ($1,$2,'credit_note','issued',$3, CURRENT_DATE, CURRENT_DATE,
                 $4, $4, $5, $6)
         RETURNING *`,
        [invoice.organization_id, number, invoice.currency, -amount, invoice.id, dto.reason],
      );

      await tx.query(
        `INSERT INTO subscription_invoice_lines
           (invoice_id, label, quantity, unit_price, line_total)
         VALUES ($1, $2, 1, $3, $3)`,
        [creditNote.id, `Avoir sur facture ${invoice.number} — ${dto.reason}`, -amount],
      );

      await tx.query(
        `UPDATE subscription_invoices
            SET status = CASE WHEN $2 >= total THEN 'credited'::nova.invoice_status
                              ELSE status END
          WHERE id = $1`,
        [invoice.id, amount],
      );

      await this.audit.recordPlatform(tx, {
        organizationId: invoice.organization_id,
        action: 'billing.credit_note_issued',
        entity: 'subscription_invoice',
        entityId: creditNote.id as string,
        after: { number, amount, creditedInvoice: invoice.number },
        reason: dto.reason,
      });

      return creditNote;
    });
  }

  // -------------------------------------------------------------------
  // Relances d'impayé
  // -------------------------------------------------------------------
  /**
   * Émet une relance pour une facture en retard. Le niveau est déterminé
   * par l'ancienneté du retard ; une même relance n'est jamais envoyée
   * deux fois (contrainte d'unicité sur facture + niveau + canal).
   */
  async sendDunning(
    tx: Tx,
    invoice: { id: string; organization_id: string; number: string; due_date: Date; balance: string; currency: string },
    level: number,
    channel = 'email',
  ): Promise<boolean> {
    const daysOverdue = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(invoice.due_date).getTime()) / 86_400_000,
      ),
    );

    const subject =
      level >= 3
        ? `Mise en demeure — facture ${invoice.number}`
        : level === 2
          ? `Relance — facture ${invoice.number} impayée`
          : `Rappel — facture ${invoice.number} arrivée à échéance`;

    const body =
      `Facture ${invoice.number} d'un montant de ${invoice.balance} ${invoice.currency}, ` +
      `échue depuis ${daysOverdue} jour(s).` +
      (level >= 3
        ? ' Sans règlement sous 48 heures, l’accès sera suspendu. Vos données seront conservées.'
        : ' Merci de procéder au règlement pour éviter toute interruption de service.');

    const { rowCount } = await tx.query(
      `INSERT INTO dunning_notices
         (organization_id, invoice_id, level, channel, subject, body, days_overdue)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (invoice_id, level, channel) DO NOTHING`,
      [invoice.organization_id, invoice.id, level, channel, subject, body, daysOverdue],
    );

    if (rowCount > 0) {
      await tx.query(
        `UPDATE subscription_invoices
            SET status = 'overdue'
          WHERE id = $1 AND status IN ('issued','partially_paid')`,
        [invoice.id],
      );
      await tx.query(
        `UPDATE organization_subscriptions
            SET status = 'past_due'
          WHERE organization_id = $1
            AND status IN ('active','pending_payment','trialing')`,
        [invoice.organization_id],
      );
      this.access.invalidate(invoice.organization_id);
    }

    return rowCount > 0;
  }

  // -------------------------------------------------------------------
  // Consultation
  // -------------------------------------------------------------------
  async listInvoices(ctx: RequestContext, query: ListInvoicesDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Math.min(Number(query.pageSize ?? 25), 200);

    return this.db.readTransaction(ctx, async (tx) => {
      const rows = await tx.many(
        `SELECT i.id, i.number, i.kind, i.status::text AS status, i.currency,
                i.issue_date, i.due_date, i.period_start, i.period_end,
                i.subtotal, i.discount_total, i.total, i.amount_paid, i.balance,
                o.slug AS organization_slug, o.legal_name AS organization_name,
                count(*) OVER () AS total_count
           FROM subscription_invoices i
           JOIN organizations o ON o.id = i.organization_id
          WHERE ($1::uuid IS NULL OR i.organization_id = $1)
            AND ($2::text IS NULL OR i.status::text = $2)
            AND ($3::date IS NULL OR i.issue_date >= $3)
            AND ($4::date IS NULL OR i.issue_date <= $4)
          ORDER BY i.issue_date DESC, i.created_at DESC
          LIMIT $5 OFFSET $6`,
        [
          query.organizationId ?? null,
          query.status ?? null,
          query.from ?? null,
          query.to ?? null,
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

  async getInvoice(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const invoice = await tx.oneOrFail(
        `SELECT i.*, o.legal_name, o.slug, o.address, o.city, o.country_code, o.tax_id
           FROM subscription_invoices i
           JOIN organizations o ON o.id = i.organization_id
          WHERE i.id = $1`,
        [id],
        'Facture introuvable.',
      );
      const lines = await tx.many(
        `SELECT label, quantity, unit_price, discount_percent, tax_rate, line_total
           FROM subscription_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, label`,
        [id],
      );
      const payments = await tx.many(
        `SELECT method::text AS method, provider, amount, currency,
                status::text AS status, reference, paid_at
           FROM subscription_payments WHERE invoice_id = $1 ORDER BY paid_at`,
        [id],
      );
      const dunning = await tx.many(
        `SELECT level, channel, subject, sent_at, days_overdue
           FROM dunning_notices WHERE invoice_id = $1 ORDER BY level`,
        [id],
      );
      return { invoice, lines, payments, dunning };
    });
  }

  /** Vue « mes factures » pour la pharmacie elle-même. */
  async myInvoices(ctx: RequestContext) {
    return this.listInvoices(ctx, { organizationId: ctx.organizationId ?? undefined });
  }

  // -------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------
  private computeTotals(lines: InvoiceLineDraft[]) {
    let subtotal = 0;
    let discount = 0;
    for (const line of lines) {
      const gross = line.quantity * line.unitPrice;
      subtotal += gross;
      discount += (gross * line.discountPercent) / 100;
    }
    return {
      subtotal: this.round(subtotal),
      discount: this.round(discount),
      total: this.round(subtotal - discount),
    };
  }

  private async insertLines(tx: Tx, invoiceId: string, lines: InvoiceLineDraft[]) {
    for (const [index, line] of lines.entries()) {
      const gross = line.quantity * line.unitPrice;
      await tx.query(
        `INSERT INTO subscription_invoice_lines
           (invoice_id, label, quantity, unit_price, discount_percent,
            line_total, plan_id, addon_id, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          invoiceId,
          line.label,
          line.quantity,
          line.unitPrice,
          line.discountPercent,
          this.round(gross - (gross * line.discountPercent) / 100),
          line.planId ?? null,
          line.addonId ?? null,
          index,
        ],
      );
    }
  }

  private async nextNumber(tx: Tx, kind: string): Promise<string> {
    const row = await tx.oneOrFail<{ number: string }>(
      'SELECT nova.next_subscription_document_number($1) AS number',
      [kind],
    );
    return row.number;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** Utilisé par les tâches planifiées, hors requête HTTP. */
  systemContext(): RequestContext {
    return SYSTEM_CONTEXT;
  }
}
