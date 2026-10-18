import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { EstTelephone } from '../../../common/telephone';

/** Client nommé au moment de la facture, s'il n'est pas encore au fichier. */
export class ClientFactureDto {
  @ApiProperty({ example: 'Mme Furaha Bahati' })
  @IsString() @MinLength(2) @MaxLength(160) name!: string;

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional() @EstTelephone() phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional({ description: 'Numéro d’impôt ou RCCM d’une entreprise cliente.' })
  @IsOptional() @IsString() @MaxLength(60) taxId?: string;
}

export class EmettreFactureDto {
  @ApiProperty({ description: 'La vente à facturer.' })
  @IsUUID('4', { message: 'Vente inconnue.' }) saleId!: string;

  @ApiPropertyOptional({ description: 'Client déjà au fichier.' })
  @IsOptional() @IsUUID('4', { message: 'Client inconnu.' }) customerId?: string;

  @ApiPropertyOptional({
    type: ClientFactureDto,
    description: 'Nouveau client : retrouvé par son téléphone s’il est déjà au fichier, créé sinon.',
  })
  @IsOptional() @ValidateNested() @Type(() => ClientFactureDto)
  customer?: ClientFactureDto;
}

export class ListeFacturesDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') customerId?: string;
  @ApiPropertyOptional({ description: 'Numéro de facture, nom ou téléphone du client.' })
  @IsOptional() @IsString() search?: string;
}
