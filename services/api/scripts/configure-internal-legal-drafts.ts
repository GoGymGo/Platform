import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { sql } from 'kysely';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { AdminLegalDocumentsService } from '../src/modules/legal/admin-legal-documents.service';
import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import {
  hashLegalDocumentContent,
  requiredAccountLegalDocumentKeys,
} from '../src/modules/legal/legal-document';

const databaseUrl =
  process.env.DATABASE_URL?.trim() ??
  'postgresql://gogymgo:gogymgo@127.0.0.1:5432/gogymgo';
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_POOL_MAX ??= '2';
process.env.PRETTY_LOGS_ENABLED ??= 'false';

const applyDrafts = process.env.APPLY_INTERNAL_LEGAL_DRAFTS === 'yes';
const documentConfigPath = resolve(
  process.cwd(),
  'config',
  'legal',
  'internal-testing-ca-bc-en.json',
);

const legalSectionSchema = z
  .object({
    body: z.string().trim().min(1).max(4_000).optional(),
    bullets: z
      .array(z.string().trim().min(1).max(1_000))
      .min(1)
      .max(30)
      .optional(),
    heading: z.string().trim().min(1).max(160),
  })
  .strict()
  .refine((section) => Boolean(section.body || section.bullets), {
    message: 'Every legal section needs body text or bullets.',
  });

const legalDocumentSchema = z
  .object({
    content: z
      .object({
        intro: z.string().trim().min(1).max(4_000),
        sections: z.array(legalSectionSchema).min(1).max(40),
      })
      .strict(),
    documentKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    effectiveAt: z.iso.datetime(),
    jurisdictionCode: z.literal('GLOBAL'),
    locale: z.literal('en'),
    receiptRequirement: z.enum(['accept', 'acknowledge']),
    title: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(64),
  })
  .strict();

const legalDraftConfigSchema = z
  .object({
    documents: z.array(legalDocumentSchema).min(2).max(20),
    draftStatus: z.literal('internal_testing_only'),
    researchSources: z.array(z.url()).min(1),
    reviewRequired: z.literal(true),
  })
  .strict();

type LegalDraftDocument = z.infer<typeof legalDocumentSchema>;

async function findAdministrator(
  database: DatabaseService,
): Promise<AuthenticatedPrincipal> {
  const requestedUid = process.env.LEGAL_DRAFT_ADMIN_FIREBASE_UID?.trim();
  let query = database.connection
    .selectFrom('users')
    .select(['email', 'email_verified', 'firebase_uid', 'roles'])
    .where('status', '=', 'active')
    .where(sql<boolean>`'admin' = ANY(roles)`);
  if (requestedUid) {
    query = query.where('firebase_uid', '=', requestedUid);
  }
  const administrators = await query.execute();
  if (administrators.length !== 1) {
    throw new Error(
      requestedUid
        ? 'LEGAL_DRAFT_ADMIN_FIREBASE_UID does not identify one active administrator.'
        : 'Exactly one active administrator is required; set LEGAL_DRAFT_ADMIN_FIREBASE_UID.',
    );
  }
  const administrator = administrators[0];
  if (!administrator.email || !administrator.email_verified) {
    throw new Error(
      'The legal-draft administrator must have a verified email.',
    );
  }
  return {
    email: administrator.email,
    emailVerified: true,
    firebaseUid: administrator.firebase_uid,
    roles: administrator.roles,
    tokenIssuedAt: Math.floor(Date.now() / 1_000),
  };
}

function validateDraftConfiguration(documents: LegalDraftDocument[]): void {
  const keys = new Set(documents.map((document) => document.documentKey));
  for (const requiredKey of requiredAccountLegalDocumentKeys) {
    if (!keys.has(requiredKey)) {
      throw new Error(`The draft bundle is missing ${requiredKey}.`);
    }
  }
  if (keys.size !== documents.length) {
    throw new Error('The draft bundle contains a duplicate document key.');
  }

  for (const document of documents) {
    const serialized = JSON.stringify(document);
    if (
      !document.title.includes('INTERNAL TEST DRAFT') ||
      !serialized.includes('[INSERT ')
    ) {
      throw new Error(
        `${document.documentKey} must remain visibly marked as an incomplete internal test draft.`,
      );
    }
  }
}

async function ensureDocument(
  database: DatabaseService,
  service: AdminLegalDocumentsService,
  principal: AuthenticatedPrincipal,
  document: LegalDraftDocument,
): Promise<string> {
  const expectedHash = hashLegalDocumentContent(
    document.title,
    document.content,
  );
  const existing = await database.connection
    .selectFrom('legal_documents')
    .select(['content_sha256', 'id'])
    .where('document_key', '=', document.documentKey)
    .where('jurisdiction_code', '=', document.jurisdictionCode)
    .where('locale', '=', document.locale)
    .where('version', '=', document.version)
    .executeTakeFirst();

  if (existing) {
    if (existing.content_sha256 !== expectedHash) {
      throw new Error(
        `${document.documentKey} already uses this immutable version with different content.`,
      );
    }
    const event = await database.connection
      .selectFrom('legal_document_events')
      .select('next_state')
      .where('legal_document_id', '=', existing.id)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    if (event.next_state !== 'published') {
      throw new Error(
        `${document.documentKey} exists but is withdrawn; create a later version instead.`,
      );
    }
    return existing.id;
  }

  const result = await service.publish(
    principal,
    `publish-${document.documentKey}-${document.version}`,
    {
      ...document,
      reason:
        'Publish a visibly marked internal-testing draft to exercise the connected legal-document and receipt flow. This is not legal approval.',
    },
  );
  return result.id;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Internal legal drafts must never be configured in a production environment.',
    );
  }

  const parsed = legalDraftConfigSchema.parse(
    JSON.parse(await readFile(documentConfigPath, 'utf8')) as unknown,
  );
  validateDraftConfiguration(parsed.documents);
  console.log(
    `Validated ${parsed.documents.length} visibly marked internal legal drafts.`,
  );

  if (!applyDrafts) {
    console.log(
      'Dry run complete. Set APPLY_INTERNAL_LEGAL_DRAFTS=yes to publish them to a non-production database.',
    );
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const database = app.get(DatabaseService);
    const principal = await findAdministrator(database);
    const adminLegal = app.get(AdminLegalDocumentsService);
    const ids: string[] = [];
    for (const document of parsed.documents) {
      ids.push(await ensureDocument(database, adminLegal, principal, document));
    }

    const current = await app.get(LegalDocumentsService).getCurrent({
      jurisdictionCode: 'CA-BC',
      locale: 'en',
    });
    const currentKeys = new Set(
      current.documents.map((document) => document.documentKey),
    );
    if (
      !current.configured ||
      !requiredAccountLegalDocumentKeys.every((key) => currentKeys.has(key))
    ) {
      throw new Error(
        'The published internal bundle did not resolve as configured for CA-BC/en.',
      );
    }
    console.log(
      `Published legal document IDs: ${ids.join(', ')}. ` +
        `CA-BC/en bundle ${current.bundleSha256} is configured.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
