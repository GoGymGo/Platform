import { publicSiteEventDefinitions, type PublicSiteEventName } from "../public-site-events";
import { publicSiteEventNames } from "../public-site-events";
import type {
  FeedbackCategory,
  FeedbackPage,
  PublicSiteRetentionPolicy,
} from "../public-site-policy";
import { feedbackPagePaths } from "../public-site-policy";
import { feedbackCategories } from "../public-site-policy";
import {
  encodeExportCursor,
  type EventCursor,
  type ExportPage,
  type FeedbackCursor,
} from "./internal/public-site-owner";

const eventRequestsPerMinute = 240;
const feedbackRequestsPerMinute = 20;
const cleanupPageSize = 100;
const eventExportPlaceholders = publicSiteEventNames
  .map((_eventName, index) => `?${index + 2}`)
  .join(", ");

export type PublicSiteStoreOutcome = "rate_limited" | "saved";

export type PublicSiteFeedbackRecord = {
  category: FeedbackCategory;
  consent: boolean;
  email: string;
  message: string;
  page: FeedbackPage;
  submissionId: string;
};

export type FeedbackExportResult = {
  nextCursor: string | null;
  results: Array<{
    category: FeedbackCategory;
    contact_email: string | null;
    created_at: string;
    id: string;
    message: string;
    page: string;
  }>;
};

export type EventExportResult = {
  nextCursor: string | null;
  results: Array<{
    canonical_path: string;
    count: number;
    day: string;
    event_name: PublicSiteEventName;
  }>;
};

export type RetentionKind = "audit" | "events" | "feedback";

export type RetentionResult = {
  deleted: number;
  hasMore: boolean;
};

