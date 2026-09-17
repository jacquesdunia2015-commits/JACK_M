import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

export interface CustomerInput {
  code?: string;
  kind?: 'individual' | 'professional';
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  licenseNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  notes?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext, search?: string, kind?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT c.id, c.code, c.kind, c.name, c.contact_name, c.phone, c.email,
                c.city, c.credit_limit, c.credit_days, c.outstanding_balance,
                c.is_credit_blocked, c.loyalty_points, c.is_active,
                g.name AS group_name,
                (SELECT count(*) FROM sales s WHERE s.customer_id = c.id
                   AND s.status = 'completed') AS purchases,
                (SELECT COALESCE(sum(s.total), 0) FROM sales s
                  WHERE s.customer_id = c.id AND s.status = 'completed') AS lifetime_value,
                (SELECT max(s.sold_at) FROM sales s WHERE s.customer_id = c.id) AS last_purchase_at
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.group_id
          WHERE c.deleted_at IS NULL
            AND ($1::text IS NULL OR c.name ILIKE '%'||$1||'%'
                 OR c.code ILIKE '%'||$1||'%' OR c.phone ILIKE '%'||$1||'%')
            AND ($2::text IS NULL OR c.kind = $2)
          ORDER BY c.name LIMIT 300`,
        [search ?? null, kind ?? null],
      ),
    );
  }

  async create(ctx: RequestContext, dto: CustomerInput) {
    return this.db.transaction(ctx, async (tx) => {
      // Un code lisible est généré si l'utilisateur n'en fournit pas.
      const code =
        dto.code ??
        (
          await tx.oneOrFail<{ code: string }>(
            `SELECT COALESCE('CLI-' || lpad((count(*) + 1)::text, 5, '0'), 'CLI-00001') AS code
               FROM customers WHERE organization_id = $1`,
            [ctx.organizationId],
          )
        ).code;

      const customer = await tx.oneOrFail(
        `INSERT INTO customers
           (organization_id, code, kind, name, contact_name, email, phone, address,
            city, tax_id, license_number, credit_limit, credit_days, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          ctx.organizationId, code, dto.kind ?? 'individual', dto.name,
          dto.contactName ?? null, dto.email ?? null, dto.phone ?? null,
          dto.address ?? null, dto.city ?? null, dto.taxId ?? null,
          dto.licenseNumber ?? null, dto.creditLimit ?? 0, dto.creditDays ?? 0,
          dto.notes ?? null,
        ],
      );
      await this.audit.record(tx, {
        action: 'customers.created',
        entity: 'customer',
        entityId: customer.id as string,
        after: { code, name: dto.name, kind: dto.kind ?? 'individual' },
      });
      return customer;
    });
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const customer = await tx.oneOrFail(
        'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Client introuvable.',
      );
      const sales = await tx.many(
        `SELECT number, sold_at, currency, total, amount_paid, balance_due,
                status::text AS status
           FROM sales WHERE customer_id = $1 ORDER BY sold_at DESC LIMIT 50`,
        [id],
      );
      const invoices = await tx.many(
        `SELECT number, issue_date, due_date, currency, total, amount_paid, balance,
                status::text AS status
           FROM invoices WHERE customer_id = $1 ORDER BY issue_date DESC LIMIT 50`,
        [id],
      );
      const payments = await tx.many(
        `SELECT method::text AS method, amount, currency, reference, received_at
           FROM customer_payments WHERE customer_id = $1
          ORDER BY received_at DESC LIMIT 50`,
        [id],
      );
      return { customer, sales, invoices, payments };
    });
  }

  async update(ctx: RequestContext, id: string, dto: Partial<CustomerInput>) {
    const columns: Record<string, unknown> = {
      name: dto.name, contact_name: dto.contactName, email: dto.email,
      phone: dto.phone, address: dto.address, city: dto.city, tax_id: dto.taxId,
      license_number: dto.licenseNumber, credit_limit: dto.creditLimit,
      credit_days: dto.creditDays, notes: dto.notes,
    };
    const entries = Object.entries(columns).filter(([, value]) => value !== undefined);

    return this.db.transaction(ctx, async (tx) => {
      if (entries.length === 0) {
        return tx.oneOrFail('SELECT * FROM customers WHERE id = $1', [id], 'Client introuvable.');
      }
      const assignments = entries
        .map(([column], index) => `${column} = $${index + 2}`)
        .join(', ');
      const customer = await tx.oneOrFail(
        `UPDATE customers SET ${assignments} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [id, ...entries.map(([, value]) => value)],
        'Client introuvable.',
      );
      await this.audit.record(tx, {
        action: 'customers.updated',
        entity: 'customer',
        entityId: id,
        after: dto as Record<string, unknown>,
      });
      return customer;
    });
  }

  /** Encaissement d'un règlement client, imputé sur une facture ou sur l'encours. */
  async recordPayment(
    ctx: RequestContext,
    customerId: string,
    dto: {
      amount: number;
      method: string;
      invoiceId?: string;
      provider?: string;
      reference?: string;
      clientOperationId?: string;
    },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      if (dto.clientOperationId) {
        const existing = await tx.one(
          'SELECT * FROM customer_payments WHERE client_operation_id = $1',
          [dto.clientOperationId],
        );
        if (existing) return { payment: existing, duplicate: true };
      }

      const customer = await tx.oneOrFail<{
        id: string; name: string; outstanding_balance: string;
      }>(
        'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
        [customerId],
        'Client introuvable.',
      );

      if (dto.amount > Number(customer.outstanding_balance) + 0.001) {
        throw new BusinessRuleException(
          `Le règlement (${dto.amount}) dépasse l'encours de « ${customer.name} » ` +
            `(${customer.outstanding_balance}).`,
          { outstanding: Number(customer.outstanding_balance), amount: dto.amount },
        );
      }

      const currency = await tx.oneOrFail<{ currency: string }>(
        'SELECT currency FROM organizations WHERE id = $1',
        [ctx.organizationId],
      );

      const payment = await tx.oneOrFail(
        `INSERT INTO customer_payments
           (organization_id, branch_id, customer_id, invoice_id, method, provider,
            amount, currency, reference, client_operation_id, created_by)
         VALUES ($1,$2,$3,$4,$5::nova.payment_method,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          ctx.organizationId, ctx.branchId ?? null, customerId,
          dto.invoiceId ?? null, dto.method, dto.provider ?? null,
          dto.amount, currency.currency, dto.reference ?? null,
          dto.clientOperationId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      await tx.query(
        'UPDATE customers SET outstanding_balance = outstanding_balance - $2 WHERE id = $1',
        [customerId, dto.amount],
      );

      if (dto.invoiceId) {
        await tx.query(
          `UPDATE invoices
              SET amount_paid = amount_paid + $2,
                  status = CASE WHEN amount_paid + $2 >= total
                                THEN 'paid'::nova.invoice_status
                                ELSE 'partially_paid'::nova.invoice_status END
            WHERE id = $1`,
          [dto.invoiceId, dto.amount],
        );
      }

      await this.audit.record(tx, {
        action: 'customers.payment_received',
        entity: 'customer_payment',
        entityId: payment.id as string,
        after: { customer: customer.name, amount: dto.amount, method: dto.method },
      });

      return { payment, duplicate: false };
    });
  }

  /** Balance âgée des créances clients. */
  async agedReceivables(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT c.id, c.code, c.name, c.kind, c.phone, c.credit_limit,
                c.outstanding_balance, c.is_credit_blocked,
                COALESCE(sum(i.balance) FILTER (
                  WHERE CURRENT_DATE - i.due_date <= 0), 0) AS not_due,
                COALESCE(sum(i.balance) FILTER (
                  WHERE CURRENT_DATE - i.due_date BETWEEN 1 AND 30), 0) AS days_1_30,
                COALESCE(sum(i.balance) FILTER (
                  WHERE CURRENT_DATE - i.due_date BETWEEN 31 AND 60), 0) AS days_31_60,
                COALESCE(sum(i.balance) FILTER (
                  WHERE CURRENT_DATE - i.due_date BETWEEN 61 AND 90), 0) AS days_61_90,
                COALESCE(sum(i.balance) FILTER (
                  WHERE CURRENT_DATE - i.due_date > 90), 0) AS days_over_90
           FROM customers c
           LEFT JOIN invoices i ON i.customer_id = c.id
                AND i.status IN ('issued','partially_paid','overdue')
          WHERE c.deleted_at IS NULL AND c.outstanding_balance > 0
          GROUP BY c.id
          ORDER BY c.outstanding_balance DESC`,
      ),
    );
  }

  async setCreditBlock(ctx: RequestContext, id: string, blocked: boolean, reason?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const customer = await tx.oneOrFail(
        'UPDATE customers SET is_credit_blocked = $2 WHERE id = $1 RETURNING *',
        [id, blocked],
        'Client introuvable.',
      );
      await this.audit.record(tx, {
        action: blocked ? 'customers.credit_blocked' : 'customers.credit_unblocked',
        entity: 'customer',
        entityId: id,
        reason: reason ?? null,
      });
      return customer;
    });
  }
}
