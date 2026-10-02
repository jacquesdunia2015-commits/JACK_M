import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { InscriptionDto } from './dto';
import { InscriptionService } from './inscription.service';

@ApiTags('Authentification')
@Controller('auth')
export class InscriptionController {
  constructor(private readonly inscription: InscriptionService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Inscription publique d’une pharmacie',
    description:
      'Crée la pharmacie en période d’essai et son compte administrateur ' +
      '(téléphone, e-mail, mot de passe). Ne crée jamais de compte interne.',
  })
  inscrire(@Body() dto: InscriptionDto, @Req() req: { ip?: string }) {
    return this.inscription.inscrire(dto, req.ip);
  }
}
