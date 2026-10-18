import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { MessagingService } from '../messaging/messaging.service';

export const MALADIES = [
  'diabete', 'hypertension', 'vih', 'asthme', 'epilepsie', 'cardiaque', 'tuberculose', 'drepanocytose', 'autre',
] as const;

export interface TraitementInput {
  customerId: string;
  productId: string;
  condition?: string;
  daysPerUnit: number;
  remindDaysBefore?: number;
  lastDispensedAt?: string;
  lastQuantity?: number;
  notes?: string;
}

/**
 * Traitements suivis des malades chroniques : date de fin calculée à chaque
 * délivrance, liste des patients à prévenir, rappel WhatsApp prêt à partir
 * depuis le téléphone de la pharmacie (gratuit).
 */
@Injectable()
export class TraitementsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Liste des traitements, avec leur état : « en retard » (boîte finie),
   * « à prévenir » (fin dans moins de N jours), « en cours », « arrêté ».
   */
  async liste(ctx: RequestContext, filtre?: { etat?: string; customerId?: string }) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT * FROM (
           SELECT t.*, c.name AS customer_name, c.phone AS customer_phone,
                  p.name AS product_name, p.dosage AS product_dosage, p.sku,
                  (t.next_refill_date - j.aujourdhui) AS days_left,
                  CASE WHEN NOT t.is_active THEN 'arrete'
                       WHEN t.next_refill_date IS NULL THEN 'sans_date'
                       WHEN t.next_refill_date < j.aujourdhui THEN 'en_retard'
                       WHEN t.next_refill_date - j.aujourdhui <= t.remind_days_before THEN 'a_prevenir'
                       ELSE 'en_cours' END AS etat,
                  -- Déjà prévenu pour cette échéance ? (effacé à chaque délivrance)
                  (t.last_reminded_at IS NOT NULL) AS deja_prevenu
             FROM treatment_plans t
             JOIN customers c ON c.id = t.customer_id
             JOIN products p ON p.id = t.product_id
             -- « Aujourd'hui » au fuseau de la pharmacie, pas du serveur.
             JOIN LATERAL (SELECT (now() AT TIME ZONE o.timezone)::date AS aujourdhui
                             FROM organizations o WHERE o.id = t.organization_id) j ON true
            WHERE ($2::uuid IS NULL OR t.customer_id = $2)
         ) x
         WHERE ($1::text IS NULL
                OR ($1 = 'a_prevenir' AND x.etat IN ('a_prevenir', 'en_retard'))
                OR x.etat = $1)
         ORDER BY x.is_active DESC, x.next_refill_date NULLS LAST, x.customer_name`,
        [filtre?.etat || null, filtre?.customerId || null],
      ),
    );
  }

  async creer(ctx: RequestContext, dto: TraitementInput) {
    if (dto.condition && !(MALADIES as readonly string[]).includes(dto.condition)) {
      throw new BusinessRuleException('Maladie inconnue.');
    }
    return this.db.transaction(ctx, async (tx) => {
      const client = await tx.oneOrFail<{ name: string; phone: string | null }>(
        'SELECT name, phone FROM customers WHERE id = $1 AND deleted_at IS NULL', [dto.customerId], 'Patient introuvable.',
      );
      await tx.oneOrFail('SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL', [dto.productId], 'Produit introuvable.');
      const deja = await tx.one('SELECT id FROM treatment_plans WHERE customer_id = $1 AND product_id = $2', [dto.customerId, dto.productId]);
      if (deja) throw new BusinessRuleException(`Ce traitement de ${client.name} est déjà suivi.`);
      const t = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO treatment_plans
           (organization_id, customer_id, product_id, condition, days_per_unit, remind_days_before,
            last_dispensed_at, last_quantity, next_refill_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,
                 CASE WHEN $7::date IS NOT NULL AND $8::numeric IS NOT NULL
                      THEN $7::date + floor($8::numeric * $5::numeric)::integer END,
                 $9,$10)
         RETURNING *`,
        [
          ctx.organizationId, dto.customerId, dto.productId, dto.condition ?? 'autre', dto.daysPerUnit,
          dto.remindDaysBefore ?? 3, dto.lastDispensedAt ?? null, dto.lastQuantity ?? null, dto.notes ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, { action: 'treatments.created', entity: 'treatment_plan', entityId: t.id, after: t });
      return { ...t, sansTelephone: !client.phone };
    });
  }

  async modifier(ctx: RequestContext, id: string, dto: Partial<TraitementInput> & { isActive?: boolean }) {
    return this.db.transaction(ctx, async (tx) => {
      const avant = await tx.oneOrFail('SELECT * FROM treatment_plans WHERE id = $1', [id], 'Traitement introuvable.');
      const champs: [string, unknown][] = [];
      if (dto.condition !== undefined) champs.push(['condition', dto.condition]);
      if (dto.daysPerUnit !== undefined) champs.push(['days_per_unit', dto.daysPerUnit]);
      if (dto.remindDaysBefore !== undefined) champs.push(['remind_days_before', dto.remindDaysBefore]);
      if (dto.notes !== undefined) champs.push(['notes', dto.notes]);
      if (dto.isActive !== undefined) champs.push(['is_active', dto.isActive]);
      if (dto.lastDispensedAt !== undefined) {
        champs.push(['last_dispensed_at', dto.lastDispensedAt]);
        // Nouvelle délivrance notée à la main : nouvelle échéance, nouveau rappel.
        champs.push(['last_reminded_at', null]);
      }
      if (dto.lastQuantity !== undefined) champs.push(['last_quantity', dto.lastQuantity]);
      if (champs.length) {
        await tx.query(
          `UPDATE treatment_plans SET ${champs.map(([c], i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
          [id, ...champs.map(([, v]) => v)],
        );
      }
      // La date de fin suit toujours la dernière délivrance et la durée d'une unité.
      const apres = await tx.oneOrFail(
        `UPDATE treatment_plans
            SET next_refill_date = CASE WHEN last_dispensed_at IS NOT NULL AND last_quantity IS NOT NULL
                                        THEN last_dispensed_at + floor(last_quantity * days_per_unit)::integer END
          WHERE id = $1 RETURNING *`,
        [id],
      );
      await this.audit.record(tx, { action: 'treatments.updated', entity: 'treatment_plan', entityId: id, before: avant, after: apres });
      return apres;
    });
  }

  /**
   * Après une vente à un patient suivi : la délivrance du médicament
   * recalcule la date de fin de son traitement.
   */
  async apresVente(tx: Tx, customerId: string, lignes: { productId: string; quantity: number }[], vendueLe: Date) {
    const parProduit = new Map<string, number>();
    for (const l of lignes) parProduit.set(l.productId, (parProduit.get(l.productId) ?? 0) + l.quantity);
    for (const [produit, quantite] of parProduit) {
      await tx.query(
        `UPDATE treatment_plans
            SET last_dispensed_at = ($3::timestamptz AT TIME ZONE o.timezone)::date, last_quantity = $4,
                last_reminded_at = NULL,
                next_refill_date = ($3::timestamptz AT TIME ZONE o.timezone)::date
                                   + floor($4::numeric * days_per_unit)::integer
           FROM organizations o
          WHERE o.id = treatment_plans.organization_id
            AND customer_id = $1 AND product_id = $2 AND is_active`,
        [customerId, produit, vendueLe.toISOString(), quantite],
      );
    }
  }

  /** Prépare le rappel WhatsApp (lien wa.me) et note que le patient a été prévenu. */
  async rappeler(ctx: RequestContext, id: string, canal: 'whatsapp' | 'sms' = 'whatsapp') {
    const t = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{
        customer_id: string; customer_name: string; customer_phone: string | null; product_name: string;
        next_refill_date: string | null; is_active: boolean; passe: boolean;
      }>(
        `SELECT t.customer_id, c.name AS customer_name, c.phone AS customer_phone, p.name AS product_name,
                to_char(t.next_refill_date, 'YYYY-MM-DD') AS next_refill_date, t.is_active,
                COALESCE(t.next_refill_date < (now() AT TIME ZONE o.timezone)::date, false) AS passe
           FROM treatment_plans t JOIN customers c ON c.id = t.customer_id JOIN products p ON p.id = t.product_id
           JOIN organizations o ON o.id = t.organization_id
          WHERE t.id = $1`,
        [id], 'Traitement introuvable.',
      ),
    );
    if (!t.is_active) throw new BusinessRuleException('Ce traitement est arrêté.');
    if (!t.customer_phone) throw new BusinessRuleException(`${t.customer_name} n'a pas de numéro de téléphone : ajoutez-le à sa fiche.`);
    const pharmacie = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ name: string; phone: string | null }>(
        'SELECT COALESCE(trade_name, legal_name) AS name, phone FROM organizations WHERE id = $1', [ctx.organizationId],
      ),
    );
    const fin = t.next_refill_date
      ? new Date(`${t.next_refill_date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      : null;
    const corps =
      `Bonjour ${t.customer_name}, votre traitement ${t.product_name} ` +
      (!fin ? 'arrive bientôt à sa fin. ' : t.passe ? `devait être renouvelé le ${fin}. ` : `arrive à sa fin vers le ${fin}. `) +
      `Pour ne pas l'interrompre, passez à ${pharmacie.name} ou répondez à ce message : nous le préparons pour vous.` +
      (pharmacie.phone ? ` Tél. ${pharmacie.phone}.` : '');
    const message = await this.messaging.envoyer(ctx, {
      channel: canal, customerId: t.customer_id, body: corps, category: 'refill_reminder',
      entity: 'treatment_plan', entityId: id,
    });
    await this.db.transaction(ctx, (tx) =>
      tx.query('UPDATE treatment_plans SET last_reminded_at = now(), reminders_sent = reminders_sent + 1 WHERE id = $1', [id]),
    );
    return message;
  }
}