export async function storePublicSiteEvent(
  db: D1Database,
  eventName: PublicSiteEventName,
  now: Date,
  retention: PublicSiteRetentionPolicy,
): Promise<PublicSiteStoreOutcome> {
  const createdAt = now.toISOString();
  const allowed = await consumeAggregateRateLimit(
    db,
    "events",
    eventRequestsPerMinute,
    now,
  );
  if (!allowed) {
    return "rate_limited";
  }

  const eventCutoff = retentionCutoff(now, retention.eventDays);
  await db.batch([
    db
      .prepare(
        `DELETE FROM public_site_events
         WHERE id IN (
           SELECT id FROM public_site_events
           WHERE created_at < ?1
           ORDER BY created_at ASC
           LIMIT ?2
         )`,
      )
      .bind(eventCutoff, cleanupPageSize),
    expiredRateBucketCleanup(db, createdAt),
    db
      .prepare(
        `INSERT INTO public_site_events (id, event_name, path, created_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(
        crypto.randomUUID(),
        eventName,
        publicSiteEventDefinitions[eventName].canonicalPath,
        createdAt,
      ),
  ]);
  return "saved";
}

export async function storePublicSiteFeedback(
  db: D1Database,
  feedback: PublicSiteFeedbackRecord,
  now: Date,
  retention: PublicSiteRetentionPolicy,
): Promise<PublicSiteStoreOutcome> {
  const createdAt = now.toISOString();
  const allowed = await consumeAggregateRateLimit(
    db,
    "feedback",
    feedbackRequestsPerMinute,
    now,
  );
  if (!allowed) {
    return "rate_limited";
  }

  const feedbackCutoff = retentionCutoff(now, retention.feedbackDays);
  await db.batch([
    db
      .prepare(
        `DELETE FROM public_site_feedback
         WHERE id IN (
           SELECT id FROM public_site_feedback
           WHERE created_at < ?1
           ORDER BY created_at ASC
           LIMIT ?2
         )`,
      )
      .bind(feedbackCutoff, cleanupPageSize),
    expiredRateBucketCleanup(db, createdAt),
    db
      .prepare(
        `INSERT OR IGNORE INTO public_site_feedback
           (id, category, email, page, message, consent, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'new', ?7, ?7)`,
      )
      .bind(
        feedback.submissionId,
        feedback.category,
        feedback.email,
        feedbackPagePaths[feedback.page],
        feedback.message,
        feedback.consent ? 1 : 0,
        createdAt,
      ),
  ]);
  return "saved";
}

export function retentionCutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export async function exportPublicSiteFeedback(
  db: D1Database,
  page: ExportPage<FeedbackCursor>,
  now: Date,
  retentionDays: number,
): Promise<FeedbackExportResult> {
  const cutoff = retentionCutoff(now, retentionDays);
  const statement = page.cursor
    ? db
        .prepare(
          `SELECT id, category, email, page, message, consent, created_at
           FROM public_site_feedback
           WHERE created_at >= ?1
             AND (created_at < ?2 OR (created_at = ?2 AND id < ?3))
           ORDER BY created_at DESC, id DESC
           LIMIT ?4`,
        )
        .bind(
          cutoff,
          page.cursor.createdAt,
          page.cursor.id,
          page.limit + 1,
        )
    : db
        .prepare(
          `SELECT id, category, email, page, message, consent, created_at
           FROM public_site_feedback
           WHERE created_at >= ?1
           ORDER BY created_at DESC, id DESC
           LIMIT ?2`,
        )
        .bind(cutoff, page.limit + 1);
  const query = await statement.all<Record<string, unknown>>();
  const decoded = query.results.map(decodeFeedbackExportRow);
  const hasMore = decoded.length > page.limit;
  const selected = decoded.slice(0, page.limit);
  const last = selected.at(-1);

  await auditPublicSiteOperation(
    db,
    "export_feedback",
    selected.length,
    page.limit,
    page.cursor !== null,
    now,
  );

  return {
    nextCursor:
      hasMore && last
        ? encodeExportCursor({
            createdAt: last.created_at,
            id: last.id,
            kind: "feedback",
          })
        : null,
    results: selected,
  };
}

export async function exportPublicSiteEvents(
  db: D1Database,
  page: ExportPage<EventCursor>,
  now: Date,
  retentionDays: number,
): Promise<EventExportResult> {
  const cutoff = retentionCutoff(now, retentionDays);
  const statement = page.cursor
    ? db
        .prepare(
          `SELECT substr(created_at, 1, 10) AS event_day,
                  event_name,
                  COUNT(*) AS event_count
           FROM public_site_events
           WHERE created_at >= ?1
             AND event_name IN (${eventExportPlaceholders})
           GROUP BY event_day, event_name
           HAVING event_day < ?10
              OR (event_day = ?10 AND event_name < ?11)
           ORDER BY event_day DESC, event_name DESC
           LIMIT ?12`,
        )
        .bind(
          cutoff,
          ...publicSiteEventNames,
          page.cursor.day,
          page.cursor.eventName,
          page.limit + 1,
        )
    : db
        .prepare(
          `SELECT substr(created_at, 1, 10) AS event_day,
                  event_name,
                  COUNT(*) AS event_count
           FROM public_site_events
           WHERE created_at >= ?1
             AND event_name IN (${eventExportPlaceholders})
           GROUP BY event_day, event_name
           ORDER BY event_day DESC, event_name DESC
           LIMIT ?10`,
        )
        .bind(cutoff, ...publicSiteEventNames, page.limit + 1);
  const query = await statement.all<Record<string, unknown>>();
  const decoded = query.results.map(decodeEventExportRow);
  const hasMore = decoded.length > page.limit;
  const selected = decoded.slice(0, page.limit);
  const last = selected.at(-1);

  await auditPublicSiteOperation(
    db,
    "export_events",
    selected.length,
    page.limit,
    page.cursor !== null,
    now,
  );

  return {
    nextCursor:
      hasMore && last
        ? encodeExportCursor({
            day: last.day,
            eventName: last.event_name,
            kind: "events",
          })
        : null,
    results: selected,
  };
}

export async function runPublicSiteRetention(
  db: D1Database,
  kind: RetentionKind,
  limit: number,
  now: Date,
  retention: PublicSiteRetentionPolicy,
): Promise<RetentionResult> {
  const definition = retentionDefinition(kind, now, retention);
  const deletion = await db
    .prepare(definition.deleteSql)
    .bind(definition.cutoff, limit)
    .run();
  const deleted = deletion.meta.changes;
  if (!Number.isSafeInteger(deleted) || deleted < 0 || deleted > limit) {
    throw new Error("Invalid D1 retention result");
  }

  const remaining = await db
    .prepare(definition.remainingSql)
    .bind(definition.cutoff)
    .first<{ present: number }>();

  await auditPublicSiteOperation(
    db,
    definition.operation,
    deleted,
    limit,
    false,
    now,
  );

  return { deleted, hasMore: remaining?.present === 1 };
}

async function auditPublicSiteOperation(
  db: D1Database,
  operation:
    | "export_events"
    | "export_feedback"
    | "retention_audit"
    | "retention_events"
    | "retention_feedback",
  affectedCount: number,
  pageSize: number,
  cursorUsed: boolean,
  now: Date,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO public_site_operations_audit
         (id, operation, affected_count, page_size, cursor_used, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      operation,
      affectedCount,
      pageSize,
      cursorUsed ? 1 : 0,
      now.toISOString(),
    )
    .run();
}

function decodeFeedbackExportRow(
  row: Record<string, unknown>,
): FeedbackExportResult["results"][number] {
  if (
    !hasExactRowKeys(row, [
      "category",
      "consent",
      "created_at",
      "email",
      "id",
      "message",
      "page",
    ]) ||
    typeof row.id !== "string" ||
    row.id.length < 1 ||
    row.id.length > 64 ||
    typeof row.category !== "string" ||
    !feedbackCategories.includes(row.category as FeedbackCategory) ||
    typeof row.email !== "string" ||
    row.email.length > 320 ||
    (row.email.length > 0 &&
      row.consent === 1 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) ||
    (row.consent !== 0 && row.consent !== 1) ||
    typeof row.page !== "string" ||
    row.page.length < 1 ||
    row.page.length > 300 ||
    typeof row.message !== "string" ||
    row.message.length < 20 ||
    row.message.length > 2_000 ||
    typeof row.created_at !== "string" ||
    !isIsoTimestamp(row.created_at)
  ) {
    throw new Error("Invalid feedback export row");
  }

  return {
    category: row.category as FeedbackCategory,
    contact_email: row.consent === 1 && row.email ? row.email : null,
    created_at: row.created_at,
    id: row.id,
    message: row.message,
    page: Object.values(feedbackPagePaths).includes(
      row.page as (typeof feedbackPagePaths)[FeedbackPage],
    )
      ? row.page
      : "legacy_unclassified",
  };
}

function decodeEventExportRow(
  row: Record<string, unknown>,
): EventExportResult["results"][number] {
  if (
    !hasExactRowKeys(row, ["event_count", "event_day", "event_name"]) ||
    typeof row.event_day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.event_day) ||
    typeof row.event_name !== "string" ||
    !publicSiteEventNames.includes(row.event_name as PublicSiteEventName) ||
    typeof row.event_count !== "number" ||
    !Number.isSafeInteger(row.event_count) ||
    row.event_count < 1
  ) {
    throw new Error("Invalid event export row");
  }

  return {
    canonical_path:
      publicSiteEventDefinitions[row.event_name as PublicSiteEventName]
        .canonicalPath,
    count: row.event_count,
    day: row.event_day,
    event_name: row.event_name as PublicSiteEventName,
  };
}

function hasExactRowKeys(
  row: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(row).length === keys.length &&
    keys.every((key) => Object.hasOwn(row, key))
  );
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function retentionDefinition(
  kind: RetentionKind,
  now: Date,
  retention: PublicSiteRetentionPolicy,
) {
  if (kind === "feedback") {
    return {
      cutoff: retentionCutoff(now, retention.feedbackDays),
      deleteSql:
        "DELETE FROM public_site_feedback WHERE id IN (SELECT id FROM public_site_feedback WHERE created_at < ?1 ORDER BY created_at ASC LIMIT ?2)",
      operation: "retention_feedback" as const,
      remainingSql:
        "SELECT 1 AS present FROM public_site_feedback WHERE created_at < ?1 LIMIT 1",
    };
  }
  if (kind === "events") {
    return {
      cutoff: retentionCutoff(now, retention.eventDays),
      deleteSql:
        "DELETE FROM public_site_events WHERE id IN (SELECT id FROM public_site_events WHERE created_at < ?1 ORDER BY created_at ASC LIMIT ?2)",
      operation: "retention_events" as const,
      remainingSql:
        "SELECT 1 AS present FROM public_site_events WHERE created_at < ?1 LIMIT 1",
    };
  }
  return {
    cutoff: retentionCutoff(now, 365),
    deleteSql:
      "DELETE FROM public_site_operations_audit WHERE id IN (SELECT id FROM public_site_operations_audit WHERE created_at < ?1 ORDER BY created_at ASC LIMIT ?2)",
    operation: "retention_audit" as const,
    remainingSql:
      "SELECT 1 AS present FROM public_site_operations_audit WHERE created_at < ?1 LIMIT 1",
  };
}

async function consumeAggregateRateLimit(
  db: D1Database,
  kind: "events" | "feedback",
  maximum: number,
  now: Date,
): Promise<boolean> {
  const nowIso = now.toISOString();
  const bucketKey = `${kind}:${nowIso.slice(0, 16)}`;
  const expiresAt = new Date(now.getTime() + 86_400_000).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO public_site_rate_buckets
         (bucket_key, attempt_count, expires_at, updated_at)
       VALUES (?1, 1, ?2, ?3)
       ON CONFLICT(bucket_key) DO UPDATE SET
         attempt_count = public_site_rate_buckets.attempt_count + 1,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at
       WHERE public_site_rate_buckets.attempt_count < ?4
       RETURNING attempt_count`,
    )
    .bind(bucketKey, expiresAt, nowIso, maximum)
    .first<{ attempt_count: number }>();

  return (
    result !== null &&
    Number.isSafeInteger(result.attempt_count) &&
    result.attempt_count >= 1 &&
    result.attempt_count <= maximum
  );
}

function expiredRateBucketCleanup(
  db: D1Database,
  nowIso: string,
): D1PreparedStatement {
  return db
    .prepare(
      `DELETE FROM public_site_rate_buckets
       WHERE bucket_key IN (
         SELECT bucket_key FROM public_site_rate_buckets
         WHERE expires_at < ?1
         ORDER BY expires_at ASC
         LIMIT ?2
       )`,
    )
    .bind(nowIso, cleanupPageSize);
}
