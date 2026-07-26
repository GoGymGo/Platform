import { env } from "cloudflare:workers";

let initialized: Promise<void> | null = null;

export function ensureInterestTable() {
  if (!initialized) {
    initialized = initialize();
  }
  return initialized;
}

async function initialize() {
  if (!env.DB) {
    throw new Error("The interest database is not available.");
  }

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS interest_submissions (
        id TEXT PRIMARY KEY NOT NULL,
        audience TEXT NOT NULL CHECK (audience IN ('gym_goer', 'brand')),
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        company_name TEXT,
        website TEXT,
        region TEXT NOT NULL,
        goal_days INTEGER,
        workout_style TEXT,
        partnership_interest TEXT,
        discovery_source TEXT,
        message TEXT,
        consent INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS interest_submissions_audience_email_unique
      ON interest_submissions (audience, email)
    `),
  ]);
}
