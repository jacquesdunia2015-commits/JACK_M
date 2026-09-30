import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EstTelephone } from '../../common/telephone';

/**
 * Inscription d'une pharmacie depuis la page publique.
 *
 * La personne qui s'inscrit crée à la fois son officine et son propre
 * compte, dont elle devient l'administratrice. Téléphone, adresse et mot
 * de passe sont exigés tous les trois.
 */
export class InscriptionDto {
  @ApiProperty({ example: 'Pharmacie du Lac' })
  @IsString()
  @MinLength(2, { message: 'Indiquez le nom de la pharmacie.' })
  @MaxLength(120)
  pharmacyName!: string;

  @ApiPropertyOptional({ example: 'Bukavu' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'CD', description: 'Code pays ISO. Par défaut : CD.' })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Code pays invalide.' })
  countryCode?: string;

  @ApiProperty({ example: 'Espérance Nsimire' })
  @IsString()
  @MinLength(2, { message: 'Indiquez votre nom complet.' })
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '0991234567' })
  @EstTelephone()
  phone!: string;

  @ApiProperty({ example: 'gerant@pharmacie-du-lac.cd' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @ApiProperty({ description: '8 caractères minimum.' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;
}
