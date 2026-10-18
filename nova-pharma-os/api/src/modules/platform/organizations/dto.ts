import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OwnerDto {
  @ApiProperty({ example: 'Jacques Dunia' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: 'gerant@nova-sante-pharma.cd' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Mot de passe initial (8 caractères minimum).' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'nova-sante-pharma', description: 'Identifiant court, unique.' })
  @Matches(/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$/, {
    message:
      'Identifiant court invalide : minuscules, chiffres et tirets, 3 à 50 caractères.',
  })
  slug!: string;

  @ApiProperty({ example: 'NOVA SANTÉ PHARMA SARL' })
  @IsString()
  @MinLength(2)
  legalName!: string;

  @ApiPropertyOptional({ example: 'NOVA SANTÉ PHARMA' })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({ enum: ['pharmacy', 'clinic', 'wholesaler', 'network'] })
  @IsOptional()
  @IsIn(['pharmacy', 'clinic', 'wholesaler', 'network'])
  kind?: string;

  @ApiProperty({ example: 'CD' })
  @IsString()
  countryCode!: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Par défaut : devise du pays.' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'fr' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'Africa/Lubumbashi' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ example: 'Bukavu' }) @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional({ description: 'Numéro d’agrément pharmaceutique.' })
  @IsOptional() @IsString() licenseNumber?: string;

  @ApiProperty({ example: 'professional', description: 'Code du forfait souscrit.' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'annual'])
  billingCycle?: 'monthly' | 'quarterly' | 'annual';

  @ApiPropertyOptional({
    default: true,
    description: "Démarre l'abonnement par un essai gratuit.",
  })
  @IsOptional()
  @IsBoolean()
  startTrial?: boolean;

  @ApiPropertyOptional({ description: "Durée d'essai en jours (défaut : celle du forfait)." })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() promoCode?: string;

  @ApiProperty({ type: OwnerDto, description: 'Administrateur de la pharmacie.' })
  @ValidateNested()
  @Type(() => OwnerDto)
  owner!: OwnerDto;

  @ApiPropertyOptional({ default: 'PRINCIPALE' })
  @IsOptional()
  @IsString()
  mainBranchName?: string;

  @ApiPropertyOptional({ description: 'Prospect converti à l’origine de cette souscription.' })
  @IsOptional()
  @IsString()
  leadId?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tradeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
}

export class SuspendOrganizationDto {
  @ApiProperty({ example: 'Facture NPO-2026-000123 impayée depuis 21 jours.' })
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class TerminateOrganizationDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiPropertyOptional({
    default: 365,
    description:
      'Durée de conservation des données avant archivage ou suppression définitive.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  retentionDays?: number;
}

export class ListOrganizationsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({
    enum: ['prospect', 'trial', 'active', 'suspended', 'terminated', 'archived'],
  })
  @IsOptional()
  @IsString()
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() planCode?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @IsInt() @Min(1) pageSize?: number;
}
