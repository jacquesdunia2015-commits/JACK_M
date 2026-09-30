import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { COLONNES_OFFICINE, EnteteOfficine } from '../../../common/pdf/mise-en-page';
import { INDICATIFS_PAYS, chiffresTelephone, normaliserTelephone } from '../../../common/telephone';
import { codeClientSuivant } from '../customers/customers.service';
import { documentFacture } from './invoice-pdf';
import { ClientFactureDto, EmettreFactureDto, ListeFacturesDto } from './invoices.dto';

interface Facture {
  id: string;
  number: string;
  status: string;
  customer_id: string | null;
  sale_id: string | null;
  currency: string;
  issue_date: string;
  due_date: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  amount_paid: string;
  [colonne: string]: unknown;
}

/**
 * Factures remises aux clients de la pharmacie : émises depuis une vente,
 * au nom d'un client du fichier ou nommé sur le moment, imprimées ou
 * partagées en PDF au logo de la pharmacie.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext, query: ListeFacturesDto) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT i.id, i.number, i.status::text AS status, i.currency, i.issue_date,
                i.total, i.amount_paid, i.balance, i.sale_id, s.number AS sale_number,
                c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
                c.email AS customer_email
           FROM invoices i
           LEFT JOIN customers c ON c.id = i.customer_id
           LEFT JOIN sales s ON s.id = i.sale_id
          WHERE i.kind = 'invoice'
            AND ($1::uuid IS NULL OR i.customer_id = $1)
            AND ($2::text IS NULL OR i.number ILIKE '%'||$2||'%'
                 OR c.name ILIKE '%'||$2||'%' OR c.phone ILIKE '%'||$2||'%')
          ORDER BY i.created_at DESC
          LIMIT 200`,
        [query.customerId ?? null, query.search?.trim() || null],
      ),
    );
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.charger(tx, id));
  }

  /**
   * Facture d'une vente. Une vente n'a qu'une facture : la redemander
   * renvoie celle déjà émise, complétée du client s'il manquait.
   */
  async emettre(ctx: RequestContext, dto: EmettreFactureDto) {
    return this.db.transaction(ctx, async (tx) => {
      const vente = await tx.oneOrFail<{ id: string; status: string; customer_id: string | null; number: string }>(
        'SELECT id, status::text AS status, customer_id, number FROM sales WHERE id = $1',
        [dto.saleId],
        'Vente introuvable.',
      );
      if (vente.status === 'cancelled') {
        throw new BusinessRuleException('Cette vente est annulée : elle ne peut plus être facturée.');
      }

      const clientId = await this.resoudreClient(tx, ctx, dto);
      if (clientId && vente.customer_id && clientId !== vente.customer_id) {
        throw new BusinessRuleException('Cette vente est déjà rattachée à un autre client.');
      }
      if (clientId && !vente.customer_id) {
        await tx.query('UPDATE sales SET customer_id = $2 WHERE id = $1', [vente.id, clientId]);
      }

      const existante = await tx.one<{ id: string; customer_id: string | null }>(
        `SELECT id, customer_id FROM invoices
          WHERE sale_id = $1 AND kind = 'invoice' AND status <> 'cancelled'`,
        [vente.id],
      );
      if (existante) {
        if (clientId && !existante.customer_id) {
          await tx.query('UPDATE invoices SET customer_id = $2 WHERE id = $1', [existante.id, clientId]);
        }
        return { ...(await this.charger(tx, existante.id)), created: false };
      }

      const facture = await this.ecrire(tx, ctx, vente.id);
      await this.audit.record(tx, {
        action: 'invoices.issued',
        entity: 'invoice',
        entityId: facture.id,
        after: { number: facture.number, sale: vente.number, customer: clientId },
      });
      return { ...(await this.charger(tx, facture.id)), created: true };
    });
  }

  /**
   * Écrit la facture d'une vente, lignes comprises, dans la transaction de
   * l'appelant. Le montant payé exclut la part à crédit : c'est elle qui
   * reste due.
   */
  async ecrire(tx: Tx, ctx: RequestContext, saleId: string): Promise<{ id: string; number: string }> {
    const vente = await tx.oneOrFail<{
      branch_id: string; customer_id: string | null; currency: string; subtotal: string;
      discount_total: string; tax_total: string; total: string; amount_paid: string;
      credit: string; credit_days: number | null;
    }>(
      `SELECT s.branch_id, s.customer_id, s.currency, s.subtotal, s.discount_total,
              s.tax_total, s.total, s.amount_paid, c.credit_days,
              (SELECT COALESCE(sum(amount), 0) FROM sale_payments
                WHERE sale_id = s.id AND method = 'credit') AS credit
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.id = $1`,
      [saleId],
    );
    const total = Number(vente.total);
    const paye = Math.min(total, Math.max(0, Math.round((Number(vente.amount_paid) - Number(vente.credit)) * 100) / 100));
    const statut = paye >= total ? 'paid' : paye > 0 ? 'partially_paid' : 'issued';
    const numero = await this.numbering.next(tx, 'invoice', { branchId: vente.branch_id });

    const facture = await tx.oneOrFail<{ id: string; number: string }>(
      `INSERT INTO invoices
         (organization_id, branch_id, number, kind, status, customer_id, sale_id,
          currency, issue_date, due_date, subtotal, discount_total, tax_total, total,
          amount_paid, created_by)
       VALUES ($1, $2, $3, 'invoice', $4::nova.invoice_status, $5, $6, $7, CURRENT_DATE,
               CURRENT_DATE + $8::int,
               $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::numeric, $14)
       RETURNING id, number`,
      [
        ctx.organizationId, vente.branch_id, numero, statut, vente.customer_id, saleId,
        vente.currency,
        // L'échéance ne concerne que ce qui reste dû, au délai de crédit du client.
        statut !== 'paid' && (vente.credit_days ?? 0) > 0 ? vente.credit_days : null,
        vente.subtotal, vente.discount_total,
        vente.tax_total, vente.total, paye, ctx.actorKind === 'user' ? ctx.actorId : null,
      ],
    );
    await tx.query(
      `INSERT INTO invoice_lines
         (organization_id, invoice_id, product_id, description, quantity,
          unit_price, discount_percent, tax_rate, line_total, sort_order)
       SELECT organization_id, $2, product_id, description, quantity,
              unit_price, discount_percent, tax_rate, line_total, sort_order
         FROM sale_lines WHERE sale_id = $1`,
      [saleId, facture.id],
    );
    return facture;
  }

  /** La facture en PDF, au logo de la pharmacie. */
  async pdf(ctx: RequestContext, id: string) {
    const { facture, officine } = await this.db.readTransaction(ctx, async (tx) => ({
      facture: await this.charger(tx, id),
      officine: await tx.oneOrFail<EnteteOfficine>(
        `SELECT ${COLONNES_OFFICINE} FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      ),
    }));
    const f = facture.invoice;
    const c = facture.customer;
    const fichier = await documentFacture({
      officine,
      numero: f.number,
      date: f.issue_date,
      echeance: f.due_date,
      numeroVente: (f.sale_number as string | null) ?? null,
      devise: f.currency,
      statut: f.status,
      client: c
        ? {
            nom: c.name as string, code: c.code as string, telephone: c.phone as string | null,
            email: c.email as string | null, adresse: c.address as string | null,
            ville: c.city as string | null, numeroImpot: c.tax_id as string | null,
          }
        : null,
      ordonnance: f.patient_name || f.prescriber_name
        ? { patient: f.patient_name as string | null, prescripteur: f.prescriber_name as string | null }
        : null,
      lignes: facture.lines.map((l) => ({
        designation: l.description,
        detail: [l.lot_number ? `Lot ${l.lot_number}` : null, l.expiry_date ? `exp. ${l.expiry_date.slice(5, 7)}/${l.expiry_date.slice(0, 4)}` : null]
          .filter(Boolean).join(' · ') || null,
        quantite: Number(l.quantity),
        prixUnitaire: Number(l.unit_price),
        remise: Number(l.discount_percent),
        montant: Number(l.line_total),
      })),
      sousTotal: Number(f.subtotal),
      remise: Number(f.discount_total),
      taxe: Number(f.tax_total),
      total: Number(f.total),
      paye: Number(f.amount_paid),
      paiements: facture.payments
        .filter((p) => p.method !== 'credit')
        .map((p) => ({ moyen: p.method, fournisseur: p.provider, montant: Number(p.amount), reference: p.reference })),
      rendu: Number(f.change_given ?? 0),
      vendeur: (f.sold_by_name as string | null) ?? null,
    });
    const nomClient = c ? `-${String(c.name).normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}` : '';
    return { fichier, nom: `${f.number}${nomClient}.pdf` };
  }

  // -------------------------------------------------------------------

  private async charger(tx: Tx, id: string) {
    const invoice = await tx.oneOrFail<Facture>(
      `SELECT i.*, i.status::text AS status, to_char(i.issue_date, 'YYYY-MM-DD') AS issue_date,
              to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
              s.number AS sale_number, s.sold_at, s.status::text AS sale_status, s.change_given,
              u.full_name AS sold_by_name, pr.patient_name, pr.prescriber_name
         FROM invoices i
         LEFT JOIN sales s ON s.id = i.sale_id
         LEFT JOIN users u ON u.id = s.sold_by
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
        WHERE i.id = $1 AND i.kind = 'invoice'`,
      [id],
      'Facture introuvable.',
    );
    const customer = invoice.customer_id
      ? await tx.one(
          `SELECT id, code, name, phone, email, address, city, tax_id, kind
             FROM customers WHERE id = $1`,
          [invoice.customer_id],
        )
      : null;
    // Les lignes de la vente portent le lot et sa péremption ; une facture
    // sans vente garde les siennes.
    const lines = invoice.sale_id
      ? await tx.many<LigneFacture>(
          `SELECT l.description, l.quantity, l.unit_price, l.discount_percent,
                  l.tax_rate, l.line_total, p.sku, pl.lot_number,
                  to_char(pl.expiry_date, 'YYYY-MM-DD') AS expiry_date
             FROM sale_lines l
             JOIN products p ON p.id = l.product_id
             LEFT JOIN product_lots pl ON pl.id = l.lot_id
            WHERE l.sale_id = $1 ORDER BY l.sort_order`,
          [invoice.sale_id],
        )
      : await tx.many<LigneFacture>(
          `SELECT l.description, l.quantity, l.unit_price, l.discount_percent,
                  l.tax_rate, l.line_total, p.sku, NULL AS lot_number, NULL AS expiry_date
             FROM invoice_lines l LEFT JOIN products p ON p.id = l.product_id
            WHERE l.invoice_id = $1 ORDER BY l.sort_order`,
          [id],
        );
    const payments = invoice.sale_id
      ? await tx.many<{ method: string; provider: string | null; amount: string; reference: string | null }>(
          `SELECT method::text AS method, provider, amount, reference
             FROM sale_payments WHERE sale_id = $1 ORDER BY received_at`,
          [invoice.sale_id],
        )
      : [];
    return { invoice, customer, lines, payments };
  }

  /** Client de la facture : celui du fichier, ou le nouveau, retrouvé par son téléphone. */
  private async resoudreClient(tx: Tx, ctx: RequestContext, dto: EmettreFactureDto): Promise<string | null> {
    if (dto.customerId && dto.customer) {
      throw new BadRequestException('Choisissez un client du fichier ou nommez-en un nouveau, pas les deux.');
    }
    if (dto.customerId) {
      const client = await tx.oneOrFail<{ id: string }>(
        'SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL',
        [dto.customerId],
        'Client introuvable.',
      );
      return client.id;
    }
    if (!dto.customer) return null;
    return this.clientParTelephoneOuNouveau(tx, ctx, dto.customer);
  }

  private async clientParTelephoneOuNouveau(tx: Tx, ctx: RequestContext, client: ClientFactureDto) {
    const pays = await tx.oneOrFail<{ country_code: string | null }>(
      'SELECT country_code FROM organizations WHERE id = $1',
      [ctx.organizationId],
    );
    const indicatif = INDICATIFS_PAYS[pays.country_code ?? 'CD'] ?? '+243';
    const telephone = client.phone ? normaliserTelephone(client.phone, indicatif) : null;

    if (telephone) {
      // Les numéros déjà au fichier ont pu être saisis à la main : on compare
      // leurs chiffres une fois ramenés au format international.
      const chiffres = chiffresTelephone(telephone, indicatif) as string;
      const national = `0${chiffres.slice(indicatif.length - 1)}`;
      const connu = await tx.one<{ id: string }>(
        `SELECT id FROM customers
          WHERE deleted_at IS NULL
            AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') IN ($1, $2)
          ORDER BY created_at LIMIT 1`,
        [chiffres, national],
      );
      if (connu) return connu.id;
    }

    const code = await codeClientSuivant(tx, ctx.organizationId as string);
    const cree = await tx.oneOrFail<{ id: string }>(
      `INSERT INTO customers
         (organization_id, code, kind, name, phone, email, address, city, tax_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        ctx.organizationId, code, client.taxId ? 'professional' : 'individual', client.name.trim(),
        telephone, client.email ?? null, client.address ?? null, client.city ?? null, client.taxId ?? null,
      ],
    );
    await this.audit.record(tx, {
      action: 'customers.created',
      entity: 'customer',
      entityId: cree.id,
      after: { code, name: client.name, from: 'invoice' },
    });
    return cree.id;
  }
}

interface LigneFacture {
  description: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_rate: string;
  line_total: string;
  sku: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  [colonne: string]: unknown;
}
