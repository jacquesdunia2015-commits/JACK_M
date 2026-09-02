import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ example: 'business' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ enum: ['monthly', 'quarterly', 'annual'] })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'annual'])
  billingCycle?: 'monthly' | 'quarterly' | 'annual';

  @ApiProperty({ example: 'Passage au forfait supérieur à la demande du client.' })
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class ChangeStatusDto {
  @ApiProperty({
    enum: [
      'trialing', 'active', 'pending_payment', 'past_due',
      'suspended', 'cancelled', 'expired', 'archived',
    ],
  })
  @IsIn([
    'trialing', 'active', 'pending_payment', 'past_due',
    'suspended', 'cancelled', 'expired', 'archived',
  ])
  status!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class AddAddonDto {
  @ApiProperty({ example: 'extra_user' })
  @IsString()
  addonCode!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ExtendTrialDto {
  @ApiProperty({ example: 14 })
  @IsInt()
  @Min(1)
  days!: number;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
