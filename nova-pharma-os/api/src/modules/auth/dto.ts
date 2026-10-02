import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'gerant@nova-sante-pharma.cd' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @ApiProperty({ example: 'MotDePasse123!' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;

  @ApiPropertyOptional({
    description:
      "Identifiant court de la pharmacie. Requis si l'adresse e-mail est utilisée dans plusieurs organisations.",
    example: 'nova-sante-pharma',
  })
  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @ApiPropertyOptional({
    description:
      'Code à 6 chiffres de l’application d’authentification (ou code de secours), ' +
      'si la double authentification est activée sur le compte.',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  code?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class CodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}

export class DesactivationDto {
  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty({ description: 'Code de l’application, ou code de secours.' })
  @IsString()
  code!: string;
}
