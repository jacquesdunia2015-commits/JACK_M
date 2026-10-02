import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../../common/database/request-context';
import { normaliserTelephone } from '../../common/telephone';
import { OrganizationsService } from '../platform/organizations/organizations.service';
import { InscriptionDto } from './dto';

/** Plafond d'inscriptions acceptées par heure, toutes adresses confondues. */
const LIMITE_PAR_DEFAUT = 20;
const UNE_HEURE = 60 * 60 * 1000;

/**
 * Inscription publique d'une pharmacie.
 *
 * C'est la porte d'entrée commerciale du service : une pharmacie crée son
 * compte seule, démarre en essai gratuit, et apparaît aussitôt dans le
 * back-office. Elle passe par exactement le même provisionnement que celui
 * du back-office — organisation, abonnement d'essai, branche, rôles, compte
 * administrateur — pour qu'une pharmacie inscrite en ligne ne diffère en
 * rien d'une pharmacie créée par l'équipe NOVA PHARMA OS.
 *
 * Deux garde-fous, parce que la page est ouverte à tout Internet :
 *   — un interrupteur, INSCRIPTION_PUBLIQUE=off, qui ferme la porte ;
 *   — un plafond d'inscriptions par heure (INSCRIPTION_LIMITE_PAR_HEURE),
 *     qui borne les dégâts d'un robot. Il est global plutôt que par
 *     adresse IP : toutes les requêtes arrivent ici par le serveur de
 *     l'interface, l'adresse du visiteur n'est pas fiable à ce niveau.
 *
 * Aucune inscription ne peut créer de compte interne NOVA PHARMA OS : ces
 * comptes pilotent toutes les pharmacies, seul un super-administrateur
 * peut les créer.
 */
@Injectable()
export class InscriptionService {
  /** Horodatages des inscriptions acceptées dans l'heure écoulée. */
  private readonly acceptees: number[] = [];

  constructor(
    private readonly db: DatabaseService,
    private readonly organizations: OrganizationsService,
  ) {}

  async inscrire(dto: InscriptionDto, ip?: string) {
    if ((process.env.INSCRIPTION_PUBLIQUE ?? 'on').toLowerCase() === 'off') {
      throw new ForbiddenException(
        'Les inscriptions en ligne sont fermées. Contactez NOVA PHARMA OS pour ouvrir un compte.',
      );
    }
    this.verifierDebit();

    const email = dto.email.trim().toLowerCase();
    const pays = (dto.countryCode ?? 'CD').toUpperCase();
    const nomOfficine = dto.pharmacyName.trim();

    // Une adresse qui sert déjà à se connecter quelque part rendrait la
    // connexion ambiguë : on renvoie plutôt la personne vers la connexion.
    const existants = await this.db.readTransaction(
      { actorKind: 'system', platform: false, readonly: true },
      (tx) => tx.many('SELECT id FROM nova.authentication_lookup($1, NULL)', [email]),
    );
    if (existants.length > 0) {
      throw new ConflictException(
        'Cette adresse e-mail a déjà un compte. Connectez-vous, ou choisissez une autre adresse.',
      );
    }

    const reglages = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ phone_prefix: string | null }>(
        'SELECT phone_prefix FROM country_settings WHERE code = $1',
        [pays],
      ),
    );
    if (!reglages) {
      throw new BadRequestException(`Pays non pris en charge : ${pays}.`);
    }
    const telephone = normaliserTelephone(dto.phone, reglages.phone_prefix ?? '+243');
    if (!telephone) {
      throw new BadRequestException(
        'Numéro de téléphone invalide : indiquez-le avec l’indicatif du pays ou en commençant par 0.',
      );
    }

    const slug = await this.identifiantLibre(nomOfficine);

    await this.organizations.provision(this.contexte(email, ip), {
      slug,
      legalName: nomOfficine,
      tradeName: nomOfficine,
      kind: 'pharmacy',
      countryCode: pays,
      city: dto.city?.trim() || undefined,
      phone: telephone,
      email,
      planCode: process.env.INSCRIPTION_FORFAIT ?? 'professional',
      billingCycle: 'monthly',
      startTrial: true,
      mainBranchName: 'Officine principale',
      owner: {
        fullName: dto.fullName.trim(),
        email,
        password: dto.password,
        phone: telephone,
      },
    });

    this.acceptees.push(Date.now());

    return {
      organizationSlug: slug,
      email,
      message:
        'Votre pharmacie est créée, en période d’essai. Vous en êtes l’administrateur.',
    };
  }

  /** Refuse l'inscription si le plafond horaire est atteint. */
  private verifierDebit(): void {
    const limite = Number(process.env.INSCRIPTION_LIMITE_PAR_HEURE ?? LIMITE_PAR_DEFAUT);
    const depuis = Date.now() - UNE_HEURE;
    while (this.acceptees.length > 0 && this.acceptees[0] < depuis) {
      this.acceptees.shift();
    }
    if (this.acceptees.length >= limite) {
      throw new HttpException(
        'Trop d’inscriptions en peu de temps. Réessayez dans une heure, ou contactez NOVA PHARMA OS.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Identifiant court dérivé du nom : « Pharmacie du Lac » donne
   * « pharmacie-du-lac », puis « pharmacie-du-lac-2 » s'il est pris.
   */
  private async identifiantLibre(nom: string): Promise<string> {
    let base = nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '');
    if (base.length < 3) base = `${base || 'officine'}-pharma`.replace(/^-/, '');

    const candidats = [base, ...Array.from({ length: 49 }, (_, i) => `${base}-${i + 2}`)];
    const pris = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ slug: string }>('SELECT slug FROM organizations WHERE slug = ANY($1)', [
        candidats,
      ]),
    );
    const occupes = new Set(pris.map((p) => p.slug));
    const libre = candidats.find((c) => !occupes.has(c));
    if (libre) return libre;
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Contexte du provisionnement : celui de la plateforme — c'est elle qui
   * crée l'organisation — mais signé « inscription publique » dans le
   * journal d'audit, pour qu'on distingue ces créations de celles faites
   * par l'équipe.
   */
  private contexte(email: string, ip?: string): RequestContext {
    return {
      actorKind: 'system',
      actorLabel: `inscription publique (${email})`,
      platform: true,
      readonly: false,
      platformRole: 'super_admin',
      ip,
    };
  }
}
