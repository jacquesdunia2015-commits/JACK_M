import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';

export type Canal = 'sms' | 'whatsapp';

export interface ReglagesMessagerie {
  sms_mode: string;
  whatsapp_mode: string;
  sender_name: string | null;
  gateway_url: string | null;
  default_country_code: string;
}

export interface DemandeEnvoi {
  channel: Canal;
  /** Numéro du destinataire, national ou international. */
  to?: string;
  customerId?: string;
  /** Message libre, ou modèle à remplir via `templateCode`. */
  body?: string;
  templateCode?: string;
  variables?: Record<string, string | number | null | undefined>;
  entity?: string;
  entityId?: string;
  category?: string;
  clientOperationId?: string;
}

/**
 * Envoi de SMS et de messages WhatsApp aux clients de la pharmacie.
 *
 * Deux modes de remise, pour une seule et même trace :
 *
 *   • « manual » — le mode d'origine, et celui qui ne coûte rien. La
 *     plateforme compose le message et rend un lien `https://wa.me/…` ou
 *     `sms:…`. Le vendeur l'ouvre depuis son propre téléphone :
 *     l'application de messagerie s'ouvre, texte déjà rempli, il appuie
 *     sur envoyer. Le message part vraiment, par le forfait du vendeur,
 *     sans contrat ni abonnement.
 *
 *   • « gateway » — la plateforme appelle elle-même une passerelle HTTP.
 *     Cela suppose un compte payant chez un opérateur de messagerie,
 *     et consomme le quota du forfait.
 *
 * Le message est enregistré dans les deux cas, avant toute tentative de
 * remise : une pharmacie doit pouvoir prouver ce qu'elle a écrit à un
 * client, même quand l'envoi a échoué.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // Réglages
  // ------------------------------------------------------------------

  async reglages(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) => this.lireReglages(tx, ctx));
  }

  private async lireReglages(tx: Tx, ctx: RequestContext): Promise<ReglagesMessagerie> {
    const row = await tx.one<ReglagesMessagerie>(
      `SELECT sms_mode, whatsapp_mode, sender_name, gateway_url, default_country_code
         FROM messaging_settings WHERE organization_id = $1`,
      [ctx.organizationId],
    );
    // Une pharmacie créée après la migration n'a pas encore de ligne :
    // le mode manuel est le défaut, et il n'engage rien.
    return (
      row ?? {
        sms_mode: 'manual',
        whatsapp_mode: 'manual',
        sender_name: null,
        gateway_url: null,
        default_country_code: '+243',
      }
    );
  }

  async majReglages(
    ctx: RequestContext,
    dto: Partial<{
      smsMode: string;
      whatsappMode: string;
      senderName: string;
      gatewayUrl: string;
      gatewayToken: string;
      defaultCountryCode: string;
    }>,
  ) {
    const modes = ['manual', 'gateway', 'disabled'];
    for (const mode of [dto.smsMode, dto.whatsappMode]) {
      if (mode && !modes.includes(mode)) {
        throw new BadRequestException(`Mode d'envoi inconnu : ${mode}.`);
      }
    }
    if (
      (dto.smsMode === 'gateway' || dto.whatsappMode === 'gateway') &&
      !dto.gatewayUrl
    ) {
      throw new BusinessRuleException(
        "Le mode passerelle exige l'adresse de la passerelle.",
      );
    }

    return this.db.transaction(ctx, async (tx) => {
      const apres = await tx.oneOrFail(
        `INSERT INTO messaging_settings
           (organization_id, sms_mode, whatsapp_mode, sender_name,
            gateway_url, gateway_token, default_country_code, updated_by, updated_at)
         VALUES ($1,
                 COALESCE($2, 'manual'), COALESCE($3, 'manual'), $4, $5, $6,
                 COALESCE($7, '+243'), $8, now())
         ON CONFLICT (organization_id) DO UPDATE SET
           sms_mode             = COALESCE($2, messaging_settings.sms_mode),
           whatsapp_mode        = COALESCE($3, messaging_settings.whatsapp_mode),
           sender_name          = COALESCE($4, messaging_settings.sender_name),
           gateway_url          = COALESCE($5, messaging_settings.gateway_url),
           gateway_token        = COALESCE($6, messaging_settings.gateway_token),
           default_country_code = COALESCE($7, messaging_settings.default_country_code),
           updated_by           = $8,
           updated_at           = now()
         RETURNING organization_id, sms_mode, whatsapp_mode, sender_name,
                   gateway_url, default_country_code`,
        [
          ctx.organizationId,
          dto.smsMode ?? null,
          dto.whatsappMode ?? null,
          dto.senderName ?? null,
          dto.gatewayUrl ?? null,
          dto.gatewayToken ?? null,
          dto.defaultCountryCode ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, {
        action: 'messaging.settings.update',
        entity: 'messaging_settings',
        entityId: ctx.organizationId,
        after: apres,
      });
      return apres;
    });
  }

  // ------------------------------------------------------------------
  // Modèles
  // ------------------------------------------------------------------

  async modeles(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT id, code, channel, locale, label, body, active
           FROM message_templates
          WHERE active
          ORDER BY code, channel`,
      ),
    );
  }

  async enregistrerModele(
    ctx: RequestContext,
    dto: { code: string; channel: Canal; locale?: string; label: string; body: string },
  ) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `INSERT INTO message_templates
           (organization_id, code, channel, locale, label, body)
         VALUES ($1,$2,$3,COALESCE($4,'fr'),$5,$6)
         ON CONFLICT (organization_id, code, channel, locale) DO UPDATE
           SET label = EXCLUDED.label, body = EXCLUDED.body, active = true
         RETURNING id, code, channel, locale, label, body`,
        [
          ctx.organizationId, dto.code, dto.channel,
          dto.locale ?? null, dto.label, dto.body,
        ],
      ),
    );
  }

  // ------------------------------------------------------------------
  // Envoi
  // ------------------------------------------------------------------

  async envoyer(ctx: RequestContext, dto: DemandeEnvoi) {
    if (dto.channel !== 'sms' && dto.channel !== 'whatsapp') {
      throw new BadRequestException('Canal inconnu.');
    }

    return this.db.transaction(ctx, async (tx) => {
      // Rejeu : le même envoi ne part pas deux fois.
      if (dto.clientOperationId) {
        const existant = await tx.one(
          `SELECT id, channel, mode, recipient_phone, body, status, send_link, created_at
             FROM outbound_messages
            WHERE organization_id = $1 AND client_operation_id = $2`,
          [ctx.organizationId, dto.clientOperationId],
        );
        if (existant) return existant;
      }

      const reglages = await this.lireReglages(tx, ctx);
      const mode = dto.channel === 'sms' ? reglages.sms_mode : reglages.whatsapp_mode;
      if (mode === 'disabled') {
        throw new BusinessRuleException(
          `L'envoi ${dto.channel === 'sms' ? 'de SMS' : 'WhatsApp'} est désactivé pour cette pharmacie.`,
        );
      }

      const destinataire = await this.resoudreDestinataire(tx, dto);
      const numero = normaliserNumero(destinataire.phone, reglages.default_country_code);
      if (!numero) {
        throw new BusinessRuleException(
          "Le numéro du destinataire est absent ou n'est pas exploitable.",
        );
      }

      const corps = await this.composer(tx, ctx, dto, destinataire.name);

      const message = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO outbound_messages
           (organization_id, branch_id, channel, mode, recipient_phone, recipient_name,
            customer_id, category, entity, entity_id, body, status, send_link,
            client_operation_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'general'),$9,$10,$11,
                 'ready',$12,$13,$14)
         RETURNING id`,
        [
          ctx.organizationId, ctx.branchId ?? null, dto.channel, mode,
          numero, destinataire.name, destinataire.customerId,
          dto.category ?? null, dto.entity ?? null, dto.entityId ?? null,
          corps,
          mode === 'manual' ? lienEnvoi(dto.channel, numero, corps) : null,
          dto.clientOperationId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
        ],
      );

      await this.audit.record(tx, {
        action: 'messaging.message.prepare',
        entity: 'outbound_messages',
        entityId: message.id,
        after: { channel: dto.channel, mode, to: numero },
      });

      return tx.oneOrFail(
        `SELECT id, channel, mode, recipient_phone, recipient_name, body,
                status, send_link, created_at
           FROM outbound_messages WHERE id = $1`,
        [message.id],
      );
    });
  }

  /**
   * Confirme qu'un message préparé en mode manuel est bien parti.
   *
   * C'est le vendeur qui confirme, puisque c'est son téléphone qui a
   * envoyé. Rien n'est deviné : un message non confirmé reste « prêt ».
   */
  async confirmerEnvoi(ctx: RequestContext, id: string) {
    return this.db.transaction(ctx, async (tx) => {
      const message = await tx.one<{ status: string }>(
        'SELECT status FROM outbound_messages WHERE id = $1',
        [id],
      );
      if (!message) throw new BusinessRuleException('Message introuvable.');
      if (message.status === 'sent') {
        return tx.oneOrFail(
          `SELECT id, status, sent_at FROM outbound_messages WHERE id = $1`,
          [id],
        );
      }
      const apres = await tx.oneOrFail(
        `UPDATE outbound_messages
            SET status = 'sent', sent_at = now(), sent_by = $2
          WHERE id = $1
          RETURNING id, status, sent_at`,
        [id, ctx.actorKind === 'user' ? ctx.actorId : null],
      );
      await this.audit.record(tx, {
        action: 'messaging.message.sent',
        entity: 'outbound_messages',
        entityId: id,
      });
      return apres;
    });
  }

  async annuler(ctx: RequestContext, id: string, raison?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const apres = await tx.oneOrFail(
        `UPDATE outbound_messages
            SET status = 'cancelled', error = $2
          WHERE id = $1 AND status = 'ready'
          RETURNING id, status`,
        [id, raison ?? null],
      );
      await this.audit.record(tx, {
        action: 'messaging.message.cancel',
        entity: 'outbound_messages',
        entityId: id,
        reason: raison ?? null,
      });
      return apres;
    });
  }

  async journal(ctx: RequestContext, statut?: string, limite = 100) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT m.id, m.channel, m.mode, m.recipient_phone, m.recipient_name,
                m.category, m.entity, m.entity_id, m.body, m.status, m.send_link,
                m.error, m.created_at, m.sent_at,
                u.full_name AS created_by_name
           FROM outbound_messages m
           LEFT JOIN users u ON u.id = m.created_by
          WHERE ($1::text IS NULL OR m.status = $1)
          ORDER BY m.created_at DESC
          LIMIT $2`,
        [statut ?? null, Math.min(limite, 500)],
      ),
    );
  }

  // ------------------------------------------------------------------
  // Composition
  // ------------------------------------------------------------------

  private async resoudreDestinataire(tx: Tx, dto: DemandeEnvoi) {
    if (dto.customerId) {
      const client = await tx.one<{ id: string; name: string; phone: string | null }>(
        'SELECT id, name, phone FROM customers WHERE id = $1',
        [dto.customerId],
      );
      if (!client) throw new BusinessRuleException('Client introuvable.');
      return {
        customerId: client.id,
        name: client.name,
        phone: dto.to ?? client.phone,
      };
    }
    return { customerId: null as string | null, name: null as string | null, phone: dto.to ?? null };
  }

  private async composer(
    tx: Tx,
    ctx: RequestContext,
    dto: DemandeEnvoi,
    nomClient: string | null,
  ): Promise<string> {
    if (dto.body) return dto.body;
    if (!dto.templateCode) {
      throw new BadRequestException('Indiquez un texte ou un modèle de message.');
    }

    const modele = await tx.one<{ body: string }>(
      `SELECT body FROM message_templates
        WHERE code = $1 AND channel = $2 AND active
        ORDER BY locale = 'fr' DESC
        LIMIT 1`,
      [dto.templateCode, dto.channel],
    );
    if (!modele) {
      throw new BusinessRuleException(`Modèle « ${dto.templateCode} » introuvable.`);
    }

    const pharmacie = await tx.one<{ name: string }>(
      'SELECT name FROM branches WHERE id = $1',
      [ctx.branchId ?? null],
    );

    return remplir(modele.body, {
      client: nomClient ?? '',
      pharmacie: pharmacie?.name ?? '',
      ...(dto.variables ?? {}),
    });
  }
}

/**
 * Remplace les marqueurs `{{nom}}` par leur valeur.
 *
 * Un marqueur sans valeur est effacé plutôt que laissé tel quel : mieux
 * vaut une phrase un peu sèche qu'un client qui reçoit « Bonjour
 * {{client}} ».
 */
export function remplir(
  modele: string,
  valeurs: Record<string, string | number | null | undefined>,
): string {
  return (
    modele
      .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, cle: string) => {
        const valeur = valeurs[cle];
        return valeur === null || valeur === undefined ? '' : String(valeur);
      })
      .replace(/[ \t]{2,}/g, ' ')
      // Un marqueur effacé laisse une ponctuation orpheline : « Bonjour ,
      // merci… ». On la recolle, sans quoi le client reçoit une phrase
      // visiblement bancale.
      .replace(/\s+([,;:.!?])/g, '$1')
      .replace(/([,;:])\s*([,;:.!?])/g, '$2')
      .trim()
  );
}

/**
 * Met un numéro sous forme internationale sans « + » ni séparateur.
 *
 * Les numéros saisis au comptoir prennent toutes les formes : « 0991 234
 * 567 », « +243991234567 », « 243-99-123-45-67 ». Les liens wa.me
 * n'acceptent que la dernière forme, en chiffres seuls.
 */
export function normaliserNumero(
  brut: string | null | undefined,
  indicatifParDefaut = '+243',
): string | null {
  if (!brut) return null;
  const chiffres = brut.replace(/[^\d+]/g, '');
  if (!chiffres) return null;

  const indicatif = indicatifParDefaut.replace(/\D/g, '');
  if (chiffres.startsWith('+')) return chiffres.slice(1);
  if (chiffres.startsWith('00')) return chiffres.slice(2);
  // Un zéro initial est le zéro national : il tombe au profit de l'indicatif.
  if (chiffres.startsWith('0')) return indicatif + chiffres.slice(1);
  if (chiffres.startsWith(indicatif)) return chiffres;
  return indicatif + chiffres;
}

/** Lien à ouvrir depuis le téléphone du vendeur, message déjà rempli. */
export function lienEnvoi(canal: Canal, numero: string, corps: string): string {
  const texte = encodeURIComponent(corps);
  return canal === 'whatsapp'
    ? `https://wa.me/${numero}?text=${texte}`
    : `sms:+${numero}?body=${texte}`;
}
