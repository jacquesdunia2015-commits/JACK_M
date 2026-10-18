import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length,
  Matches, Min, MinLength, ValidateIf,
} from 'class-validator';
import { EstTelephone } from '../../../common/telephone';

export const NATURES_FOURNISSEUR = ['wholesaler', 'semi_wholesaler', 'manufacturer', 'importer'];

/**
 * Fiche d'un fournisseur : un dépôt pharmaceutique, un grossiste, un
 * laboratoire. Le nom et le téléphone suffisent à l'enregistrer ; le
 * reste se complète au fil des commandes.
 */
export class CreateSupplierDto {
  @ApiProperty({ example: 'Dépôt pharmaceutique Shalom' })
  @IsString() @MinLength(2) name!: string;

  @ApiProperty({ example: '0991 234 567' })
  @EstTelephone() phone!: string;

  @ApiPropertyOptional({ example: 'commandes@depot-shalom.cd' })
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;

  @ApiPropertyOptional({ example: 'CD', description: 'Code pays ISO à deux lettres.' })
  @IsOptional() @Matches(/^[A-Za-z]{2}$/, { message: 'Pays : code à deux lettres (CD, RW, UG…).' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'Bukavu' }) @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ example: 'Avenue Kasongo, n° 12' }) @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ example: 'Jean Mukendi' }) @IsOptional() @IsString() contactName?: string;

  @ApiPropertyOptional({ description: 'Référence interne ; tirée du nom si absente.' })
  @IsOptional() @IsString() @MinLength(1) code?: string;

  @ApiPropertyOptional({ enum: NATURES_FOURNISSEUR })
  @IsOptional() @IsIn(NATURES_FOURNISSEUR) kind?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional({ example: 'USD' }) @IsOptional() @Length(3, 3) currency?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) paymentTermsDays?: number;
  @ApiPropertyOptional({ default: 7 }) @IsOptional() @IsInt() @Min(0) leadTimeDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Un article du catalogue d'un fournisseur : un produit déjà référencé
 * par la pharmacie, ou un simple nom pour un produit qu'elle ne vend pas
 * encore.
 */
export class SupplierProductDto {
  @ApiPropertyOptional({ description: 'Produit du catalogue de la pharmacie.' })
  @ValidateIf((o: SupplierProductDto) => !o.productName)
  @IsUUID('all', { message: 'Choisissez un produit du catalogue ou saisissez son nom.' })
  productId?: string;

  @ApiPropertyOptional({ example: 'Amoxicilline 500 mg' })
  @ValidateIf((o: SupplierProductDto) => !o.productId)
  @IsString() @MinLength(2, { message: 'Choisissez un produit du catalogue ou saisissez son nom.' })
  productName?: string;

  @ApiPropertyOptional({ example: 'Gélules, boîte de 100' })
  @IsOptional() @IsString() presentation?: string;

  @ApiProperty({ example: 4.5, description: "Prix d'achat chez ce fournisseur." })
  @IsNumber({}, { message: 'Prix invalide.' }) @Min(0) price!: number;

  @ApiPropertyOptional({ example: 'USD' }) @IsOptional() @Length(3, 3) currency?: string;
  @ApiPropertyOptional({ example: '2026-03-01', description: 'Date de fabrication du lot proposé.' })
  @IsOptional() @IsDateString({ strict: true }, { message: 'Date de fabrication invalide (AAAA-MM-JJ).' })
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2028-02-28', description: "Date d'expiration du lot proposé." })
  @IsOptional() @IsDateString({ strict: true }, { message: "Date d'expiration invalide (AAAA-MM-JJ)." })
  expiryDate?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() @Min(0.001) minOrderQuantity?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPreferred?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSupplierProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() presentation?: string;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Date de fabrication du lot proposé.' })
  @IsOptional() @IsDateString({ strict: true }, { message: 'Date de fabrication invalide (AAAA-MM-JJ).' })
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2028-02-28', description: "Date d'expiration du lot proposé." })
  @IsOptional() @IsDateString({ strict: true }, { message: "Date d'expiration invalide (AAAA-MM-JJ)." })
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Vide la date de fabrication.' })
  @IsOptional() @IsBoolean() clearManufactureDate?: boolean;

  @ApiPropertyOptional({ description: "Vide la date d'expiration." })
  @IsOptional() @IsBoolean() clearExpiryDate?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @Length(3, 3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.001) minOrderQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPreferred?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
