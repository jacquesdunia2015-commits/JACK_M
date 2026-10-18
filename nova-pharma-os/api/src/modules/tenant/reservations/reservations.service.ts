import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext, SYSTEM_CONTEXT, systemTenantContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { NumberingService } from '../../../common/numbering/numbering.service';
import { normaliserTelephone } from '../../../common/telephone';
import { MessagingService } from '../messaging/messaging.service';

/** Statuts et passages permis. */
const PASSAGES: Record<string, string[]> = {
  new: ['confirmed', 'ready', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['collected', 'cancelled'],
  collected: [],
  cancelled: [],
};

/** Réservations au plus par numéro de téléphone et par jour, et par pharmacie et par heure. */
const MAX_PAR_TELEPHONE_JOUR = 5;
const MAX_PAR_PHARMACIE_HEURE = 40;
const TAILLE_MAX_PHOTO = 2_500_000;

/** « Paracétamol 500 mg » : le dosage n'est ajouté que s'il ne figure pas déjà dans le nom. */
const designation = (nom: string, dosage: string | null) =>
  dosage && !nom.toLowerCase().includes(dosage.toLowerCase()) ? `${nom} ${dosage}` : nom;

export interface ProfilInput {
  isPublished?: boolean; headline?: string | null; description?: string | null; openingHours?: string | null;
  addressHint?: string | null; whatsapp?: string | null; onDutyNote?: string | null; showPrices?: boolean;
  acceptReservations?: boolean; acceptPrescriptions?: boolean; latitude?: number | null; longitude?: number | null;
}

export interface DemandeReservation {
  name: string;
  phone: string;
  lines?: { productId: string; quantity: number }[];
  message?: string;
  pickup?: string;
  prescriptionPhoto?: string;
  website?: string;
}

const COLONNES_PROFIL: Record<keyof ProfilInput, string> = {
  isPublished: 'is_published', headline: 'headline', description: 'description', openingHours: 'opening_hours',
  addressHint: 'address_hint', whatsapp: 'whatsapp', onDutyNote: 'on_duty_note', showPrices: 'show_prices',
  acceptReservations: 'accept_reservations', acceptPrescriptions: 'accept_prescriptions', latitude: 'latitude', longitude: 'longitude',
};

/**
 * Page publique de la pharmacie et réservations : ce que le client voit
 * sans compte, et ce que la pharmacie en fait.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly messaging: MessagingService,
  ) {}

  // ------------------------------------------------------------------
  // Côté public (sans compte)
  // ------------------------------------------------------------------

  /** Pharmacie dont la page est publiée, ou 404 (même réponse qu'un identifiant inconnu). */
  private async pharmaciePubliee(slug: string) {
    const org = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ id: string; status: string; country_code: string }>(
        `SELECT id, status::text AS status, country_code FROM organizations
          WHERE slug = $1 AND deleted_at IS NULL AND status IN ('trial', 'active')`,
        [slug.toLowerCase()],
      ),
    );
    if (!org) throw new NotFoundException('Pharmacie introuvable.');
    const ctx = { ...systemTenantContext(org.id), actorLabel: 'page publique' };
    const profil = await this.db.readTransaction(ctx, (tx) =>
      tx.one<Record<string, unknown>>('SELECT * FROM public_profiles WHERE is_published'),
    );
    if (!profil) throw new NotFoundException('Pharmacie introuvable.');
    return { org, ctx, profil };
  }

  async pagePublique(slug: string) {
    const { ctx, profil } = await this.pharmaciePubliee(slug);
    return this.db.readTransaction(ctx, async (tx) => {
      const o = await tx.oneOrFail<Record<string, string | null>>(
        `SELECT slug, COALESCE(trade_name, legal_name) AS name, address, city, phone, email, logo_data, currency
           FROM organizations WHERE id = $1`,
        [ctx.organizationId],
      );
      return {
        slug: o.slug, name: o.name, address: o.address, city: o.city, phone: o.phone, email: o.email,
        logo: o.logo_data, currency: o.currency,
        headline: profil.headline, description: profil.description, openingHours: profil.opening_hours,
        addressHint: profil.address_hint, whatsapp: profil.whatsapp ?? o.phone, onDutyNote: profil.on_duty_note,
        showPrices: profil.show_prices, acceptReservations: profil.accept_reservations,
        acceptPrescriptions: profil.accept_prescriptions,
        latitude: profil.latitude === null ? null : Number(profil.latitude),
        longitude: profil.longitude === null ? null : Number(profil.longitude),
      };
    });
  }

  /** Médicaments trouvés : disponibles ou sur commande, jamais les quantités. */
  async produitsPublics(slug: string, q: string) {
    const { ctx, profil } = await this.pharmaciePubliee(slug);
    const terme = (q ?? '').trim();
    if (terme.length < 2) return [];
    return this.db.readTransaction(ctx, async (tx) => {
      const lignes = await tx.many<{ id: string; name: string; dosage: string | null; dosage_form: string | null; sale_price: string; requires_prescription: boolean; dispo: string }>(
        `SELECT p.id, p.name, p.dosage, p.dosage_form, p.sale_price, p.requires_prescription,
                COALESCE((SELECT sum(si.quantity - si.reserved_quantity) FROM stock_items si
                           LEFT JOIN product_lots pl ON pl.id = si.lot_id
                          WHERE si.product_id = p.id AND COALESCE(pl.is_quarantined, false) = false
                            AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)), 0) AS dispo
           FROM products p
          WHERE p.deleted_at IS NULL AND p.is_active
            AND (p.name ILIKE '%' || $1 || '%' OR p.commercial_name ILIKE '%' || $1 || '%')
          ORDER BY (p.name ILIKE $1 || '%') DESC, p.name
          LIMIT 20`,
        [terme],
      );
      return lignes.map((p) => ({
        id: p.id, name: p.name, dosage: p.dosage, form: p.dosage_form,
        price: profil.show_prices ? Number(p.sale_price) : null,
        available: Number(p.dispo) > 0,
        prescription: p.requires_prescription,
      }));
    });
  }

  /** Réservation déposée par un client depuis la page publique. */
  async reserver(slug: string, dto: DemandeReservation) {
    const { org, ctx, profil } = await this.pharmaciePubliee(slug);
    // Champ piège invisible : seul un robot le remplit.
    if (dto.website) throw new BusinessRuleException('Demande refusée.');
    const lignes = (dto.lines ?? []).filter((l) => l.quantity > 0);
    const photo = dto.prescriptionPhoto ? this.lirePhoto(dto.prescriptionPhoto) : null;
    if (!lignes.length && !photo) throw new BusinessRuleException('Choisissez au moins un médicament ou joignez la photo de votre ordonnance.');
    if (lignes.length && !profil.accept_reservations) throw new BusinessRuleException("Cette pharmacie ne prend pas de réservations en ligne : appelez-la.");
    if (photo && !profil.accept_prescriptions) throw new BusinessRuleException("Cette pharmacie ne reçoit pas d'ordonnances en ligne : passez la montrer au comptoir.");

    const prefixe = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ phone_prefix: string | null }>('SELECT phone_prefix FROM country_settings WHERE code = $1', [org.country_code]),
    );
    const telephone = normaliserTelephone(dto.phone, prefixe?.phone_prefix ?? '+243');
    if (!telephone) throw new BusinessRuleException('Numéro de téléphone invalide : la pharmacie doit pouvoir vous rappeler.');

    return this.db.transaction(ctx, async (tx) => {
      const compte = await tx.oneOrFail<{ jour: string; heure: string }>(
        `SELECT count(*) FILTER (WHERE customer_phone = $1 AND created_at > now() - interval '1 day') AS jour,
                count(*) FILTER (WHERE created_at > now() - interval '1 hour') AS heure
           FROM reservations`,
        [telephone],
      );
      if (Number(compte.jour) >= MAX_PAR_TELEPHONE_JOUR || Number(compte.heure) >= MAX_PAR_PHARMACIE_HEURE) {
        throw new HttpException('Trop de demandes en peu de temps : appelez directement la pharmacie.', HttpStatus.TOO_MANY_REQUESTS);
      }

      const produits = lignes.length
        ? await tx.many<{ id: string; name: string; dosage: string | null; sale_price: string; dispo: string }>(
            `SELECT p.id, p.name, p.dosage, p.sale_price,
                    COALESCE((SELECT sum(si.quantity - si.reserved_quantity) FROM stock_items si
                               LEFT JOIN product_lots pl ON pl.id = si.lot_id
                              WHERE si.product_id = p.id AND COALESCE(pl.is_quarantined, false) = false
                                AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)), 0) AS dispo
               FROM products p WHERE p.id = ANY($1::uuid[]) AND p.deleted_at IS NULL AND p.is_active`,
            [lignes.map((l) => l.productId)],
          )
        : [];
      const parId = new Map(produits.map((p) => [p.id, p]));
      const contenu = lignes.map((l) => {
        const p = parId.get(l.productId);
        if (!p) throw new BusinessRuleException('Un médicament demandé n’est plus proposé : actualisez la page.');
        return {
          productId: p.id, name: designation(p.name, p.dosage), quantity: Math.min(Math.floor(l.quantity), 99),
          unitPrice: Number(p.sale_price), available: Number(p.dispo) >= l.quantity,
        };
      });

      const client = await tx.one<{ id: string }>(
        'SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1', [telephone],
      );
      const numero = await this.numbering.next(tx, 'reservation');
      const r = await tx.oneOrFail<{ id: string; number: string }>(
        `INSERT INTO reservations
           (organization_id, number, customer_name, customer_phone, customer_id, lines, message, pickup_preference, has_prescription)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING id, number`,
        [
          ctx.organizationId, numero, dto.name.trim(), telephone, client?.id ?? null, JSON.stringify(contenu),
          dto.message?.trim() || null, dto.pickup?.trim() || null, Boolean(photo),
        ],
      );
      if (photo) {
        await tx.query(
          `INSERT INTO reservation_files (organization_id, reservation_id, content_type, data, size_bytes) VALUES ($1,$2,$3,$4,$5)`,
          [ctx.organizationId, r.id, photo.type, photo.octets, photo.octets.length],
        );
      }
      await this.audit.record(tx, { action: 'reservations.created', entity: 'reservation', entityId: r.id, after: { number: r.number, lines: contenu.length, prescription: Boolean(photo) } });
      return {
        number: r.number,
        message: 'Demande envoyée. La pharmacie vous prévient sur WhatsApp ou par téléphone quand c’est prêt. Rien n’est à payer en ligne.',
      };
    });
  }

  /** Le client suit sa demande avec son numéro de réservation et son téléphone. */
  async suivi(slug: string, numero: string, phone: string) {
    const { org, ctx } = await this.pharmaciePubliee(slug);
    const prefixe = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ phone_prefix: string | null }>('SELECT phone_prefix FROM country_settings WHERE code = $1', [org.country_code]),
    );
    const telephone = normaliserTelephone(phone ?? '', prefixe?.phone_prefix ?? '+243');
    const r = telephone
      ? await this.db.readTransaction(ctx, (tx) =>
          tx.one<{ number: string; status: string; status_changed_at: string; created_at: string }>(
            'SELECT number, status, status_changed_at, created_at FROM reservations WHERE number = $1 AND customer_phone = $2',
            [numero.trim().toUpperCase(), telephone],
          ),
        )
      : null;
    if (!r) throw new NotFoundException('Aucune demande avec ce numéro et ce téléphone.');
    return r;
  }

  private lirePhoto(dataUrl: string) {
    const m = dataUrl.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
    const octets = m ? Buffer.from(m[2], 'base64') : Buffer.alloc(0);
    const jpeg = octets.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = octets.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (!m || !(m[1] === 'image/png' ? png : jpeg)) throw new BusinessRuleException("La photo de l'ordonnance doit être une image JPEG ou PNG.");
    if (octets.length > TAILLE_MAX_PHOTO) throw new BusinessRuleException('Photo trop lourde : 2,5 Mo au plus.');
    return { type: m[1], octets };
  }

  // ------------------------------------------------------------------
  // Côté pharmacie
  // ------------------------------------------------------------------

  async profil(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const p = await tx.one('SELECT * FROM public_profiles LIMIT 1');
      const o = await tx.oneOrFail<{ slug: string }>('SELECT slug FROM organizations WHERE id = $1', [ctx.organizationId]);
      return { slug: o.slug, ...(p ?? { is_published: false, show_prices: true, accept_reservations: true, accept_prescriptions: true }) };
    });
  }

  async reglerProfil(ctx: RequestContext, dto: ProfilInput) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.query('INSERT INTO public_profiles (organization_id) VALUES ($1) ON CONFLICT DO NOTHING', [ctx.organizationId]);
      const champs = (Object.keys(COLONNES_PROFIL) as (keyof ProfilInput)[]).filter((k) => dto[k] !== undefined);
      if (champs.length) {
        await tx.query(
          `UPDATE public_profiles SET ${champs.map((k, i) => `${COLONNES_PROFIL[k]} = $${i + 2}`).join(', ')} WHERE organization_id = $1`,
          [ctx.organizationId, ...champs.map((k) => (typeof dto[k] === 'string' ? (dto[k] as string).trim() || null : dto[k]))],
        );
      }
      const apres = await tx.oneOrFail('SELECT * FROM public_profiles WHERE organization_id = $1', [ctx.organizationId]);
      await this.audit.record(tx, { action: 'public_profile.updated', entity: 'public_profile', entityId: ctx.organizationId as string, after: apres });
      return apres;
    });
  }

  /** Efface les photos d'ordonnance des demandes closes depuis plus de 30 jours. */
  private async purger(tx: Tx) {
    if (tx.context.readonly) return;
    await tx.query(
      `DELETE FROM reservation_files f USING reservations r
        WHERE r.id = f.reservation_id AND r.status IN ('collected', 'cancelled')
          AND r.status_changed_at < now() - interval '30 days'`,
    );
  }

  async liste(ctx: RequestContext, statut?: string) {
    return this.db.transaction(ctx, async (tx) => {
      await this.purger(tx);
      return tx.many(
        `SELECT r.*, u.full_name AS handled_by_name,
                EXISTS (SELECT 1 FROM reservation_files f WHERE f.reservation_id = r.id) AS has_photo
           FROM reservations r LEFT JOIN users u ON u.id = r.handled_by
          WHERE ($1::text IS NULL AND r.status IN ('new', 'confirmed', 'ready'))
             OR ($1::text = 'all') OR r.status = $1
          ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END, r.created_at DESC
          LIMIT 200`,
        [statut || null],
      );
    });
  }

  async photo(ctx: RequestContext, id: string) {
    const f = await this.db.readTransaction(ctx, (tx) =>
      tx.one<{ content_type: string; data: Buffer }>(
        'SELECT content_type, data FROM reservation_files WHERE reservation_id = $1 ORDER BY created_at LIMIT 1', [id],
      ),
    );
    if (!f) throw new NotFoundException("Pas de photo d'ordonnance (ou effacée après 30 jours).");
    return f;
  }

  async changerStatut(ctx: RequestContext, id: string, statut: string, note?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<{ status: string; number: string }>('SELECT status, number FROM reservations WHERE id = $1 FOR UPDATE', [id], 'Réservation introuvable.');
      if (!(PASSAGES[r.status] ?? []).includes(statut)) {
        throw new BusinessRuleException(`Une réservation « ${r.status} » ne peut pas passer à « ${statut} ».`);
      }
      const apres = await tx.oneOrFail(
        `UPDATE reservations SET status = $2, staff_note = COALESCE($3, staff_note), handled_by = $4, status_changed_at = now()
          WHERE id = $1 RETURNING *`,
        [id, statut, note?.trim() || null, ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, { action: `reservations.${statut}`, entity: 'reservation', entityId: id, before: r, after: apres });
      return apres;
    });
  }

  /** Message WhatsApp gratuit au client : commande prête, ou question sur sa demande. */
  async prevenir(ctx: RequestContext, id: string, texte?: string) {
    const d = await this.db.readTransaction(ctx, async (tx) => ({
      r: await tx.oneOrFail<{ number: string; customer_name: string; customer_phone: string; customer_id: string | null; status: string }>(
        'SELECT number, customer_name, customer_phone, customer_id, status FROM reservations WHERE id = $1', [id], 'Réservation introuvable.',
      ),
      o: await tx.oneOrFail<{ name: string; address: string | null; city: string | null }>(
        'SELECT COALESCE(trade_name, legal_name) AS name, address, city FROM organizations WHERE id = $1', [ctx.organizationId],
      ),
    }));
    const corps = texte?.trim() || (
      d.r.status === 'ready'
        ? `Bonjour ${d.r.customer_name}, votre commande ${d.r.number} est prête à ${d.o.name}${d.o.address ? ` (${d.o.address})` : ''}. Nous vous attendons.`
        : `Bonjour ${d.r.customer_name}, ${d.o.name} a bien reçu votre demande ${d.r.number}. Nous la préparons et vous prévenons dès qu'elle est prête.`
    );
    return this.messaging.envoyer(ctx, {
      channel: 'whatsapp', to: d.r.customer_phone, body: corps,
      category: 'reservation', entity: 'reservation', entityId: id,
    });
  }

  async resume(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const r = await tx.oneOrFail<{ nouvelles: string; pretes: string }>(
        `SELECT count(*) FILTER (WHERE status = 'new') AS nouvelles, count(*) FILTER (WHERE status = 'ready') AS pretes FROM reservations`,
      );
      return { new: Number(r.nouvelles), ready: Number(r.pretes) };
    });
  }
}
