import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assembleLandingInterestArtifact,
  parseLandingInterestExportPage,
} from '../src/modules/gyms/landing-intake-artifact';

async function main(): Promise<void> {
  const outputFlag = process.argv.indexOf('--output');
  if (outputFlag < 0 || !process.argv[outputFlag + 1]) {
    throw new Error(
      'Pass --output <artifact.json> followed by every export page in order.',
    );
  }
  const outputPath = resolve(process.argv[outputFlag + 1]);
  const pagePaths = process.argv.slice(2).filter((_value, index) => {
    const absoluteIndex = index + 2;
    return absoluteIndex !== outputFlag && absoluteIndex !== outputFlag + 1;
  });
  if (
    pagePaths.length < 1 ||
    pagePaths.some((value) => value.startsWith('--'))
  ) {
    throw new Error('Pass every bounded export page in exact sequence order.');
  }

  const pages = [];
  for (const pagePath of pagePaths) {
    const parsed: unknown = JSON.parse(
      await readFile(resolve(pagePath), 'utf8'),
    );
    pages.push(parseLandingInterestExportPage(parsed));
  }
  const artifact = assembleLandingInterestArtifact(pages);
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(
    'Landing export artifact prepared: ' +
      `source=${artifact.source_count}; ` +
      `unique=${artifact.unique_business_key_count}; ` +
      `duplicates=${artifact.duplicate_business_key_count}; ` +
      `pages=${artifact.page_count}; ` +
      `recordsSha256=${artifact.records_sha256}; ` +
      `artifactSha256=${artifact.artifact_sha256}.`,
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Landing export artifact preparation failed.',
  );
  process.exitCode = 1;
});
