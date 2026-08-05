import { getDb } from "@/db";
import { publicSiteEvents } from "@/db/schema";
import {
  type PublicSiteEventName,
  publicSiteEventNames,
} from "@/app/public-site-events";

type EventPayload = {
  eventName?: unknown;
  path?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let payload: EventPayload;

  try {
    payload = (await request.json()) as EventPayload;
  } catch {
    return Response.json({ error: "Invalid event." }, { status: 400 });
  }

  const eventName = clean(payload.eventName, 80) as PublicSiteEventName;
  const path = clean(payload.path, 160);

  if (!publicSiteEventNames.includes(eventName)) {
    return Response.json({ error: "Unknown event." }, { status: 400 });
  }
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(path)) {
    return Response.json({ error: "Invalid public path." }, { status: 400 });
  }

  try {
    await getDb().insert(publicSiteEvents).values({
      createdAt: new Date().toISOString(),
      eventName,
      id: crypto.randomUUID(),
      path,
    });

    return new Response(null, {
      headers: { "Cache-Control": "no-store" },
      status: 204,
    });
  } catch {
    return Response.json(
      { error: "Public-site measurement is temporarily unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }
}
