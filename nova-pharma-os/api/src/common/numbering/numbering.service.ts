import { Injectable } from '@nestjs/common';
import { Tx } from '../database/database.service';

export type DocumentKind =
  | 'sale'
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'quote'
  | 'purchase_order'
  | 'goods_receipt'
  | 'b2b_order'
  | 'delivery'
  | 'transfer'
  | 'inventory'
  | 'ticket';

const DEFAULT_FORMATS: Record<DocumentKind, string> = {
  sale: 'V-{PERIOD}-{SEQ:6}',
  invoice: 'FA-{PERIOD}-{SEQ:6}',
  receipt: 'RC-{PERIOD}-{SEQ:6}',
  credit_note: 'AV-{PERIOD}-{SEQ:6}',
  quote: 'DV-{PERIOD}-{SEQ:5}',
  purchase_order: 'BC-{PERIOD}-{SEQ:5}',
  goods_receipt: 'BR-{PERIOD}-{SEQ:5}',
  b2b_order: 'CB-{PERIOD}-{SEQ:5}',
  delivery: 'BL-{PERIOD}-{SEQ:5}',
  transfer: 'TR-{PERIOD}-{SEQ:5}',
  inventory: 'INV-{PERIOD}-{SEQ:4}',
  ticket: 'TCK-{PERIOD}-{SEQ:5}',
};

/**
 * Numérotation des documents, par organisation et par branche.
 *
 * La séquence est incrémentée sous verrou de ligne dans la transaction
 * appelante : deux caisses qui encaissent simultanément ne peuvent pas
 * produire le même numéro de vente. Le numéro n'est consommé que si la
 * transaction aboutit.
 */
@Injectable()
export class NumberingService {
  async next(
    tx: Tx,
    kind: DocumentKind,
    options: { branchId?: string | null; period?: 'year' | 'month' } = {},
  ): Promise<string> {
    const organizationId = tx.context.organizationId;
    if (!organizationId) throw new Error('Contexte tenant requis pour numéroter.');

    const branchId = options.branchId ?? null;
    const now = new Date();
    const periodKey =
      options.period === 'month'
        ? `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
        : String(now.getUTCFullYear());

    const sentinel = '00000000-0000-0000-0000-000000000000';
    // INSERT ... ON CONFLICT DO UPDATE : création et incrément en une
    // seule instruction atomique, sans lecture préalable.
    const row = await tx.oneOrFail<{ last_value: string; format: string }>(
      `INSERT INTO document_sequences
         (organization_id, branch_id, document_kind, period_key, format, last_value)
       VALUES ($1, $2, $3, $4, $5, 1)
       ON CONFLICT (organization_id, COALESCE(branch_id, '${sentinel}'::uuid),
                    document_kind, period_key)
       DO UPDATE SET last_value = document_sequences.last_value + 1
       RETURNING last_value, format`,
      [organizationId, branchId, kind, periodKey, DEFAULT_FORMATS[kind]],
    );

    return this.render(row.format, periodKey, Number(row.last_value), kind);
  }

  private render(
    format: string,
    periodKey: string,
    value: number,
    kind: DocumentKind,
  ): string {
    return format
      .replace('{KIND}', kind.toUpperCase())
      .replace('{PERIOD}', periodKey)
      .replace('{YYYY}', periodKey.slice(0, 4))
      .replace(/\{SEQ:(\d+)\}/, (_m, width: string) =>
        String(value).padStart(Number(width), '0'),
      );
  }
}
