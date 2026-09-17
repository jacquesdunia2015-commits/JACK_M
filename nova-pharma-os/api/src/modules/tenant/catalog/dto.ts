import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'PARA-500-CP20' })
  @IsString() @MinLength(1) sku!: string;

  @ApiProperty({ example: 'Paracétamol 500 mg' })
  @IsString() @MinLength(2) name!: string;

  @ApiPropertyOptional({ example: 'Doliprane' })
  @IsOptional() @IsString() commercialName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() categoryCode?: string;
  @ApiPropertyOptional({ description: 'Dénomination commune internationale.' })
  @IsOptional() @IsString() inn?: string;
  @ApiPropertyOptional({ example: '500 mg' }) @IsOptional() @IsString() dosage?: string;
  @ApiPropertyOptional({ example: 'comprimé' }) @IsOptional() @IsString() dosageForm?: string;
  @ApiPropertyOptional({ example: 'boîte de 20' }) @IsOptional() @IsString() packaging?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() originCountry?: string;
  @ApiPropertyOptional({ default: 'unit' }) @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() @Min(0.001) unitsPerPack?: number;

  @ApiPropertyOptional({ default: false, description: 'Délivrance sur ordonnance.' })
  @IsOptional() @IsBoolean() requiresPrescription?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Stupéfiant ou psychotrope.' })
  @IsOptional() @IsBoolean() isControlled?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Chaîne du froid.' })
  @IsOptional() @IsBoolean() isColdChain?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() storageConditions?: string;

  @ApiPropertyOptional({ default: true, description: 'Suivi par lot.' })
  @IsOptional() @IsBoolean() isBatchTracked?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() hasExpiry?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @ApiProperty({ example: 0.5 }) @IsNumber() @Min(0) salePrice!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) wholesalePrice?: number;
  @ApiPropertyOptional({ description: 'Marge minimale tolérée, en pourcentage.' })
  @IsOptional() @IsNumber() @Min(0) minMarginPercent?: number;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) reorderPoint?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) reorderQuantity?: number;
  @ApiPropertyOptional({ default: 90, description: 'Alerte de péremption, en jours.' })
  @IsOptional() @IsInt() @Min(0) expiryAlertDays?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() barcodes?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateProductDto extends CreateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() declare sku: string;
  @ApiPropertyOptional() @IsOptional() @IsString() declare name: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() declare salePrice: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SearchProductsDto {
  @ApiPropertyOptional({ description: 'Nom, référence, code-barres ou molécule.' })
  @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryCode?: string;
  @ApiPropertyOptional({ description: 'Restreint aux produits en rupture.' })
  @IsOptional() @IsBoolean() outOfStock?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPrescription?: boolean;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(1) pageSize?: number;
}

export class ImportProductsDto {
  @ApiProperty({ type: [CreateProductDto], description: 'Catalogue initial à importer.' })
  @IsArray() products!: CreateProductDto[];
}
