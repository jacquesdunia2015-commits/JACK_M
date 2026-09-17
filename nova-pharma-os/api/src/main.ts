import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './database/load-env';

async function bootstrap(): Promise<void> {
  loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX') ?? 'api';
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // Le filtre d'exceptions est enregistré via APP_FILTER (app.module.ts)
  // pour bénéficier de l'injection de dépendances.

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Branch-Id'],
  });

  const swagger = new DocumentBuilder()
    .setTitle('NOVA PHARMA OS')
    .setDescription(
      'Plateforme SaaS de gestion pharmaceutique, commerciale et logistique. ' +
        "Deux espaces : le back-office SaaS administré par NOVA PHARMA OS, et " +
        "l'espace pharmacie administré par chaque pharmacie abonnée.",
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'partner-api-key')
    .addTag('Authentification')
    .addTag('Back-office SaaS')
    .addTag('Espace pharmacie')
    .build();
  SwaggerModule.setup(
    `${prefix}/docs`,
    app,
    SwaggerModule.createDocument(app, swagger),
    { swaggerOptions: { persistAuthorization: true } },
  );

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('NOVA PHARMA OS').log(
    `API démarrée sur http://localhost:${port}/${prefix} — documentation : /${prefix}/docs`,
  );
}

bootstrap();
