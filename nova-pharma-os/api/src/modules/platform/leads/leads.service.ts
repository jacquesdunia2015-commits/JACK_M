import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

/** Prospection commerciale : suivi des pharmacies avant souscription. */
@Injectable()
export class LeadsService {
  constructor(private readonly db: DatabaseService) {}

  async list(ctx: RequestContext, stage?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT l.*, p.code AS interested_plan_code, o.slug AS converted_slug
           FROM leads l
           LEFT JOIN subscription_plans p ON p.id = l.interested_plan_id
           LEFT JOIN organizations o ON o.id = l.converted_organization_id
          WHERE ($1::text IS NULL OR l.stage = $1)
          ORDER BY l.created_at DESC LIMIT 200`,
        [stage ?? null],
      ),
    );
  }

  async create(ctx: RequestContext, dto: Record<string, unknown>) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `INSERT INTO leads
           (company_name, contact_name, email, phone, country_code, city,
            kind, source, stage, interested_plan_id, owner_platform_user_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'new'),
                 (SELECT id FROM subscription_plans WHERE code = $10), $11, $12)
         RETURNING *`,
        [
          dto.companyName, dto.contactName ?? null, dto.email ?? null,
          dto.phone ?? null, dto.countryCode ?? null, dto.city ?? null,
          dto.kind ?? 'pharmacy', dto.source ?? null, dto.stage ?? null,
          dto.interestedPlanCode ?? null, ctx.actorId, dto.notes ?? null,
        ],
      ),
    );
  }

  async updateStage(ctx: RequestContext, id: string, stage: string, notes?: string) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `UPDATE leads SET stage = $2, notes = COALESCE($3, notes) WHERE id = $1 RETURNING *`,
        [id, stage, notes ?? null],
        'Prospect introuvable.',
      ),
    );
  }

  /** Entonnoir commercial : volume et valeur potentielle par étape. */
  async funnel(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT l.stage, count(*) AS count,
                COALESCE(sum(p.price_annual), 0) AS potential_annual_value
           FROM leads l
           LEFT JOIN subscription_plans p ON p.id = l.interested_plan_id
          GROUP BY l.stage
          ORDER BY CASE l.stage
                     WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'demo' THEN 2
                     WHEN 'trial' THEN 3 WHEN 'won' THEN 4 ELSE 5 END`,
      ),
    );
  }
}
