import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min,
  MinLength, ValidateNested,
} from 'class-validator';

export const SALE_PAYMENT_METHODS = [
  'cash', 'mobile_money', 'card', 'bank_transfer', 'bank_local', 'credit',
] as const;

export class SaleLineDto {
  @ApiPropertyOptional({ description: 'Identifiant du produit.' })
  @IsOptional() @IsString() productId?: string;

  @ApiPropertyOptional({ description: 'Référence interne, si l’identifiant est inconnu.' })
  @IsOptional() @IsString() sku?: string;

  @ApiPropertyOptional({ description: 'Code-barres scanné.' })
  @IsOptional() @IsString() barcode?: string;

  @ApiProperty({ example: 2 })
  @IsNumber() @Min(0.001) quantity!: number;

  @ApiPropertyOptional({ description: 'Prix négocié. Par défaut, le prix catalogue.' })
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
}

export class SalePaymentDto {
  @ApiProperty({ enum: SALE_PAYMENT_METHODS })
  @IsIn(SALE_PAYMENT_METHODS as unknown as string[])
  method!: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber() @Min(0.01) amount!: number;

  @ApiPropertyOptional({ example: 'M-Pesa' })
  @IsOptional() @IsString() provider?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
}

export class PrescriptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() patientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriberName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriberNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'Branche de vente. Par défaut, celle de la session.' })
  @IsOptional() @IsString() branchId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;

  @ApiPropertyOptional({ enum: ['pos', 'b2b', 'online', 'delivery'], default: 'pos' })
  @IsOptional() @IsIn(['pos', 'b2b', 'online', 'delivery']) channel?: string;

  @ApiProperty({ type: [SaleLineDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Une vente comporte au moins une ligne.' })
  @ValidateNested({ each: true }) @Type(() => SaleLineDto)
  lines!: SaleLineDto[];

  @ApiPropertyOptional({ type: [SalePaymentDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SalePaymentDto)
  payments?: SalePaymentDto[];

  @ApiPropertyOptional({ type: PrescriptionDto })
  @IsOptional() @ValidateNested() @Type(() => PrescriptionDto)
  prescription?: PrescriptionDto;

  @ApiPropertyOptional({
    description:
      "Identifiant d'opération produit par le poste de vente. Rejouer la même " +
      "valeur ne crée pas de doublon : la vente déjà enregistrée est renvoyée.",
  })
  @IsOptional() @IsString() clientOperationId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ default: false, description: 'Émettre une facture en plus du reçu.' })
  @IsOptional() issueInvoice?: boolean;
}

export class CancelSaleDto {
  @ApiProperty()
  @IsString() @MinLength(5) reason!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Remet les articles en stock sur leurs lots d’origine.',
  })
  @IsOptional() restock?: boolean;
}

export class ListSalesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() page?: number;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() pageSize?: number;
}
