import { desc } from "drizzle-orm";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { publicSiteFeedback } from "@/db/schema";

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
      .from(publicSiteFeedback)
      .orderBy(desc(publicSiteFeedback.createdAt));

    const results = rows.map((row) => ({
      category: row.category,
      consent: row.consent ? 1 : 0,
      created_at: row.createdAt,
      email: row.email,
      id: row.id,
      message: row.message,
      page: row.page,
      status: row.status,
      updated_at: row.updatedAt,
    }));

    return new Response(`${JSON.stringify({ results }, null, 2)}\n`, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition":
          'attachment; filename="landing-public-site-feedback.json"',
        "Content-Security-Policy": "default-src 'none'",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  } catch {
    return Response.json(
      { error: "The public-site feedback export is temporarily unavailable." },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
