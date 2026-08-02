const PLATFORM_API_URL = process.env.GOGYMGO_API_URL?.replace(/\/+$/, "");

type InterestPayload = {
  contactFax?: unknown;
  [key: string]: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let payload: InterestPayload;

  try {
    payload = (await request.json()) as InterestPayload;
  } catch {
    return Response.json({ error: "Enter valid form details." }, { status: 400 });
  }

  // Quietly accept the hidden honeypot so automated submissions learn nothing.
  if (clean(payload.contactFax, 200)) {
    return Response.json({ saved: true }, { status: 201 });
  }

  if (!PLATFORM_API_URL) {
    return Response.json(
      { error: "Registration is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  const { contactFax: _contactFax, ...submission } = payload;
  void _contactFax;

  try {
    const response = await fetch(`${PLATFORM_API_URL}/v1/interest-submissions`, {
      body: JSON.stringify(submission),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();

    return new Response(body || null, {
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
      status: response.status,
    });
  } catch {
    return Response.json(
      { error: "We couldn't save your information. Please try again." },
      { status: 502 },
    );
  }
}
