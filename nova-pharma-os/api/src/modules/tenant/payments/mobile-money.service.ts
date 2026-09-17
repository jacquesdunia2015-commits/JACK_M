import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

export interface DemandeEncaissement {
  operatorCode: string;
  payerPhone: string;
  payerName?: string;
  amount: number;
  currency?: string;
  saleId?: string;
  invoiceId?: string;
  customerId?: string;
  branchId?: string;
  clientOperationId?: string;
}

/**
 * Encaissement Mobile Money.
 *
 * Aucune intégration d'opérateur n'est nécessaire pour s'en servir, et
 * c'est délibéré : sur le terrain, le client compose un code sur son
 * téléphone, l'argent arrive sur le compte marchand de la pharmacie, et
 * l'opérateur renvoie un identifiant de transaction. Ce que le logiciel
 * doit apporter, ce n'est pas le transport de l'argent — l'opérateur
 * s'en charge déjà — mais la certitude comptable :
 *
 *   • à qui se rapporte ce versement (vente, facture, client) ;
 *   • qu'il n'a pas été compté deux fois — l'identifiant de transaction
 *     de l'opérateur est unique par opérateur, la base le refuse ;
 *   • qui l'a confirmé, et quand.
 *
 * Le jour où la pharmacie ouvre un compte marchand avec API, la
 * confirmation viendra d'un appel automatique au lieu du vendeur. Le
 * modèle de données ne bouge pas.
 */
