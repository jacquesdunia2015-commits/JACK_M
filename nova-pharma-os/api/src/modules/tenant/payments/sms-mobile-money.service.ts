import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext, SYSTEM_CONTEXT, systemTenantContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { MobileMoneyService } from './mobile-money.service';
import { SmsLu, lireSmsOperateur } from './sms-operateur';

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
const chiffres = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-9);

interface Attendu { id: string; reference: string; operator_code: string; amount: string; currency: string; payer_phone: string; requested_at: string }

/**
 * Confirmation des versements Mobile Money par le SMS de l'opérateur :
 * collé par le caissier, ou transféré automatiquement par le téléphone
 * marchand (application gratuite de transfert de SMS).
 */
@Injectable()
export class SmsMobileMoneyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly mobileMoney: MobileMoneyService,
  ) {}

  /** Versements attendus que ce SMS pourrait confirmer (même montant, même devise). */
  private async candidats(tx: Tx, lu: SmsLu): Promise<Attendu[]> {
    if (!lu.amount || !lu.currency) return [];
    const liste = await tx.many<Attendu>(
      `SELECT id, reference, operator_code, amount, currency, payer_phone, requested_at
         FROM mobile_money_collections
        WHERE status = 'requested' AND currency = $1 AND abs(amount - $2) < 0.005
          AND requested_at > now() - interval '7 days'
        ORDER BY requested_at DESC`,
      [lu.currency, lu.amount],
    );
    return liste.filter((c) => (!lu.operator || c.operator_code === lu.operator) && (!lu.phone || chiffres(c.payer_phone) === chiffres(lu.phone)));
  }

  /** Ce que NOVA lit dans un SMS, et les versements qu'il pourrait confirmer. */
  async analyser(ctx: RequestContext, texte: string) {
    const lu = lireSmsOperateur(texte);
    const candidats = await this.db.readTransaction(ctx, (tx) => this.candidats(tx, lu));
    return { parsed: lu, candidates: candidats };
  }

  /**
   * Confirme un versement attendu avec le SMS de l'opérateur : montant et
   * devise doivent correspondre, l'identifiant de transaction est repris du
   * SMS (pas de faute de frappe possible).
   */
  async confirmerParSms(ctx: RequestContext, id: string, texte: string, noterLeSms = true) {
    const lu = lireSmsOperateur(texte);
    if (lu.direction === 'sent') throw new BusinessRuleException("Ce SMS décrit un envoi d'argent, pas un versement reçu.");
    if (!lu.transactionId) throw new BusinessRuleException("Identifiant de transaction introuvable dans ce SMS : saisissez-le à la main.");
    if (!lu.amount) throw new BusinessRuleException('Montant introuvable dans ce SMS : saisissez la confirmation à la main.');
    const c = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<Attendu>('SELECT * FROM mobile_money_collections WHERE id = $1', [id], 'Encaissement introuvable.'),
    );
    if (Math.abs(Number(c.amount) - lu.amount) >= 0.005 || (lu.currency && lu.currency !== c.currency)) {
      throw new BusinessRuleException(
        `Le SMS annonce ${lu.amount.toLocaleString('fr-FR')} ${lu.currency ?? ''}, l'encaissement attend ${Number(c.amount).toLocaleString('fr-FR')} ${c.currency} : vérifiez le versement.`,
      );
    }
    if (lu.operator && lu.operator !== c.operator_code) {
      throw new BusinessRuleException(`Ce SMS vient de ${lu.operator}, l'encaissement était demandé sur ${c.operator_code}.`);
    }
    const confirme = await this.mobileMoney.confirmer(ctx, id, { operatorReference: lu.transactionId });
    if (noterLeSms) await this.db.transaction(ctx, (tx) => this.noter(tx, ctx.organizationId as string, 'paste', null, texte, lu, 'matched', id));
    return confirme;
  }

  private async noter(tx: Tx, organizationId: string, source: string, sender: string | null, texte: string, lu: SmsLu, statut: string, collectionId: string | null, note?: string) {
    return tx.oneOrFail<{ id: string }>(
      `INSERT INTO mobile_money_sms
         (organization_id, source, sender, body, operator_code, amount, currency, payer_phone, transaction_id, status, collection_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [organizationId, source, sender, texte.slice(0, 2000), lu.operator, lu.amount, lu.currency, lu.phone, lu.transactionId, statut, collectionId, note ?? null],
    );
  }

  // ------------------------------------------------------------------
  // Transfert automatique depuis le téléphone marchand
  // ------------------------------------------------------------------

  async lien(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const l = await tx.one<{ token_hint: string; is_active: boolean; last_received_at: string | null; created_at: string }>(
        'SELECT token_hint, is_active, last_received_at, created_at FROM mobile_money_sms_links WHERE organization_id = $1',
        [ctx.organizationId],
      );
      return l ?? null;
    });
  }

  /** Nouveau lien secret ; l'ancien cesse aussitôt de fonctionner. Le jeton n'est montré qu'une fois. */
  async genererLien(ctx: RequestContext) {
    const jeton = randomBytes(24).toString('base64url');
    await this.db.transaction(ctx, async (tx) => {
      await tx.query(
        `INSERT INTO mobile_money_sms_links (organization_id, token_hash, token_hint, created_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (organization_id) DO UPDATE
           SET token_hash = EXCLUDED.token_hash, token_hint = EXCLUDED.token_hint, is_active = true,
               created_by = EXCLUDED.created_by, last_received_at = NULL`,
        [ctx.organizationId, empreinte(jeton), `…${jeton.slice(-4)}`, ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, { action: 'payments.sms_link.generated', entity: 'mobile_money_sms_links', entityId: ctx.organizationId as string });
    });
    return { token: jeton, path: `/api/public/mobile-money/sms/${jeton}` };
  }

  async desactiverLien(ctx: RequestContext) {
    return this.db.transaction(ctx, (tx) => tx.query('UPDATE mobile_money_sms_links SET is_active = false WHERE organization_id = $1', [ctx.organizationId]));
  }

  /**
   * SMS transféré par le téléphone marchand. Un seul versement attendu
   * correspond (montant, devise, opérateur, numéro) : il est confirmé. Sinon
   * le SMS attend dans la boîte de réception.
   */
  async recevoir(jeton: string, texte: string, expediteur?: string) {
    const lienTrouve = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ organization_id: string }>('SELECT organization_id FROM mobile_money_sms_links WHERE token_hash = $1 AND is_active', [empreinte(jeton ?? '')]),
    );
    if (!lienTrouve) throw new NotFoundException('Lien inconnu.');
    const orgId = lienTrouve.organization_id;
    const ctx: RequestContext = { ...systemTenantContext(orgId), actorLabel: 'transfert de SMS' };
    await this.db.transaction(ctx, (tx) => tx.query('UPDATE mobile_money_sms_links SET last_received_at = now() WHERE organization_id = $1', [orgId]));

    const lu = lireSmsOperateur(texte ?? '');
    if (lu.direction === 'sent' || !lu.amount) {
      await this.db.transaction(ctx, (tx) => this.noter(tx, orgId, 'forward', expediteur ?? null, texte, lu, 'ignored', null, lu.direction === 'sent' ? 'Envoi, pas un versement reçu' : 'Aucun montant lu'));
      return { status: 'ignored' };
    }
    if (lu.transactionId) {
      const deja = await this.db.readTransaction(ctx, (tx) =>
        tx.one('SELECT id FROM mobile_money_collections WHERE operator_reference = $1', [lu.transactionId]),
      );
      if (deja) {
        await this.db.transaction(ctx, (tx) => this.noter(tx, orgId, 'forward', expediteur ?? null, texte, lu, 'duplicate', null, 'Transaction déjà encaissée'));
        return { status: 'duplicate' };
      }
    }
    const candidats = await this.db.readTransaction(ctx, (tx) => this.candidats(tx, lu));
    if (candidats.length === 1 && lu.transactionId) {
      await this.mobileMoney.confirmer(ctx, candidats[0].id, { operatorReference: lu.transactionId });
      await this.db.transaction(ctx, (tx) => this.noter(tx, orgId, 'forward', expediteur ?? null, texte, lu, 'matched', candidats[0].id));
      return { status: 'matched', reference: candidats[0].reference };
    }
    await this.db.transaction(ctx, (tx) =>
      this.noter(tx, orgId, 'forward', expediteur ?? null, texte, lu, 'unmatched', null,
        candidats.length > 1 ? `${candidats.length} versements attendus du même montant` : !lu.transactionId ? 'Identifiant de transaction illisible' : 'Aucun versement attendu de ce montant'),
    );
    return { status: 'unmatched' };
  }

  async boite(ctx: RequestContext, statut?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT s.*, c.reference AS collection_reference FROM mobile_money_sms s
           LEFT JOIN mobile_money_collections c ON c.id = s.collection_id
          WHERE ($1::text IS NULL OR s.status = $1)
          ORDER BY s.received_at DESC LIMIT 100`,
        [statut || null],
      ),
    );
  }

  /** Rapproche à la main un SMS en attente d'un versement attendu. */
  async associer(ctx: RequestContext, smsId: string, collectionId: string) {
    const sms = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ body: string; status: string }>('SELECT body, status FROM mobile_money_sms WHERE id = $1', [smsId], 'SMS introuvable.'),
    );
    if (sms.status !== 'unmatched') throw new BusinessRuleException('Ce SMS est déjà traité.');
    // Le SMS est déjà dans la boîte : on le rapproche sans l'enregistrer une seconde fois.
    const confirme = await this.confirmerParSms(ctx, collectionId, sms.body, false);
    await this.db.transaction(ctx, (tx) => tx.query(
      `UPDATE mobile_money_sms SET status = 'matched', collection_id = $2 WHERE id = $1`, [smsId, collectionId],
    ));
    return confirme;
  }

  async ignorer(ctx: RequestContext, smsId: string) {
    return this.db.transaction(ctx, (tx) => tx.oneOrFail(
      `UPDATE mobile_money_sms SET status = 'ignored' WHERE id = $1 AND status = 'unmatched' RETURNING id, status`, [smsId], 'SMS introuvable ou déjà traité.',
    ));
  }
}
