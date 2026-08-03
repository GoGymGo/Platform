import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    index("idx_public_site_feedback_status_created").on(
      table.status,
      table.createdAt,
    ),
  ],
);
