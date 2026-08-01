import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { ConfigService } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { Environment, validateEnvironment } from '../../src/config/environment';

const execFileAsync = promisify(execFile);

export interface MigratedPostgisTestDatabase {
  container: StartedPostgreSqlContainer;
  databaseUrl: string;
  pool: Pool;
  stop(): Promise<void>;
}

export async function startMigratedPostgisTestDatabase(): Promise<MigratedPostgisTestDatabase> {
  const container = await new PostgreSqlContainer(
    'postgis/postgis:17-3.5',
  ).start();
  const databaseUrl = container.getConnectionUri();
  await execFileAsync(
    process.execPath,
    [
      resolve(
        process.cwd(),
        'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
      ),
      'up',
      '--tsx',
      '--migrations-dir',
      resolve(process.cwd(), 'migrations'),
      '--database-url-var',
      'DATABASE_URL',
    ],
    { env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    container,
    databaseUrl,
    pool,
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
}

export function createTestConfig(
  databaseUrl: string,
  overrides: Record<string, unknown> = {},
): ConfigService<Environment, true> {
  const environment = validateEnvironment({
    DATABASE_POOL_MAX: '5',
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    ...overrides,
  });
  return new ConfigService<Environment, true>(environment);
}
