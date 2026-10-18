import { Tx } from '../../../common/database/database.service';
import { BusinessRuleException } from '../../../common/http/exceptions';

/** Un taux enregistré : « 1 base = rate quote ». */
export interface Taux {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
  change_rounding: string;
  created_at: string;
}

/** Durée pendant laquelle une vente encaissée hors ligne peut garder son taux. */
const VALIDITE_TAUX_JOURS = 7;

export const arrondi2 = (n: number) => Math.round(n * 100) / 100;

/** Dernier taux enregistré entre deux devises, dans un sens ou dans l'autre. */
export async function dernierTaux(tx: Tx, a: string, b: string): Promise<Taux | null> {
  return tx.one<Taux>(
    `SELECT id, base_currency, quote_currency, rate, change_rounding, created_at
       FROM exchange_rates
      WHERE (base_currency = $1 AND quote_currency = $2)
         OR (base_currency = $2 AND quote_currency = $1)
      ORDER BY created_at DESC LIMIT 1`,
    [a, b],
  );
}

/**
 * Taux à appliquer à un encaissement. Le poste peut annoncer le taux qu'il
 * a affiché au client (vente préparée hors ligne, ou taux changé entre-temps) :
 * il est accepté s'il a réellement été fixé par la pharmacie ces derniers
 * jours, refusé sinon. Sans taux annoncé, le dernier taux s'applique.
 */
export async function tauxPour(
  tx: Tx,
  deviseVente: string,
  devisePaiement: string,
  tauxAnnonce?: number,
): Promise<Taux> {
  if (tauxAnnonce !== undefined) {
    const connu = await tx.one<Taux>(
      `SELECT id, base_currency, quote_currency, rate, change_rounding, created_at
         FROM exchange_rates
        WHERE ((base_currency = $1 AND quote_currency = $2)
            OR (base_currency = $2 AND quote_currency = $1))
          AND abs(rate - $3) < 0.000001
          AND created_at > now() - make_interval(days => $4)
        ORDER BY created_at DESC LIMIT 1`,
      [deviseVente, devisePaiement, tauxAnnonce, VALIDITE_TAUX_JOURS],
    );
    if (!connu) {
      throw new BusinessRuleException(
        `Le taux ${tauxAnnonce} entre ${deviseVente} et ${devisePaiement} n'a pas été fixé ` +
          `par la pharmacie ces ${VALIDITE_TAUX_JOURS} derniers jours.`,
        { deviseVente, devisePaiement, tauxAnnonce },
      );
    }
    return connu;
  }
  const taux = await dernierTaux(tx, deviseVente, devisePaiement);
  if (!taux) {
    throw new BusinessRuleException(
      `Aucun taux entre ${deviseVente} et ${devisePaiement} : fixez le taux du jour dans Caisse.`,
      { deviseVente, devisePaiement },
    );
  }
  return taux;
}

/** Convertit un montant d'une devise à l'autre avec un taux de la paire. */
export function convertir(montant: number, de: string, vers: string, taux: Taux): number {
  if (de === vers) return montant;
  const r = Number(taux.rate);
  if (de === taux.base_currency && vers === taux.quote_currency) return montant * r;
  if (de === taux.quote_currency && vers === taux.base_currency) return montant / r;
  throw new Error(`Taux ${taux.base_currency}/${taux.quote_currency} inutilisable pour ${de}→${vers}`);
}

/**
 * Arrondi de la monnaie rendue : au multiple le plus proche du pas fixé
 * pour la devise cotée (les francs se rendent par 50 ou 100), au centime
 * sinon.
 */
export function arrondirMonnaie(montant: number, devise: string, taux: Taux | null): number {
  const pas = taux && devise === taux.quote_currency ? Number(taux.change_rounding) : 0;
  if (pas > 0) return Math.round(montant / pas) * pas;
  return arrondi2(montant);
}

/**
 * Écrit un mouvement de caisse et met à jour l'attendu de la devise
 * concernée : la devise de la pharmacie dans cash_sessions, toute autre
 * devise dans cash_session_currencies (créée au premier mouvement).
 */
export async function mouvementCaisse(
  tx: Tx,
  m: {
    organizationId: string;
    sessionId: string;
    deviseSession: string;
    devise: string;
    kind: string;
    amount: number;
    referenceKind?: string | null;
    referenceId?: string | null;
    reason: string;
    userId: string | null;
  },
) {
  const montant = arrondi2(m.amount);
  if (Math.abs(montant) < 0.005) return null;
  const mouvement = await tx.oneOrFail(
    `INSERT INTO cash_movements
       (organization_id, session_id, kind, amount, currency,
        reference_kind, reference_id, reason, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      m.organizationId, m.sessionId, m.kind, montant, m.devise,
      m.referenceKind ?? null, m.referenceId ?? null, m.reason, m.userId,
    ],
  );
  if (m.devise === m.deviseSession) {
    await tx.query(
      'UPDATE cash_sessions SET expected_cash = expected_cash + $2 WHERE id = $1',
      [m.sessionId, montant],
    );
  } else {
    await tx.query(
      `INSERT INTO cash_session_currencies (organization_id, session_id, currency, expected_cash)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (session_id, currency)
       DO UPDATE SET expected_cash = cash_session_currencies.expected_cash + EXCLUDED.expected_cash`,
      [m.organizationId, m.sessionId, m.devise, montant],
    );
  }
  return mouvement;
}
