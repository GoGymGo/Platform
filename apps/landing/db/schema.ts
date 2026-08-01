import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
