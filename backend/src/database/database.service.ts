import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Environment } from '../config/environment';
import type { Database } from './database.types';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly connection: Kysely<Database>;

  constructor(config: ConfigService<Environment, true>) {
    const pool = new Pool({
      application_name: 'gogymgo-api',
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
    });

    this.connection = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection.destroy();
  }
}
