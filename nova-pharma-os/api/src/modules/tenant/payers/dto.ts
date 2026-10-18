import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength,
} from 'class-validator';

export const TYPES_PAYEUR = ['assurance', 'mutuelle', 'entreprise', 'ong', 'autre'] as const;

export class PayerInput {
  @ApiProperty({ example: 'Mutuelle de santé Umoja' })
  @IsString() @MinLength(2, { message: 'Indiquez le nom de l’organisme.' })
  name!: string;

  @ApiPropertyOptional({ description: 'Code court ; généré si absent.' })
  @IsOptional() @IsString() code?: string;

  @ApiPropertyOptional({ enum: TYPES_PAYEUR, default: 'assurance' })
  @IsOptional() @IsIn(TYPES_PAYEUR as unknown as string[]) kind?: string;

  @ApiPropertyOptional({ example: 80, description: 'Part prise en charge, en %.' })
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) coveragePercent?: number;

  @ApiPropertyOptional({ description: 'Plafond de la part du payeur sur une vente.' })
  @IsOptional() @IsNumber() @Min(0.01) perSaleCeiling?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional({ default: 30, description: 'Délai de règlement des relevés, en jours.' })
  @IsOptional() @IsInt() @Min(0) paymentDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PayerUpdate extends PartialType(PayerInput) {}

export class MemberInput {
  @ApiProperty({ example: 'UMJ-00451', description: 'Numéro de carte ou matricule.' })
  @IsString() @MinLength(1, { message: 'Indiquez le numéro de carte ou le matricule.' })
  memberNumber!: string;

  @ApiProperty({ example: 'Furaha Bahati' })
  @IsString() @MinLength(2, { message: 'Indiquez le nom du bénéficiaire.' })
  fullName!: string;

  @ApiPropertyOptional({ description: 'Adhérent principal, pour un ayant droit.' })
  @IsOptional() @IsString() principalName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;

  @ApiPropertyOptional({ description: 'Taux propre à ce bénéficiaire, en %.' })
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) coveragePercent?: number | null;

  @ApiPropertyOptional({ description: 'Plafond annuel de la part du payeur.' })
  @IsOptional() @IsNumber() @Min(0.01) annualCeiling?: number | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date au format AAAA-MM-JJ.' })
  validUntil?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MemberUpdate extends PartialType(MemberInput) {}

export class ClaimInput {
  @ApiProperty() @IsString() payerId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date au format AAAA-MM-JJ.' })
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date au format AAAA-MM-JJ.' })
  periodEnd!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ClaimPaymentInput {
  @ApiProperty({ example: 120.5 })
  @IsNumber() @Min(0.01) amount!: number;

  @ApiPropertyOptional({ enum: ['bank_transfer', 'cash', 'mobile_money', 'bank_local', 'manual'], default: 'bank_transfer' })
  @IsOptional() @IsIn(['bank_transfer', 'cash', 'mobile_money', 'bank_local', 'manual']) method?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
}
