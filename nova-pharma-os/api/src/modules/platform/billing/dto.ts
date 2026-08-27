import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength,
} from 'class-validator';

export const SAAS_PAYMENT_METHODS = [
  'mobile_money',
  'bank_transfer',
  'bank_local',
  'card',
  'manual',
] as const;

export class GenerateInvoiceDto {
  @ApiPropertyOptional({ description: 'Début de période facturée (défaut : période courante).' })
  @IsOptional() @IsISO8601() periodStart?: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601() periodEnd?: string;

  @ApiPropertyOptional({
    description:
      "Clé d'idempotence : deux appels avec la même clé produisent une seule facture.",
  })
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class RecordPaymentDto {
  @ApiPropertyOptional({ description: 'Facture réglée. Omise, le paiement est mis en attente d’affectation.' })
  @IsOptional() @IsString() invoiceId?: string;

  @ApiProperty({ enum: SAAS_PAYMENT_METHODS })
  @IsIn(SAAS_PAYMENT_METHODS as unknown as string[])
  method!: string;

  @ApiPropertyOptional({ example: 'M-Pesa' })
  @IsOptional() @IsString() provider?: string;

  @ApiProperty({ example: 79 })
  @IsNumber() @Min(0.01) amount!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional({ description: 'Référence interne (bordereau, reçu).' })
  @IsOptional() @IsString() reference?: string;

  @ApiPropertyOptional({ description: 'Référence de la transaction chez l’opérateur.' })
  @IsOptional() @IsString() externalReference?: string;

  @ApiPropertyOptional({
    description: "Clé d'idempotence : protège des doubles encaissements en cas de rejeu.",
  })
  @IsOptional() @IsString() idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Confirme immédiatement le paiement (validation manuelle).' })
  @IsOptional() confirm?: boolean;
}

export class CreditNoteDto {
  @ApiProperty() @IsString() invoiceId!: string;

  @ApiPropertyOptional({ description: 'Montant à créditer. Par défaut, le solde de la facture.' })
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;

  @ApiProperty() @IsString() @MinLength(5) reason!: string;
}

export class ListInvoicesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({
    enum: ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'],
  })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() page?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() pageSize?: number;
}
