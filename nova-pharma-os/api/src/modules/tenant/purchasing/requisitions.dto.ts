import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Min,
  MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

export const STATUTS_REQUISITION = ['brouillon', 'envoyee', 'recue', 'annulee'];

/** Une ligne : un produit, une quantité, le fournisseur choisi. */
export class RequisitionLineDto {
  @ApiPropertyOptional({ description: 'Produit du catalogue de la pharmacie.' })
  @ValidateIf((o: RequisitionLineDto) => !o.productName)
  @IsUUID('all', { message: 'Choisissez un produit du catalogue ou saisissez son nom.' })
  productId?: string;

  @ApiPropertyOptional({ example: 'Amoxicilline 500 mg' })
  @ValidateIf((o: RequisitionLineDto) => !o.productId)
  @IsString() @MinLength(2, { message: 'Choisissez un produit du catalogue ou saisissez son nom.' })
  productName?: string;

  @ApiPropertyOptional({ example: 'Boîte de 100' }) @IsOptional() @IsString() presentation?: string;

  @ApiProperty({ example: 50 })
  @IsNumber({}, { message: 'Quantité invalide.' }) @Min(0.001, { message: 'La quantité doit être positive.' })
  quantity!: number;

  @ApiPropertyOptional({ description: 'Fournisseur choisi ; à décider plus tard si absent.' })
  @IsOptional() @IsUUID() supplierId?: string;

  @ApiPropertyOptional({ description: 'Prix unitaire ; repris du catalogue du fournisseur si absent.' })
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;

  @ApiPropertyOptional({ example: 'USD' }) @IsOptional() @Length(3, 3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateRequisitionDto {
  @ApiPropertyOptional({ example: '2026-10-15', description: 'Date souhaitée de livraison.' })
  @IsOptional() @IsDateString({ strict: true }, { message: 'Date souhaitée invalide (AAAA-MM-JJ).' })
  neededBy?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [RequisitionLineDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Ajoutez au moins un produit.' })
  @ValidateNested({ each: true }) @Type(() => RequisitionLineDto)
  lines!: RequisitionLineDto[];
}

export class UpdateRequisitionDto {
  @ApiPropertyOptional({ enum: STATUTS_REQUISITION })
  @IsOptional() @IsIn(STATUTS_REQUISITION) status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString({ strict: true }, { message: 'Date souhaitée invalide (AAAA-MM-JJ).' })
  neededBy?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ type: [RequisitionLineDto], description: 'Remplace les lignes (brouillon seulement).' })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RequisitionLineDto)
  lines?: RequisitionLineDto[];
}
