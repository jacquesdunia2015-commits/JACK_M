import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limite de forfait atteinte : module non souscrit, quota d'utilisateurs,
 * de branches, de produits ou de stockage dépassé.
 *
 * Répond 402 Payment Required : ce n'est ni une erreur de saisie (400)
 * ni un défaut de droits (403), mais une invitation à faire évoluer
 * l'abonnement — le front peut proposer la montée de forfait.
 */
export class PlanLimitException extends HttpException {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, error: 'PlanLimit', message, details },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/** Conflit métier : stock insuffisant, encours dépassé, doublon. */
export class BusinessRuleException extends HttpException {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(
      { statusCode: HttpStatus.CONFLICT, error: 'BusinessRule', message, details },
      HttpStatus.CONFLICT,
    );
  }
}
