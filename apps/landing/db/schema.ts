import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const interestSubmissions = sqliteTable(
  "interest_submissions",
  {
    id: text("id").primaryKey(),
    audience: text("audience", { enum: ["gym_goer", "brand"] }).notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    companyName: text("company_name"),
    website: text("website"),
    region: text("region").notNull(),
    goalDays: integer("goal_days"),
    workoutStyle: text("workout_style"),
    partnershipInterest: text("partnership_interest"),
    discoverySource: text("discovery_source"),
    message: text("message"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("interest_submissions_audience_email_unique").on(
      table.audience,
      table.email,
    ),
  ],
);

export const publicSiteFeedback = sqliteTable(
  "public_site_feedback",
  {
    id: text("id").primaryKey(),
    category: text("category", {
      enum: [
        "accessibility",
        "broken_link",
        "form_problem",
        "readability",
        "other",
      ],
    }).notNull(),
    email: text("email").notNull(),
    page: text("page").notNull(),
    message: text("message").notNull(),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", {
      enum: ["new", "reviewed", "resolved"],
    })
      .notNull()
      .default("new"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_public_site_feedback_created").on(table.createdAt),
    index("idx_public_site_feedback_status_created").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const publicSiteRateBuckets = sqliteTable(
  "public_site_rate_buckets",
  {
    bucketKey: text("bucket_key").primaryKey(),
    attemptCount: integer("attempt_count").notNull(),
    expiresAt: text("expires_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "public_site_rate_buckets_attempt_count_check",
      sql`${table.attemptCount} >= 1 AND ${table.attemptCount} <= 10000`,
    ),
    index("idx_public_site_rate_buckets_expires").on(table.expiresAt),
  ],
);

export const publicSiteOperationsAudit = sqliteTable(
  "public_site_operations_audit",
  {
    id: text("id").primaryKey(),
    operation: text("operation", {
      enum: [
        "export_feedback",
        "export_events",
        "retention_feedback",
        "retention_events",
        "retention_audit",
      ],
    }).notNull(),
    affectedCount: integer("affected_count").notNull(),
    pageSize: integer("page_size").notNull(),
    cursorUsed: integer("cursor_used", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check(
      "public_site_operations_audit_affected_count_check",
      sql`${table.affectedCount} >= 0 AND ${table.affectedCount} <= 1000`,
    ),
    check(
      "public_site_operations_audit_page_size_check",
      sql`${table.pageSize} >= 1 AND ${table.pageSize} <= 1000`,
    ),
    index("idx_public_site_operations_audit_created").on(table.createdAt),
  ],
);

export const publicSiteEvents = sqliteTable(
  "public_site_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name", {
      enum: [
        "member_app_click",
        "regional_updates_click",
        "brand_partnership_click",
        "demo_click",
        "faq_open",
        "gym_form_start",
        "brand_form_start",
        "feedback_form_start",
      ],
    }).notNull(),
    path: text("path").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_public_site_events_created").on(table.createdAt),
  ],
);
