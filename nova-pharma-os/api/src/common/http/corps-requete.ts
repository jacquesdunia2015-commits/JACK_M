import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Taille maximale d'une requête JSON. Express s'arrête par défaut à
 * 100 Ko : un logo de 300 Ko ou une photo d'ordonnance étaient refusés.
 * Les images sont réduites dans le navigateur avant l'envoi ; 3 Mo laisse
 * une marge sans ouvrir la porte aux envois démesurés.
 */
export const TAILLE_MAX_REQUETE = '3mb';

export function configurerCorpsRequete(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: TAILLE_MAX_REQUETE });
  app.useBodyParser('urlencoded', { limit: TAILLE_MAX_REQUETE, extended: true });
}
