import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Environment } from '../config/environment';
import type { Database } from './database.types';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly connection: Kysely<Database>;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(config: ConfigService<Environment, true>) {
    const pool = new Pool({
      application_name: 'gogymgo-api',
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
    });
    pool.on('error', (error) => {
      this.logger.error({
        errorType: error.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120),
        event: 'database.pool.idle_client_failed',
      });
    });

    this.connection = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection.destroy();
  }
}
