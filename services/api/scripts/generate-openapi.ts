import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { format } from 'prettier';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { createOpenApiDocument } from '../src/common/openapi/openapi';

process.env.NODE_ENV = 'test';
process.env.OPENAPI_ENABLED = 'false';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    logger: ['error'],
  });
  configureApplication(app);
  await app.init();

  const document = createOpenApiDocument(app);
  const formattedDocument = await format(JSON.stringify(document), {
    endOfLine: 'lf',
    parser: 'json',
  });
  await writeFile(resolve(process.cwd(), 'openapi.json'), formattedDocument);
  await app.close();
}

void generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
