import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString,
  Min, MinLength, ValidateNested,
} from 'class-validator';

export class PurchaseOrderLineDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty({ example: 100 }) @IsNumber() @Min(0.001) quantity!: number;
  @ApiProperty({ example: 0.28 }) @IsNumber() @Min(0) unitCost!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) taxRate?: number;
}

export class CreatePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiProperty() @IsString() supplierId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedDate?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) shippingCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class ReceiptLineDto {
  @ApiProperty() @IsString() productId!: string;

  @ApiPropertyOptional({ description: 'Ligne de commande couverte par cette réception.' })
  @IsOptional() @IsString() purchaseOrderLineId?: string;

  @ApiPropertyOptional({ description: 'Numéro de lot du fabricant.' })
  @IsOptional() @IsString() lotNumber?: string;

  @ApiPropertyOptional({ description: 'Date de péremption (obligatoire pour un produit à péremption).' })
  @IsOptional() @IsString() expiryDate?: string;

  @ApiProperty() @IsNumber() @Min(0.001) quantity!: number;
  @ApiProperty() @IsNumber() @Min(0) unitCost!: number;
}

export class CreateReceiptDto {
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purchaseOrderId?: string;
  @ApiProperty() @IsString() supplierId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierInvoiceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receivedDate?: string;
  @ApiPropertyOptional({
    description: "Clé d'idempotence : empêche la double réception d'un même bon.",
  })
  @IsOptional() @IsString() idempotencyKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [ReceiptLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiptLineDto)
  lines!: ReceiptLineDto[];

  @ApiPropertyOptional({
    default: true,
    description: 'Valide la réception et met le stock à jour immédiatement.',
  })
  @IsOptional() @IsBoolean() validate?: boolean;
}

/**
 * Entrée en stock d'un achat, sans commande préalable : ce que la pharmacie
 * a acheté, en quelle quantité, à quel prix. Le fournisseur est facultatif —
 * un achat au marché ou chez un confrère n'en a pas toujours.
 */
export class StockEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;

  @ApiPropertyOptional({ description: 'Fournisseur ; « achats divers » si absent.' })
  @IsOptional() @IsString() supplierId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() supplierInvoiceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receivedDate?: string;
  @ApiPropertyOptional({ description: "Clé d'idempotence : un double clic n'entre pas deux fois." })
  @IsOptional() @IsString() idempotencyKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [ReceiptLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiptLineDto)
  lines!: ReceiptLineDto[];
}
