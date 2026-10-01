import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

export const NIVEAUX = ['contre_indication', 'deconseillee', 'precaution', 'a_prendre_en_compte'] as const;
const RANG: Record<string, number> = { contre_indication: 0, deconseillee: 1, precaution: 2, a_prendre_en_compte: 3 };

/** Minuscules, sans accents, mots séparés par une espace. */
export const normaliser = (t: string | null | undefined) =>
  ` ${(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;

interface Interaction { id: string; term_a: string; term_b: string; severity: string; effect: string; advice: string | null; source: string | null }
interface Classe { code: string; label: string; members: string[] }
interface Produit { id: string; name: string; dosage: string | null; commercial_name: string | null; inn: string | null }

/**
 * Alertes d'interactions : les substances d'un produit sont lues dans sa
 * molécule (DCI) et dans son nom, mot à mot ; ses classes thérapeutiques
 * s'en déduisent ; chaque paire de produits est confrontée à la liste de
 * référence.
 */
@Injectable()
export class InteractionsService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  private async referentiel(tx: Tx) {
    const [interactions, classes] = await Promise.all([
      tx.many<Interaction>('SELECT id, term_a, term_b, severity, effect, advice, source FROM drug_interactions WHERE is_active'),
      tx.many<Classe>('SELECT code, label, members FROM drug_classes'),
    ]);
    const vocabulaire = new Set<string>();
    for (const i of interactions) for (const t of [i.term_a, i.term_b]) if (!t.startsWith('classe:')) vocabulaire.add(normaliser(t).trim());
    for (const c of classes) for (const m of c.members) vocabulaire.add(normaliser(m).trim());
    return { interactions, classes, vocabulaire };
  }

  /** Termes (substances et classes) d'un produit. */
  private termes(p: Produit, ref: Awaited<ReturnType<InteractionsService['referentiel']>>): Set<string> {
    const texte = normaliser([p.name, p.commercial_name, p.inn, p.dosage].filter(Boolean).join(' '));
    const substances = new Set<string>();
    for (const s of ref.vocabulaire) if (s && texte.includes(` ${s} `)) substances.add(s);
    if (p.inn) substances.add(normaliser(p.inn).trim());
    const termes = new Set<string>(substances);
    for (const c of ref.classes) if (c.members.some((m) => substances.has(normaliser(m).trim()))) termes.add(`classe:${c.code}`);
    return termes;
  }

  private async produits(tx: Tx, ids: string[]) {
    if (!ids.length) return [];
    return tx.many<Produit>(
      `SELECT p.id, p.name, p.dosage, p.commercial_name, m.inn FROM products p LEFT JOIN molecules m ON m.id = p.molecule_id
        WHERE p.id = ANY($1::uuid[])`,
      [ids],
    );
  }

  /**
   * Interactions entre les produits d'un ticket, et entre ces produits et
   * les traitements suivis du patient. N'empêche jamais la vente.
   */
  async verifier(ctx: RequestContext, productIds: string[], customerId?: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const ref = await this.referentiel(tx);
      const ticket = await this.produits(tx, [...new Set(productIds)]);
      const traitements = customerId
        ? await tx.many<Produit>(
            `SELECT p.id, p.name, p.dosage, p.commercial_name, m.inn FROM treatment_plans t
               JOIN products p ON p.id = t.product_id LEFT JOIN molecules m ON m.id = p.molecule_id
              WHERE t.customer_id = $1 AND t.is_active`,
            [customerId],
          )
        : [];
      const lignes = [
        ...ticket.map((p) => ({ p, origine: 'ticket' as const, termes: this.termes(p, ref) })),
        ...traitements.filter((p) => !ticket.some((t) => t.id === p.id)).map((p) => ({ p, origine: 'traitement' as const, termes: this.termes(p, ref) })),
      ];
      const nom = (p: Produit) => (p.dosage && !p.name.toLowerCase().includes(p.dosage.toLowerCase()) ? `${p.name} ${p.dosage}` : p.name);
      const alertes = [];
      for (let i = 0; i < lignes.length; i++) {
        for (let j = i + 1; j < lignes.length; j++) {
          const [x, y] = [lignes[i], lignes[j]];
          if (x.origine === 'traitement' && y.origine === 'traitement') continue;
          for (const it of ref.interactions) {
            const ta = it.term_a.startsWith('classe:') ? it.term_a : normaliser(it.term_a).trim();
            const tb = it.term_b.startsWith('classe:') ? it.term_b : normaliser(it.term_b).trim();
            if ((x.termes.has(ta) && y.termes.has(tb)) || (x.termes.has(tb) && y.termes.has(ta))) {
              alertes.push({
                interactionId: it.id, severity: it.severity, effect: it.effect, advice: it.advice, source: it.source,
                products: [{ id: x.p.id, name: nom(x.p), origin: x.origine }, { id: y.p.id, name: nom(y.p), origin: y.origine }],
              });
            }
          }
        }
      }
      alertes.sort((u, v) => RANG[u.severity] - RANG[v.severity]);
      return { alerts: alertes, checkedProducts: lignes.length };
    });
  }

  /** Consultation de la liste de référence (recherche par substance ou classe). */
  async liste(ctx: RequestContext, q?: string) {
    return this.db.readTransaction(ctx, async (tx) => {
      const [interactions, classes] = await Promise.all([
        tx.many<Interaction & { is_active: boolean }>('SELECT * FROM drug_interactions ORDER BY is_active DESC, term_a, term_b'),
        tx.many<Classe>('SELECT code, label, members FROM drug_classes ORDER BY label'),
      ]);
      const recherche = normaliser(q).trim();
      const libelle = (t: string) => (t.startsWith('classe:') ? classes.find((c) => `classe:${c.code}` === t)?.label ?? t : t);
      const filtre = recherche
        ? interactions.filter((i) => [i.term_a, i.term_b].some((t) => {
            if (normaliser(t).includes(recherche) || normaliser(libelle(t)).includes(recherche)) return true;
            const c = t.startsWith('classe:') ? classes.find((k) => `classe:${k.code}` === t) : null;
            return Boolean(c?.members.some((m) => normaliser(m).includes(recherche)));
          }))
        : interactions;
      return {
        interactions: filtre.map((i) => ({ ...i, label_a: libelle(i.term_a), label_b: libelle(i.term_b) })),
        classes,
      };
    });
  }

  // ------------------------------------------------------------------
  // Back-office : tenue de la liste
  // ------------------------------------------------------------------

  private terme(t: string) {
    const v = t.trim().toLowerCase();
    if (v.startsWith('classe:')) return v;
    return normaliser(v).trim();
  }

  async creer(ctx: RequestContext, dto: { termA: string; termB: string; severity: string; effect: string; advice?: string; source?: string }) {
    const [a, b] = [this.terme(dto.termA), this.terme(dto.termB)];
    if (!a || !b || a === b) throw new BusinessRuleException('Deux substances (ou classes) différentes sont nécessaires.');
    return this.db.transaction(ctx, async (tx) => {
      await this.verifierClasses(tx, [a, b]);
      const r = await tx.oneOrFail(
        `INSERT INTO drug_interactions (term_a, term_b, severity, effect, advice, source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [a, b, dto.severity, dto.effect.trim(), dto.advice?.trim() || null, dto.source?.trim() || null, ctx.actorKind === 'platform_user' ? ctx.actorId : null],
      );
      await this.audit.recordPlatform(tx, { action: 'platform.interaction.created', entity: 'drug_interaction', entityId: (r as { id: string }).id, after: r });
      return r;
    });
  }

  private async verifierClasses(tx: Tx, termes: string[]) {
    for (const t of termes.filter((x) => x.startsWith('classe:'))) {
      const c = await tx.one('SELECT code FROM drug_classes WHERE code = $1', [t.slice(7)]);
      if (!c) throw new BusinessRuleException(`Classe inconnue : ${t}.`);
    }
  }

  async modifier(ctx: RequestContext, id: string, dto: { severity?: string; effect?: string; advice?: string; isActive?: boolean }) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail(
        `UPDATE drug_interactions SET severity = COALESCE($2, severity), effect = COALESCE($3, effect),
                advice = COALESCE($4, advice), is_active = COALESCE($5, is_active) WHERE id = $1 RETURNING *`,
        [id, dto.severity ?? null, dto.effect?.trim() ?? null, dto.advice?.trim() ?? null, dto.isActive ?? null], 'Interaction introuvable.',
      );
      await this.audit.recordPlatform(tx, { action: 'platform.interaction.updated', entity: 'drug_interaction', entityId: id, after: r });
      return r;
    });
  }

  /**
   * Import CSV (séparateur « ; ») : terme_a;terme_b;niveau;effet;conduite;source.
   * Une paire déjà connue est mise à jour. Les lignes invalides sont rendues avec leur erreur.
   */
  async importer(ctx: RequestContext, csv: string) {
    const lignes = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.toLowerCase().startsWith('terme_a'));
    const erreurs: { line: number; message: string }[] = [];
    let ajoutees = 0;
    let modifiees = 0;
    await this.db.transaction(ctx, async (tx) => {
      for (const [n, l] of lignes.entries()) {
        const [ta, tb, niveau, effet, conduite, source] = l.split(';').map((x) => x?.trim() ?? '');
        const [a, b] = [this.terme(ta ?? ''), this.terme(tb ?? '')];
        if (!a || !b || a === b) { erreurs.push({ line: n + 1, message: 'Deux termes différents requis.' }); continue; }
        if (!(NIVEAUX as readonly string[]).includes(niveau)) { erreurs.push({ line: n + 1, message: `Niveau inconnu : « ${niveau} ».` }); continue; }
        if (!effet) { erreurs.push({ line: n + 1, message: 'Effet manquant.' }); continue; }
        try { await this.verifierClasses(tx, [a, b]); } catch (e) { erreurs.push({ line: n + 1, message: (e as Error).message }); continue; }
        const r = await tx.oneOrFail<{ inserted: boolean }>(
          `INSERT INTO drug_interactions (term_a, term_b, severity, effect, advice, source, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (LEAST(term_a, term_b), GREATEST(term_a, term_b)) DO UPDATE
             SET severity = EXCLUDED.severity, effect = EXCLUDED.effect, advice = EXCLUDED.advice,
                 source = EXCLUDED.source, is_active = true
           RETURNING (xmax = 0) AS inserted`,
          [a, b, niveau, effet, conduite || null, source || null, ctx.actorKind === 'platform_user' ? ctx.actorId : null],
        );
        if (r.inserted) ajoutees++; else modifiees++;
      }
      await this.audit.recordPlatform(tx, { action: 'platform.interaction.imported', entity: 'drug_interaction', after: { ajoutees, modifiees, erreurs: erreurs.length } });
    });
    return { added: ajoutees, updated: modifiees, errors: erreurs };
  }
}
