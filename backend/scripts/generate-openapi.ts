import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { createOpenApiDocument } from '../src/common/openapi/openapi';

process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'test';
process.env.OPENAPI_ENABLED = 'false';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApplication(app);
  await app.init();

  const document = createOpenApiDocument(app);
  await writeFile(
    resolve(process.cwd(), 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
}

void generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
