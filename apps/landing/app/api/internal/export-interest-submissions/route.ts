import { asc } from "drizzle-orm";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { interestSubmissions } from "@/db/schema";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function unavailable() {
  return new Response(null, { headers: noStoreHeaders, status: 404 });
}

export async function GET() {
  if (process.env.LANDING_D1_EXPORT_ENABLED !== "yes") {
    return unavailable();
  }

  const ownerEmail = process.env.LANDING_D1_EXPORT_OWNER_EMAIL
    ?.trim()
    .toLowerCase();
  if (!ownerEmail) {
    return unavailable();
  }

  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "Authentication is required." },
      { headers: noStoreHeaders, status: 401 },
    );
  }
  if (user.email.trim().toLowerCase() !== ownerEmail) {
    return Response.json(
      { error: "This export is restricted to the configured site owner." },
      { headers: noStoreHeaders, status: 403 },
    );
  }

  try {
    const rows = await getDb()
      .select()
      .from(interestSubmissions)
      .orderBy(asc(interestSubmissions.createdAt));

    const results = rows.map((row) => ({
      audience: row.audience,
      company_name: row.companyName,
      consent: row.consent ? 1 : 0,
      created_at: row.createdAt,
      discovery_source: row.discoverySource,
      email: row.email,
      full_name: row.fullName,
      goal_days: row.goalDays,
      id: row.id,
      message: row.message,
      partnership_interest: row.partnershipInterest,
      region: row.region,
      updated_at: row.updatedAt,
      website: row.website,
      workout_style: row.workoutStyle,
    }));

    return new Response(`${JSON.stringify({ results }, null, 2)}\n`, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition":
          'attachment; filename="landing-interest-submissions.json"',
        "Content-Security-Policy": "default-src 'none'",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  } catch {
    return Response.json(
      { error: "The historical submission export is temporarily unavailable." },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
