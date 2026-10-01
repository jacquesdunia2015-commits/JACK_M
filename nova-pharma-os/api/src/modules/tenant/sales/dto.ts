import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Min,
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

  @ApiPropertyOptional({
    example: 'CDF',
    description:
      'Devise du montant remis, si ce n’est pas celle de la vente. « amount » est ' +
      'alors exprimé dans cette devise et converti au taux du jour.',
  })
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/, { message: 'Devise sur trois lettres (USD, CDF…).' })
  currency?: string;

  @ApiPropertyOptional({
    example: 2850,
    description:
      'Taux affiché au client (1 devise forte = taux devise faible). Accepté s’il a été ' +
      'fixé par la pharmacie ces derniers jours ; sinon le dernier taux s’applique.',
  })
  @IsOptional() @IsNumber() @Min(0.000001) exchangeRate?: number;
}

export class PrescriptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() patientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriberName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriberNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CoverageDto {
  @ApiProperty({ description: 'Bénéficiaire du tiers payant (carte ou matricule enregistré).' })
  @IsString() payerMemberId!: string;

  @ApiPropertyOptional({ description: 'Numéro du bon de prise en charge, s’il y en a un.' })
  @IsOptional() @IsString() authorizationNumber?: string;
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

  @ApiPropertyOptional({
    type: CoverageDto,
    description: 'Tiers payant : la part du payeur est calculée par le serveur ; les paiements couvrent la part du patient.',
  })
  @IsOptional() @ValidateNested() @Type(() => CoverageDto)
  coverage?: CoverageDto;

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

  @ApiPropertyOptional({
    example: '2026-10-01T09:42:00.000Z',
    description:
      'Heure réelle d’une vente encaissée hors connexion et envoyée au retour du réseau ' +
      '(au plus 7 jours plus tôt). Exige clientOperationId.',
  })
  @IsOptional() @IsDateString({}, { message: 'Heure de vente au format ISO 8601.' }) soldAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({
    example: 'CDF',
    description: 'Devise dans laquelle la monnaie est rendue. Par défaut, celle de la vente.',
  })
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/, { message: 'Devise sur trois lettres (USD, CDF…).' })
  changeCurrency?: string;

  @ApiPropertyOptional({ default: false, description: 'Émettre une facture en plus du reçu.' })
  @IsOptional() issueInvoice?: boolean;

  @ApiPropertyOptional({
    example: 200,
    description: 'Points de fidélité du client utilisés pour payer une partie de la vente (exige customerId).',
  })
  @IsOptional() @IsInt({ message: 'Un nombre entier de points.' }) @Min(1) loyaltyPoints?: number;
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
