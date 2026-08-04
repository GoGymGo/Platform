const PLATFORM_API_URL = process.env.GOGYMGO_API_URL?.replace(/\/+$/, "");

type RegionalUpdatePayload = {
  contactFax?: unknown;
  email?: unknown;
  requestedRegion?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let payload: RegionalUpdatePayload;

  try {
    payload = (await request.json()) as RegionalUpdatePayload;
  } catch {
    return Response.json({ error: "Enter valid update details." }, { status: 400 });
  }

  if (clean(payload.contactFax, 200)) {
    return Response.json({ saved: true }, { status: 201 });
  }

  const email = clean(payload.email, 320);
  const requestedRegion = clean(payload.requestedRegion, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !requestedRegion) {
    return Response.json(
      { error: "Enter your email and city or region." },
      { status: 400 },
    );
  }

  if (!PLATFORM_API_URL) {
    return Response.json(
      { error: "Regional updates are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${PLATFORM_API_URL}/v1/region-waitlist`, {
      body: JSON.stringify({ email, requestedRegion }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();

    return new Response(body || null, {
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
      },
      status: response.status,
    });
  } catch {
    return Response.json(
      { error: "We couldn't save your update request. Please try again." },
      { status: 502 },
    );
  }
}
