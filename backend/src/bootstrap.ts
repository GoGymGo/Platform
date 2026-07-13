import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { setupOpenApi } from './common/openapi/openapi';
import type { Environment } from './config/environment';

export function configureApplication(app: INestApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const allowedOrigins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: allowedOrigins,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: boolean | number) => void;
  };
  if (config.get('TRUST_PROXY', { infer: true })) {
    httpAdapter.set('trust proxy', 1);
  }

  if (config.get('OPENAPI_ENABLED', { infer: true })) {
    setupOpenApi(app);
  }
}
