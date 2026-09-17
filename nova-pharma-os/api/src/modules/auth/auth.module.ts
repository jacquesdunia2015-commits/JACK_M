import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessContextService } from '../../common/auth/access-context.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
        signOptions: { issuer: 'nova-pharma-os' },
        verifyOptions: { issuer: 'nova-pharma-os' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessContextService],
  exports: [AuthService, AccessContextService, JwtModule],
})
export class AuthModule {}
