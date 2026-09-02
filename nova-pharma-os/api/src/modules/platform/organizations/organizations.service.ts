import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AccessContextService } from '../../../common/auth/access-context.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { AuthService } from '../../auth/auth.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DEFAULT_ROLES } from './default-roles';
import {
  CreateOrganizationDto,
  ListOrganizationsDto,
  SuspendOrganizationDto,
  TerminateOrganizationDto,
  UpdateOrganizationDto,
} from './dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly access: AccessContextService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // -------------------------------------------------------------------
  // Création d'une pharmacie cliente
  // -------------------------------------------------------------------
  /**
   * Provisionne une pharmacie complète en une transaction : organisation,
   * abonnement, branche principale, rôles livrés et compte administrateur.
   * Si l'une des étapes échoue, aucune organisation partielle ne subsiste.
   */
  async provision(ctx: RequestContext, dto: CreateOrganizationDto) {
    return this.db.transaction(ctx, async (tx) => {
      const country = await tx.oneOrFail<{
        code: string;
        default_currency: string;
        default_locale: string;
        default_timezone: string;
        phone_prefix: string | null;
      }>(
        `SELECT code, default_currency, default_locale, default_timezone, phone_prefix
           FROM country_settings WHERE code = $1`,
        [dto.countryCode.toUpperCase()],
        `Pays « ${dto.countryCode} » non paramétré. Ajoutez-le au référentiel avant de créer la pharmacie.`,
      );

      const organization = await tx.oneOrFail(
        `INSERT INTO organizations
           (slug, legal_name, trade_name, kind, country_code, currency, locale, timezone,
            email, phone, address, city, tax_id, license_number, status, onboarding_step)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'organization_created')
         RETURNING *`,
        [
          dto.slug,
          dto.legalName,
          dto.tradeName ?? dto.legalName,
          dto.kind ?? 'pharmacy',
          country.code,
          dto.currency ?? country.default_currency,
          dto.locale ?? country.default_locale,
          dto.timezone ?? country.default_timezone,
          dto.email ?? null,
          dto.phone ?? null,
          dto.address ?? null,
          dto.city ?? null,
          dto.taxId ?? null,
          dto.licenseNumber ?? null,
          dto.startTrial === false ? 'active' : 'trial',
        ],
      );

      const organizationId = organization.id as string;

      const subscription = await this.subscriptions.create(tx, {
        organizationId,
        planCode: dto.planCode,
        billingCycle: dto.billingCycle ?? 'monthly',
        startTrial: dto.startTrial !== false,
        trialDays: dto.trialDays,
        promoCode: dto.promoCode,
        currency: (dto.currency ?? country.default_currency) as string,
      });

      // La suite se crée dans le périmètre de la nouvelle pharmacie :
      // les politiques RLS s'appliquent dès la première ligne métier.
      const tenantTx = await this.enterTenant(tx, organizationId);

      const branch = await tenantTx.oneOrFail(
        `INSERT INTO branches (organization_id, code, name, is_main, city, address, phone, timezone)
         VALUES ($1, 'PRINCIPALE', $2, true, $3, $4, $5, $6)
         RETURNING *`,
        [
          organizationId,
          dto.mainBranchName ?? 'Officine principale',
          dto.city ?? null,
          dto.address ?? null,
          dto.phone ?? null,
          dto.timezone ?? country.default_timezone,
        ],
      );

      await this.seedRoles(tenantTx, organizationId);

      const owner = await tenantTx.oneOrFail(
        `INSERT INTO users
           (organization_id, email, full_name, password_hash, phone,
            locale, default_branch_id, is_owner, must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,false)
         RETURNING id, email, full_name, is_owner`,
        [
          organizationId,
          dto.owner.email.toLowerCase(),
          dto.owner.fullName,
          AuthService.hashPassword(dto.owner.password),
          dto.owner.phone ?? null,
          dto.locale ?? country.default_locale,
          branch.id,
        ],
      );

      await tenantTx.query(
        `INSERT INTO user_branches (user_id, branch_id, organization_id) VALUES ($1,$2,$3)`,
        [owner.id, branch.id, organizationId],
      );

      // Devise de travail et TVA par défaut de la pharmacie.
      await tenantTx.query(
        `INSERT INTO tax_rates (organization_id, code, name, rate, is_default)
         SELECT $1, 'TVA', 'TVA ' || vat_rate || ' %', vat_rate, true
           FROM country_settings WHERE code = $2`,
        [organizationId, country.code],
      );

      await this.seedMessaging(tenantTx, organizationId, country.phone_prefix);

      // Retour au contexte plateforme pour les écritures de niveau SaaS.
      const platformTx = await this.enterPlatform(tenantTx);

      if (dto.leadId) {
        await platformTx.query(
          `UPDATE leads SET stage = 'won', converted_organization_id = $2 WHERE id = $1`,
          [dto.leadId, organizationId],
        );
      }

      await this.audit.recordPlatform(platformTx, {
        organizationId,
        action: 'organization.provisioned',
        entity: 'organization',
        entityId: organizationId,
        after: {
          slug: dto.slug,
          plan: dto.planCode,
          trial: dto.startTrial !== false,
          owner: dto.owner.email,
        },
      });

      return {
        organization,
        subscription,
        mainBranch: branch,
        owner,
        onboarding: {
          currentStep: 'organization_created',
          nextStep: 'catalog_import',
          steps: ONBOARDING_STEPS,
        },
      };
    });
  }

  private async seedRoles(tx: Tx, organizationId: string): Promise<void> {
    for (const role of DEFAULT_ROLES) {
      const created = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO roles (organization_id, code, name, description, is_system)
         VALUES ($1,$2,$3,$4,true) RETURNING id`,
        [organizationId, role.code, role.name, role.description],
      );
      if (role.permissions.length > 0) {
        await tx.query(
          `INSERT INTO role_permissions (role_id, organization_id, permission_code)
           SELECT $1, $2, unnest($3::text[])`,
          [created.id, organizationId, role.permissions],
        );
      }
    }
  }

  /**
   * Bascule la transaction courante dans le périmètre d'une organisation.
   *
   * Nécessaire au provisionnement : le back-office SaaS doit écrire les
   * toutes premières lignes métier d'une pharmacie qu'il vient de créer,
   * et ces tables ne sont accessibles que depuis un contexte tenant.
   */
  /**
   * Messagerie client et Mobile Money, prêts à l'usage dès l'ouverture.
   *
   * Les deux démarrent en mode manuel : le message part du téléphone du
   * vendeur, la référence Mobile Money est saisie à la main. Aucun
   * contrat, aucun frais — une pharmacie peut envoyer un reçu WhatsApp
   * le jour de son ouverture. Les opérateurs sont ceux de la RD Congo ;
   * la pharmacie complète son numéro marchand, qui lui est propre.
   */
  private async seedMessaging(
    tx: Tx,
    organizationId: string,
    indicatif: string | null,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO messaging_settings (organization_id, default_country_code)
       VALUES ($1, COALESCE($2, '+243'))
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, indicatif],
    );

    await tx.query(
      `INSERT INTO message_templates
         (organization_id, code, channel, locale, label, body)
       SELECT $1, v.code, v.channel, 'fr', v.label, v.body
         FROM (VALUES
           ('receipt', 'whatsapp', 'Reçu de vente',
            'Bonjour {{client}}, merci de votre achat chez {{pharmacie}}. ' ||
            'Reçu {{numero}} — montant {{montant}}. Bonne santé à vous.'),
           ('payment_reminder', 'whatsapp', 'Rappel de paiement',
            'Bonjour {{client}}, votre solde chez {{pharmacie}} est de {{montant}}. ' ||
            'Merci de passer régler quand vous le pourrez.'),
           ('delivery_on_way', 'whatsapp', 'Livraison en route',
            'Bonjour {{client}}, votre commande {{numero}} de {{pharmacie}} est en route. ' ||
            'Montant à régler : {{montant}}.'),
           ('receipt_sms', 'sms', 'Reçu de vente (SMS)',
            '{{pharmacie}} : recu {{numero}}, montant {{montant}}. Merci.')
         ) AS v(code, channel, label, body)
       ON CONFLICT (organization_id, code, channel, locale) DO NOTHING`,
      [organizationId],
    );

    await tx.query(
      `INSERT INTO mobile_money_operators (organization_id, code, label, ussd_pattern)
       SELECT $1, v.code, v.label, v.ussd
         FROM (VALUES
           ('mpesa',     'M-Pesa (Vodacom)', '*1122#'),
           ('airtel',    'Airtel Money',     '*501#'),
           ('orange',    'Orange Money',     '*144#'),
           ('afrimoney', 'Afrimoney',        '*555#')
         ) AS v(code, label, ussd)
       ON CONFLICT (organization_id, code) DO NOTHING`,
      [organizationId],
    );
  }

  private async enterTenant(tx: Tx, organizationId: string): Promise<Tx> {
    await tx.query(
      `SELECT set_config('nova.organization_id', $1, true),
              set_config('nova.platform', 'off', true)`,
      [organizationId],
    );
    return { ...tx, context: { ...tx.context, organizationId, platform: false } };
  }

  /** Rend la main au contexte back-office SaaS. */
  private async enterPlatform(tx: Tx): Promise<Tx> {
    await tx.query(
      `SELECT set_config('nova.organization_id', '', true),
              set_config('nova.platform', 'on', true)`,
    );
    return { ...tx, context: { ...tx.context, organizationId: null, platform: true } };
  }

  // -------------------------------------------------------------------
  // Consultation
  // -------------------------------------------------------------------
  async list(ctx: RequestContext, query: ListOrganizationsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 200);

    return this.db.readTransaction(ctx, async (tx) => {
      const rows = await tx.many(
        `SELECT o.id, o.slug, o.legal_name, o.trade_name, o.kind, o.country_code,
                o.currency, o.city, o.status::text AS status, o.created_at,
                o.activated_at, o.suspended_at, o.terminated_at,
                s.status::text AS subscription_status,
                s.billing_cycle::text AS billing_cycle,
                s.current_period_end, s.trial_ends_at, s.unit_price,
                p.code AS plan_code, p.name AS plan_name,
                q.users_count,
                q.branches_count,
                (SELECT COALESCE(sum(si.balance), 0) FROM subscription_invoices si
                  WHERE si.organization_id = o.id
                    AND si.status IN ('issued','partially_paid','overdue')) AS outstanding_balance,
                count(*) OVER () AS total_count
           FROM organizations o
           LEFT JOIN organization_subscriptions s
             ON s.organization_id = o.id
            AND s.status NOT IN ('cancelled','expired','archived')
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
           -- Compteurs de quota : des nombres, jamais de données métier.
           LEFT JOIN nova.organization_quota_usage() q ON q.organization_id = o.id
          WHERE o.deleted_at IS NULL
            AND ($1::text IS NULL OR o.status::text = $1)
            AND ($2::text IS NULL OR p.code = $2)
            AND ($3::text IS NULL OR o.legal_name ILIKE '%'||$3||'%'
                 OR o.slug ILIKE '%'||$3||'%' OR o.trade_name ILIKE '%'||$3||'%')
          ORDER BY o.created_at DESC
          LIMIT $4 OFFSET $5`,
        [
          query.status ?? null,
          query.planCode ?? null,
          query.search ?? null,
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

  async get(ctx: RequestContext, id: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const organization = await tx.one(
        `SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!organization) throw new NotFoundException('Pharmacie introuvable.');

      const subscription = await tx.one(
        `SELECT s.*, p.code AS plan_code, p.name AS plan_name
           FROM organization_subscriptions s
           JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.organization_id = $1
          ORDER BY s.created_at DESC LIMIT 1`,
        [id],
      );

      const addons = await tx.many(
        `SELECT oa.id, oa.quantity, oa.unit_price, oa.currency, oa.active_from, oa.active_until,
                a.code, a.name
           FROM organization_addons oa
           JOIN plan_addons a ON a.id = oa.addon_id
          WHERE oa.organization_id = $1
            AND (oa.active_until IS NULL OR oa.active_until > now())`,
        [id],
      );

      // Le back-office lit la consommation des quotas, pas leur contenu.
      const usage = await tx.one<{
        users_count: string; branches_count: string;
        products_count: string; storage_mb: string;
      }>('SELECT * FROM nova.organization_quota_usage($1)', [id]);

      const invoices = await tx.many(
        `SELECT id, number, status::text AS status, issue_date, due_date,
                currency, total, amount_paid, balance
           FROM subscription_invoices
          WHERE organization_id = $1
          ORDER BY issue_date DESC, created_at DESC LIMIT 12`,
        [id],
      );

      const planChanges = await tx.many(
        `SELECT c.changed_at, c.reason, c.to_status::text AS to_status,
                fp.code AS from_plan, tp.code AS to_plan
           FROM subscription_plan_changes c
           LEFT JOIN subscription_plans fp ON fp.id = c.from_plan_id
           JOIN subscription_plans tp ON tp.id = c.to_plan_id
          WHERE c.organization_id = $1
          ORDER BY c.changed_at DESC LIMIT 20`,
        [id],
      );

      return {
        organization,
        subscription,
        addons,
        usage: {
          users: Number(usage?.users_count ?? 0),
          branches: Number(usage?.branches_count ?? 0),
          products: Number(usage?.products_count ?? 0),
          storageMb: Number(usage?.storage_mb ?? 0),
          limits: subscription
            ? {
                maxUsers: subscription.max_users,
                maxBranches: subscription.max_branches,
                maxProducts: subscription.max_products,
                storageQuotaMb: subscription.storage_quota_mb,
              }
            : null,
        },
        invoices,
        planChanges,
      };
    });
  }

  async update(ctx: RequestContext, id: string, dto: UpdateOrganizationDto) {
    const fields: Record<string, unknown> = {
      legal_name: dto.legalName,
      trade_name: dto.tradeName,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      tax_id: dto.taxId,
      license_number: dto.licenseNumber,
      locale: dto.locale,
      timezone: dto.timezone,
    };
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      throw new BadRequestException('Aucune modification fournie.');
    }

    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Pharmacie introuvable.',
      );
      const assignments = entries
        .map(([column], index) => `${column} = $${index + 2}`)
        .join(', ');
      const after = await tx.oneOrFail(
        `UPDATE organizations SET ${assignments} WHERE id = $1 RETURNING *`,
        [id, ...entries.map(([, value]) => value)],
      );
      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.updated',
        entity: 'organization',
        entityId: id,
        before,
        after,
      });
      this.access.invalidate(id);
      return after;
    });
  }

  // -------------------------------------------------------------------
  // Cycle de vie : suspension, réactivation, résiliation
  // -------------------------------------------------------------------
  /**
   * Suspend une pharmacie sans supprimer ni archiver ses données. Le
   * compte reste consultable en lecture seule ; toute écriture est
   * refusée jusqu'à réactivation.
   */
  async suspend(ctx: RequestContext, id: string, dto: SuspendOrganizationDto) {
    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Pharmacie introuvable.',
      );
      if (before.status === 'suspended') {
        return { organization: before, message: 'Pharmacie déjà suspendue.' };
      }

      const organization = await tx.oneOrFail(
        `UPDATE organizations
            SET status = 'suspended', suspended_at = now()
          WHERE id = $1 RETURNING *`,
        [id],
      );
      await this.subscriptions.changeStatus(tx, id, 'suspended', dto.reason);
      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.suspended',
        entity: 'organization',
        entityId: id,
        before,
        after: organization,
        reason: dto.reason,
      });
      this.access.invalidate(id);
      return {
        organization,
        message:
          'Pharmacie suspendue. Les données sont conservées et restent consultables en lecture seule.',
      };
    });
  }

  /** Réactive une pharmacie suspendue : elle retrouve ses données et ses accès. */
  async reactivate(ctx: RequestContext, id: string, reason = 'Réactivation manuelle.') {
    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Pharmacie introuvable.',
      );
      const organization = await tx.oneOrFail(
        `UPDATE organizations
            SET status = 'active', suspended_at = NULL,
                activated_at = COALESCE(activated_at, now())
          WHERE id = $1 RETURNING *`,
        [id],
      );
      await this.subscriptions.changeStatus(tx, id, 'active', reason);
      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.reactivated',
        entity: 'organization',
        entityId: id,
        before,
        after: organization,
        reason,
      });
      this.access.invalidate(id);
      return { organization, message: 'Pharmacie réactivée : accès et données restaurés.' };
    });
  }

  /**
   * Résilie l'abonnement. Les données ne sont pas détruites : elles sont
   * conservées jusqu'à la fin de la durée contractuelle, puis archivées.
   */
  async terminate(ctx: RequestContext, id: string, dto: TerminateOrganizationDto) {
    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [id],
        'Pharmacie introuvable.',
      );
      const retentionDays = dto.retentionDays ?? 365;

      const organization = await tx.oneOrFail(
        `UPDATE organizations
            SET status = 'terminated',
                terminated_at = now(),
                data_retention_until = (CURRENT_DATE + ($2 || ' days')::interval)::date
          WHERE id = $1 RETURNING *`,
        [id, String(retentionDays)],
      );
      await this.subscriptions.changeStatus(tx, id, 'cancelled', dto.reason);

      // Une sauvegarde est planifiée avant toute purge ultérieure.
      await tx.query(
        `INSERT INTO organization_backups (organization_id, kind, status, created_by)
         VALUES ($1, 'pre_termination', 'pending', $2)`,
        [id, ctx.actorId ?? null],
      );

      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.terminated',
        entity: 'organization',
        entityId: id,
        before,
        after: organization,
        reason: dto.reason,
      });
      this.access.invalidate(id);
      return {
        organization,
        message:
          `Abonnement résilié. Les données sont conservées jusqu'au ` +
          `${organization.data_retention_until} avant archivage.`,
      };
    });
  }

  /** Suppression logique : réversible tant que les données sont conservées. */
  async softDelete(ctx: RequestContext, id: string, reason: string) {
    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM organizations WHERE id = $1',
        [id],
        'Pharmacie introuvable.',
      );
      const organization = await tx.oneOrFail(
        `UPDATE organizations SET deleted_at = now(), status = 'archived'
          WHERE id = $1 RETURNING *`,
        [id],
      );
      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.soft_deleted',
        entity: 'organization',
        entityId: id,
        before,
        after: organization,
        reason,
      });
      this.access.invalidate(id);
      return { organization, message: 'Pharmacie archivée (suppression logique).' };
    });
  }

  async restore(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const organization = await tx.oneOrFail(
        `UPDATE organizations SET deleted_at = NULL, status = 'suspended'
          WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
        [id],
        'Aucune pharmacie archivée avec cet identifiant.',
      );
      await this.audit.recordPlatform(tx, {
        organizationId: id,
        action: 'organization.restored',
        entity: 'organization',
        entityId: id,
        after: organization,
      });
      this.access.invalidate(id);
      return {
        organization,
        message: 'Pharmacie restaurée en statut suspendu : réactivez-la pour rouvrir les accès.',
      };
    });
  }
}

export const ONBOARDING_STEPS = [
  'organization_created',
  'plan_selected',
  'main_branch_added',
  'localization_configured',
  'admin_created',
  'catalog_import',
  'stock_import',
  'users_created',
  'cash_register_configured',
  'payment_methods_configured',
  'guided_training',
  'production_validated',
] as const;
