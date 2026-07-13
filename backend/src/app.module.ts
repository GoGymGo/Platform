import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { Environment, validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RegionsModule } from './modules/regions/regions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        const isProduction =
          config.get('NODE_ENV', { infer: true }) === 'production';

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.token',
                'req.body.idToken',
                'req.body.bankAccount',
                'req.body.taxId',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            genReqId: (request) => {
              const suppliedRequestId = request.headers['x-request-id'];
              return typeof suppliedRequestId === 'string' &&
                suppliedRequestId.length <= 128
                ? suppliedRequestId
                : randomUUID();
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => [
        {
          limit: config.get('RATE_LIMIT_MAX', { infer: true }),
          ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    IdempotencyModule,
    AuthModule,
    HealthModule,
    ProfilesModule,
    RegionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
