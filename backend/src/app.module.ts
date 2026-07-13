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
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { DrawsModule } from './modules/draws/draws.module';
import { CreatorWorkoutsModule } from './modules/creator-workouts/creator-workouts.module';
import { HealthModule } from './modules/health/health.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OperatorModule } from './modules/operator/operator.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { RegionsModule } from './modules/regions/regions.module';
import { ResultsModule } from './modules/results/results.module';
import { SessionsModule } from './modules/sessions/sessions.module';

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
                'req.body.pushToken',
                'req.body.deviceEvidenceToken',
                'req.body.qrPayload',
                'req.body.postalCode',
                'req.body.latitude',
                'req.body.longitude',
                'req.body.reason',
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
    LedgerModule,
    NotificationsModule,
    OperatorModule,
    OperationsModule,
    HealthModule,
    ProfilesModule,
    PartnersModule,
    RegionsModule,
    ResultsModule,
    CompetitionsModule,
    CreatorWorkoutsModule,
    SessionsModule,
    LeaderboardsModule,
    PayoutsModule,
    PrivacyModule,
    DrawsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
