import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength,
} from 'class-validator';

export class RequestSupportAccessDto {
  @ApiProperty({
    example: "Analyse du ticket TCK-2026-00042 : écart d'inventaire signalé.",
    description: "Motif de l'accès, communiqué à la pharmacie.",
  })
  @IsString()
  @MinLength(10, { message: 'Le motif doit être explicite (10 caractères minimum).' })
  reason!: string;

  @ApiPropertyOptional({ enum: ['read_only', 'read_write'], default: 'read_only' })
  @IsOptional()
  @IsIn(['read_only', 'read_write'])
  mode?: 'read_only' | 'read_write';

  @ApiPropertyOptional({ default: 4, description: 'Durée demandée, en heures.' })
  @IsOptional() @IsInt() @Min(1) @Max(72) durationHours?: number;

  @ApiPropertyOptional({ description: 'Ticket de support à l’origine de la demande.' })
  @IsOptional() @IsString() ticketId?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      "Exige la validation de la pharmacie. Un accès en écriture l'exige toujours.",
  })
  @IsOptional() @IsBoolean() requiresCustomerApproval?: boolean;
}

export class CreateTicketDto {
  @ApiProperty() @IsString() @MinLength(3) subject!: string;
  @ApiProperty() @IsString() @MinLength(10) description!: string;

  @ApiPropertyOptional({
    enum: ['question', 'incident', 'bug', 'feature_request', 'billing'],
  })
  @IsOptional()
  @IsIn(['question', 'incident', 'bug', 'feature_request', 'billing'])
  category?: string;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'critical'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: string;
}

export class TicketMessageDto {
  @ApiProperty() @IsString() @MinLength(1) body!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Note interne, invisible pour la pharmacie.',
  })
  @IsOptional() @IsBoolean() isInternalNote?: boolean;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({
    enum: ['open', 'pending_customer', 'in_progress', 'resolved', 'closed'],
  })
  @IsOptional()
  @IsIn(['open', 'pending_customer', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'critical'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() assignedPlatformUserId?: string;
}

export class SatisfactionDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5) score!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
