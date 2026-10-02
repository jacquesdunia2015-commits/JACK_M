import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { COLONNES_OFFICINE, EnteteOfficine } from '../../../common/pdf/mise-en-page';
import {
  ClaimInput, ClaimPaymentInput, MemberInput, MemberUpdate, PayerInput, PayerUpdate,
} from './dto';
import { documentReleve } from './releve-pdf';

const arrondi2 = (n: number) => Math.round(n * 100) / 100;

/** Partage d'une vente entre le payeur et le patient. */
export interface PriseEnCharge {
  payerId: string;
  payerName: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  percent: number;
  payerShare: number;
  patientShare: number;
  /** Reste du plafond annuel du bénéficiaire avant cette vente (null : sans plafond). */
  remainingCeiling: number | null;
  /** La part du payeur a été réduite par un plafond. */
  capped: boolean;
  reason: string | null;
}

/**
 * Tiers payant : organismes qui prennent en charge une partie des
 * médicaments (assurances, mutuelles, employeurs, ONG), leurs bénéficiaires,
 * le partage de chaque vente et les relevés mensuels qui leur sont présentés.
 */
@Injectable()
export class PayersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // Organismes payeurs
  // -------------------------------------------------------------------
  async list(ctx: RequestContext, search?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT p.*,
                (SELECT count(*) FROM payer_members m WHERE m.payer_id = p.id AND m.is_active) AS members,
                COALESCE((SELECT sum(s.payer_share) FROM sales s
                           WHERE s.payer_id = p.id AND s.status <> 'cancelled'
                             AND s.payer_claim_id IS NULL), 0) AS unclaimed,
                COALESCE((SELECT sum(c.balance) FROM payer_claims c
                           WHERE c.payer_id = p.id AND c.status IN ('draft','sent','partially_paid')), 0) AS claimed_due
           FROM payers p
          WHERE ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%' OR p.code ILIKE '%' || $1 || '%')
          ORDER BY p.is_active DESC, p.name`,
        [search?.trim() || null],
      ),
    );
  }

  async create(ctx: RequestContext, dto: PayerInput) {
    return this.db.transaction(ctx, async (tx) => {
      const code = dto.code?.trim().toUpperCase() || (await this.codeLibre(tx, dto.name));
      const doublon = await tx.one('SELECT id FROM payers WHERE code = $1', [code]);
      if (doublon) throw new BusinessRuleException(`Le code « ${code} » est déjà utilisé par un autre organisme.`);
      const payeur = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO payers
           (organization_id, code, name, kind, coverage_percent, per_sale_ceiling,
            contact_name, phone, email, address, payment_days, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          ctx.organizationId, code, dto.name.trim(), dto.kind ?? 'assurance',
          dto.coveragePercent ?? 80, dto.perSaleCeiling ?? null,
          dto.contactName ?? null, dto.phone ?? null, dto.email ?? null, dto.address ?? null,
          dto.paymentDays ?? 30, dto.notes ?? null,
        ],
      );
      await this.audit.record(tx, { action: 'payers.created', entity: 'payer', entityId: payeur.id, after: payeur });
      return payeur;
    });
  }

  async update(ctx: RequestContext, id: string, dto: PayerUpdate) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail('SELECT * FROM payers WHERE id = $1', [id], 'Organisme introuvable.');
      const colonnes: [string, unknown][] = [];
      const ajouter = (col: string, val: unknown) => { if (val !== undefined) colonnes.push([col, val]); };
      ajouter('name', dto.name?.trim());
      ajouter('kind', dto.kind);
      ajouter('coverage_percent', dto.coveragePercent);
      ajouter('per_sale_ceiling', dto.perSaleCeiling);
      ajouter('contact_name', dto.contactName);
      ajouter('phone', dto.phone);
      ajouter('email', dto.email);
      ajouter('address', dto.address);
      ajouter('payment_days', dto.paymentDays);
      ajouter('notes', dto.notes);
      ajouter('is_active', dto.isActive);
      if (!colonnes.length) return avant;
      const apres = await tx.oneOrFail(
        `UPDATE payers SET ${colonnes.map(([c], i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...colonnes.map(([, v]) => v)],
      );
      await this.audit.record(tx, { action: 'payers.updated', entity: 'payer', entityId: id, before: avant, after: apres });
      return apres;
    });
  }

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const payer = await tx.oneOrFail('SELECT * FROM payers WHERE id = $1', [id], 'Organisme introuvable.');
      const members = await tx.many(
        `SELECT m.*, c.name AS customer_name,
                COALESCE((SELECT sum(s.payer_share) FROM sales s
                           WHERE s.payer_member_id = m.id AND s.status <> 'cancelled'
                             AND s.sold_at >= date_trunc('year', now())), 0) AS consumed_this_year
           FROM payer_members m
           LEFT JOIN customers c ON c.id = m.customer_id
          WHERE m.payer_id = $1
          ORDER BY m.is_active DESC, m.full_name`,
        [id],
      );
      const claims = await tx.many(
        `SELECT id, number, period_start, period_end, status, total, amount_paid, balance, due_date, sent_at,
                (SELECT count(*) FROM sales s WHERE s.payer_claim_id = c.id) AS sales
           FROM payer_claims c WHERE c.payer_id = $1 ORDER BY period_start DESC, created_at DESC LIMIT 50`,
        [id],
      );
      const unclaimed = await tx.many(
        `SELECT s.id, s.number, s.sold_at, s.total, s.payer_share, s.patient_share,
                s.authorization_number, m.full_name AS member_name, m.member_number
           FROM sales s
           LEFT JOIN payer_members m ON m.id = s.payer_member_id
          WHERE s.payer_id = $1 AND s.status <> 'cancelled' AND s.payer_claim_id IS NULL
          ORDER BY s.sold_at DESC LIMIT 200`,
        [id],
      );
      return { payer, members, claims, unclaimed };
    });
  }

  // -------------------------------------------------------------------
  // Bénéficiaires
  // -------------------------------------------------------------------
  /** Recherche au comptoir, tous organismes actifs : nom, carte ou matricule. */
  async searchMembers(ctx: RequestContext, q?: string, payerId?: string) {
    const terme = q?.trim() || null;
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT m.id, m.member_number, m.full_name, m.principal_name, m.phone, m.valid_until,
                m.is_active, m.annual_ceiling,
                COALESCE(m.coverage_percent, p.coverage_percent) AS coverage_percent,
                p.id AS payer_id, p.name AS payer_name, p.code AS payer_code, p.kind AS payer_kind,
                p.per_sale_ceiling,
                COALESCE((SELECT sum(s.payer_share) FROM sales s
                           WHERE s.payer_member_id = m.id AND s.status <> 'cancelled'
                             AND s.sold_at >= date_trunc('year', now())), 0) AS consumed_this_year
           FROM payer_members m
           JOIN payers p ON p.id = m.payer_id
          WHERE p.is_active
            AND ($2::uuid IS NULL OR p.id = $2)
            AND ($1::text IS NULL
                 OR m.full_name ILIKE '%' || $1 || '%'
                 OR m.member_number ILIKE '%' || $1 || '%'
                 OR m.phone ILIKE '%' || $1 || '%')
          ORDER BY m.full_name
          LIMIT 30`,
        [terme, payerId || null],
      ),
    );
  }

  async addMember(ctx: RequestContext, payerId: string, dto: MemberInput) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail('SELECT id FROM payers WHERE id = $1', [payerId], 'Organisme introuvable.');
      const numero = dto.memberNumber.trim();
      const doublon = await tx.one(
        'SELECT full_name FROM payer_members WHERE payer_id = $1 AND member_number = $2',
        [payerId, numero],
      );
      if (doublon) {
        throw new BusinessRuleException(`La carte ${numero} est déjà enregistrée (${(doublon as { full_name: string }).full_name}).`);
      }
      if (dto.customerId) {
        await tx.oneOrFail('SELECT id FROM customers WHERE id = $1', [dto.customerId], 'Client introuvable.');
      }
      const membre = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO payer_members
           (organization_id, payer_id, customer_id, member_number, full_name, principal_name, phone,
            coverage_percent, annual_ceiling, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          ctx.organizationId, payerId, dto.customerId ?? null, numero, dto.fullName.trim(),
          dto.principalName?.trim() || null, dto.phone?.trim() || null,
          dto.coveragePercent ?? null, dto.annualCeiling ?? null, dto.validUntil ?? null,
        ],
      );
      await this.audit.record(tx, { action: 'payers.member_added', entity: 'payer_member', entityId: membre.id, after: membre });
      return membre;
    });
  }

  async updateMember(ctx: RequestContext, memberId: string, dto: MemberUpdate) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail('SELECT * FROM payer_members WHERE id = $1', [memberId], 'Bénéficiaire introuvable.');
      const colonnes: [string, unknown][] = [];
      const ajouter = (col: string, val: unknown) => { if (val !== undefined) colonnes.push([col, val]); };
      ajouter('member_number', dto.memberNumber?.trim());
      ajouter('full_name', dto.fullName?.trim());
      ajouter('principal_name', dto.principalName);
      ajouter('phone', dto.phone);
      ajouter('customer_id', dto.customerId);
      ajouter('coverage_percent', dto.coveragePercent);
      ajouter('annual_ceiling', dto.annualCeiling);
      ajouter('valid_until', dto.validUntil);
      ajouter('is_active', dto.isActive);
      if (!colonnes.length) return avant;
      const apres = await tx.oneOrFail(
        `UPDATE payer_members SET ${colonnes.map(([c], i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
        [memberId, ...colonnes.map(([, v]) => v)],
      );
      await this.audit.record(tx, {
        action: 'payers.member_updated', entity: 'payer_member', entityId: memberId, before: avant, after: apres,
      });
      return apres;
    });
  }

  /** Aperçu du partage d'un montant, pour l'afficher au comptoir avant d'encaisser. */
  async apercu(ctx: RequestContext, memberId: string, montant: number) {
    return this.db.readTransaction(ctx, (tx) => this.priseEnCharge(tx, memberId, montant, false));
  }

  /**
   * Calcule la part du payeur pour une vente : taux du bénéficiaire (à
   * défaut celui de l'organisme), plafond par vente, reste du plafond
   * annuel. Dans une vente, la ligne du bénéficiaire est verrouillée : deux
   * caisses ne peuvent pas consommer ensemble le même reste de plafond.
   */
  async priseEnCharge(tx: Tx, memberId: string, total: number, verrouiller = true): Promise<PriseEnCharge> {
    const m = await tx.oneOrFail<{
      id: string; full_name: string; member_number: string; is_active: boolean; valid_until: string | null;
      coverage_percent: string | null; annual_ceiling: string | null;
      payer_id: string; payer_name: string; payer_active: boolean; payer_percent: string;
      per_sale_ceiling: string | null; expire: boolean;
    }>(
      `SELECT m.id, m.full_name, m.member_number, m.is_active, m.valid_until,
              m.coverage_percent, m.annual_ceiling,
              p.id AS payer_id, p.name AS payer_name, p.is_active AS payer_active,
              p.coverage_percent AS payer_percent, p.per_sale_ceiling,
              (m.valid_until IS NOT NULL AND m.valid_until < CURRENT_DATE) AS expire
         FROM payer_members m JOIN payers p ON p.id = m.payer_id
        WHERE m.id = $1${verrouiller ? ' FOR UPDATE OF m' : ''}`,
      [memberId],
      'Bénéficiaire introuvable.',
    );
    if (!m.payer_active) throw new BusinessRuleException(`L'organisme « ${m.payer_name} » n'est plus actif.`);
    if (!m.is_active) throw new BusinessRuleException(`La carte de ${m.full_name} est désactivée.`);
    if (m.expire) {
      throw new BusinessRuleException(
        `La carte de ${m.full_name} (${m.payer_name}) a expiré le ${String(m.valid_until).slice(0, 10)}.`,
      );
    }

    const percent = Number(m.coverage_percent ?? m.payer_percent);
    let part = arrondi2((total * percent) / 100);
    let capped = false;
    let reason: string | null = null;
    if (m.per_sale_ceiling !== null && part > Number(m.per_sale_ceiling)) {
      part = Number(m.per_sale_ceiling);
      capped = true;
      reason = `Plafond par vente de ${m.payer_name} : ${Number(m.per_sale_ceiling).toFixed(2)}.`;
    }
    let reste: number | null = null;
    if (m.annual_ceiling !== null) {
      const consomme = await tx.oneOrFail<{ total: string }>(
        `SELECT COALESCE(sum(payer_share), 0) AS total FROM sales
          WHERE payer_member_id = $1 AND status <> 'cancelled' AND sold_at >= date_trunc('year', now())`,
        [memberId],
      );
      reste = Math.max(0, arrondi2(Number(m.annual_ceiling) - Number(consomme.total)));
      if (part > reste) {
        part = reste;
        capped = true;
        reason = `Plafond annuel de ${m.full_name} : il reste ${reste.toFixed(2)} sur ${Number(m.annual_ceiling).toFixed(2)}.`;
      }
    }
    return {
      payerId: m.payer_id, payerName: m.payer_name, memberId: m.id, memberName: m.full_name,
      memberNumber: m.member_number, percent, payerShare: part, patientShare: arrondi2(total - part),
      remainingCeiling: reste, capped, reason,
    };
  }

  // -------------------------------------------------------------------
  // Relevés mensuels
  // -------------------------------------------------------------------
  async listClaims(ctx: RequestContext, payerId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT c.*, p.name AS payer_name,
                (SELECT count(*) FROM sales s WHERE s.payer_claim_id = c.id) AS sales
           FROM payer_claims c JOIN payers p ON p.id = c.payer_id
          WHERE ($1::uuid IS NULL OR c.payer_id = $1)
          ORDER BY c.created_at DESC LIMIT 100`,
        [payerId || null],
      ),
    );
  }

  async createClaim(ctx: RequestContext, dto: ClaimInput) {
    if (dto.periodEnd < dto.periodStart) throw new BusinessRuleException('La fin de la période précède son début.');
    return this.db.transaction(ctx, async (tx) => {
      const payer = await tx.oneOrFail<{ id: string; name: string; payment_days: number }>(
        'SELECT id, name, payment_days FROM payers WHERE id = $1', [dto.payerId], 'Organisme introuvable.',
      );
      const devise = await tx.oneOrFail<{ currency: string }>(
        'SELECT currency FROM organizations WHERE id = $1', [ctx.organizationId],
      );
      const ventes = await tx.many<{ id: string; payer_share: string }>(
        `SELECT id, payer_share FROM sales
          WHERE payer_id = $1 AND status <> 'cancelled' AND payer_claim_id IS NULL AND payer_share > 0
            AND (sold_at AT TIME ZONE (SELECT timezone FROM organizations o WHERE o.id = sales.organization_id))::date
                BETWEEN $2::date AND $3::date
          FOR UPDATE`,
        [payer.id, dto.periodStart, dto.periodEnd],
      );
      if (!ventes.length) {
        throw new BusinessRuleException(
          `Aucune vente prise en charge par « ${payer.name} » à présenter sur cette période.`,
        );
      }
      const total = arrondi2(ventes.reduce((s, v) => s + Number(v.payer_share), 0));
      const numero = await this.numbering.next(tx, 'payer_claim');
      const releve = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO payer_claims
           (organization_id, payer_id, number, period_start, period_end, currency, total, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          ctx.organizationId, payer.id, numero, dto.periodStart, dto.periodEnd, devise.currency, total,
          dto.notes ?? null, ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await tx.query('UPDATE sales SET payer_claim_id = $1 WHERE id = ANY($2::uuid[])', [releve.id, ventes.map((v) => v.id)]);
      await this.audit.record(tx, {
        action: 'payers.claim_created', entity: 'payer_claim', entityId: releve.id,
        after: { numero, payer: payer.name, ventes: ventes.length, total },
      });
      return releve;
    });
  }

  async getClaim(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, (tx) => this.chargerReleve(tx, id));
  }

  private async chargerReleve(tx: Tx, id: string) {
    const claim = await tx.oneOrFail<Record<string, unknown> & { payer_id: string }>(
      `SELECT c.*, p.name AS payer_name, p.code AS payer_code, p.kind AS payer_kind,
              p.contact_name AS payer_contact, p.phone AS payer_phone, p.email AS payer_email,
              p.address AS payer_address
         FROM payer_claims c JOIN payers p ON p.id = c.payer_id WHERE c.id = $1`,
      [id],
      'Relevé introuvable.',
    );
    const sales = await tx.many(
      `SELECT s.id, s.number, s.sold_at, s.total, s.payer_share, s.patient_share, s.coverage_percent,
              s.authorization_number, m.full_name AS member_name, m.member_number, m.principal_name,
              pr.prescriber_name
         FROM sales s
         LEFT JOIN payer_members m ON m.id = s.payer_member_id
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
        WHERE s.payer_claim_id = $1
        ORDER BY s.sold_at`,
      [id],
    );
    const payments = await tx.many(
      `SELECT method::text AS method, amount, reference, received_at
         FROM payer_claim_payments WHERE claim_id = $1 ORDER BY received_at`,
      [id],
    );
    return { claim, sales, payments };
  }

  async markSent(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await tx.oneOrFail<{ status: string; payer_id: string }>(
        'SELECT status, payer_id FROM payer_claims WHERE id = $1', [id], 'Relevé introuvable.',
      );
      if (c.status !== 'draft') throw new BusinessRuleException('Ce relevé a déjà été envoyé.');
      const r = await tx.oneOrFail(
        `UPDATE payer_claims c
            SET status = 'sent', sent_at = now(),
                due_date = CURRENT_DATE + (SELECT payment_days FROM payers WHERE id = c.payer_id)
          WHERE id = $1 RETURNING *`,
        [id],
      );
      await this.audit.record(tx, { action: 'payers.claim_sent', entity: 'payer_claim', entityId: id });
      return r;
    });
  }

  async recordPayment(ctx: RequestContext, id: string, dto: ClaimPaymentInput) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await tx.oneOrFail<{ status: string; balance: string; number: string; currency: string }>(
        'SELECT status, balance, number, currency FROM payer_claims WHERE id = $1 FOR UPDATE', [id], 'Relevé introuvable.',
      );
      if (c.status === 'cancelled') throw new BusinessRuleException('Ce relevé est annulé.');
      if (c.status === 'paid') throw new BusinessRuleException('Ce relevé est déjà réglé.');
      if (dto.amount > Number(c.balance) + 0.001) {
        throw new BusinessRuleException(
          `Le montant dépasse le reste dû sur le relevé ${c.number} : ${Number(c.balance).toFixed(2)} ${c.currency}.`,
        );
      }
      await tx.query(
        `INSERT INTO payer_claim_payments (organization_id, claim_id, method, amount, reference, created_by)
         VALUES ($1,$2,$3::nova.payment_method,$4,$5,$6)`,
        [ctx.organizationId, id, dto.method ?? 'bank_transfer', dto.amount, dto.reference ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      const r = await tx.oneOrFail(
        `UPDATE payer_claims
            SET amount_paid = amount_paid + $2,
                status = CASE WHEN amount_paid + $2 >= total - 0.001 THEN 'paid' ELSE 'partially_paid' END,
                sent_at = COALESCE(sent_at, now())
          WHERE id = $1 RETURNING *`,
        [id, dto.amount],
      );
      await this.audit.record(tx, {
        action: 'payers.claim_payment', entity: 'payer_claim', entityId: id,
        after: { amount: dto.amount, method: dto.method ?? 'bank_transfer', reference: dto.reference ?? null },
      });
      return r;
    });
  }

  async cancelClaim(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const c = await tx.oneOrFail<{ status: string; amount_paid: string }>(
        'SELECT status, amount_paid FROM payer_claims WHERE id = $1 FOR UPDATE', [id], 'Relevé introuvable.',
      );
      if (c.status === 'cancelled') throw new BusinessRuleException('Ce relevé est déjà annulé.');
      if (Number(c.amount_paid) > 0) {
        throw new BusinessRuleException('Un relevé déjà réglé, même en partie, ne peut pas être annulé.');
      }
      await tx.query('UPDATE sales SET payer_claim_id = NULL WHERE payer_claim_id = $1', [id]);
      const r = await tx.oneOrFail(
        `UPDATE payer_claims SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id],
      );
      await this.audit.record(tx, { action: 'payers.claim_cancelled', entity: 'payer_claim', entityId: id });
      return r;
    });
  }

  /**
   * Une vente annulée sort du relevé encore en brouillon qui la portait
   * (son total est recalculé) ; si le relevé est déjà envoyé, l'annulation
   * est refusée : il faut d'abord annuler le relevé.
   */
  async retirerVente(tx: Tx, saleId: string) {
    const v = await tx.one<{ payer_claim_id: string | null; payer_share: string }>(
      'SELECT payer_claim_id, payer_share FROM sales WHERE id = $1', [saleId],
    );
    if (!v?.payer_claim_id) return;
    const c = await tx.oneOrFail<{ status: string; number: string }>(
      'SELECT status, number FROM payer_claims WHERE id = $1 FOR UPDATE', [v.payer_claim_id],
    );
    if (c.status !== 'draft' && c.status !== 'cancelled') {
      throw new BusinessRuleException(
        `Cette vente figure sur le relevé ${c.number}, déjà présenté au payeur : annulez d'abord ce relevé.`,
      );
    }
    await tx.query('UPDATE sales SET payer_claim_id = NULL WHERE id = $1', [saleId]);
    if (c.status === 'draft') {
      await tx.query('UPDATE payer_claims SET total = total - $2 WHERE id = $1', [v.payer_claim_id, Number(v.payer_share)]);
    }
  }

  async claimPdf(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const { claim, sales, payments } = await this.chargerReleve(tx, id);
      const officine = await tx.oneOrFail<EnteteOfficine>(
        `SELECT ${COLONNES_OFFICINE} FROM organizations WHERE id = $1`, [tx.context.organizationId],
      );
      const c = claim as Record<string, string>;
      const fichier = await documentReleve({
        officine,
        numero: c.number,
        debut: c.period_start,
        fin: c.period_end,
        echeance: c.due_date ?? null,
        statut: c.status,
        devise: c.currency,
        payeur: {
          nom: c.payer_name, code: c.payer_code, contact: c.payer_contact ?? null,
          telephone: c.payer_phone ?? null, email: c.payer_email ?? null, adresse: c.payer_address ?? null,
        },
        lignes: (sales as Record<string, string>[]).map((s) => ({
          date: s.sold_at, vente: s.number, beneficiaire: s.member_name ?? '—', carte: s.member_number ?? '—',
          principal: s.principal_name ?? null, bon: s.authorization_number ?? null,
          total: Number(s.total), partPatient: Number(s.patient_share ?? 0), partPayeur: Number(s.payer_share),
          taux: Number(s.coverage_percent ?? 0),
        })),
        total: Number(c.total),
        paye: Number(c.amount_paid),
        reglements: (payments as Record<string, string>[]).map((p) => ({
          moyen: p.method, montant: Number(p.amount), reference: p.reference ?? null, date: p.received_at,
        })),
      });
      return { fichier, nom: `releve-${c.number}.pdf` };
    });
  }

  private async codeLibre(tx: Tx, nom: string): Promise<string> {
    const base = nom
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim()
      .split(/\s+/).filter((m) => m.length > 2 || /\d/.test(m))
      .map((m) => m.slice(0, 4)).slice(0, 2).join('-') || 'TP';
    let code = base;
    for (let i = 2; await tx.one('SELECT 1 FROM payers WHERE code = $1', [code]); i++) code = `${base}-${i}`;
    return code;
  }
}
