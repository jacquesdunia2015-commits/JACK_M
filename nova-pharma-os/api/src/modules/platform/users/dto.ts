import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { EstTelephone } from '../../../common/telephone';

export const ROLES_INTERNES = ['super_admin', 'support_admin', 'commercial'] as const;
export type RoleInterne = (typeof ROLES_INTERNES)[number];

/**
 * Création d'un compte interne NOVA PHARMA OS.
 *
 * Réservée au super-administrateur (voir le contrôleur) : ces comptes
 * pilotent toutes les pharmacies clientes, aucun ne peut se créer seul.
 */
export class CreatePlatformUserDto {
  @ApiProperty({ example: 'Agent support' })
  @IsString()
  @MinLength(2, { message: 'Indiquez le nom complet.' })
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '+243991234567' })
  @EstTelephone()
  phone!: string;

  @ApiProperty({ example: 'support@novapharmaos.com' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @ApiProperty({ description: 'Mot de passe initial (8 caractères minimum).' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;

  @ApiProperty({ enum: ROLES_INTERNES })
  @IsIn(ROLES_INTERNES, {
    message: `Rôle interne invalide. Valeurs acceptées : ${ROLES_INTERNES.join(', ')}.`,
  })
  role!: RoleInterne;
}