@Injectable()
export class MobileMoneyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async operateurs(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT id, code, label, merchant_number, ussd_pattern, active
           FROM mobile_money_operators
          WHERE active ORDER BY label`,
      ),
    );
  }

  async enregistrerOperateur(
    ctx: RequestContext,
    dto: { code: string; label: string; merchantNumber?: string; ussdPattern?: string },
  ) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `INSERT INTO mobile_money_operators
           (organization_id, code, label, merchant_number, ussd_pattern)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (organization_id, code) DO UPDATE
           SET label = EXCLUDED.label,
               merchant_number = COALESCE(EXCLUDED.merchant_number,
                                          mobile_money_operators.merchant_number),
               ussd_pattern    = COALESCE(EXCLUDED.ussd_pattern,
                                          mobile_money_operators.ussd_pattern),
               active = true
         RETURNING id, code, label, merchant_number, ussd_pattern`,
        [
          ctx.organizationId, dto.code, dto.label,
          dto.merchantNumber ?? null, dto.ussdPattern ?? null,
        ],
      ),
    );
  }

  /**
   * Ouvre une demande d'encaissement et rend au vendeur les instructions
   * à dicter au client. Rien n'est encore encaissé à ce stade.
   */
  async demander(ctx: RequestContext, dto: DemandeEncaissement) {
    if (!(dto.amount > 0)) {
      throw new BadRequestException('Le montant doit être supérieur à zéro.');
    }
    const branchId = dto.branchId ?? ctx.branchId;
    if (!branchId) throw new BadRequestException('Branche non précisée.');

    return this.db.transaction(ctx, async (tx) => {
      if (dto.clientOperationId) {
        const existant = await tx.one(
          `SELECT id, reference, status, instructions, amount, currency
             FROM mobile_money_collections
            WHERE organization_id = $1 AND client_operation_id = $2`,
          [ctx.organizationId, dto.clientOperationId],
        );
        if (existant) return existant;
      }

      const operateur = await tx.one<{
        code: string; label: string; merchant_number: string | null; ussd_pattern: string | null;
      }>(
        'SELECT code, label, merchant_number, ussd_pattern FROM mobile_money_operators WHERE code = $1',
        [dto.operatorCode],
      );
      if (!operateur) {
        throw new BusinessRuleException(`Opérateur « ${dto.operatorCode} » inconnu.`);
      }

      const devise = dto.currency ?? (await this.devise(tx, ctx.organizationId!));
      const reference = await this.referenceLibre(tx, ctx.organizationId!);

      const collecte = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO mobile_money_collections
           (organization_id, branch_id, operator_code, payer_phone, payer_name,
            amount, currency, reference, instructions, sale_id, invoice_id,
            customer_id, client_operation_id, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          ctx.organizationId, branchId, operateur.code, dto.payerPhone,
          dto.payerName ?? null, dto.amount, devise, reference,
          instructions(operateur, dto.amount, devise, reference),
          dto.saleId ?? null, dto.invoiceId ?? null, dto.customerId ?? null,
          dto.clientOperationId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      await this.audit.record(tx, {
        action: 'payments.mobile_money.request',
        entity: 'mobile_money_collections',
        entityId: collecte.id,
        after: { operator: operateur.code, amount: dto.amount, reference },
      });

      return tx.oneOrFail(
        `SELECT id, reference, operator_code, payer_phone, amount, currency,
                status, instructions, requested_at
           FROM mobile_money_collections WHERE id = $1`,
        [collecte.id],
      );
    });
  }

  /**
   * Confirme le versement à partir de l'identifiant de transaction rendu
   * par l'opérateur.
   *
   * L'identifiant est exigé : sans lui, rien ne distingue un versement
   * reçu d'un versement supposé, et la caisse ne se rapproche plus. Il
   * est unique par opérateur, si bien qu'une double saisie est refusée
   * par la base, pas seulement par le code.
   */
  async confirmer(
    ctx: RequestContext,
    id: string,
    dto: { operatorReference: string; payerName?: string },
  ) {
    if (!dto?.operatorReference?.trim()) {
      throw new BusinessRuleException(
        "L'identifiant de transaction de l'opérateur est obligatoire : " +
          "c'est lui qui prouve le versement et empêche de l'encaisser deux fois.",
      );
    }

    return this.db.transaction(ctx, async (tx) => {
      const collecte = await tx.one<{
        id: string; status: string; amount: string; currency: string;
        sale_id: string | null; customer_id: string | null;
        operator_code: string; reference: string;
      }>(
        `SELECT id, status, amount, currency, sale_id, customer_id,
                operator_code, reference
           FROM mobile_money_collections WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!collecte) throw new BusinessRuleException('Encaissement introuvable.');
      if (collecte.status === 'confirmed') {
        // Rejeu : on rend l'état existant plutôt que d'encaisser deux fois.
        return this.detail(tx, id);
      }
      if (collecte.status !== 'requested') {
        throw new BusinessRuleException(
          `Cet encaissement est ${collecte.status} : il ne peut plus être confirmé.`,
        );
      }

      const doublon = await tx.one<{ reference: string }>(
        `SELECT reference FROM mobile_money_collections
          WHERE organization_id = $1 AND operator_code = $2
            AND operator_reference = $3 AND id <> $4`,
        [ctx.organizationId, collecte.operator_code, dto.operatorReference.trim(), id],
      );
      if (doublon) {
        throw new BusinessRuleException(
          `Cette transaction a déjà été encaissée sous la référence ${doublon.reference}.`,
        );
      }

      await tx.query(
        `UPDATE mobile_money_collections
            SET status = 'confirmed', operator_reference = $2,
                payer_name = COALESCE($3, payer_name),
                confirmed_by = $4, confirmed_at = now()
          WHERE id = $1`,
        [
          id, dto.operatorReference.trim(), dto.payerName ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      // Rattachement comptable : le versement devient un règlement de la
      // vente, visible partout où les règlements le sont.
      if (collecte.sale_id) {
        await tx.query(
          `INSERT INTO sale_payments
             (organization_id, sale_id, method, provider, amount, currency, reference)
           VALUES ($1,$2,'mobile_money'::nova.payment_method,$3,$4::numeric,$5,$6)`,
          [
            ctx.organizationId, collecte.sale_id, collecte.operator_code,
            collecte.amount, collecte.currency, dto.operatorReference.trim(),
          ],
        );
        await tx.query(
          'UPDATE sales SET amount_paid = amount_paid + $2::numeric WHERE id = $1',
          [collecte.sale_id, collecte.amount],
        );
        // Un règlement reçu réduit ce que le client doit encore.
        if (collecte.customer_id) {
          await tx.query(
            `UPDATE customers
                SET outstanding_balance = GREATEST(outstanding_balance - $2::numeric, 0)
              WHERE id = $1`,
            [collecte.customer_id, collecte.amount],
          );
        }
      }

      await this.audit.record(tx, {
        action: 'payments.mobile_money.confirm',
        entity: 'mobile_money_collections',
        entityId: id,
        after: {
          operatorReference: dto.operatorReference.trim(),
          amount: collecte.amount,
        },
      });

      return this.detail(tx, id);
    });
  }

  async echouer(ctx: RequestContext, id: string, raison?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const apres = await tx.oneOrFail(
        `UPDATE mobile_money_collections
            SET status = 'failed', failure_reason = $2
          WHERE id = $1 AND status = 'requested'
          RETURNING id, status, failure_reason`,
        [id, raison ?? null],
      );
      await this.audit.record(tx, {
        action: 'payments.mobile_money.fail',
        entity: 'mobile_money_collections',
        entityId: id,
        reason: raison ?? null,
      });
      return apres;
    });
  }

  async liste(ctx: RequestContext, statut?: string, limite = 100) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT c.id, c.reference, c.operator_code, c.payer_phone, c.payer_name,
                c.amount, c.currency, c.status, c.operator_reference,
                c.requested_at, c.confirmed_at, c.failure_reason,
                s.number AS sale_number, cu.name AS customer_name,
                o.label AS operator_label
           FROM mobile_money_collections c
           LEFT JOIN sales s ON s.id = c.sale_id
           LEFT JOIN customers cu ON cu.id = c.customer_id
           LEFT JOIN mobile_money_operators o ON o.code = c.operator_code
                 AND o.organization_id = c.organization_id
          WHERE ($1::text IS NULL OR c.status = $1)
          ORDER BY c.requested_at DESC
          LIMIT $2`,
        [statut ?? null, Math.min(limite, 500)],
      ),
    );
  }

  /** Totaux du jour, pour le rapprochement de fin de journée. */
  async rapprochement(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT operator_code, currency,
                count(*) FILTER (WHERE status = 'confirmed')  AS confirmes,
                count(*) FILTER (WHERE status = 'requested')  AS en_attente,
                COALESCE(sum(amount) FILTER (WHERE status = 'confirmed'), 0) AS montant_confirme,
                COALESCE(sum(amount) FILTER (WHERE status = 'requested'), 0) AS montant_en_attente
           FROM mobile_money_collections
          WHERE requested_at >= date_trunc('day', now())
          GROUP BY operator_code, currency
          ORDER BY operator_code`,
      ),
    );
  }

  private detail(tx: Tx, id: string) {
    return tx.oneOrFail(
      `SELECT id, reference, operator_code, payer_phone, payer_name, amount,
              currency, status, operator_reference, sale_id, requested_at, confirmed_at
         FROM mobile_money_collections WHERE id = $1`,
      [id],
    );
  }

  /** La devise est celle de la pharmacie, comme pour toute vente. */
  private async devise(tx: Tx, organizationId: string): Promise<string> {
    const row = await tx.oneOrFail<{ currency: string }>(
      'SELECT currency FROM organizations WHERE id = $1',
      [organizationId],
    );
    return row.currency;
  }

  private async referenceLibre(tx: Tx, organizationId: string): Promise<string> {
    const row = await tx.oneOrFail<{ reference: string }>(
      `SELECT 'MM-' || to_char(now(), 'YYMMDD') || '-' ||
              lpad((count(*) + 1)::text, 4, '0') AS reference
         FROM mobile_money_collections
        WHERE organization_id = $1
          AND requested_at >= date_trunc('day', now())`,
      [organizationId],
    );
    return row.reference;
  }
}

/**
 * Instructions dictées au client.
 *
 * Le code USSD de l'opérateur ouvre son menu ; le numéro marchand et le
 * montant restent à saisir par le client. Écrire une séquence complète
 * serait une promesse fausse : elle diffère d'un opérateur à l'autre et
 * change sans préavis.
 */
export function instructions(
  operateur: { label: string; merchant_number: string | null; ussd_pattern: string | null },
  montant: number,
  devise: string,
  reference: string,
): string {
  const morceaux = [`${operateur.label} — ${montant} ${devise}`];
  if (operateur.ussd_pattern) morceaux.push(`Composez ${operateur.ussd_pattern}`);
  if (operateur.merchant_number) {
    morceaux.push(`Numéro marchand : ${operateur.merchant_number}`);
  }
  morceaux.push(`Référence à conserver : ${reference}`);
  return morceaux.join(' · ');
}
