import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EstTelephone } from '../../../common/telephone';

/**
 * Création d'un compte dans l'équipe d'une pharmacie.
 *
 * Téléphone, adresse et mot de passe sont tous trois exigés : l'adresse
 * sert à se connecter, le téléphone à joindre la personne — au comptoir
 * comme en tournée de livraison, c'est souvent le seul moyen sûr.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Espérance Nsimire' })
  @IsString()
  @MinLength(2, { message: 'Indiquez le nom complet.' })
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '+243991234567' })
  @EstTelephone()
  phone!: string;

  @ApiProperty({ example: 'vendeur@nova-sante-pharma.cd' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @ApiProperty({ description: 'Mot de passe initial (8 caractères minimum).' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;

  @ApiPropertyOptional({ example: ['vendeur'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultBranchId?: string;
}
