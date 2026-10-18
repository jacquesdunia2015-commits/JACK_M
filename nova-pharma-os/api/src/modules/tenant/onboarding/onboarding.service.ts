import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

interface StepDefinition {
  code: string;
  label: string;
  description: string;
  /** Requête de vérification : la valeur `done` indique si l'étape est faite. */
  check: string;
}

/**
 * Parcours d'activation d'une pharmacie.
 *
 * L'avancement n'est pas déclaratif : chaque étape est vérifiée sur les
 * données réelles, si bien que la barre de progression reflète l'état
 * effectif de la mise en route.
 */
const STEPS: StepDefinition[] = [
  {
    code: 'organization_created',
    label: "Création de l'organisation",
    description: 'La pharmacie est enregistrée sur la plateforme.',
    check: 'SELECT true AS done',
  },
  {
    code: 'plan_selected',
    label: 'Choix du forfait',
    description: 'Un forfait est rattaché à la pharmacie.',
    check: `SELECT EXISTS (SELECT 1 FROM organization_subscriptions
                            WHERE organization_id = $1) AS done`,
  },
  {
    code: 'main_branch_added',
    label: 'Ajout de la branche principale',
    description: 'Au moins un point de vente est déclaré.',
    check: 'SELECT EXISTS (SELECT 1 FROM branches WHERE is_main) AS done',
  },
  {
    code: 'localization_configured',
    label: 'Devise et localisation',
    description: 'Devise, langue, fuseau horaire et TVA sont paramétrés.',
    check: `SELECT EXISTS (SELECT 1 FROM tax_rates WHERE is_default) AS done`,
  },
  {
    code: 'admin_created',
    label: "Création de l'administrateur pharmacie",
    description: 'Un compte responsable est actif.',
    check: 'SELECT EXISTS (SELECT 1 FROM users WHERE is_owner AND is_active) AS done',
  },
  {
    code: 'catalog_import',
    label: 'Import du catalogue initial',
    description: 'Au moins un produit est enregistré.',
    check: 'SELECT EXISTS (SELECT 1 FROM products WHERE deleted_at IS NULL) AS done',
  },
  {
    code: 'stock_import',
    label: 'Import du stock initial',
    description: 'Au moins une position de stock est renseignée.',
    check: 'SELECT EXISTS (SELECT 1 FROM stock_items WHERE quantity > 0) AS done',
  },
  {
    code: 'users_created',
    label: 'Création des utilisateurs',
    description: "L'équipe dispose de comptes en plus de l'administrateur.",
    check: `SELECT (SELECT count(*) FROM users
                     WHERE deleted_at IS NULL AND is_active) > 1 AS done`,
  },
  {
    code: 'cash_register_configured',
    label: 'Configuration de la caisse',
    description: 'Une session de caisse a déjà été ouverte.',
    check: 'SELECT EXISTS (SELECT 1 FROM cash_sessions) AS done',
  },
  {
    code: 'payment_methods_configured',
    label: 'Moyens de paiement',
    description: 'Les moyens de paiement acceptés sont déclarés.',
    check: `SELECT (settings ? 'paymentMethods') AS done
              FROM organizations WHERE id = $1`,
  },
  {
    code: 'guided_training',
    label: 'Formation guidée',
    description: "L'équipe a suivi la visite guidée de l'application.",
    check: `SELECT (settings ? 'trainingCompletedAt') AS done
              FROM organizations WHERE id = $1`,
  },
  {
    code: 'production_validated',
    label: 'Validation de mise en production',
    description: 'La pharmacie a confirmé le démarrage en exploitation réelle.',
    check: 'SELECT (onboarding_completed_at IS NOT NULL) AS done FROM organizations WHERE id = $1',
  },
];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async status(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const steps = [];
      for (const step of STEPS) {
        const row = await tx.one<{ done: boolean }>(
          step.check,
          step.check.includes('$1') ? [ctx.organizationId] : [],
        );
        steps.push({
          code: step.code,
          label: step.label,
          description: step.description,
          done: row?.done === true,
        });
      }
      const done = steps.filter((s) => s.done).length;
      const nextStep = steps.find((s) => !s.done)?.code ?? null;
      return {
        steps,
        completed: done,
        total: steps.length,
        progressPercent: Math.round((done / steps.length) * 100),
        nextStep,
        readyForProduction: steps
          .filter((s) => s.code !== 'production_validated')
          .every((s) => s.done),
      };
    });
  }

  /** Déclare les moyens de paiement acceptés par la pharmacie. */
  async setPaymentMethods(ctx: RequestContext, methods: string[]) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.query(
        `UPDATE organizations
            SET settings = settings || jsonb_build_object('paymentMethods', $2::jsonb),
                onboarding_step = 'payment_methods_configured'
          WHERE id = $1`,
        [ctx.organizationId, JSON.stringify(methods)],
      );
      await this.audit.record(tx, {
        action: 'onboarding.payment_methods_set',
        entity: 'organization',
        entityId: ctx.organizationId,
        after: { methods },
      });
      return { paymentMethods: methods };
    });
  }

  async completeTraining(ctx: RequestContext) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.query(
        `UPDATE organizations
            SET settings = settings || jsonb_build_object('trainingCompletedAt', to_jsonb(now())),
                onboarding_step = 'guided_training'
          WHERE id = $1`,
        [ctx.organizationId],
      );
      return { message: 'Formation guidée marquée comme suivie.' };
    });
  }

  /** Confirme le passage en exploitation réelle. */
  async validateProduction(ctx: RequestContext) {
    const status = await this.status(ctx);
    if (!status.readyForProduction) {
      const missing = status.steps.filter((s) => !s.done && s.code !== 'production_validated');
      return {
        validated: false,
        message: 'Des étapes restent à finaliser avant la mise en production.',
        missing: missing.map((s) => ({ code: s.code, label: s.label })),
      };
    }

    return this.db.transaction(ctx, async (tx) => {
      await tx.query(
        `UPDATE organizations
            SET onboarding_completed_at = now(),
                onboarding_step = 'production_validated'
          WHERE id = $1`,
        [ctx.organizationId],
      );
      await this.audit.record(tx, {
        action: 'onboarding.production_validated',
        entity: 'organization',
        entityId: ctx.organizationId,
      });
      return {
        validated: true,
        message: 'Mise en production validée. Bonne exploitation !',
      };
    });
  }

  /** Import du stock initial : quantités de départ, lots et péremptions. */
  async importInitialStock(
    ctx: RequestContext,
    branchId: string,
    lines: {
      sku: string;
      quantity: number;
      unitCost?: number;
      lotNumber?: string;
      expiryDate?: string;
    }[],
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const imported: string[] = [];
      const skipped: { sku: string; reason: string }[] = [];

      for (const line of lines) {
        const product = await tx.one<{
          id: string; name: string; has_expiry: boolean; is_batch_tracked: boolean;
        }>(
          `SELECT id, name, has_expiry, is_batch_tracked FROM products
            WHERE sku = $1 AND deleted_at IS NULL`,
          [line.sku],
        );
        if (!product) {
          skipped.push({ sku: line.sku, reason: 'Référence inconnue au catalogue.' });
          continue;
        }
        if (product.has_expiry && !line.expiryDate) {
          skipped.push({
            sku: line.sku,
            reason: 'Date de péremption requise pour ce produit.',
          });
          continue;
        }

        let lotId: string | null = null;
        if (product.is_batch_tracked) {
          const lot = await tx.oneOrFail<{ id: string }>(
            `INSERT INTO product_lots
               (organization_id, product_id, lot_number, expiry_date, cost_price)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (organization_id, product_id, lot_number)
             DO UPDATE SET expiry_date = COALESCE(EXCLUDED.expiry_date, product_lots.expiry_date)
             RETURNING id`,
            [
              ctx.organizationId, product.id,
              line.lotNumber ?? 'STOCK-INITIAL',
              line.expiryDate ?? null, line.unitCost ?? 0,
            ],
          );
          lotId = lot.id;
        }

        await tx.query(
          `INSERT INTO stock_items
             (organization_id, branch_id, product_id, lot_id, quantity, average_cost)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (branch_id, product_id,
                        COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid))
           DO UPDATE SET quantity = stock_items.quantity + EXCLUDED.quantity,
                         average_cost = EXCLUDED.average_cost`,
          [
            ctx.organizationId, branchId, product.id, lotId,
            line.quantity, line.unitCost ?? 0,
          ],
        );

        await tx.query(
          `INSERT INTO stock_movements
             (organization_id, branch_id, product_id, lot_id, kind, quantity,
              unit_cost, balance_after, reference_kind, reason, user_id)
           VALUES ($1,$2,$3,$4,'adjustment_in',$5,$6,
                   (SELECT quantity FROM stock_items
                     WHERE branch_id = $2 AND product_id = $3
                       AND COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
                           = COALESCE($4::uuid, '00000000-0000-0000-0000-000000000000'::uuid)),
                   'initial_stock', 'Stock initial (mise en route)', $7)`,
          [
            ctx.organizationId, branchId, product.id, lotId,
            line.quantity, line.unitCost ?? 0,
            ctx.actorKind === 'user' ? ctx.actorId : null,
          ],
        );
        imported.push(line.sku);
      }

      await tx.query(
        `UPDATE organizations SET onboarding_step = 'stock_import' WHERE id = $1`,
        [ctx.organizationId],
      );
      await this.audit.record(tx, {
        action: 'onboarding.stock_imported',
        entity: 'branch',
        entityId: branchId,
        after: { imported: imported.length, skipped: skipped.length },
      });

      return { imported: imported.length, skipped };
    });
  }
}
