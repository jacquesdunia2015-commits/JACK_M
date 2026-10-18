import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { codeInterne, codeValide } from './codes-barres';

/**
 * Codes-barres des produits : ajout (saisi ou scanné), retrait, codes
 * internes pour les produits qui n'en ont pas, et données des étiquettes.
 */
@Injectable()
export class CodesBarresService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async ajouter(ctx: RequestContext, productId: string, brut: string) {
    const { code, kind } = codeValide(brut);
    return this.db.transaction(ctx, async (tx) => {
      const produit = await tx.oneOrFail<{ id: string; name: string }>(
        'SELECT id, name FROM products WHERE id = $1 AND deleted_at IS NULL', [productId], 'Produit introuvable.',
      );
      const existant = await tx.one<{ product_id: string; name: string }>(
        `SELECT b.product_id, p.name FROM product_barcodes b JOIN products p ON p.id = b.product_id
          WHERE b.barcode = $1`,
        [code],
      );
      if (existant) {
        if (existant.product_id === productId) return { barcode: code, kind, deja: true };
        throw new BusinessRuleException(`Le code ${code} est déjà celui de « ${existant.name} ».`);
      }
      const premier = !(await tx.one('SELECT 1 FROM product_barcodes WHERE product_id = $1 LIMIT 1', [productId]));
      await tx.query(
        `INSERT INTO product_barcodes (organization_id, product_id, barcode, kind, is_primary)
         VALUES ($1,$2,$3,$4,$5)`,
        [ctx.organizationId, productId, code, kind, premier],
      );
      await this.audit.record(tx, {
        action: 'catalog.barcode_added', entity: 'product', entityId: productId,
        after: { barcode: code, kind, produit: produit.name },
      });
      return { barcode: code, kind, deja: false };
    });
  }

  async retirer(ctx: RequestContext, productId: string, code: string) {
    return this.db.transaction(ctx, async (tx) => {
      const ligne = await tx.oneOrFail<{ is_primary: boolean }>(
        'DELETE FROM product_barcodes WHERE product_id = $1 AND barcode = $2 RETURNING is_primary',
        [productId, code],
        'Code-barres introuvable pour ce produit.',
      );
      // Le code principal retiré, le suivant prend sa place.
      if (ligne.is_primary) {
        await tx.query(
          `UPDATE product_barcodes SET is_primary = true
            WHERE id = (SELECT id FROM product_barcodes WHERE product_id = $1 ORDER BY barcode LIMIT 1)`,
          [productId],
        );
      }
      await this.audit.record(tx, {
        action: 'catalog.barcode_removed', entity: 'product', entityId: productId, before: { barcode: code },
      });
      return { removed: code };
    });
  }

  /**
   * Donne un code interne (EAN-13 « 29… ») aux produits qui n'ont aucun
   * code-barres : ceux demandés, ou tout le catalogue actif.
   */
  async codesInternes(ctx: RequestContext, productIds?: string[]) {
    return this.db.transaction(ctx, async (tx) => {
      // Une seule attribution à la fois par pharmacie : pas deux fois le même numéro.
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1 || ':codes-internes'))`, [ctx.organizationId]);
      const sans = await tx.many<{ id: string; name: string }>(
        `SELECT p.id, p.name FROM products p
          WHERE p.deleted_at IS NULL AND p.is_active
            AND ($1::uuid[] IS NULL OR p.id = ANY($1::uuid[]))
            AND NOT EXISTS (SELECT 1 FROM product_barcodes b WHERE b.product_id = p.id)
          ORDER BY p.name`,
        [productIds?.length ? productIds : null],
      );
      const dernier = await tx.one<{ n: string | null }>(
        `SELECT max(substr(barcode, 3, 10)::bigint) AS n FROM product_barcodes
          WHERE kind = 'internal' AND barcode ~ '^29[0-9]{11}$'`,
      );
      let numero = Number(dernier?.n ?? 0);
      const attribues: { productId: string; name: string; barcode: string }[] = [];
      for (const p of sans) {
        let code = codeInterne(++numero);
        // Un code du commerce commençant par 29 (rare) ne doit pas être doublé.
        while (await tx.one('SELECT 1 FROM product_barcodes WHERE barcode = $1', [code])) code = codeInterne(++numero);
        await tx.query(
          `INSERT INTO product_barcodes (organization_id, product_id, barcode, kind, is_primary)
           VALUES ($1,$2,$3,'internal',true)`,
          [ctx.organizationId, p.id, code],
        );
        attribues.push({ productId: p.id, name: p.name, barcode: code });
      }
      if (attribues.length) {
        await this.audit.record(tx, {
          action: 'catalog.internal_barcodes', entity: 'product', after: { nombre: attribues.length },
        });
      }
      return { created: attribues.length, items: attribues };
    });
  }

  /** Ce qu'il faut imprimer sur l'étiquette de chaque produit demandé. */
  async etiquettes(ctx: RequestContext, ids: string[]) {
    if (!ids.length) return [];
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT p.id, p.name, p.dosage, p.sku, p.sale_price,
                b.barcode, b.kind
           FROM products p
           LEFT JOIN LATERAL (
             SELECT barcode, kind FROM product_barcodes
              WHERE product_id = p.id ORDER BY is_primary DESC, barcode LIMIT 1
           ) b ON true
          WHERE p.id = ANY($1::uuid[]) AND p.deleted_at IS NULL
          ORDER BY p.name`,
        [ids],
      ),
    );
  }
}
